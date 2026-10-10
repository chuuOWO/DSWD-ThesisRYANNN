const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const rpcUrl = process.env.VITE_BLOCKCHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/omM_Iuble2BuREAtDvGm-';
  let privateKey = process.env.VITE_SEPOLIA_RELAYER_PRIVATE_KEY;
  if (!privateKey && fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/VITE_SEPOLIA_RELAYER_PRIVATE_KEY\s*=\s*(.+)/);
    if (match) privateKey = match[1].trim();
  }
  if (!privateKey) {
    throw new Error('VITE_SEPOLIA_RELAYER_PRIVATE_KEY required in environment or .env');
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('Deployer Address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  const abi = JSON.parse(fs.readFileSync('build/contracts_DSWDReliefTracker_Flat_sol_DSWDReliefTracker.abi', 'utf8'));
  const bytecode = '0x' + fs.readFileSync('build/contracts_DSWDReliefTracker_Flat_sol_DSWDReliefTracker.bin', 'utf8').trim();

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log('Deploying DSWDReliefTracker to Sepolia...');
  
  const contract = await factory.deploy({ gasLimit: 32000000 });
  console.log('Deployment Transaction Hash:', contract.deploymentTransaction().hash);
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log('DSWDReliefTracker successfully deployed at:', contractAddress);

  // Verify owner and admin status
  const owner = await contract.owner();
  const isAdmin = await contract.isAuthorizedAdmin(wallet.address);
  console.log('Contract Owner:', owner);
  console.log('Is Deployer Admin:', isAdmin);
}

main().catch((error) => {
  console.error('Deployment error:', error);
  process.exit(1);
});

