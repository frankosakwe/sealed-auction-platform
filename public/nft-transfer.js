// NFT Transfer System
class NFTTransfer {
    constructor() {
        this.currentTransfer = null;
        this.transferQueue = [];
        this.isProcessing = false;
        this.supportedBlockchains = ['stellar', 'ethereum', 'polygon', 'bsc'];
        this.transferTypes = ['sale', 'gift', 'auction', 'burn'];
        
        this.initializeEventListeners();
        this.loadTransferHistory();
    }

    initializeEventListeners() {
        // Transfer form
        const transferForm = document.getElementById('transferForm');
        if (transferForm) {
            transferForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTransferRequest(e);
            });
        }

        // Recipient address validation
        const recipientInput = document.getElementById('recipientAddress');
        if (recipientInput) {
            recipientInput.addEventListener('input', (e) => {
                this.validateRecipientAddress(e.target.value);
            });

            recipientInput.addEventListener('blur', (e) => {
                this.lookupRecipient(e.target.value);
            });
        }

        // Transfer type selection
        document.querySelectorAll('[data-transfer-type]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateTransferUI(e.target.value);
            });
        });

        // Blockchain selection
        const blockchainSelect = document.getElementById('transferBlockchain');
        if (blockchainSelect) {
            blockchainSelect.addEventListener('change', (e) => {
                this.updateBlockchainUI(e.target.value);
            });
        }

        // Gas estimation
        const estimateGasBtn = document.getElementById('estimateGasBtn');
        if (estimateGasBtn) {
            estimateGasBtn.addEventListener('click', () => {
                this.estimateGasCost();
            });
        }

        // Quick transfer buttons
        document.querySelectorAll('[data-quick-transfer]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nftId = e.target.dataset.nftId;
                const recipient = e.target.dataset.recipient;
                this.initiateQuickTransfer(nftId, recipient);
            });
        });
    }

    async handleTransferRequest(event) {
        const formData = new FormData(event.target);
        const transferData = {
            nft_id: formData.get('nft_id'),
            recipient_address: formData.get('recipient_address'),
            transfer_type: formData.get('transfer_type'),
            blockchain: formData.get('blockchain'),
            gas_price: formData.get('gas_price'),
            message: formData.get('message')
        };

        try {
            this.showLoading(true);
            
            // Validate transfer request
            const validation = this.validateTransferRequest(transferData);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            // Verify ownership
            const ownershipVerified = await this.verifyOwnership(transferData.nft_id);
            if (!ownershipVerified) {
                throw new Error('You do not own this NFT');
            }

            // Get gas estimate
            const gasEstimate = await this.getGasEstimate(transferData);
            transferData.gas_cost = gasEstimate.cost;
            transferData.estimated_time = gasEstimate.time;

            // Show confirmation dialog
            const confirmed = await this.showTransferConfirmation(transferData);
            if (!confirmed) {
                return;
            }

            // Execute transfer
            const transfer = await this.executeTransfer(transferData);
            this.currentTransfer = transfer;

            // Update UI
            this.updateTransferUI(transfer);
            this.showNotification('Transfer initiated successfully', 'success');

            // Start monitoring transfer progress
            this.monitorTransferProgress(transfer.id);

        } catch (error) {
            console.error('Transfer request error:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateTransferRequest(data) {
        const errors = [];

        if (!data.nft_id) {
            errors.push('NFT ID is required');
        }

        if (!data.recipient_address) {
            errors.push('Recipient address is required');
        } else if (!this.isValidAddress(data.recipient_address)) {
            errors.push('Invalid recipient address');
        }

        if (!data.transfer_type) {
            errors.push('Transfer type is required');
        } else if (!this.transferTypes.includes(data.transfer_type)) {
            errors.push('Invalid transfer type');
        }

        if (!data.blockchain) {
            errors.push('Blockchain is required');
        } else if (!this.supportedBlockchains.includes(data.blockchain)) {
            errors.push('Unsupported blockchain');
        }

        // Additional validation for different transfer types
        if (data.transfer_type === 'sale' && !data.gas_price) {
            errors.push('Gas price is required for sale transfers');
        }

        if (data.transfer_type === 'auction') {
            errors.push('Auction transfers must be processed through the auction system');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    isValidAddress(address) {
        // Basic address validation - in production, use proper validation for each blockchain
        const addressPatterns = {
            stellar: /^G[A-Z0-9]{55}$/,
            ethereum: /^0x[a-fA-F0-9]{40}$/,
            polygon: /^0x[a-fA-F0-9]{40}$/,
            bsc: /^0x[a-fA-F0-9]{40}$/
        };

        // Check if address matches any supported pattern
        return Object.values(addressPatterns).some(pattern => pattern.test(address));
    }

    async verifyOwnership(nftId) {
        try {
            const response = await fetch(`/api/nft/${nftId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch NFT details');
            }

            const nft = await response.json();
            return nft.is_owner || false;
        } catch (error) {
            console.error('Ownership verification error:', error);
            return false;
        }
    }

    async getGasEstimate(transferData) {
        try {
            // Simulate gas estimation
            await new Promise(resolve => setTimeout(resolve, 1000));

            // In a real implementation, this would query the actual blockchain
            const baseGasCost = {
                stellar: 0.00001,
                ethereum: 0.002,
                polygon: 0.0001,
                bsc: 0.0005
            };

            const complexityMultiplier = {
                gift: 1.0,
                sale: 1.2,
                burn: 0.8,
                auction: 1.5
            };

            const baseCost = baseGasCost[transferData.blockchain] || 0.001;
            const multiplier = complexityMultiplier[transferData.transfer_type] || 1.0;
            const cost = baseCost * multiplier;

            return {
                cost: cost.toFixed(6),
                time: Math.floor(Math.random() * 30) + 10, // 10-40 seconds
                gasUnits: Math.floor(Math.random() * 50000) + 21000
            };
        } catch (error) {
            console.error('Gas estimation error:', error);
            throw error;
        }
    }

    async showTransferConfirmation(transferData) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'transfer-confirmation-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Confirm Transfer</h3>
                    <div class="transfer-details">
                        <div class="detail-row">
                            <span>NFT:</span>
                            <span id="confirmNftName">Loading...</span>
                        </div>
                        <div class="detail-row">
                            <span>Recipient:</span>
                            <span>${transferData.recipient_address}</span>
                        </div>
                        <div class="detail-row">
                            <span>Type:</span>
                            <span class="capitalize">${transferData.transfer_type}</span>
                        </div>
                        <div class="detail-row">
                            <span>Blockchain:</span>
                            <span class="capitalize">${transferData.blockchain}</span>
                        </div>
                        <div class="detail-row">
                            <span>Gas Cost:</span>
                            <span>${transferData.gas_cost} ETH</span>
                        </div>
                        <div class="detail-row">
                            <span>Est. Time:</span>
                            <span>${transferData.estimated_time}s</span>
                        </div>
                        ${transferData.message ? `
                        <div class="detail-row">
                            <span>Message:</span>
                            <span>${transferData.message}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-actions">
                        <button id="cancelTransfer" class="btn-secondary">Cancel</button>
                        <button id="confirmTransfer" class="btn-primary">Confirm Transfer</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Load NFT details
            this.loadNFTDetails(transferData.nft_id);

            // Event listeners
            document.getElementById('cancelTransfer').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.getElementById('confirmTransfer').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    async loadNFTDetails(nftId) {
        try {
            const response = await fetch(`/api/nft/${nftId}`);
            if (response.ok) {
                const nft = await response.json();
                const nameElement = document.getElementById('confirmNftName');
                if (nameElement) {
                    nameElement.textContent = nft.name;
                }
            }
        } catch (error) {
            console.error('Error loading NFT details:', error);
        }
    }

    async executeTransfer(transferData) {
        try {
            const response = await fetch(`/api/nft/${transferData.nft_id}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    to_address: transferData.recipient_address,
                    transfer_type: transferData.transfer_type
                })
            });

            if (!response.ok) {
                throw new Error('Failed to execute transfer');
            }

            return await response.json();
        } catch (error) {
            console.error('Transfer execution error:', error);
            throw error;
        }
    }

    monitorTransferProgress(transferId) {
        const checkProgress = async () => {
            try {
                const response = await fetch(`/api/transfer/${transferId}/status`);
                if (response.ok) {
                    const status = await response.json();
                    this.updateTransferProgress(status);

                    if (status.status === 'completed') {
                        this.showNotification('Transfer completed successfully!', 'success');
                        this.loadTransferHistory(); // Refresh history
                    } else if (status.status === 'failed') {
                        this.showNotification('Transfer failed: ' + status.error, 'error');
                    } else if (status.status === 'pending') {
                        // Continue monitoring
                        setTimeout(checkProgress, 5000);
                    }
                }
            } catch (error) {
                console.error('Error monitoring transfer progress:', error);
            }
        };

        checkProgress();
    }

    updateTransferProgress(status) {
        const progressElement = document.getElementById('transferProgress');
        if (progressElement) {
            const progressMap = {
                'pending': 25,
                'processing': 50,
                'confirming': 75,
                'completed': 100,
                'failed': 0
            };

            const progress = progressMap[status.status] || 0;
            progressElement.style.width = `${progress}%`;
            progressElement.setAttribute('aria-valuenow', progress);
        }

        const statusElement = document.getElementById('transferStatus');
        if (statusElement) {
            statusElement.textContent = status.status;
            statusElement.className = `transfer-status status-${status.status}`;
        }
    }

    async validateRecipientAddress(address) {
        const validationElement = document.getElementById('addressValidation');
        if (!validationElement) return;

        if (!address) {
            validationElement.textContent = '';
            validationElement.className = '';
            return;
        }

        if (this.isValidAddress(address)) {
            validationElement.textContent = '✓ Valid address';
            validationElement.className = 'address-valid';
        } else {
            validationElement.textContent = '✗ Invalid address format';
            validationElement.className = 'address-invalid';
        }
    }

    async lookupRecipient(address) {
        const recipientElement = document.getElementById('recipientInfo');
        if (!recipientElement || !this.isValidAddress(address)) {
            if (recipientElement) {
                recipientElement.innerHTML = '';
            }
            return;
        }

        try {
            recipientElement.innerHTML = '<div class="loading">Looking up recipient...</div>';

            // Simulate API call to lookup recipient
            await new Promise(resolve => setTimeout(resolve, 1000));

            // In a real implementation, this would query the user database
            const recipient = {
                username: `user_${address.substr(0, 8)}`,
                avatar: '/icons/icon-32x32.png',
                reputation: Math.floor(Math.random() * 100),
                verified: Math.random() > 0.5
            };

            recipientElement.innerHTML = `
                <div class="recipient-info">
                    <img src="${recipient.avatar}" alt="${recipient.username}" class="recipient-avatar">
                    <div class="recipient-details">
                        <div class="recipient-name">
                            ${recipient.username}
                            ${recipient.verified ? '<i class="fas fa-check-circle verified"></i>' : ''}
                        </div>
                        <div class="recipient-reputation">Reputation: ${recipient.reputation}/100</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error looking up recipient:', error);
            recipientElement.innerHTML = '<div class="error">Failed to lookup recipient</div>';
        }
    }

    updateTransferUI(transferType) {
        // Update UI based on transfer type
        const priceField = document.getElementById('priceField');
        const messageField = document.getElementById('messageField');
        const gasField = document.getElementById('gasField');

        switch (transferType) {
            case 'sale':
                if (priceField) priceField.style.display = 'block';
                if (messageField) messageField.style.display = 'none';
                if (gasField) gasField.style.display = 'block';
                break;
            case 'gift':
                if (priceField) priceField.style.display = 'none';
                if (messageField) messageField.style.display = 'block';
                if (gasField) gasField.style.display = 'block';
                break;
            case 'burn':
                if (priceField) priceField.style.display = 'none';
                if (messageField) messageField.style.display = 'none';
                if (gasField) gasField.style.display = 'block';
                break;
            default:
                if (priceField) priceField.style.display = 'none';
                if (messageField) messageField.style.display = 'none';
                if (gasField) gasField.style.display = 'block';
        }
    }

    updateBlockchainUI(blockchain) {
        // Update blockchain-specific UI
        const blockchainInfo = document.getElementById('blockchainTransferInfo');
        if (blockchainInfo) {
            const info = this.getBlockchainInfo(blockchain);
            blockchainInfo.innerHTML = `
                <div class="blockchain-transfer-details">
                    <h4>${info.name} Network</h4>
                    <div class="transfer-stats">
                        <span>Est. Time: ${info.transferTime}</span>
                        <span>Min Gas: ${info.minGas}</span>
                        <span>Confirmations: ${info.confirmations}</span>
                    </div>
                </div>
            `;
        }
    }

    getBlockchainInfo(blockchain) {
        const info = {
            stellar: {
                name: 'Stellar',
                transferTime: '3-5 seconds',
                minGas: '0.00001 XLM',
                confirmations: '1'
            },
            ethereum: {
                name: 'Ethereum',
                transferTime: '12-15 minutes',
                minGas: '0.002 ETH',
                confirmations: '12'
            },
            polygon: {
                name: 'Polygon',
                transferTime: '2-3 minutes',
                minGas: '0.0001 MATIC',
                confirmations: '5'
            },
            bsc: {
                name: 'BSC',
                transferTime: '3-5 minutes',
                minGas: '0.0005 BNB',
                confirmations: '3'
            }
        };

        return info[blockchain] || info.stellar;
    }

    async estimateGasCost() {
        const nftId = document.getElementById('transferNftId')?.value;
        const blockchain = document.getElementById('transferBlockchain')?.value;
        const transferType = document.querySelector('[name="transfer_type"]:checked')?.value;

        if (!nftId || !blockchain || !transferType) {
            this.showNotification('Please fill in all transfer details', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            const transferData = { nft_id: nftId, blockchain, transfer_type: transferType };
            const estimate = await this.getGasEstimate(transferData);

            // Update UI with estimate
            const gasCostElement = document.getElementById('gasCostEstimate');
            if (gasCostElement) {
                gasCostElement.textContent = `${estimate.cost} ETH`;
            }

            const gasTimeElement = document.getElementById('gasTimeEstimate');
            if (gasTimeElement) {
                gasTimeElement.textContent = `${estimate.time} seconds`;
            }

            this.showNotification('Gas estimate updated', 'success');
        } catch (error) {
            console.error('Gas estimation error:', error);
            this.showNotification('Failed to estimate gas cost', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async initiateQuickTransfer(nftId, recipient) {
        try {
            // Pre-fill transfer form
            document.getElementById('transferNftId').value = nftId;
            document.getElementById('recipientAddress').value = recipient;
            
            // Validate and lookup recipient
            await this.validateRecipientAddress(recipient);
            await this.lookupRecipient(recipient);

            // Show transfer modal
            const modal = document.getElementById('transferModal');
            if (modal) {
                modal.style.display = 'block';
            }

            // Scroll to transfer form
            const transferForm = document.getElementById('transferForm');
            if (transferForm) {
                transferForm.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Quick transfer error:', error);
            this.showNotification('Failed to initiate quick transfer', 'error');
        }
    }

    async loadTransferHistory() {
        try {
            const response = await fetch('/api/user/transfer-history', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load transfer history');
            }

            const transfers = await response.json();
            this.renderTransferHistory(transfers);
        } catch (error) {
            console.error('Error loading transfer history:', error);
        }
    }

    renderTransferHistory(transfers) {
        const historyElement = document.getElementById('transferHistory');
        if (!historyElement) return;

        if (transfers.length === 0) {
            historyElement.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-exchange-alt"></i>
                    <p>No transfer history found</p>
                </div>
            `;
            return;
        }

        historyElement.innerHTML = transfers.map(transfer => `
            <div class="transfer-item ${transfer.status}">
                <div class="transfer-icon">
                    <i class="fas fa-${this.getTransferIcon(transfer.transfer_type)}"></i>
                </div>
                <div class="transfer-details">
                    <div class="transfer-nft">${transfer.nft_name}</div>
                    <div class="transfer-info">
                        <span class="transfer-type capitalize">${transfer.transfer_type}</span>
                        <span class="transfer-date">${new Date(transfer.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="transfer-address">
                        To: ${this.truncateAddress(transfer.to_address)}
                    </div>
                </div>
                <div class="transfer-status">
                    <span class="status-badge status-${transfer.status}">${transfer.status}</span>
                    ${transfer.transaction_hash ? `
                    <a href="${this.getBlockchainExplorer(transfer.blockchain, transfer.transaction_hash)}" 
                       target="_blank" 
                       class="explorer-link">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    getTransferIcon(type) {
        const icons = {
            sale: 'shopping-cart',
            gift: 'gift',
            auction: 'gavel',
            burn: 'fire'
        };
        return icons[type] || 'exchange-alt';
    }

    truncateAddress(address) {
        if (!address) return '';
        return `${address.substr(0, 6)}...${address.substr(-4)}`;
    }

    getBlockchainExplorer(blockchain, txHash) {
        const explorers = {
            stellar: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
            ethereum: `https://etherscan.io/tx/${txHash}`,
            polygon: `https://polygonscan.com/tx/${txHash}`,
            bsc: `https://bscscan.com/tx/${txHash}`
        };

        return explorers[blockchain] || '#';
    }

    showLoading(show) {
        const loadingElement = document.getElementById('transferLoading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || '';
    }

    // Public methods
    async transferNFT(nftId, recipientAddress, transferType = 'gift') {
        const transferData = {
            nft_id: nftId,
            recipient_address: recipientAddress,
            transfer_type: transferType,
            blockchain: 'stellar' // Default blockchain
        };

        return await this.handleTransferRequest(transferData);
    }

    async getTransferStatus(transferId) {
        try {
            const response = await fetch(`/api/transfer/${transferId}/status`);
            if (!response.ok) {
                throw new Error('Failed to get transfer status');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting transfer status:', error);
            throw error;
        }
    }
}

// Initialize transfer system
let nftTransfer;
document.addEventListener('DOMContentLoaded', () => {
    nftTransfer = new NFTTransfer();
});
