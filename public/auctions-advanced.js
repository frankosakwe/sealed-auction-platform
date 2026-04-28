/**
 * Advanced Auction Listing Module
 * Handles filtering, searching, sorting, and pagination
 */

class AdvancedAuctionListing {
    constructor() {
        this.currentView = 'grid';
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.totalPages = 0;
        this.totalResults = 0;
        this.isLoading = false;
        this.searchTimeout = null;
        this.categories = [];

        // Filter state
        this.filters = {
            status: 'all',
            category: 'all',
            minPrice: null,
            maxPrice: null,
            search: '',
            sortBy: 'newest',
            endingSoon: false
        };

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadInitialState();
    }

    cacheDOM() {
        // Search
        this.searchInput = document.getElementById('searchInput');
        this.autocompleteDropdown = document.getElementById('autocompleteDropdown');

        // View toggles
        this.viewBtns = document.querySelectorAll('.view-btn');

        // Filters
        this.filterSidebar = document.getElementById('filterSidebar');
        this.mobileFilterToggle = document.getElementById('mobileFilterToggle');
        this.statusInputs = document.querySelectorAll('input[name="status"]');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.minPriceInput = document.getElementById('minPrice');
        this.maxPriceInput = document.getElementById('maxPrice');
        this.applyFiltersBtn = document.getElementById('applyFilters');
        this.clearFiltersBtn = document.getElementById('clearFilters');

        // Sorting
        this.sortSelect = document.getElementById('sortSelect');

        // Content
        this.auctionGrid = document.getElementById('auctionGrid');
        this.loadingState = document.getElementById('loadingState');
        this.emptyState = document.getElementById('emptyState');
        this.resultsCount = document.getElementById('resultsCount');
        this.pagination = document.getElementById('pagination');
        this.activeFiltersContainer = document.getElementById('activeFilters');
    }

    bindEvents() {
        // View toggle
        this.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.target.dataset.view));
        });

        // Search
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        this.searchInput.addEventListener('focus', () => this.showAutocomplete());

        // Close autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                this.autocompleteDropdown.classList.remove('active');
            }
        });

        // Filters
        this.statusInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.filters.status = document.querySelector('input[name="status"]:checked').value;
            });
        });

        this.applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());

        // Sorting
        this.sortSelect.addEventListener('change', (e) => {
            this.filters.sortBy = e.target.value;
            this.currentPage = 1;
            this.loadAuctions();
        });

        // Mobile filter toggle
        this.mobileFilterToggle.addEventListener('click', () => {
            this.filterSidebar.classList.toggle('mobile-active');
        });

        // Close mobile filters on filter apply
        this.applyFiltersBtn.addEventListener('click', () => {
            this.filterSidebar.classList.remove('mobile-active');
        });
    }

    loadInitialState() {
        // Load filters from URL parameters
        this.loadFiltersFromURL();
        // Load categories
        this.loadCategories();
        // Load auctions
        this.loadAuctions();
    }

    loadFiltersFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.has('status')) {
            this.filters.status = params.get('status');
            document.querySelector(`input[name="status"][value="${this.filters.status}"]`).checked = true;
        }

        if (params.has('category')) {
            this.filters.category = params.get('category');
        }

        if (params.has('minPrice')) {
            this.filters.minPrice = parseFloat(params.get('minPrice'));
            this.minPriceInput.value = this.filters.minPrice;
        }

        if (params.has('maxPrice')) {
            this.filters.maxPrice = parseFloat(params.get('maxPrice'));
            this.maxPriceInput.value = this.filters.maxPrice;
        }

        if (params.has('search')) {
            this.filters.search = params.get('search');
            this.searchInput.value = this.filters.search;
        }

        if (params.has('sortBy')) {
            this.filters.sortBy = params.get('sortBy');
            this.sortSelect.value = this.filters.sortBy;
        }

        if (params.has('page')) {
            this.currentPage = parseInt(params.get('page')) || 1;
        }

        if (params.has('view')) {
            this.currentView = params.get('view');
            this.updateViewButtons();
        }

        if (params.has('endingSoon')) {
            this.filters.endingSoon = params.get('endingSoon') === 'true';
        }
    }

    saveStateToURL() {
        const params = new URLSearchParams();

        if (this.filters.status !== 'all') params.set('status', this.filters.status);
        if (this.filters.category !== 'all') params.set('category', this.filters.category);
        if (this.filters.minPrice) params.set('minPrice', this.filters.minPrice);
        if (this.filters.maxPrice) params.set('maxPrice', this.filters.maxPrice);
        if (this.filters.search) params.set('search', this.filters.search);
        if (this.filters.sortBy !== 'newest') params.set('sortBy', this.filters.sortBy);
        if (this.filters.endingSoon) params.set('endingSoon', 'true');
        if (this.currentPage > 1) params.set('page', this.currentPage);
        if (this.currentView !== 'grid') params.set('view', this.currentView);

        const queryString = params.toString();
        const newURL = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        window.history.replaceState({}, '', newURL);
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/auctions/categories');
            const data = await response.json();

            if (data.categories) {
                this.categories = data.categories;
                this.populateCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    populateCategories() {
        const categoryGroup = this.categoryFilter.querySelector('.filter-group') || this.categoryFilter;
        
        // Clear existing options except "All Categories"
        const allCategoryLabel = categoryGroup.querySelector('label');
        if (allCategoryLabel) {
            allCategoryLabel.remove();
        }

        // Add "All Categories" back
        const allLabel = document.createElement('label');
        allLabel.className = 'filter-label';
        allLabel.innerHTML = `
            <input type="radio" name="category" value="all" checked>
            All Categories
        `;
        categoryGroup.appendChild(allLabel);

        // Add categories
        this.categories.forEach(cat => {
            const label = document.createElement('label');
            label.className = 'filter-label';
            label.innerHTML = `
                <input type="radio" name="category" value="${cat.name}">
                ${this.capitalizeCategory(cat.name)}
            `;
            categoryGroup.appendChild(label);
        });

        // Re-bind category radio buttons
        document.querySelectorAll('input[name="category"]').forEach(input => {
            input.addEventListener('change', () => {
                this.filters.category = document.querySelector('input[name="category"]:checked').value;
            });
        });

        // Restore previous category selection if any
        if (this.filters.category !== 'all') {
            const categoryInput = document.querySelector(`input[name="category"][value="${this.filters.category}"]`);
            if (categoryInput) {
                categoryInput.checked = true;
            }
        }
    }

    capitalizeCategory(str) {
        return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    toggleView(view) {
        this.currentView = view;
        this.updateViewButtons();
        this.auctionGrid.classList.toggle('list-view', view === 'list');
        this.saveStateToURL();
    }

    updateViewButtons() {
        this.viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === this.currentView);
        });
    }

    handleSearch(e) {
        const query = e.target.value.trim();

        clearTimeout(this.searchTimeout);

        if (query.length === 0) {
            this.filters.search = '';
            this.autocompleteDropdown.classList.remove('active');
            return;
        }

        if (query.length < 2) {
            this.autocompleteDropdown.classList.remove('active');
            return;
        }

        this.searchTimeout = setTimeout(() => {
            this.fetchAutocomplete(query);
        }, 300);
    }

    async fetchAutocomplete(query) {
        try {
            const response = await fetch(`/api/auctions/search/autocomplete?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                this.renderAutocomplete(data.suggestions);
                this.autocompleteDropdown.classList.add('active');
            } else {
                this.autocompleteDropdown.classList.remove('active');
            }
        } catch (error) {
            console.error('Error fetching autocomplete:', error);
            this.autocompleteDropdown.classList.remove('active');
        }
    }

    renderAutocomplete(suggestions) {
        this.autocompleteDropdown.innerHTML = '';

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <div class="autocomplete-item-title">${this.escapeHTML(suggestion.title)}</div>
                <div class="autocomplete-item-meta">${this.capitalizeCategory(suggestion.category)} • $${suggestion.price.toFixed(2)}</div>
            `;
            item.addEventListener('click', () => {
                this.searchInput.value = suggestion.title;
                this.filters.search = suggestion.title;
                this.autocompleteDropdown.classList.remove('active');
                this.currentPage = 1;
                this.loadAuctions();
            });
            this.autocompleteDropdown.appendChild(item);
        });
    }

    showAutocomplete() {
        if (this.searchInput.value.trim().length >= 2 && this.autocompleteDropdown.children.length > 0) {
            this.autocompleteDropdown.classList.add('active');
        }
    }

    applyFilters() {
        this.filters.minPrice = this.minPriceInput.value ? parseFloat(this.minPriceInput.value) : null;
        this.filters.maxPrice = this.maxPriceInput.value ? parseFloat(this.maxPriceInput.value) : null;
        this.filters.search = this.searchInput.value.trim();
        this.currentPage = 1;
        this.loadAuctions();
    }

    clearFilters() {
        // Reset filter inputs
        document.querySelector('input[name="status"][value="all"]').checked = true;
        document.querySelector('input[name="category"][value="all"]').checked = true;
        this.minPriceInput.value = '';
        this.maxPriceInput.value = '';
        this.searchInput.value = '';
        this.sortSelect.value = 'newest';

        // Reset filter state
        this.filters = {
            status: 'all',
            category: 'all',
            minPrice: null,
            maxPrice: null,
            search: '',
            sortBy: 'newest',
            endingSoon: false
        };

        this.currentPage = 1;
        this.loadAuctions();
    }

    async loadAuctions() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                status: this.filters.status,
                category: this.filters.category,
                search: this.filters.search,
                sortBy: this.filters.sortBy,
                endingSoon: this.filters.endingSoon
            });

            if (this.filters.minPrice) queryParams.append('minPrice', this.filters.minPrice);
            if (this.filters.maxPrice) queryParams.append('maxPrice', this.filters.maxPrice);

            const response = await fetch(`/api/auctions/filter/advanced?${queryParams}`);
            const data = await response.json();

            if (!response.ok) {
                // Handle specific error codes
                if (response.status === 400) {
                    throw new Error(data.error || 'Invalid filter parameters');
                } else if (response.status === 500) {
                    throw new Error('Server error - please try again later');
                } else {
                    throw new Error(data.error || 'Failed to load auctions');
                }
            }

            // Ensure we have valid data structure
            if (!data || !Array.isArray(data.auctions)) {
                throw new Error('Invalid response format from server');
            }

            this.totalResults = data.pagination?.total || 0;
            this.totalPages = data.pagination?.totalPages || 0;

            this.renderAuctions(data.auctions);
            this.updateResultsInfo();
            this.renderPagination();
            this.updateActiveFilters();
            this.saveStateToURL();
        } catch (error) {
            console.error('Error loading auctions:', error);
            this.showError(`Failed to load auctions: ${error.message}`);
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    renderAuctions(auctions) {
        this.auctionGrid.innerHTML = '';

        if (auctions.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();

        auctions.forEach(auction => {
            const card = this.createAuctionCard(auction);
            this.auctionGrid.appendChild(card);
        });
    }

    createAuctionCard(auction) {
        const card = document.createElement('div');
        card.className = 'auction-card';

        const statusClass = this.getStatusClass(auction.status);
        const timeRemaining = this.getTimeRemaining(auction.endTime);
        const bidLabel = auction.bidCount === 1 ? 'bid' : 'bids';

        card.innerHTML = `
            <div class="auction-image">
                <div class="auction-image-placeholder">📸</div>
                <div class="auction-status-badge ${statusClass}">${this.getStatusLabel(auction.status)}</div>
            </div>
            <div class="auction-content">
                <div class="auction-category">${this.capitalizeCategory(auction.category)}</div>
                <div class="auction-title">${this.escapeHTML(auction.title)}</div>
                <div class="auction-description">${this.escapeHTML(auction.description || '')}</div>
                <div class="auction-stats">
                    <div class="auction-stat">
                        💰 ${auction.bidCount} ${bidLabel}
                    </div>
                    <div class="auction-stat">
                        👁️ ${auction.viewCount} views
                    </div>
                </div>
                <div class="auction-pricing">
                    <div class="price-label">Current Bid</div>
                    <div class="current-price">$${auction.currentHighestBid.toFixed(2)}</div>
                </div>
                <div class="auction-time">
                    ${timeRemaining}
                </div>
                <button class="auction-action" data-auction-id="${auction.id}">
                    ${auction.status === 'active' ? 'Place Bid' : 'View Details'}
                </button>
            </div>
        `;

        const actionBtn = card.querySelector('.auction-action');
        actionBtn.addEventListener('click', () => {
            // Track the view
            this.trackAuctionView(auction.id);
            // Handle the action
            this.handleAuctionAction(auction.id, auction.status);
        });

        return card;
    }

    trackAuctionView(auctionId) {
        // Non-blocking view tracking
        fetch(`/api/auctions/${auctionId}/views`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }).catch(error => {
            // Silently fail - view tracking is not critical
            console.warn('Failed to track auction view:', error);
        });
    }

    getStatusClass(status) {
        switch (status) {
            case 'active': return 'status-active';
            case 'ending-soon': return 'status-ending-soon';
            case 'closed': return 'status-closed';
            default: return '';
        }
    }

    getStatusLabel(status) {
        switch (status) {
            case 'active': return 'Active';
            case 'ending-soon': return 'Ending Soon';
            case 'closed': return 'Closed';
            default: return status;
        }
    }

    getTimeRemaining(endTime) {
        const end = new Date(endTime);
        const now = new Date();
        const diff = end - now;

        if (diff < 0) {
            return 'Auction ended';
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);

        if (days > 0) {
            return `${days}d ${hours}h remaining`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        } else {
            return `${minutes}m remaining`;
        }
    }

    handleAuctionAction(auctionId, status) {
        if (status === 'active') {
            // Navigate to auction details for bidding
            window.location.href = `/auctions/${auctionId}?action=bid`;
        } else {
            // Navigate to auction details to view
            window.location.href = `/auctions/${auctionId}`;
        }
    }

    updateResultsInfo() {
        this.resultsCount.textContent = this.totalResults;
    }

    renderPagination() {
        this.pagination.innerHTML = '';

        if (this.totalPages <= 1) return;

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '← Previous';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadAuctions();
                window.scrollTo(0, 0);
            }
        });
        this.pagination.appendChild(prevBtn);

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadAuctions();
                window.scrollTo(0, 0);
            });
            this.pagination.appendChild(firstBtn);

            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '10px 5px';
                this.pagination.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = 'pagination-btn';
            btn.textContent = i;
            if (i === this.currentPage) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => {
                this.currentPage = i;
                this.loadAuctions();
                window.scrollTo(0, 0);
            });
            this.pagination.appendChild(btn);
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '10px 5px';
                this.pagination.appendChild(dots);
            }

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-btn';
            lastBtn.textContent = this.totalPages;
            lastBtn.addEventListener('click', () => {
                this.currentPage = this.totalPages;
                this.loadAuctions();
                window.scrollTo(0, 0);
            });
            this.pagination.appendChild(lastBtn);
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = this.currentPage === this.totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadAuctions();
                window.scrollTo(0, 0);
            }
        });
        this.pagination.appendChild(nextBtn);
    }

    updateActiveFilters() {
        this.activeFiltersContainer.innerHTML = '';

        const activeFilters = [];

        if (this.filters.status !== 'all') {
            activeFilters.push({
                label: `Status: ${this.filters.status}`,
                field: 'status',
                value: 'all'
            });
        }

        if (this.filters.category !== 'all') {
            activeFilters.push({
                label: `Category: ${this.capitalizeCategory(this.filters.category)}`,
                field: 'category',
                value: 'all'
            });
        }

        if (this.filters.minPrice) {
            activeFilters.push({
                label: `Min: $${this.filters.minPrice}`,
                field: 'minPrice',
                value: null
            });
        }

        if (this.filters.maxPrice) {
            activeFilters.push({
                label: `Max: $${this.filters.maxPrice}`,
                field: 'maxPrice',
                value: null
            });
        }

        if (this.filters.search) {
            activeFilters.push({
                label: `Search: "${this.filters.search}"`,
                field: 'search',
                value: ''
            });
        }

        activeFilters.forEach(filter => {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `
                ${filter.label}
                <span class="filter-tag-remove">✕</span>
            `;
            tag.querySelector('.filter-tag-remove').addEventListener('click', () => {
                this.removeFilter(filter.field, filter.value);
            });
            this.activeFiltersContainer.appendChild(tag);
        });
    }

    removeFilter(field, value) {
        if (field === 'status' || field === 'category') {
            this.filters[field] = value;
            document.querySelector(`input[name="${field}"][value="${value}"]`).checked = true;
        } else if (field === 'minPrice') {
            this.filters.minPrice = null;
            this.minPriceInput.value = '';
        } else if (field === 'maxPrice') {
            this.filters.maxPrice = null;
            this.maxPriceInput.value = '';
        } else if (field === 'search') {
            this.filters.search = value;
            this.searchInput.value = value;
        }

        this.currentPage = 1;
        this.loadAuctions();
    }

    showLoading() {
        this.auctionGrid.innerHTML = '';
        for (let i = 0; i < this.itemsPerPage; i++) {
            const skeleton = this.createSkeleton();
            this.auctionGrid.appendChild(skeleton);
        }
        this.loadingState.style.display = 'none';
    }

    createSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card loading-skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-image loading-skeleton"></div>
            <div class="skeleton-content">
                <div class="skeleton-line loading-skeleton"></div>
                <div class="skeleton-line loading-skeleton"></div>
                <div class="skeleton-title loading-skeleton"></div>
                <div class="skeleton-line loading-skeleton"></div>
            </div>
        `;
        return skeleton;
    }

    hideLoading() {
        this.loadingState.style.display = 'none';
    }

    showEmptyState() {
        this.emptyState.style.display = 'block';
        this.auctionGrid.innerHTML = '';
    }

    hideEmptyState() {
        this.emptyState.style.display = 'none';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            padding: 15px 20px;
            background: #fee;
            color: #c33;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #c33;
        `;
        errorDiv.textContent = message;
        this.auctionGrid.parentElement.insertBefore(errorDiv, this.auctionGrid);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    escapeHTML(str) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedAuctionListing();
});
