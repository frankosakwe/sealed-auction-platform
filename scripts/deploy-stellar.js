const { Server, Keypair, TransactionBuilder, Networks, BASE_FEE, Asset } = require('stellar-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Deploy Stellar Sealed-Bid Auction Contract
 */

// Configuration
const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';
const RPC_URL = STELLAR_NETWORK === 'mainnet' 
  ? 'https://mainnet.stellar.org' 
  : 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = STELLAR_NETWORK === 'mainnet' 
  ? Networks.PUBLIC 
  : Networks.TESTNET;

// Initialize Stellar server
const server = new Server(RPC_URL);
const stellarAuction = new StellarSealedBidAuction(
  process.env.CONTRACT_ID || '',
  RPC_URL,
  NETWORK_PASSPHRASE
);

async function deployContract() {
  try {
    console.log('🚀 Deploying Stellar Sealed-Bid Auction Contract...');
    console.log(`Network: ${STELLAR_NETWORK}`);
    console.log(`RPC URL: ${RPC_URL}`);

    // Check if secret key is provided
    if (!process.env.SECRET_KEY) {
      throw new Error('SECRET_KEY environment variable is required');
    }

    // Create keypair from secret
    const deployerKeypair = Keypair.fromSecret(process.env.SECRET_KEY);
    console.log(`Deployer address: ${deployerKeypair.publicKey()}`);

    // Get deployer account
    const deployerAccount = await server.getAccount(deployerKeypair.publicKey());
    console.log(`Account balance: ${deployerAccount.balances[0].balance} XLM`);

    // Check if contract is already built
    const wasmPath = path.join(__dirname, '../contracts/target/w32-unknown-unknown/release/sealed_bid_auction.wasm');
    
    if (!fs.existsSync(wasmPath)) {
      console.log('📦 Building contract...');
      const { execSync } = require('child_process');
      execSync('cd ../contracts && cargo build --target wasm32-unknown-unknown --release', { stdio: 'inherit' });
    }

    // Read WASM file
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`WASM file size: ${wasmBuffer.length} bytes`);

    // Deploy contract
    console.log('📤 Deploying contract...');
    const contractId = await stellarAuction.deployContract(deployerKeypair, wasmPath);
    
    console.log(`✅ Contract deployed successfully!`);
    console.log(`Contract ID: ${contractId}`);
    console.log(`Network: ${STELLAR_NETWORK}`);

    // Save contract ID to .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (!envContent.includes('CONTRACT_ID=')) {
      envContent += `\nCONTRACT_ID=${contractId}`;
      fs.writeFileSync(envPath, envContent);
      console.log(`Contract ID saved to .env file`);
    }

    // Test contract deployment
    console.log('🧪 Testing contract deployment...');
    const totalAuctions = await stellarAuction.getTotalAuctions();
    console.log(`Total auctions: ${totalAuctions}`);

    console.log('\n🎉 Deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the application: npm start');
    console.log('2. Open browser: http://localhost:3000');
    console.log('3. Connect your Stellar wallet');
    console.log('4. Create your first auction');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function setupTestnet() {
  console.log('🔧 Setting up testnet environment...');
  
  // Fund testnet account
  if (STELLAR_NETWORK === 'testnet' && process.env.FUND_TESTNET) {
    try {
      const friendbotUrl = `https://friendbot.stellar.org?addr=${process.env.PUBLIC_KEY}`;
      const response = await fetch(friendbotUrl);
      
      if (response.ok) {
        console.log('✅ Testnet account funded successfully');
      } else {
        console.log('⚠️ Account may already be funded');
      }
    } catch (error) {
      console.log('⚠️ Could not fund testnet account:', error.message);
    }
  }
}

// Main execution
async function main() {
  console.log('🌟 Stellar Sealed-Bid Auction Deployment Script');
  console.log('==========================================\n');

  await setupTestnet();
  await deployContract();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  deployContract,
  setupTestnet
};
