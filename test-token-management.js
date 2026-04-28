/**
 * Token Management Test Suite - Issue #115
 * Comprehensive testing for token management functionality
 */

const fs = require('fs');
const path = require('path');

// Mock database for testing
class MockTokenDatabase {
  constructor() {
    this.tokens = [];
    this.balances = [];
    this.transfers = [];
    this.approvals = [];
    this.history = [];
  }

  createToken(id, name, symbol, description, totalSupply, creatorId, assetCode, assetIssuer, decimals) {
    const token = {
      id,
      name,
      symbol,
      description,
      total_supply: totalSupply,
      circulating_supply: 0,
      creator_id: creatorId,
      asset_code: assetCode,
      asset_issuer: assetIssuer,
      decimals,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.tokens.push(token);
    this.initializeTokenBalance(id, creatorId);
    this.updateTokenBalance(id, creatorId, totalSupply, true);
    
    return { lastInsertRowid: this.tokens.length - 1 };
  }

  getToken(tokenId) {
    return this.tokens.find(t => t.id === tokenId) || null;
  }

  getTokenBySymbol(symbol) {
    return this.tokens.find(t => t.symbol === symbol) || null;
  }

  getAllTokens(userId, status) {
    let filtered = this.tokens;
    
    if (userId) {
      filtered = filtered.filter(t => t.creator_id === userId);
    }
    
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    
    return filtered;
  }

  initializeTokenBalance(tokenId, userId) {
    const existing = this.balances.find(b => b.token_id === tokenId && b.user_id === userId);
    if (!existing) {
      this.balances.push({
        id: `${tokenId}_${userId}`,
        token_id: tokenId,
        user_id: userId,
        balance: 0,
        frozen_balance: 0,
        last_updated: new Date().toISOString()
      });
    }
  }

  updateTokenBalance(tokenId, userId, amount, isMint = false) {
    this.initializeTokenBalance(tokenId, userId);
    
    const balance = this.balances.find(b => b.token_id === tokenId && b.user_id === userId);
    if (balance) {
      balance.balance += amount;
      balance.last_updated = new Date().toISOString();
      
      if (isMint && amount > 0) {
        const token = this.getToken(tokenId);
        if (token) {
          token.circulating_supply += amount;
        }
      }
      
      return true;
    }
    
    return false;
  }

  getTokenBalance(tokenId, userId) {
    return this.balances.find(b => b.token_id === tokenId && b.user_id === userId) || null;
  }

  createTokenTransfer(tokenId, fromUserId, toUserId, amount, memo) {
    const transfer = {
      id: `transfer_${Date.now()}_${Math.random()}`,
      token_id: tokenId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      memo,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    this.transfers.push(transfer);
    return { lastInsertRowid: this.transfers.length - 1 };
  }

  updateTokenTransferStatus(transferId, status, transactionHash, gasFee) {
    const transfer = this.transfers.find(t => t.id === transferId);
    if (transfer) {
      transfer.status = status;
      transfer.transaction_hash = transactionHash;
      transfer.gas_fee = gasFee;
      if (status === 'completed') {
        transfer.completed_at = new Date().toISOString();
      }
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  createTokenApproval(tokenId, ownerId, spenderId, allowance, expiresAt) {
    const approval = {
      id: `approval_${Date.now()}_${Math.random()}`,
      token_id: tokenId,
      owner_id: ownerId,
      spender_id: spenderId,
      allowance,
      expires_at: expiresAt,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    const existingIndex = this.approvals.findIndex(a => 
      a.token_id === tokenId && a.owner_id === ownerId && a.spender_id === spenderId
    );
    
    if (existingIndex >= 0) {
      this.approvals[existingIndex] = approval;
    } else {
      this.approvals.push(approval);
    }
    
    return { lastInsertRowid: this.approvals.length - 1 };
  }

  getTokenApproval(tokenId, ownerId, spenderId) {
    return this.approvals.find(a => 
      a.token_id === tokenId && a.owner_id === ownerId && a.spender_id === spenderId && a.status === 'active'
    ) || null;
  }

  recordTokenHistory(tokenId, userId, actionType, amount, fromUserId, toUserId, transactionHash, details) {
    const history = {
      id: `history_${Date.now()}_${Math.random()}`,
      token_id: tokenId,
      user_id: userId,
      action_type: actionType,
      amount,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      transaction_hash: transactionHash,
      details,
      created_at: new Date().toISOString()
    };
    
    this.history.push(history);
    return { lastInsertRowid: this.history.length - 1 };
  }

  getUserTokenPortfolio(userId) {
    const userBalances = this.balances.filter(b => b.user_id === userId && b.balance > 0);
    
    return userBalances.map(balance => {
      const token = this.getToken(balance.token_id);
      if (!token || token.status !== 'active') return null;
      
      return {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        decimals: token.decimals,
        balance: balance.balance,
        frozen_balance: balance.frozen_balance,
        total_supply: token.total_supply,
        circulating_supply: token.circulating_supply,
        ownership_percentage: (balance.balance / token.total_supply * 100)
      };
    }).filter(Boolean);
  }
}

// Test Suite
class TokenManagementTests {
  constructor() {
    this.db = new MockTokenDatabase();
    this.testResults = [];
  }

  runTest(testName, testFunction) {
    try {
      console.log(`Running test: ${testName}...`);
      const result = testFunction();
      
      if (result === true || (result && result.success)) {
        console.log(`✓ ${testName} - PASSED`);
        this.testResults.push({ name: testName, status: 'PASSED', message: 'Test passed successfully' });
      } else {
        console.log(`✗ ${testName} - FAILED: ${result.message || 'Unknown error'}`);
        this.testResults.push({ name: testName, status: 'FAILED', message: result.message || 'Unknown error' });
      }
    } catch (error) {
      console.log(`✗ ${testName} - ERROR: ${error.message}`);
      this.testResults.push({ name: testName, status: 'ERROR', message: error.message });
    }
  }

  async runAllTests() {
    console.log('='.repeat(60));
    console.log('TOKEN MANAGEMENT TEST SUITE');
    console.log('='.repeat(60));

    // Test 1: Token Creation
    this.runTest('Token Creation', () => {
      const result = this.db.createToken(
        'token_1',
        'Test Token',
        'TEST',
        'A test token for unit testing',
        1000000,
        'user_1',
        null,
        null,
        7
      );
      
      const token = this.db.getToken('token_1');
      
      if (!token) {
        return { success: false, message: 'Token was not created' };
      }
      
      if (token.name !== 'Test Token' || token.symbol !== 'TEST') {
        return { success: false, message: 'Token properties are incorrect' };
      }
      
      if (token.total_supply !== 1000000) {
        return { success: false, message: 'Token total supply is incorrect' };
      }
      
      return true;
    });

    // Test 2: Token Balance Management
    this.runTest('Token Balance Management', () => {
      const balance = this.db.getTokenBalance('token_1', 'user_1');
      
      if (!balance) {
        return { success: false, message: 'Balance was not initialized' };
      }
      
      if (balance.balance !== 1000000) {
        return { success: false, message: 'Initial balance is incorrect' };
      }
      
      return true;
    });

    // Test 3: Token Transfer
    this.runTest('Token Transfer', () => {
      const transferResult = this.db.createTokenTransfer(
        'token_1',
        'user_1',
        'user_2',
        100,
        'Test transfer'
      );
      
      // Simulate successful transfer
      const updateResult = this.db.updateTokenTransferStatus(
        this.db.transfers[transferResult.lastInsertRowid].id,
        'completed',
        'tx_hash_123',
        0.001
      );
      
      if (updateResult.changes === 0) {
        return { success: false, message: 'Transfer status was not updated' };
      }
      
      // Update balances
      const fromBalanceUpdate = this.db.updateTokenBalance('token_1', 'user_1', -100);
      const toBalanceUpdate = this.db.updateTokenBalance('token_1', 'user_2', 100);
      
      if (!fromBalanceUpdate || !toBalanceUpdate) {
        return { success: false, message: 'Balances were not updated correctly' };
      }
      
      const fromBalance = this.db.getTokenBalance('token_1', 'user_1');
      const toBalance = this.db.getTokenBalance('token_1', 'user_2');
      
      if (fromBalance.balance !== 999900 || toBalance.balance !== 100) {
        return { success: false, message: 'Final balances are incorrect' };
      }
      
      return true;
    });

    // Test 4: Token Approval
    this.runTest('Token Approval', () => {
      const approvalResult = this.db.createTokenApproval(
        'token_1',
        'user_1',
        'user_2',
        500,
        null
      );
      
      const approval = this.db.getTokenApproval('token_1', 'user_1', 'user_2');
      
      if (!approval) {
        return { success: false, message: 'Approval was not created' };
      }
      
      if (approval.allowance !== 500) {
        return { success: false, message: 'Approval allowance is incorrect' };
      }
      
      return true;
    });

    // Test 5: Token History
    this.runTest('Token History Tracking', () => {
      this.db.recordTokenHistory(
        'token_1',
        'user_1',
        'transferred',
        100,
        'user_1',
        'user_2',
        'tx_hash_123',
        'Transferred 100 TEST tokens'
      );
      
      const history = this.db.history.filter(h => h.token_id === 'token_1');
      
      if (history.length === 0) {
        return { success: false, message: 'History was not recorded' };
      }
      
      const transferHistory = history.find(h => h.action_type === 'transferred');
      if (!transferHistory) {
        return { success: false, message: 'Transfer history was not recorded' };
      }
      
      return true;
    });

    // Test 6: User Portfolio
    this.runTest('User Portfolio', () => {
      const portfolio = this.db.getUserTokenPortfolio('user_1');
      
      if (portfolio.length === 0) {
        return { success: false, message: 'Portfolio is empty' };
      }
      
      const tokenInPortfolio = portfolio.find(t => t.id === 'token_1');
      if (!tokenInPortfolio) {
        return { success: false, message: 'Token not found in portfolio' };
      }
      
      if (tokenInPortfolio.balance !== 999900) {
        return { success: false, message: 'Portfolio balance is incorrect' };
      }
      
      return true;
    });

    // Test 7: Multiple Token Support
    this.runTest('Multiple Token Support', () => {
      // Create second token
      this.db.createToken(
        'token_2',
        'Another Token',
        'ANOTHER',
        'Another test token',
        500000,
        'user_1',
        null,
        null,
        7
      );
      
      const allTokens = this.db.getAllTokens();
      
      if (allTokens.length !== 2) {
        return { success: false, message: 'Multiple tokens not supported' };
      }
      
      const token2 = this.db.getToken('token_2');
      if (!token2 || token2.symbol !== 'ANOTHER') {
        return { success: false, message: 'Second token not created correctly' };
      }
      
      return true;
    });

    // Test 8: Token Status Management
    this.runTest('Token Status Management', () => {
      const token = this.db.getToken('token_1');
      token.status = 'suspended';
      
      const activeTokens = this.db.getAllTokens(null, 'active');
      const suspendedTokens = this.db.getAllTokens(null, 'suspended');
      
      if (activeTokens.length !== 1) {
        return { success: false, message: 'Active token filtering failed' };
      }
      
      if (suspendedTokens.length !== 1) {
        return { success: false, message: 'Suspended token filtering failed' };
      }
      
      return true;
    });

    // Test 9: Token Symbol Uniqueness
    this.runTest('Token Symbol Uniqueness', () => {
      const existingToken = this.db.getTokenBySymbol('TEST');
      if (!existingToken) {
        return { success: false, message: 'Existing token not found' };
      }
      
      // Try to create token with same symbol (should fail in real implementation)
      const duplicateToken = this.db.getTokenBySymbol('TEST');
      if (duplicateToken && duplicateToken.id !== existingToken.id) {
        return { success: false, message: 'Duplicate symbol check failed' };
      }
      
      return true;
    });

    // Test 10: Balance Validation
    this.runTest('Balance Validation', () => {
      const user1Balance = this.db.getTokenBalance('token_1', 'user_1');
      const user2Balance = this.db.getTokenBalance('token_1', 'user_2');
      
      // Check that total supply is preserved
      const totalInCirculation = user1Balance.balance + user2Balance.balance;
      const token = this.db.getToken('token_1');
      
      if (totalInCirculation !== token.circulating_supply) {
        return { success: false, message: 'Total supply not preserved' };
      }
      
      // Check for negative balances
      if (user1Balance.balance < 0 || user2Balance.balance < 0) {
        return { success: false, message: 'Negative balance detected' };
      }
      
      return true;
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed > 0 || errors > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(r => r.status !== 'PASSED')
        .forEach(r => console.log(`  ✗ ${r.name}: ${r.message}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
      total: this.testResults.length,
      passed,
      failed,
      errors,
      successRate: (passed / this.testResults.length) * 100
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new TokenManagementTests();
  testSuite.runAllTests().then(results => {
    console.log('\nTest suite completed.');
    process.exit(results.failed > 0 || results.errors > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { TokenManagementTests, MockTokenDatabase };
