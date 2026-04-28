/**
 * Application Error Handling Integration
 * Wraps existing fetch calls with error handling and retry logic
 */

// Override global fetch with error handling
(function() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
        const [url, options = {}] = args;
        
        try {
            // Use network error handler if available
            if (window.networkErrorHandler) {
                const response = await window.networkErrorHandler.fetchWithRetry(url, options);
                return response;
            }
            
            // Fallback to original fetch
            return await originalFetch(url, options);
        } catch (error) {
            // Handle network errors
            if (window.networkErrorHandler) {
                window.networkErrorHandler.handleNetworkError(error, {
                    url,
                    method: options.method || 'GET',
                    retryCallback: () => window.fetch(url, options)
                });
            }
            throw error;
        }
    };
})();

// Enhanced notification function with error handling
const originalShowNotification = window.showNotification;
window.showNotification = function(message, type = 'info', duration = 3000) {
    try {
        if (originalShowNotification) {
            return originalShowNotification(message, type, duration);
        }
        
        // Fallback notification
        console.log(`[${type.toUpperCase()}] ${message}`);
        
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
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
};

// Initialize form validation for auth form
document.addEventListener('DOMContentLoaded', () => {
    if (window.formValidator) {
        // Auth form validation
        const authForm = document.getElementById('authForm');
        if (authForm) {
            window.formValidator.initForm('authForm', {
                rules: {
                    username: {
                        required: true,
                        minLength: 3,
                        maxLength: 20,
                        username: true,
                        message: 'Username must be 3-20 characters (letters, numbers, underscore only)'
                    },
                    password: {
                        required: true,
                        minLength: 8,
                        message: 'Password must be at least 8 characters'
                    }
                },
                onSubmit: async (data, form) => {
                    const isLogin = document.getElementById('authTitle')?.textContent === 'Login';
                    const endpoint = isLogin ? '/api/auth/login' : '/api/users';
                    
                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await response.json();
                        
                        if (!response.ok || result.error) {
                            throw new Error(result.error || 'Authentication failed');
                        }
                        
                        // Update global currentUser if it exists
                        if (typeof window.currentUser !== 'undefined') {
                            window.currentUser = result;
                        }
                        localStorage.setItem('currentUser', JSON.stringify(result));
                        
                        // Call app functions if they exist
                        if (typeof hideAuthModal === 'function') hideAuthModal();
                        if (typeof updateUserDisplay === 'function') updateUserDisplay();
                        if (typeof checkAdminAccess === 'function') checkAdminAccess();
                        
                        showNotification(`Successfully ${isLogin ? 'logged in' : 'registered'}!`, 'success');
                        
                        if (typeof loadAuctions === 'function') loadAuctions(true);
                        
                        form.reset();
                    } catch (error) {
                        throw error;
                    }
                }
            });
        }
        
        // Create auction form validation
        const createAuctionForm = document.getElementById('createAuctionForm');
        if (createAuctionForm) {
            window.formValidator.initForm('createAuctionForm', {
                rules: {
                    title: {
                        required: true,
                        minLength: 3,
                        maxLength: 100,
                        message: 'Title must be 3-100 characters'
                    },
                    description: {
                        required: true,
                        minLength: 10,
                        maxLength: 500,
                        message: 'Description must be 10-500 characters'
                    },
                    startingBid: {
                        required: true,
                        number: true,
                        positive: true,
                        min: 0.01,
                        message: 'Starting bid must be a positive number (minimum 0.01)'
                    },
                    endTime: {
                        required: true,
                        date: true,
                        futureDate: true,
                        message: 'End time must be a valid future date'
                    }
                },
                onSubmit: async (data, form) => {
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
                    
                    if (!currentUser) {
                        showNotification('Please login to create an auction', 'error');
                        if (typeof showAuthModal === 'function') showAuthModal();
                        return;
                    }
                    
                    try {
                        const endTime = new Date(data.endTime);
                        
                        const auctionData = {
                            title: data.title,
                            description: data.description,
                            startingBid: parseFloat(data.startingBid),
                            endTime: endTime.toISOString(),
                            userId: currentUser.userId
                        };
                        
                        const response = await fetch('/api/auctions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${currentUser.token}`
                            },
                            body: JSON.stringify(auctionData)
                        });
                        
                        const result = await response.json();
                        
                        if (!response.ok || result.error) {
                            throw new Error(result.error || 'Failed to create auction');
                        }
                        
                        showNotification('Auction created successfully!', 'success');
                        form.reset();
                    } catch (error) {
                        throw error;
                    }
                }
            });
        }
        
        // Bid form validation
        const bidForm = document.getElementById('bidForm');
        if (bidForm) {
            window.formValidator.initForm('bidForm', {
                rules: {
                    amount: {
                        required: true,
                        number: true,
                        positive: true,
                        min: 0.01,
                        message: 'Bid amount must be a positive number (minimum 0.01)'
                    },
                    secretKey: {
                        required: true,
                        minLength: 8,
                        message: 'Secret key must be at least 8 characters'
                    }
                },
                onSubmit: async (data, form) => {
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
                    const bidModal = document.getElementById('bidModal');
                    const auctionId = bidModal?.dataset?.auctionId;
                    
                    if (!currentUser || !auctionId) {
                        showNotification('Please login to place a bid', 'error');
                        return;
                    }
                    
                    try {
                        const response = await fetch(`/api/auctions/${auctionId}/bids`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${currentUser.token}`
                            },
                            body: JSON.stringify({
                                amount: parseFloat(data.amount),
                                secretKey: data.secretKey
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (!response.ok || result.error) {
                            throw new Error(result.error || 'Failed to place bid');
                        }
                        
                        showNotification('Bid placed successfully!', 'success');
                        if (bidModal) bidModal.classList.add('hidden');
                        form.reset();
                    } catch (error) {
                        throw error;
                    }
                }
            });
        }
    }
});

// Monitor network status
if (window.networkErrorHandler) {
    setInterval(() => {
        const status = window.networkErrorHandler.getNetworkStatus();
        
        // Update UI with network status if needed
        const networkIndicator = document.getElementById('network-status-indicator');
        if (networkIndicator) {
            networkIndicator.className = status.online ? 'online' : 'offline';
            networkIndicator.title = `Network: ${status.online ? 'Online' : 'Offline'}`;
        }
    }, 5000);
}

// Add error recovery button to UI
function addErrorRecoveryButton() {
    const errorHistory = window.errorBoundary?.getErrorHistory() || [];
    
    if (errorHistory.length > 0) {
        const button = document.createElement('button');
        button.id = 'error-recovery-button';
        button.className = 'fixed bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center space-x-2';
        button.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${errorHistory.length} Error${errorHistory.length > 1 ? 's' : ''}</span>
        `;
        
        button.addEventListener('click', () => {
            if (window.errorBoundary) {
                const errors = window.errorBoundary.getErrorHistory();
                console.log('Error History:', errors);
                
                if (confirm('Clear error history?')) {
                    window.errorBoundary.clearErrorHistory();
                    button.remove();
                }
            }
        });
        
        // Only add if not already present
        if (!document.getElementById('error-recovery-button')) {
            document.body.appendChild(button);
        }
    }
}

// Check for errors periodically
setInterval(addErrorRecoveryButton, 10000);

// Export for debugging
window.errorHandling = {
    getErrors: () => window.errorBoundary?.getErrorHistory() || [],
    clearErrors: () => window.errorBoundary?.clearErrorHistory(),
    getNetworkStatus: () => window.networkErrorHandler?.getNetworkStatus(),
    testError: () => {
        throw new Error('Test error from error handling system');
    }
};

console.log('Error handling integration loaded. Use window.errorHandling for debugging.');
