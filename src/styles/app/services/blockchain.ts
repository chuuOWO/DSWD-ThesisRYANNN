import { BrowserProvider, Contract, ethers } from 'ethers';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
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

export interface HandoverInput {
  drNumber: string;
  handoverContractId: string;
  category: string;
  quantity: number;
  from: string;
  to: string;
  gps: string;
}

const batchTokenContractAddress = import.meta.env.VITE_BATCH_TOKEN_CONTRACT_ADDRESS;
const handoverContractAddress = import.meta.env.VITE_HANDOVER_CONTRACT_ADDRESS;
const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID ?? 11155111);
const targetChainName = import.meta.env.VITE_BLOCKCHAIN_CHAIN_NAME ?? 'Sepolia';
const targetRpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL;

const batchTokenAbi = [
  'function mintBatchToken(string manifestNumber,string batchTokenId,string manifestHash,string category,uint256 quantity,string destination) returns (uint256)'
];

const handoverAbi = [
  'function signRelease(string drNumber,string handoverContractId,string category,uint256 quantity,string fromLocation,string destination,string senderGps) returns (uint256)',
  'function confirmReceipt(string drNumber,string handoverContractId,string destination,string receiverGps) returns (uint256)'
];

const requireEthereum = () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed or not available in this browser.');
  }
  return window.ethereum;
};

const getSigner = async () => {
  const ethereum = requireEthereum();
  const provider = new BrowserProvider(ethereum);
  await provider.send('eth_requestAccounts', []);

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
        throw error;
      }

      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ethers.toBeHex(targetChainId),
          chainName: targetChainName,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [targetRpcUrl]
        }]
      });
    }
  }

  return provider.getSigner();
};

const signFallbackProof = async (message: string): Promise<BlockchainProof> => {
  const signer = await getSigner();
  const walletAddress = await signer.getAddress();
  const signature = await signer.signMessage(message);

  return {
    hash: signature,
    walletAddress,
    mode: 'signature'
  };
};

export const blockchain = {
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

  async signRelease(input: HandoverInput): Promise<BlockchainProof> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (handoverContractAddress) {
      const contract = new Contract(handoverContractAddress, handoverAbi, signer);
      const tx = await contract.signRelease(
        input.drNumber,
        input.handoverContractId,
        input.category,
        input.quantity,
        input.from,
        input.to,
        input.gps
      );
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Sign release\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
    );
  },

  async confirmReceipt(input: HandoverInput): Promise<BlockchainProof> {
    const signer = await getSigner();
    const walletAddress = await signer.getAddress();

    if (handoverContractAddress) {
      const contract = new Contract(handoverContractAddress, handoverAbi, signer);
      const tx = await contract.confirmReceipt(input.drNumber, input.handoverContractId, input.to, input.gps);
      const receipt = await tx.wait();
      return { hash: receipt?.hash ?? tx.hash, walletAddress, mode: 'contract' };
    }

    return signFallbackProof(
      `Confirm receipt\nDR: ${input.drNumber}\nHandover: ${input.handoverContractId}\nCategory: ${input.category}\nQuantity: ${input.quantity}\nFrom: ${input.from}\nTo: ${input.to}\nGPS: ${input.gps}`
    );
  }
};
