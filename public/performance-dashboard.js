/**
 * Performance Dashboard Module
 * Real-time performance monitoring and Core Web Vitals tracking
 */

class PerformanceDashboard {
    constructor() {
        this.metrics = {
            coreWebVitals: {
                lcp: { value: 0, rating: 'good', threshold: { good: 2500, poor: 4000 } },
                fid: { value: 0, rating: 'good', threshold: { good: 100, poor: 300 } },
                cls: { value: 0, rating: 'good', threshold: { good: 0.1, poor: 0.25 } }
            },
            navigation: {
                loadTime: 0,
                domContentLoaded: 0,
                firstPaint: 0,
                firstContentfulPaint: 0
            },
            resources: {
                totalSize: 0,
                resourceCount: 0,
                cachedResources: 0
            },
            userExperience: {
                interactionDelay: 0,
                longTasks: 0,
                memoryUsage: 0
            }
        };
        
        this.history = [];
        this.observers = [];
        this.isVisible = false;
        
        this.init();
    }

    init() {
        this.setupPerformanceObservers();
        this.measureNavigationTiming();
        this.measureResourceTiming();
        this.setupUserExperienceMetrics();
        this.createDashboardUI();
        this.startRealTimeMonitoring();
    }

    setupPerformanceObservers() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.coreWebVitals.lcp.value = lastEntry.startTime;
                this.metrics.coreWebVitals.lcp.rating = this.getRating(
                    this.metrics.coreWebVitals.lcp.value,
                    this.metrics.coreWebVitals.lcp.threshold
                );
                this.updateDashboard();
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);
        }

        // First Input Delay (FID)
        if ('PerformanceObserver' in window) {
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.name === 'first-input') {
                        this.metrics.coreWebVitals.fid.value = entry.processingStart - entry.startTime;
                        this.metrics.coreWebVitals.fid.rating = this.getRating(
                            this.metrics.coreWebVitals.fid.value,
                            this.metrics.coreWebVitals.fid.threshold
                        );
                        this.updateDashboard();
                    }
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            this.observers.push(fidObserver);
        }

        // Cumulative Layout Shift (CLS)
        if ('PerformanceObserver' in window) {
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        this.metrics.coreWebVitals.cls.value = clsValue;
                        this.metrics.coreWebVitals.cls.rating = this.getRating(
                            this.metrics.coreWebVitals.cls.value,
                            this.metrics.coreWebVitals.cls.threshold
                        );
                        this.updateDashboard();
                    }
                });
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(clsObserver);
        }

        // Long Tasks
        if ('PerformanceObserver' in window) {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.duration > 50) {
                        this.metrics.userExperience.longTasks++;
                        this.updateDashboard();
                    }
                });
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.push(longTaskObserver);
        }
    }

    measureNavigationTiming() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            
            this.metrics.navigation.loadTime = navigation.loadEventEnd - navigation.fetchStart;
            this.metrics.navigation.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
            
            // Paint timing
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (entry.name === 'first-paint') {
                    this.metrics.navigation.firstPaint = entry.startTime;
                } else if (entry.name === 'first-contentful-paint') {
                    this.metrics.navigation.firstContentfulPaint = entry.startTime;
                }
            });
            
            this.updateDashboard();
            this.saveMetricsToHistory();
        });
    }

    measureResourceTiming() {
        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            
            this.metrics.resources.resourceCount = resources.length;
            this.metrics.resources.totalSize = resources.reduce((total, resource) => {
                return total + (resource.transferSize || 0);
            }, 0);
            
            // Count cached resources
            this.metrics.resources.cachedResources = resources.filter(resource => 
                resource.transferSize === 0 && resource.decodedBodySize > 0
            ).length;
            
            this.updateDashboard();
        });
    }

    setupUserExperienceMetrics() {
        // Measure interaction delay
        let lastInteractionTime = 0;
        document.addEventListener('click', (event) => {
            const now = performance.now();
            if (lastInteractionTime > 0) {
                const delay = now - lastInteractionTime;
                this.metrics.userExperience.interactionDelay = Math.max(
                    this.metrics.userExperience.interactionDelay, delay
                );
            }
            lastInteractionTime = now;
        });

        // Monitor memory usage (if available)
        if ('memory' in performance) {
            setInterval(() => {
                this.metrics.userExperience.memoryUsage = performance.memory.usedJSHeapSize;
                this.updateDashboard();
            }, 5000);
        }
    }

    createDashboardUI() {
        const dashboard = document.createElement('div');
        dashboard.id = 'performance-dashboard';
        dashboard.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl p-4 w-96 z-50 hidden';
        dashboard.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-gray-800">Performance Dashboard</h3>
                <div class="flex gap-2">
                    <button id="toggle-dashboard" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button id="close-dashboard" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="space-y-4">
                <!-- Core Web Vitals -->
                <div class="border-b pb-3">
                    <h4 class="font-semibold text-sm text-gray-600 mb-2">Core Web Vitals</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">LCP</span>
                            <div class="flex items-center gap-2">
                                <span id="lcp-value" class="text-sm font-mono">0ms</span>
                                <span id="lcp-rating" class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Good</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">FID</span>
                            <div class="flex items-center gap-2">
                                <span id="fid-value" class="text-sm font-mono">0ms</span>
                                <span id="fid-rating" class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Good</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">CLS</span>
                            <div class="flex items-center gap-2">
                                <span id="cls-value" class="text-sm font-mono">0.000</span>
                                <span id="cls-rating" class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Good</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Navigation Timing -->
                <div class="border-b pb-3">
                    <h4 class="font-semibold text-sm text-gray-600 mb-2">Navigation Timing</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Load Time</span>
                            <span id="load-time" class="text-sm font-mono">0ms</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">DOM Content</span>
                            <span id="dom-content" class="text-sm font-mono">0ms</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">First Paint</span>
                            <span id="first-paint" class="text-sm font-mono">0ms</span>
                        </div>
                    </div>
                </div>
                
                <!-- Resources -->
                <div class="border-b pb-3">
                    <h4 class="font-semibold text-sm text-gray-600 mb-2">Resources</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Total Size</span>
                            <span id="total-size" class="text-sm font-mono">0KB</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Resources</span>
                            <span id="resource-count" class="text-sm font-mono">0</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Cached</span>
                            <span id="cached-resources" class="text-sm font-mono">0</span>
                        </div>
                    </div>
                </div>
                
                <!-- User Experience -->
                <div>
                    <h4 class="font-semibold text-sm text-gray-600 mb-2">User Experience</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Interaction Delay</span>
                            <span id="interaction-delay" class="text-sm font-mono">0ms</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Long Tasks</span>
                            <span id="long-tasks" class="text-sm font-mono">0</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">Memory</span>
                            <span id="memory-usage" class="text-sm font-mono">0MB</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 pt-3 border-t">
                <button id="export-metrics" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition text-sm">
                    <i class="fas fa-download mr-2"></i>Export Metrics
                </button>
            </div>
        `;

        document.body.appendChild(dashboard);
        this.setupDashboardEventListeners();
    }

    setupDashboardEventListeners() {
        const dashboard = document.getElementById('performance-dashboard');
        
        // Toggle dashboard
        document.getElementById('toggle-dashboard').addEventListener('click', () => {
            const content = dashboard.querySelector('.space-y-4');
            const button = document.getElementById('toggle-dashboard');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                button.innerHTML = '<i class="fas fa-minus"></i>';
            } else {
                content.style.display = 'none';
                button.innerHTML = '<i class="fas fa-plus"></i>';
            }
        });

        // Close dashboard
        document.getElementById('close-dashboard').addEventListener('click', () => {
            dashboard.classList.add('hidden');
            this.isVisible = false;
        });

        // Export metrics
        document.getElementById('export-metrics').addEventListener('click', () => {
            this.exportMetrics();
        });

        // Keyboard shortcut to toggle dashboard (Ctrl+Shift+P)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.toggleDashboard();
            }
        });
    }

    toggleDashboard() {
        const dashboard = document.getElementById('performance-dashboard');
        if (this.isVisible) {
            dashboard.classList.add('hidden');
        } else {
            dashboard.classList.remove('hidden');
        }
        this.isVisible = !this.isVisible;
    }

    updateDashboard() {
        // Update Core Web Vitals
        document.getElementById('lcp-value').textContent = `${Math.round(this.metrics.coreWebVitals.lcp.value)}ms`;
        document.getElementById('lcp-rating').textContent = this.capitalizeFirst(this.metrics.coreWebVitals.lcp.rating);
        document.getElementById('lcp-rating').className = this.getRatingClass(this.metrics.coreWebVitals.lcp.rating);

        document.getElementById('fid-value').textContent = `${Math.round(this.metrics.coreWebVitals.fid.value)}ms`;
        document.getElementById('fid-rating').textContent = this.capitalizeFirst(this.metrics.coreWebVitals.fid.rating);
        document.getElementById('fid-rating').className = this.getRatingClass(this.metrics.coreWebVitals.fid.rating);

        document.getElementById('cls-value').textContent = this.metrics.coreWebVitals.cls.value.toFixed(3);
        document.getElementById('cls-rating').textContent = this.capitalizeFirst(this.metrics.coreWebVitals.cls.rating);
        document.getElementById('cls-rating').className = this.getRatingClass(this.metrics.coreWebVitals.cls.rating);

        // Update Navigation Timing
        document.getElementById('load-time').textContent = `${Math.round(this.metrics.navigation.loadTime)}ms`;
        document.getElementById('dom-content').textContent = `${Math.round(this.metrics.navigation.domContentLoaded)}ms`;
        document.getElementById('first-paint').textContent = `${Math.round(this.metrics.navigation.firstPaint)}ms`;

        // Update Resources
        document.getElementById('total-size').textContent = `${(this.metrics.resources.totalSize / 1024).toFixed(1)}KB`;
        document.getElementById('resource-count').textContent = this.metrics.resources.resourceCount;
        document.getElementById('cached-resources').textContent = this.metrics.resources.cachedResources;

        // Update User Experience
        document.getElementById('interaction-delay').textContent = `${Math.round(this.metrics.userExperience.interactionDelay)}ms`;
        document.getElementById('long-tasks').textContent = this.metrics.userExperience.longTasks;
        document.getElementById('memory-usage').textContent = `${(this.metrics.userExperience.memoryUsage / 1024 / 1024).toFixed(1)}MB`;
    }

    getRating(value, threshold) {
        if (value <= threshold.good) return 'good';
        if (value <= threshold.poor) return 'needs-improvement';
        return 'poor';
    }

    getRatingClass(rating) {
        switch (rating) {
            case 'good':
                return 'text-xs px-2 py-1 rounded bg-green-100 text-green-800';
            case 'needs-improvement':
                return 'text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800';
            case 'poor':
                return 'text-xs px-2 py-1 rounded bg-red-100 text-red-800';
            default:
                return 'text-xs px-2 py-1 rounded bg-gray-100 text-gray-800';
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).replace('-', ' ');
    }

    saveMetricsToHistory() {
        const snapshot = {
            timestamp: new Date().toISOString(),
            metrics: JSON.parse(JSON.stringify(this.metrics))
        };
        
        this.history.push(snapshot);
        
        // Keep only last 100 snapshots
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
        
        // Save to localStorage
        localStorage.setItem('performanceHistory', JSON.stringify(this.history));
    }

    exportMetrics() {
        const data = {
            currentMetrics: this.metrics,
            history: this.history,
            browserInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            },
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-metrics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    startRealTimeMonitoring() {
        // Update dashboard every second
        setInterval(() => {
            if (this.isVisible) {
                this.updateDashboard();
            }
        }, 1000);

        // Save metrics every 30 seconds
        setInterval(() => {
            this.saveMetricsToHistory();
        }, 30000);
    }

    // Performance recommendations
    getRecommendations() {
        const recommendations = [];
        
        if (this.metrics.coreWebVitals.lcp.value > 2500) {
            recommendations.push('Optimize largest contentful paint by reducing image sizes and server response time');
        }
        
        if (this.metrics.coreWebVitals.fid.value > 100) {
            recommendations.push('Reduce first input delay by minimizing JavaScript execution time');
        }
        
        if (this.metrics.coreWebVitals.cls.value > 0.1) {
            recommendations.push('Reduce cumulative layout shift by ensuring proper image dimensions and avoiding content shifts');
        }
        
        if (this.metrics.navigation.loadTime > 3000) {
            recommendations.push('Optimize load time by implementing better caching and reducing bundle size');
        }
        
        if (this.metrics.resources.totalSize > 1024 * 1024) { // 1MB
            recommendations.push('Reduce total resource size by compressing images and minifying assets');
        }
        
        return recommendations;
    }

    // Generate performance report
    generateReport() {
        const report = {
            summary: {
                overallScore: this.calculateOverallScore(),
                grade: this.calculateGrade(),
                recommendations: this.getRecommendations()
            },
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };
        
        return report;
    }

    calculateOverallScore() {
        let score = 100;
        
        // Deduct points for poor metrics
        if (this.metrics.coreWebVitals.lcp.rating === 'poor') score -= 25;
        else if (this.metrics.coreWebVitals.lcp.rating === 'needs-improvement') score -= 10;
        
        if (this.metrics.coreWebVitals.fid.rating === 'poor') score -= 25;
        else if (this.metrics.coreWebVitals.fid.rating === 'needs-improvement') score -= 10;
        
        if (this.metrics.coreWebVitals.cls.rating === 'poor') score -= 25;
        else if (this.metrics.coreWebVitals.cls.rating === 'needs-improvement') score -= 10;
        
        if (this.metrics.navigation.loadTime > 3000) score -= 15;
        
        return Math.max(0, score);
    }

    calculateGrade() {
        const score = this.calculateOverallScore();
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }
}

// Initialize performance dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.performanceDashboard = new PerformanceDashboard();
    
    // Show notification in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            notification.innerHTML = `
                <i class="fas fa-info-circle mr-2"></i>
                Press Ctrl+Shift+P to open Performance Dashboard
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 5000);
        }, 2000);
    }
});

// Export for use in other modules
window.PerformanceDashboard = PerformanceDashboard;
