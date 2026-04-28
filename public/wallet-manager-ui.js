// Wallet Management UI
class WalletManagerUI {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.wallets = new Map();
        this.activeWalletId = null;
        this.autoRefresh = true;
        this.refreshInterval = 10000; // 10 seconds
        
        this.init();
    }

    async init() {
        try {
            // Initialize socket connection
            this.initSocket();
            
            // Load user data
            await this.loadUserData();
            
            // Load wallet manager status
            await this.loadWalletStatus();
            
            // Load wallets
            await this.loadWallets();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Wallet Manager UI initialized');
        } catch (error) {
            console.error('Failed to initialize Wallet Manager UI:', error);
            this.showError('Failed to initialize wallet management');
        }
    }

    initSocket() {
        this.socket = io();
        
        // Join user-specific room for their wallets
        this.socket.on('connect', () => {
            if (this.currentUser) {
                this.socket.emit('joinUserWallets', this.currentUser.id);
            }
        });

        // Listen for wallet events
        this.socket.on('walletCreated', (data) => {
            this.handleWalletEvent('created', data);
        });

        this.socket.on('walletSwitched', (data) => {
            this.handleWalletEvent('switched', data);
        });

        this.socket.on('walletLocked', (data) => {
            this.handleWalletEvent('locked', data);
        });

        this.socket.on('walletUnlocked', (data) => {
            this.handleWalletEvent('unlocked', data);
        });

        this.socket.on('balanceUpdated', (data) => {
            this.handleBalanceUpdate(data);
        });

        this.socket.on('backupCreated', (data) => {
            this.handleBackupEvent('created', data);
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
                    this.socket.emit('joinUserWallets', this.currentUser.id);
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadWalletStatus() {
        try {
            const response = await fetch('/api/wallets/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const status = await response.json();
                this.updateWalletStatusDisplay(status);
            }
        } catch (error) {
            console.error('Failed to load wallet status:', error);
        }
    }

    async loadWallets() {
        try {
            const response = await fetch('/api/wallets', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.wallets.clear();
                data.wallets.forEach(wallet => {
                    this.wallets.set(wallet.id, wallet);
                });
                this.updateWalletsDisplay();
            }
        } catch (error) {
            console.error('Failed to load wallets:', error);
        }
    }

    async createWallet(walletData) {
        try {
            const response = await fetch('/api/wallets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(walletData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess(`Wallet created successfully: ${result.walletId}`);
                await this.loadWallets();
                return result.walletId;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create wallet');
            }
        } catch (error) {
            console.error('Failed to create wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async importWallet(walletData) {
        try {
            const response = await fetch('/api/wallets/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(walletData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess(`Wallet imported successfully: ${result.walletId}`);
                await this.loadWallets();
                return result.walletId;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to import wallet');
            }
        } catch (error) {
            console.error('Failed to import wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async setActiveWallet(walletId) {
        try {
            const response = await fetch(`/api/wallets/${walletId}/active`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                this.activeWalletId = walletId;
                this.showSuccess('Active wallet updated');
                await this.loadWallets();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to set active wallet');
            }
        } catch (error) {
            console.error('Failed to set active wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async getWalletBalance(walletId) {
        try {
            const response = await fetch(`/api/wallets/${walletId}/balance`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.balance;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch wallet balance');
            }
        } catch (error) {
            console.error('Failed to fetch wallet balance:', error);
            throw error;
        }
    }

    async getAggregatedBalance() {
        try {
            const response = await fetch('/api/wallets/balance/aggregate', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch aggregated balance');
            }
        } catch (error) {
            console.error('Failed to fetch aggregated balance:', error);
            throw error;
        }
    }

    async lockWallet(walletId) {
        try {
            const response = await fetch(`/api/wallets/${walletId}/lock`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                this.showSuccess('Wallet locked successfully');
                await this.loadWallets();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to lock wallet');
            }
        } catch (error) {
            console.error('Failed to lock wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async unlockWallet(walletId, password) {
        try {
            const response = await fetch(`/api/wallets/${walletId}/unlock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                this.showSuccess('Wallet unlocked successfully');
                await this.loadWallets();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to unlock wallet');
            }
        } catch (error) {
            console.error('Failed to unlock wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async deleteWallet(walletId) {
        try {
            const response = await fetch(`/api/wallets/${walletId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                this.showSuccess('Wallet deleted successfully');
                await this.loadWallets();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete wallet');
            }
        } catch (error) {
            console.error('Failed to delete wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async createBackup(walletIds = null, password = null) {
        try {
            const response = await fetch('/api/wallets/backup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ walletIds, password })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess('Backup created successfully');
                return result.backupId;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create backup');
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async restoreFromBackup(backupData, password = null) {
        try {
            const response = await fetch('/api/wallets/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ backupData, password })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess(`${result.count} wallets restored successfully`);
                await this.loadWallets();
                return result.restoredWallets;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to restore from backup');
            }
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            this.showError(error.message);
            throw error;
        }
    }

    handleWalletEvent(eventType, data) {
        this.loadWallets();
        this.loadWalletStatus();
        
        switch (eventType) {
            case 'created':
                this.showSuccess(`Wallet "${data.wallet.name}" created successfully`);
                break;
            case 'switched':
                this.showSuccess(`Switched to wallet "${data.wallet.name}"`);
                break;
            case 'locked':
                this.showInfo(`Wallet "${data.wallet.name}" locked`);
                break;
            case 'unlocked':
                this.showInfo(`Wallet "${data.wallet.name}" unlocked`);
                break;
        }
    }

    handleBalanceUpdate(data) {
        const wallet = this.wallets.get(data.walletId);
        if (wallet) {
            wallet.balance = data.balance;
            this.updateWalletsDisplay();
        }
    }

    handleBackupEvent(eventType, data) {
        this.showSuccess(`Backup ${eventType} successfully`);
    }

    updateWalletStatusDisplay(status) {
        // Update status indicators
        const walletCountEl = document.getElementById('wallet-count');
        const activeWalletEl = document.getElementById('active-wallet-name');
        const autoBackupEl = document.getElementById('auto-backup-status');
        
        if (walletCountEl) walletCountEl.textContent = status.walletCount;
        if (activeWalletEl) activeWalletEl.textContent = status.activeWalletName || 'None';
        if (autoBackupEl) autoBackupEl.textContent = status.autoBackupEnabled ? 'Enabled' : 'Disabled';
    }

    updateWalletsDisplay() {
        const container = document.getElementById('wallets-container');
        if (!container) return;

        const wallets = Array.from(this.wallets.values())
            .sort((a, b) => {
                // Active wallet first
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                // Then by name
                return a.name.localeCompare(b.name);
            });

        container.innerHTML = wallets.map(wallet => this.renderWallet(wallet)).join('');
    }

    renderWallet(wallet) {
        const statusClass = wallet.isLocked ? 'locked' : 'unlocked';
        const activeClass = wallet.isActive ? 'active' : '';
        
        return `
            <div class="wallet-card ${statusClass} ${activeClass}" data-wallet-id="${wallet.id}">
                <div class="wallet-header">
                    <div class="wallet-info">
                        <h3 class="wallet-name">${wallet.name}</h3>
                        <div class="wallet-details">
                            <span class="wallet-type">${wallet.type.toUpperCase()}</span>
                            <span class="wallet-network">${wallet.network}</span>
                        </div>
                    </div>
                    <div class="wallet-status">
                        ${wallet.isActive ? '<span class="active-badge">ACTIVE</span>' : ''}
                        ${wallet.isLocked ? '<span class="locked-badge">🔒 LOCKED</span>' : '<span class="unlocked-badge">🔓 UNLOCKED</span>'}
                    </div>
                </div>
                
                <div class="wallet-balance">
                    <div class="balance-label">Balance</div>
                    <div class="balance-amount">${this.formatBalance(wallet.balance)}</div>
                </div>
                
                <div class="wallet-address">
                    <div class="address-label">Address</div>
                    <div class="address-value">${this.formatAddress(wallet.address || wallet.publicKey)}</div>
                    <button class="copy-btn" onclick="walletManagerUI.copyAddress('${wallet.address || wallet.publicKey}')">📋</button>
                </div>
                
                <div class="wallet-actions">
                    ${!wallet.isActive ? `
                        <button class="btn btn-primary btn-sm" onclick="walletManagerUI.setActiveWallet('${wallet.id}')">
                            Set Active
                        </button>
                    ` : ''}
                    
                    ${wallet.isLocked ? `
                        <button class="btn btn-secondary btn-sm" onclick="walletManagerUI.showUnlockModal('${wallet.id}')">
                            Unlock
                        </button>
                    ` : `
                        <button class="btn btn-secondary btn-sm" onclick="walletManagerUI.lockWallet('${wallet.id}')">
                            Lock
                        </button>
                    `}
                    
                    <button class="btn btn-info btn-sm" onclick="walletManagerUI.showWalletDetails('${wallet.id}')">
                        Details
                    </button>
                    
                    ${!wallet.isActive ? `
                        <button class="btn btn-danger btn-sm" onclick="walletManagerUI.confirmDeleteWallet('${wallet.id}')">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    formatBalance(balance) {
        if (typeof balance !== 'number') return '0.00';
        return balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
    }

    copyAddress(address) {
        navigator.clipboard.writeText(address).then(() => {
            this.showSuccess('Address copied to clipboard');
        }).catch(() => {
            this.showError('Failed to copy address');
        });
    }

    showWalletDetails(walletId) {
        const wallet = this.wallets.get(walletId);
        if (!wallet) return;

        const modal = document.getElementById('wallet-details-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Wallet Details</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="wallet-detail-section">
                            <h4>Basic Information</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Name:</label>
                                    <span>${wallet.name}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Type:</label>
                                    <span>${wallet.type.toUpperCase()}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Network:</label>
                                    <span>${wallet.network}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Security Level:</label>
                                    <span>${wallet.securityLevel}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="wallet-detail-section">
                            <h4>Address Information</h4>
                            <div class="detail-item">
                                <label>Public Key:</label>
                                <span class="address-full">${wallet.publicKey}</span>
                                <button class="copy-btn" onclick="walletManagerUI.copyAddress('${wallet.publicKey}')">📋</button>
                            </div>
                        </div>
                        
                        <div class="wallet-detail-section">
                            <h4>Transaction History</h4>
                            <button class="btn btn-secondary" onclick="walletManagerUI.showTransactionHistory('${walletId}')">
                                View Transaction History
                            </button>
                        </div>
                        
                        <div class="wallet-detail-section">
                            <h4>Backup & Export</h4>
                            <div class="action-buttons">
                                <button class="btn btn-info" onclick="walletManagerUI.exportWallet('${walletId}')">
                                    Export Wallet
                                </button>
                                <button class="btn btn-warning" onclick="walletManagerUI.backupWallet('${walletId}')">
                                    Create Backup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    showUnlockModal(walletId) {
        const modal = document.getElementById('unlock-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Unlock Wallet</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="unlock-form" onsubmit="walletManagerUI.handleUnlock(event, '${walletId}')">
                            <div class="form-group">
                                <label for="unlock-password">Password:</label>
                                <input type="password" id="unlock-password" required>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">Cancel</button>
                                <button type="submit" class="btn btn-primary">Unlock</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    async handleUnlock(event, walletId) {
        event.preventDefault();
        const password = document.getElementById('unlock-password').value;
        
        try {
            await this.unlockWallet(walletId, password);
            document.getElementById('unlock-modal').style.display = 'none';
        } catch (error) {
            // Error already shown in unlockWallet method
        }
    }

    confirmDeleteWallet(walletId) {
        const wallet = this.wallets.get(walletId);
        if (!wallet) return;

        if (confirm(`Are you sure you want to delete wallet "${wallet.name}"? This action cannot be undone.`)) {
            this.deleteWallet(walletId);
        }
    }

    async exportWallet(walletId) {
        try {
            const format = prompt('Export format (json/csv):', 'json');
            if (!format) return;

            const response = await fetch(`/api/wallets/${walletId}/export?format=${format}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wallet-${walletId}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showSuccess('Wallet exported successfully');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to export wallet');
            }
        } catch (error) {
            console.error('Failed to export wallet:', error);
            this.showError(error.message);
        }
    }

    async backupWallet(walletId) {
        try {
            const password = prompt('Enter password for backup encryption (leave empty for no encryption):');
            
            const backupId = await this.createBackup([walletId], password || null);
            this.showSuccess('Wallet backup created successfully');
        } catch (error) {
            console.error('Failed to backup wallet:', error);
            // Error already shown in createBackup method
        }
    }

    showTransactionHistory(walletId) {
        // This would open a transaction history modal or navigate to a separate page
        this.showInfo('Transaction history feature coming soon');
    }

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        
        if (this.autoRefresh) {
            this.refreshTimer = setInterval(async () => {
                await this.loadWalletStatus();
                await this.loadWallets();
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
                await this.loadWalletStatus();
                await this.loadWallets();
            });
        }

        // Create wallet button
        const createWalletBtn = document.getElementById('create-wallet-btn');
        if (createWalletBtn) {
            createWalletBtn.addEventListener('click', () => {
                this.showCreateWalletModal();
            });
        }

        // Import wallet button
        const importWalletBtn = document.getElementById('import-wallet-btn');
        if (importWalletBtn) {
            importWalletBtn.addEventListener('click', () => {
                this.showImportWalletModal();
            });
        }
    }

    showCreateWalletModal() {
        const modal = document.getElementById('create-wallet-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create New Wallet</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="create-wallet-form" onsubmit="walletManagerUI.handleCreateWallet(event)">
                            <div class="form-group">
                                <label for="wallet-name">Wallet Name:</label>
                                <input type="text" id="wallet-name" required placeholder="My Wallet">
                            </div>
                            
                            <div class="form-group">
                                <label for="wallet-type">Wallet Type:</label>
                                <select id="wallet-type" required>
                                    <option value="stellar">Stellar</option>
                                    <option value="ethereum">Ethereum</option>
                                    <option value="bitcoin">Bitcoin</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="wallet-network">Network:</label>
                                <select id="wallet-network" required>
                                    <option value="testnet">Testnet</option>
                                    <option value="mainnet">Mainnet</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="wallet-security">Security Level:</label>
                                <select id="wallet-security" required>
                                    <option value="basic">Basic</option>
                                    <option value="standard">Standard</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="wallet-password">Password:</label>
                                <input type="password" id="wallet-password" placeholder="Enter password for encryption">
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">Cancel</button>
                                <button type="submit" class="btn btn-primary">Create Wallet</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    async handleCreateWallet(event) {
        event.preventDefault();
        
        const walletData = {
            name: document.getElementById('wallet-name').value,
            type: document.getElementById('wallet-type').value,
            network: document.getElementById('wallet-network').value,
            securityLevel: document.getElementById('wallet-security').value,
            password: document.getElementById('wallet-password').value
        };
        
        try {
            await this.createWallet(walletData);
            document.getElementById('create-wallet-modal').style.display = 'none';
        } catch (error) {
            // Error already shown in createWallet method
        }
    }

    showImportWalletModal() {
        const modal = document.getElementById('import-wallet-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Import Existing Wallet</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="import-wallet-form" onsubmit="walletManagerUI.handleImportWallet(event)">
                            <div class="form-group">
                                <label for="import-wallet-name">Wallet Name:</label>
                                <input type="text" id="import-wallet-name" required placeholder="Imported Wallet">
                            </div>
                            
                            <div class="form-group">
                                <label for="import-wallet-type">Wallet Type:</label>
                                <select id="import-wallet-type" required>
                                    <option value="stellar">Stellar</option>
                                    <option value="ethereum">Ethereum</option>
                                    <option value="bitcoin">Bitcoin</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="import-public-key">Public Key:</label>
                                <input type="text" id="import-public-key" required placeholder="G...">
                            </div>
                            
                            <div class="form-group">
                                <label for="import-secret-key">Secret Key:</label>
                                <input type="password" id="import-secret-key" required placeholder="S...">
                            </div>
                            
                            <div class="form-group">
                                <label for="import-security">Security Level:</label>
                                <select id="import-security" required>
                                    <option value="basic">Basic</option>
                                    <option value="standard">Standard</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="import-password">Password:</label>
                                <input type="password" id="import-password" placeholder="Enter password for encryption">
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">Cancel</button>
                                <button type="submit" class="btn btn-primary">Import Wallet</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    async handleImportWallet(event) {
        event.preventDefault();
        
        const walletData = {
            name: document.getElementById('import-wallet-name').value,
            type: document.getElementById('import-wallet-type').value,
            publicKey: document.getElementById('import-public-key').value,
            secretKey: document.getElementById('import-secret-key').value,
            securityLevel: document.getElementById('import-security').value,
            password: document.getElementById('import-password').value
        };
        
        try {
            await this.importWallet(walletData);
            document.getElementById('import-wallet-modal').style.display = 'none';
        } catch (error) {
            // Error already shown in importWallet method
        }
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
    async getMobileStatus() {
        try {
            const response = await fetch('/api/wallets/mobile/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to fetch mobile status:', error);
        }
        return null;
    }

    async getMobileBalances() {
        try {
            const response = await fetch('/api/wallets/mobile/balances', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to fetch mobile balances:', error);
        }
        return null;
    }
}

// Initialize the UI when DOM is ready
let walletManagerUI;

document.addEventListener('DOMContentLoaded', () => {
    walletManagerUI = new WalletManagerUI();
    
    // Make it globally available for onclick handlers
    window.walletManagerUI = walletManagerUI;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WalletManagerUI;
}
