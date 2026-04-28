/**
 * VR Auction Hall - Immersive 3D Auction Experience
 * Supports WebXR for VR headsets and motion controls
 */

class VRAuctionHall {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vrSupported = false;
        this.xrSession = null;
        this.controller1 = null;
        this.controller2 = null;
        this.auctionItems = [];
        this.currentAuction = null;
        this.isVRMode = false;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        this.uiElements = [];
        this.performanceMode = false;
        
        // Animation and interaction
        this.clock = new THREE.Clock();
        this.animationMixer = null;
        this.interactiveObjects = [];
        
        // Mobile VR detection
        this.isMobileVR = this.detectMobileVR();
        
        this.init();
    }

    detectMobileVR() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /android|iphone|ipad|ipod/.test(userAgent) && 
               (userAgent.includes('oculus') || userAgent.includes('quest') || 
                userAgent.includes('cardboard') || userAgent.includes('daydream'));
    }

    async init() {
        try {
            this.setupThreeJS();
            this.setupLighting();
            this.createEnvironment();
            this.setupEventListeners();
            await this.checkVRSupport();
            this.setupUI();
            
            console.log('VR Auction Hall initialized successfully');
        } catch (error) {
            console.error('Failed to initialize VR Auction Hall:', error);
            this.showFallbackMessage();
        }
    }

    setupThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 5);

        // Renderer setup with VR support
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: this.isMobileVR ? 'low-power' : 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobileVR ? 1 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.xr.enabled = true;
        this.renderer.xr.setSessionMode('immersive-vr');

        // Add canvas to DOM
        const vrContainer = document.getElementById('vr-container') || this.createVRContainer();
        vrContainer.appendChild(this.renderer.domElement);
    }

    createVRContainer() {
        const container = document.createElement('div');
        container.id = 'vr-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            background: #000;
        `;
        document.body.appendChild(container);
        return container;
    }

    setupLighting() {
        // Ambient lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Spot lights for dramatic effect
        const spotLight1 = new THREE.SpotLight(0x667eea, 1);
        spotLight1.position.set(-5, 10, 0);
        spotLight1.angle = Math.PI / 6;
        spotLight1.penumbra = 0.3;
        spotLight1.castShadow = true;
        this.scene.add(spotLight1);

        const spotLight2 = new THREE.SpotLight(0x764ba2, 1);
        spotLight2.position.set(5, 10, 0);
        spotLight2.angle = Math.PI / 6;
        spotLight2.penumbra = 0.3;
        spotLight2.castShadow = true;
        this.scene.add(spotLight2);
    }

    createEnvironment() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(50, 50);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d3748,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Auction hall walls
        this.createWalls();
        
        // Stage platform
        this.createStage();
        
        // Display pedestals for auction items
        this.createDisplayPedestals();
        
        // Ceiling with lighting fixtures
        this.createCeiling();
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a202c,
            roughness: 0.9,
            metalness: 0.1
        });

        // Back wall
        const backWallGeometry = new THREE.PlaneGeometry(30, 10);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 5, -15);
        this.scene.add(backWall);

        // Side walls
        const sideWallGeometry = new THREE.PlaneGeometry(30, 10);
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-15, 5, 0);
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(15, 5, 0);
        this.scene.add(rightWall);
    }

    createStage() {
        const stageGeometry = new THREE.BoxGeometry(12, 0.5, 8);
        const stageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4a5568,
            roughness: 0.6,
            metalness: 0.3
        });
        const stage = new THREE.Mesh(stageGeometry, stageMaterial);
        stage.position.set(0, 0.25, -8);
        stage.receiveShadow = true;
        stage.castShadow = true;
        this.scene.add(stage);

        // Stage steps
        for (let i = 1; i <= 3; i++) {
            const stepGeometry = new THREE.BoxGeometry(12, 0.1, 8);
            const step = new THREE.Mesh(stepGeometry, stageMaterial);
            step.position.set(0, 0.1 * i, -8 + i * 0.5);
            step.receiveShadow = true;
            this.scene.add(step);
        }
    }

    createDisplayPedestals() {
        const pedestalGeometry = new THREE.CylinderGeometry(1, 1.2, 2, 8);
        const pedestalMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x718096,
            roughness: 0.4,
            metalness: 0.6
        });

        // Create pedestals in a semicircle
        const positions = [
            { x: -6, z: -2 },
            { x: -3, z: -4 },
            { x: 0, z: -5 },
            { x: 3, z: -4 },
            { x: 6, z: -2 }
        ];

        positions.forEach((pos, index) => {
            const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
            pedestal.position.set(pos.x, 1, pos.z);
            pedestal.castShadow = true;
            pedestal.receiveShadow = true;
            pedestal.userData = { type: 'pedestal', index: index };
            this.interactiveObjects.push(pedestal);
            this.scene.add(pedestal);
        });
    }

    createCeiling() {
        const ceilingGeometry = new THREE.PlaneGeometry(50, 50);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0f1419,
            roughness: 0.9,
            metalness: 0.1
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 10;
        this.scene.add(ceiling);

        // Add hanging lights
        for (let i = 0; i < 5; i++) {
            const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
            const lightMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.5
            });
            const lightBulb = new THREE.Mesh(lightGeometry, lightMaterial);
            lightBulb.position.set((i - 2) * 4, 8, 0);
            
            const pointLight = new THREE.PointLight(0xffffff, 0.5, 10);
            pointLight.position.copy(lightBulb.position);
            
            this.scene.add(lightBulb);
            this.scene.add(pointLight);
        }
    }

    async checkVRSupport() {
        if ('xr' in navigator) {
            try {
                const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
                this.vrSupported = isVRSupported;
                
                if (isVRSupported) {
                    this.setupVRControllers();
                    console.log('VR support detected and controllers initialized');
                } else {
                    console.log('VR not supported, falling back to desktop mode');
                }
            } catch (error) {
                console.error('Error checking VR support:', error);
                this.vrSupported = false;
            }
        } else {
            console.log('WebXR not available');
            this.vrSupported = false;
        }
    }

    setupVRControllers() {
        // Controller 1
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('select', this.onControllerSelect.bind(this));
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller1);

        // Controller 2
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('select', this.onControllerSelect.bind(this));
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller2);

        // Add controller models
        this.addControllerModel(this.controller1);
        this.addControllerModel(this.controller2);
    }

    addControllerModel(controller) {
        // Simple controller visualization
        const geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x667eea });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        controller.add(mesh);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Keyboard controls for desktop mode
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Mouse controls for desktop mode
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('click', this.onMouseClick.bind(this));
    }

    setupUI() {
        // Create VR entry button
        const vrButton = document.createElement('button');
        vrButton.id = 'vr-entry-button';
        vrButton.textContent = 'Enter VR Mode';
        vrButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            z-index: 10000;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        `;
        
        vrButton.addEventListener('click', this.startVRSession.bind(this));
        document.body.appendChild(vrButton);

        // Create VR status indicator
        this.createStatusIndicator();
    }

    createStatusIndicator() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'vr-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 10px 16px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;
        statusDiv.textContent = this.vrSupported ? 'VR Ready' : 'VR Not Supported';
        document.body.appendChild(statusDiv);
    }

    async startVRSession() {
        if (!this.vrSupported) {
            this.showNotification('VR not supported on this device', 'error');
            return;
        }

        try {
            this.xrSession = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor', 'bounded-floor']
            });
            
            await this.renderer.xr.setSession(this.xrSession);
            this.isVRMode = true;
            
            // Hide VR button when in VR
            document.getElementById('vr-entry-button').style.display = 'none';
            
            // Setup VR session events
            this.xrSession.addEventListener('end', this.onVRSessionEnd.bind(this));
            
            this.startAnimationLoop();
            this.showNotification('VR session started', 'success');
            
        } catch (error) {
            console.error('Failed to start VR session:', error);
            this.showNotification('Failed to start VR session', 'error');
        }
    }

    onVRSessionEnd() {
        this.isVRMode = false;
        this.xrSession = null;
        
        // Show VR button again
        const vrButton = document.getElementById('vr-entry-button');
        if (vrButton) vrButton.style.display = 'block';
        
        this.showNotification('VR session ended', 'info');
    }

    // Controller interaction handlers
    onControllerSelect(event) {
        const controller = event.target;
        this.handleInteraction(controller);
    }

    onSelectStart(event) {
        const controller = event.target;
        controller.userData.selecting = true;
    }

    onSelectEnd(event) {
        const controller = event.target;
        controller.userData.selecting = false;
    }

    handleInteraction(controller) {
        // Raycast from controller position
        this.raycaster.setFromController(controller, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            this.onObjectSelected(object);
        }
    }

    onObjectSelected(object) {
        console.log('Object selected:', object.userData);
        
        if (object.userData.type === 'pedestal') {
            this.showAuctionDetails(object.userData.index);
        } else if (object.userData.type === 'auction-item') {
            this.selectAuctionItem(object.userData.auctionId);
        }
    }

    // Desktop mode controls
    onKeyDown(event) {
        if (this.isVRMode) return;
        
        switch (event.code) {
            case 'KeyW':
                this.camera.position.z -= 0.2;
                break;
            case 'KeyS':
                this.camera.position.z += 0.2;
                break;
            case 'KeyA':
                this.camera.position.x -= 0.2;
                break;
            case 'KeyD':
                this.camera.position.x += 0.2;
                break;
        }
    }

    onKeyUp(event) {
        // Handle key release if needed
    }

    onMouseMove(event) {
        if (this.isVRMode) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onMouseClick(event) {
        if (this.isVRMode) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);
        
        if (intersects.length > 0) {
            this.onObjectSelected(intersects[0].object);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Auction integration methods
    loadAuctionItems(auctions) {
        // Clear existing items
        this.clearAuctionItems();
        
        auctions.forEach((auction, index) => {
            if (index < 5) { // Limit to 5 items for display
                this.createAuctionItem(auction, index);
            }
        });
    }

    createAuctionItem(auction, pedestalIndex) {
        // Create 3D representation of auction item
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: this.getAuctionColor(auction),
            roughness: 0.3,
            metalness: 0.7
        });
        
        const item = new THREE.Mesh(geometry, material);
        item.position.set(
            (pedestalIndex - 2) * 3,
            2.5,
            -5 + Math.abs(pedestalIndex - 2) * 0.5
        );
        item.castShadow = true;
        item.receiveShadow = true;
        item.userData = { 
            type: 'auction-item', 
            auctionId: auction.id,
            auction: auction
        };
        
        this.scene.add(item);
        this.auctionItems.push(item);
        this.interactiveObjects.push(item);
        
        // Add floating animation
        this.animateFloat(item);
    }

    getAuctionColor(auction) {
        // Color based on auction status or type
        if (auction.status === 'active') return 0x667eea;
        if (auction.status === 'closed') return 0x48bb78;
        return 0xed8936;
    }

    animateFloat(object) {
        const originalY = object.position.y;
        const floatSpeed = 0.001 + Math.random() * 0.002;
        const floatHeight = 0.1 + Math.random() * 0.1;
        
        const animate = () => {
            if (!object.parent) return; // Object removed from scene
            
            object.position.y = originalY + Math.sin(Date.now() * floatSpeed) * floatHeight;
            object.rotation.y += 0.01;
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    clearAuctionItems() {
        this.auctionItems.forEach(item => {
            this.scene.remove(item);
            const index = this.interactiveObjects.indexOf(item);
            if (index > -1) {
                this.interactiveObjects.splice(index, 1);
            }
        });
        this.auctionItems = [];
    }

    showAuctionDetails(pedestalIndex) {
        // Show auction details in VR UI
        console.log(`Showing details for pedestal ${pedestalIndex}`);
        // Implementation would show 3D UI panels with auction info
    }

    selectAuctionItem(auctionId) {
        // Handle auction item selection
        console.log(`Selected auction item: ${auctionId}`);
        // Integration with main app's auction selection
        if (window.app && window.app.selectAuction) {
            window.app.selectAuction(auctionId);
        }
    }

    // Real-time updates
    updateAuctionStatus(auctionId, status) {
        const item = this.auctionItems.find(item => item.userData.auctionId === auctionId);
        if (item) {
            item.material.color.setHex(this.getAuctionColor({ status }));
        }
    }

    updateBidCount(auctionId, bidCount) {
        // Update visual representation of bid activity
        const item = this.auctionItems.find(item => item.userData.auctionId === auctionId);
        if (item) {
            // Add pulsing effect for new bids
            this.pulseObject(item);
        }
    }

    pulseObject(object) {
        const originalScale = object.scale.x;
        let scale = 1;
        let growing = true;
        
        const pulse = () => {
            if (growing) {
                scale += 0.02;
                if (scale >= 1.2) growing = false;
            } else {
                scale -= 0.02;
                if (scale <= 1) return;
            }
            
            object.scale.set(scale, scale, scale);
            requestAnimationFrame(pulse);
        };
        
        pulse();
    }

    // Performance optimization
    togglePerformanceMode() {
        this.performanceMode = !this.performanceMode;
        
        if (this.performanceMode) {
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
            // Reduce lighting quality
        } else {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            // Restore full quality
        }
    }

    startAnimationLoop() {
        const animate = () => {
            if (!this.isVRMode && !this.renderer.xr.isPresenting) return;
            
            this.renderer.setAnimationLoop(() => {
                const delta = this.clock.getDelta();
                
                // Update animations
                this.updateAnimations(delta);
                
                // Update controller positions
                this.updateControllers();
                
                // Render scene
                this.renderer.render(this.scene, this.camera);
            });
        };
        
        animate();
    }

    updateAnimations(delta) {
        // Update any ongoing animations
        if (this.animationMixer) {
            this.animationMixer.update(delta);
        }
        
        // Update UI elements
        this.updateUIElements(delta);
    }

    updateControllers() {
        // Update controller visualizations and interactions
        if (this.controller1) {
            // Update controller 1
        }
        if (this.controller2) {
            // Update controller 2
        }
    }

    updateUIElements(delta) {
        // Update 3D UI elements
        this.uiElements.forEach(element => {
            if (element.update) {
                element.update(delta);
            }
        });
    }

    showNotification(message, type = 'info') {
        // Show notification in VR space or fallback to 2D
        if (this.isVRMode) {
            this.createVRNotification(message, type);
        } else {
            // Use existing notification system
            if (window.showNotification) {
                window.showNotification(message, type);
            } else {
                console.log(`${type}: ${message}`);
            }
        }
    }

    createVRNotification(message, type) {
        // Create 3D notification panel
        const geometry = new THREE.PlaneGeometry(4, 1);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.getNotificationColor(type),
            transparent: true,
            opacity: 0.8
        });
        
        const notification = new THREE.Mesh(geometry, material);
        notification.position.set(0, 2, -3);
        notification.lookAt(this.camera.position);
        
        this.scene.add(notification);
        this.uiElements.push(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            this.scene.remove(notification);
            const index = this.uiElements.indexOf(notification);
            if (index > -1) {
                this.uiElements.splice(index, 1);
            }
        }, 3000);
    }

    getNotificationColor(type) {
        switch (type) {
            case 'success': return 0x48bb78;
            case 'error': return 0xf56565;
            case 'warning': return 0xed8936;
            default: return 0x4299e1;
        }
    }

    showFallbackMessage() {
        const message = document.createElement('div');
        message.textContent = 'VR is not supported on this device. Using desktop mode.';
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10001;
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 5000);
    }

    // Cleanup
    dispose() {
        if (this.xrSession) {
            this.xrSession.end();
        }
        
        // Clean up Three.js resources
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();
    }
}

// Export for use in main application
window.VRAuctionHall = VRAuctionHall;
