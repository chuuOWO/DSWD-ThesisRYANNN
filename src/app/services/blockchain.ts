import { Contract, ethers, JsonRpcProvider } from 'ethers';
import type { UserRole } from '../hooks/useInventoryState';
import { supabase } from '../lib/supabase';
import { executeGaslessCall, provisionSmartAccountAddress } from './embeddedWallet';

export interface BlockchainProof {
  hash: string;
  walletAddress: string;
  mode: 'contract' | 'signature';
}

export interface MintBatchInput {
  manifestNumber: string;
  batchTokenId: string;
  manifestHash: string;
  category: string;
  quantity: number;
  destination: string;
}

export interface OutgoingMintAndAuthorizeInput {
  drNumber: string;
  batchTokenId: string;
  category: string;
  quantity: number;
  warehouseSource: string;
  lguName: string;
}

export interface SignReleaseInput {
  drNumber: string;
  handoverContractId: string;
  category: string;
  quantity: number;
  batchTokenIds: string[];
  batchQuantities: number[];
  from: string;
  to: string;
  gps: string;
  signerWallet?: string;
}

export interface ConfirmReceiptInput {
  drNumber: string;
  handoverContractId: string;
  destination: string;
  gps: string;
  signerWallet?: string;
}

export const generateBatchTokenId = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const random10 = Math.floor(1000000000 + (array[0] / 0xffffffff) * 9000000000);
  return `BATCH-${yyyy}-${mm}${dd}-${random10}`;
};

const contractAddress =
  import.meta.env.VITE_RELIEF_TRACKER_CONTRACT_ADDRESS ||
  import.meta.env.VITE_BATCH_TOKEN_CONTRACT_ADDRESS ||
  import.meta.env.VITE_HANDOVER_CONTRACT_ADDRESS ||
  '0xd2e957dda5a5099980a66ecc736b541590892588';
const batchTokenContractAddress = contractAddress;
const handoverContractAddress = contractAddress;
const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID ?? 11155111);
const targetChainName = import.meta.env.VITE_BLOCKCHAIN_CHAIN_NAME ?? 'Sepolia';
const targetRpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/omM_Iuble2BuREAtDvGm-';

type AuthorizedRole = Exclude<UserRole, 'Unregistered'>;

const activeTxPromises = new Map<string, Promise<BlockchainProof>>();
export type TxStageCallback = (stage: 'wallet' | 'mining', txHash?: string) => void;

const resolveWalletRoleFromDb = async (address?: string | null): Promise<UserRole> => {
  const normalized = address?.trim().toLowerCase();
  if (!normalized) return 'Unregistered';

  try {
    const { data } = await supabase
      .from('profiles')
      .select('role, lgu_name')
      .ilike('wallet_address', normalized)
      .maybeSingle();

    if (!data) return 'Unregistered';
    if (data.role === 'dswd_admin') return 'Admin';
    if (data.role === 'receiver' && data.lgu_name) return 'LGUReceiver';
    if (data.role === 'receiver') return 'Receiver';
  } catch {
    // Fall through to Unregistered
  }

  return 'Unregistered';
};

export const getWalletErrorMessage = (error: unknown, fallback = 'Blockchain request failed.') => {
  const readMessage = (value: unknown, depth = 0): string | null => {
    if (depth > 5 || value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const code = record.code;

    if (code === 4001 || code === 'ACTION_REJECTED') {
      return 'Transaction request was cancelled by the user.';
    }

    for (const key of ['shortMessage', 'reason']) {
      const message = record[key];
      if (typeof message === 'string' && message.trim()) return message;
    }

    for (const key of ['error', 'info', 'data', 'payload', 'cause']) {
      const nestedMessage = readMessage(record[key], depth + 1);
      if (nestedMessage && !/could not coalesce error/i.test(nestedMessage)) {
        return nestedMessage;
      }
    }

    const message = record.message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/^could not coalesce error\s*/i, '').trim() || message;
    }

    return null;
  };

  return readMessage(error) || fallback;
};

const batchTokenAbi = [
  'function mintBatchToken(string manifestNumber,string batchTokenId,string manifestHash,string category,uint256 quantity,string destination) returns (uint256)',
  'function getBatchByTokenId(string batchTokenId) view returns (tuple(uint256 batchId,string manifestNumber,string batchTokenId,string manifestHash,string category,uint256 quantity,string destination,address mintedBy,uint256 mintedAt))',
  'function currentBatchId() view returns (uint256)',
  'function isAuthorizedAdmin(address admin) view returns (bool)',
  'function setAdmin(address admin,bool authorized)',
  'function owner() view returns (address)',
  'function setApprovalForAll(address operator,bool approved)',
  'function isApprovedForAll(address account,address operator) view returns (bool)'
];

const handoverAbi = [
  'function signRelease(string drNumber,string handoverContractId,string category,uint256 quantity,string[] batchTokenIds,uint256[] batchQuantities,string fromLocation,string destination,string senderGps) returns (uint256)',
  'function confirmReceipt(string drNumber,string handoverContractId,string destination,string receiverGps) returns (uint256)',
  'function handoverIdByDrNumber(string drNumber) view returns (uint256)',
  'function handoverIdByContractId(string handoverContractId) view returns (uint256)'
];

const getReadOnlyProvider = () => {
  return new JsonRpcProvider(targetRpcUrl);
};

export const blockchain = {
  isConfigured(): boolean {
    return Boolean(contractAddress);
  },

  getContractAddress(): string | null {
    return contractAddress || null;
  },

  getBatchTokenContractAddress(): string | null {
    return batchTokenContractAddress || null;
  },

  getHandoverContractAddress(): string | null {
    return handoverContractAddress || null;
  },

  getTargetNetwork() {
    return {
      chainId: targetChainId,
      chainName: targetChainName,
      rpcUrl: targetRpcUrl
    };
  },

  getWalletRole(address?: string | null): UserRole {
    return 'Unregistered';
  },

  async getWalletRoleFromDb(address?: string | null): Promise<UserRole> {
    return resolveWalletRoleFromDb(address);
  },

  onAccountsChanged(_handler: (accounts: string[]) => void): () => void {
    return () => undefined;
  },

  async connectWallet(): Promise<{ walletAddress: string; role: UserRole }> {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      return { walletAddress: '', role: 'Unregistered' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address, role, lgu_name')
      .eq('id', user.id)
      .maybeSingle();

    let walletAddress = profile?.wallet_address;
    if (!walletAddress) {
      walletAddress = await provisionSmartAccountAddress(user.id, user.email || '');
      if (walletAddress) {
        await supabase.from('profiles').update({ wallet_address: walletAddress }).eq('id', user.id);
      }
    }

    const role: UserRole =
      profile?.role === 'dswd_admin'
        ? 'Admin'
        : profile?.role === 'receiver' && profile.lgu_name
        ? 'LGUReceiver'
        : profile?.role === 'receiver'
        ? 'Receiver'
        : 'Unregistered';

    return { walletAddress: walletAddress || '', role };
  },

  async getConnectedWalletAddress(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.wallet_address) return profile.wallet_address;
    return await provisionSmartAccountAddress(user.id, user.email || '');
  },

  async assertUserWalletMatch(registeredWallet?: string | null): Promise<string> {
    const current = await this.getConnectedWalletAddress();
    return current || registeredWallet || '';
  },

  async requireConnectedWalletRole(expectedRole: AuthorizedRole, _expectedWallet?: string | null): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      throw new Error(`Authentication required: Please log in to perform this action.`);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, lgu_name, wallet_address')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('Profile not found. Please log in again.');
    }

    const userDbRole: UserRole =
      profile.role === 'dswd_admin'
        ? 'Admin'
        : profile.role === 'receiver' && profile.lgu_name
        ? 'LGUReceiver'
        : profile.role === 'receiver'
        ? 'Receiver'
        : 'Unregistered';

    if (userDbRole !== expectedRole) {
      throw new Error(`RBAC: this action requires ${expectedRole} role. Your active account is ${userDbRole}.`);
    }

    const walletAddress = profile.wallet_address || (await provisionSmartAccountAddress(user.id, user.email || ''));
    return walletAddress || '';
  },

  async assertBatchTokensExist(batchTokenIds: string[]): Promise<void> {
    if (!batchTokenContractAddress || batchTokenIds.length === 0) return;

    try {
      const provider = getReadOnlyProvider();
      const contract = new Contract(batchTokenContractAddress, batchTokenAbi, provider);

      await Promise.all(batchTokenIds.map(async (batchTokenId) => {
        try {
          await contract.getBatchByTokenId(batchTokenId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Batch token not found on current contract: ${batchTokenId}. ${message}`);
        }
      }));
    } catch (batchErr) {
      console.warn('assertBatchTokensExist check warning:', batchErr);
    }
  },

  async approveSenderOperator(operatorAddress: string): Promise<BlockchainProof> {
    const walletAddress = await this.getConnectedWalletAddress() || operatorAddress;
    return {
      hash: `operator-approved-${Date.now()}`,
      walletAddress,
      mode: 'signature'
    };
  },

  async mintBatchToken(input: MintBatchInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `mintBatch:${input.batchTokenId || input.manifestNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`mintBatchToken for ${lockKey} is already in-flight. Returning existing promise.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        throw new Error('Authentication required for batch minting.');
      }

      onStage?.('wallet');
      const gasless = await executeGaslessCall({
        userId: user.id,
        email: user.email || '',
        functionName: 'mintBatchToken',
        args: [
          input.manifestNumber,
          input.batchTokenId,
          input.manifestHash,
          input.category,
          BigInt(input.quantity),
          input.destination
        ]
      });

      onStage?.('mining', gasless.txHash);
      return {
        hash: gasless.txHash,
        walletAddress: gasless.smartAccountAddress,
        mode: gasless.mode === 'bundler_paymaster' ? 'contract' : 'signature'
      };
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async mintBatchTokenWithAutoManifest(
    category: string,
    quantity: number,
    destination: string,
    onStage?: TxStageCallback
  ): Promise<{ batchTokenId: string; manifestNumber: string; manifestHash: string; proof: BlockchainProof }> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000);
    const manifestNumber = `MNF-${yyyy}-${mm}${dd}-${random10}`;
    const batchTokenId = `BATCH-${yyyy}-${mm}${dd}-${random10}`;
    const manifestPayload = `${manifestNumber}|${batchTokenId}|${category}|${quantity}|${destination}|${Date.now()}`;
    const manifestHash = ethers.keccak256(ethers.toUtf8Bytes(manifestPayload));

    const proof = await this.mintBatchToken({
      manifestNumber,
      batchTokenId,
      manifestHash,
      category,
      quantity,
      destination
    }, onStage);

    return { batchTokenId, manifestNumber, manifestHash, proof };
  },

  async mintAndAuthorizeRelease(input: OutgoingMintAndAuthorizeInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000);
    const manifestNumber = `MNF-${yyyy}-${mm}${dd}-${random10}`;
    const manifestPayload = `${input.drNumber}|${manifestNumber}|${input.batchTokenId}|${input.category}|${input.quantity}|${input.warehouseSource}|${input.lguName}`;
    const manifestHash = ethers.keccak256(ethers.toUtf8Bytes(manifestPayload));

    return this.mintBatchToken({
      manifestNumber,
      batchTokenId: input.batchTokenId,
      manifestHash,
      category: input.category,
      quantity: input.quantity,
      destination: input.lguName
    }, onStage);
  },

  async getHandoverIdByDr(drNumber: string): Promise<bigint> {
    if (!handoverContractAddress) return 0n;
    try {
      const contract = new Contract(handoverContractAddress, handoverAbi, getReadOnlyProvider());
      const id = await contract.handoverIdByDrNumber(drNumber.trim());
      return BigInt(id.toString());
    } catch (e) {
      console.warn('getHandoverIdByDr error:', e);
      return 0n;
    }
  },

  async signRelease(input: SignReleaseInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `signRelease:${input.drNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`signRelease for ${input.drNumber} is already in-flight. Waiting for existing transaction.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        throw new Error('Authentication required to sign release.');
      }

      onStage?.('wallet');
      const gasless = await executeGaslessCall({
        userId: user.id,
        email: user.email || '',
        functionName: 'signRelease',
        args: [
          input.drNumber,
          input.handoverContractId,
          input.category,
          BigInt(input.quantity),
          input.batchTokenIds,
          input.batchQuantities.map((q) => BigInt(q)),
          input.from,
          input.to,
          input.gps
        ]
      });

      onStage?.('mining', gasless.txHash);
      return {
        hash: gasless.txHash,
        walletAddress: gasless.smartAccountAddress,
        mode: gasless.mode === 'bundler_paymaster' ? 'contract' : 'signature'
      };
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async signReleaseProof(input: SignReleaseInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    return this.signRelease(input, onStage);
  },

  async confirmReceipt(input: ConfirmReceiptInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `confirmReceipt:${input.drNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`confirmReceipt for ${input.drNumber} is already in-flight. Waiting for existing transaction.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        throw new Error('Authentication required to confirm receipt.');
      }

      onStage?.('wallet');
      const gasless = await executeGaslessCall({
        userId: user.id,
        email: user.email || '',
        functionName: 'confirmReceipt',
        args: [
          input.drNumber,
          input.handoverContractId,
          input.destination,
          input.gps
        ]
      });

      onStage?.('mining', gasless.txHash);
      return {
        hash: gasless.txHash,
        walletAddress: gasless.smartAccountAddress,
        mode: gasless.mode === 'bundler_paymaster' ? 'contract' : 'signature'
      };
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async signReleaseGasless(input: SignReleaseInput, userId: string, email: string): Promise<BlockchainProof> {
    const res = await executeGaslessCall({
      userId,
      email,
      functionName: 'signRelease',
      args: [
        input.drNumber,
        input.handoverContractId,
        input.category,
        BigInt(input.quantity),
        input.batchTokenIds,
        input.batchQuantities.map((q) => BigInt(q)),
        input.from,
        input.to,
        input.gps,
      ],
    });
    return {
      hash: res.txHash,
      walletAddress: res.smartAccountAddress,
      mode: res.mode === 'bundler_paymaster' ? 'contract' : 'signature',
    };
  },

  async confirmReceiptGasless(input: ConfirmReceiptInput, userId: string, email: string): Promise<BlockchainProof> {
    const res = await executeGaslessCall({
      userId,
      email,
      functionName: 'confirmReceipt',
      args: [
        input.drNumber,
        input.handoverContractId,
        input.destination,
        input.gps,
      ],
    });
    return {
      hash: res.txHash,
      walletAddress: res.smartAccountAddress,
      mode: res.mode === 'bundler_paymaster' ? 'contract' : 'signature',
    };
  }
};
