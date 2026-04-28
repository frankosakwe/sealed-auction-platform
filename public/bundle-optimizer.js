/**
 * Bundle Optimization Module
 * Handles dynamic imports, tree shaking simulation, and bundle analysis
 */

class BundleOptimizer {
    constructor() {
        this.loadedModules = new Map();
        this.bundleAnalysis = {
            totalSize: 0,
            modules: [],
            dependencies: new Map(),
            unusedCode: new Set()
        };
        
        this.init();
    }

    init() {
        this.analyzeCurrentBundle();
        this.setupDynamicImports();
        this.setupCodeSplitting();
        this.optimizeLoadingOrder();
    }

    analyzeCurrentBundle() {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        let totalSize = 0;
        const modules = [];

        scripts.forEach(script => {
            const size = this.estimateScriptSize(script.src);
            totalSize += size;
            
            modules.push({
                name: this.getModuleName(script.src),
                src: script.src,
                size: size,
                loaded: true,
                critical: this.isCriticalScript(script.src)
            });
        });

        // Analyze inline scripts
        const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
        inlineScripts.forEach((script, index) => {
            const size = script.textContent.length;
            totalSize += size;
            
            modules.push({
                name: `inline-${index}`,
                src: 'inline',
                size: size,
                loaded: true,
                critical: true
            });
        });

        this.bundleAnalysis.totalSize = totalSize;
        this.bundleAnalysis.modules = modules;

        console.log('Bundle Analysis:', this.bundleAnalysis);
        this.reportBundleSize();
    }

    estimateScriptSize(src) {
        // Estimate size based on URL - in production this would be actual file size
        if (src.includes('cdn')) {
            return 50000; // 50KB average for CDN resources
        } else if (src.includes('socket.io')) {
            return 100000; // 100KB for Socket.io
        } else if (src.includes('stellar')) {
            return 80000; // 80KB for Stellar SDK
        } else {
            return 30000; // 30KB average for other scripts
        }
    }

    getModuleName(src) {
        const parts = src.split('/');
        return parts[parts.length - 1].split('.')[0] || 'unknown';
    }

    isCriticalScript(src) {
        const criticalScripts = [
            'performance-optimizer',
            'app.js',
            'tailwindcss',
            'font-awesome'
        ];
        
        return criticalScripts.some(critical => src.includes(critical));
    }

    reportBundleSize() {
        const totalKB = (this.bundleAnalysis.totalSize / 1024).toFixed(1);
        const criticalSize = this.bundleAnalysis.modules
            .filter(m => m.critical)
            .reduce((sum, m) => sum + m.size, 0) / 1024;
        
        console.log(`📦 Bundle Size: ${totalKB} KB`);
        console.log(`⚡ Critical Path: ${criticalSize.toFixed(1)} KB`);
        
        // Show warning if bundle is too large
        if (this.bundleAnalysis.totalSize > 1024 * 1024) { // 1MB
            console.warn('⚠️ Bundle size exceeds 1MB. Consider code splitting.');
        }
    }

    setupDynamicImports() {
        // Create a dynamic import system
        window.dynamicImport = (moduleName, modulePath) => {
            return new Promise((resolve, reject) => {
                if (this.loadedModules.has(moduleName)) {
                    resolve(this.loadedModules.get(moduleName));
                    return;
                }

                this.loadModule(moduleName, modulePath)
                    .then(module => {
                        this.loadedModules.set(moduleName, module);
                        resolve(module);
                    })
                    .catch(reject);
            });
        };
    }

    async loadModule(moduleName, modulePath) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath;
            script.async = true;
            
            script.onload = () => {
                // Try to get the module from global scope
                const module = window[moduleName] || window[`${moduleName}Module`];
                if (module) {
                    resolve(module);
                } else {
                    resolve({ loaded: true });
                }
            };
            
            script.onerror = () => {
                reject(new Error(`Failed to load module: ${moduleName}`));
            };
            
            document.head.appendChild(script);
        });
    }

    setupCodeSplitting() {
        // Define code splitting points
        const codeSplitPoints = {
            // Route-based splitting
            dashboard: {
                path: '/dashboard.js',
                trigger: '#dashboardLink, [data-route="dashboard"]'
            },
            bookmarks: {
                path: '/bookmarks.js',
                trigger: '#bookmarksLink, [data-route="bookmarks"]'
            },
            analytics: {
                path: '/bid-analytics.js',
                trigger: '#analyticsLink, [data-route="analytics"]'
            },
            
            // Feature-based splitting
            features: {
                path: '/features.js',
                trigger: '[data-module="features"]'
            },
            auctions: {
                path: '/auctions.js',
                trigger: '[data-module="auctions"]'
            },
            imageOptimizer: {
                path: '/image-optimizer.js',
                trigger: 'img[data-src]'
            },
            
            // Vendor splitting
            charts: {
                path: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
                trigger: '[data-chart]'
            },
            pdf: {
                path: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
                trigger: '[data-pdf]'
            }
        };

        // Setup lazy loading for each split point
        Object.entries(codeSplitPoints).forEach(([moduleName, config]) => {
            this.setupLazyLoading(moduleName, config);
        });
    }

    setupLazyLoading(moduleName, config) {
        const elements = document.querySelectorAll(config.trigger);
        
        if (elements.length > 0) {
            // Use Intersection Observer for lazy loading
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadModuleOnDemand(moduleName, config.path);
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '50px'
                });

                elements.forEach(element => observer.observe(element));
            } else {
                // Fallback - load on first interaction
                elements.forEach(element => {
                    element.addEventListener('mouseenter', () => {
                        this.loadModuleOnDemand(moduleName, config.path);
                    }, { once: true });
                });
            }
        }
    }

    async loadModuleOnDemand(moduleName, modulePath) {
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        try {
            console.log(`📦 Loading module: ${moduleName}`);
            const startTime = performance.now();
            
            const module = await this.loadModule(moduleName, modulePath);
            
            const loadTime = performance.now() - startTime;
            console.log(`✅ Module ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);
            
            // Track loading performance
            this.trackModuleLoad(moduleName, loadTime);
            
            return module;
        } catch (error) {
            console.error(`❌ Failed to load module ${moduleName}:`, error);
            throw error;
        }
    }

    trackModuleLoad(moduleName, loadTime) {
        if (!this.bundleAnalysis.dependencies.has(moduleName)) {
            this.bundleAnalysis.dependencies.set(moduleName, {
                loadTime: loadTime,
                timestamp: Date.now(),
                size: this.estimateScriptSize(moduleName)
            });
        }
    }

    optimizeLoadingOrder() {
        // Define loading priority
        const loadingPriority = [
            // Critical (load immediately)
            { name: 'performance-optimizer', priority: 1, path: '/performance-optimizer.js' },
            { name: 'app', priority: 1, path: '/app.js' },
            
            // High priority (load after critical)
            { name: 'features', priority: 2, path: '/features.js' },
            { name: 'auctions', priority: 2, path: '/auctions.js' },
            
            // Medium priority (load on interaction)
            { name: 'imageOptimizer', priority: 3, path: '/image-optimizer.js' },
            { name: 'performanceDashboard', priority: 3, path: '/performance-dashboard.js' },
            
            // Low priority (load when needed)
            { name: 'dashboard', priority: 4, path: '/dashboard.js' },
            { name: 'bookmarks', priority: 4, path: '/bookmarks.js' },
            { name: 'analytics', priority: 4, path: '/bid-analytics.js' }
        ];

        // Sort by priority and preload high priority modules
        loadingPriority
            .filter(item => item.priority <= 2)
            .forEach(item => {
                this.preloadModule(item.name, item.path);
            });
    }

    preloadModule(moduleName, modulePath) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = modulePath;
        document.head.appendChild(link);
    }

    // Tree shaking simulation
    simulateTreeShaking() {
        // Analyze used functions and variables
        const usedCode = this.analyzeUsedCode();
        const unusedCode = this.identifyUnusedCode(usedCode);
        
        this.bundleAnalysis.unusedCode = unusedCode;
        
        const potentialSavings = unusedCode.size * 0.7; // Assume 70% of unused code can be removed
        console.log(`🌳 Potential tree shaking savings: ${(potentialSavings / 1024).toFixed(1)} KB`);
        
        return {
            unusedCode: Array.from(unusedCode),
            potentialSavings: potentialSavings
        };
    }

    analyzeUsedCode() {
        const used = new Set();
        
        // Analyze global function calls
        const scripts = Array.from(document.querySelectorAll('script'));
        scripts.forEach(script => {
            if (script.textContent) {
                // Simple regex to find function calls
                const functionCalls = script.textContent.match(/\w+\(/g) || [];
                functionCalls.forEach(call => {
                    const functionName = call.slice(0, -1);
                    if (functionName.length > 2) { // Filter out small matches
                        used.add(functionName);
                    }
                });
            }
        });
        
        return used;
    }

    identifyUnusedCode(usedCode) {
        // This is a simplified simulation
        // In a real build system, this would analyze the actual AST
        const allPossibleFunctions = [
            'init', 'render', 'update', 'handleClick', 'handleSubmit',
            'validate', 'calculate', 'process', 'transform', 'format',
            'parse', 'stringify', 'encode', 'decode', 'compress', 'decompress'
        ];
        
        const unused = new Set();
        allPossibleFunctions.forEach(func => {
            if (!usedCode.has(func)) {
                unused.add(func);
            }
        });
        
        return unused;
    }

    // Bundle compression analysis
    analyzeCompression() {
        const modules = this.bundleAnalysis.modules;
        const originalSize = this.bundleAnalysis.totalSize;
        
        // Estimate compressed sizes
        const gzipSize = originalSize * 0.3; // Gzip typically achieves ~70% compression
        const brotliSize = originalSize * 0.2; // Brotli typically achieves ~80% compression
        
        console.log(`📊 Original size: ${(originalSize / 1024).toFixed(1)} KB`);
        console.log(`🗜️ Gzip size: ${(gzipSize / 1024).toFixed(1)} KB (${((1 - gzipSize / originalSize) * 100).toFixed(1)}% reduction)`);
        console.log(`⚡ Brotli size: ${(brotliSize / 1024).toFixed(1)} KB (${((1 - brotliSize / originalSize) * 100).toFixed(1)}% reduction)`);
        
        return {
            original: originalSize,
            gzip: gzipSize,
            brotli: brotliSize
        };
    }

    // Generate optimization report
    generateOptimizationReport() {
        const treeShaking = this.simulateTreeShaking();
        const compression = this.analyzeCompression();
        
        const report = {
            bundleAnalysis: this.bundleAnalysis,
            treeShaking: treeShaking,
            compression: compression,
            recommendations: this.getOptimizationRecommendations(),
            timestamp: new Date().toISOString()
        };
        
        return report;
    }

    getOptimizationRecommendations() {
        const recommendations = [];
        
        // Bundle size recommendations
        if (this.bundleAnalysis.totalSize > 1024 * 1024) {
            recommendations.push({
                type: 'bundle-size',
                priority: 'high',
                message: 'Bundle size exceeds 1MB. Implement code splitting and tree shaking.',
                impact: 'high'
            });
        }
        
        // Module loading recommendations
        const nonCriticalModules = this.bundleAnalysis.modules.filter(m => !m.critical);
        if (nonCriticalModules.length > 5) {
            recommendations.push({
                type: 'lazy-loading',
                priority: 'medium',
                message: 'Load non-critical modules on demand to reduce initial load time.',
                impact: 'medium'
            });
        }
        
        // Compression recommendations
        recommendations.push({
            type: 'compression',
            priority: 'high',
            message: 'Enable Brotli compression on your server for optimal bundle sizes.',
            impact: 'high'
        });
        
        // Caching recommendations
        recommendations.push({
            type: 'caching',
            priority: 'medium',
            message: 'Implement long-term caching for static assets with proper cache busting.',
            impact: 'medium'
        });
        
        return recommendations;
    }

    // Export optimization data
    exportOptimizationData() {
        const report = this.generateOptimizationReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bundle-optimization-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Monitor bundle changes
    monitorBundleChanges() {
        const originalBundle = JSON.stringify(this.bundleAnalysis);
        
        setInterval(() => {
            this.analyzeCurrentBundle();
            const currentBundle = JSON.stringify(this.bundleAnalysis);
            
            if (originalBundle !== currentBundle) {
                console.log('🔄 Bundle change detected');
                this.reportBundleSize();
            }
        }, 10000); // Check every 10 seconds
    }
}

// Initialize bundle optimizer
document.addEventListener('DOMContentLoaded', () => {
    window.bundleOptimizer = new BundleOptimizer();
    
    // Export optimization data function
    window.exportBundleOptimization = () => {
        window.bundleOptimizer.exportOptimizationData();
    };
    
    // Start monitoring
    setTimeout(() => {
        window.bundleOptimizer.monitorBundleChanges();
    }, 5000);
});

// Export for use in other modules
window.BundleOptimizer = BundleOptimizer;
