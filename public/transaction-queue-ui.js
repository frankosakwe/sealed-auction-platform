// Transaction Queue Management UI
class TransactionQueueUI {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.transactions = new Map();
        this.queueStatus = null;
        this.autoRefresh = true;
        this.refreshInterval = 5000; // 5 seconds
        
        this.init();
    }

    async init() {
        try {
            // Initialize socket connection
            this.initSocket();
            
            // Load user data
            await this.loadUserData();
            
            // Load initial queue status
            await this.loadQueueStatus();
            
            // Load user transactions
            await this.loadUserTransactions();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Transaction Queue UI initialized');
        } catch (error) {
            console.error('Failed to initialize Transaction Queue UI:', error);
            this.showError('Failed to initialize queue management');
        }
    }

    initSocket() {
        this.socket = io();
        
        // Join user-specific room
        this.socket.on('connect', () => {
            if (this.currentUser) {
                this.socket.emit('joinUserQueue', this.currentUser.id);
            }
        });

        // Listen for transaction events
        this.socket.on('transactionEnqueued', (transaction) => {
            this.handleTransactionEvent('enqueued', transaction);
        });

        this.socket.on('transactionProcessing', (transaction) => {
            this.handleTransactionEvent('processing', transaction);
        });

        this.socket.on('transactionCompleted', (transaction) => {
            this.handleTransactionEvent('completed', transaction);
        });

        this.socket.on('transactionFailed', (transaction) => {
            this.handleTransactionEvent('failed', transaction);
        });

        this.socket.on('transactionRetry', (transaction) => {
            this.handleTransactionEvent('retry', transaction);
        });
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                
                // Join user room after getting user data
                if (this.socket && this.socket.connected) {
                    this.socket.emit('joinUserQueue', this.currentUser.id);
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadQueueStatus() {
        try {
            const response = await fetch('/api/queue/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                this.queueStatus = await response.json();
                this.updateQueueStatusDisplay();
            }
        } catch (error) {
            console.error('Failed to load queue status:', error);
        }
    }

    async loadUserTransactions() {
        try {
            const response = await fetch('/api/queue/transactions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.transactions.clear();
                data.transactions.forEach(tx => {
                    this.transactions.set(tx.id, tx);
                });
                this.updateTransactionsDisplay();
            }
        } catch (error) {
            console.error('Failed to load user transactions:', error);
        }
    }

    async enqueueTransaction(transactionData, priority = 'NORMAL') {
        try {
            const response = await fetch('/api/queue/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    transactionData,
                    priority
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess(`Transaction enqueued with ID: ${result.transactionId}`);
                await this.loadQueueStatus();
                return result.transactionId;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to enqueue transaction');
            }
        } catch (error) {
            console.error('Failed to enqueue transaction:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async cancelTransaction(transactionId) {
        try {
            const response = await fetch(`/api/queue/transactions/${transactionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                this.showSuccess('Transaction cancelled successfully');
                await this.loadQueueStatus();
                await this.loadUserTransactions();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to cancel transaction');
            }
        } catch (error) {
            console.error('Failed to cancel transaction:', error);
            this.showError(error.message);
            throw error;
        }
    }

    handleTransactionEvent(eventType, transaction) {
        this.transactions.set(transaction.id, transaction);
        this.updateTransactionsDisplay();
        this.loadQueueStatus();
        
        // Show notification for important events
        switch (eventType) {
            case 'completed':
                this.showSuccess(`Transaction ${transaction.id} completed successfully`);
                break;
            case 'failed':
                this.showError(`Transaction ${transaction.id} failed: ${transaction.lastError?.message || 'Unknown error'}`);
                break;
            case 'retry':
                this.showInfo(`Transaction ${transaction.id} is being retried (${transaction.attempts}/${transaction.maxAttempts})`);
                break;
        }
    }

    updateQueueStatusDisplay() {
        if (!this.queueStatus) return;

        // Update main queue status
        const totalSizeEl = document.getElementById('queue-total-size');
        const processingEl = document.getElementById('queue-processing');
        const metricsEl = document.getElementById('queue-metrics');

        if (totalSizeEl) totalSizeEl.textContent = this.queueStatus.totalSize;
        if (processingEl) processingEl.textContent = this.queueStatus.processing;
        if (metricsEl) {
            metricsEl.innerHTML = `
                <div class="metric">
                    <span class="label">Total Processed:</span>
                    <span class="value">${this.queueStatus.metrics.totalProcessed}</span>
                </div>
                <div class="metric">
                    <span class="label">Success Rate:</span>
                    <span class="value">${this.calculateSuccessRate()}%</span>
                </div>
                <div class="metric">
                    <span class="label">Avg Processing Time:</span>
                    <span class="value">${this.formatTime(this.queueStatus.metrics.averageProcessingTime)}</span>
                </div>
            `;
        }

        // Update priority queue sizes
        Object.keys(this.queueStatus.queues).forEach(priority => {
            const queueEl = document.getElementById(`queue-${priority.toLowerCase()}`);
            if (queueEl) {
                queueEl.textContent = this.queueStatus.queues[priority].size;
            }
        });
    }

    updateTransactionsDisplay() {
        const container = document.getElementById('transactions-container');
        if (!container) return;

        const transactions = Array.from(this.transactions.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        container.innerHTML = transactions.map(transaction => this.renderTransaction(transaction)).join('');
    }

    renderTransaction(transaction) {
        const statusClass = this.getStatusClass(transaction.status);
        const priorityClass = this.getPriorityClass(transaction.priority);
        
        return `
            <div class="transaction-card ${statusClass}" data-transaction-id="${transaction.id}">
                <div class="transaction-header">
                    <div class="transaction-id">${transaction.id.substring(0, 8)}...</div>
                    <div class="transaction-status">
                        <span class="status-badge ${statusClass}">${transaction.status}</span>
                        <span class="priority-badge ${priorityClass}">${this.getPriorityName(transaction.priority)}</span>
                    </div>
                </div>
                <div class="transaction-details">
                    <div class="detail-row">
                        <span class="label">Created:</span>
                        <span class="value">${new Date(transaction.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Operations:</span>
                        <span class="value">${transaction.data.operations?.length || 0}</span>
                    </div>
                    ${transaction.attempts > 0 ? `
                        <div class="detail-row">
                            <span class="label">Attempts:</span>
                            <span class="value">${transaction.attempts}/${transaction.maxAttempts}</span>
                        </div>
                    ` : ''}
                    ${transaction.gasEstimate ? `
                        <div class="detail-row">
                            <span class="label">Gas Estimate:</span>
                            <span class="value">${transaction.gasEstimate}</span>
                        </div>
                    ` : ''}
                    ${transaction.lastError ? `
                        <div class="detail-row error">
                            <span class="label">Error:</span>
                            <span class="value">${transaction.lastError.message || 'Unknown error'}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="transaction-actions">
                    ${transaction.status === 'pending' ? `
                        <button class="btn btn-danger btn-sm" onclick="transactionQueueUI.cancelTransaction('${transaction.id}')">
                            Cancel
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="transactionQueueUI.showTransactionDetails('${transaction.id}')">
                        Details
                    </button>
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const statusClasses = {
            pending: 'status-pending',
            processing: 'status-processing',
            submitted: 'status-submitted',
            confirmed: 'status-confirmed',
            failed: 'status-failed',
            retry: 'status-retry'
        };
        return statusClasses[status] || 'status-unknown';
    }

    getPriorityClass(priority) {
        const priorityClasses = {
            1: 'priority-critical',
            2: 'priority-high',
            3: 'priority-normal',
            4: 'priority-low'
        };
        return priorityClasses[priority] || 'priority-normal';
    }

    getPriorityName(priority) {
        const priorityNames = {
            1: 'CRITICAL',
            2: 'HIGH',
            3: 'NORMAL',
            4: 'LOW'
        };
        return priorityNames[priority] || 'NORMAL';
    }

    calculateSuccessRate() {
        if (!this.queueStatus || this.queueStatus.metrics.totalProcessed === 0) return 0;
        return Math.round((this.queueStatus.metrics.totalSucceeded / this.queueStatus.metrics.totalProcessed) * 100);
    }

    formatTime(milliseconds) {
        if (!milliseconds) return '0ms';
        if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
        return `${(milliseconds / 1000).toFixed(2)}s`;
    }

    showTransactionDetails(transactionId) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) return;

        const modal = document.getElementById('transaction-details-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Transaction Details</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <pre>${JSON.stringify(transaction, null, 2)}</pre>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        
        if (this.autoRefresh) {
            this.refreshTimer = setInterval(async () => {
                await this.loadQueueStatus();
            }, this.refreshInterval);
        }
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    setupEventListeners() {
        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.autoRefresh = e.target.checked;
                if (this.autoRefresh) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadQueueStatus();
                await this.loadUserTransactions();
            });
        }

        // Filter controls
        const statusFilter = document.getElementById('status-filter');
        const priorityFilter = document.getElementById('priority-filter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }
        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => this.applyFilters());
        }
    }

    applyFilters() {
        const statusFilter = document.getElementById('status-filter')?.value;
        const priorityFilter = document.getElementById('priority-filter')?.value;
        
        const transactionCards = document.querySelectorAll('.transaction-card');
        transactionCards.forEach(card => {
            const transactionId = card.dataset.transactionId;
            const transaction = this.transactions.get(transactionId);
            
            if (!transaction) return;
            
            let show = true;
            
            if (statusFilter && transaction.status !== statusFilter) {
                show = false;
            }
            
            if (priorityFilter && transaction.priority !== parseInt(priorityFilter)) {
                show = false;
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    // Mobile-specific methods
    getMobileQueueStatus() {
        return {
            pendingCount: this.queueStatus?.totalSize || 0,
            processingCount: this.queueStatus?.processing || 0,
            estimatedWaitTime: this.queueStatus ? this.calculateEstimatedWaitTime() : 0,
            networkStatus: 'healthy' // Would integrate with network monitor
        };
    }

    calculateEstimatedWaitTime() {
        const avgProcessingTime = this.queueStatus?.metrics?.averageProcessingTime || 3000;
        const totalPending = this.queueStatus?.totalSize || 0;
        const batchSize = 10; // Default batch size
        return Math.ceil(totalPending * avgProcessingTime / batchSize);
    }
}

// Initialize the UI when DOM is ready
let transactionQueueUI;

document.addEventListener('DOMContentLoaded', () => {
    transactionQueueUI = new TransactionQueueUI();
    
    // Make it globally available for onclick handlers
    window.transactionQueueUI = transactionQueueUI;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransactionQueueUI;
}
