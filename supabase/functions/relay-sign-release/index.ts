// Follows Deno and Supabase Edge Functions runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { ethers } from 'https://esm.sh/ethers@6.11.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MASTER_KEY_HEX = 'e4b9d031c5fae448b11c97a840e69888d30e386050bf991cf8813fa25036e789';

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
};

async function decryptAesGcm(ciphertextHex: string, ivHex: string, authTagHex: string, masterKeyHex: string): Promise<string> {
  const keyBytes = hexToBytes(masterKeyHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(ciphertextHex);
  const authTagBytes = hexToBytes(authTagHex);

  const combined = new Uint8Array(cipherBytes.length + authTagBytes.length);
  combined.set(cipherBytes, 0);
  combined.set(authTagBytes, cipherBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

const handoverAbi = [
  'function signRelease(string drNumber, string handoverContractId, string category, uint256 quantity, string[] batchTokenIds, uint256[] batchQuantities, string fromLocation, string destination, string senderGps) returns (uint256)'
];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const rpcUrl = Deno.env.get('BLOCKCHAIN_RPC_URL') || Deno.env.get('VITE_BLOCKCHAIN_RPC_URL') || 'https://ethereum-sepolia-rpc.publicnode.com';
    const contractAddress = Deno.env.get('RELIEF_TRACKER_CONTRACT_ADDRESS') || Deno.env.get('VITE_RELIEF_TRACKER_CONTRACT_ADDRESS') || '0x4CA82B943107a32A3E3fe05A2aD057F602D496e5';
    const masterKey = Deno.env.get('WALLET_ENCRYPTION_MASTER_KEY') || DEFAULT_MASTER_KEY_HEX;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired user session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { batchId, drNumber, coordinates } = body;

    // Verify user profile and permissions
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Driver profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!profile.encrypted_private_key || !profile.key_iv || !profile.key_auth_tag) {
      return new Response(JSON.stringify({ error: 'No custodial wallet provisioned for this driver' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Decrypt driver private key
    const driverPrivateKey = await decryptAesGcm(
      profile.encrypted_private_key,
      profile.key_iv,
      profile.key_auth_tag,
      masterKey
    );

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const driverWallet = new ethers.Wallet(driverPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, handoverAbi, driverWallet);

    const gpsText = coordinates ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}` : '10.6912, 122.4728';
    const canonicalDr = drNumber || `DR-${batchId || '2026-001'}`;
    const handoverContractId = `HANDOVER-${canonicalDr.replace('DR-', '')}`;

    // Execute signRelease on smart contract with driver's custodial wallet
    const tx = await contract.signRelease(
      canonicalDr,
      handoverContractId,
      'Relief Goods',
      1,
      [canonicalDr],
      [1],
      'DSWD Logistics Hub',
      'Assigned LGU',
      gpsText
    );

    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;

    // Update database records
    if (batchId) {
      await supabase
        .from('batches')
        .update({
          status: 'IN_TRANSIT',
          assigned_driver_id: user.id,
          tx_hash_release: txHash
        })
        .eq('batch_id', batchId);
    }

    await supabase
      .from('outgoing_requests')
      .update({
        delivery_status: 'In Transit',
        tx_hash: txHash,
        sender_signature: txHash,
        sender_gps: gpsText,
        wallet_address: driverWallet.address
      })
      .ilike('dr_number', canonicalDr);

    await supabase
      .from('custody_scan_logs')
      .insert({
        batch_id: batchId ? Number(batchId) : null,
        scanned_by: user.id,
        scan_type: 'DRIVER_PICKUP',
        device_latitude: coordinates?.lat || null,
        device_longitude: coordinates?.lng || null,
        tx_hash: txHash
      });

    return new Response(JSON.stringify({
      ok: true,
      status: 'IN_TRANSIT',
      txHash,
      driverWallet: driverWallet.address,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Relay Sign Release Error:', err);
    return new Response(JSON.stringify({
      error: err.message || 'Server-side custodial release signature failed.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
