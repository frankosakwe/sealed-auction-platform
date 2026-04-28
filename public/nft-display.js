// NFT Display and Management System
class NFTDisplay {
    constructor() {
        this.currentNFT = null;
        this.nftCollection = [];
        this.selectedNFTs = new Set();
        this.viewMode = 'grid'; // grid, list, detail
        this.sortBy = 'created_at';
        this.sortOrder = 'desc';
        this.filterCategory = 'all';
        this.priceRange = { min: 0, max: Infinity };
        this.verificationStatus = 'all';
        this.isLoading = false;
        this.currentPage = 1;
        this.itemsPerPage = 12;
        
        this.initializeEventListeners();
        this.loadNFTCollection();
    }

    initializeEventListeners() {
        // View mode toggles
        document.querySelectorAll('[data-nft-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.setViewMode(e.target.dataset.nftView);
            });
        });

        // Sort controls
        const sortSelect = document.getElementById('nftSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.setSorting(e.target.value);
            });
        }

        // Filter controls
        const filterCategory = document.getElementById('nftCategoryFilter');
        if (filterCategory) {
            filterCategory.addEventListener('change', (e) => {
                this.setFilter('category', e.target.value);
            });
        }

        const verificationFilter = document.getElementById('nftVerificationFilter');
        if (verificationFilter) {
            verificationFilter.addEventListener('change', (e) => {
                this.setFilter('verification', e.target.value);
            });
        }

        // Price range filter
        const priceRangeMin = document.getElementById('priceRangeMin');
        const priceRangeMax = document.getElementById('priceRangeMax');
        if (priceRangeMin && priceRangeMax) {
            const applyPriceFilter = () => {
                this.setFilter('price', {
                    min: parseFloat(priceRangeMin.value) || 0,
                    max: parseFloat(priceRangeMax.value) || Infinity
                });
            };
            
            priceRangeMin.addEventListener('change', applyPriceFilter);
            priceRangeMax.addEventListener('change', applyPriceFilter);
        }

        // Search functionality
        const searchInput = document.getElementById('nftSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchNFTs(e.target.value);
            }, 300));
        }

        // Infinite scroll
        window.addEventListener('scroll', () => {
            if (this.shouldLoadMore()) {
                this.loadMoreNFTs();
            }
        });
    }

    async loadNFTCollection() {
        this.setLoading(true);
        try {
            const response = await fetch('/api/nft/collection');
            if (!response.ok) throw new Error('Failed to load NFT collection');
            
            const data = await response.json();
            this.nftCollection = data.nfts || [];
            this.renderNFTGallery();
        } catch (error) {
            console.error('Error loading NFT collection:', error);
            this.showError('Failed to load NFT collection. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    async loadMoreNFTs() {
        if (this.isLoading || !this.hasMoreNFTs()) return;
        
        this.setLoading(true);
        try {
            const response = await fetch(`/api/nft/collection?page=${this.currentPage + 1}&limit=${this.itemsPerPage}`);
            if (!response.ok) throw new Error('Failed to load more NFTs');
            
            const data = await response.json();
            this.nftCollection = [...this.nftCollection, ...(data.nfts || [])];
            this.currentPage++;
            this.appendNFTs(data.nfts || []);
        } catch (error) {
            console.error('Error loading more NFTs:', error);
        } finally {
            this.setLoading(false);
        }
    }

    renderNFTGallery() {
        const container = document.getElementById('nftGallery');
        if (!container) return;

        const filteredNFTs = this.getFilteredNFTs();
        const sortedNFTs = this.getSortedNFTs(filteredNFTs);

        container.innerHTML = '';
        
        if (sortedNFTs.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-image text-6xl text-gray-300 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-600 mb-2">No NFTs Found</h3>
                    <p class="text-gray-500">Try adjusting your filters or search criteria.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        
        sortedNFTs.forEach(nft => {
            const nftElement = this.createNFTElement(nft);
            fragment.appendChild(nftElement);
        });

        container.appendChild(fragment);
        this.initializeTooltips();
    }

    appendNFTs(nfts) {
        const container = document.getElementById('nftGallery');
        if (!container) return;

        const fragment = document.createDocumentFragment();
        
        nfts.forEach(nft => {
            const nftElement = this.createNFTElement(nft);
            fragment.appendChild(nftElement);
        });

        container.appendChild(fragment);
        this.initializeTooltips();
    }

    createNFTElement(nft) {
        const div = document.createElement('div');
        div.className = 'nft-card group relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105';
        div.dataset.nftId = nft.id;

        const isSelected = this.selectedNFTs.has(nft.id);
        const verificationBadge = this.getVerificationBadge(nft.verification);
        const priceDisplay = this.formatPrice(nft.current_price || nft.price);
        const rarityIndicator = this.getRarityIndicator(nft.rarity_score);

        div.innerHTML = `
            <div class="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img src="${nft.image_url || '/icons/icon-192x192.png'}" 
                     alt="${nft.name}" 
                     class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                     loading="lazy"
                     onerror="this.src='/icons/icon-192x192.png'">
                
                <!-- Overlay Actions -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div class="flex space-x-2">
                        <button onclick="nftDisplay.viewNFTDetails('${nft.id}')" 
                                class="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
                            <i class="fas fa-eye text-gray-700"></i>
                        </button>
                        <button onclick="nftDisplay.toggleSelection('${nft.id}')" 
                                class="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
                            <i class="fas fa-${isSelected ? 'check-square' : 'square'} text-gray-700"></i>
                        </button>
                        ${nft.is_owner ? `
                        <button onclick="nftDisplay.listForSale('${nft.id}')" 
                                class="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors">
                            <i class="fas fa-tag text-white"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Badges -->
                <div class="absolute top-2 left-2 flex flex-col space-y-1">
                    ${verificationBadge}
                    ${rarityIndicator}
                </div>

                <!-- Selection Indicator -->
                ${isSelected ? `
                <div class="absolute top-2 right-2">
                    <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-check text-white text-xs"></i>
                    </div>
                </div>
                ` : ''}
            </div>

            <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-semibold text-gray-900 dark:text-white truncate flex-1">${nft.name}</h3>
                    <span class="ml-2 text-sm font-bold text-blue-600 dark:text-blue-400">${priceDisplay}</span>
                </div>
                
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">${nft.description || 'No description available'}</p>
                
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                    <span class="flex items-center">
                        <i class="fas fa-cube mr-1"></i>
                        ${nft.collection_name || 'Unknown Collection'}
                    </span>
                    <span class="flex items-center">
                        <i class="fas fa-heart mr-1"></i>
                        ${nft.like_count || 0}
                    </span>
                </div>

                <!-- Owner Info -->
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex items-center">
                        <img src="${nft.owner_avatar || '/icons/icon-32x32.png'}" 
                             alt="${nft.owner_username}" 
                             class="w-6 h-6 rounded-full mr-2">
                        <span class="text-xs text-gray-600 dark:text-gray-400">
                            ${nft.is_owner ? 'You' : nft.owner_username}
                        </span>
                    </div>
                </div>
            </div>
        `;

        return div;
    }

    getVerificationBadge(verification) {
        if (!verification || verification.status === 'pending') {
            return '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>';
        }
        
        if (verification.status === 'verified') {
            return '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center"><i class="fas fa-check-circle mr-1"></i>Verified</span>';
        }
        
        if (verification.status === 'rejected') {
            return '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Rejected</span>';
        }
        
        return '';
    }

    getRarityIndicator(rarityScore) {
        if (!rarityScore) return '';
        
        let rarity, color;
        if (rarityScore >= 90) {
            rarity = 'Legendary';
            color = 'purple';
        } else if (rarityScore >= 75) {
            rarity = 'Epic';
            color = 'blue';
        } else if (rarityScore >= 50) {
            rarity = 'Rare';
            color = 'green';
        } else {
            rarity = 'Common';
            color = 'gray';
        }
        
        return `<span class="px-2 py-1 bg-${color}-100 text-${color}-800 text-xs rounded-full">${rarity}</span>`;
    }

    formatPrice(price) {
        if (!price) return 'Not Listed';
        
        if (price >= 1000) {
            return `$${(price / 1000).toFixed(1)}K`;
        }
        
        return `$${price.toFixed(2)}`;
    }

    async viewNFTDetails(nftId) {
        const nft = this.nftCollection.find(n => n.id === nftId);
        if (!nft) return;

        this.currentNFT = nft;
        this.showNFTModal(nft);
    }

    showNFTModal(nft) {
        const modal = document.getElementById('nftModal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="grid md:grid-cols-2 gap-6 p-6">
                        <!-- Image Section -->
                        <div class="space-y-4">
                            <div class="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                                <img src="${nft.image_url || '/icons/icon-192x192.png'}" 
                                     alt="${nft.name}" 
                                     class="w-full h-full object-cover"
                                     onerror="this.src='/icons/icon-192x192.png'">
                                
                                <!-- Action Buttons Overlay -->
                                <div class="absolute top-4 right-4 flex space-x-2">
                                    <button onclick="nftDisplay.toggleLike('${nft.id}')" 
                                            class="p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow">
                                        <i class="fas fa-heart text-red-500"></i>
                                    </button>
                                    <button onclick="nftDisplay.shareNFT('${nft.id}')" 
                                            class="p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow">
                                        <i class="fas fa-share-alt text-gray-600"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Media Controls -->
                            ${nft.animation_url ? `
                            <div class="flex justify-center space-x-4">
                                <button onclick="nftDisplay.playAnimation('${nft.id}')" 
                                        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                    <i class="fas fa-play mr-2"></i>Play Animation
                                </button>
                            </div>
                            ` : ''}
                        </div>

                        <!-- Details Section -->
                        <div class="space-y-6">
                            <!-- Header -->
                            <div>
                                <div class="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">${nft.name}</h2>
                                        <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                            <span class="flex items-center">
                                                <i class="fas fa-cube mr-1"></i>
                                                ${nft.collection_name || 'Unknown Collection'}
                                            </span>
                                            <span class="flex items-center">
                                                <i class="fas fa-hashtag mr-1"></i>
                                                #${nft.token_id || '0'}
                                            </span>
                                        </div>
                                    </div>
                                    ${this.getVerificationBadge(nft.verification)}
                                </div>

                                <!-- Price -->
                                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <div class="flex justify-between items-center">
                                        <span class="text-sm text-gray-600 dark:text-gray-400">Current Price</span>
                                        <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                            ${this.formatPrice(nft.current_price || nft.price)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Description -->
                            <div>
                                <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                                <p class="text-gray-600 dark:text-gray-400">${nft.description || 'No description available'}</p>
                            </div>

                            <!-- Properties/Attributes -->
                            ${nft.attributes ? `
                            <div>
                                <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Properties</h3>
                                <div class="grid grid-cols-2 gap-2">
                                    ${JSON.parse(nft.attributes).map(attr => `
                                        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                            <div class="text-xs text-gray-500 dark:text-gray-400">${attr.trait_type}</div>
                                            <div class="font-semibold text-gray-900 dark:text-white">${attr.value}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}

                            <!-- Ownership Info -->
                            <div>
                                <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Ownership</h3>
                                <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <div class="flex items-center">
                                        <img src="${nft.owner_avatar || '/icons/icon-32x32.png'}" 
                                             alt="${nft.owner_username}" 
                                             class="w-10 h-10 rounded-full mr-3">
                                        <div>
                                            <div class="font-semibold text-gray-900 dark:text-white">
                                                ${nft.is_owner ? 'You' : nft.owner_username}
                                            </div>
                                            <div class="text-sm text-gray-600 dark:text-gray-400">Owner</div>
                                        </div>
                                    </div>
                                    ${!nft.is_owner ? `
                                    <button onclick="nftDisplay.makeOffer('${nft.id}')" 
                                            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                        Make Offer
                                    </button>
                                    ` : `
                                    <button onclick="nftDisplay.transferNFT('${nft.id}')" 
                                            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                                        Transfer
                                    </button>
                                    `}
                                </div>
                            </div>

                            <!-- Transaction History -->
                            <div>
                                <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Transaction History</h3>
                                <div class="space-y-2" id="transactionHistory">
                                    <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                        <i class="fas fa-spinner fa-spin"></i> Loading...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Close Button -->
                    <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
                        <button onclick="nftDisplay.closeNFTModal()" 
                                class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.loadTransactionHistory(nft.id);
    }

    async loadTransactionHistory(nftId) {
        try {
            const response = await fetch(`/api/nft/${nftId}/transactions`);
            if (!response.ok) throw new Error('Failed to load transaction history');
            
            const transactions = await response.json();
            this.renderTransactionHistory(transactions);
        } catch (error) {
            console.error('Error loading transaction history:', error);
            document.getElementById('transactionHistory').innerHTML = `
                <div class="text-center py-4 text-red-500">
                    Failed to load transaction history
                </div>
            `;
        }
    }

    renderTransactionHistory(transactions) {
        const container = document.getElementById('transactionHistory');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                    No transactions found
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(tx => `
            <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
                        <i class="fas fa-${this.getTransactionIcon(tx.transfer_type)} text-blue-600 dark:text-blue-400 text-xs"></i>
                    </div>
                    <div>
                        <div class="font-semibold text-gray-900 dark:text-white capitalize">${tx.transfer_type}</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                            ${new Date(tx.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-semibold text-gray-900 dark:text-white">
                        ${tx.price ? this.formatPrice(tx.price) : 'N/A'}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        ${tx.from_owner_username || 'System'} → ${tx.to_owner_username}
                    </div>
                </div>
            </div>
        `).join('');
    }

    getTransactionIcon(type) {
        const icons = {
            sale: 'shopping-cart',
            gift: 'gift',
            auction: 'gavel',
            burn: 'fire',
            mint: 'plus-circle'
        };
        return icons[type] || 'exchange-alt';
    }

    closeNFTModal() {
        const modal = document.getElementById('nftModal');
        if (modal) {
            modal.remove();
        }
        this.currentNFT = null;
    }

    toggleSelection(nftId) {
        if (this.selectedNFTs.has(nftId)) {
            this.selectedNFTs.delete(nftId);
        } else {
            this.selectedNFTs.add(nftId);
        }
        this.renderNFTGallery();
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const selectionCount = document.getElementById('selectionCount');
        if (selectionCount) {
            selectionCount.textContent = `${this.selectedNFTs.size} selected`;
        }

        const bulkActions = document.getElementById('bulkActions');
        if (bulkActions) {
            bulkActions.style.display = this.selectedNFTs.size > 0 ? 'block' : 'none';
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        document.querySelectorAll('[data-nft-view]').forEach(btn => {
            btn.classList.toggle('bg-blue-500', btn.dataset.nftView === mode);
            btn.classList.toggle('text-white', btn.dataset.nftView === mode);
        });

        // Update container class
        const container = document.getElementById('nftGallery');
        if (container) {
            container.className = mode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' :
                                   mode === 'list' ? 'space-y-4' :
                                   'grid grid-cols-1 gap-6';
        }

        this.renderNFTGallery();
    }

    setSorting(sortValue) {
        const [field, order] = sortValue.split('-');
        this.sortBy = field;
        this.sortOrder = order;
        this.renderNFTGallery();
    }

    setFilter(type, value) {
        if (type === 'category') {
            this.filterCategory = value;
        } else if (type === 'verification') {
            this.verificationStatus = value;
        } else if (type === 'price') {
            this.priceRange = value;
        }
        this.renderNFTGallery();
    }

    searchNFTs(query) {
        this.searchQuery = query.toLowerCase();
        this.renderNFTGallery();
    }

    getFilteredNFTs() {
        let filtered = [...this.nftCollection];

        // Category filter
        if (this.filterCategory !== 'all') {
            filtered = filtered.filter(nft => nft.category === this.filterCategory);
        }

        // Verification filter
        if (this.verificationStatus !== 'all') {
            filtered = filtered.filter(nft => 
                nft.verification && nft.verification.status === this.verificationStatus
            );
        }

        // Price filter
        filtered = filtered.filter(nft => {
            const price = nft.current_price || nft.price || 0;
            return price >= this.priceRange.min && price <= this.priceRange.max;
        });

        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(nft => 
                nft.name.toLowerCase().includes(this.searchQuery) ||
                (nft.description && nft.description.toLowerCase().includes(this.searchQuery)) ||
                (nft.collection_name && nft.collection_name.toLowerCase().includes(this.searchQuery))
            );
        }

        return filtered;
    }

    getSortedNFTs(nfts) {
        return nfts.sort((a, b) => {
            let aValue = a[this.sortBy];
            let bValue = b[this.sortBy];

            if (this.sortBy === 'created_at' || this.sortBy === 'updated_at') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    shouldLoadMore() {
        if (this.isLoading) return false;
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.offsetHeight;
        
        return scrollPosition >= documentHeight - 1000; // Load when 1000px from bottom
    }

    hasMoreNFTs() {
        return this.nftCollection.length >= this.currentPage * this.itemsPerPage;
    }

    setLoading(loading) {
        this.isLoading = loading;
        const loader = document.getElementById('nftLoader');
        if (loader) {
            loader.style.display = loading ? 'block' : 'none';
        }
    }

    showError(message) {
        const errorContainer = document.getElementById('nftError');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    initializeTooltips() {
        // Initialize any tooltip libraries if needed
    }

    // Placeholder methods for functionality to be implemented
    async toggleLike(nftId) {
        console.log('Toggle like for NFT:', nftId);
        // Implementation needed
    }

    async shareNFT(nftId) {
        const nft = this.nftCollection.find(n => n.id === nftId);
        if (!nft) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: nft.name,
                    text: nft.description,
                    url: `${window.location.origin}/nft/${nftId}`
                });
            } catch (error) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(`${window.location.origin}/nft/${nftId}`);
            this.showNotification('Link copied to clipboard!');
        }
    }

    async playAnimation(nftId) {
        const nft = this.nftCollection.find(n => n.id === nftId);
        if (!nft || !nft.animation_url) return;

        // Implementation for playing animations
        console.log('Play animation for NFT:', nftId);
    }

    async makeOffer(nftId) {
        console.log('Make offer for NFT:', nftId);
        // Implementation needed
    }

    async transferNFT(nftId) {
        console.log('Transfer NFT:', nftId);
        // Implementation needed
    }

    async listForSale(nftId) {
        console.log('List NFT for sale:', nftId);
        // Implementation needed
    }

    showNotification(message, type = 'info') {
        // Implementation for showing notifications
        console.log(`${type}: ${message}`);
    }
}

// Initialize NFT display when DOM is ready
let nftDisplay;
document.addEventListener('DOMContentLoaded', () => {
    nftDisplay = new NFTDisplay();
});
