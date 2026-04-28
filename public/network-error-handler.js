/**
 * Network Error Handler
 * Handles network errors with retry mechanisms and user-friendly messages
 */

class NetworkErrorHandler {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
    }

    /**
     * Setup network status listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });
    }

    /**
     * Handle online event
     */
    handleOnline() {
        if (typeof showNotification === 'function') {
            showNotification('Connection restored! Syncing data...', 'success');
        }
        this.processQueue();
    }

    /**
     * Handle offline event
     */
    handleOffline() {
        if (typeof showNotification === 'function') {
            showNotification('You are offline. Changes will be saved locally.', 'warning');
        }
    }

    /**
     * Enhanced fetch with retry logic
     */
    async fetchWithRetry(url, options = {}, retries = this.retryAttempts) {
        // Check if online
        if (!this.isOnline) {
            return this.queueRequest(url, options);
        }

        const controller = new AbortController();
        const timeout = options.timeout || 30000; // 30 seconds default
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                throw new NetworkError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    response
                );
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            // Handle abort/timeout
            if (error.name === 'AbortError') {
                throw new NetworkError('Request timeout', 408);
            }

            // Handle network errors with retry
            if (retries > 0 && this.shouldRetry(error)) {
                await this.delay(this.retryDelay * (this.retryAttempts - retries + 1));
                return this.fetchWithRetry(url, options, retries - 1);
            }

            throw error;
        }
    }

    /**
     * Determine if request should be retried
     */
    shouldRetry(error) {
        // Retry on network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return true;
        }

        // Retry on specific HTTP status codes
        if (error instanceof NetworkError) {
            const retryableStatuses = [408, 429, 500, 502, 503, 504];
            return retryableStatuses.includes(error.status);
        }

        return false;
    }

    /**
     * Queue request for later processing
     */
    queueRequest(url, options) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                url,
                options,
                resolve,
                reject,
                timestamp: Date.now()
            });

            if (typeof showNotification === 'function') {
                showNotification('Request queued. Will retry when online.', 'info');
            }
        });
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.requestQueue.length === 0) return;

        const queue = [...this.requestQueue];
        this.requestQueue = [];

        for (const request of queue) {
            try {
                const response = await this.fetchWithRetry(request.url, request.options);
                request.resolve(response);
            } catch (error) {
                request.reject(error);
            }
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Handle network error with user-friendly message
     */
    handleNetworkError(error, context = {}) {
        console.error('Network error:', error, context);

        let message = 'Network error occurred';
        let showRetry = true;

        if (error instanceof NetworkError) {
            switch (error.status) {
                case 400:
                    message = 'Invalid request. Please check your input.';
                    showRetry = false;
                    break;
                case 401:
                    message = 'Authentication required. Please log in.';
                    showRetry = false;
                    this.handleAuthError();
                    break;
                case 403:
                    message = 'Access denied. You don\'t have permission.';
                    showRetry = false;
                    break;
                case 404:
                    message = 'Resource not found.';
                    showRetry = false;
                    break;
                case 408:
                    message = 'Request timeout. Please try again.';
                    break;
                case 429:
                    message = 'Too many requests. Please wait a moment.';
                    break;
                case 500:
                    message = 'Server error. Please try again later.';
                    break;
                case 502:
                case 503:
                case 504:
                    message = 'Service temporarily unavailable. Please try again.';
                    break;
                default:
                    message = `Network error (${error.status}). Please try again.`;
            }
        } else if (error.name === 'AbortError') {
            message = 'Request timeout. Please check your connection.';
        } else if (!this.isOnline) {
            message = 'No internet connection. Please check your network.';
        }

        this.showNetworkErrorUI(message, showRetry, context);
    }

    /**
     * Show network error UI
     */
    showNetworkErrorUI(message, showRetry = true, context = {}) {
        // Use notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        }

        // Show retry button if applicable
        if (showRetry && context.retryCallback) {
            this.showRetryButton(context.retryCallback);
        }
    }

    /**
     * Show retry button
     */
    showRetryButton(retryCallback) {
        // Remove existing retry button
        const existingButton = document.getElementById('network-retry-button');
        if (existingButton) {
            existingButton.remove();
        }

        // Create retry button
        const retryButton = document.createElement('div');
        retryButton.id = 'network-retry-button';
        retryButton.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in';
        retryButton.innerHTML = `
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg transition-all flex items-center space-x-2">
                <i class="fas fa-redo"></i>
                <span>Retry</span>
            </button>
        `;

        retryButton.querySelector('button').addEventListener('click', () => {
            retryButton.remove();
            retryCallback();
        });

        document.body.appendChild(retryButton);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.getElementById('network-retry-button')) {
                retryButton.remove();
            }
        }, 10000);
    }

    /**
     * Handle authentication errors
     */
    handleAuthError() {
        // Clear stored user data
        localStorage.removeItem('currentUser');
        
        // Redirect to login after a delay
        setTimeout(() => {
            if (typeof showAuthModal === 'function') {
                showAuthModal();
            }
        }, 2000);
    }

    /**
     * Get network status
     */
    getNetworkStatus() {
        return {
            online: this.isOnline,
            queuedRequests: this.requestQueue.length,
            effectiveType: navigator.connection?.effectiveType || 'unknown',
            downlink: navigator.connection?.downlink || 'unknown',
            rtt: navigator.connection?.rtt || 'unknown'
        };
    }

    /**
     * Clear request queue
     */
    clearQueue() {
        this.requestQueue.forEach(request => {
            request.reject(new Error('Request cancelled'));
        });
        this.requestQueue = [];
    }
}

/**
 * Custom Network Error class
 */
class NetworkError extends Error {
    constructor(message, status, response = null) {
        super(message);
        this.name = 'NetworkError';
        this.status = status;
        this.response = response;
    }
}

// Initialize global network error handler
window.networkErrorHandler = new NetworkErrorHandler();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NetworkErrorHandler, NetworkError };
}
