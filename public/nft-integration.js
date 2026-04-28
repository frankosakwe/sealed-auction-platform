// NFT Integration for Main Auction Interface
class NFTIntegration {
    constructor() {
        this.nftData = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        
        this.initializeNFTIntegration();
    }

    initializeNFTIntegration() {
        // Load NFT data when NFT tab is opened
        this.setupTabSwitching();
        this.loadNFTStats();
        this.loadNFTPreview();
        this.setupNFTEventListeners();
    }

    setupTabSwitching() {
        // Override the switchTab function to handle NFT tab
        const originalSwitchTab = window.switchTab;
        window.switchTab = (tabName) => {
            if (originalSwitchTab) {
                originalSwitchTab(tabName);
            }
            
            if (tabName === 'nft') {
                this.loadNFTStats();
                this.loadNFTPreview();
            }
        };
    }

    async loadNFTStats() {
        try {
            this.isLoading = true;
            this.updateNFTStatsUI({ loading: true });

            // Fetch NFT statistics
            const response = await fetch('/api/nft/market/stats');
            if (!response.ok) throw new Error('Failed to fetch NFT stats');

            const stats = await response.json();
            
            // Fetch user's NFT portfolio
            const portfolioResponse = await fetch('/api/user/nft/portfolio', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            let portfolioStats = { total_nfts: 0, total_value: 0 };
            if (portfolioResponse.ok) {
                const portfolio = await portfolioResponse.json();
                portfolioStats = portfolio.stats;
            }

            // Update UI with combined stats
            this.updateNFTStatsUI({
                totalNFTs: stats.total_nfts,
                collections: stats.total_collections,
                userNFTs: portfolioStats.total_nfts,
                totalValue: portfolioStats.total_value || stats.total_volume,
                loading: false
            });

        } catch (error) {
            console.error('Error loading NFT stats:', error);
            this.updateNFTStatsUI({ 
                loading: false, 
                error: 'Failed to load NFT statistics' 
            });
        } finally {
            this.isLoading = false;
        }
    }

    updateNFTStatsUI(stats) {
        const elements = {
            nftTotalCount: document.getElementById('nftTotalCount'),
            nftCollectionCount: document.getElementById('nftCollectionCount'),
            nftUserCount: document.getElementById('nftUserCount'),
            nftTotalValue: document.getElementById('nftTotalValue')
        };

        if (stats.loading) {
            Object.values(elements).forEach(el => {
                if (el) el.textContent = '...';
            });
            return;
        }

        if (stats.error) {
            Object.values(elements).forEach(el => {
                if (el) el.textContent = '0';
            });
            return;
        }

        if (elements.nftTotalCount) {
            elements.nftTotalCount.textContent = this.formatNumber(stats.totalNFTs);
        }
        
        if (elements.nftCollectionCount) {
            elements.nftCollectionCount.textContent = this.formatNumber(stats.collections);
        }
        
        if (elements.nftUserCount) {
            elements.nftUserCount.textContent = this.formatNumber(stats.userNFTs);
        }
        
        if (elements.nftTotalValue) {
            elements.nftTotalValue.textContent = this.formatPrice(stats.totalValue);
        }
    }

    async loadNFTPreview() {
        try {
            const grid = document.getElementById('nftPreviewGrid');
            if (!grid) return;

            grid.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i class="fas fa-spinner fa-spin text-2xl text-blue-400 mb-4"></i>
                    <p class="text-gray-400">Loading NFTs...</p>
                </div>
            `;

            // Fetch NFT collection (limited preview)
            const response = await fetch('/api/nft/collection?limit=6');
            if (!response.ok) throw new Error('Failed to fetch NFT collection');

            const data = await response.json();
            this.nftData = data.nfts || [];

            this.renderNFTPreview(this.nftData);

        } catch (error) {
            console.error('Error loading NFT preview:', error);
            const grid = document.getElementById('nftPreviewGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i class="fas fa-exclamation-triangle text-2xl text-red-400 mb-4"></i>
                        <p class="text-gray-400">Failed to load NFTs</p>
                    </div>
                `;
            }
        }
    }

    renderNFTPreview(nfts) {
        const grid = document.getElementById('nftPreviewGrid');
        if (!grid) return;

        if (nfts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i class="fas fa-image text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">No NFTs found</p>
                    <button onclick="window.location.href='nft-gallery.html'" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-plus mr-2"></i>Create Your First NFT
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = nfts.map(nft => this.createNFTPreviewCard(nft)).join('');
        this.addPreviewCardInteractions();
    }

    createNFTPreviewCard(nft) {
        const verificationBadge = this.getVerificationBadge(nft.verification_status);
        const priceDisplay = this.formatPrice(nft.current_price || nft.price);
        const isOwner = nft.is_owner;

        return `
            <div class="bg-white/10 rounded-lg overflow-hidden hover:bg-white/20 transition-all cursor-pointer nft-preview-card" 
                 data-nft-id="${nft.id}"
                 onclick="nftIntegration.viewNFTDetails('${nft.id}')">
                <div class="aspect-square bg-gray-800 relative overflow-hidden">
                    <img src="${nft.image_url || '/icons/icon-192x192.png'}" 
                         alt="${nft.name}" 
                         class="w-full h-full object-cover"
                         loading="lazy"
                         onerror="this.src='/icons/icon-192x192.png'">
                    
                    <!-- Overlay -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                        <div class="absolute bottom-2 left-2 right-2">
                            <div class="text-white text-sm font-semibold truncate">${nft.name}</div>
                            <div class="text-white/80 text-xs">${priceDisplay}</div>
                        </div>
                    </div>

                    <!-- Badges -->
                    <div class="absolute top-2 left-2">
                        ${verificationBadge}
                    </div>

                    <!-- Owner indicator -->
                    ${isOwner ? `
                    <div class="absolute top-2 right-2">
                        <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <i class="fas fa-crown text-white text-xs"></i>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="p-3">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-white font-semibold truncate flex-1">${nft.name}</h3>
                        <span class="text-blue-400 text-sm font-bold ml-2">${priceDisplay}</span>
                    </div>
                    
                    <div class="flex items-center justify-between text-xs text-gray-400">
                        <span class="truncate">${nft.collection_name || 'Unknown'}</span>
                        <span class="flex items-center">
                            <i class="fas fa-heart mr-1"></i>
                            ${nft.like_count || 0}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    getVerificationBadge(status) {
        if (!status || status === 'pending') {
            return '<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Pending</span>';
        }
        
        if (status === 'verified') {
            return '<span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center"><i class="fas fa-check-circle mr-1"></i>Verified</span>';
        }
        
        return '';
    }

    addPreviewCardInteractions() {
        const cards = document.querySelectorAll('.nft-preview-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    setupNFTEventListeners() {
        // Add global NFT functions
        window.filterNFTs = (filter) => {
            this.filterNFTs(filter);
        };

        window.nftIntegration = this; // Make instance globally accessible
    }

    filterNFTs(filter) {
        this.currentFilter = filter;
        
        // Update filter button styles
        const buttons = document.querySelectorAll('[onclick^="filterNFTs"]');
        buttons.forEach(btn => {
            const btnFilter = btn.getAttribute('onclick').match(/filterNFTs\('([^']+)'\)/)?.[1];
            if (btnFilter === filter) {
                btn.className = 'px-3 py-1 bg-blue-600 text-white rounded-full text-sm';
            } else {
                btn.className = 'px-3 py-1 bg-white/20 text-gray-300 rounded-full text-sm hover:bg-white/30';
            }
        });

        // Filter and re-render NFTs
        let filteredNFTs = [...this.nftData];
        
        switch (filter) {
            case 'verified':
                filteredNFTs = filteredNFTs.filter(nft => nft.verification_status === 'verified');
                break;
            case 'art':
            case 'gaming':
            case 'music':
                filteredNFTs = filteredNFTs.filter(nft => nft.category === filter);
                break;
            case 'owned':
                filteredNFTs = filteredNFTs.filter(nft => nft.is_owner);
                break;
        }

        this.renderNFTPreview(filteredNFTs);
    }

    viewNFTDetails(nftId) {
        // Open NFT details in a modal or navigate to full gallery
        if (window.nftDisplay) {
            window.nftDisplay.viewNFTDetails(nftId);
        } else {
            // Fallback: navigate to full gallery
            window.location.href = `nft-gallery.html#nft-${nftId}`;
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatPrice(price) {
        if (!price || price === 0) return 'Not Listed';
        
        if (price >= 1000000) {
            return `$${(price / 1000000).toFixed(1)}M`;
        }
        if (price >= 1000) {
            return `$${(price / 1000).toFixed(1)}K`;
        }
        return `$${price.toFixed(2)}`;
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || '';
    }

    // Public methods for external use
    async refreshNFTData() {
        await this.loadNFTStats();
        await this.loadNFTPreview();
    }

    async createNFT() {
        if (window.nftDisplay) {
            return window.nftDisplay.createNFT();
        } else {
            window.location.href = 'nft-gallery.html#create';
        }
    }

    async verifyNFT(nftId, type = 'ownership') {
        if (window.nftVerification) {
            return window.nftVerification.verifyNFT(nftId, type);
        } else {
            window.location.href = `nft-gallery.html#verify-${nftId}`;
        }
    }

    async transferNFT(nftId, recipient) {
        if (window.nftTransfer) {
            return window.nftTransfer.transferNFT(nftId, recipient);
        } else {
            window.location.href = `nft-gallery.html#transfer-${nftId}`;
        }
    }

    // Integration with auction system
    async createAuctionFromNFT(nftId) {
        try {
            // Get NFT details
            const response = await fetch(`/api/nft/${nftId}`);
            if (!response.ok) throw new Error('Failed to fetch NFT details');
            
            const nft = await response.json();
            
            // Verify ownership
            if (!nft.is_owner) {
                throw new Error('You do not own this NFT');
            }

            // Create auction with NFT data
            const auctionData = {
                title: `Auction for ${nft.name}`,
                description: `Auction for NFT: ${nft.description || nft.name}`,
                starting_bid: nft.current_price || 100, // Default starting bid
                nft_id: nftId,
                nft_data: {
                    name: nft.name,
                    image_url: nft.image_url,
                    collection_name: nft.collection_name,
                    verification_status: nft.verification_status
                }
            };

            // Switch to create auction tab and pre-fill form
            window.switchTab('create');
            
            // Pre-fill the create auction form
            setTimeout(() => {
                const form = document.getElementById('createAuctionForm');
                if (form) {
                    form.title.value = auctionData.title;
                    form.description.value = auctionData.description;
                    form.starting_bid.value = auctionData.starting_bid;
                    
                    // Store NFT data for later use
                    form.dataset.nftId = nftId;
                    form.dataset.nftData = JSON.stringify(auctionData.nft_data);
                }
            }, 100);

        } catch (error) {
            console.error('Error creating auction from NFT:', error);
            this.showNotification(error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white notification-${type}`;
        notification.textContent = message;

        // Set background color based on type
        const colors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };
        notification.classList.add(colors[type] || colors.info);

        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize NFT integration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for other scripts to load
    setTimeout(() => {
        new NFTIntegration();
    }, 1000);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NFTIntegration;
}
