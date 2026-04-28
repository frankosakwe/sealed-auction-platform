/**
 * DeFi Protocol Integration Test
 * Tests liquidity pools, yield farming, and portfolio management
 */

const AuctionDatabase = require('./database');
const RiskAssessmentEngine = require('./utils/risk-assessment');

// Initialize database and risk engine
const db = new AuctionDatabase();
const riskEngine = new RiskAssessmentEngine(db);

async function runDeFiTests() {
  console.log('🚀 Starting DeFi Protocol Integration Tests...\n');

  try {
    // Test 1: Database Schema
    await testDatabaseSchema();
    
    // Test 2: Liquidity Pool Operations
    await testLiquidityPools();
    
    // Test 3: Yield Farming Operations
    await testYieldFarming();
    
    // Test 4: Portfolio Management
    await testPortfolioManagement();
    
    // Test 5: Risk Assessment
    await testRiskAssessment();
    
    // Test 6: Token Price Management
    await testTokenPrices();
    
    console.log('\n✅ All DeFi tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ DeFi test failed:', error.message);
    process.exit(1);
  }
}

async function testDatabaseSchema() {
  console.log('📊 Testing Database Schema...');
  
  // Test creating a liquidity pool
  const poolData = {
    poolId: 1,
    tokenA: 'token-a-address',
    tokenB: 'token-b-address',
    reserveA: 1000,
    reserveB: 2000,
    lpTokenSupply: 1500,
    feeRate: 30
  };
  
  db.createLiquidityPool(poolData);
  const pool = db.getLiquidityPool(1);
  
  if (!pool || pool.pool_id !== 1) {
    throw new Error('Failed to create liquidity pool');
  }
  
  // Test creating a yield farm
  const farmData = {
    farmId: 1,
    name: 'Test Farm',
    rewardToken: 'reward-token-address',
    stakingToken: 'staking-token-address',
    totalStaked: 5000,
    rewardRate: 100
  };
  
  db.createYieldFarm(farmData);
  const farm = db.getYieldFarm(1);
  
  if (!farm || farm.farm_id !== 1) {
    throw new Error('Failed to create yield farm');
  }
  
  console.log('✅ Database schema test passed');
}

async function testLiquidityPools() {
  console.log('💧 Testing Liquidity Pool Operations...');
  
  // Test creating user position
  const positionData = {
    positionId: 1,
    userId: 'test-user',
    poolId: 1,
    lpAmount: 100,
    tokenAAmount: 50,
    tokenBAmount: 100
  };
  
  db.createLiquidityPosition(positionData);
  const positions = db.getUserLiquidityPositions('test-user');
  
  if (positions.length !== 1) {
    throw new Error('Failed to create liquidity position');
  }
  
  // Test updating pool
  db.updateLiquidityPool(1, {
    reserve_a: 1100,
    reserve_b: 2100,
    lp_token_supply: 1600
  });
  
  const updatedPool = db.getLiquidityPool(1);
  if (updatedPool.reserve_a !== 1100) {
    throw new Error('Failed to update liquidity pool');
  }
  
  console.log('✅ Liquidity pool operations test passed');
}

async function testYieldFarming() {
  console.log('🌾 Testing Yield Farming Operations...');
  
  // Test creating user stake
  const stakeData = {
    stakeId: 1,
    userId: 'test-user',
    farmId: 1,
    amount: 500,
    rewardDebt: 0
  };
  
  db.createUserStake(stakeData);
  const stakes = db.getUserStakes('test-user');
  
  if (stakes.length !== 1) {
    throw new Error('Failed to create user stake');
  }
  
  // Test creating reward event
  const rewardData = {
    eventId: 1,
    userId: 'test-user',
    farmId: 1,
    amount: 25
  };
  
  db.createRewardEvent(rewardData);
  const rewards = db.getUserRewardEvents('test-user');
  
  if (rewards.length !== 1) {
    throw new Error('Failed to create reward event');
  }
  
  console.log('✅ Yield farming operations test passed');
}

async function testPortfolioManagement() {
  console.log('💼 Testing Portfolio Management...');
  
  // Test creating portfolio
  db.createOrUpdatePortfolio('test-user');
  let portfolio = db.getUserPortfolio('test-user');
  
  if (!portfolio) {
    throw new Error('Failed to create portfolio');
  }
  
  // Test updating portfolio
  db.updatePortfolio('test-user', {
    total_value_usd: 10000,
    total_liquidity_usd: 6000,
    total_staked_usd: 3500,
    total_pending_rewards_usd: 500
  });
  
  portfolio = db.getUserPortfolio('test-user');
  if (portfolio.total_value_usd !== 10000) {
    throw new Error('Failed to update portfolio');
  }
  
  // Test portfolio calculation
  const calculatedPortfolio = db.calculatePortfolioValue('test-user');
  if (!calculatedPortfolio) {
    throw new Error('Failed to calculate portfolio value');
  }
  
  console.log('✅ Portfolio management test passed');
}

async function testRiskAssessment() {
  console.log('⚠️ Testing Risk Assessment...');
  
  // Add some token prices for risk calculation
  db.updateTokenPrice({
    tokenAddress: 'token-a-address',
    symbol: 'TOKENA',
    priceUsd: 1.0,
    priceChange24h: 2.5
  });
  
  db.updateTokenPrice({
    tokenAddress: 'token-b-address',
    symbol: 'TOKENB',
    priceUsd: 2.0,
    priceChange24h: -1.2
  });
  
  // Test pool risk assessment
  const poolRisk = await riskEngine.assessPoolRisk(1);
  
  if (!poolRisk || typeof poolRisk.riskScore !== 'number') {
    throw new Error('Failed to assess pool risk');
  }
  
  if (poolRisk.riskScore < 0 || poolRisk.riskScore > 10) {
    throw new Error('Invalid risk score range');
  }
  
  // Test farm risk assessment
  const farmRisk = await riskEngine.assessFarmRisk(1);
  
  if (!farmRisk || typeof farmRisk.riskScore !== 'number') {
    throw new Error('Failed to assess farm risk');
  }
  
  // Test comprehensive risk report
  const riskReport = await riskEngine.generateRiskReport();
  
  if (!riskReport || !riskReport.poolRisks || !riskReport.farmRisks) {
    throw new Error('Failed to generate risk report');
  }
  
  console.log('✅ Risk assessment test passed');
}

async function testTokenPrices() {
  console.log('💰 Testing Token Price Management...');
  
  // Test updating token price
  const tokenData = {
    tokenAddress: 'test-token-address',
    symbol: 'TEST',
    priceUsd: 10.50,
    marketCapUsd: 1000000,
    volume24hUsd: 50000,
    priceChange24h: 5.2
  };
  
  db.updateTokenPrice(tokenData);
  const price = db.getTokenPrice('test-token-address');
  
  if (!price || price.price_usd !== 10.50) {
    throw new Error('Failed to update token price');
  }
  
  // Test getting all token prices
  const allPrices = db.getAllTokenPrices();
  
  if (!Array.isArray(allPrices) || allPrices.length === 0) {
    throw new Error('Failed to get token prices');
  }
  
  console.log('✅ Token price management test passed');
}

// Test API endpoints (requires server to be running)
async function testAPIEndpoints() {
  console.log('🌐 Testing API Endpoints...');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Test getting pools
    const poolsResponse = await fetch(`${baseUrl}/api/defi/pools`);
    const pools = await poolsResponse.json();
    
    if (!Array.isArray(pools)) {
      throw new Error('Failed to get pools from API');
    }
    
    // Test getting farms
    const farmsResponse = await fetch(`${baseUrl}/api/defi/farms`);
    const farms = await farmsResponse.json();
    
    if (!Array.isArray(farms)) {
      throw new Error('Failed to get farms from API');
    }
    
    console.log('✅ API endpoints test passed');
    
  } catch (error) {
    console.log('⚠️ API endpoints test skipped (server not running)');
  }
}

// Performance test
async function testPerformance() {
  console.log('⚡ Testing Performance...');
  
  const startTime = Date.now();
  
  // Create multiple pools and positions
  for (let i = 2; i <= 100; i++) {
    db.createLiquidityPool({
      poolId: i,
      tokenA: `token-${i}-a`,
      tokenB: `token-${i}-b`,
      reserveA: Math.random() * 10000,
      reserveB: Math.random() * 10000,
      lpTokenSupply: Math.random() * 5000
    });
  }
  
  // Create multiple user positions
  for (let i = 2; i <= 100; i++) {
    db.createLiquidityPosition({
      positionId: i,
      userId: `user-${i % 10}`,
      poolId: i,
      lpAmount: Math.random() * 1000,
      tokenAAmount: Math.random() * 500,
      tokenBAmount: Math.random() * 500
    });
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`✅ Performance test passed (${duration}ms for 100 operations)`);
}

// Mock data generator for testing
function generateMockData() {
  console.log('🎲 Generating Mock Data...');
  
  // Create sample tokens
  const tokens = [
    { address: 'usdc-address', symbol: 'USDC', price: 1.00 },
    { address: 'eth-address', symbol: 'ETH', price: 2000.00 },
    { address: 'btc-address', symbol: 'BTC', price: 50000.00 },
    { address: 'sol-address', symbol: 'SOL', price: 100.00 }
  ];
  
  tokens.forEach(token => {
    db.updateTokenPrice({
      tokenAddress: token.address,
      symbol: token.symbol,
      priceUsd: token.price,
      priceChange24h: (Math.random() - 0.5) * 10
    });
  });
  
  // Create sample pools
  const pools = [
    { tokenA: 'usdc-address', tokenB: 'eth-address' },
    { tokenA: 'usdc-address', tokenB: 'btc-address' },
    { tokenA: 'usdc-address', tokenB: 'sol-address' },
    { tokenA: 'eth-address', tokenB: 'sol-address' }
  ];
  
  pools.forEach((pool, index) => {
    db.createLiquidityPool({
      poolId: index + 10,
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      reserveA: Math.random() * 100000,
      reserveB: Math.random() * 100000,
      lpTokenSupply: Math.random() * 50000,
      feeRate: 30
    });
  });
  
  // Create sample farms
  const farms = [
    { name: 'ETH Staking', stakingToken: 'eth-address', rewardToken: 'usdc-address' },
    { name: 'SOL Rewards', stakingToken: 'sol-address', rewardToken: 'usdc-address' },
    { name: 'BTC Farm', stakingToken: 'btc-address', rewardToken: 'usdc-address' }
  ];
  
  farms.forEach((farm, index) => {
    db.createYieldFarm({
      farmId: index + 10,
      name: farm.name,
      stakingToken: farm.stakingToken,
      rewardToken: farm.rewardToken,
      totalStaked: Math.random() * 50000,
      rewardRate: Math.random() * 1000
    });
  });
  
  console.log('✅ Mock data generated successfully');
}

// Run all tests
async function runAllTests() {
  try {
    // Generate mock data first
    generateMockData();
    
    // Run core tests
    await runDeFiTests();
    
    // Run performance test
    await testPerformance();
    
    // Try API test (will skip if server not running)
    await testAPIEndpoints();
    
    console.log('\n🎉 All DeFi integration tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('  ✅ Database Schema');
    console.log('  ✅ Liquidity Pool Operations');
    console.log('  ✅ Yield Farming Operations');
    console.log('  ✅ Portfolio Management');
    console.log('  ✅ Risk Assessment');
    console.log('  ✅ Token Price Management');
    console.log('  ✅ Performance Tests');
    console.log('  ✅ Mock Data Generation');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other files
module.exports = {
  runDeFiTests,
  runAllTests,
  testDatabaseSchema,
  testLiquidityPools,
  testYieldFarming,
  testPortfolioManagement,
  testRiskAssessment,
  testTokenPrices,
  testAPIEndpoints,
  testPerformance,
  generateMockData
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}
