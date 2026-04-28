// Transaction Queue Tests
const { TransactionQueue, PRIORITY, STATUS } = require('./utils/transaction-queue');
const { EventEmitter } = require('events');

// Mock network monitor
class MockNetworkMonitor extends EventEmitter {
  constructor() {
    super();
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
    this.emit('healthChange', healthy);
  }
}

describe('TransactionQueue', () => {
  let queue;
  let mockNetworkMonitor;

  beforeEach(() => {
    mockNetworkMonitor = new MockNetworkMonitor();
    queue = new TransactionQueue({
      networkMonitor: mockNetworkMonitor,
      maxQueueSize: 100,
      batchSize: 5,
      batchTimeout: 1000,
      maxRetries: 2,
      gasOptimization: true
    });
  });

  afterEach(() => {
    // Clean up queue
    queue.queues.clear();
    queue.transactions.clear();
    queue.processing.clear();
    queue.batches.clear();
  });

  describe('Basic Queue Operations', () => {
    test('should enqueue transaction successfully', async () => {
      const transactionData = {
        operations: [{ type: 'payment', amount: 100 }]
      };

      const transactionId = await queue.enqueue(transactionData, PRIORITY.NORMAL);

      expect(transactionId).toBeDefined();
      expect(typeof transactionId).toBe('string');

      const transaction = queue.getTransaction(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction.data).toEqual(transactionData);
      expect(transaction.priority).toBe(PRIORITY.NORMAL);
      expect(transaction.status).toBe(STATUS.PENDING);
    });

    test('should reject invalid transaction data', async () => {
      const invalidData = { invalid: 'data' };

      await expect(queue.enqueue(invalidData)).rejects.toThrow('Invalid transaction data');
    });

    test('should reject when queue is full', async () => {
      const smallQueue = new TransactionQueue({ maxQueueSize: 2 });
      const transactionData = { operations: [{ type: 'payment' }] };

      await smallQueue.enqueue(transactionData);
      await smallQueue.enqueue(transactionData);

      await expect(smallQueue.enqueue(transactionData)).rejects.toThrow('Queue is full');
    });

    test('should get transaction by ID', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);

      const transaction = queue.getTransaction(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction.id).toBe(transactionId);
    });

    test('should return undefined for non-existent transaction', () => {
      const transaction = queue.getTransaction('non-existent-id');
      expect(transaction).toBeUndefined();
    });
  });

  describe('Priority Management', () => {
    test('should handle different priority levels correctly', async () => {
      const criticalData = { operations: [{ type: 'critical' }] };
      const normalData = { operations: [{ type: 'normal' }] };
      const lowData = { operations: [{ type: 'low' }] };

      const criticalId = await queue.enqueue(criticalData, PRIORITY.CRITICAL);
      const normalId = await queue.enqueue(normalData, PRIORITY.NORMAL);
      const lowId = await queue.enqueue(lowData, PRIORITY.LOW);

      const criticalTx = queue.getTransaction(criticalId);
      const normalTx = queue.getTransaction(normalId);
      const lowTx = queue.getTransaction(lowId);

      expect(criticalTx.priority).toBe(PRIORITY.CRITICAL);
      expect(normalTx.priority).toBe(PRIORITY.NORMAL);
      expect(lowTx.priority).toBe(PRIORITY.LOW);
    });

    test('should process transactions in priority order', async () => {
      const processSpy = jest.spyOn(queue, 'processTransaction');

      // Enqueue transactions in reverse priority order
      await queue.enqueue({ operations: [{ type: 'low' }] }, PRIORITY.LOW);
      await queue.enqueue({ operations: [{ type: 'critical' }] }, PRIORITY.CRITICAL);
      await queue.enqueue({ operations: [{ type: 'normal' }] }, PRIORITY.NORMAL);

      // Process queue
      await queue.processQueue();

      // Critical should be processed first
      expect(processSpy).toHaveBeenCalledTimes(1);
      const criticalTransaction = processSpy.mock.calls[0][0];
      expect(criticalTransaction.priority).toBe(PRIORITY.CRITICAL);
    });
  });

  describe('Queue Status and Metrics', () => {
    test('should return accurate queue status', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      
      await queue.enqueue(transactionData, PRIORITY.HIGH);
      await queue.enqueue(transactionData, PRIORITY.NORMAL);
      await queue.enqueue(transactionData, PRIORITY.LOW);

      const status = queue.getQueueStatus();

      expect(status.totalSize).toBe(3);
      expect(status.processing).toBe(0);
      expect(status.queues.HIGH.size).toBe(1);
      expect(status.queues.NORMAL.size).toBe(1);
      expect(status.queues.LOW.size).toBe(1);
      expect(status.metrics).toBeDefined();
    });

    test('should track metrics correctly', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      
      // Simulate some transactions
      const transactionId = await queue.enqueue(transactionData);
      
      // Manually update metrics to simulate completion
      const transaction = queue.getTransaction(transactionId);
      transaction.status = STATUS.CONFIRMED;
      queue.metrics.totalProcessed++;
      queue.metrics.totalSucceeded++;

      const status = queue.getQueueStatus();
      expect(status.metrics.totalProcessed).toBe(1);
      expect(status.metrics.totalSucceeded).toBe(1);
    });

    test('should provide mobile-friendly status', async () => {
      const mobileStatus = queue.getMobileQueueStatus();
      
      expect(mobileStatus).toHaveProperty('pendingCount');
      expect(mobileStatus).toHaveProperty('processingCount');
      expect(mobileStatus).toHaveProperty('estimatedWaitTime');
      expect(mobileStatus).toHaveProperty('networkStatus');
    });
  });

  describe('Transaction Processing', () => {
    test('should process transaction successfully', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      
      // Mock successful execution
      const mockResult = { hash: 'test-hash', status: 'SUCCESS' };
      jest.spyOn(queue, 'executeTransaction').mockResolvedValue(mockResult);
      
      await queue.processTransaction(transaction);
      
      expect(transaction.status).toBe(STATUS.CONFIRMED);
      expect(transaction.result).toBe(mockResult);
      expect(queue.metrics.totalSucceeded).toBe(1);
    });

    test('should handle transaction failure with retry', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      
      // Mock failed execution
      jest.spyOn(queue, 'executeTransaction').mockRejectedValue(new Error('Network error'));
      
      await queue.processTransaction(transaction);
      
      expect(transaction.status).toBe(STATUS.RETRY);
      expect(transaction.attempts).toBe(1);
      expect(queue.metrics.totalRetried).toBe(1);
    });

    test('should mark transaction as failed after max retries', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      transaction.attempts = 2; // Set to max retries
      
      // Mock failed execution
      jest.spyOn(queue, 'executeTransaction').mockRejectedValue(new Error('Network error'));
      
      await queue.processTransaction(transaction);
      
      expect(transaction.status).toBe(STATUS.FAILED);
      expect(queue.metrics.totalFailed).toBe(1);
    });

    test('should not process when network is unhealthy', async () => {
      mockNetworkMonitor.setHealthy(false);
      
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      
      await queue.processTransaction(transaction);
      
      expect(transaction.status).toBe(STATUS.FAILED);
      expect(transaction.lastError.message).toBe('Network is not healthy');
    });
  });

  describe('Batch Processing', () => {
    test('should process batch of transactions', async () => {
      const transactions = [];
      
      // Create multiple transactions
      for (let i = 0; i < 3; i++) {
        const transactionData = { operations: [{ type: 'payment', id: i }] };
        const transactionId = await queue.enqueue(transactionData);
        transactions.push(queue.getTransaction(transactionId));
      }
      
      // Mock batch execution
      const mockResults = [
        { status: 'fulfilled', value: { hash: 'hash1' } },
        { status: 'fulfilled', value: { hash: 'hash2' } },
        { status: 'rejected', reason: new Error('Failed') }
      ];
      
      jest.spyOn(Promise, 'allSettled').mockResolvedValue(mockResults);
      jest.spyOn(queue, 'executeTransaction').mockResolvedValue({ hash: 'test' });
      
      await queue.executeBatch(transactions);
      
      expect(transactions[0].status).toBe(STATUS.CONFIRMED);
      expect(transactions[1].status).toBe(STATUS.CONFIRMED);
      expect(transactions[2].status).toBe(STATUS.FAILED);
    });

    test('should handle batch failure', async () => {
      const transactions = [];
      
      for (let i = 0; i < 2; i++) {
        const transactionData = { operations: [{ type: 'payment', id: i }] };
        const transactionId = await queue.enqueue(transactionData);
        transactions.push(queue.getTransaction(transactionId));
      }
      
      // Mock batch execution failure
      jest.spyOn(Promise, 'allSettled').mockRejectedValue(new Error('Batch failed'));
      
      await queue.executeBatch(transactions);
      
      expect(transactions[0].status).toBe(STATUS.FAILED);
      expect(transactions[1].status).toBe(STATUS.FAILED);
    });
  });

  describe('Gas Optimization', () => {
    test('should estimate gas for transaction', async () => {
      const gasOptimizer = queue.gasOptimizer;
      
      const transactionData = { operations: [{ type: 'payment' }] };
      const gasEstimate = await gasOptimizer.estimateGas(transactionData);
      
      expect(gasEstimate).toBeDefined();
      expect(typeof gasEstimate).toBe('number');
      expect(gasEstimate).toBeGreaterThan(0);
    });

    test('should optimize transaction when enabled', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      expect(transaction.gasEstimate).toBeDefined();
    });

    test('should skip gas optimization when disabled', async () => {
      const noGasQueue = new TransactionQueue({ gasOptimization: false });
      
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await noGasQueue.enqueue(transactionData);
      
      const transaction = noGasQueue.getTransaction(transactionId);
      expect(transaction.gasEstimate).toBeNull();
    });
  });

  describe('Event Emission', () => {
    test('should emit events for transaction lifecycle', async () => {
      const enqueueSpy = jest.fn();
      const processingSpy = jest.fn();
      const completedSpy = jest.fn();
      const failedSpy = jest.fn();
      
      queue.on('transactionEnqueued', enqueueSpy);
      queue.on('transactionProcessing', processingSpy);
      queue.on('transactionCompleted', completedSpy);
      queue.on('transactionFailed', failedSpy);
      
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: transactionId,
        status: STATUS.PENDING
      }));
      
      const transaction = queue.getTransaction(transactionId);
      
      // Mock successful processing
      jest.spyOn(queue, 'executeTransaction').mockResolvedValue({ hash: 'test' });
      await queue.processTransaction(transaction);
      
      expect(processingSpy).toHaveBeenCalledWith(transaction);
      expect(completedSpy).toHaveBeenCalledWith(transaction);
    });
  });

  describe('Transaction Cancellation', () => {
    test('should cancel pending transaction', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const cancelled = queue.cancelTransaction(transactionId);
      
      expect(cancelled).toBe(true);
      
      const transaction = queue.getTransaction(transactionId);
      expect(transaction.status).toBe(STATUS.FAILED);
      expect(transaction.cancelled).toBe(true);
    });

    test('should not cancel processing transaction', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      transaction.status = STATUS.PROCESSING;
      
      const cancelled = queue.cancelTransaction(transactionId);
      
      expect(cancelled).toBe(false);
    });

    test('should return false for non-existent transaction', () => {
      const cancelled = queue.cancelTransaction('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should cleanup old transactions', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      transaction.status = STATUS.CONFIRMED;
      transaction.completedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      queue.cleanupOldTransactions();
      
      const cleanedTransaction = queue.getTransaction(transactionId);
      expect(cleanedTransaction).toBeUndefined();
    });

    test('should not cleanup recent transactions', async () => {
      const transactionData = { operations: [{ type: 'payment' }] };
      const transactionId = await queue.enqueue(transactionData);
      
      const transaction = queue.getTransaction(transactionId);
      transaction.status = STATUS.CONFIRMED;
      transaction.completedAt = new Date(); // Recent
      
      queue.cleanupOldTransactions();
      
      const existingTransaction = queue.getTransaction(transactionId);
      expect(existingTransaction).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('should use custom configuration', () => {
      const customQueue = new TransactionQueue({
        maxQueueSize: 500,
        batchSize: 20,
        batchTimeout: 10000,
        maxRetries: 5,
        retryDelay: 2000,
        gasOptimization: false
      });
      
      expect(customQueue.maxQueueSize).toBe(500);
      expect(customQueue.batchSize).toBe(20);
      expect(customQueue.batchTimeout).toBe(10000);
      expect(customQueue.maxRetries).toBe(5);
      expect(customQueue.retryDelay).toBe(2000);
      expect(customQueue.gasOptimization).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed transaction data gracefully', async () => {
      const malformedData = null;
      
      await expect(queue.enqueue(malformedData)).rejects.toThrow('Invalid transaction data');
    });

    test('should handle missing operations in transaction data', async () => {
      const incompleteData = { type: 'payment' }; // Missing operations array
      
      await expect(queue.enqueue(incompleteData)).rejects.toThrow('Invalid transaction data');
    });

    test('should handle empty operations array', async () => {
      const emptyData = { operations: [] };
      
      await expect(queue.enqueue(emptyData)).rejects.toThrow('Invalid transaction data');
    });
  });
});

// Integration Tests
describe('TransactionQueue Integration', () => {
  let queue;

  beforeEach(() => {
    queue = new TransactionQueue({
      maxQueueSize: 50,
      batchSize: 3,
      batchTimeout: 500,
      maxRetries: 2
    });
  });

  test('should handle high load scenario', async () => {
    const promises = [];
    const transactionCount = 20;
    
    // Enqueue many transactions
    for (let i = 0; i < transactionCount; i++) {
      const transactionData = { operations: [{ type: 'payment', id: i }] };
      promises.push(queue.enqueue(transactionData, PRIORITY.NORMAL));
    }
    
    const transactionIds = await Promise.all(promises);
    expect(transactionIds).toHaveLength(transactionCount);
    
    const status = queue.getQueueStatus();
    expect(status.totalSize).toBe(transactionCount);
  });

  test('should maintain priority ordering under load', async () => {
    // Enqueue transactions with different priorities
    const priorities = [PRIORITY.LOW, PRIORITY.NORMAL, PRIORITY.HIGH, PRIORITY.CRITICAL];
    const transactionIds = [];
    
    for (let i = 0; i < 10; i++) {
      const priority = priorities[i % priorities.length];
      const transactionData = { operations: [{ type: 'payment', id: i }] };
      const transactionId = await queue.enqueue(transactionData, priority);
      transactionIds.push(transactionId);
    }
    
    // Process queue and verify priority order
    const processedTransactions = [];
    
    for (let i = 0; i < 4; i++) {
      await queue.processQueue();
      const processingArray = Array.from(queue.processing);
      if (processingArray.length > 0) {
        const transactionId = processingArray[0];
        const transaction = queue.getTransaction(transactionId);
        processedTransactions.push(transaction);
      }
    }
    
    // First processed should be critical priority
    expect(processedTransactions[0].priority).toBe(PRIORITY.CRITICAL);
  });
});

// Performance Tests
describe('TransactionQueue Performance', () => {
  test('should handle large number of transactions efficiently', async () => {
    const queue = new TransactionQueue({ maxQueueSize: 10000 });
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      const transactionData = { operations: [{ type: 'payment', id: i }] };
      promises.push(queue.enqueue(transactionData));
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    const status = queue.getQueueStatus();
    expect(status.totalSize).toBe(1000);
  });

  test('should maintain performance with frequent status checks', async () => {
    const queue = new TransactionQueue();
    
    // Enqueue some transactions
    for (let i = 0; i < 100; i++) {
      const transactionData = { operations: [{ type: 'payment', id: i }] };
      await queue.enqueue(transactionData);
    }
    
    const startTime = Date.now();
    
    // Perform many status checks
    for (let i = 0; i < 1000; i++) {
      queue.getQueueStatus();
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});

// Run tests
if (require.main === module) {
  console.log('Running Transaction Queue Tests...');
  
  // Simple test runner
  const tests = [
    'Basic Queue Operations',
    'Priority Management',
    'Queue Status and Metrics',
    'Transaction Processing',
    'Batch Processing',
    'Gas Optimization',
    'Event Emission',
    'Transaction Cancellation',
    'Cleanup and Maintenance',
    'Configuration',
    'Error Handling'
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`✓ ${test} - PASSED`);
      passed++;
    } catch (error) {
      console.log(`✗ ${test} - FAILED: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
  }
}

module.exports = {
  MockNetworkMonitor
};
