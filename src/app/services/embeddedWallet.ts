import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { supabase } from '../lib/supabase';

const RPC_URL = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
const BUNDLER_URL = import.meta.env.VITE_BUNDLER_RPC_URL;
const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_RPC_URL;
const PAYMASTER_POLICY_ID = import.meta.env.VITE_PAYMASTER_POLICY_ID;
const CONTRACT_ADDRESS = (import.meta.env.VITE_RELIEF_TRACKER_CONTRACT_ADDRESS ||
  '0x4ca82b943107a32a3e3fe05a2ad057f602d496e5') as Address;
const ENTRYPOINT_ADDRESS = (import.meta.env.VITE_ENTRYPOINT_ADDRESS ||
  '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') as Address;

export const RELIEF_TRACKER_ABI = parseAbi([
  'function mintBatchToken(string manifestNumber, string batchTokenId, string manifestHash, string category, uint256 quantity, string destination) external returns (uint256)',
  'function signRelease(string drNumber, string handoverContractId, string category, uint256 quantity, string[] batchTokenIds, uint256[] batchQuantities, string fromLocation, string destination, string senderGps) external returns (uint256)',
  'function confirmReceipt(string drNumber, string handoverContractId, string destination, string receiverGps) external returns (uint256)',
  'function recordTruckLocation(string shipmentId, string truckId, string latitude, string longitude, uint256 timestamp) external',
  'function getBatchByTokenId(string batchTokenId) external view returns ((uint256 batchId, string manifestNumber, string batchTokenId, string manifestHash, string category, uint256 quantity, string destination, address mintedBy, uint256 mintedAt))',
  'function currentBatchId() external view returns (uint256)',
  'function isAuthorizedAdmin(address admin) external view returns (bool)',
  'function isApprovedForAll(address account, address operator) external view returns (bool)',
  'function owner() external view returns (address)'
]);

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

export async function getSessionSignerKey(userId: string, email: string): Promise<Hex> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${userId}:${email.toLowerCase().trim()}:dswd-aa-v1`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode('dswd-relief-salt-2026'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}` as Hex;
}

export async function provisionSmartAccountAddress(userId: string, email: string): Promise<string> {
  const privKey = await getSessionSignerKey(userId, email);
  const account = privateKeyToAccount(privKey);
  return account.address;
}

export const EIP712_DOMAIN = {
  name: 'DSWDReliefTracker',
  version: '1',
  chainId: 11155111,
  verifyingContract: CONTRACT_ADDRESS,
};

export const RELEASE_TYPE = {
  HandoverRelease: [
    { name: 'drNumber', type: 'string' },
    { name: 'handoverContractId', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'quantity', type: 'uint256' },
    { name: 'fromLocation', type: 'string' },
    { name: 'destination', type: 'string' },
    { name: 'senderGps', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export const RECEIPT_TYPE = {
  HandoverReceipt: [
    { name: 'drNumber', type: 'string' },
    { name: 'handoverContractId', type: 'string' },
    { name: 'destination', type: 'string' },
    { name: 'receiverGps', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export const MINT_TYPE = {
  MintBatchToken: [
    { name: 'manifestNumber', type: 'string' },
    { name: 'batchTokenId', type: 'string' },
    { name: 'manifestHash', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'quantity', type: 'uint256' },
    { name: 'destination', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

export interface GaslessExecutionParams {
  userId: string;
  email: string;
  functionName: 'mintBatchToken' | 'signRelease' | 'confirmReceipt';
  args: any[];
}

export async function executeGaslessCall(params: GaslessExecutionParams): Promise<{
  txHash: string;
  signature: string;
  smartAccountAddress: string;
  mode: 'bundler_paymaster' | 'eip712_signature';
}> {
  const privKey = await getSessionSignerKey(params.userId, params.email);
  const account = privateKeyToAccount(privKey);
  const smartAccountAddress = account.address;

  const callData = encodeFunctionData({
    abi: RELIEF_TRACKER_ABI,
    functionName: params.functionName,
    args: params.args as any,
  });

  // Generate EIP-712 cryptographic signature
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  let signature: string;

  if (params.functionName === 'mintBatchToken') {
    const message = {
      manifestNumber: String(params.args[0]),
      batchTokenId: String(params.args[1]),
      manifestHash: String(params.args[2]),
      category: String(params.args[3]),
      quantity: BigInt(params.args[4]),
      destination: String(params.args[5]),
      timestamp,
    };
    signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: MINT_TYPE,
      primaryType: 'MintBatchToken',
      message,
    });
  } else if (params.functionName === 'signRelease') {
    const message = {
      drNumber: String(params.args[0]),
      handoverContractId: String(params.args[1]),
      category: String(params.args[2]),
      quantity: BigInt(params.args[3]),
      fromLocation: String(params.args[6]),
      destination: String(params.args[7]),
      senderGps: String(params.args[8]),
      timestamp,
    };
    signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: RELEASE_TYPE,
      primaryType: 'HandoverRelease',
      message,
    });
  } else {
    const message = {
      drNumber: String(params.args[0]),
      handoverContractId: String(params.args[1]),
      destination: String(params.args[2]),
      receiverGps: String(params.args[3]),
      timestamp,
    };
    signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: RECEIPT_TYPE,
      primaryType: 'HandoverReceipt',
      message,
    });
  }

  // Attempt ERC-4337 UserOperation dispatch via Alchemy Bundler & Gas Manager Paymaster
  if (BUNDLER_URL && PAYMASTER_URL) {
    try {
      const pmPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_requestGasAndPaymasterAndData',
        params: [{
          policyId: PAYMASTER_POLICY_ID,
          entryPoint: ENTRYPOINT_ADDRESS,
          dummySignature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
          userOperation: {
            sender: smartAccountAddress,
            nonce: '0x0',
            callData,
          }
        }]
      };

      const pmRes = await fetch(PAYMASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pmPayload),
      });

      let paymasterAndData = '0x';
      let callGasLimit = '0x30d40';
      let verificationGasLimit = '0x249f0';
      let preVerificationGas = '0xc350';
      let maxFeePerGas = '0xb2d05e00';
      let maxPriorityFeePerGas = '0x59682f00';

      if (pmRes.ok) {
        const pmJson = await pmRes.json();
        if (pmJson?.result) {
          paymasterAndData = pmJson.result.paymasterAndData || paymasterAndData;
          callGasLimit = pmJson.result.callGasLimit || callGasLimit;
          verificationGasLimit = pmJson.result.verificationGasLimit || verificationGasLimit;
          preVerificationGas = pmJson.result.preVerificationGas || preVerificationGas;
          maxFeePerGas = pmJson.result.maxFeePerGas || maxFeePerGas;
          maxPriorityFeePerGas = pmJson.result.maxPriorityFeePerGas || maxPriorityFeePerGas;
        } else if (pmJson?.error) {
          console.warn('Alchemy Gas Manager error:', pmJson.error);
        }
      }

      const userOp: Record<string, unknown> = {
        sender: smartAccountAddress,
        nonce: '0x0',
        initCode: '0x',
        callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData,
        signature,
      };

      const bundlerRes = await fetch(BUNDLER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_sendUserOperation',
          params: [userOp, ENTRYPOINT_ADDRESS],
        }),
      });

      if (bundlerRes.ok) {
        const bundlerJson = await bundlerRes.json();
        if (bundlerJson?.result && typeof bundlerJson.result === 'string') {
          return {
            txHash: bundlerJson.result,
            signature,
            smartAccountAddress,
            mode: 'bundler_paymaster',
          };
        } else if (bundlerJson?.error) {
          console.warn('Alchemy Bundler eth_sendUserOperation error:', bundlerJson.error);
        }
      }
    } catch (bundlerErr) {
      console.warn('Alchemy Paymaster bundler dispatch fallback to signature:', bundlerErr);
    }
  }

  return {
    txHash: signature,
    signature,
    smartAccountAddress,
    mode: 'eip712_signature',
  };
}

export const embeddedWallet = {
  getSessionSignerKey,
  provisionSmartAccountAddress,
  executeGaslessCall,
  publicClient,
};

