// Global variables
let socket = io();
let currentUser = null;
let currentAuctionId = null;
let isLoginMode = true;

// Form validation configuration
const validationRules = {
    username: {
        required: true,
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
        message: 'Username must be 3-20 characters, alphanumeric and underscore only'
    },
    password: {
        required: true,
        minLength: 6,
        maxLength: 50,
        message: 'Password must be at least 6 characters long'
    },
    auctionTitle: {
        required: true,
        minLength: 3,
        maxLength: 100,
        message: 'Title must be 3-100 characters long'
    },
    auctionDescription: {
        required: true,
        minLength: 10,
        maxLength: 1000,
        message: 'Description must be 10-1000 characters long'
    },
    startingBid: {
        required: true,
        min: 0.01,
        max: 1000000,
        message: 'Starting bid must be between $0.01 and $1,000,000'
    },
    endTime: {
        required: true,
        futureOnly: true,
        message: 'End time must be at least 1 hour in the future'
    },
    bidAmount: {
        required: true,
        min: 0.01,
        max: 1000000,
        message: 'Bid amount must be between $0.01 and $1,000,000'
    },
    secretKey: {
        required: true,
        minLength: 8,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/,
        message: 'Secret key must be 8-100 characters long'
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadAuctions();
    setupEventListeners();
    setupSocketListeners();
    setupRealtimeValidation();
});

// Socket.io listeners
function setupSocketListeners() {
    socket.on('auctionCreated', (auction) => {
        showNotification('New auction created: ' + auction.title, 'success');
        loadAuctions();
    });
    
    socket.on('auctionClosed', (auction) => {
        showNotification('Auction closed: ' + auction.title, 'info');
        loadAuctions();
    });
    
    socket.on('bidPlaced', (data) => {
        showNotification('New bid placed!', 'info');
        loadAuctions();
    });
}

// Event listeners
function setupEventListeners() {
    // Auth form
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    
    // Create auction form
    document.getElementById('createAuctionForm').addEventListener('submit', handleCreateAuction);
    
    // Bid form
    document.getElementById('bidForm').addEventListener('submit', handlePlaceBid);
    
    // Set minimum end time to current time
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    document.getElementById('endTime').min = now.toISOString().slice(0, 16);
}

// Authentication functions
function toggleAuth() {
    const modal = document.getElementById('authModal');
    modal.classList.toggle('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('authForm').reset();
    clearFieldErrors(['username', 'password']);
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const submitText = document.getElementById('authSubmitText');
    const modeText = document.getElementById('authModeText');
    
    if (isLoginMode) {
        title.textContent = 'Login';
        submitText.textContent = 'Login';
        modeText.textContent = 'Register';
    } else {
        title.textContent = 'Register';
        submitText.textContent = 'Register';
        modeText.textContent = 'Login';
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    
    // Clear previous errors
    clearFieldErrors(['username', 'password']);
    
    // Validate fields
    const usernameValid = validateField('username', username.value);
    const passwordValid = validateField('password', password.value);
    
    if (!usernameValid || !passwordValid) {
        return;
    }
    
    const endpoint = isLoginMode ? '/api/users/login' : '/api/users/register';
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username.value, password: password.value })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data;
            updateUserDisplay();
            closeAuthModal();
            showNotification(isLoginMode ? 'Login successful!' : 'Registration successful!', 'success');
        } else {
            showNotification(data.error || 'Authentication failed', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

function updateUserDisplay() {
    const userDisplay = document.getElementById('userDisplay');
    const authBtn = document.getElementById('authBtn');
    
    if (currentUser) {
        userDisplay.textContent = `Welcome, ${currentUser.username}`;
        userDisplay.classList.remove('hidden');
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Logout';
        authBtn.onclick = logout;
    } else {
        userDisplay.classList.add('hidden');
        authBtn.innerHTML = '<i class="fas fa-user mr-2"></i>Login';
        authBtn.onclick = toggleAuth;
    }
}

function logout() {
    currentUser = null;
    updateUserDisplay();
    showNotification('Logged out successfully', 'info');
    loadAuctions();
}

// Tab functions
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active state from all tab buttons
    document.querySelectorAll('[id$="Tab"]').forEach(btn => {
        btn.classList.remove('bg-purple-600');
        btn.classList.add('hover:bg-purple-500');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Content').classList.remove('hidden');
    
    // Add active state to selected tab button
    const activeTab = document.getElementById(tabName + 'Tab');
    activeTab.classList.add('bg-purple-600');
    activeTab.classList.remove('hover:bg-purple-500');
    
    // Load tab-specific content
    if (tabName === 'auctions') {
        loadAuctions();
    } else if (tabName === 'myBids') {
        loadMyBids();
    }
}

// Auction functions
async function loadAuctions() {
    try {
        const response = await fetch('/api/auctions');
        const auctions = await response.json();
        
        const grid = document.getElementById('auctionsGrid');
        grid.innerHTML = '';
        
        auctions.forEach(auction => {
            const card = createAuctionCard(auction);
            grid.appendChild(card);
        });
    } catch (error) {
        showNotification('Failed to load auctions', 'error');
    }
}

function createAuctionCard(auction) {
    const card = document.createElement('div');
    card.className = 'glass-effect rounded-xl p-6 hover:transform hover:scale-105 transition';
    
    const endTime = new Date(auction.endTime);
    const now = new Date();
    const isExpired = endTime <= now;
    const statusColor = auction.status === 'active' && !isExpired ? 'green' : 'red';
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-bold">${auction.title}</h3>
            <span class="px-2 py-1 rounded text-xs bg-${statusColor}-500 bg-opacity-30 border border-${statusColor}-500">
                ${auction.status}
            </span>
        </div>
        <p class="text-gray-300 mb-4">${auction.description}</p>
        <div class="space-y-2 mb-4">
            <div class="flex justify-between">
                <span>Starting Bid:</span>
                <span class="font-semibold">$${auction.startingBid.toFixed(2)}</span>
            </div>
            <div class="flex justify-between">
                <span>Current Highest:</span>
                <span class="font-semibold text-green-400">$${auction.currentHighestBid.toFixed(2)}</span>
            </div>
            <div class="flex justify-between">
                <span>Bids:</span>
                <span class="font-semibold">${auction.bidCount}</span>
            </div>
            <div class="flex justify-between">
                <span>Ends:</span>
                <span class="text-sm">${endTime.toLocaleString()}</span>
            </div>
        </div>
        ${auction.winner ? `
            <div class="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-3 mb-4">
                <p class="text-sm"><strong>Winner:</strong> ${auction.winner}</p>
                <p class="text-sm"><strong>Winning Bid:</strong> $${auction.winningBid.amount.toFixed(2)}</p>
            </div>
        ` : ''}
        <div class="flex space-x-2">
            ${auction.status === 'active' && !isExpired && currentUser ? `
                <button onclick="openBidModal('${auction.id}')" class="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded-lg transition">
                    <i class="fas fa-gavel mr-2"></i>Place Bid
                </button>
            ` : ''}
            <button onclick="viewAuctionDetails('${auction.id}')" class="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded-lg transition">
                <i class="fas fa-eye mr-2"></i>Details
            </button>
        </div>
    `;
    
    return card;
}

async function handleCreateAuction(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Please login to create an auction', 'error');
        return;
    }
    
    const title = document.getElementById('auctionTitle');
    const description = document.getElementById('auctionDescription');
    const startingBid = document.getElementById('startingBid');
    const endTime = document.getElementById('endTime');
    
    // Clear previous errors
    clearFieldErrors(['auctionTitle', 'auctionDescription', 'startingBid', 'endTime']);
    
    // Validate fields
    const titleValid = validateField('auctionTitle', title.value);
    const descriptionValid = validateField('auctionDescription', description.value);
    const startingBidValid = validateField('startingBid', parseFloat(startingBid.value));
    const endTimeValid = validateField('endTime', endTime.value);
    
    if (!titleValid || !descriptionValid || !startingBidValid || !endTimeValid) {
        return;
    }
    
    try {
        const response = await fetch('/api/auctions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title.value,
                description: description.value,
                startingBid: parseFloat(startingBid.value),
                endTime: endTime.value,
                userId: currentUser.userId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Auction created successfully!', 'success');
            document.getElementById('createAuctionForm').reset();
            showTab('auctions');
        } else {
            showNotification(data.error || 'Failed to create auction', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Bid functions
function openBidModal(auctionId) {
    if (!currentUser) {
        showNotification('Please login to place a bid', 'error');
        return;
    }
    
    currentAuctionId = auctionId;
    document.getElementById('bidModal').classList.remove('hidden');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.add('hidden');
    document.getElementById('bidForm').reset();
    clearFieldErrors(['bidAmount', 'secretKey']);
    currentAuctionId = null;
}

async function handlePlaceBid(e) {
    e.preventDefault();
    
    const amount = document.getElementById('bidAmount');
    const secretKey = document.getElementById('secretKey');
    
    // Clear previous errors
    clearFieldErrors(['bidAmount', 'secretKey']);
    
    // Validate fields
    const amountValid = validateField('bidAmount', parseFloat(amount.value));
    const secretKeyValid = validateField('secretKey', secretKey.value);
    
    if (!amountValid || !secretKeyValid) {
        return;
    }
    
    try {
        const response = await fetch('/api/bids', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auctionId: currentAuctionId,
                bidderId: currentUser.userId,
                amount: parseFloat(amount.value),
                secretKey: secretKey.value
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Bid placed successfully! Save your secret key securely.', 'success');
            closeBidModal();
            loadAuctions();
        } else {
            showNotification(data.error || 'Failed to place bid', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

async function viewAuctionDetails(auctionId) {
    try {
        const response = await fetch(`/api/auctions/${auctionId}`);
        const auction = await response.json();
        
        // Show detailed view (could be enhanced with a modal)
        showNotification(`Viewing details for: ${auction.title}`, 'info');
    } catch (error) {
        showNotification('Failed to load auction details', 'error');
    }
}

async function loadMyBids() {
    if (!currentUser) {
        document.getElementById('myBidsList').innerHTML = '<p>Please login to view your bids.</p>';
        return;
    }
    
    // This would require an additional endpoint to get user's bids
    // For now, show a placeholder
    document.getElementById('myBidsList').innerHTML = '<p>Your bid history will appear here.</p>';
}

// Form validation functions
function validateField(fieldName, value) {
    const rule = validationRules[fieldName];
    if (!rule) return true;
    
    // Check required
    if (rule.required && (!value || value.toString().trim() === '')) {
        showFieldError(fieldName, 'This field is required');
        return false;
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value.toString().trim() === '') {
        return true;
    }
    
    const stringValue = value.toString().trim();
    
    // Check minimum length
    if (rule.minLength && stringValue.length < rule.minLength) {
        showFieldError(fieldName, rule.message);
        return false;
    }
    
    // Check maximum length
    if (rule.maxLength && stringValue.length > rule.maxLength) {
        showFieldError(fieldName, rule.message);
        return false;
    }
    
    // Check pattern
    if (rule.pattern && !rule.pattern.test(stringValue)) {
        showFieldError(fieldName, rule.message);
        return false;
    }
    
    // Check minimum value (for numbers)
    if (rule.min !== undefined && parseFloat(value) < rule.min) {
        showFieldError(fieldName, rule.message);
        return false;
    }
    
    // Check maximum value (for numbers)
    if (rule.max !== undefined && parseFloat(value) > rule.max) {
        showFieldError(fieldName, rule.message);
        return false;
    }
    
    // Check future date
    if (rule.futureOnly) {
        const selectedDate = new Date(value);
        const now = new Date();
        const minFutureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        
        if (selectedDate <= minFutureTime) {
            showFieldError(fieldName, rule.message);
            return false;
        }
    }
    
    return true;
}

function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    if (!field) return;
    
    // Remove existing error
    clearFieldError(fieldName);
    
    // Add error styling to field
    field.classList.add('border-red-500', 'bg-red-500', 'bg-opacity-20');
    field.classList.remove('border-white', 'border-opacity-30');
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.id = fieldName + 'Error';
    errorElement.className = 'text-red-400 text-sm mt-1 flex items-center';
    errorElement.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${message}`;
    
    // Insert error message after the field
    field.parentNode.insertBefore(errorElement, field.nextSibling);
}

function clearFieldError(fieldName) {
    const field = document.getElementById(fieldName);
    const errorElement = document.getElementById(fieldName + 'Error');
    
    if (field) {
        field.classList.remove('border-red-500', 'bg-red-500', 'bg-opacity-20');
        field.classList.add('border-white', 'border-opacity-30');
    }
    
    if (errorElement) {
        errorElement.remove();
    }
}

function clearFieldErrors(fieldNames) {
    fieldNames.forEach(fieldName => clearFieldError(fieldName));
}

// Real-time validation
function setupRealtimeValidation() {
    // Auth form fields
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    
    if (username) {
        username.addEventListener('blur', () => validateField('username', username.value));
        username.addEventListener('input', () => {
            if (username.value.length >= validationRules.username.minLength) {
                validateField('username', username.value);
            }
        });
    }
    
    if (password) {
        password.addEventListener('blur', () => validateField('password', password.value));
        password.addEventListener('input', () => {
            if (password.value.length >= validationRules.password.minLength) {
                validateField('password', password.value);
            }
        });
    }
    
    // Create auction form fields
    const auctionTitle = document.getElementById('auctionTitle');
    const auctionDescription = document.getElementById('auctionDescription');
    const startingBid = document.getElementById('startingBid');
    const endTime = document.getElementById('endTime');
    
    if (auctionTitle) {
        auctionTitle.addEventListener('blur', () => validateField('auctionTitle', auctionTitle.value));
        auctionTitle.addEventListener('input', () => {
            if (auctionTitle.value.length >= validationRules.auctionTitle.minLength) {
                validateField('auctionTitle', auctionTitle.value);
            }
        });
    }
    
    if (auctionDescription) {
        auctionDescription.addEventListener('blur', () => validateField('auctionDescription', auctionDescription.value));
        auctionDescription.addEventListener('input', () => {
            if (auctionDescription.value.length >= validationRules.auctionDescription.minLength) {
                validateField('auctionDescription', auctionDescription.value);
            }
        });
    }
    
    if (startingBid) {
        startingBid.addEventListener('blur', () => validateField('startingBid', parseFloat(startingBid.value)));
        startingBid.addEventListener('input', () => {
            if (startingBid.value) {
                validateField('startingBid', parseFloat(startingBid.value));
            }
        });
    }
    
    if (endTime) {
        endTime.addEventListener('blur', () => validateField('endTime', endTime.value));
        endTime.addEventListener('change', () => validateField('endTime', endTime.value));
    }
    
    // Bid form fields
    const bidAmount = document.getElementById('bidAmount');
    const secretKey = document.getElementById('secretKey');
    
    if (bidAmount) {
        bidAmount.addEventListener('blur', () => validateField('bidAmount', parseFloat(bidAmount.value)));
        bidAmount.addEventListener('input', () => {
            if (bidAmount.value) {
                validateField('bidAmount', parseFloat(bidAmount.value));
            }
        });
    }
    
    if (secretKey) {
        secretKey.addEventListener('blur', () => validateField('secretKey', secretKey.value));
        secretKey.addEventListener('input', () => {
            if (secretKey.value.length >= validationRules.secretKey.minLength) {
                validateField('secretKey', secretKey.value);
            }
        });
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg glass-effect animate-pulse-slow`;
    
    const colors = {
        success: 'bg-green-500 bg-opacity-20 border-green-500',
        error: 'bg-red-500 bg-opacity-20 border-red-500',
        info: 'bg-blue-500 bg-opacity-20 border-blue-500'
    };
    
    notification.classList.add(...colors[type].split(' '));
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
