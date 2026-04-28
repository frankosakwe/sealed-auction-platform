/**
 * Error Boundary Implementation
 * Catches and handles JavaScript errors in the application
 */

class ErrorBoundary {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.setupGlobalHandlers();
        this.loadErrorHistory();
    }

    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught errors and resource loading errors
        window.addEventListener('error', (event) => {
            // Check if it's a resource loading error
            if (event.target !== window && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK' || event.target.tagName === 'IMG')) {
                this.handleResourceError({
                    element: event.target.tagName,
                    src: event.target.src || event.target.href,
                    type: 'resource',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Handle JavaScript errors
            if (event.error) {
                this.handleError({
                    message: event.message || event.error.message || 'Unknown error',
                    stack: event.error.stack,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    type: 'uncaught',
                    timestamp: new Date().toISOString()
                });
                event.preventDefault();
            }
        }, true);

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            this.handleError({
                message: reason?.message || String(reason) || 'Unhandled Promise Rejection',
                stack: reason?.stack,
                type: 'promise',
                timestamp: new Date().toISOString()
            });
            event.preventDefault();
        });
    }

    /**
     * Handle application errors
     */
    handleError(error) {
        console.error('Error caught by boundary:', error);
        
        // Store error
        this.errors.unshift(error);
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
        this.saveErrorHistory();

        // Show user-friendly error message
        this.showErrorUI(error);

        // Report to error tracking service if available
        this.reportError(error);
    }

    /**
     * Handle resource loading errors
     */
    handleResourceError(error) {
        console.warn('Resource loading error:', error);
        
        // Store error
        this.errors.unshift(error);
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
        this.saveErrorHistory();

        // Show notification for resource errors
        if (typeof showNotification === 'function') {
            showNotification(`Failed to load ${error.element}: ${error.src}`, 'warning');
        }
    }

    /**
     * Show user-friendly error UI
     */
    showErrorUI(error) {
        // Don't show UI for resource errors
        if (error.type === 'resource') {
            return;
        }

        // Remove any existing error UI
        const existingError = document.getElementById('error-boundary-ui');
        if (existingError) {
            existingError.remove();
        }

        // Ensure message exists
        const message = error.message || 'An unknown error occurred';
        const stack = error.stack || '';

        // Create error UI
        const errorUI = document.createElement('div');
        errorUI.id = 'error-boundary-ui';
        errorUI.className = 'fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in';
        errorUI.innerHTML = `
            <div class="glass-effect rounded-xl p-8 max-w-lg mx-4 animate-fade-in" style="background: rgba(255, 255, 255, 0.95); color: #1a202c;">
                <div class="flex items-start mb-4">
                    <div class="flex-shrink-0">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
                    </div>
                    <div class="ml-4 flex-1">
                        <h3 class="text-xl font-bold text-red-500 mb-2">Something went wrong</h3>
                        <p class="text-sm mb-4" style="color: #4a5568;">
                            We encountered an unexpected error. Don't worry, your data is safe.
                        </p>
                        <details class="mb-4">
                            <summary class="cursor-pointer text-sm font-semibold mb-2 hover:text-purple-500" style="color: #2d3748;">
                                Error Details
                            </summary>
                            <div class="bg-gray-900 bg-opacity-50 rounded p-3 text-xs font-mono overflow-auto max-h-40">
                                <p class="text-red-400 mb-2">${this.escapeHtml(message)}</p>
                                ${stack ? `<pre class="text-gray-400 whitespace-pre-wrap">${this.escapeHtml(stack)}</pre>` : ''}
                            </div>
                        </details>
                        <div class="flex space-x-3">
                            <button onclick="window.errorBoundary.reload()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-redo mr-2"></i>Reload Page
                            </button>
                            <button onclick="window.errorBoundary.dismiss()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                                <i class="fas fa-times mr-2"></i>Dismiss
                            </button>
                        </div>
                        <button onclick="window.errorBoundary.reportIssue()" class="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                            <i class="fas fa-bug mr-2"></i>Report Issue
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(errorUI);
    }

    /**
     * Reload the page
     */
    reload() {
        window.location.reload();
    }

    /**
     * Dismiss error UI
     */
    dismiss() {
        const errorUI = document.getElementById('error-boundary-ui');
        if (errorUI) {
            errorUI.remove();
        }
    }

    /**
     * Report issue to support
     */
    reportIssue() {
        const lastError = this.errors[0];
        const errorReport = {
            message: lastError.message,
            stack: lastError.stack,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: lastError.timestamp
        };

        // Copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
            .then(() => {
                if (typeof showNotification === 'function') {
                    showNotification('Error details copied to clipboard. Please send to support.', 'success');
                }
            })
            .catch(() => {
                if (typeof showNotification === 'function') {
                    showNotification('Failed to copy error details', 'error');
                }
            });
    }

    /**
     * Report error to tracking service
     */
    reportError(error) {
        // Send to server if available
        if (typeof fetch !== 'undefined') {
            fetch('/api/errors/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...error,
                    userAgent: navigator.userAgent,
                    url: window.location.href
                })
            }).catch(err => {
                console.warn('Failed to report error to server:', err);
            });
        }
    }

    /**
     * Save error history to localStorage
     */
    saveErrorHistory() {
        try {
            localStorage.setItem('errorHistory', JSON.stringify(this.errors));
        } catch (e) {
            console.warn('Failed to save error history:', e);
        }
    }

    /**
     * Load error history from localStorage
     */
    loadErrorHistory() {
        try {
            const stored = localStorage.getItem('errorHistory');
            if (stored) {
                this.errors = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load error history:', e);
            this.errors = [];
        }
    }

    /**
     * Get error history
     */
    getErrorHistory() {
        return this.errors;
    }

    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errors = [];
        this.saveErrorHistory();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Wrap async function with error handling
     */
    wrapAsync(fn) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError({
                    message: error.message,
                    stack: error.stack,
                    type: 'async',
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        };
    }

    /**
     * Wrap function with error handling
     */
    wrap(fn) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError({
                    message: error.message,
                    stack: error.stack,
                    type: 'sync',
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        };
    }
}

// Initialize global error boundary
window.errorBoundary = new ErrorBoundary();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorBoundary;
}
