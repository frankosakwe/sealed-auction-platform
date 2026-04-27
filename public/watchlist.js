// Socket.io client setup
const socket = io();

// Global state
let currentUser = null;
let watchlist = [];
let notifications = [];
let bulkSelectMode = false;
let selectedItems = new Set();
let currentEditingItem = null;

// DOM elements
const watchlistContainer = document.getElementById('watchlistContainer');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const bulkActions = document.getElementById('bulkActions');
const regularActions = document.getElementById('regularActions');
const notificationDropdown = document.getElementById('notificationDropdown');
const shareModal = document.getElementById('shareModal');
const watchlistItemModal = document.getElementById('watchlistItemModal');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    setupSocketListeners();
});

function initializeApp() {
    // Check for stored user session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        updateUserDisplay();
        loadWatchlist();
        loadNotifications();
    } else {
        // Redirect to login if not authenticated
        window.location.href = '/';
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Filters and sorting
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    document.getElementById('sortOrder').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
    
    // Bulk actions
    document.getElementById('bulkSelectBtn').addEventListener('click', enableBulkSelect);
    document.getElementById('bulkSelectCancel').addEventListener('click', disableBulkSelect);
    document.getElementById('bulkRemoveBtn').addEventListener('click', handleBulkRemove);
    
    // Share functionality
    document.getElementById('shareWatchlistBtn').addEventListener('click', openShareModal);
    document.getElementById('generateShareBtn').addEventListener('click', generateShareLink);
    document.getElementById('cancelShareBtn').addEventListener('click', closeShareModal);
    document.getElementById('copyShareBtn').addEventListener('click', copyShareLink);
    
    // Notifications
    document.getElementById('notificationBtn').addEventListener('click', toggleNotificationDropdown);
    document.getElementById('markAllReadBtn').addEventListener('click', markAllNotificationsRead);
    
    // Watchlist item modal
    document.getElementById('saveWatchlistSettings').addEventListener('click', saveWatchlistSettings);
    document.getElementById('cancelWatchlistSettings').addEventListener('click', closeWatchlistItemModal);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notificationBtn') && !e.target.closest('#notificationDropdown')) {
            notificationDropdown.classList.add('hidden');
        }
    });
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showNotification('Connection lost. Reconnecting...', 'warning');
    });
    
    // Watchlist updates
    socket.on('watchlist_updated', (data) => {
        if (data.userId === currentUser.id) {
            handleWatchlistUpdate(data);
        }
    });
    
    socket.on('watchlist_bulk_updated', (data) => {
        if (data.userId === currentUser.id) {
            handleBulkWatchlistUpdate(data);
        }
    });
    
    // Watchlist alerts
    socket.on('watchlist_alert', (alert) => {
        handleWatchlistAlert(alert);
    });
}

// API Functions
async function loadWatchlist() {
    try {
        showLoading(true);
        const response = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load watchlist');
        
        const data = await response.json();
        watchlist = data.watchlist;
        renderWatchlist();
        updateNotificationCount();
    } catch (error) {
        console.error('Error loading watchlist:', error);
        showNotification('Failed to load watchlist', 'error');
    } finally {
        showLoading(false);
    }
}

async function addToWatchlist(auctionId) {
    try {
        const response = await fetch('/api/watchlist/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ auctionId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add to watchlist');
        }
        
        showNotification('Auction added to watchlist', 'success');
        loadWatchlist(); // Reload to get updated data
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        showNotification(error.message, 'error');
    }
}

async function removeFromWatchlist(auctionId) {
    try {
        const response = await fetch(`/api/watchlist/remove/${auctionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to remove from watchlist');
        
        showNotification('Auction removed from watchlist', 'success');
        loadWatchlist(); // Reload to get updated data
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        showNotification(error.message, 'error');
    }
}

async function updateWatchlistItem(auctionId, updates) {
    try {
        const response = await fetch(`/api/watchlist/item/${auctionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) throw new Error('Failed to update watchlist item');
        
        showNotification('Watchlist settings updated', 'success');
        loadWatchlist(); // Reload to get updated data
    } catch (error) {
        console.error('Error updating watchlist item:', error);
        showNotification(error.message, 'error');
    }
}

async function bulkRemoveFromWatchlist(auctionIds) {
    try {
        const response = await fetch('/api/watchlist/bulk-remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ auctionIds })
        });
        
        if (!response.ok) throw new Error('Failed to remove items from watchlist');
        
        const data = await response.json();
        showNotification(`Removed ${data.results.removed} auctions from watchlist`, 'success');
        loadWatchlist(); // Reload to get updated data
        disableBulkSelect();
    } catch (error) {
        console.error('Error bulk removing from watchlist:', error);
        showNotification(error.message, 'error');
    }
}

async function generateShareLink() {
    try {
        const isPublic = document.getElementById('publicShare').checked;
        const expiresInHours = document.getElementById('expiresInHours').value;
        
        const response = await fetch('/api/watchlist/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ isPublic, expiresInHours: expiresInHours ? parseInt(expiresInHours) : null })
        });
        
        if (!response.ok) throw new Error('Failed to generate share link');
        
        const data = await response.json();
        document.getElementById('shareLink').value = data.share.shareUrl;
        document.getElementById('shareResult').classList.remove('hidden');
        showNotification('Share link generated successfully', 'success');
    } catch (error) {
        console.error('Error generating share link:', error);
        showNotification(error.message, 'error');
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/watchlist/notifications?unreadOnly=true&limit=10', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load notifications');
        
        const data = await response.json();
        notifications = data.notifications;
        renderNotifications();
        updateNotificationCount();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await fetch(`/api/watchlist/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        loadNotifications(); // Reload notifications
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        // Mark all displayed notifications as read
        for (const notification of notifications) {
            await markNotificationAsRead(notification.id);
        }
        
        showNotification('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showNotification('Failed to mark notifications as read', 'error');
    }
}

// UI Functions
function renderWatchlist() {
    if (watchlist.length === 0) {
        emptyState.classList.remove('hidden');
        watchlistContainer.innerHTML = '';
        return;
    }
    
    emptyState.classList.add('hidden');
    
    const filteredWatchlist = applyFiltersToWatchlist();
    
    if (filteredWatchlist.length === 0) {
        watchlistContainer.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">No auctions match your filters</p>
            </div>
        `;
        return;
    }
    
    watchlistContainer.innerHTML = filteredWatchlist.map(item => createWatchlistItemHTML(item)).join('');
    
    // Add event listeners to the new elements
    attachWatchlistItemEventListeners();
}

function createWatchlistItemHTML(item) {
    const isSelected = selectedItems.has(item.auction_id);
    const isEndingSoon = isAuctionEndingSoon(item.end_time);
    const timeLeft = getTimeLeft(item.end_time);
    
    return `
        <div class="watchlist-item bg-white rounded-lg shadow-md p-6 ${isEndingSoon ? 'ending-soon' : ''} ${bulkSelectMode ? 'bulk-select-mode' : ''} ${isSelected ? 'selected' : ''}" data-auction-id="${item.auction_id}">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center mb-2">
                        ${bulkSelectMode ? `
                            <input type="checkbox" class="bulk-checkbox mr-3" ${isSelected ? 'checked' : ''} data-auction-id="${item.auction_id}">
                        ` : ''}
                        <h3 class="text-lg font-semibold text-gray-900">${item.title}</h3>
                        ${isEndingSoon ? '<span class="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Ending Soon</span>' : ''}
                    </div>
                    <p class="text-gray-600 mb-3">${item.description}</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">Current Bid:</span>
                            <span class="font-semibold text-green-600">$${item.current_highest_bid || item.starting_bid}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Ends:</span>
                            <span class="font-semibold ${isEndingSoon ? 'text-red-600' : 'text-gray-900'}">${timeLeft}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Creator:</span>
                            <span class="font-semibold">${item.creator_username}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Status:</span>
                            <span class="font-semibold ${getStatusColor(item.status)}">${item.status}</span>
                        </div>
                    </div>
                    ${item.notes ? `
                        <div class="mt-3 p-3 bg-gray-50 rounded-md">
                            <p class="text-sm text-gray-600"><i class="fas fa-sticky-note mr-2"></i>${item.notes}</p>
                        </div>
                    ` : ''}
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${item.notification_preferences.price_change ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Price Alerts</span>' : ''}
                        ${item.notification_preferences.ending_soon ? '<span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">Ending Soon</span>' : ''}
                        ${item.notification_preferences.new_bid ? '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">New Bids</span>' : ''}
                        ${item.price_threshold ? `<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Threshold: $${item.price_threshold}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col space-y-2 ml-4">
                    <button class="watchlist-settings-btn text-gray-500 hover:text-indigo-600" data-auction-id="${item.auction_id}">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="remove-watchlist-btn text-gray-500 hover:text-red-600" data-auction-id="${item.auction_id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <a href="/#auction-${item.auction_id}" class="text-gray-500 hover:text-indigo-600">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function attachWatchlistItemEventListeners() {
    // Bulk select checkboxes
    document.querySelectorAll('.bulk-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const auctionId = e.target.dataset.auctionId;
            if (e.target.checked) {
                selectedItems.add(auctionId);
                e.target.closest('.watchlist-item').classList.add('selected');
            } else {
                selectedItems.delete(auctionId);
                e.target.closest('.watchlist-item').classList.remove('selected');
            }
            updateBulkActionButton();
        });
    });
    
    // Settings buttons
    document.querySelectorAll('.watchlist-settings-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const auctionId = e.target.closest('button').dataset.auctionId;
            openWatchlistItemModal(auctionId);
        });
    });
    
    // Remove buttons
    document.querySelectorAll('.remove-watchlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const auctionId = e.target.closest('button').dataset.auctionId;
            if (confirm('Are you sure you want to remove this auction from your watchlist?')) {
                removeFromWatchlist(auctionId);
            }
        });
    });
}

function renderNotifications() {
    const notificationList = document.getElementById('notificationList');
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                No new notifications
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item p-4 border-b hover:bg-gray-50 cursor-pointer ${!notification.is_read ? 'unread' : ''}" data-notification-id="${notification.id}">
            <div class="flex items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-900">${notification.title}</h4>
                    <p class="text-sm text-gray-600 mt-1">${notification.message}</p>
                    <p class="text-xs text-gray-500 mt-2">${formatDate(notification.created_at)}</p>
                </div>
                ${!notification.is_read ? '<div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>' : ''}
            </div>
        </div>
    `).join('');
    
    // Add click listeners
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const notificationId = e.currentTarget.dataset.notificationId;
            markNotificationAsRead(notificationId);
        });
    });
}

// Event Handlers
function handleLogout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    window.location.href = '/';
}

function applyFilters() {
    renderWatchlist();
}

function applyFiltersToWatchlist() {
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    const sortOrder = document.getElementById('sortOrder').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = [...watchlist];
    
    // Apply status filter
    if (statusFilter) {
        filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.title.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            item.creator_username.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        if (sortBy === 'created_at' || sortBy === 'end_time') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        } else if (sortBy === 'current_bid') {
            aValue = aValue || a.starting_bid;
            bValue = bValue || b.starting_bid;
        }
        
        if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });
    
    return filtered;
}

function enableBulkSelect() {
    bulkSelectMode = true;
    selectedItems.clear();
    document.body.classList.add('bulk-select-mode');
    bulkActions.classList.remove('hidden');
    regularActions.classList.add('hidden');
    renderWatchlist();
}

function disableBulkSelect() {
    bulkSelectMode = false;
    selectedItems.clear();
    document.body.classList.remove('bulk-select-mode');
    bulkActions.classList.add('hidden');
    regularActions.classList.remove('hidden');
    renderWatchlist();
}

function updateBulkActionButton() {
    const bulkRemoveBtn = document.getElementById('bulkRemoveBtn');
    if (selectedItems.size === 0) {
        bulkRemoveBtn.disabled = true;
        bulkRemoveBtn.textContent = 'Remove Selected';
    } else {
        bulkRemoveBtn.disabled = false;
        bulkRemoveBtn.textContent = `Remove Selected (${selectedItems.size})`;
    }
}

function handleBulkRemove() {
    if (selectedItems.size === 0) return;
    
    if (confirm(`Are you sure you want to remove ${selectedItems.size} auctions from your watchlist?`)) {
        bulkRemoveFromWatchlist(Array.from(selectedItems));
    }
}

function openShareModal() {
    shareModal.classList.remove('hidden');
}

function closeShareModal() {
    shareModal.classList.add('hidden');
    document.getElementById('shareResult').classList.add('hidden');
    document.getElementById('publicShare').checked = false;
    document.getElementById('expiresInHours').value = '';
}

function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');
    showNotification('Share link copied to clipboard', 'success');
}

function openWatchlistItemModal(auctionId) {
    currentEditingItem = watchlist.find(item => item.auction_id === auctionId);
    if (!currentEditingItem) return;
    
    // Populate modal with current settings
    document.getElementById('priceChangeNotif').checked = currentEditingItem.notification_preferences.price_change || false;
    document.getElementById('endingSoonNotif').checked = currentEditingItem.notification_preferences.ending_soon || false;
    document.getElementById('newBidNotif').checked = currentEditingItem.notification_preferences.new_bid || false;
    document.getElementById('priceThreshold').value = currentEditingItem.price_threshold || '';
    document.getElementById('watchlistNotes').value = currentEditingItem.notes || '';
    
    watchlistItemModal.classList.remove('hidden');
}

function closeWatchlistItemModal() {
    watchlistItemModal.classList.add('hidden');
    currentEditingItem = null;
}

function saveWatchlistSettings() {
    if (!currentEditingItem) return;
    
    const updates = {
        notification_preferences: {
            price_change: document.getElementById('priceChangeNotif').checked,
            ending_soon: document.getElementById('endingSoonNotif').checked,
            new_bid: document.getElementById('newBidNotif').checked
        },
        price_threshold: document.getElementById('priceThreshold').value ? parseFloat(document.getElementById('priceThreshold').value) : null,
        notes: document.getElementById('watchlistNotes').value
    };
    
    updateWatchlistItem(currentEditingItem.auction_id, updates);
    closeWatchlistItemModal();
}

function toggleNotificationDropdown() {
    notificationDropdown.classList.toggle('hidden');
}

function handleWatchlistUpdate(data) {
    // Handle real-time watchlist updates
    if (data.action === 'added') {
        showNotification('Auction added to watchlist', 'success');
        loadWatchlist();
    } else if (data.action === 'removed') {
        showNotification('Auction removed from watchlist', 'info');
        loadWatchlist();
    } else if (data.action === 'updated') {
        showNotification('Watchlist item updated', 'info');
        loadWatchlist();
    }
}

function handleBulkWatchlistUpdate(data) {
    // Handle bulk updates
    if (data.action === 'bulk_added') {
        showNotification(`Added ${data.results.added} auctions to watchlist`, 'success');
        loadWatchlist();
    } else if (data.action === 'bulk_removed') {
        showNotification(`Removed ${data.results.removed} auctions from watchlist`, 'info');
        loadWatchlist();
    }
}

function handleWatchlistAlert(alert) {
    // Handle real-time alerts
    showNotification(alert.title, 'warning', alert.message);
    loadNotifications();
}

// Utility Functions
function showLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden');
        watchlistContainer.innerHTML = '';
    } else {
        loadingState.classList.add('hidden');
    }
}

function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('username').textContent = currentUser.username;
        document.getElementById('userMenu').classList.remove('hidden');
        document.getElementById('authSection').classList.add('hidden');
    } else {
        document.getElementById('userMenu').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
    }
}

function updateNotificationCount() {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    const notificationCount = document.getElementById('notificationCount');
    
    if (unreadCount > 0) {
        notificationCount.textContent = unreadCount;
        notificationCount.classList.remove('hidden');
    } else {
        notificationCount.classList.add('hidden');
    }
}

function isAuctionEndingSoon(endTime) {
    const end = new Date(endTime);
    const now = new Date();
    const hoursLeft = (end - now) / (1000 * 60 * 60);
    return hoursLeft <= 1 && hoursLeft > 0;
}

function getTimeLeft(endTime) {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function getStatusColor(status) {
    switch (status) {
        case 'active': return 'text-green-600';
        case 'closed': return 'text-gray-600';
        case 'cancelled': return 'text-red-600';
        default: return 'text-gray-900';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
}

function showNotification(message, type = 'info', description = '') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm transform transition-all duration-300 translate-x-full`;
    
    const bgColor = type === 'success' ? 'bg-green-500' : 
                    type === 'error' ? 'bg-red-500' : 
                    type === 'warning' ? 'bg-orange-500' : 'bg-blue-500';
    
    notification.classList.add(bgColor, 'text-white');
    notification.innerHTML = `
        <div class="flex items-start">
            <div class="flex-1">
                <p class="font-semibold">${message}</p>
                ${description ? `<p class="text-sm mt-1 opacity-90">${description}</p>` : ''}
            </div>
            <button class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
        notification.classList.add('translate-x-0');
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
    
    // Manual close
    notification.querySelector('button').addEventListener('click', () => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    });
}

function debounce(func, wait) {
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
