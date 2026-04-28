/**
 * Performance Optimization Module
 * Handles lazy loading, code splitting, and performance monitoring
 */

class PerformanceOptimizer {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
        this.performanceMetrics = {
            navigationStart: performance.now(),
            loadTime: 0,
            domContentLoaded: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            firstInputDelay: 0,
            cumulativeLayoutShift: 0
        };
        
        this.init();
    }

    init() {
        this.setupPerformanceObserver();
        this.measureInitialLoad();
        this.setupIntersectionObserver();
        this.preloadCriticalResources();
    }

    // Performance monitoring setup
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            // Core Web Vitals monitoring
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    switch (entry.entryType) {
                        case 'largest-contentful-paint':
                            this.performanceMetrics.largestContentfulPaint = entry.startTime;
                            break;
                        case 'first-input':
                            this.performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
                            break;
                        case 'layout-shift':
                            if (!entry.hadRecentInput) {
                                this.performanceMetrics.cumulativeLayoutShift += entry.value;
                            }
                            break;
                    }
                }
                this.reportMetrics();
            });

            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
        }
    }

    measureInitialLoad() {
        window.addEventListener('load', () => {
            this.performanceMetrics.loadTime = performance.now() - this.performanceMetrics.navigationStart;
            this.performanceMetrics.domContentLoaded = performance.now() - this.performanceMetrics.navigationStart;
            this.reportMetrics();
        });
    }

    reportMetrics() {
        const metrics = {
            ...this.performanceMetrics,
            timestamp: new Date().toISOString()
        };

        // Send to analytics or monitoring service
        console.log('Performance Metrics:', metrics);
        
        // Store for analysis
        this.storeMetrics(metrics);
        
        // Check performance thresholds
        this.checkPerformanceThresholds(metrics);
    }

    storeMetrics(metrics) {
        const storedMetrics = JSON.parse(localStorage.getItem('performanceMetrics') || '[]');
        storedMetrics.push(metrics);
        
        // Keep only last 100 entries
        if (storedMetrics.length > 100) {
            storedMetrics.splice(0, storedMetrics.length - 100);
        }
        
        localStorage.setItem('performanceMetrics', JSON.stringify(storedMetrics));
    }

    checkPerformanceThresholds(metrics) {
        const thresholds = {
            loadTime: 3000,
            largestContentfulPaint: 2500,
            firstInputDelay: 100,
            cumulativeLayoutShift: 0.1
        };

        const issues = [];
        
        if (metrics.loadTime > thresholds.loadTime) {
            issues.push(`Load time ${Math.round(metrics.loadTime)}ms exceeds ${thresholds.loadTime}ms threshold`);
        }
        
        if (metrics.largestContentfulPaint > thresholds.largestContentfulPaint) {
            issues.push(`LCP ${Math.round(metrics.largestContentfulPaint)}ms exceeds ${thresholds.largestContentfulPaint}ms threshold`);
        }
        
        if (metrics.firstInputDelay > thresholds.firstInputDelay) {
            issues.push(`FID ${Math.round(metrics.firstInputDelay)}ms exceeds ${thresholds.firstInputDelay}ms threshold`);
        }
        
        if (metrics.cumulativeLayoutShift > thresholds.cumulativeLayoutShift) {
            issues.push(`CLS ${metrics.cumulativeLayoutShift.toFixed(3)} exceeds ${thresholds.cumulativeLayoutShift} threshold`);
        }

        if (issues.length > 0) {
            console.warn('Performance Issues:', issues);
            this.showPerformanceWarnings(issues);
        }
    }

    showPerformanceWarnings(issues) {
        // Create performance warning banner
        const warningBanner = document.createElement('div');
        warningBanner.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
        warningBanner.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <i class="fas fa-exclamation-triangle mt-0.5"></i>
                </div>
                <div class="ml-3">
                    <h4 class="text-sm font-medium">Performance Issues Detected</h4>
                    <div class="mt-1 text-sm">
                        ${issues.map(issue => `<div>• ${issue}</div>`).join('')}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-auto pl-3">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(warningBanner);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warningBanner.parentElement) {
                warningBanner.remove();
            }
        }, 10000);
    }

    // Lazy loading for modules
    async loadModule(moduleName, modulePath) {
        if (this.loadedModules.has(moduleName)) {
            return;
        }

        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        const loadPromise = this.loadScript(modulePath)
            .then(() => {
                this.loadedModules.add(moduleName);
                this.loadingPromises.delete(moduleName);
                console.log(`Module ${moduleName} loaded successfully`);
            })
            .catch(error => {
                this.loadingPromises.delete(moduleName);
                console.error(`Failed to load module ${moduleName}:`, error);
                throw error;
            });

        this.loadingPromises.set(moduleName, loadPromise);
        return loadPromise;
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Intersection observer for lazy loading
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        const moduleName = element.dataset.module;
                        const modulePath = element.dataset.modulePath;
                        
                        if (moduleName && modulePath) {
                            this.loadModule(moduleName, modulePath);
                            observer.unobserve(element);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });

            // Observe elements with data-module attributes
            document.querySelectorAll('[data-module]').forEach(element => {
                observer.observe(element);
            });
        }
    }

    // Preload critical resources
    preloadCriticalResources() {
        const criticalResources = [
            '/app.js',
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            
            if (resource.endsWith('.js')) {
                link.as = 'script';
            } else if (resource.endsWith('.css')) {
                link.as = 'style';
            }
            
            document.head.appendChild(link);
        });
    }

    // Image optimization
    optimizeImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            });
        }
    }

    // Bundle analysis
    analyzeBundle() {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const totalSize = scripts.reduce((total, script) => {
            // Estimate size based on URL (would need actual size in production)
            return total + (script.src.length * 10); // Rough estimate
        }, 0);

        console.log(`Estimated bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
        return totalSize;
    }

    // Caching strategies
    setupCaching() {
        // Check if service worker is supported
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }

        // Setup memory caching for API responses
        this.setupAPICache();
    }

    setupAPICache() {
        const cache = new Map();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        window.fetch = new Proxy(window.fetch, {
            apply(target, thisArg, argumentsList) {
                const [url, options = {}] = argumentsList;
                
                // Only cache GET requests
                if (options.method !== 'GET' && options.method !== undefined) {
                    return target.apply(thisArg, argumentsList);
                }

                const cacheKey = url;
                const cached = cache.get(cacheKey);
                
                if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                    console.log(`Cache hit for ${url}`);
                    return Promise.resolve(new Response(JSON.stringify(cached.data), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }

                return target.apply(thisArg, argumentsList)
                    .then(response => {
                        if (response.ok) {
                            response.clone().json().then(data => {
                                cache.set(cacheKey, {
                                    data,
                                    timestamp: Date.now()
                                });
                            });
                        }
                        return response;
                    });
            }
        });
    }

    // Performance optimization utilities
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

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Initialize performance optimizer
const performanceOptimizer = new PerformanceOptimizer();

// Export for use in other modules
window.PerformanceOptimizer = PerformanceOptimizer;
window.performanceOptimizer = performanceOptimizer;
