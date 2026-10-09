import { BrowserProvider, Contract, ethers } from 'ethers';
import { EthereumProvider as WalletConnectProvider } from '@walletconnect/ethereum-provider';
import type { UserRole } from '../hooks/useInventoryState';
import { supabase } from '../lib/supabase';
import { executeGaslessCall, provisionSmartAccountAddress } from './embeddedWallet';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  connect?: () => Promise<unknown>;
  accounts?: string[];
  selectedAddress?: string;
  on?: (event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

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
  import.meta.env.VITE_HANDOVER_CONTRACT_ADDRESS;
const batchTokenContractAddress = contractAddress;
const handoverContractAddress = contractAddress;
const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID ?? 11155111);
const targetChainName = import.meta.env.VITE_BLOCKCHAIN_CHAIN_NAME ?? 'Sepolia';
const targetRpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL;
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
let walletConnectProviderPromise: Promise<EthereumProvider> | null = null;
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

export const getWalletErrorMessage = (error: unknown, fallback = 'MetaMask request failed.') => {
  const readMessage = (value: unknown, depth = 0): string | null => {
    if (depth > 5 || value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const code = record.code;

    if (code === 4001 || code === 'ACTION_REJECTED') {
      return 'MetaMask request was cancelled by the user.';
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

const throwWalletError = (error: unknown, fallback: string): never => {
  throw new Error(getWalletErrorMessage(error, fallback));
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

export const isMobileBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getWalletConnectProvider = async () => {
  if (!walletConnectProjectId) {
    throw new Error('WalletConnect project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID to your .env file.');
  }

  const isMobile = isMobileBrowser();

  if (!walletConnectProviderPromise) {
    walletConnectProviderPromise = WalletConnectProvider.init({
      projectId: walletConnectProjectId,
      chains: [targetChainId],
      optionalChains: [targetChainId],
      showQrModal: !isMobile,
      methods: [
        'eth_requestAccounts',
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain'
      ],
      events: ['accountsChanged', 'chainChanged', 'disconnect'],
      metadata: {
        name: 'DSWD Relief Tracker',
        description: 'GPS-backed FNFI delivery and handover tracker',
        url: appUrl,
        icons: [`${appUrl}/vite.svg`]
      },
      rpcMap: targetRpcUrl ? { [targetChainId]: targetRpcUrl } : undefined
    }).then(async (provider) => {
      if (isMobile) {
        provider.on('display_uri', (uri: string) => {
          // Immediately redirect directly to MetaMask mobile app without showing selector modal
          window.location.href = `metamask://wc?uri=${encodeURIComponent(uri)}`;
        });
      }

      if (!provider.accounts?.length) {
        await provider.connect?.();
      }
      return provider as EthereumProvider;
    }).catch((error) => {
      walletConnectProviderPromise = null;
      throw error;
    });
  }

  return walletConnectProviderPromise;
};

const getEthereum = async (interactive = true) => {
  if (window.ethereum) return window.ethereum;
  if (!interactive) return null;
  return await getWalletConnectProvider();
};

const getConnectedWalletAddress = async (ethereum: EthereumProvider) => {
  const readFirstAddress = (result: unknown) => (
    Array.isArray(result) && typeof result[0] === 'string' ? result[0] : null
  );

  try {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const walletAddress = readFirstAddress(accounts);
    if (walletAddress) return walletAddress;
  } catch (error) {
    const message = getWalletErrorMessage(error, '');
    if (/cancelled|rejected/i.test(message)) throwWalletError(error, 'MetaMask connection was cancelled.');
  }

  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    const walletAddress = readFirstAddress(accounts);
    if (walletAddress) return walletAddress;
  } catch (error) {
    throwWalletError(error, 'MetaMask account lookup failed.');
  }

  if (ethereum.selectedAddress) return ethereum.selectedAddress;
  if (ethereum.accounts?.[0]) return ethereum.accounts[0];

  throw new Error('MetaMask connected, but no wallet address was returned.');
};

const normalizeAddress = (address?: string | null) => address?.trim().toLowerCase() ?? '';

const getSigner = async () => {
  const ethereum = await getEthereum();
  const provider = new BrowserProvider(ethereum);

  try {
    await ethereum.request({ method: 'eth_requestAccounts' });
  } catch (error) {
    throwWalletError(error, 'MetaMask connection failed.');
  }

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== targetChainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ethers.toBeHex(targetChainId) }]
      });
    } catch (error) {
      const switchError = error as { code?: number };
      if (switchError.code !== 4902 || !targetRpcUrl) {
        throwWalletError(error, `Please switch MetaMask to ${targetChainName}.`);
      }

      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: ethers.toBeHex(targetChainId),
            chainName: targetChainName,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [targetRpcUrl]
          }]
        });
      } catch (addChainError) {
        throwWalletError(addChainError, `MetaMask could not add ${targetChainName}.`);
      }
    }
  }

  return provider.getSigner();
};

const signFallbackProof = async (message: string): Promise<BlockchainProof> => {
  const ethereum = await getEthereum();
  const walletAddress = await getConnectedWalletAddress(ethereum);
  const encodedMessage = ethers.hexlify(ethers.toUtf8Bytes(message));
  let signature: string;

  try {
    if (isMobileBrowser() && !window.ethereum) {
      setTimeout(() => {
        window.location.href = 'metamask://';
      }, 100);
    }
    signature = String(await ethereum.request({
      method: 'personal_sign',
      params: [encodedMessage, walletAddress]
    }));
  } catch (error) {
    throwWalletError(error, 'MetaMask could not sign the GPS proof.');
  }

  return {
    hash: signature,
    walletAddress,
    mode: 'signature'
  };
};

export const blockchain = {
  async getWalletRoleFromDb(address?: string | null): Promise<UserRole> {
    return resolveWalletRoleFromDb(address);
  },

  onAccountsChanged(handler: () => void) {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return () => undefined;

    ethereum.on('accountsChanged', handler);
    ethereum.on('chainChanged', handler);

    return () => {
      ethereum.removeListener?.('accountsChanged', handler);
      ethereum.removeListener?.('chainChanged', handler);
    };
  },

  async connectWallet(): Promise<{ walletAddress: string; role: UserRole }> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();
    const role = await resolveWalletRoleFromDb(walletAddress);
    return {
      walletAddress,
      role
    };
  },

  async getConnectedWalletAddress(): Promise<string | null> {
    const ethereum = await getEthereum(false);
    if (!ethereum) return null;
    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      const first = Array.isArray(accounts) ? accounts[0] : null;
      return typeof first === 'string' ? first : null;
    } catch {
      return null;
    }
  },

  async assertUserWalletMatch(registeredWallet?: string | null): Promise<string> {
    const signer = await getSigner();
    const activeAddress = await signer.getAddress();
    if (!registeredWallet) {
      return activeAddress;
    }
    if (activeAddress.toLowerCase() !== registeredWallet.trim().toLowerCase()) {
      throw new Error(`Wallet Mismatch: Account is locked to MetaMask address ${registeredWallet}. Your active MetaMask address is ${activeAddress}. Please switch accounts in MetaMask.`);
    }
    return activeAddress;
  },

  async requireConnectedWalletRole(expectedRole: AuthorizedRole, expectedWallet?: string | null): Promise<string> {
    if (!window.ethereum) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, lgu_name, wallet_address')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();

        if (profile) {
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
          return profile.wallet_address || (await provisionSmartAccountAddress(sessionData.session.user.id, sessionData.session.user.email || ''));
        }
      }
    }

    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (expectedWallet && walletAddress.toLowerCase() !== expectedWallet.trim().toLowerCase()) {
      throw new Error(`Wallet Mismatch: This account is bound to MetaMask address ${expectedWallet}. Your active MetaMask address is ${walletAddress}. Please switch to your registered wallet.`);
    }

    const actualRole = await resolveWalletRoleFromDb(walletAddress);

    if (actualRole !== expectedRole) {
      throw new Error(`RBAC: connect the ${expectedRole} MetaMask wallet to continue. Current wallet is tagged as ${actualRole}.`);
    }

    return walletAddress;
  },

  async assertBatchTokensExist(batchTokenIds: string[]): Promise<void> {
    if (!batchTokenContractAddress || batchTokenIds.length === 0) return;

    try {
      const provider = window.ethereum ? new BrowserProvider(window.ethereum as any) : new ethers.JsonRpcProvider(targetRpcUrl);
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
    if (!ethers.isAddress(operatorAddress)) {
      throw new Error('Invalid wallet address for sender operator.');
    }

    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (batchTokenContractAddress) {
      const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);
      const tx = await contract.setApprovalForAll(operatorAddress, true);
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Approve sender operator\nOperator: ${operatorAddress}`
    );
  },
  async mintBatchToken(input: MintBatchInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `mintBatch:${input.batchTokenId || input.manifestNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`mintBatchToken for ${lockKey} is already in-flight. Returning existing promise.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      const signer = await getSigner();
      const walletAddress = await signer.getAddress();

      if (batchTokenContractAddress) {
        const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);
        onStage?.('wallet');
        const tx = await contract.mintBatchToken(
          input.manifestNumber,
          input.batchTokenId,
          input.manifestHash,
          input.category,
          input.quantity,
          input.destination
        );
        onStage?.('mining', tx.hash);
        const receipt = await tx.wait();
        return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
      }

      return signFallbackProof(
        `Mint batch token\nManifest: ${input.manifestNumber}\nBatch: ${input.batchTokenId}\nHash: ${input.manifestHash}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nDestination: ${input.destination}`
      );
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async mintAndAuthorizeRelease(input: OutgoingMintAndAuthorizeInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `mintAndAuthorize:${input.drNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`mintAndAuthorizeRelease for ${lockKey} is already in-flight. Returning existing promise.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      const signer = await getSigner();
      const walletAddress = await signer.getAddress();

      if (batchTokenContractAddress) {
        const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);
        onStage?.('wallet');
        const tx = await contract.mintBatchToken(
          input.drNumber,
          input.batchTokenId,
          input.drNumber,
          input.category,
          input.quantity,
          input.lguName
        );
        onStage?.('mining', tx.hash);
        const receipt = await tx.wait();
        return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
      }

      return signFallbackProof(
        `DSWD Outgoing Dispatch Authorization\nDR: ${input.drNumber}\nBatch Token: ${input.batchTokenId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nFrom: ${input.warehouseSource}\nDestination: ${input.lguName}`
      );
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async setAuthorizedAdmin(adminAddress: string, authorized: boolean): Promise<BlockchainProof> {
    if (!ethers.isAddress(adminAddress)) {
      throw new Error('Invalid wallet address for admin authorization.');
    }
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();
    if (!batchTokenContractAddress) {
      throw new Error('Smart contract address is not configured in .env.');
    }
    const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);
    const tx = await contract.setAdmin(adminAddress, authorized);
    const receipt = await tx.wait();
    return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
  },

  async isContractAdmin(address: string): Promise<boolean> {
    if (!batchTokenContractAddress || !ethers.isAddress(address)) return false;
    try {
      const ethereum = await getEthereum(false);
      const provider = ethereum ? new BrowserProvider(ethereum) : new ethers.JsonRpcProvider(targetRpcUrl);
      const contract = new Contract(batchTokenContractAddress, batchTokenAbi, provider);
      const [isOwner, isAdmin] = await Promise.all([
        contract.owner().then((o: string) => o.toLowerCase() === address.toLowerCase()).catch(() => false),
        contract.isAuthorizedAdmin(address).catch(() => false)
      ]);
      return isOwner || isAdmin;
    } catch {
      return false;
    }
  },

  async authorizeOperator(operatorAddress: string): Promise<BlockchainProof> {
    if (!ethers.isAddress(operatorAddress)) {
      throw new Error('Invalid wallet address for custody authorization.');
    }
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();
    const targetContract = handoverContractAddress || batchTokenContractAddress;
    if (!targetContract) {
      throw new Error('Smart contract address is not configured in .env.');
    }
    const contract = new Contract(targetContract, batchTokenAbi, signer);
    // Approve receiver wallet as operator for ERC-1155 tokens
    const tx = await contract.setApprovalForAll(operatorAddress, true);
    const receipt = await tx.wait();
    return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
  },

  async isOperatorAuthorized(operatorAddress: string): Promise<boolean> {
    const targetContract = handoverContractAddress || batchTokenContractAddress;
    if (!targetContract || !ethers.isAddress(operatorAddress)) return false;
    try {
      const ethereum = await getEthereum(false);
      const provider = ethereum ? new BrowserProvider(ethereum) : new ethers.JsonRpcProvider(targetRpcUrl);
      const contract = new Contract(targetContract, batchTokenAbi, provider);
      const owner = await contract.owner();
      if (owner.toLowerCase() === operatorAddress.toLowerCase()) return true;
      const [isApproved, isAdmin] = await Promise.all([
        contract.isApprovedForAll(owner, operatorAddress).catch(() => false),
        contract.isAuthorizedAdmin(operatorAddress).catch(() => false)
      ]);
      return Boolean(isApproved || isAdmin);
    } catch {
      return false;
    }
  },

  async getHandoverIdByDr(drNumber: string): Promise<bigint> {
    if (!handoverContractAddress) return 0n;
    try {
      const ethereum = await getEthereum(false);
      const provider = ethereum ? new BrowserProvider(ethereum) : new ethers.JsonRpcProvider(targetRpcUrl);
      const contract = new Contract(handoverContractAddress, handoverAbi, provider);
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
      if (!window.ethereum) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id && sessionData.session.user.email) {
          onStage?.('wallet');
          const gasless = await executeGaslessCall({
            userId: sessionData.session.user.id,
            email: sessionData.session.user.email,
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
        }
      }

      const signer = await getSigner();
      const walletAddress = await signer.getAddress();

      if (input.signerWallet && walletAddress.toLowerCase() !== input.signerWallet.trim().toLowerCase()) {
        throw new Error(`Wallet Mismatch: Account is locked to MetaMask address ${input.signerWallet}. Your active MetaMask address is ${walletAddress}. Please switch accounts in MetaMask.`);
      }

      if (handoverContractAddress) {
        if (isMobileBrowser() && !window.ethereum) {
          setTimeout(() => {
            window.location.href = 'metamask://';
          }, 100);
        }
        const contract = new Contract(handoverContractAddress, handoverAbi, signer);
        try {
          onStage?.('wallet');
          const tx = await contract.signRelease(
            input.drNumber,
            input.handoverContractId,
            input.category,
            input.quantity,
            input.batchTokenIds,
            input.batchQuantities,
            input.from,
            input.to,
            input.gps
          );
          onStage?.('mining', tx.hash);
          const receipt = await tx.wait();
          return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
        } catch (contractErr: any) {
          console.error('Contract signRelease failed on Sepolia:', contractErr);
          const text = `${contractErr?.reason || ''} ${contractErr?.shortMessage || ''} ${contractErr?.data?.message || ''} ${contractErr?.message || ''}`.toLowerCase();

          // On-Chain verification: did this DR actually succeed on-chain despite this error/cancellation?
          try {
            const handoverId = await contract.handoverIdByDrNumber(input.drNumber);
            if (handoverId > 0n || Number(handoverId) > 0) {
              console.log(`On-chain recovery: handover ${handoverId} confirmed on Sepolia for ${input.drNumber}.`);
              return { hash: `on-chain-handover-${handoverId}`, walletAddress, mode: 'contract' };
            }
          } catch (checkErr) {
            console.warn('Could not verify on-chain handover status:', checkErr);
          }

          if (text.includes('not approved to transfer custody') || text.includes('sender not approved')) {
            throw new Error('On-Chain Revert: Receiver wallet is not approved by DSWD Admin to transfer relief custody. Please have the Admin authorize this wallet in Account Management.');
          }
          if (text.includes('batch token not found')) {
            throw new Error('On-Chain Revert: Batch token not found on Sepolia. Please ensure Admin approved and minted this release.');
          }
          if (text.includes('dr already released') || text.includes('handover already exists') || text.includes('dr released')) {
            return { hash: `on-chain-dr-${input.drNumber}`, walletAddress, mode: 'contract' };
          }
          if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
            throw new Error('MetaMask: Insufficient Sepolia ETH balance to cover gas fees for this transaction.');
          }
          if (text.includes('user rejected') || text.includes('action_rejected')) {
            throw new Error('MetaMask transaction was cancelled by user.');
          }
          throw new Error(`Smart Contract Reverted: ${contractErr?.reason || contractErr?.shortMessage || contractErr?.message || 'Transaction failed on Sepolia.'}`);
        }
      }

      return signFallbackProof(
        `Sign release\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nBatches: ${input.batchTokenIds.join(', ')}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
      );
    })();

    activeTxPromises.set(lockKey, task);
    try {
      return await task;
    } finally {
      activeTxPromises.delete(lockKey);
    }
  },

  async signReleaseProof(input: SignReleaseInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    if (handoverContractAddress) {
      return this.signRelease(input, onStage);
    }

    return signFallbackProof(
      `Sign receiver GPS proof\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nBatches: ${input.batchTokenIds.join(', ')}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
    );
  },

  async confirmReceipt(input: ConfirmReceiptInput, onStage?: TxStageCallback): Promise<BlockchainProof> {
    const lockKey = `confirmReceipt:${input.drNumber}`;
    const existing = activeTxPromises.get(lockKey);
    if (existing) {
      console.warn(`confirmReceipt for ${input.drNumber} is already in-flight. Waiting for existing transaction.`);
      return existing;
    }

    const task = (async (): Promise<BlockchainProof> => {
      if (!window.ethereum) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id && sessionData.session.user.email) {
          onStage?.('wallet');
          const gasless = await executeGaslessCall({
            userId: sessionData.session.user.id,
            email: sessionData.session.user.email,
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
        }
      }

      const signer = await getSigner();
      const walletAddress = await signer.getAddress();

      if (input.signerWallet && walletAddress.toLowerCase() !== input.signerWallet.trim().toLowerCase()) {
        throw new Error(`Wallet Mismatch: Account is locked to MetaMask address ${input.signerWallet}. Your active MetaMask address is ${walletAddress}. Please switch accounts in MetaMask.`);
      }

      if (handoverContractAddress) {
        if (isMobileBrowser() && !window.ethereum) {
          setTimeout(() => {
            window.location.href = 'metamask://';
          }, 100);
        }
        const contract = new Contract(handoverContractAddress, handoverAbi, signer);
        try {
          onStage?.('wallet');
          const tx = await contract.confirmReceipt(input.drNumber, input.handoverContractId, input.destination, input.gps);
          onStage?.('mining', tx.hash);
          const receipt = await tx.wait();
          return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
        } catch (contractErr: any) {
          console.error('Contract confirmReceipt failed on Sepolia:', contractErr);
          const text = `${contractErr?.reason || ''} ${contractErr?.shortMessage || ''} ${contractErr?.data?.message || ''} ${contractErr?.message || ''}`.toLowerCase();

          // On-Chain verification
          try {
            const handoverId = await contract.handoverIdByDrNumber(input.drNumber);
            if (handoverId > 0n || Number(handoverId) > 0) {
              if (text.includes('not releasable') || text.includes('user rejected') || text.includes('action_rejected')) {
                console.log(`On-chain recovery: receipt confirmed on Sepolia for ${input.drNumber}.`);
                return { hash: `on-chain-receipt-${handoverId}`, walletAddress, mode: 'contract' };
              }
            }
          } catch (checkErr) {
            console.warn('Could not verify on-chain receipt status:', checkErr);
          }

          if (text.includes('handover not found')) {
            throw new Error('On-Chain Revert: Handover not found on-chain. Receiver custody scan must be completed first.');
          }
          if (text.includes('handover is not releasable') || text.includes('not releasable')) {
            return { hash: `on-chain-receipt-confirmed`, walletAddress, mode: 'contract' };
          }
          if (text.includes('destination mismatch') || text.includes('dest mismatch')) {
            throw new Error('On-Chain Revert: Delivery destination does not match the smart contract record.');
          }
          if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
            throw new Error('MetaMask: Insufficient Sepolia ETH balance to cover gas fees for this transaction.');
          }
          if (text.includes('user rejected') || text.includes('action_rejected')) {
            throw new Error('MetaMask transaction was cancelled by user.');
          }
          throw new Error(`Smart Contract Receipt Failed: ${contractErr?.reason || contractErr?.shortMessage || contractErr?.message || 'Transaction failed on Sepolia.'}`);
        }
      }

      return signFallbackProof(
        `Confirm receipt\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nDestination: ${input.destination}\nGPS: ${input.gps}`
      );
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
