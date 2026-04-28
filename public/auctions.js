/**
 * Auctions Module - Lazy loaded auction grid
 * Handles auction display, filtering, and pagination
 */

class AuctionsModule {
    constructor() {
        this.auctions = [];
        this.filteredAuctions = [];
        this.currentPage = 1;
        this.auctionsPerPage = 9;
        this.isLoading = false;
        this.filters = {
            category: 'all',
            status: 'all',
            priceRange: 'all'
        };
        
        this.init();
    }

    init() {
        this.loadAuctions();
        this.setupFilters();
        this.setupInfiniteScroll();
        this.setupSearch();
    }

    async loadAuctions() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingSkeletons();

        try {
            // Simulate API call - replace with actual API
            const response = await this.fetchAuctions();
            this.auctions = response;
            this.filteredAuctions = [...this.auctions];
            this.renderAuctions();
        } catch (error) {
            console.error('Failed to load auctions:', error);
            this.showError('Failed to load auctions. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoadingSkeletons();
        }
    }

    async fetchAuctions() {
        // Mock data - replace with actual API call
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve([
                    {
                        id: 1,
                        title: 'Vintage Rolex Submariner',
                        description: '1965 Rolex Submariner in excellent condition',
                        currentBid: 25000,
                        buyNowPrice: 35000,
                        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/667eea/ffffff?text=Rolex',
                        category: 'watches',
                        status: 'active',
                        bids: 12
                    },
                    {
                        id: 2,
                        title: 'Modern Art Collection',
                        description: 'Contemporary art pieces from emerging artists',
                        currentBid: 8500,
                        buyNowPrice: 12000,
                        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/764ba2/ffffff?text=Art',
                        category: 'art',
                        status: 'active',
                        bids: 8
                    },
                    {
                        id: 3,
                        title: 'Rare Comic Book Collection',
                        description: 'First edition superhero comics from the 1960s',
                        currentBid: 15000,
                        buyNowPrice: 20000,
                        endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/f093fb/ffffff?text=Comics',
                        category: 'collectibles',
                        status: 'active',
                        bids: 23
                    },
                    {
                        id: 4,
                        title: 'Luxury Sports Car',
                        description: '2020 Porsche 911 Turbo with low mileage',
                        currentBid: 120000,
                        buyNowPrice: 150000,
                        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/4facfe/ffffff?text=Porsche',
                        category: 'vehicles',
                        status: 'active',
                        bids: 5
                    },
                    {
                        id: 5,
                        title: 'Antique Furniture Set',
                        description: 'Victorian era dining room set with original finish',
                        currentBid: 8000,
                        buyNowPrice: 11000,
                        endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/43e97b/ffffff?text=Furniture',
                        category: 'furniture',
                        status: 'active',
                        bids: 7
                    },
                    {
                        id: 6,
                        title: 'Diamond Necklace',
                        description: '18k gold necklace with 2-carat diamond pendant',
                        currentBid: 18000,
                        buyNowPrice: 25000,
                        endTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                        image: 'https://via.placeholder.com/300x200/fa709a/ffffff?text=Diamond',
                        category: 'jewelry',
                        status: 'active',
                        bids: 15
                    }
                ]);
            }, 1000);
        });
    }

    renderAuctions() {
        const grid = document.getElementById('auctionsGrid');
        if (!grid) return;

        // Clear loading skeletons
        grid.innerHTML = '';

        const paginatedAuctions = this.getPaginatedAuctions();
        
        paginatedAuctions.forEach((auction, index) => {
            const card = this.createAuctionCard(auction, index);
            grid.appendChild(card);
        });

        // Add "Load More" button if there are more auctions
        if (this.hasMoreAuctions()) {
            this.addLoadMoreButton(grid);
        }
    }

    createAuctionCard(auction, index) {
        const card = document.createElement('div');
        card.className = 'auction-card bg-white rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl opacity-0';
        
        const timeLeft = this.getTimeLeft(auction.endTime);
        const bidProgress = (auction.currentBid / auction.buyNowPrice) * 100;
        
        card.innerHTML = `
            <div class="relative">
                <img src="${auction.image}" alt="${auction.title}" class="w-full h-48 object-cover lazy">
                <div class="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-semibold ${auction.status === 'active' ? 'text-green-600' : 'text-gray-600'}">
                    ${auction.status === 'active' ? 'Active' : 'Ended'}
                </div>
                <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                    ${timeLeft}
                </div>
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-2 line-clamp-2">${auction.title}</h3>
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${auction.description}</p>
                
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <span class="text-2xl font-bold text-green-600">$${auction.currentBid.toLocaleString()}</span>
                        <span class="text-xs text-gray-500 block">${auction.bids} bids</span>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-gray-500">Buy Now</span>
                        <span class="text-sm font-semibold block">$${auction.buyNowPrice.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div class="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300" style="width: ${bidProgress}%"></div>
                </div>
                
                <div class="flex gap-2">
                    <button class="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition text-sm font-semibold bid-btn" data-auction-id="${auction.id}">
                        Place Bid
                    </button>
                    <button class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-semibold watch-btn" data-auction-id="${auction.id}">
                        <i class="fas fa-eye mr-1"></i> Watch
                    </button>
                </div>
            </div>
        `;

        // Animate card in
        setTimeout(() => {
            card.classList.remove('opacity-0');
            card.classList.add('translate-y-0');
        }, index * 100);

        // Add event listeners
        this.setupCardEventListeners(card, auction);

        return card;
    }

    setupCardEventListeners(card, auction) {
        // Bid button
        const bidBtn = card.querySelector('.bid-btn');
        bidBtn.addEventListener('click', () => this.openBidModal(auction));

        // Watch button
        const watchBtn = card.querySelector('.watch-btn');
        watchBtn.addEventListener('click', () => this.toggleWatchlist(auction, watchBtn));

        // Card click for details
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                this.showAuctionDetails(auction);
            }
        });
    }

    getTimeLeft(endTime) {
        const now = new Date();
        const diff = endTime - now;
        
        if (diff <= 0) return 'Ended';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
    }

    getPaginatedAuctions() {
        const start = (this.currentPage - 1) * this.auctionsPerPage;
        const end = start + this.auctionsPerPage;
        return this.filteredAuctions.slice(start, end);
    }

    hasMoreAuctions() {
        const start = this.currentPage * this.auctionsPerPage;
        return start < this.filteredAuctions.length;
    }

    addLoadMoreButton(container) {
        const button = document.createElement('button');
        button.className = 'w-full mt-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-semibold';
        button.innerHTML = '<i class="fas fa-plus mr-2"></i>Load More Auctions';
        
        button.addEventListener('click', () => {
            this.currentPage++;
            this.renderMoreAuctions();
        });
        
        container.appendChild(button);
    }

    renderMoreAuctions() {
        const grid = document.getElementById('auctionsGrid');
        const loadMoreBtn = grid.querySelector('button');
        
        const paginatedAuctions = this.getPaginatedAuctions();
        
        paginatedAuctions.forEach((auction, index) => {
            const card = this.createAuctionCard(auction, index);
            grid.insertBefore(card, loadMoreBtn);
        });

        // Remove load more button if no more auctions
        if (!this.hasMoreAuctions()) {
            loadMoreBtn.remove();
        }
    }

    setupFilters() {
        // Category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filters.category = e.target.value;
                this.applyFilters();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
            });
        }

        // Price range filter
        const priceFilter = document.getElementById('priceFilter');
        if (priceFilter) {
            priceFilter.addEventListener('change', (e) => {
                this.filters.priceRange = e.target.value;
                this.applyFilters();
            });
        }
    }

    applyFilters() {
        this.filteredAuctions = this.auctions.filter(auction => {
            if (this.filters.category !== 'all' && auction.category !== this.filters.category) {
                return false;
            }
            if (this.filters.status !== 'all' && auction.status !== this.filters.status) {
                return false;
            }
            if (this.filters.priceRange !== 'all') {
                const price = auction.currentBid;
                switch (this.filters.priceRange) {
                    case 'under-1000':
                        return price < 1000;
                    case '1000-10000':
                        return price >= 1000 && price < 10000;
                    case '10000-50000':
                        return price >= 10000 && price < 50000;
                    case 'over-50000':
                        return price >= 50000;
                }
            }
            return true;
        });

        this.currentPage = 1;
        this.renderAuctions();
    }

    setupSearch() {
        const searchInput = document.getElementById('auctionSearch');
        if (!searchInput) return;

        const debouncedSearch = this.debounce((query) => {
            if (query.trim() === '') {
                this.applyFilters();
            } else {
                this.filteredAuctions = this.auctions.filter(auction => 
                    auction.title.toLowerCase().includes(query.toLowerCase()) ||
                    auction.description.toLowerCase().includes(query.toLowerCase())
                );
                this.currentPage = 1;
                this.renderAuctions();
            }
        }, 300);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }

    setupInfiniteScroll() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.hasMoreAuctions()) {
                        this.currentPage++;
                        this.renderMoreAuctions();
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '100px'
            });

            // Observe the load more button or last card
            const observeTarget = () => {
                const loadMoreBtn = document.querySelector('#auctionsGrid button');
                const lastCard = document.querySelector('#auctionsGrid .auction-card:last-child');
                const target = loadMoreBtn || lastCard;
                
                if (target) {
                    observer.observe(target);
                }
            };

            // Initial observation
            setTimeout(observeTarget, 1000);

            // Re-observe after new content is loaded
            const originalRenderMore = this.renderMoreAuctions.bind(this);
            this.renderMoreAuctions = function() {
                originalRenderMore();
                setTimeout(observeTarget, 100);
            };
        }
    }

    showLoadingSkeletons() {
        const grid = document.getElementById('auctionsGrid');
        if (!grid) return;

        grid.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'auction-card bg-white rounded-lg shadow-lg overflow-hidden';
            skeleton.innerHTML = `
                <div class="loading-skeleton h-48"></div>
                <div class="p-4">
                    <div class="loading-skeleton h-6 mb-2"></div>
                    <div class="loading-skeleton h-4 mb-3"></div>
                    <div class="loading-skeleton h-8 mb-3"></div>
                    <div class="loading-skeleton h-2 mb-3"></div>
                    <div class="flex gap-2">
                        <div class="loading-skeleton h-10 flex-1"></div>
                        <div class="loading-skeleton h-10 flex-1"></div>
                    </div>
                </div>
            `;
            grid.appendChild(skeleton);
        }
    }

    hideLoadingSkeletons() {
        // Skeletons are replaced by renderAuctions()
    }

    showError(message) {
        const grid = document.getElementById('auctionsGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
                <h3 class="text-xl font-semibold mb-2">Oops! Something went wrong</h3>
                <p class="text-gray-600 mb-4">${message}</p>
                <button class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition" onclick="location.reload()">
                    Try Again
                </button>
            </div>
        `;
    }

    openBidModal(auction) {
        // This would integrate with your existing bid modal system
        console.log('Opening bid modal for auction:', auction.id);
        // Emit event or call existing bid modal function
        if (window.openBidModal) {
            window.openBidModal(auction);
        }
    }

    toggleWatchlist(auction, button) {
        // Toggle watchlist functionality
        const isWatched = button.classList.contains('watching');
        
        if (isWatched) {
            button.classList.remove('watching', 'bg-red-500', 'text-white');
            button.classList.add('bg-gray-200', 'text-gray-700');
            button.innerHTML = '<i class="fas fa-eye mr-1"></i> Watch';
        } else {
            button.classList.add('watching', 'bg-red-500', 'text-white');
            button.classList.remove('bg-gray-200', 'text-gray-700');
            button.innerHTML = '<i class="fas fa-eye-slash mr-1"></i> Watching';
        }
    }

    showAuctionDetails(auction) {
        // Navigate to auction details page or open modal
        console.log('Showing details for auction:', auction.id);
        // This could navigate to a details page or open a detailed modal
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
}

// Initialize auctions module when loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('#auctionsGrid')) {
        new AuctionsModule();
    }
});

// Export for potential use in other modules
window.AuctionsModule = AuctionsModule;
