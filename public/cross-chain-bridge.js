// Cross-Chain Bridge UI
class CrossChainBridge {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.selectedSourceChain = null;
        this.selectedTargetChain = null;
        this.selectedAsset = null;
        this.amount = 0;
        this.transfers = [];
        this.bridgeStatus = {
            isConnected: false,
            supportedChains: [],
            totalVolume24h: 0,
            activeTransfers: 0
        };
        
        // Supported chains configuration
        this.chains = {
            stellar: {
                id: 'stellar',
                name: 'Stellar',
                symbol: 'XLM',
                icon: 'fas fa-star',
                color: '#667eea',
                nativeAsset: 'XLM',
                supportedAssets: ['XLM', 'USDC', 'EURT', 'BTC', 'ETH'],
                explorerUrl: 'https://stellar.expert/explorer/'
            },
            ethereum: {
                id: 'ethereum',
                name: 'Ethereum',
                symbol: 'ETH',
                icon: 'fab fa-ethereum',
                color: '#627eea',
                nativeAsset: 'ETH',
                supportedAssets: ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI'],
                explorerUrl: 'https://etherscan.io/'
            },
            polygon: {
                id: 'polygon',
                name: 'Polygon',
                symbol: 'MATIC',
                icon: 'fas fa-shapes',
                color: '#8247e5',
                nativeAsset: 'MATIC',
                supportedAssets: ['MATIC', 'USDC', 'USDT', 'WBTC', 'DAI'],
                explorerUrl: 'https://polygonscan.com/'
            },
            binance: {
                id: 'binance',
                name: 'Binance Smart Chain',
                symbol: 'BNB',
                icon: 'fas fa-coins',
                color: '#f0b90b',
                nativeAsset: 'BNB',
                supportedAssets: ['BNB', 'USDC', 'USDT', 'BUSD', 'DAI'],
                explorerUrl: 'https://bscscan.com/'
            },
            avalanche: {
                id: 'avalanche',
                name: 'Avalanche',
                symbol: 'AVAX',
                icon: 'fas fa-mountain',
                color: '#e84142',
                nativeAsset: 'AVAX',
                supportedAssets: ['AVAX', 'USDC', 'USDT', 'WBTC', 'DAI'],
                explorerUrl: 'https://snowtrace.io/'
            },
            arbitrum: {
                id: 'arbitrum',
                name: 'Arbitrum',
                symbol: 'ARB',
                icon: 'fas fa-cube',
                color: '#28a0f0',
                nativeAsset: 'ETH',
                supportedAssets: ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI'],
                explorerUrl: 'https://arbiscan.io/'
            }
        };

        // Asset configurations
        this.assets = {
            'XLM': { name: 'Stellar Lumens', decimals: 7, icon: 'fas fa-star', color: '#667eea' },
            'ETH': { name: 'Ethereum', decimals: 18, icon: 'fab fa-ethereum', color: '#627eea' },
            'USDC': { name: 'USD Coin', decimals: 6, icon: 'fas fa-dollar-sign', color: '#2775ca' },
            'USDT': { name: 'Tether', decimals: 6, icon: 'fas fa-dollar-sign', color: '#26a17b' },
            'WBTC': { name: 'Wrapped Bitcoin', decimals: 8, icon: 'fab fa-bitcoin', color: '#f7931a' },
            'DAI': { name: 'Dai Stablecoin', decimals: 18, icon: 'fas fa-coins', color: '#f5a524' },
            'MATIC': { name: 'Polygon', decimals: 18, icon: 'fas fa-shapes', color: '#8247e5' },
            'BNB': { name: 'Binance Coin', decimals: 18, icon: 'fas fa-coins', color: '#f0b90b' },
            'AVAX': { name: 'Avalanche', decimals: 18, icon: 'fas fa-mountain', color: '#e84142' },
            'ARB': { name: 'Arbitrum', decimals: 18, icon: 'fas fa-cube', color: '#28a0f0' },
            'EURT': { name: 'Euro Token', decimals: 2, icon: 'fas fa-euro-sign', color: '#0077cc' },
            'BTC': { name: 'Bitcoin', decimals: 8, icon: 'fab fa-bitcoin', color: '#f7931a' },
            'BUSD': { name: 'Binance USD', decimals: 18, icon: 'fas fa-dollar-sign', color: '#f0b90b' }
        };

        this.init();
    }

    async init() {
        try {
            // Initialize socket connection
            this.initSocket();
            
            // Load user data from main app
            this.loadUserDataFromMainApp();
            
            // Initialize UI when bridge tab is opened
            this.setupTabInitialization();
            
            console.log('Cross-Chain Bridge initialized');
        } catch (error) {
            console.error('Failed to initialize Cross-Chain Bridge:', error);
            this.showError('Failed to initialize bridge interface');
        }
    }

    loadUserDataFromMainApp() {
        // Get user data from main app's currentUser
        if (typeof currentUser !== 'undefined') {
            this.currentUser = currentUser;
        }
    }

    setupTabInitialization() {
        // Initialize bridge UI when tab is opened
        const originalSwitchTab = window.switchTab;
        window.switchTab = (tabName) => {
            originalSwitchTab(tabName);
            
            if (tabName === 'bridge') {
                this.initializeBridgeUI();
            }
        };
    }

    async initializeBridgeUI() {
        try {
            // Initialize UI components
            this.initializeUI();
            
            // Load bridge status
            await this.loadBridgeStatus();
            
            // Load transfer history
            await this.loadTransferHistory();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            console.log('Bridge UI initialized');
        } catch (error) {
            console.error('Failed to initialize bridge UI:', error);
        }
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to bridge server');
            this.bridgeStatus.isConnected = true;
            this.updateBridgeStatus();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from bridge server');
            this.bridgeStatus.isConnected = false;
            this.updateBridgeStatus();
        });

        // Bridge events
        this.socket.on('transferInitiated', (data) => {
            this.handleTransferInitiated(data);
        });

        this.socket.on('transferUpdated', (data) => {
            this.handleTransferUpdated(data);
        });

        this.socket.on('transferCompleted', (data) => {
            this.handleTransferCompleted(data);
        });

        this.socket.on('bridgeStatusUpdate', (data) => {
            this.bridgeStatus = { ...this.bridgeStatus, ...data };
            this.updateBridgeStatus();
        });
    }

    async loadUserData() {
        try {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
                document.getElementById('userDisplay').textContent = this.currentUser.username;
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    initializeUI() {
        // Initialize theme
        this.initializeTheme();
        
        // Populate chain selections
        this.populateChainSelections();
        
        // Initialize asset selection
        this.initializeAssetSelection();
        
        // Initialize security checks
        this.initializeSecurityChecks();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    populateChainSelections() {
        const sourceContainer = document.getElementById('bridgeSourceChains');
        const targetContainer = document.getElementById('bridgeTargetChains');
        
        if (!sourceContainer || !targetContainer) return;
        
        Object.values(this.chains).forEach(chain => {
            const sourceCard = this.createChainCard(chain, 'source');
            const targetCard = this.createChainCard(chain, 'target');
            
            sourceContainer.appendChild(sourceCard);
            targetContainer.appendChild(targetCard);
        });
        
        // Set default selections
        this.selectChain('stellar', 'source');
        this.selectChain('ethereum', 'target');
    }

    createChainCard(chain, type) {
        const card = document.createElement('div');
        card.className = 'chain-card p-4 rounded-lg flex items-center gap-3';
        card.dataset.chainId = chain.id;
        card.dataset.type = type;
        
        card.innerHTML = `
            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: ${chain.color}20;">
                <i class="${chain.icon}" style="color: ${chain.color};"></i>
            </div>
            <div class="flex-1">
                <div class="font-medium">${chain.name}</div>
                <div class="text-sm text-gray-500">${chain.symbol}</div>
            </div>
            <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
        `;
        
        card.addEventListener('click', () => this.selectChain(chain.id, type));
        
        return card;
    }

    selectChain(chainId, type) {
        const chain = this.chains[chainId];
        if (!chain) return;
        
        // Update selection
        if (type === 'source') {
            this.selectedSourceChain = chain;
        } else {
            this.selectedTargetChain = chain;
        }
        
        // Update UI
        document.querySelectorAll(`.chain-card[data-type="${type}"]`).forEach(card => {
            card.classList.remove('selected');
            const indicator = card.querySelector('.w-5.h-5');
            indicator.innerHTML = '<div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>';
        });
        
        const selectedCard = document.querySelector(`.chain-card[data-chain-id="${chainId}"][data-type="${type}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            const indicator = selectedCard.querySelector('.w-5.h-5');
            indicator.innerHTML = '<div class="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500"></div>';
        }
        
        // Update asset selection
        this.updateAssetSelection();
        
        // Validate bridge
        this.validateBridge();
    }

    updateAssetSelection() {
        if (!this.selectedSourceChain || !this.selectedTargetChain) return;
        
        const assetSelect = document.getElementById('assetSelect');
        assetSelect.innerHTML = '<option value="">Select an asset...</option>';
        
        // Find common assets between chains
        const commonAssets = this.selectedSourceChain.supportedAssets.filter(asset => 
            this.selectedTargetChain.supportedAssets.includes(asset)
        );
        
        commonAssets.forEach(assetSymbol => {
            const asset = this.assets[assetSymbol];
            if (asset) {
                const option = document.createElement('option');
                option.value = assetSymbol;
                option.textContent = `${asset.name} (${assetSymbol})`;
                assetSelect.appendChild(option);
            }
        });
    }

    initializeAssetSelection() {
        const assetSelect = document.getElementById('bridgeAssetSelect');
        const amountInput = document.getElementById('bridgeAmountInput');
        const maxButton = document.getElementById('bridgeMaxButton');
        
        if (!assetSelect || !amountInput || !maxButton) return;
        
        assetSelect.addEventListener('change', (e) => {
            this.selectedAsset = e.target.value;
            this.updateBalanceInfo();
            this.validateBridge();
        });
        
        amountInput.addEventListener('input', (e) => {
            this.amount = parseFloat(e.target.value) || 0;
            this.validateBridge();
        });
        
        maxButton.addEventListener('click', () => {
            // Set max amount (mock implementation)
            amountInput.value = '1000';
            this.amount = 1000;
            this.validateBridge();
        });
    }

    updateBalanceInfo() {
        const balanceInfo = document.getElementById('bridgeBalanceInfo');
        if (!balanceInfo || !this.selectedAsset || !this.selectedSourceChain) {
            if (balanceInfo) balanceInfo.innerHTML = '';
            return;
        }
        
        // Mock balance (in real implementation, this would fetch from wallet)
        const mockBalance = Math.random() * 10000;
        balanceInfo.innerHTML = `
            <div class="flex justify-between">
                <span>Available Balance:</span>
                <span class="font-mono">${mockBalance.toFixed(4)} ${this.selectedAsset}</span>
            </div>
        `;
    }

    validateBridge() {
        const bridgeButton = document.getElementById('bridgeButton');
        const isValid = this.selectedSourceChain && 
                       this.selectedTargetChain && 
                       this.selectedAsset && 
                       this.amount > 0 &&
                       this.selectedSourceChain.id !== this.selectedTargetChain.id;
        
        bridgeButton.disabled = !isValid;
        
        if (isValid) {
            this.estimateFees();
            this.performSecurityChecks();
        }
    }

    async estimateFees() {
        if (!this.selectedSourceChain || !this.selectedTargetChain || !this.selectedAsset) return;
        
        // Mock fee calculation (in real implementation, this would call bridge API)
        const bridgeFee = this.amount * 0.001; // 0.1% bridge fee
        const networkFee = 0.01; // Fixed network fee
        const totalFee = bridgeFee + networkFee;
        
        const bridgeFeeElement = document.getElementById('bridgeFeeAmount');
        const networkFeeElement = document.getElementById('bridgeNetworkFee');
        const totalFeeElement = document.getElementById('bridgeTotalFee');
        
        if (bridgeFeeElement) bridgeFeeElement.textContent = `${bridgeFee.toFixed(6)} ${this.selectedAsset}`;
        if (networkFeeElement) networkFeeElement.textContent = `${networkFee.toFixed(6)} ${this.selectedAsset}`;
        if (totalFeeElement) totalFeeElement.textContent = `${totalFee.toFixed(6)} ${this.selectedAsset}`;
    }

    performSecurityChecks() {
        const securityChecks = document.getElementById('bridgeSecurityChecks');
        if (!securityChecks) return;
        
        securityChecks.innerHTML = '';
        
        const checks = [
            { id: 'chainSupport', label: 'Chain Support', status: 'verified' },
            { id: 'assetSupport', label: 'Asset Support', status: 'verified' },
            { id: 'liquidity', label: 'Sufficient Liquidity', status: 'verified' },
            { id: 'contractVerified', label: 'Contract Verified', status: 'verified' },
            { id: 'amountLimits', label: 'Amount Within Limits', status: this.amount <= 10000 ? 'verified' : 'warning' }
        ];
        
        checks.forEach(check => {
            const checkElement = document.createElement('div');
            checkElement.className = `security-check ${check.status}`;
            checkElement.innerHTML = `
                <i class="fas fa-${check.status === 'verified' ? 'check-circle' : 'exclamation-triangle'}"></i>
                <span>${check.label}</span>
            `;
            securityChecks.appendChild(checkElement);
        });
    }

    setupEventListeners() {
        // Chain swap
        const swapChainsBtn = document.getElementById('bridgeSwapChains');
        if (swapChainsBtn) {
            swapChainsBtn.addEventListener('click', () => {
                this.swapChains();
            });
        }
        
        // Bridge button
        const bridgeBtn = document.getElementById('bridgeButton');
        if (bridgeBtn) {
            bridgeBtn.addEventListener('click', () => {
                this.showPreview();
            });
        }
        
        // Preview button
        const previewBtn = document.getElementById('bridgePreviewButton');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.showPreview();
            });
        }
        
        // Preview modal buttons (if they exist)
        const confirmBtn = document.getElementById('confirmBridge');
        const cancelBtn = document.getElementById('cancelPreview');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.executeBridge();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hidePreview();
            });
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById('themeIcon');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    swapChains() {
        if (!this.selectedSourceChain || !this.selectedTargetChain) return;
        
        const tempChain = this.selectedSourceChain;
        this.selectedSourceChain = this.selectedTargetChain;
        this.selectedTargetChain = tempChain;
        
        // Update UI
        this.selectChain(this.selectedSourceChain.id, 'source');
        this.selectChain(this.selectedTargetChain.id, 'target');
    }

    showPreview() {
        if (!this.validateBridgeData()) return;
        
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');
        
        content.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span>From:</span>
                    <span class="font-medium">${this.selectedSourceChain.name}</span>
                </div>
                <div class="flex justify-between">
                    <span>To:</span>
                    <span class="font-medium">${this.selectedTargetChain.name}</span>
                </div>
                <div class="flex justify-between">
                    <span>Asset:</span>
                    <span class="font-medium">${this.selectedAsset}</span>
                </div>
                <div class="flex justify-between">
                    <span>Amount:</span>
                    <span class="font-medium">${this.amount} ${this.selectedAsset}</span>
                </div>
                <div class="flex justify-between">
                    <span>Estimated Time:</span>
                    <span class="font-medium">5-15 minutes</span>
                </div>
                <div class="border-t pt-3">
                    <div class="flex justify-between font-bold">
                        <span>You will receive:</span>
                        <span>${(this.amount - parseFloat(document.getElementById('totalFee').textContent)).toFixed(6)} ${this.selectedAsset}</span>
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }

    hidePreview() {
        document.getElementById('previewModal').classList.add('hidden');
    }

    validateBridgeData() {
        return this.selectedSourceChain && 
               this.selectedTargetChain && 
               this.selectedAsset && 
               this.amount > 0 &&
               this.selectedSourceChain.id !== this.selectedTargetChain.id;
    }

    async executeBridge() {
        if (!this.validateBridgeData()) return;
        
        this.hidePreview();
        
        const bridgeButton = document.getElementById('bridgeButton');
        bridgeButton.disabled = true;
        bridgeButton.innerHTML = '<div class="loading-spinner inline-block w-4 h-4 mr-2"></div> Processing...';
        
        try {
            // Create transfer
            const transfer = {
                id: Date.now().toString(),
                sourceChain: this.selectedSourceChain.id,
                targetChain: this.selectedTargetChain.id,
                asset: this.selectedAsset,
                amount: this.amount,
                status: 'pending',
                timestamp: new Date().toISOString(),
                userId: this.currentUser?.id || 'guest'
            };
            
            // Add to transfers
            this.transfers.unshift(transfer);
            this.updateTransferHistory();
            
            // Emit to server
            if (this.socket && this.socket.connected) {
                this.socket.emit('initiateTransfer', transfer);
            }
            
            // Show success message
            this.showSuccess('Transfer initiated successfully!');
            
            // Reset form
            this.resetForm();
            
        } catch (error) {
            console.error('Bridge execution failed:', error);
            this.showError('Failed to execute bridge transfer');
        } finally {
            bridgeButton.disabled = false;
            bridgeButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Bridge Assets';
        }
    }

    resetForm() {
        document.getElementById('amountInput').value = '';
        document.getElementById('assetSelect').value = '';
        this.amount = 0;
        this.selectedAsset = null;
        this.validateBridge();
    }

    async loadBridgeStatus() {
        try {
            // Mock bridge status (in real implementation, this would fetch from API)
            this.bridgeStatus = {
                isConnected: true,
                supportedChains: Object.keys(this.chains),
                totalVolume24h: 1500000,
                activeTransfers: 42
            };
            
            this.updateBridgeStatus();
        } catch (error) {
            console.error('Failed to load bridge status:', error);
        }
    }

    updateBridgeStatus() {
        const statusContainer = document.getElementById('bridgeStatus');
        if (!statusContainer) return;
        
        statusContainer.innerHTML = `
            <div class="text-center p-4 bg-white/5 rounded-lg border border-white/20">
                <div class="text-2xl font-bold text-purple-500">${this.bridgeStatus.supportedChains.length}</div>
                <div class="text-sm text-gray-400">Supported Chains</div>
            </div>
            <div class="text-center p-4 bg-white/5 rounded-lg border border-white/20">
                <div class="text-2xl font-bold text-blue-500">$${(this.bridgeStatus.totalVolume24h / 1000000).toFixed(1)}M</div>
                <div class="text-sm text-gray-400">24h Volume</div>
            </div>
            <div class="text-center p-4 bg-white/5 rounded-lg border border-white/20">
                <div class="text-2xl font-bold text-green-500">${this.bridgeStatus.activeTransfers}</div>
                <div class="text-sm text-gray-400">Active Transfers</div>
            </div>
        `;
    }

    async loadTransferHistory() {
        try {
            // Mock transfer history (in real implementation, this would fetch from API)
            this.transfers = [
                {
                    id: '1',
                    sourceChain: 'stellar',
                    targetChain: 'ethereum',
                    asset: 'USDC',
                    amount: 500,
                    status: 'completed',
                    timestamp: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: '2',
                    sourceChain: 'ethereum',
                    targetChain: 'polygon',
                    asset: 'ETH',
                    amount: 1.5,
                    status: 'processing',
                    timestamp: new Date(Date.now() - 1800000).toISOString()
                },
                {
                    id: '3',
                    sourceChain: 'polygon',
                    targetChain: 'binance',
                    asset: 'USDT',
                    amount: 1000,
                    status: 'pending',
                    timestamp: new Date(Date.now() - 600000).toISOString()
                }
            ];
            
            this.updateTransferHistory();
        } catch (error) {
            console.error('Failed to load transfer history:', error);
        }
    }

    updateTransferHistory() {
        const historyContainer = document.getElementById('bridgeTransferHistory');
        if (!historyContainer) return;
        
        if (this.transfers.length === 0) {
            historyContainer.innerHTML = '<p class="text-center text-gray-500">No transfer history available</p>';
            return;
        }
        
        historyContainer.innerHTML = this.transfers.map(transfer => {
            const sourceChain = this.chains[transfer.sourceChain];
            const targetChain = this.chains[transfer.targetChain];
            const asset = this.assets[transfer.asset];
            
            return `
                <div class="transfer-item">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2">
                                <i class="${sourceChain.icon}" style="color: ${sourceChain.color};"></i>
                                <i class="fas fa-arrow-right text-gray-400"></i>
                                <i class="${targetChain.icon}" style="color: ${targetChain.color};"></i>
                            </div>
                            <div>
                                <div class="font-medium">${transfer.amount} ${transfer.asset}</div>
                                <div class="text-sm text-gray-500">${sourceChain.name} → ${targetChain.name}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="status-badge status-${transfer.status}">
                                <i class="fas fa-${this.getStatusIcon(transfer.status)}"></i>
                                ${transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                            </span>
                        </div>
                    </div>
                    <div class="text-sm text-gray-500">
                        ${new Date(transfer.timestamp).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusIcon(status) {
        const icons = {
            pending: 'clock',
            processing: 'spinner fa-spin',
            completed: 'check-circle',
            failed: 'exclamation-circle'
        };
        return icons[status] || 'question-circle';
    }

    handleTransferInitiated(data) {
        console.log('Transfer initiated:', data);
        this.showSuccess('Transfer initiated successfully!');
    }

    handleTransferUpdated(data) {
        console.log('Transfer updated:', data);
        const transfer = this.transfers.find(t => t.id === data.id);
        if (transfer) {
            Object.assign(transfer, data);
            this.updateTransferHistory();
        }
    }

    handleTransferCompleted(data) {
        console.log('Transfer completed:', data);
        const transfer = this.transfers.find(t => t.id === data.id);
        if (transfer) {
            Object.assign(transfer, data);
            this.updateTransferHistory();
            this.showSuccess('Transfer completed successfully!');
        }
    }

    startRealTimeUpdates() {
        // Update bridge status every 30 seconds
        setInterval(() => {
            this.loadBridgeStatus();
        }, 30000);
        
        // Update transfer history every 10 seconds
        setInterval(() => {
            this.loadTransferHistory();
        }, 10000);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-${
                    type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    'info-circle'
                }"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize the bridge when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CrossChainBridge();
});
