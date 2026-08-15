import { BrowserProvider, Contract, ethers } from 'ethers';
import { EthereumProvider as WalletConnectProvider } from '@walletconnect/ethereum-provider';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  connect?: () => Promise<unknown>;
  accounts?: string[];
  selectedAddress?: string;
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
}

export interface ConfirmReceiptInput {
  drNumber: string;
  handoverContractId: string;
  destination: string;
  gps: string;
}

const batchTokenContractAddress = import.meta.env.VITE_BATCH_TOKEN_CONTRACT_ADDRESS;
const handoverContractAddress = import.meta.env.VITE_HANDOVER_CONTRACT_ADDRESS;
const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID ?? 11155111);
const targetChainName = import.meta.env.VITE_BLOCKCHAIN_CHAIN_NAME ?? 'Sepolia';
const targetRpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL;
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
let walletConnectProviderPromise: Promise<EthereumProvider> | null = null;

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
  'function setApprovalForAll(address operator,bool approved)',
  'function isApprovedForAll(address account,address operator) view returns (bool)'
];

const handoverAbi = [
  'function signRelease(string drNumber,string handoverContractId,string category,uint256 quantity,string[] batchTokenIds,uint256[] batchQuantities,string fromLocation,string destination,string senderGps) returns (uint256)',
  'function confirmReceipt(string drNumber,string handoverContractId,string destination,string receiverGps) returns (uint256)'
];

const getWalletConnectProvider = async () => {
  if (!walletConnectProjectId) {
    throw new Error('WalletConnect project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID to your .env file.');
  }

  if (!walletConnectProviderPromise) {
    walletConnectProviderPromise = WalletConnectProvider.init({
      projectId: walletConnectProjectId,
      chains: [targetChainId],
      optionalChains: [targetChainId],
      showQrModal: true,
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

const getEthereum = async () => {
  if (window.ethereum) return window.ethereum;
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
  async assertBatchTokensExist(batchTokenIds: string[]): Promise<void> {
    if (!batchTokenContractAddress || batchTokenIds.length === 0) return;

    const signer = await getSigner();
    const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);

    await Promise.all(batchTokenIds.map(async (batchTokenId) => {
      try {
        await contract.getBatchByTokenId(batchTokenId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Batch token not found on current contract: ${batchTokenId}. ${message}`);
      }
    }));
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
  async mintBatchToken(input: MintBatchInput): Promise<BlockchainProof> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (batchTokenContractAddress) {
      const contract = new Contract(batchTokenContractAddress, batchTokenAbi, signer);
      const tx = await contract.mintBatchToken(
        input.manifestNumber,
        input.batchTokenId,
        input.manifestHash,
        input.category,
        input.quantity,
        input.destination
      );
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Mint batch token\nManifest: ${input.manifestNumber}\nBatch: ${input.batchTokenId}\nHash: ${input.manifestHash}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nDestination: ${input.destination}`
    );
  },

  async signRelease(input: SignReleaseInput): Promise<BlockchainProof> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (handoverContractAddress) {
      const contract = new Contract(handoverContractAddress, handoverAbi, signer);
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
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Sign release\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nBatches: ${input.batchTokenIds.join(', ')}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
    );
  },

  async signReleaseProof(input: SignReleaseInput): Promise<BlockchainProof> {
    return signFallbackProof(
      `Sign trucker GPS proof\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nBatches: ${input.batchTokenIds.join(', ')}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
    );
  },

  async confirmReceipt(input: ConfirmReceiptInput): Promise<BlockchainProof> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (handoverContractAddress) {
      const contract = new Contract(handoverContractAddress, handoverAbi, signer);
      const tx = await contract.confirmReceipt(input.drNumber, input.handoverContractId, input.destination, input.gps);
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Confirm receipt\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nDestination: ${input.destination}\nGPS: ${input.gps}`
    );
  }
};
