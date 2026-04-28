// Wallet Manager Tests
const { WalletManager, SECURITY_LEVELS, WALLET_TYPES } = require('./utils/wallet-manager');

// Mock crypto for testing
const mockCrypto = {
  randomBytes: (size) => {
    const bytes = [];
    for (let i = 0; i < size; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return Buffer.from(bytes);
  },
  createHash: (algorithm) => ({
    update: (data) => ({
      digest: (encoding) => 'mock-hash-' + data
    })
  }),
  scryptSync: (password, salt, keylen) => Buffer.from('mock-encryption-key'),
  createCipher: (algorithm, key) => ({
    update: (data, inputEncoding, outputEncoding) => 'encrypted-',
    final: (outputEncoding) => 'data'
  }),
  createDecipher: (algorithm, key) => ({
    update: (data, inputEncoding, outputEncoding) => 'decrypted-',
    final: (outputEncoding) => 'data'
  }),
  createCipheriv: (algorithm, key, iv) => ({
    update: (data, inputEncoding, outputEncoding) => 'encrypted-',
    final: (outputEncoding) => 'data'
  }),
  createDecipheriv: (algorithm, key, iv) => ({
    update: (data, inputEncoding, outputEncoding) => 'decrypted-',
    final: (outputEncoding) => 'data'
  })
};

// Replace crypto with mock
global.crypto = mockCrypto;

async function runTests() {
  console.log('🚀 Starting Wallet Manager Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Basic Wallet Manager Initialization
  try {
    console.log('Test 1: Wallet Manager Initialization');
    const walletManager = new WalletManager({
      maxWallets: 10,
      defaultSecurityLevel: SECURITY_LEVELS.STANDARD
    });
    
    if (walletManager.maxWallets === 10 && 
        walletManager.defaultSecurityLevel === SECURITY_LEVELS.STANDARD &&
        walletManager.wallets.size === 0) {
      console.log('✓ Wallet manager initialized correctly');
      passed++;
    } else {
      console.log('✗ Wallet manager initialization failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Initialization test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 2: Create Stellar Wallet
  try {
    console.log('Test 2: Create Stellar Wallet');
    const walletManager = new WalletManager();
    
    const walletData = {
      name: 'Test Stellar Wallet',
      type: WALLET_TYPES.STELLAR,
      network: 'testnet',
      securityLevel: SECURITY_LEVELS.BASIC,
      password: 'test123'
    };
    
    const walletId = await walletManager.createWallet(walletData);
    
    if (walletId && typeof walletId === 'string') {
      console.log('✓ Stellar wallet created successfully');
      
      const wallet = walletManager.getWallet(walletId);
      if (wallet && wallet.name === 'Test Stellar Wallet' && 
          wallet.type === WALLET_TYPES.STELLAR &&
          wallet.publicKey && wallet.encryptedSecretKey) {
        console.log('✓ Wallet data stored correctly');
        passed++;
      } else {
        console.log('✗ Wallet data incorrect');
        failed++;
      }
    } else {
      console.log('✗ Stellar wallet creation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Stellar wallet test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 3: Create Ethereum Wallet
  try {
    console.log('Test 3: Create Ethereum Wallet');
    const walletManager = new WalletManager();
    
    const walletData = {
      name: 'Test Ethereum Wallet',
      type: WALLET_TYPES.ETHEREUM,
      network: 'goerli',
      securityLevel: SECURITY_LEVELS.STANDARD,
      password: 'test123'
    };
    
    const walletId = await walletManager.createWallet(walletData);
    
    if (walletId) {
      console.log('✓ Ethereum wallet created successfully');
      
      const wallet = walletManager.getWallet(walletId);
      if (wallet && wallet.type === WALLET_TYPES.ETHEREUM &&
          wallet.address && wallet.encryptedPrivateKey) {
        console.log('✓ Ethereum wallet data correct');
        passed++;
      } else {
        console.log('✗ Ethereum wallet data incorrect');
        failed++;
      }
    } else {
      console.log('✗ Ethereum wallet creation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Ethereum wallet test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 4: Create Bitcoin Wallet
  try {
    console.log('Test 4: Create Bitcoin Wallet');
    const walletManager = new WalletManager();
    
    const walletData = {
      name: 'Test Bitcoin Wallet',
      type: WALLET_TYPES.BITCOIN,
      network: 'testnet',
      securityLevel: SECURITY_LEVELS.HIGH,
      password: 'test123'
    };
    
    const walletId = await walletManager.createWallet(walletData);
    
    if (walletId) {
      console.log('✓ Bitcoin wallet created successfully');
      
      const wallet = walletManager.getWallet(walletId);
      if (wallet && wallet.type === WALLET_TYPES.BITCOIN &&
          wallet.address && wallet.encryptedPrivateKey) {
        console.log('✓ Bitcoin wallet data correct');
        passed++;
      } else {
        console.log('✗ Bitcoin wallet data incorrect');
        failed++;
      }
    } else {
      console.log('✗ Bitcoin wallet creation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Bitcoin wallet test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 5: Add Existing Wallet
  try {
    console.log('Test 5: Add Existing Wallet');
    const walletManager = new WalletManager();
    
    const walletData = {
      name: 'Imported Wallet',
      type: WALLET_TYPES.STELLAR,
      publicKey: 'GTESTPUBLICKEY123456789',
      secretKey: 'STESTSECRETKEY123456789',
      network: 'testnet',
      securityLevel: SECURITY_LEVELS.STANDARD,
      password: 'test123'
    };
    
    const walletId = await walletManager.addExistingWallet(walletData);
    
    if (walletId) {
      console.log('✓ Existing wallet added successfully');
      
      const wallet = walletManager.getWallet(walletId);
      if (wallet && wallet.isImported && wallet.publicKey === 'GTESTPUBLICKEY123456789') {
        console.log('✓ Imported wallet data correct');
        passed++;
      } else {
        console.log('✗ Imported wallet data incorrect');
        failed++;
      }
    } else {
      console.log('✗ Adding existing wallet failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Add existing wallet test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 6: Wallet Switching
  try {
    console.log('Test 6: Wallet Switching');
    const walletManager = new WalletManager();
    
    // Create multiple wallets
    const wallet1Id = await walletManager.createWallet({
      name: 'Wallet 1',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    const wallet2Id = await walletManager.createWallet({
      name: 'Wallet 2',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Set first wallet as active
    await walletManager.setActiveWallet(wallet1Id);
    let activeWallet = walletManager.getActiveWallet();
    
    if (activeWallet && activeWallet.id === wallet1Id && activeWallet.isActive) {
      console.log('✓ First wallet set as active');
      
      // Switch to second wallet
      await walletManager.setActiveWallet(wallet2Id);
      activeWallet = walletManager.getActiveWallet();
      
      if (activeWallet && activeWallet.id === wallet2Id && activeWallet.isActive) {
        console.log('✓ Wallet switching works correctly');
        passed++;
      } else {
        console.log('✗ Wallet switching failed');
        failed++;
      }
    } else {
      console.log('✗ Setting active wallet failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet switching test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 7: Wallet Locking/Unlocking
  try {
    console.log('Test 7: Wallet Locking/Unlocking');
    const walletManager = new WalletManager();
    
    const walletId = await walletManager.createWallet({
      name: 'Lock Test Wallet',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Lock wallet
    await walletManager.lockWallet(walletId);
    let wallet = walletManager.getWallet(walletId);
    
    if (wallet && wallet.isLocked) {
      console.log('✓ Wallet locked successfully');
      
      // Unlock wallet
      await walletManager.unlockWallet(walletId, 'test123');
      wallet = walletManager.getWallet(walletId);
      
      if (wallet && !wallet.isLocked) {
        console.log('✓ Wallet unlocked successfully');
        passed++;
      } else {
        console.log('✗ Wallet unlock failed');
        failed++;
      }
    } else {
      console.log('✗ Wallet lock failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet locking test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 8: Wallet Update
  try {
    console.log('Test 8: Wallet Update');
    const walletManager = new WalletManager();
    
    const walletId = await walletManager.createWallet({
      name: 'Original Name',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Update wallet
    await walletManager.updateWallet(walletId, {
      name: 'Updated Name',
      notes: 'Test notes',
      tags: ['test', 'updated']
    });
    
    const wallet = walletManager.getWallet(walletId);
    
    if (wallet && wallet.name === 'Updated Name' && 
        wallet.notes === 'Test notes' &&
        JSON.stringify(wallet.tags) === JSON.stringify(['test', 'updated'])) {
      console.log('✓ Wallet updated successfully');
      passed++;
    } else {
      console.log('✗ Wallet update failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet update test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 9: Wallet Deletion
  try {
    console.log('Test 9: Wallet Deletion');
    const walletManager = new WalletManager();
    
    const wallet1Id = await walletManager.createWallet({
      name: 'Wallet to Delete',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    const wallet2Id = await walletManager.createWallet({
      name: 'Active Wallet',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Set second wallet as active
    await walletManager.setActiveWallet(wallet2Id);
    
    // Delete first wallet
    await walletManager.deleteWallet(wallet1Id);
    
    const deletedWallet = walletManager.getWallet(wallet1Id);
    const activeWallet = walletManager.getActiveWallet();
    
    if (!deletedWallet && activeWallet && activeWallet.id === wallet2Id) {
      console.log('✓ Wallet deleted successfully');
      passed++;
    } else {
      console.log('✗ Wallet deletion failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet deletion test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 10: Get All Wallets
  try {
    console.log('Test 10: Get All Wallets');
    const walletManager = new WalletManager();
    
    // Create multiple wallets
    await walletManager.createWallet({ name: 'Wallet A', type: WALLET_TYPES.STELLAR, securityLevel: SECURITY_LEVELS.BASIC });
    await walletManager.createWallet({ name: 'Wallet B', type: WALLET_TYPES.ETHEREUM, securityLevel: SECURITY_LEVELS.BASIC });
    await walletManager.createWallet({ name: 'Wallet C', type: WALLET_TYPES.BITCOIN, securityLevel: SECURITY_LEVELS.BASIC });
    
    const allWallets = walletManager.getAllWallets();
    
    if (allWallets.length === 3 && 
        allWallets.some(w => w.name === 'Wallet A') &&
        allWallets.some(w => w.name === 'Wallet B') &&
        allWallets.some(w => w.name === 'Wallet C')) {
      console.log('✓ Get all wallets works correctly');
      passed++;
    } else {
      console.log('✗ Get all wallets failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Get all wallets test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 11: Balance Aggregation
  try {
    console.log('Test 11: Balance Aggregation');
    const walletManager = new WalletManager();
    
    // Create wallets with different balances
    const stellarWalletId = await walletManager.createWallet({
      name: 'Stellar Wallet',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    const ethWalletId = await walletManager.createWallet({
      name: 'Ethereum Wallet',
      type: WALLET_TYPES.ETHEREUM,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Mock balances
    const stellarWallet = walletManager.getWallet(stellarWalletId);
    stellarWallet.balance = 100.5;
    
    const ethWallet = walletManager.getWallet(ethWalletId);
    ethWallet.balance = 50.25;
    
    const aggregatedBalance = await walletManager.getAggregatedBalance();
    
    if (aggregatedBalance.total === 150.75 &&
        aggregatedBalance.byType.stellar === 100.5 &&
        aggregatedBalance.byType.ethereum === 50.25 &&
        aggregatedBalance.byWallet.length === 2) {
      console.log('✓ Balance aggregation works correctly');
      passed++;
    } else {
      console.log('✗ Balance aggregation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Balance aggregation test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 12: Backup and Restore
  try {
    console.log('Test 12: Backup and Restore');
    const walletManager = new WalletManager();
    
    // Create wallet
    const walletId = await walletManager.createWallet({
      name: 'Backup Test Wallet',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Create backup
    const backupId = await walletManager.createBackup([walletId]);
    
    if (backupId) {
      console.log('✓ Backup created successfully');
      
      // Get backup data (in real implementation, this would be stored)
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        walletCount: 1,
        wallets: [{
          id: walletId,
          name: 'Backup Test Wallet',
          type: WALLET_TYPES.STELLAR,
          publicKey: walletManager.getWallet(walletId).publicKey,
          encryptedSecretKey: walletManager.getWallet(walletId).encryptedSecretKey
        }]
      };
      
      // Set another wallet as active before deleting
      const tempWalletId = await walletManager.createWallet({
        name: 'Temp Wallet',
        type: WALLET_TYPES.STELLAR,
        securityLevel: SECURITY_LEVELS.BASIC
      });
      await walletManager.setActiveWallet(tempWalletId);
      
      // Delete original wallet
      await walletManager.deleteWallet(walletId);
      
      // Restore from backup
      const restoredWallets = await walletManager.restoreFromBackup(backupData);
      
      if (restoredWallets.length === 1) {
        console.log('✓ Backup and restore works correctly');
        passed++;
      } else {
        console.log('✗ Backup restore failed');
        failed++;
      }
    } else {
      console.log('✗ Backup creation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Backup and restore test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 13: Wallet Export
  try {
    console.log('Test 13: Wallet Export');
    const walletManager = new WalletManager();
    
    const walletId = await walletManager.createWallet({
      name: 'Export Test Wallet',
      type: WALLET_TYPES.STELLAR,
      securityLevel: SECURITY_LEVELS.BASIC
    });
    
    // Export as JSON
    const jsonExport = await walletManager.exportWallet(walletId, 'json');
    
    if (jsonExport && typeof jsonExport === 'string') {
      const exportData = JSON.parse(jsonExport);
      
      if (exportData.id === walletId && 
          exportData.name === 'Export Test Wallet' &&
          exportData.type === WALLET_TYPES.STELLAR) {
        console.log('✓ JSON export works correctly');
        
        // Test CSV export
        const csvExport = await walletManager.exportWallet(walletId, 'csv');
        
        if (csvExport && csvExport.includes('Export Test Wallet')) {
          console.log('✓ CSV export works correctly');
          passed++;
        } else {
          console.log('✗ CSV export failed');
          failed++;
        }
      } else {
        console.log('✗ JSON export data incorrect');
        failed++;
      }
    } else {
      console.log('✗ Wallet export failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet export test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 14: Wallet Manager Status
  try {
    console.log('Test 14: Wallet Manager Status');
    const walletManager = new WalletManager({
      maxWallets: 25,
      defaultSecurityLevel: SECURITY_LEVELS.HIGH
    });
    
    // Create some wallets
    await walletManager.createWallet({ name: 'Wallet 1', type: WALLET_TYPES.STELLAR, securityLevel: SECURITY_LEVELS.BASIC });
    await walletManager.createWallet({ name: 'Wallet 2', type: WALLET_TYPES.ETHEREUM, securityLevel: SECURITY_LEVELS.BASIC });
    
    const status = walletManager.getStatus();
    
    console.log('Status:', JSON.stringify(status, null, 2));
    
    if (status.walletCount === 2 &&
        status.securityLevel === SECURITY_LEVELS.HIGH &&
        status.activeWalletName === 'Wallet 1' &&
        Array.isArray(status.supportedTypes) &&
        status.supportedTypes.includes(WALLET_TYPES.STELLAR) &&
        status.supportedTypes.includes(WALLET_TYPES.ETHEREUM) &&
        status.supportedTypes.includes(WALLET_TYPES.BITCOIN)) {
      console.log('✓ Wallet manager status correct');
      passed++;
    } else {
      console.log('✗ Wallet manager status incorrect');
      failed++;
    }
  } catch (error) {
    console.log('✗ Wallet manager status test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 15: Error Handling
  try {
    console.log('Test 15: Error Handling');
    const walletManager = new WalletManager({ maxWallets: 2 });
    
    // Create wallets up to limit
    await walletManager.createWallet({ name: 'Wallet 1', type: WALLET_TYPES.STELLAR, securityLevel: SECURITY_LEVELS.BASIC });
    await walletManager.createWallet({ name: 'Wallet 2', type: WALLET_TYPES.ETHEREUM, securityLevel: SECURITY_LEVELS.BASIC });
    
    // Try to create one more (should fail)
    let errorCaught = false;
    try {
      await walletManager.createWallet({ name: 'Wallet 3', type: WALLET_TYPES.BITCOIN });
    } catch (error) {
      errorCaught = true;
    }
    
    if (errorCaught) {
      console.log('✓ Wallet limit enforced correctly');
      
      // Try to get non-existent wallet
      const nonExistentWallet = walletManager.getWallet('non-existent-id');
      
      if (!nonExistentWallet) {
        console.log('✓ Non-existent wallet handled correctly');
        passed++;
      } else {
        console.log('✗ Non-existent wallet handling failed');
        failed++;
      }
    } else {
      console.log('✗ Wallet limit not enforced');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error handling test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Results
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Wallet Manager implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return failed === 0;
}

// Run tests
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
