// Simple Transaction Queue Test (without Jest)
const { TransactionQueue, PRIORITY, STATUS } = require('./utils/transaction-queue');

// Mock network monitor
class MockNetworkMonitor {
  constructor() {
    this.healthy = true;
  }

  isHealthy() {
    return this.healthy;
  }

  getStatus() {
    return this.healthy ? 'healthy' : 'unhealthy';
  }

  setHealthy(healthy) {
    this.healthy = healthy;
  }
}

async function runTests() {
  console.log('🚀 Starting Transaction Queue Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Basic Queue Operations
  try {
    console.log('Test 1: Basic Queue Operations');
    const mockNetworkMonitor = new MockNetworkMonitor();
    const queue = new TransactionQueue({
      networkMonitor: mockNetworkMonitor,
      maxQueueSize: 100,
      batchSize: 5,
      batchTimeout: 1000,
      maxRetries: 2,
      gasOptimization: true
    });

    const transactionData = {
      operations: [{ type: 'payment', amount: 100 }]
    };

    const transactionId = await queue.enqueue(transactionData, PRIORITY.NORMAL);
    
    if (transactionId && typeof transactionId === 'string') {
      console.log('✓ Transaction enqueued successfully');
      
      const transaction = queue.getTransaction(transactionId);
      if (transaction && transaction.data === transactionData && transaction.status === STATUS.PENDING) {
        console.log('✓ Transaction retrieved correctly');
        passed++;
      } else {
        console.log('✗ Transaction retrieval failed');
        failed++;
      }
    } else {
      console.log('✗ Transaction enqueue failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Basic operations test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 2: Priority Management
  try {
    console.log('Test 2: Priority Management');
    const queue = new TransactionQueue({ maxQueueSize: 50 });
    
    const criticalData = { operations: [{ type: 'critical' }] };
    const normalData = { operations: [{ type: 'normal' }] };
    const lowData = { operations: [{ type: 'low' }] };

    const criticalId = await queue.enqueue(criticalData, PRIORITY.CRITICAL);
    const normalId = await queue.enqueue(normalData, PRIORITY.NORMAL);
    const lowId = await queue.enqueue(lowData, PRIORITY.LOW);

    const criticalTx = queue.getTransaction(criticalId);
    const normalTx = queue.getTransaction(normalId);
    const lowTx = queue.getTransaction(lowId);

    if (criticalTx.priority === PRIORITY.CRITICAL && 
        normalTx.priority === PRIORITY.NORMAL && 
        lowTx.priority === PRIORITY.LOW) {
      console.log('✓ Priority levels handled correctly');
      passed++;
    } else {
      console.log('✗ Priority management failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Priority test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 3: Queue Status
  try {
    console.log('Test 3: Queue Status and Metrics');
    const queue = new TransactionQueue({ maxQueueSize: 50 });
    
    const transactionData = { operations: [{ type: 'payment' }] };
    
    await queue.enqueue(transactionData, PRIORITY.HIGH);
    await queue.enqueue(transactionData, PRIORITY.NORMAL);
    await queue.enqueue(transactionData, PRIORITY.LOW);

    const status = queue.getQueueStatus();

    if (status.totalSize === 3 && 
        status.queues.HIGH && 
        status.queues.NORMAL && 
        status.queues.LOW &&
        status.metrics) {
      console.log('✓ Queue status returned correctly');
      passed++;
    } else {
      console.log('✗ Queue status test failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Queue status test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 4: Mobile Status
  try {
    console.log('Test 4: Mobile Queue Status');
    const queue = new TransactionQueue();
    
    const mobileStatus = queue.getMobileQueueStatus();
    
    if (mobileStatus.hasOwnProperty('pendingCount') &&
        mobileStatus.hasOwnProperty('processingCount') &&
        mobileStatus.hasOwnProperty('estimatedWaitTime') &&
        mobileStatus.hasOwnProperty('networkStatus')) {
      console.log('✓ Mobile status format correct');
      passed++;
    } else {
      console.log('✗ Mobile status test failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Mobile status test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 5: Transaction Cancellation
  try {
    console.log('Test 5: Transaction Cancellation');
    const queue = new TransactionQueue();
    
    const transactionData = { operations: [{ type: 'payment' }] };
    const transactionId = await queue.enqueue(transactionData);
    
    const cancelled = queue.cancelTransaction(transactionId);
    
    if (cancelled) {
      const transaction = queue.getTransaction(transactionId);
      if (transaction.status === STATUS.FAILED && transaction.cancelled) {
        console.log('✓ Transaction cancelled successfully');
        passed++;
      } else {
        console.log('✗ Transaction cancellation state incorrect');
        failed++;
      }
    } else {
      console.log('✗ Transaction cancellation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Transaction cancellation test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 6: Invalid Data Handling
  try {
    console.log('Test 6: Invalid Data Handling');
    const queue = new TransactionQueue();
    
    let errorCaught = false;
    
    try {
      await queue.enqueue(null);
    } catch (error) {
      errorCaught = true;
    }
    
    if (errorCaught) {
      console.log('✓ Invalid data properly rejected');
      passed++;
    } else {
      console.log('✗ Invalid data not rejected');
      failed++;
    }
  } catch (error) {
    console.log('✗ Invalid data test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 7: Queue Capacity
  try {
    console.log('Test 7: Queue Capacity');
    const smallQueue = new TransactionQueue({ maxQueueSize: 2 });
    const transactionData = { operations: [{ type: 'payment' }] };
    
    await smallQueue.enqueue(transactionData);
    await smallQueue.enqueue(transactionData);
    
    let errorCaught = false;
    try {
      await smallQueue.enqueue(transactionData);
    } catch (error) {
      errorCaught = true;
    }
    
    if (errorCaught) {
      console.log('✓ Queue capacity limit enforced');
      passed++;
    } else {
      console.log('✗ Queue capacity not enforced');
      failed++;
    }
  } catch (error) {
    console.log('✗ Queue capacity test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 8: Gas Optimization
  try {
    console.log('Test 8: Gas Optimization');
    const queue = new TransactionQueue({ gasOptimization: true });
    const transactionData = { operations: [{ type: 'payment' }] };
    
    const transactionId = await queue.enqueue(transactionData);
    const transaction = queue.getTransaction(transactionId);
    
    if (transaction.gasEstimate !== null && typeof transaction.gasEstimate === 'number') {
      console.log('✓ Gas estimation working');
      passed++;
    } else {
      console.log('✗ Gas estimation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Gas optimization test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 9: Event Emission
  try {
    console.log('Test 9: Event Emission');
    const queue = new TransactionQueue();
    
    let eventReceived = false;
    queue.on('transactionEnqueued', () => {
      eventReceived = true;
    });
    
    const transactionData = { operations: [{ type: 'payment' }] };
    await queue.enqueue(transactionData);
    
    if (eventReceived) {
      console.log('✓ Events emitted correctly');
      passed++;
    } else {
      console.log('✗ Events not emitted');
      failed++;
    }
  } catch (error) {
    console.log('✗ Event emission test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 10: Configuration
  try {
    console.log('Test 10: Custom Configuration');
    const customQueue = new TransactionQueue({
      maxQueueSize: 500,
      batchSize: 20,
      batchTimeout: 10000,
      maxRetries: 5,
      retryDelay: 2000,
      gasOptimization: false
    });
    
    if (customQueue.maxQueueSize === 500 &&
        customQueue.batchSize === 20 &&
        customQueue.batchTimeout === 10000 &&
        customQueue.maxRetries === 5 &&
        customQueue.retryDelay === 2000 &&
        customQueue.gasOptimization === false) {
      console.log('✓ Custom configuration applied correctly');
      passed++;
    } else {
      console.log('✗ Custom configuration not applied');
      failed++;
    }
  } catch (error) {
    console.log('✗ Configuration test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Results
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Transaction Queue implementation is working correctly.');
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

module.exports = { runTests, MockNetworkMonitor };
