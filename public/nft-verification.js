// NFT Ownership Verification System
class NFTVerification {
    constructor() {
        this.currentVerification = null;
        this.verificationQueue = [];
        this.isProcessing = false;
        this.supportedBlockchains = ['stellar', 'ethereum', 'polygon', 'bsc'];
        this.verificationTypes = ['ownership', 'authenticity', 'provenance', 'rarity'];
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Verification request form
        const verificationForm = document.getElementById('verificationForm');
        if (verificationForm) {
            verificationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleVerificationRequest(e);
            });
        }

        // Auto-verification toggle
        const autoVerifyToggle = document.getElementById('autoVerifyToggle');
        if (autoVerifyToggle) {
            autoVerifyToggle.addEventListener('change', (e) => {
                this.toggleAutoVerification(e.target.checked);
            });
        }

        // Blockchain selection
        const blockchainSelect = document.getElementById('blockchainSelect');
        if (blockchainSelect) {
            blockchainSelect.addEventListener('change', (e) => {
                this.updateBlockchainUI(e.target.value);
            });
        }

        // Verification type tabs
        document.querySelectorAll('[data-verification-type]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchVerificationType(e.target.dataset.verificationType);
            });
        });
    }

    async handleVerificationRequest(event) {
        const formData = new FormData(event.target);
        const verificationData = {
            nft_id: formData.get('nft_id'),
            verification_type: formData.get('verification_type'),
            blockchain: formData.get('blockchain'),
            wallet_address: formData.get('wallet_address'),
            contract_address: formData.get('contract_address'),
            token_id: formData.get('token_id')
        };

        try {
            this.showLoading(true);
            
            // Validate input
            const validation = this.validateVerificationRequest(verificationData);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            // Create verification request
            const response = await fetch('/api/nft/:id/verify'.replace(':id', verificationData.nft_id), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    verification_type: verificationData.verification_type
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create verification request');
            }

            const verification = await response.json();
            this.currentVerification = verification;

            // Start verification process
            await this.startVerificationProcess(verification);

            // Update UI
            this.updateVerificationUI(verification);
            this.showNotification('Verification request submitted successfully', 'success');

        } catch (error) {
            console.error('Verification request error:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateVerificationRequest(data) {
        const errors = [];

        if (!data.nft_id) {
            errors.push('NFT ID is required');
        }

        if (!data.verification_type) {
            errors.push('Verification type is required');
        } else if (!this.verificationTypes.includes(data.verification_type)) {
            errors.push('Invalid verification type');
        }

        if (!data.blockchain) {
            errors.push('Blockchain is required');
        } else if (!this.supportedBlockchains.includes(data.blockchain)) {
            errors.push('Unsupported blockchain');
        }

        if (data.verification_type === 'ownership' && !data.wallet_address) {
            errors.push('Wallet address is required for ownership verification');
        }

        if (data.verification_type === 'authenticity' && !data.contract_address) {
            errors.push('Contract address is required for authenticity verification');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async startVerificationProcess(verification) {
        this.isProcessing = true;
        this.updateProcessingStatus('Initializing verification...');

        try {
            // Step 1: Validate blockchain connection
            this.updateProcessingStatus('Connecting to blockchain...');
            const blockchainConnected = await this.validateBlockchainConnection(verification.blockchain);
            
            if (!blockchainConnected) {
                throw new Error('Failed to connect to blockchain');
            }

            // Step 2: Fetch on-chain data
            this.updateProcessingStatus('Fetching on-chain data...');
            const onChainData = await this.fetchOnChainData(verification);

            // Step 3: Verify ownership
            if (verification.verification_type === 'ownership') {
                this.updateProcessingStatus('Verifying ownership...');
                const ownershipVerified = await this.verifyOwnership(verification, onChainData);
                
                if (ownershipVerified) {
                    await this.completeVerification(verification.id, 'verified', {
                        blockchain_signature: onChainData.signature,
                        verified_at: new Date().toISOString(),
                        owner_address: onChainData.owner
                    });
                } else {
                    await this.completeVerification(verification.id, 'rejected', {
                        reason: 'Ownership verification failed',
                        verified_at: new Date().toISOString()
                    });
                }
            }

            // Step 4: Verify authenticity
            if (verification.verification_type === 'authenticity') {
                this.updateProcessingStatus('Verifying authenticity...');
                const authenticityVerified = await this.verifyAuthenticity(verification, onChainData);
                
                if (authenticityVerified) {
                    await this.completeVerification(verification.id, 'verified', {
                        blockchain_signature: onChainData.signature,
                        verified_at: new Date().toISOString(),
                        contract_verified: true
                    });
                } else {
                    await this.completeVerification(verification.id, 'rejected', {
                        reason: 'Authenticity verification failed',
                        verified_at: new Date().toISOString()
                    });
                }
            }

            // Step 5: Verify provenance
            if (verification.verification_type === 'provenance') {
                this.updateProcessingStatus('Verifying provenance...');
                const provenanceVerified = await this.verifyProvenance(verification, onChainData);
                
                if (provenanceVerified) {
                    await this.completeVerification(verification.id, 'verified', {
                        blockchain_signature: onChainData.signature,
                        verified_at: new Date().toISOString(),
                        provenance_chain: provenanceVerified.chain
                    });
                } else {
                    await this.completeVerification(verification.id, 'rejected', {
                        reason: 'Provenance verification failed',
                        verified_at: new Date().toISOString()
                    });
                }
            }

            // Step 6: Verify rarity
            if (verification.verification_type === 'rarity') {
                this.updateProcessingStatus('Analyzing rarity...');
                const rarityAnalysis = await this.analyzeRarity(verification, onChainData);
                
                await this.completeVerification(verification.id, 'verified', {
                    blockchain_signature: onChainData.signature,
                    verified_at: new Date().toISOString(),
                    rarity_score: rarityAnalysis.score,
                    rarity_rank: rarityAnalysis.rank,
                    total_supply: rarityAnalysis.totalSupply
                });
            }

        } catch (error) {
            console.error('Verification process error:', error);
            await this.completeVerification(verification.id, 'rejected', {
                reason: error.message,
                verified_at: new Date().toISOString()
            });
        } finally {
            this.isProcessing = false;
            this.updateProcessingStatus('');
        }
    }

    async validateBlockchainConnection(blockchain) {
        try {
            // Simulate blockchain connection validation
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In a real implementation, this would connect to the actual blockchain
            const connectionStatus = {
                stellar: true,
                ethereum: true,
                polygon: true,
                bsc: true
            };
            
            return connectionStatus[blockchain] || false;
        } catch (error) {
            console.error('Blockchain connection error:', error);
            return false;
        }
    }

    async fetchOnChainData(verification) {
        try {
            // Simulate fetching on-chain data
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // In a real implementation, this would fetch actual blockchain data
            return {
                signature: '0x' + Math.random().toString(16).substr(2, 64),
                owner: '0x' + Math.random().toString(16).substr(2, 40),
                contract: verification.contract_address,
                tokenId: verification.token_id,
                metadata: {
                    name: 'Sample NFT',
                    description: 'A verified NFT',
                    attributes: []
                },
                transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                blockNumber: Math.floor(Math.random() * 1000000)
            };
        } catch (error) {
            console.error('Error fetching on-chain data:', error);
            throw error;
        }
    }

    async verifyOwnership(verification, onChainData) {
        try {
            // Simulate ownership verification
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In a real implementation, this would verify actual ownership on-chain
            const isOwner = Math.random() > 0.3; // 70% success rate for demo
            
            return isOwner;
        } catch (error) {
            console.error('Ownership verification error:', error);
            return false;
        }
    }

    async verifyAuthenticity(verification, onChainData) {
        try {
            // Simulate authenticity verification
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // In a real implementation, this would verify contract authenticity
            const isAuthentic = Math.random() > 0.2; // 80% success rate for demo
            
            return isAuthentic;
        } catch (error) {
            console.error('Authenticity verification error:', error);
            return false;
        }
    }

    async verifyProvenance(verification, onChainData) {
        try {
            // Simulate provenance verification
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // In a real implementation, this would trace the complete ownership history
            const provenanceChain = [
                {
                    owner: '0x' + Math.random().toString(16).substr(2, 40),
                    timestamp: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
                },
                {
                    owner: onChainData.owner,
                    timestamp: new Date().toISOString(),
                    transactionHash: onChainData.transactionHash
                }
            ];
            
            return {
                verified: true,
                chain: provenanceChain
            };
        } catch (error) {
            console.error('Provenance verification error:', error);
            return false;
        }
    }

    async analyzeRarity(verification, onChainData) {
        try {
            // Simulate rarity analysis
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // In a real implementation, this would analyze actual rarity data
            const totalSupply = Math.floor(Math.random() * 10000) + 1;
            const rank = Math.floor(Math.random() * totalSupply) + 1;
            const score = ((totalSupply - rank + 1) / totalSupply) * 100;
            
            return {
                score: Math.round(score),
                rank,
                totalSupply
            };
        } catch (error) {
            console.error('Rarity analysis error:', error);
            throw error;
        }
    }

    async completeVerification(verificationId, status, verificationData) {
        try {
            // Update verification status in database
            const response = await fetch(`/api/nft/verification/${verificationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    status,
                    verification_data: verificationData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update verification status');
            }

            // Update local state
            if (this.currentVerification && this.currentVerification.id === verificationId) {
                this.currentVerification.status = status;
                this.currentVerification.verification_data = verificationData;
            }

            // Show notification
            const message = status === 'verified' ? 
                'Verification completed successfully!' : 
                'Verification failed. Please check the details.';
            
            this.showNotification(message, status === 'verified' ? 'success' : 'error');

        } catch (error) {
            console.error('Error completing verification:', error);
            throw error;
        }
    }

    updateVerificationUI(verification) {
        // Update verification status display
        const statusElement = document.getElementById('verificationStatus');
        if (statusElement) {
            statusElement.textContent = verification.status;
            statusElement.className = `verification-status status-${verification.status}`;
        }

        // Update verification details
        const detailsElement = document.getElementById('verificationDetails');
        if (detailsElement && verification.verification_data) {
            detailsElement.innerHTML = this.renderVerificationDetails(verification);
        }

        // Update progress bar
        this.updateProgressBar(verification.status);
    }

    renderVerificationDetails(verification) {
        const data = verification.verification_data;
        
        if (!data) {
            return '<p>No verification data available</p>';
        }

        let html = '<div class="verification-details">';
        
        if (data.verified_at) {
            html += `
                <div class="detail-item">
                    <span class="label">Verified At:</span>
                    <span class="value">${new Date(data.verified_at).toLocaleString()}</span>
                </div>
            `;
        }

        if (data.blockchain_signature) {
            html += `
                <div class="detail-item">
                    <span class="label">Blockchain Signature:</span>
                    <span class="value signature">${data.blockchain_signature}</span>
                </div>
            `;
        }

        if (data.owner_address) {
            html += `
                <div class="detail-item">
                    <span class="label">Verified Owner:</span>
                    <span class="value address">${data.owner_address}</span>
                </div>
            `;
        }

        if (data.rarity_score) {
            html += `
                <div class="detail-item">
                    <span class="label">Rarity Score:</span>
                    <span class="value rarity">${data.rarity_score}/100</span>
                </div>
                <div class="detail-item">
                    <span class="label">Rank:</span>
                    <span class="value">#${data.rarity_rank} of ${data.total_supply}</span>
                </div>
            `;
        }

        if (data.provenance_chain) {
            html += `
                <div class="detail-item">
                    <span class="label">Provenance Chain:</span>
                    <div class="provenance-chain">
                        ${data.provenance_chain.map((item, index) => `
                            <div class="provenance-item">
                                <span class="step">${index + 1}</span>
                                <span class="owner">${item.owner}</span>
                                <span class="date">${new Date(item.timestamp).toLocaleDateString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (data.reason) {
            html += `
                <div class="detail-item error">
                    <span class="label">Rejection Reason:</span>
                    <span class="value">${data.reason}</span>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    updateProcessingStatus(status) {
        const statusElement = document.getElementById('processingStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.style.display = status ? 'block' : 'none';
        }

        // Update loading spinner
        const spinnerElement = document.getElementById('verificationSpinner');
        if (spinnerElement) {
            spinnerElement.style.display = status ? 'block' : 'none';
        }
    }

    updateProgressBar(status) {
        const progressBar = document.getElementById('verificationProgress');
        if (!progressBar) return;

        const progressMap = {
            'pending': 0,
            'processing': 50,
            'verified': 100,
            'rejected': 100
        };

        const progress = progressMap[status] || 0;
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }

    switchVerificationType(type) {
        // Update tab UI
        document.querySelectorAll('[data-verification-type]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.verificationType === type);
        });

        // Update form fields based on type
        this.updateFormFields(type);
    }

    updateFormFields(verificationType) {
        const walletField = document.getElementById('walletAddressField');
        const contractField = document.getElementById('contractAddressField');
        const tokenIdField = document.getElementById('tokenIdField');

        // Show/hide fields based on verification type
        if (walletField) {
            walletField.style.display = verificationType === 'ownership' ? 'block' : 'none';
        }

        if (contractField) {
            contractField.style.display = ['authenticity', 'provenance', 'rarity'].includes(verificationType) ? 'block' : 'none';
        }

        if (tokenIdField) {
            tokenIdField.style.display = ['authenticity', 'provenance', 'rarity'].includes(verificationType) ? 'block' : 'none';
        }
    }

    updateBlockchainUI(blockchain) {
        // Update blockchain-specific UI elements
        const blockchainInfo = document.getElementById('blockchainInfo');
        if (blockchainInfo) {
            const info = this.getBlockchainInfo(blockchain);
            blockchainInfo.innerHTML = `
                <div class="blockchain-details">
                    <h4>${info.name}</h4>
                    <p>${info.description}</p>
                    <div class="blockchain-stats">
                        <span>Network: ${info.network}</span>
                        <span>Block Time: ${info.blockTime}</span>
                    </div>
                </div>
            `;
        }
    }

    getBlockchainInfo(blockchain) {
        const info = {
            stellar: {
                name: 'Stellar',
                description: 'Fast, low-cost blockchain for digital assets',
                network: 'Testnet',
                blockTime: '3-5 seconds'
            },
            ethereum: {
                name: 'Ethereum',
                description: 'The original smart contract platform',
                network: 'Mainnet',
                blockTime: '12-15 seconds'
            },
            polygon: {
                name: 'Polygon',
                description: 'Fast, scalable Ethereum sidechain',
                network: 'Mainnet',
                blockTime: '2-3 seconds'
            },
            bsc: {
                name: 'Binance Smart Chain',
                description: 'EVM-compatible blockchain with low fees',
                network: 'Mainnet',
                blockTime: '3 seconds'
            }
        };

        return info[blockchain] || info.stellar;
    }

    toggleAutoVerification(enabled) {
        if (enabled) {
            this.startAutoVerification();
        } else {
            this.stopAutoVerification();
        }
    }

    startAutoVerification() {
        // Start automatic verification for pending requests
        this.processVerificationQueue();
    }

    stopAutoVerification() {
        // Stop automatic verification
        this.isProcessing = false;
    }

    async processVerificationQueue() {
        if (this.isProcessing || this.verificationQueue.length === 0) {
            return;
        }

        const verification = this.verificationQueue.shift();
        await this.startVerificationProcess(verification);

        // Process next item in queue
        setTimeout(() => this.processVerificationQueue(), 1000);
    }

    showLoading(show) {
        const loadingElement = document.getElementById('verificationLoading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    getAuthToken() {
        // Get authentication token from localStorage or cookie
        return localStorage.getItem('authToken') || '';
    }

    // Public methods for external use
    async verifyNFT(nftId, verificationType = 'ownership') {
        const verification = {
            nft_id: nftId,
            verification_type: verificationType
        };

        return await this.handleVerificationRequest(verification);
    }

    async getVerificationStatus(nftId) {
        try {
            const response = await fetch(`/api/nft/${nftId}/verification`);
            if (!response.ok) {
                throw new Error('Failed to fetch verification status');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching verification status:', error);
            throw error;
        }
    }
}

// Initialize verification system
let nftVerification;
document.addEventListener('DOMContentLoaded', () => {
    nftVerification = new NFTVerification();
});
