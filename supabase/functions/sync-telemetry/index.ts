// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createPublicClient, createWalletClient, http, parseAbi } from 'npm:viem@2.21.0';
import { privateKeyToAccount } from 'npm:viem@2.21.0/accounts';
import { sepolia } from 'npm:viem@2.21.0/chains';

const RELIEF_TRACKER_ABI = parseAbi([
  'function recordTruckLocation(string shipmentId, string truckId, string latitude, string longitude, uint256 timestamp) external',
]);

const RPC_URL = Deno.env.get('RPC_URL') || Deno.env.get('VITE_BLOCKCHAIN_RPC_URL') || 'https://eth-sepolia.g.alchemy.com/v2/demo';
const CONTRACT_ADDRESS = (Deno.env.get('CONTRACT_ADDRESS') ||
  Deno.env.get('VITE_RELIEF_TRACKER_CONTRACT_ADDRESS') ||
  '0xd2e957dda5a5099980a66ecc736b541590892588') as `0x${string}`;
const BACKEND_PRIVATE_KEY = Deno.env.get('BACKEND_SIGNER_PRIVATE_KEY') as `0x${string}`;

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const record = payload.record || payload;

    if (!record || typeof record.latitude !== 'number' || typeof record.longitude !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing coordinate telemetry in record payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const shipmentId = String(record.shipment_id || record.current_dr_number || 'UNKNOWN_SHIPMENT');
    const truckId = String(record.truck_id || 'UNKNOWN_TRUCK');
    const latitude = String(record.latitude);
    const longitude = String(record.longitude);
    const timestamp = BigInt(Math.floor(new Date(record.updated_at || Date.now()).getTime() / 1000));

    if (!BACKEND_PRIVATE_KEY) {
      console.warn('BACKEND_SIGNER_PRIVATE_KEY not configured in environment. Skipping custodial on-chain broadcasting.');
      return new Response(
        JSON.stringify({
          acknowledged: true,
          mode: 'simulated_no_key',
          shipmentId,
          truckId,
          latitude,
          longitude,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Initialize custodial wallet client
    const account = privateKeyToAccount(BACKEND_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });

    // Execute custodial on-chain record
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: RELIEF_TRACKER_ABI,
      functionName: 'recordTruckLocation',
      args: [shipmentId, truckId, latitude, longitude, timestamp],
    });

    console.log(`Custodial on-chain location recorded: ${hash} for shipment ${shipmentId} (Truck: ${truckId})`);

    return new Response(
      JSON.stringify({
        success: true,
        transactionHash: hash,
        shipmentId,
        truckId,
        latitude,
        longitude,
        timestamp: Number(timestamp),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Custodial telemetry broadcast error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Custodial telemetry broadcast failed',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

