/**
 * VR Integration Module
 * Connects the VR Auction Hall with the main auction application
 */

class VRIntegration {
    constructor() {
        this.vrHall = null;
        this.isInitialized = false;
        this.currentAuctions = [];
        this.realTimeUpdates = true;
        this.performanceMonitor = new VRPerformanceMonitor();
        
        this.init();
    }

    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }

            // Initialize VR Hall
            this.vrHall = new VRAuctionHall();
            
            // Setup integration with main app
            this.setupAppIntegration();
            
            // Setup real-time updates
            this.setupRealTimeUpdates();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('VR Integration initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize VR Integration:', error);
        }
    }

    setupAppIntegration() {
        // Connect to main app's socket events
        if (window.socket) {
            this.setupSocketListeners();
        }
        
        // Connect to main app's functions
        if (window.app) {
            this.setupAppListeners();
        }
        
        // Expose VR functions to global scope
        this.exposeVRFunctions();
    }

    setupSocketListeners() {
        const socket = window.socket;
        
        // Listen for auction updates
        socket.on('auctionCreated', (auction) => {
            this.onAuctionCreated(auction);
        });
        
        socket.on('auctionClosed', (auction) => {
            this.onAuctionClosed(auction);
        });
        
        socket.on('bidPlaced', (data) => {
            this.onBidPlaced(data);
        });
        
        socket.on('auctionUpdated', (auction) => {
            this.onAuctionUpdated(auction);
        });
    }

    setupAppListeners() {
        const app = window.app;
        
        // Listen for auction selection changes
        if (app.addEventListener) {
            app.addEventListener('auctionSelected', (event) => {
                this.onAuctionSelected(event.detail.auction);
            });
        }
        
        // Listen for user authentication
        if (app.addEventListener) {
            app.addEventListener('userAuthenticated', (event) => {
                this.onUserAuthenticated(event.detail.user);
            });
        }
    }

    exposeVRFunctions() {
        // Expose VR functions for external use
        window.vrIntegration = {
            enterVR: () => this.enterVR(),
            exitVR: () => this.exitVR(),
            loadAuctions: (auctions) => this.loadAuctions(auctions),
            showAuctionInVR: (auctionId) => this.showAuctionInVR(auctionId),
            isVRSupported: () => this.isVRSupported(),
            togglePerformanceMode: () => this.togglePerformanceMode()
        };
    }

    // Real-time auction updates
    setupRealTimeUpdates() {
        // Poll for auction updates if socket is not available
        if (!window.socket) {
            setInterval(() => {
                this.pollAuctionUpdates();
            }, 5000); // Poll every 5 seconds
        }
    }

    async pollAuctionUpdates() {
        try {
            const response = await fetch('/api/auctions?limit=10');
            const data = await response.json();
            
            if (data.auctions) {
                this.updateAuctions(data.auctions);
            }
        } catch (error) {
            console.error('Failed to poll auction updates:', error);
        }
    }

    // Event handlers
    onAuctionCreated(auction) {
        console.log('VR: New auction created:', auction);
        
        if (this.vrHall) {
            this.vrHall.loadAuctionItems([...this.currentAuctions, auction]);
        }
        
        this.currentAuctions.push(auction);
        
        // Show notification in VR
        if (this.vrHall) {
            this.vrHall.showNotification(`New auction: ${auction.title}`, 'success');
        }
    }

    onAuctionClosed(auction) {
        console.log('VR: Auction closed:', auction);
        
        // Update auction in current list
        const index = this.currentAuctions.findIndex(a => a.id === auction.id);
        if (index !== -1) {
            this.currentAuctions[index] = auction;
        }
        
        if (this.vrHall) {
            this.vrHall.updateAuctionStatus(auction.id, 'closed');
            this.vrHall.showNotification(`Auction "${auction.title}" closed!`, 'info');
        }
    }

    onBidPlaced(data) {
        console.log('VR: Bid placed:', data);
        
        if (this.vrHall) {
            this.vrHall.updateBidCount(data.auctionId, data.bidCount);
            this.vrHall.showNotification('New bid placed!', 'warning');
        }
    }

    onAuctionUpdated(auction) {
        console.log('VR: Auction updated:', auction);
        
        // Update auction in current list
        const index = this.currentAuctions.findIndex(a => a.id === auction.id);
        if (index !== -1) {
            this.currentAuctions[index] = auction;
        }
        
        if (this.vrHall) {
            this.vrHall.updateAuctionStatus(auction.id, auction.status);
        }
    }

    onAuctionSelected(auction) {
        console.log('VR: Auction selected:', auction);
        
        if (this.vrHall) {
            this.focusOnAuction(auction.id);
        }
    }

    onUserAuthenticated(user) {
        console.log('VR: User authenticated:', user);
        
        // Load user-specific data in VR
        if (this.vrHall) {
            this.vrHall.showNotification(`Welcome back, ${user.username}!`, 'success');
        }
    }

    // VR control methods
    async enterVR() {
        if (!this.vrHall) {
            console.error('VR Hall not initialized');
            return false;
        }
        
        try {
            await this.vrHall.startVRSession();
            return true;
        } catch (error) {
            console.error('Failed to enter VR:', error);
            return false;
        }
    }

    exitVR() {
        if (this.vrHall && this.vrHall.xrSession) {
            this.vrHall.xrSession.end();
            return true;
        }
        return false;
    }

    loadAuctions(auctions) {
        this.currentAuctions = auctions;
        
        if (this.vrHall) {
            this.vrHall.loadAuctionItems(auctions);
        }
    }

    showAuctionInVR(auctionId) {
        if (!this.vrHall) return;
        
        const auction = this.currentAuctions.find(a => a.id === auctionId);
        if (auction) {
            this.focusOnAuction(auctionId);
            this.vrHall.showNotification(`Viewing: ${auction.title}`, 'info');
        }
    }

    focusOnAuction(auctionId) {
        if (!this.vrHall) return;
        
        const item = this.vrHall.auctionItems.find(item => item.userData.auctionId === auctionId);
        if (item) {
            // Move camera to focus on the auction item
            const targetPosition = item.position.clone();
            targetPosition.z += 3; // Position camera in front of item
            
            // Smooth camera movement
            this.animateCameraTo(targetPosition, item.position);
        }
    }

    animateCameraTo(targetPosition, lookAtPosition) {
        const startPosition = this.vrHall.camera.position.clone();
        const startRotation = this.vrHall.camera.rotation.clone();
        const duration = 1000; // 1 second
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease in-out animation
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;
            
            // Update camera position
            this.vrHall.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            
            // Update camera rotation to look at target
            this.vrHall.camera.lookAt(lookAtPosition);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    isVRSupported() {
        return this.vrHall ? this.vrHall.vrSupported : false;
    }

    togglePerformanceMode() {
        if (this.vrHall) {
            this.vrHall.togglePerformanceMode();
            return this.vrHall.performanceMode;
        }
        return false;
    }

    // Performance monitoring
    setupPerformanceMonitoring() {
        this.performanceMonitor.start();
        
        // Monitor frame rate
        setInterval(() => {
            const fps = this.performanceMonitor.getFPS();
            if (fps < 30) {
                console.warn('VR performance warning: Low FPS', fps);
                this.suggestPerformanceMode();
            }
        }, 5000);
    }

    suggestPerformanceMode() {
        if (!this.vrHall.performanceMode) {
            this.vrHall.showNotification('Low performance detected. Consider enabling performance mode.', 'warning');
        }
    }

    // Mobile VR optimizations
    optimizeForMobileVR() {
        if (this.vrHall && this.vrHall.isMobileVR) {
            // Enable performance mode by default on mobile VR
            this.togglePerformanceMode();
            
            // Reduce rendering quality
            this.vrHall.renderer.setPixelRatio(1);
            
            // Simplify lighting
            this.simplifyLighting();
            
            // Reduce shadow quality
            this.reduceShadowQuality();
        }
    }

    simplifyLighting() {
        // Remove complex lighting for mobile
        this.vrHall.scene.traverse((object) => {
            if (object instanceof THREE.Light && object instanceof THREE.SpotLight) {
                this.vrHall.scene.remove(object);
            }
        });
    }

    reduceShadowQuality() {
        if (this.vrHall.renderer.shadowMap.enabled) {
            this.vrHall.renderer.shadowMap.mapSize.width = 512;
            this.vrHall.renderer.shadowMap.mapSize.height = 512;
        }
    }

    updateAuctions(auctions) {
        // Compare with current auctions and update only changed items
        auctions.forEach(newAuction => {
            const existingAuction = this.currentAuctions.find(a => a.id === newAuction.id);
            
            if (!existingAuction) {
                // New auction
                this.onAuctionCreated(newAuction);
            } else if (JSON.stringify(existingAuction) !== JSON.stringify(newAuction)) {
                // Updated auction
                this.onAuctionUpdated(newAuction);
            }
        });
        
        // Remove auctions that are no longer present
        this.currentAuctions = this.currentAuctions.filter(auction => 
            auctions.find(a => a.id === auction.id)
        );
    }

    // Cleanup
    dispose() {
        if (this.vrHall) {
            this.vrHall.dispose();
        }
        
        if (this.performanceMonitor) {
            this.performanceMonitor.stop();
        }
        
        this.isInitialized = false;
    }
}

// Performance monitoring utility
class VRPerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        this.isRunning = false;
    }

    start() {
        this.isRunning = true;
        this.measureFPS();
    }

    stop() {
        this.isRunning = false;
    }

    measureFPS() {
        if (!this.isRunning) return;
        
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= this.lastTime + 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        requestAnimationFrame(() => this.measureFPS());
    }

    getFPS() {
        return this.fps;
    }
}

// Auto-initialize when script loads
(() => {
    // Wait for main app to load
    const initVR = () => {
        if (!window.vrIntegration) {
            window.vrIntegration = new VRIntegration();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVR);
    } else {
        initVR();
    }
})();
