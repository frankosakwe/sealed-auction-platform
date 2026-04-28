const { EventEmitter } = require('events');
const { Horizon, TransactionBuilder, Networks, BASE_FEE } = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Transaction priority levels
 */
const PRIORITY = {
  CRITICAL: 1,    // Emergency transactions (auction ending, security)
  HIGH: 2,        // User-initiated transactions (bids, withdrawals)
  NORMAL: 3,      // Background processes (batch operations)
  LOW: 4          // Maintenance, analytics, cleanup
};

/**
 * Transaction status
 */
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  RETRY: 'retry'
};

/**
 * Transaction Queue Manager
 * Handles queuing, prioritizing, and batch processing of Stellar transactions
 */
class TransactionQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Queue configuration
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 5000; // 5 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second base
    this.gasOptimization = options.gasOptimization !== false;
    
    // Queue storage - separate queues per priority
    this.queues = new Map();
    Object.keys(PRIORITY).forEach(priority => {
      this.queues.set(PRIORITY[priority], []);
    });
    
    // Transaction tracking
    this.transactions = new Map(); // All transactions by ID
    this.processing = new Set(); // Currently processing transactions
    this.batches = new Map(); // Batch tracking
    
    // Metrics and monitoring
    this.metrics = {
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      totalRetried: 0,
      averageProcessingTime: 0,
      queueSizes: {},
      gasSavings: 0
    };
    
    // Gas optimization
    this.gasOptimizer = new GasOptimizer();
    
    // Network monitoring
    this.networkMonitor = options.networkMonitor;
    
    // Start queue processing
    this.startProcessing();
  }

  /**
   * Add transaction to queue
   */
  async enqueue(transactionData, priority = PRIORITY.NORMAL) {
    // Validate transaction data
    if (!this.validateTransactionData(transactionData)) {
      throw new Error('Invalid transaction data');
    }

    // Check queue capacity
    if (this.getTotalQueueSize() >= this.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const transaction = {
      id: uuidv4(),
      data: transactionData,
      priority,
      status: STATUS.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.maxRetries,
      gasEstimate: null,
      batchId: null
    };

    // Estimate gas if optimization is enabled
    if (this.gasOptimization) {
      transaction.gasEstimate = await this.gasOptimizer.estimateGas(transactionData);
    }

    // Add to appropriate priority queue
    const queue = this.queues.get(priority);
    queue.push(transaction);
    this.transactions.set(transaction.id, transaction);

    // Update metrics
    this.updateQueueMetrics();

    // Emit event
    this.emit('transactionEnqueued', transaction);

    return transaction.id;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }

  /**
   * Get queue status and metrics
   */
  getQueueStatus() {
    const status = {
      totalSize: this.getTotalQueueSize(),
      processing: this.processing.size,
      metrics: { ...this.metrics },
      queues: {}
    };

    // Per-priority queue sizes
    Object.keys(PRIORITY).forEach(priority => {
      const priorityLevel = PRIORITY[priority];
      status.queues[priority] = {
        size: this.queues.get(priorityLevel).length,
        priority: priorityLevel
      };
    });

    return status;
  }

  /**
   * Start queue processing loop
   */
  startProcessing() {
    // Process transactions every 1 second
    setInterval(() => {
      this.processQueue();
    }, 1000);

    // Batch processing timer
    setInterval(() => {
      this.processBatches();
    }, this.batchTimeout);

    // Cleanup old transactions every 5 minutes
    setInterval(() => {
      this.cleanupOldTransactions();
    }, 300000);
  }

  /**
   * Process transactions from queues
   */
  async processQueue() {
    if (this.processing.size >= this.batchSize) {
      return; // Already processing max batch size
    }

    // Process by priority (lowest number = highest priority)
    const priorities = Array.from(this.queues.keys()).sort((a, b) => a - b);
    
    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      
      while (queue.length > 0 && this.processing.size < this.batchSize) {
        const transaction = queue.shift();
        
        if (transaction.status === STATUS.PENDING) {
          this.processTransaction(transaction);
        }
      }
    }
  }

  /**
   * Process individual transaction
   */
  async processTransaction(transaction) {
    this.processing.add(transaction.id);
    transaction.status = STATUS.PROCESSING;
    transaction.startedAt = new Date();

    this.emit('transactionProcessing', transaction);

    try {
      // Apply gas optimizations if enabled
      let optimizedTransaction = transaction.data;
      if (this.gasOptimization) {
        optimizedTransaction = await this.gasOptimizer.optimizeTransaction(transaction.data);
      }

      // Check network conditions
      if (this.networkMonitor && !this.networkMonitor.isHealthy()) {
        throw new Error('Network is not healthy');
      }

      // Execute transaction
      const result = await this.executeTransaction(optimizedTransaction);
      
      // Mark as successful
      transaction.status = STATUS.CONFIRMED;
      transaction.completedAt = new Date();
      transaction.result = result;
      
      // Update metrics
      this.metrics.totalProcessed++;
      this.metrics.totalSucceeded++;
      this.updateProcessingTime(transaction);

      this.emit('transactionCompleted', transaction);

    } catch (error) {
      await this.handleTransactionFailure(transaction, error);
    } finally {
      this.processing.delete(transaction.id);
    }
  }

  /**
   * Handle transaction failure
   */
  async handleTransactionFailure(transaction, error) {
    transaction.attempts++;
    transaction.lastError = error;
    transaction.failedAt = new Date();

    if (transaction.attempts < transaction.maxAttempts) {
      // Retry with exponential backoff
      transaction.status = STATUS.RETRY;
      const delay = this.retryDelay * Math.pow(2, transaction.attempts - 1);
      
      setTimeout(() => {
        transaction.status = STATUS.PENDING;
        this.queues.get(transaction.priority).push(transaction);
        this.metrics.totalRetried++;
        this.emit('transactionRetry', transaction);
      }, delay);

    } else {
      // Mark as failed
      transaction.status = STATUS.FAILED;
      this.metrics.totalProcessed++;
      this.metrics.totalFailed++;
      
      this.emit('transactionFailed', transaction);
    }
  }

  /**
   * Execute transaction on Stellar network
   */
  async executeTransaction(transactionData) {
    // This would integrate with the existing Stellar transaction logic
    // For now, simulate execution
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve({
            hash: crypto.randomBytes(32).toString('hex'),
            status: 'SUCCESS',
            gasUsed: Math.floor(Math.random() * 1000) + 100
          });
        } else {
          reject(new Error('Transaction failed'));
        }
      }, Math.random() * 2000 + 500); // Random delay 0.5-2.5s
    });
  }

  /**
   * Process batch transactions
   */
  async processBatches() {
    const batch = [];
    
    // Collect transactions for batching
    for (const priority of Object.values(PRIORITY)) {
      const queue = this.queues.get(priority);
      const batchable = queue.filter(tx => 
        tx.status === STATUS.PENDING && 
        tx.data.batchable !== false
      );
      
      batch.push(...batchable.splice(0, this.batchSize - batch.length));
      
      if (batch.length >= this.batchSize) break;
    }

    if (batch.length > 1) {
      await this.executeBatch(batch);
    }
  }

  /**
   * Execute batch of transactions
   */
  async executeBatch(transactions) {
    const batchId = uuidv4();
    
    transactions.forEach(tx => {
      tx.batchId = batchId;
      tx.status = STATUS.PROCESSING;
      this.processing.add(tx.id);
    });

    this.batches.set(batchId, {
      id: batchId,
      transactions: transactions.map(tx => tx.id),
      startedAt: new Date()
    });

    try {
      // Execute batch (simplified - would use Stellar batch operations)
      const results = await Promise.allSettled(
        transactions.map(tx => this.executeTransaction(tx.data))
      );

      results.forEach((result, index) => {
        const transaction = transactions[index];
        
        if (result.status === 'fulfilled') {
          transaction.status = STATUS.CONFIRMED;
          transaction.result = result.value;
          this.metrics.totalSucceeded++;
        } else {
          this.handleTransactionFailure(transaction, result.reason);
        }
        
        this.processing.delete(transaction.id);
      });

      this.emit('batchCompleted', batchId, results);

    } catch (error) {
      // Handle batch failure
      transactions.forEach(tx => {
        this.handleTransactionFailure(tx, error);
        this.processing.delete(tx.id);
      });
      
      this.emit('batchFailed', batchId, error);
    } finally {
      this.batches.delete(batchId);
    }
  }

  /**
   * Validate transaction data
   */
  validateTransactionData(data) {
    return data && 
           typeof data === 'object' &&
           data.operations && 
           Array.isArray(data.operations) &&
           data.operations.length > 0;
  }

  /**
   * Get total queue size
   */
  getTotalQueueSize() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics() {
    Object.keys(PRIORITY).forEach(priority => {
      const priorityLevel = PRIORITY[priority];
      this.metrics.queueSizes[priority] = this.queues.get(priorityLevel).length;
    });
  }

  /**
   * Update average processing time
   */
  updateProcessingTime(transaction) {
    if (transaction.startedAt && transaction.completedAt) {
      const processingTime = transaction.completedAt - transaction.startedAt;
      const currentAvg = this.metrics.averageProcessingTime;
      const count = this.metrics.totalProcessed;
      
      this.metrics.averageProcessingTime = 
        (currentAvg * (count - 1) + processingTime) / count;
    }
  }

  /**
   * Cleanup old completed/failed transactions
   */
  cleanupOldTransactions() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, transaction] of this.transactions) {
      if ((transaction.status === STATUS.CONFIRMED || 
           transaction.status === STATUS.FAILED) &&
          transaction.completedAt && 
          transaction.completedAt < cutoff) {
        
        this.transactions.delete(id);
      }
    }
  }

  /**
   * Cancel transaction
   */
  cancelTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    
    if (transaction && transaction.status === STATUS.PENDING) {
      transaction.status = STATUS.FAILED;
      transaction.cancelled = true;
      
      // Remove from queue
      const queue = this.queues.get(transaction.priority);
      const index = queue.indexOf(transaction);
      if (index > -1) {
        queue.splice(index, 1);
      }
      
      this.emit('transactionCancelled', transaction);
      return true;
    }
    
    return false;
  }

  /**
   * Get mobile-friendly queue status
   */
  getMobileQueueStatus() {
    return {
      pendingCount: this.getTotalQueueSize(),
      processingCount: this.processing.size,
      estimatedWaitTime: this.calculateEstimatedWaitTime(),
      networkStatus: this.networkMonitor ? this.networkMonitor.getStatus() : 'unknown'
    };
  }

  /**
   * Calculate estimated wait time for new transactions
   */
  calculateEstimatedWaitTime() {
    const avgProcessingTime = this.metrics.averageProcessingTime || 3000; // 3 seconds default
    const totalPending = this.getTotalQueueSize();
    return Math.ceil(totalPending * avgProcessingTime / this.batchSize);
  }
}

/**
 * Gas Optimization helper
 */
class GasOptimizer {
  constructor() {
    this.gasPriceHistory = [];
    this.optimizationStrategies = {
      LOW_GAS: 'low_gas',
      NORMAL: 'normal',
      FAST: 'fast'
    };
  }

  async estimateGas(transactionData) {
    // Simplified gas estimation
    const baseGas = 100;
    const operationGas = transactionData.operations.length * 50;
    return baseGas + operationGas;
  }

  async optimizeTransaction(transactionData) {
    // Apply gas optimization strategies
    const optimized = { ...transactionData };
    
    // Add gas optimization metadata
    optimized.optimized = true;
    optimized.strategy = this.optimizationStrategies.NORMAL;
    
    return optimized;
  }
}

module.exports = {
  TransactionQueue,
  PRIORITY,
  STATUS,
  GasOptimizer
};
