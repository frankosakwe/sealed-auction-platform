// Socket.io client setup
const socket = io();

// Global state
let currentUser = null;
let auctions = [];
let currentTab = "auctions";
let currentPage = 1;
let isLoading = false;
let hasMoreAuctions = true;
const AUCTIONS_PER_PAGE = 10;

// Notification state
let notifications = [];
let unreadNotifications = 0;
const MAX_NOTIFICATIONS = 50; // Keep last 50 notifications

// Notification preferences
let notificationPreferences = {
    enabled: true,
    types: {
        auctions: true,
        bids: true,
        results: true
    },
    retention: 50
};

// DOM elements
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authModeText = document.getElementById("authModeText");
const auctionsGrid = document.getElementById("auctionsGrid");
const createAuctionForm = document.getElementById("createAuctionForm");
const bidModal = document.getElementById("bidModal");
const bidForm = document.getElementById("bidForm");

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
    setupEventListeners();
    setupSocketListeners();
    checkOAuthStatus();
    checkOAuthCallback();
});

function initializeApp() {
    // Check for stored user session
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        hideAuthModal();
        updateUserDisplay();
        checkAdminAccess();
    }
    
    // Load notifications from localStorage
    loadNotifications();
    
    // Load initial auctions
    loadAuctions(true);
    
    // Setup infinite scroll
    setupInfiniteScroll();
}

function setupEventListeners() {
    // Auth form submission
    if (authForm) authForm.addEventListener("submit", handleAuth);
    
    // Auth mode toggle
    if (authModeText) authModeText.addEventListener("click", toggleAuthMode);
    
    // Create auction form
    if (createAuctionForm) createAuctionForm.addEventListener("submit", handleCreateAuction);
    
    // Bid form
    if (bidForm) bidForm.addEventListener("submit", handlePlaceBid);
    
    // Tab navigation
    document.querySelectorAll("[data-tab]").forEach(button => {
        button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
}

function setupSocketListeners() {
    // Connection events
    socket.on("connect", () => {
        console.log("Connected to server");
    });
    
    socket.on("disconnect", () => {
        console.log("Disconnected from server");
        showNotification("Connection lost. Reconnecting...", "warning");
    });
    
    // Auction events
    socket.on("auctionCreated", (auction) => {
        console.log("New auction created:", auction);
        addAuctionToGrid(auction);
        addNotification(`New auction: ${auction.title}`, "auction", { auctionId: auction.id });
    });
    
    socket.on("auctionClosed", (auction) => {
        console.log("Auction closed:", auction);
        updateAuctionInGrid(auction);
        
        if (auction.winner) {
            addNotification(`Auction "${auction.title}" closed! Winner: ${auction.winner}`, "success", { auctionId: auction.id });
        } else {
            addNotification(`Auction "${auction.title}" closed without bids`, "info", { auctionId: auction.id });
        }
    });
    
    socket.on("bidPlaced", (data) => {
        console.log("New bid placed:", data);
        updateBidCount(data.auctionId, data.bidCount);
        addNotification("New bid placed on auction!", "bid", { auctionId: data.auctionId });
    });
}

// Authentication functions
function handleAuth(e) {
    e.preventDefault();
    const formData = new FormData(authForm);
    const isLogin = authTitle.textContent === "Login";
    
    const endpoint = isLogin ? "/api/auth/login" : "/api/users";
    const payload = {
        username: formData.get("username"),
        password: formData.get("password")
    };
    
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showNotification(data.error, "error");
            return;
        }
        
        currentUser = data;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        hideAuthModal();
        updateUserDisplay();
        checkAdminAccess();
        showNotification(`Successfully ${isLogin ? "logged in" : "registered"}!`, "success");
        loadAuctions(true);
    })
    .catch(error => {
        console.error("Auth error:", error);
        showNotification("Authentication failed", "error");
    });
}

function toggleAuthMode() {
    const isLogin = authTitle.textContent === "Login";
    authTitle.textContent = isLogin ? "Register" : "Login";
    authModeText.textContent = isLogin ? "Login" : "Register";
    authForm.reset();
}

function hideAuthModal() {
    if (authModal) authModal.classList.add("hidden");
}

// Auction functions
function loadAuctions(reset = false) {
    if (isLoading || (!hasMoreAuctions && !reset)) return;
    
    isLoading = true;
    showLoadingIndicator();
    
    if (reset) {
        currentPage = 1;
        auctions = [];
        renderAuctions();
    }
    
    fetch(`/api/auctions?page=${currentPage}&limit=${AUCTIONS_PER_PAGE}`)
    .then(response => response.json())
    .then(data => {
        const { auctions: newAuctions, pagination } = data;
        
        if (reset) {
            auctions = newAuctions;
        } else {
            auctions = [...auctions, ...newAuctions];
        }
        
        currentPage = pagination.page;
        hasMoreAuctions = pagination.hasMore;
        isLoading = false;
        
        // Expose auctions globally for AI recommendations
        window._allAuctions = auctions;
        
        renderAuctions();
        hideLoadingIndicator();
    })
    .catch(error => {
        console.error("Error loading auctions:", error);
        showNotification("Failed to load auctions", "error");
        isLoading = false;
        hideLoadingIndicator();
    });
}

function loadMoreAuctions() {
    if (!isLoading && hasMoreAuctions) {
        currentPage++;
        loadAuctions(false);
    }
}

function renderAuctions() {
    if (!auctionsGrid) return;
    
    auctionsGrid.innerHTML = "";
    
    if (auctions.length === 0) {
        auctionsGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-gavel text-4xl mb-4 opacity-50"></i>
                <p class="text-lg opacity-75">No auctions available</p>
            </div>
        `;
        return;
    }
    
    // Render all auctions in correct order (newest first)
    auctions.forEach(auction => {
        const auctionCard = createAuctionCard(auction);
        auctionsGrid.insertAdjacentHTML("beforeend", auctionCard);
    });
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        // Load more when user is within 100px of bottom
        if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoading && hasMoreAuctions) {
            loadMoreAuctions();
        }
    });
}

function showLoadingIndicator() {
    let loader = document.getElementById('loading-indicator');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loading-indicator';
        loader.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg animate-pulse z-50';
        loader.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading more auctions...</span>
            </div>
        `;
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
}

function hideLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.style.display = 'none';
    }
}

function addAuctionToGrid(auction, prepend = true) {
    if (!auctionsGrid) return;
    
    const auctionCard = createAuctionCard(auction);
    // Prepend new auctions (from socket events), append when loading more
    auctionsGrid.insertAdjacentHTML(prepend ? "afterbegin" : "beforeend", auctionCard);
}

function createAuctionCard(auction) {
    const endTime = new Date(auction.endTime);
    const now = new Date();
    const isExpired = endTime <= now;
    const statusClass = auction.status === "closed" || isExpired ? "bg-red-500" : "bg-green-500";
    const statusText = auction.status === "closed" ? "Closed" : isExpired ? "Expired" : "Active";
    
    return `
        <div class="auction-card glass-effect rounded-xl p-6 hover:shadow-lg transition-all duration-300 animate-fade-in" data-auction-id="${auction.id}">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-semibold line-clamp-3">${auction.title}</h3>
                <span class="${statusClass} text-white text-xs px-2 py-1 rounded-full">${statusText}</span>
            </div>
            
            <p class="text-sm opacity-75 mb-4 line-clamp-3">${auction.description}</p>
            
            <div class="space-y-2 mb-4">
                <div class="flex justify-between text-sm">
                    <span>Starting Bid:</span>
                    <span class="font-semibold">${auction.startingBid} XLM</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span>Current Highest:</span>
                    <span class="font-semibold text-green-500">${auction.currentHighestBid} XLM</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span>Bids:</span>
                    <span class="font-semibold" data-bid-count="${auction.id}">${auction.bidCount}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span>Ends:</span>
                    <span class="font-semibold">${endTime.toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="flex space-x-2">
                ${auction.status === "active" && !isExpired ? `
                    <button onclick="openBidModal('${auction.id}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                        <i class="fas fa-hand-holding-usd mr-1"></i>Place Bid
                    </button>
                ` : ""}
                <button onclick="viewAuctionDetails('${auction.id}')" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
                <button onclick="openShareModal('${auction.id}', '${auction.title.replace(/'/g, "\\'")}', '${auction.startingBid}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm transition-colors" title="Share">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button onclick="openARPreview(${auction.id})" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors" title="AR Preview">
                    <i class="fas fa-camera"></i>
                </button>
            </div>
        </div>
    `;
}

function updateAuctionInGrid(auction) {
    const auctionCard = document.querySelector(`[data-auction-id="${auction.id}"]`);
    if (auctionCard) {
        const newCard = createAuctionCard(auction);
        auctionCard.outerHTML = newCard;
    }
}

function updateBidCount(auctionId, bidCount) {
    const bidCountElement = document.querySelector(`[data-bid-count="${auctionId}"]`);
    if (bidCountElement) {
        bidCountElement.textContent = bidCount;
        bidCountElement.classList.add("animate-pulse");
        setTimeout(() => {
            bidCountElement.classList.remove("animate-pulse");
        }, 1000);
    }
}

function handleCreateAuction(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification("Please login to create an auction", "error");
        showAuthModal();
        return;
    }
    
    const formData = new FormData(createAuctionForm);
    const endTime = new Date(formData.get("endTime"));
    
    if (endTime <= new Date()) {
        showNotification("End time must be in the future", "error");
        return;
    }
    
    const auctionData = {
        title: formData.get("title"),
        description: formData.get("description"),
        startingBid: parseFloat(formData.get("startingBid")),
        endTime: endTime.toISOString(),
        userId: currentUser.userId
    };
    
    fetch("/api/auctions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(auctionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showNotification(data.error, "error");
            return;
        }
        
        showNotification("Auction created successfully!", "success");
        createAuctionForm.reset();
        // Socket.io will handle adding the auction to the grid
    })
    .catch(error => {
        console.error("Error creating auction:", error);
        showNotification("Failed to create auction", "error");
    });
}

// Bid functions
function openBidModal(auctionId) {
    if (!currentUser) {
        showNotification("Please login to place a bid", "error");
        showAuthModal();
        return;
    }
    
    // Track bid intent for AI recommendations
    if (typeof AIRecommendations !== 'undefined') {
        AIRecommendations.trackBid(String(auctionId));
    }
    
    if (bidModal) {
        bidModal.dataset.auctionId = auctionId;
        bidModal.classList.remove("hidden");
    }
}

function openARPreview(auctionId) {
    const auction = (window._allAuctions || auctions).find(a => String(a.id) === String(auctionId));
    if (!auction) { showNotification('Auction not found', 'error'); return; }
    // Track view for AI recommendations
    if (typeof AIRecommendations !== 'undefined') {
        AIRecommendations.trackView(String(auctionId), auction);
    }
    if (typeof ARPreview !== 'undefined') {
        ARPreview.open(auction);
    }
}

function handlePlaceBid(e) {
    e.preventDefault();
    
    const auctionId = bidModal.dataset.auctionId;
    const formData = new FormData(bidForm);
    
    const bidData = {
        auctionId: auctionId,
        bidderId: currentUser.userId,
        amount: parseFloat(formData.get("amount")),
        secretKey: formData.get("secretKey")
    };
    
    fetch(`/api/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
            amount: parseFloat(formData.get("amount")),
            secretKey: formData.get("secretKey")
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showNotification(data.error, "error");
            return;
        }
        
        showNotification("Bid placed successfully!", "success");
        bidModal.classList.add("hidden");
        bidForm.reset();
        // Socket.io will handle updating the bid count
    })
    .catch(error => {
        console.error("Error placing bid:", error);
        showNotification("Failed to place bid", "error");
    });
}

function viewAuctionDetails(auctionId) {
    fetch(`/api/auctions/${auctionId}`)
    .then(response => response.json())
    .then(auction => {
        // Create a detailed view modal or navigate to details page
        const details = `
            Title: ${auction.title}
            Description: ${auction.description}
            Starting Bid: ${auction.startingBid} XLM
            Current Highest: ${auction.currentHighestBid} XLM
            Status: ${auction.status}
            Bids: ${auction.bids.length}
            ${auction.winner ? `Winner: ${auction.winner}` : ""}
        `;
        showNotification(details, "info", 5000);
    })
    .catch(error => {
        console.error("Error fetching auction details:", error);
        showNotification("Failed to fetch auction details", "error");
    });
}

// UI utility functions
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.add("hidden");
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}Content`);
    if (selectedTab) {
        selectedTab.classList.remove("hidden");
    }
    
    // Update tab buttons (data-tab buttons)
    document.querySelectorAll("[data-tab]").forEach(button => {
        button.classList.remove("bg-purple-600", "text-white");
        button.classList.add("bg-transparent", "text-gray-600");
    });
    
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
        selectedButton.classList.remove("bg-transparent", "text-gray-600");
        selectedButton.classList.add("bg-purple-600", "text-white");
    }

    // Update dynamically-added tab-btn buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("bg-purple-600", "text-white");
    });
    const dynBtn = document.getElementById(`${tabName}Tab`);
    if (dynBtn) dynBtn.classList.add("bg-purple-600", "text-white");

    // Refresh AI recommendations when switching to that tab
    if (tabName === 'ai' && typeof AIRecommendations !== 'undefined') {
        AIRecommendations.refresh(window._allAuctions || auctions);
    }
    
    // Initialize network monitor when switching to network tab
    if (tabName === 'network' && window.networkMonitor) {
        window.networkMonitor.showNetworkPanel();
    }
    
    currentTab = tabName;
}

// Enhanced Notification System Functions
function loadNotifications() {
    const stored = localStorage.getItem('auctionNotifications');
    if (stored) {
        try {
            notifications = JSON.parse(stored);
            updateUnreadCount();
            updateNotificationBadge();
        } catch (e) {
            console.error('Failed to load notifications:', e);
            notifications = [];
        }
    }
    
    // Load preferences
    loadNotificationPreferences();
}

function saveNotifications() {
    localStorage.setItem('auctionNotifications', JSON.stringify(notifications));
}

function addNotification(message, type = 'info', data = null) {
    // Check notification preferences
    if (!notificationPreferences.enabled) return;
    
    // Check type preferences
    if (type === 'auction' && !notificationPreferences.types.auctions) return;
    if (type === 'bid' && !notificationPreferences.types.bids) return;
    if ((type === 'success' || type === 'error') && !notificationPreferences.types.results) return;
    
    const notification = {
        id: Date.now().toString(),
        message,
        type,
        timestamp: new Date().toISOString(),
        read: false,
        data
    };
    
    // Add to beginning of array (newest first)
    notifications.unshift(notification);
    
    // Limit storage
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }
    
    // Update unread count
    if (!notification.read) {
        unreadNotifications++;
        updateNotificationBadge();
    }
    
    // Save to localStorage
    saveNotifications();
    
    // Show toast notification
    showToastNotification(message, type);
    
    // Send browser notification if enabled
    sendBrowserNotification(message, type);
    
    return notification;
}

function showToastNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg animate-fade-in ${
        type === "success" ? "bg-green-500" :
        type === "error" ? "bg-red-500" :
        type === "warning" ? "bg-yellow-500" :
        "bg-blue-500"
    } text-white max-w-sm`;
    
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === "success" ? "fa-check-circle" :
                type === "error" ? "fa-exclamation-circle" :
                type === "warning" ? "fa-exclamation-triangle" :
                "fa-info-circle"
            } mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, duration);
}

function sendBrowserNotification(message, type = 'info') {
    if (!notificationPreferences.enabled || !('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        const icon = getNotificationIcon(type).split(' ')[1]; // Get icon class
        new Notification('Auction Update', {
            body: message,
            icon: '/favicon.ico', // You can add a proper icon
            badge: '/favicon.ico',
            requireInteraction: false,
            tag: Date.now().toString() // Unique tag for each notification
        });
    } else if (Notification.permission !== 'denied') {
        // Request permission on first attempt
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                sendBrowserNotification(message, type);
            }
        });
    }
}

function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        unreadNotifications = Math.max(0, unreadNotifications - 1);
        updateNotificationBadge();
        saveNotifications();
    }
}

function markAllNotificationsAsRead() {
    notifications.forEach(n => n.read = true);
    unreadNotifications = 0;
    updateNotificationBadge();
    saveNotifications();
}

function updateUnreadCount() {
    unreadNotifications = notifications.filter(n => !n.read).length;
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadNotifications > 0) {
            badge.textContent = unreadNotifications > 99 ? '99+' : unreadNotifications;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function deleteNotification(notificationId) {
    const index = notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
        if (!notifications[index].read) {
            unreadNotifications = Math.max(0, unreadNotifications - 1);
            updateNotificationBadge();
        }
        notifications.splice(index, 1);
        saveNotifications();
        renderNotificationCenter();
    }
}

function clearAllNotifications() {
    if (confirm('Are you sure you want to clear all notifications?')) {
        notifications = [];
        unreadNotifications = 0;
        updateNotificationBadge();
        saveNotifications();
        renderNotificationCenter();
    }
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'fa-check-circle text-green-500';
        case 'error': return 'fa-times-circle text-red-500';
        case 'warning': return 'fa-exclamation-triangle text-yellow-500';
        case 'info': return 'fa-info-circle text-blue-500';
        case 'auction': return 'fa-gavel text-purple-500';
        case 'bid': return 'fa-hand-holding-usd text-green-500';
        default: return 'fa-bell text-gray-500';
    }
}

function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function openNotificationCenter() {
    const center = document.getElementById('notification-center');
    if (center) {
        renderNotificationCenter();
        center.classList.remove('hidden');
        markAllNotificationsAsRead();
    }
}


// ============================================================
// Issue #106 – Advanced Filtering UI
// ============================================================

let savedFilterPresets = JSON.parse(localStorage.getItem('filterPresets') || '[]');

function getFilterState() {
    const categories = [...document.querySelectorAll('.filter-category:checked')].map(el => el.value);
    const statuses   = [...document.querySelectorAll('.filter-status:checked')].map(el => el.value);
    return {
        categories,
        statuses,
        priceMin: parseFloat(document.getElementById('filterPriceMin').value) || 0,
        priceMax: parseFloat(document.getElementById('filterPriceMax').value) || Infinity,
        dateFrom: document.getElementById('filterDateFrom').value,
        dateTo:   document.getElementById('filterDateTo').value,
        sort:     document.getElementById('filterSort').value,
    };
}

function applyFilters() {
    const f = getFilterState();
    let results = [...auctions];

    if (f.categories.length) {
        results = results.filter(a => f.categories.includes((a.category || 'other').toLowerCase()));
    }
    if (f.statuses.length) {
        results = results.filter(a => {
            const status = a.status || (new Date(a.endTime) > new Date() ? 'active' : 'closed');
            return f.statuses.includes(status);
        });
    }
    results = results.filter(a => {
        const price = parseFloat(a.startingBid || a.currentBid || 0);
        return price >= f.priceMin && price <= f.priceMax;
    });
    if (f.dateFrom) results = results.filter(a => new Date(a.endTime) >= new Date(f.dateFrom));
    if (f.dateTo)   results = results.filter(a => new Date(a.endTime) <= new Date(f.dateTo + 'T23:59:59'));

    const sortFns = {
        newest:     (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        oldest:     (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
        'price-asc':  (a, b) => (a.startingBid || 0) - (b.startingBid || 0),
        'price-desc': (a, b) => (b.startingBid || 0) - (a.startingBid || 0),
        'ending-soon':(a, b) => new Date(a.endTime) - new Date(b.endTime),
        'most-bids':  (a, b) => (b.bidCount || 0) - (a.bidCount || 0),
    };
    if (sortFns[f.sort]) results.sort(sortFns[f.sort]);

    renderFilterResults(results);
}

function renderFilterResults(results) {
    const container = document.getElementById('filterResults');
    const grid      = document.getElementById('filterResultsGrid');
    const count     = document.getElementById('filterResultCount');
    container.classList.remove('hidden');
    count.textContent = `(${results.length} found)`;
    if (!results.length) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full">No auctions match your filters.</p>';
        return;
    }
    grid.innerHTML = results.map(a => `
        <div class="glass-effect rounded-xl p-4 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all" onclick="switchTab('auctions')">
            <h4 class="font-semibold truncate">${a.title || 'Untitled'}</h4>
            <p class="text-sm text-gray-400 mt-1">Starting: $${a.startingBid || 0}</p>
            <p class="text-xs text-gray-500 mt-1">Ends: ${a.endTime ? new Date(a.endTime).toLocaleDateString() : 'N/A'}</p>
            <span class="inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${(a.status || 'active') === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}">${a.status || 'active'}</span>
        </div>`).join('');
}

function resetFilters() {
    document.querySelectorAll('.filter-category, .filter-status').forEach(el => { el.checked = false; });
    document.querySelector('.filter-status[value="active"]').checked = true;
    document.getElementById('filterPriceMin').value = '';
    document.getElementById('filterPriceMax').value = '';
    document.getElementById('filterPriceSlider').value = 100000;
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterSort').value = 'newest';
    document.getElementById('filterResults').classList.add('hidden');
}

function saveFilterPreset() {
    const name = prompt('Enter a name for this preset:');
    if (!name) return;
    const preset = { name, ...getFilterState() };
    savedFilterPresets.push(preset);
    localStorage.setItem('filterPresets', JSON.stringify(savedFilterPresets));
    renderFilterPresets();
}

function loadFilterPreset(index) {
    const p = savedFilterPresets[index];
    if (!p) return;
    document.querySelectorAll('.filter-category').forEach(el => { el.checked = p.categories.includes(el.value); });
    document.querySelectorAll('.filter-status').forEach(el => { el.checked = p.statuses.includes(el.value); });
    document.getElementById('filterPriceMin').value = p.priceMin || '';
    document.getElementById('filterPriceMax').value = p.priceMax === Infinity ? '' : p.priceMax;
    document.getElementById('filterDateFrom').value = p.dateFrom || '';
    document.getElementById('filterDateTo').value   = p.dateTo   || '';
    document.getElementById('filterSort').value     = p.sort     || 'newest';
}

function deleteFilterPreset(index) {
    savedFilterPresets.splice(index, 1);
    localStorage.setItem('filterPresets', JSON.stringify(savedFilterPresets));
    renderFilterPresets();
}

function renderFilterPresets() {
    const container = document.getElementById('filterPresets');
    if (!container) return;
    if (!savedFilterPresets.length) {
        container.innerHTML = '<span class="text-gray-500 text-sm">No saved presets yet.</span>';
        return;
    }
    container.innerHTML = savedFilterPresets.map((p, i) => `
        <div class="flex items-center gap-1">
            <button onclick="loadFilterPreset(${i})" class="bg-purple-600/30 hover:bg-purple-600/60 text-white px-3 py-1 rounded-lg text-sm transition-colors">${p.name}</button>
            <button onclick="deleteFilterPreset(${i})" class="text-red-400 hover:text-red-300 text-xs px-1" title="Delete"><i class="fas fa-times"></i></button>
        </div>`).join('');
}

// Initialise presets on load
document.addEventListener('DOMContentLoaded', renderFilterPresets);


// ============================================================
// Issue #107 – Map Integration
// ============================================================

let userLocation = null;
let mapAuctions  = [];

function locateMe() {
    const status = document.getElementById('mapStatus');
    if (!navigator.geolocation) {
        status.textContent = 'Geolocation is not supported by your browser.';
        return;
    }
    status.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            status.textContent = `📍 Location found: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
            renderNearbyAuctions();
        },
        err => {
            status.textContent = `Could not get location: ${err.message}`;
        }
    );
}

function updateMapRadius() {
    if (userLocation) renderNearbyAuctions();
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function renderNearbyAuctions() {
    const container = document.getElementById('nearbyAuctions');
    const radius    = parseFloat(document.getElementById('mapRadiusFilter').value);
    const markers   = document.getElementById('mapMarkers');

    // Attach mock coordinates to auctions that don't have them
    const withCoords = auctions.map((a, i) => ({
        ...a,
        lat: a.lat || (userLocation ? userLocation.lat + (Math.random()-0.5)*0.5 : 51.5 + (Math.random()-0.5)*0.5),
        lng: a.lng || (userLocation ? userLocation.lng + (Math.random()-0.5)*0.5 : -0.1 + (Math.random()-0.5)*0.5),
    }));

    let nearby = withCoords;
    if (userLocation && radius > 0) {
        nearby = withCoords.filter(a => haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) <= radius);
    }
    nearby.sort((a, b) => {
        if (!userLocation) return 0;
        return haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
               haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
    });

    // Render map markers as a simple visual list
    if (markers) {
        markers.innerHTML = nearby.slice(0, 5).map(a => {
            const dist = userLocation ? haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng).toFixed(1) + ' km' : '';
            return `<div class="flex items-center gap-2 text-sm text-left mb-1">
                <i class="fas fa-map-pin text-purple-400"></i>
                <span class="font-medium">${a.title || 'Auction'}</span>
                ${dist ? `<span class="text-gray-400 ml-auto">${dist}</span>` : ''}
            </div>`;
        }).join('') || '<p class="text-gray-400 text-sm">No auctions in range.</p>';
    }

    if (!nearby.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm col-span-full">No auctions found in this area.</p>';
        return;
    }
    container.innerHTML = nearby.slice(0, 9).map(a => {
        const dist = userLocation ? `${haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng).toFixed(1)} km away` : '';
        return `<div class="glass-effect rounded-xl p-4 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all" onclick="switchTab('auctions')">
            <h4 class="font-semibold truncate">${a.title || 'Untitled'}</h4>
            ${dist ? `<p class="text-xs text-purple-400 mt-1"><i class="fas fa-map-marker-alt mr-1"></i>${dist}</p>` : ''}
            <p class="text-sm text-gray-400 mt-1">$${a.startingBid || 0}</p>
        </div>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('mapLocationSearch');
    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                document.getElementById('mapStatus').textContent = `Searching for "${searchInput.value}"… (requires geocoding API)`;
            }
        });
    }
});


// ============================================================
// Issue #108 – Video Streaming Support
// ============================================================

let videoPlaylistData = [];
let currentVideoIndex = -1;
let videoViewCounts   = JSON.parse(localStorage.getItem('videoViews') || '{}');
let autoplayEnabled   = false;

function loadVideoPlaylist() {
    // Build playlist from current auctions (using placeholder video URLs)
    videoPlaylistData = auctions.slice(0, 12).map((a, i) => ({
        id:        a.id || i,
        title:     a.title || `Auction #${i+1}`,
        thumbnail: `https://picsum.photos/seed/${a.id || i}/320/180`,
        // In production these would be real streaming URLs
        url:       '',
        duration:  `${Math.floor(Math.random()*3)+1}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`,
        views:     videoViewCounts[a.id || i] || Math.floor(Math.random()*500),
    }));
    renderVideoPlaylist();
    renderThumbnailGallery();
}

function renderVideoPlaylist() {
    const container = document.getElementById('videoPlaylist');
    if (!container) return;
    if (!videoPlaylistData.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No auction previews available.</p>';
        return;
    }
    container.innerHTML = videoPlaylistData.map((v, i) => `
        <div class="flex gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors ${currentVideoIndex===i?'ring-2 ring-purple-500':''}" onclick="playVideo(${i})">
            <div class="relative flex-shrink-0 w-20 h-12 rounded overflow-hidden bg-gray-800">
                <img src="${v.thumbnail}" alt="${v.title}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                <span class="absolute bottom-0.5 right-0.5 text-xs bg-black/70 px-1 rounded">${v.duration}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${v.title}</p>
                <p class="text-xs text-gray-400">${v.views} views</p>
            </div>
        </div>`).join('');
}

function renderThumbnailGallery() {
    const container = document.getElementById('thumbnailGallery');
    if (!container) return;
    container.innerHTML = videoPlaylistData.map((v, i) => `
        <div class="relative cursor-pointer rounded-lg overflow-hidden aspect-video bg-gray-800 hover:ring-2 hover:ring-purple-500 transition-all" onclick="playVideo(${i})">
            <img src="${v.thumbnail}" alt="${v.title}" class="w-full h-full object-cover" onerror="this.style.display='none'">
            <div class="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors">
                <i class="fas fa-play text-white text-xl"></i>
            </div>
            <p class="absolute bottom-0 left-0 right-0 text-xs text-white bg-black/60 px-2 py-1 truncate">${v.title}</p>
        </div>`).join('');
}

function playVideo(index) {
    const v = videoPlaylistData[index];
    if (!v) return;
    currentVideoIndex = index;

    const mainVideo   = document.getElementById('mainVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    const overlay     = document.getElementById('videoOverlay');
    const titleEl     = document.getElementById('videoTitle');
    const viewsEl     = document.getElementById('videoViews');
    const analyticsEl = document.getElementById('videoAnalytics');

    // Track views
    videoViewCounts[v.id] = (videoViewCounts[v.id] || 0) + 1;
    localStorage.setItem('videoViews', JSON.stringify(videoViewCounts));
    v.views = videoViewCounts[v.id];

    if (v.url) {
        mainVideo.src = v.url;
        mainVideo.classList.remove('hidden');
        placeholder.classList.add('hidden');
        mainVideo.play().catch(() => {});
    } else {
        // No real URL – show placeholder with info
        mainVideo.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.innerHTML = `
            <img src="${v.thumbnail}" alt="${v.title}" class="w-full h-full object-cover absolute inset-0 opacity-30">
            <div class="relative z-10 text-center p-8">
                <i class="fas fa-play-circle text-6xl text-purple-400 mb-4"></i>
                <p class="text-lg font-semibold">${v.title}</p>
                <p class="text-gray-400 text-sm mt-2">Live streaming preview – ${v.duration}</p>
            </div>`;
    }

    overlay.classList.remove('hidden');
    titleEl.textContent = v.title;
    viewsEl.textContent = `${v.views} views`;
    analyticsEl.textContent = `Watching: ${v.title} | Quality: ${document.getElementById('videoQualitySelect').value}`;

    renderVideoPlaylist(); // refresh to highlight current
}

function changeVideoQuality() {
    const q = document.getElementById('videoQualitySelect').value;
    const analyticsEl = document.getElementById('videoAnalytics');
    if (analyticsEl && currentVideoIndex >= 0) {
        analyticsEl.textContent = `Quality changed to ${q}`;
    }
}

function toggleAutoplay() {
    autoplayEnabled = document.getElementById('autoplayToggle').checked;
}

// Load playlist when video tab is opened
const _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;
// Patch switchTab to lazy-load video playlist
(function patchSwitchTab() {
    const orig = window.switchTab;
    window.switchTab = function(tabName) {
        orig(tabName);
        if (tabName === 'video' && !videoPlaylistData.length) loadVideoPlaylist();
        if (tabName === 'map'   && userLocation) renderNearbyAuctions();
        if (tabName === 'filter') renderFilterPresets();
        if (tabName === 'admin') loadAdminStats();
    };
})();


// ============================================================
// Issue #109 – Voice Commands
// ============================================================

let voiceRecognition  = null;
let voiceActive       = false;
let voiceHistory      = [];
const VOICE_COMMANDS  = {
    'show auctions':  () => switchTab('auctions'),
    'auctions':       () => switchTab('auctions'),
    'create auction': () => switchTab('create'),
    'create':         () => switchTab('create'),
    'my bids':        () => switchTab('myBids'),
    'bids':           () => switchTab('myBids'),
    'open filter':    () => switchTab('filter'),
    'filter':         () => switchTab('filter'),
    'open map':       () => switchTab('map'),
    'map':            () => switchTab('map'),
    'open video':     () => switchTab('video'),
    'video':          () => switchTab('video'),
    'open network':   () => switchTab('network'),
    'network':        () => switchTab('network'),
    'voice':          () => switchTab('voice'),
    'scroll down':    () => window.scrollBy({ top: 400, behavior: 'smooth' }),
    'scroll up':      () => window.scrollBy({ top: -400, behavior: 'smooth' }),
    'stop listening': () => stopVoiceRecognition(),
    'stop':           () => stopVoiceRecognition(),
    'help':           () => { switchTab('voice'); speakFeedback('Available commands: show auctions, create auction, my bids, open filter, open map, open video, open network, scroll down, scroll up, stop listening.'); },
};

function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const noteEl = document.getElementById('voiceSupportNote');
    if (!SpeechRecognition) {
        if (noteEl) noteEl.textContent = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
        return null;
    }
    if (noteEl) noteEl.textContent = 'Speech recognition is supported in this browser.';
    const recognition = new SpeechRecognition();
    recognition.continuous    = true;
    recognition.interimResults = true;
    recognition.lang          = 'en-US';

    recognition.onresult = e => {
        let interim = '';
        let final   = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript.trim().toLowerCase();
            if (e.results[i].isFinal) final += t;
            else interim += t;
        }
        document.getElementById('voiceTranscript').textContent = interim || final;
        if (final) processVoiceCommand(final);
    };

    recognition.onerror = e => {
        setVoiceStatus(`Error: ${e.error}`, false);
        voiceActive = false;
        updateVoiceButton();
    };

    recognition.onend = () => {
        if (voiceActive) recognition.start(); // keep alive
    };

    return recognition;
}

function processVoiceCommand(transcript) {
    const text = transcript.toLowerCase().trim();
    let matched = false;

    // Check for search command
    const searchMatch = text.match(/^search (.+)$/);
    if (searchMatch) {
        const term = searchMatch[1];
        addVoiceHistory(text, `Searching for "${term}"`);
        speakFeedback(`Searching for ${term}`);
        switchTab('auctions');
        matched = true;
    }

    if (!matched) {
        for (const [cmd, fn] of Object.entries(VOICE_COMMANDS)) {
            if (text.includes(cmd)) {
                fn();
                const response = `Executed: ${cmd}`;
                addVoiceHistory(text, response);
                speakFeedback(response);
                matched = true;
                break;
            }
        }
    }

    if (!matched) {
        addVoiceHistory(text, 'Command not recognised');
    }
}

function addVoiceHistory(command, response) {
    voiceHistory.unshift({ command, response, time: new Date().toLocaleTimeString() });
    if (voiceHistory.length > 20) voiceHistory.pop();

    const feedback = document.getElementById('voiceFeedback');
    const lastCmd  = document.getElementById('voiceLastCommand');
    const lastResp = document.getElementById('voiceResponse');
    if (feedback) feedback.classList.remove('hidden');
    if (lastCmd)  lastCmd.textContent  = command;
    if (lastResp) lastResp.textContent = response;

    renderVoiceHistory();
}

function renderVoiceHistory() {
    const container = document.getElementById('voiceHistory');
    if (!container) return;
    if (!voiceHistory.length) {
        container.innerHTML = '<p class="text-gray-500">No commands yet.</p>';
        return;
    }
    container.innerHTML = voiceHistory.map(h => `
        <div class="flex justify-between gap-2">
            <span class="text-purple-300">"${h.command}"</span>
            <span class="text-gray-500 text-xs whitespace-nowrap">${h.time}</span>
        </div>
        <div class="text-gray-400 text-xs mb-1">${h.response}</div>`).join('');
}

function clearVoiceHistory() {
    voiceHistory = [];
    renderVoiceHistory();
}

function speakFeedback(text) {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 1.1;
    utt.volume = 0.8;
    window.speechSynthesis.speak(utt);
}

function setVoiceStatus(text, active) {
    const statusEl = document.getElementById('voiceStatus');
    if (statusEl) statusEl.textContent = text;
    voiceActive = active;
    updateVoiceButton();
}

function updateVoiceButton() {
    const btn = document.getElementById('voiceBtn');
    if (!btn) return;
    if (voiceActive) {
        btn.classList.add('animate-pulse', 'bg-red-600');
        btn.classList.remove('bg-purple-600');
        btn.title = 'Stop listening';
    } else {
        btn.classList.remove('animate-pulse', 'bg-red-600');
        btn.classList.add('bg-purple-600');
        btn.title = 'Start voice recognition';
    }
}

function toggleVoiceRecognition() {
    if (voiceActive) {
        stopVoiceRecognition();
    } else {
        startVoiceRecognition();
    }
}

function startVoiceRecognition() {
    if (!voiceRecognition) voiceRecognition = initVoiceRecognition();
    if (!voiceRecognition) {
        setVoiceStatus('Speech recognition not supported in this browser.', false);
        return;
    }
    voiceActive = true;
    updateVoiceButton();
    setVoiceStatus('Listening… speak a command', true);
    voiceRecognition.start();
}

function stopVoiceRecognition() {
    voiceActive = false;
    if (voiceRecognition) voiceRecognition.stop();
    setVoiceStatus('Click to start listening', false);
    document.getElementById('voiceTranscript').textContent = '';
}

// Admin Dashboard functionality
let currentAdminSection = 'users';
let adminData = {
    users: { page: 1, totalPages: 1 },
    auctions: { page: 1, totalPages: 1 },
    revenue: { page: 1, totalPages: 1 },
    security: { page: 1, totalPages: 1 },
    audit: { page: 1, totalPages: 1 }
};

// Check if user is admin and show admin tab
function checkAdminAccess() {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
        const adminTab = document.getElementById('adminTab');
        if (adminTab) {
            adminTab.style.display = 'block';
        }
    }
}

// Load admin dashboard stats
async function loadAdminStats() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalUsers').textContent = stats.users?.total_users || 0;
            document.getElementById('activeAuctions').textContent = stats.auctions?.active_auctions || 0;
            document.getElementById('revenue30d').textContent = `$${stats.revenue?.revenue_30d || 0}`;
            document.getElementById('securityAlerts').textContent = stats.security?.openAlerts || 0;
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Show admin section
function showAdminSection(section) {
    // Update navigation buttons
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.remove('bg-purple-600', 'text-white');
        btn.classList.add('bg-transparent', 'text-gray-600');
    });
    
    event.target.classList.remove('bg-transparent', 'text-gray-600');
    event.target.classList.add('bg-purple-600', 'text-white');
    
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    // Show selected section
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
        sectionElement.classList.remove('hidden');
        currentAdminSection = section;
        loadAdminSection(section);
    }
}

// Load admin section data
async function loadAdminSection(section) {
    switch (section) {
        case 'users':
            await loadUsers();
            break;
        case 'auctions':
            await loadAuctionsAdmin();
            break;
        case 'revenue':
            await loadRevenue();
            break;
        case 'security':
            await loadSecurity();
            break;
        case 'config':
            await loadConfig();
            break;
        case 'audit':
            await loadAudit();
            break;
    }
}

// Load users for admin
async function loadUsers(page = 1) {
    try {
        const token = localStorage.getItem('authToken');
        const search = document.getElementById('userSearch')?.value || '';
        const role = document.getElementById('userRoleFilter')?.value || '';
        const status = document.getElementById('userStatusFilter')?.value || '';
        
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '10'
        });
        
        if (search) params.append('search', search);
        if (role) params.append('role', role);
        if (status) params.append('status', status);
        
        const response = await fetch(`/api/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            adminData.users = { page: data.page, totalPages: data.totalPages };
            renderUsersTable(data.users);
            renderUsersPagination(data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render users table
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr class="border-b border-white/5">
            <td class="py-2">${user.username}</td>
            <td class="py-2">${user.email || '-'}</td>
            <td class="py-2">
                <span class="px-2 py-1 rounded text-xs ${
                    user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    user.role === 'moderator' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                }">${user.role}</span>
            </td>
            <td class="py-2">
                <span class="px-2 py-1 rounded text-xs ${
                    user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }">${user.is_active ? 'Active' : 'Inactive'}</span>
            </td>
            <td class="py-2 text-xs text-gray-400">${new Date(user.created_at).toLocaleDateString()}</td>
            <td class="py-2">
                <div class="flex gap-1">
                    <select onchange="updateUserRole('${user.id}', this.value)" class="text-xs bg-white/10 border border-white/20 rounded px-1 py-0.5">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Mod</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button onclick="toggleUserStatus('${user.id}')" class="text-xs bg-white/10 border border-white/20 rounded px-2 py-0.5 hover:bg-white/20">
                        ${user.is_active ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render users pagination
function renderUsersPagination(data) {
    const pagination = document.getElementById('usersPagination');
    const info = document.getElementById('usersPaginationInfo');
    
    if (info) {
        info.textContent = `Showing ${data.page} of ${data.totalPages} pages (${data.total} users)`;
    }
    
    if (!pagination) return;
    
    let html = '';
    if (data.page > 1) {
        html += `<button onclick="loadUsers(${data.page - 1})" class="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded hover:bg-white/20">Prev</button>`;
    }
    
    for (let i = Math.max(1, data.page - 2); i <= Math.min(data.totalPages, data.page + 2); i++) {
        html += `<button onclick="loadUsers(${i})" class="px-2 py-1 text-xs ${i === data.page ? 'bg-purple-600' : 'bg-white/10 border border-white/20'} rounded hover:bg-white/20">${i}</button>`;
    }
    
    if (data.page < data.totalPages) {
        html += `<button onclick="loadUsers(${data.page + 1})" class="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded hover:bg-white/20">Next</button>`;
    }
    
    pagination.innerHTML = html;
}

// Update user role
async function updateUserRole(userId, newRole) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            showNotification('User role updated successfully', 'success');
            await loadUsers(adminData.users.page);
        } else {
            showNotification('Failed to update user role', 'error');
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        showNotification('Error updating user role', 'error');
    }
}

// Toggle user status
async function toggleUserStatus(userId) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            showNotification('User status updated successfully', 'success');
            await loadUsers(adminData.users.page);
        } else {
            showNotification('Failed to update user status', 'error');
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        showNotification('Error updating user status', 'error');
    }
}

// Social Sharing functionality
let currentShareAuction = null;

// Open share modal
function openShareModal(auctionId, auctionTitle, startingBid) {
    currentShareAuction = { id: auctionId, title: auctionTitle, startingBid: startingBid };
    
    const modal = document.getElementById('shareModal');
    const titleElement = document.getElementById('shareAuctionTitle');
    const messageElement = document.getElementById('customShareMessage');
    
    if (titleElement) titleElement.textContent = auctionTitle;
    if (messageElement) messageElement.value = `Check out this auction: "${auctionTitle}" - Starting bid: ${startingBid} XLM`;
    
    // Check for native sharing support
    if (navigator.share) {
        document.getElementById('nativeShareContainer').style.display = 'block';
    }
    
    modal.classList.remove('hidden');
}

// Close share modal
function closeShareModal() {
    const modal = document.getElementById('shareModal');
    modal.classList.add('hidden');
    currentShareAuction = null;
    
    // Reset form
    document.getElementById('customShareMessage').value = '';
    document.getElementById('generateShareImage').checked = false;
    document.getElementById('sharePreview').classList.add('hidden');
}

// Share on social media
async function shareOnSocial(platform) {
    if (!currentShareAuction) return;
    
    const customMessage = document.getElementById('customShareMessage').value || 
        `Check out this auction: "${currentShareAuction.title}" - Starting bid: ${currentShareAuction.startingBid} XLM`;
    const generateImage = document.getElementById('generateShareImage').checked;
    
    try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                auctionId: currentShareAuction.id,
                platform: platform,
                customMessage: customMessage,
                generateImage: generateImage
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Track engagement
            if (data.shareId) {
                trackShareEngagement(data.shareId, 'click');
            }
            
            // Open share URL or copy link
            if (platform === 'copy_link') {
                await navigator.clipboard.writeText(data.shareUrl);
                showNotification('Link copied to clipboard!', 'success');
            } else {
                window.open(data.platformUrl, '_blank', 'width=600,height=400');
                showNotification(`Shared on ${platform}!`, 'success');
            }
            
            // Show preview
            showSharePreview(data.message, data.shareUrl);
            
        } else {
            showNotification('Failed to share auction', 'error');
        }
    } catch (error) {
        console.error('Share error:', error);
        showNotification('Error sharing auction', 'error');
    }
}

// Native sharing
async function shareNatively() {
    if (!currentShareAuction || !navigator.share) return;
    
    const customMessage = document.getElementById('customShareMessage').value || 
        `Check out this auction: "${currentShareAuction.title}" - Starting bid: ${currentShareAuction.startingBid} XLM`;
    const shareUrl = `${window.location.origin}/auction/${currentShareAuction.id}`;
    
    try {
        await navigator.share({
            title: currentShareAuction.title,
            text: customMessage,
            url: shareUrl
        });
        
        // Track the share
        trackShare(currentShareAuction.id, 'native', customMessage);
        showNotification('Shared successfully!', 'success');
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Native share error:', error);
            showNotification('Error sharing', 'error');
        }
    }
}

// Track share
async function trackShare(auctionId, platform, message) {
    try {
        await fetch('/api/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                auctionId: auctionId,
                platform: platform,
                customMessage: message,
                generateImage: false
            })
        });
    } catch (error) {
        console.error('Track share error:', error);
    }
}

// Track share engagement
async function trackShareEngagement(shareId, engagementType) {
    try {
        await fetch(`/api/share/${shareId}/engage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                engagementType: engagementType,
                referrerUrl: document.referrer
            })
        });
    } catch (error) {
        console.error('Track engagement error:', error);
    }
}

// Show share preview
function showSharePreview(message, url) {
    const preview = document.getElementById('sharePreview');
    const content = document.getElementById('sharePreviewContent');
    
    if (preview && content) {
        content.innerHTML = `
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>URL:</strong> ${url}</p>
        `;
        preview.classList.remove('hidden');
    }
}

// Add event listeners for admin filters
document.addEventListener('DOMContentLoaded', () => {
    // User search and filters
    const userSearch = document.getElementById('userSearch');
    const userRoleFilter = document.getElementById('userRoleFilter');
    const userStatusFilter = document.getElementById('userStatusFilter');
    
    if (userSearch) {
        userSearch.addEventListener('input', () => loadUsers(1));
    }
    if (userRoleFilter) {
        userRoleFilter.addEventListener('change', () => loadUsers(1));
    }
    if (userStatusFilter) {
        userStatusFilter.addEventListener('change', () => loadUsers(1));
    }
});
