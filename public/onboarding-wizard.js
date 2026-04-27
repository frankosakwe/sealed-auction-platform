class OnboardingWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.progress = 0;
        this.isInteractiveMode = false;
        this.completedSteps = new Set();
        this.skipAllowed = true;
        this.startTime = Date.now();
        
        this.steps = [
            {
                id: 1,
                title: "Welcome to Sealed Auction Platform",
                content: `
                    <div class="text-center">
                        <div class="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-gavel text-white text-2xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Welcome to Sealed Auction Platform</h2>
                        <p class="text-gray-600 mb-6">
                            Experience secure, private-input sealed-bid auctions powered by Stellar blockchain technology. 
                            This quick tutorial will help you get started with all the features.
                        </p>
                        <div class="bg-purple-50 p-4 rounded-lg text-left">
                            <h4 class="font-semibold text-purple-900 mb-2">What you'll learn:</h4>
                            <ul class="space-y-2 text-sm text-purple-700">
                                <li><i class="fas fa-check mr-2"></i>How to create and manage auctions</li>
                                <li><i class="fas fa-check mr-2"></i>Placing secure sealed bids</li>
                                <li><i class="fas fa-check mr-2"></i>Using your Stellar wallet</li>
                                <li><i class="fas fa-check mr-2"></i>Monitoring auction results</li>
                            </ul>
                        </div>
                    </div>
                `,
                interactive: false,
                completionTime: 30
            },
            {
                id: 2,
                title: "Creating Your Account",
                content: `
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Creating Your Account</h2>
                        <p class="text-gray-600 mb-6">
                            Your account is your gateway to participating in secure auctions. 
                            Let's explore the authentication options.
                        </p>
                        <div class="space-y-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-blue-900 mb-2">
                                    <i class="fas fa-user-shield mr-2"></i>
                                    Secure Authentication
                                </h4>
                                <p class="text-sm text-blue-700">
                                    Choose between traditional email/password or OAuth providers for quick access.
                                </p>
                            </div>
                            <div class="bg-green-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-green-900 mb-2">
                                    <i class="fas fa-key mr-2"></i>
                                    Wallet Integration
                                </h4>
                                <p class="text-sm text-green-700">
                                    Connect your Stellar wallet to participate in blockchain-secured auctions.
                                </p>
                            </div>
                        </div>
                    </div>
                `,
                interactive: true,
                targetElement: "#authModal",
                tooltip: {
                    title: "Authentication",
                    content: "Click here to sign up or sign in to start using the platform.",
                    action: "showAuthModal"
                }
            },
            {
                id: 3,
                title: "Exploring the Dashboard",
                content: `
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Exploring the Dashboard</h2>
                        <p class="text-gray-600 mb-6">
                            The dashboard is your command center. Let's navigate through the key features.
                        </p>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-purple-50 p-4 rounded-lg">
                                <i class="fas fa-list text-purple-600 text-2xl mb-2"></i>
                                <h4 class="font-semibold text-purple-900">Auctions Tab</h4>
                                <p class="text-sm text-purple-700">Browse and participate in active auctions</p>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <i class="fas fa-chart-line text-blue-600 text-2xl mb-2"></i>
                                <h4 class="font-semibold text-blue-900">Analytics Tab</h4>
                                <p class="text-sm text-blue-700">View bidding trends and insights</p>
                            </div>
                            <div class="bg-green-50 p-4 rounded-lg">
                                <i class="fas fa-bell text-green-600 text-2xl mb-2"></i>
                                <h4 class="font-semibold text-green-900">Notifications</h4>
                                <p class="text-sm text-green-700">Stay updated on auction activities</p>
                            </div>
                            <div class="bg-orange-50 p-4 rounded-lg">
                                <i class="fas fa-cog text-orange-600 text-2xl mb-2"></i>
                                <h4 class="font-semibold text-orange-900">Settings</h4>
                                <p class="text-sm text-orange-700">Customize your experience</p>
                            </div>
                        </div>
                    </div>
                `,
                interactive: true,
                targetElement: "[data-tab='auctions']",
                tooltip: {
                    title: "Navigation Tabs",
                    content: "Use these tabs to navigate between different sections of the platform.",
                    action: "highlightTabs"
                }
            },
            {
                id: 4,
                title: "Creating an Auction",
                content: `
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Creating an Auction</h2>
                        <p class="text-gray-600 mb-6">
                            Learn how to create your own sealed-bid auction with custom parameters.
                        </p>
                        <div class="space-y-4">
                            <div class="bg-indigo-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-indigo-900 mb-2">
                                    <i class="fas fa-plus-circle mr-2"></i>
                                    Auction Setup
                                </h4>
                                <ul class="text-sm text-indigo-700 space-y-1">
                                    <li>• Set item description and images</li>
                                    <li>• Define minimum bid and reserve price</li>
                                    <li>• Choose auction duration</li>
                                    <li>• Set bidding rules and restrictions</li>
                                </ul>
                            </div>
                            <div class="bg-yellow-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-yellow-900 mb-2">
                                    <i class="fas fa-lock mr-2"></i>
                                    Privacy Features
                                </h4>
                                <p class="text-sm text-yellow-700">
                                    All bids are encrypted and remain private until the auction ends.
                                </p>
                            </div>
                        </div>
                    </div>
                `,
                interactive: true,
                targetElement: "#createAuctionBtn",
                tooltip: {
                    title: "Create Auction",
                    content: "Click this button to start creating your first auction.",
                    action: "showCreateForm"
                }
            },
            {
                id: 5,
                title: "Placing Bids",
                content: `
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Placing Secure Bids</h2>
                        <p class="text-gray-600 mb-6">
                            Discover how to place sealed bids securely using your Stellar wallet.
                        </p>
                        <div class="space-y-4">
                            <div class="bg-green-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-green-900 mb-2">
                                    <i class="fas fa-wallet mr-2"></i>
                                    Wallet Connection
                                </h4>
                                <p class="text-sm text-green-700">
                                    Connect your Stellar wallet to place bids. Your funds remain secure until you win.
                                </p>
                            </div>
                            <div class="bg-purple-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-purple-900 mb-2">
                                    <i class="fas fa-eye-slash mr-2"></i>
                                    Bid Privacy
                                </h4>
                                <p class="text-sm text-purple-700">
                                    Your bid amount is encrypted and visible only to you until auction completion.
                                </p>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-blue-900 mb-2">
                                    <i class="fas fa-shield-alt mr-2"></i>
                                    Smart Contract Security
                                </h4>
                                <p class="text-sm text-blue-700">
                                    All bids are secured by Stellar smart contracts for maximum trust.
                                </p>
                            </div>
                        </div>
                    </div>
                `,
                interactive: true,
                targetElement: ".bid-button",
                tooltip: {
                    title: "Place Bid",
                    content: "Click on any auction to place your sealed bid.",
                    action: "simulateBid"
                }
            },
            {
                id: 6,
                title: "Completing the Tutorial",
                content: `
                    <div class="text-center">
                        <div class="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-check text-white text-2xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Tutorial Complete!</h2>
                        <p class="text-gray-600 mb-6">
                            You've successfully learned the basics of our sealed auction platform. 
                            You're now ready to start participating in secure auctions!
                        </p>
                        <div class="bg-gradient-to-r from-purple-100 to-indigo-100 p-6 rounded-lg mb-6">
                            <h4 class="font-semibold text-purple-900 mb-3">What's Next?</h4>
                            <div class="grid grid-cols-1 gap-3 text-left">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-play-circle text-purple-600"></i>
                                    <span class="text-sm">Create your first auction</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-search text-purple-600"></i>
                                    <span class="text-sm">Browse active auctions</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-chart-bar text-purple-600"></i>
                                    <span class="text-sm">View analytics dashboard</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-users text-purple-600"></i>
                                    <span class="text-sm">Join the community</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">
                            <p>Time spent: <span id="tutorialTime">0:00</span></p>
                            <p>Steps completed: <span id="stepsCompleted">6/6</span></p>
                        </div>
                    </div>
                `,
                interactive: false,
                completionTime: 20
            }
        ];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadProgress();
        this.checkIfFirstTimeUser();
    }
    
    bindEvents() {
        document.getElementById('prevBtn').addEventListener('click', () => this.previousStep());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('skipBtn').addEventListener('click', () => this.skipTutorial());
        document.getElementById('closeRewardBtn').addEventListener('click', () => this.closeRewards());
        
        // Tooltip events
        document.getElementById('tooltipAction')?.addEventListener('click', () => this.executeTooltipAction());
        document.getElementById('tooltipNext')?.addEventListener('click', () => this.nextStep());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.nextStep();
            if (e.key === 'ArrowLeft') this.previousStep();
            if (e.key === 'Escape') this.skipTutorial();
        });
    }
    
    checkIfFirstTimeUser() {
        const hasCompletedTutorial = localStorage.getItem('tutorialCompleted');
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        
        if (!hasSeenOnboarding && !hasCompletedTutorial) {
            setTimeout(() => this.start(), 1000);
        }
    }
    
    start() {
        this.currentStep = 1;
        this.completedSteps.clear();
        this.startTime = Date.now();
        this.show();
        this.renderStep();
        this.updateProgress();
    }
    
    show() {
        document.getElementById('wizardOverlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    hide() {
        document.getElementById('wizardOverlay').classList.add('hidden');
        document.body.style.overflow = '';
        this.clearHighlights();
    }
    
    renderStep() {
        const step = this.steps[this.currentStep - 1];
        const contentEl = document.getElementById('stepContent');
        
        contentEl.innerHTML = step.content;
        
        // Update step indicators
        this.updateStepIndicators();
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Handle interactive steps
        if (step.interactive) {
            this.startInteractiveTutorial(step);
        } else {
            this.clearHighlights();
        }
        
        // Update tutorial time
        if (this.currentStep === 6) {
            this.updateTutorialTime();
        }
        
        // Mark step as viewed
        this.markStepAsViewed(step.id);
    }
    
    updateStepIndicators() {
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            const stepNum = index + 1;
            indicator.classList.remove('active', 'completed');
            
            if (stepNum < this.currentStep) {
                indicator.classList.add('completed');
                indicator.innerHTML = '<i class="fas fa-check text-xs"></i>';
            } else if (stepNum === this.currentStep) {
                indicator.classList.add('active');
                indicator.textContent = stepNum;
            } else {
                indicator.textContent = stepNum;
            }
        });
    }
    
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.disabled = this.currentStep === 1;
        
        if (this.currentStep === this.totalSteps) {
            nextBtn.innerHTML = '<i class="fas fa-flag-checkered mr-2"></i>Complete';
            nextBtn.onclick = () => this.completeTutorial();
        } else {
            nextBtn.innerHTML = 'Next<i class="fas fa-arrow-right ml-2"></i>';
            nextBtn.onclick = () => this.nextStep();
        }
    }
    
    startInteractiveTutorial(step) {
        this.isInteractiveMode = true;
        
        if (step.targetElement && step.tooltip) {
            setTimeout(() => {
                this.highlightElement(step.targetElement);
                this.showTooltip(step.tooltip);
            }, 500);
        }
    }
    
    highlightElement(selector) {
        this.clearHighlights();
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('highlight-element');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    clearHighlights() {
        document.querySelectorAll('.highlight-element').forEach(el => {
            el.classList.remove('highlight-element');
        });
        this.hideTooltip();
    }
    
    showTooltip(tooltip) {
        const tooltipEl = document.getElementById('tutorialTooltip');
        const targetEl = document.querySelector(this.steps[this.currentStep - 1].targetElement);
        
        if (targetEl && tooltipEl) {
            document.getElementById('tooltipTitle').textContent = tooltip.title;
            document.getElementById('tooltipContent').textContent = tooltip.content;
            
            // Position tooltip
            const rect = targetEl.getBoundingClientRect();
            tooltipEl.style.top = `${rect.bottom + 10}px`;
            tooltipEl.style.left = `${rect.left}px`;
            tooltipEl.classList.remove('hidden');
            
            // Store action for later execution
            this.currentTooltipAction = tooltip.action;
        }
    }
    
    hideTooltip() {
        document.getElementById('tutorialTooltip')?.classList.add('hidden');
    }
    
    executeTooltipAction() {
        if (this.currentTooltipAction) {
            switch (this.currentTooltipAction) {
                case 'showAuthModal':
                    if (typeof window.showAuthModal === 'function') {
                        window.showAuthModal();
                    }
                    break;
                case 'highlightTabs':
                    this.highlightAllTabs();
                    break;
                case 'showCreateForm':
                    if (typeof window.showCreateAuctionForm === 'function') {
                        window.showCreateAuctionForm();
                    }
                    break;
                case 'simulateBid':
                    this.simulateBidAction();
                    break;
            }
        }
    }
    
    highlightAllTabs() {
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.add('highlight-element');
        });
    }
    
    simulateBidAction() {
        // Find first bid button and highlight it
        const bidBtn = document.querySelector('.bid-button, [onclick*="placeBid"]');
        if (bidBtn) {
            this.highlightElement(bidBtn);
            this.showNotification('Click on any auction card to place a bid', 'info');
        }
    }
    
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.renderStep();
            this.updateProgress();
            this.saveProgress();
        }
    }
    
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderStep();
            this.updateProgress();
            this.saveProgress();
        }
    }
    
    updateProgress() {
        this.progress = (this.currentStep / this.totalSteps) * 100;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${this.progress}%`;
        }
    }
    
    skipTutorial() {
        if (this.skipAllowed) {
            if (confirm('Are you sure you want to skip the tutorial? You can always access it later from the help menu.')) {
                this.completeTutorial(true);
            }
        }
    }
    
    completeTutorial(skipped = false) {
        this.hide();
        
        if (!skipped) {
            this.showRewards();
        }
        
        // Mark as completed
        localStorage.setItem('tutorialCompleted', 'true');
        localStorage.setItem('tutorialCompletedAt', Date.now());
        localStorage.setItem('tutorialSkipped', skipped);
        
        // Clear progress
        localStorage.removeItem('tutorialProgress');
        
        this.showNotification(
            skipped ? 'Tutorial skipped. You can access it anytime from the help menu.' : 'Tutorial completed! Welcome to the platform!',
            skipped ? 'info' : 'success'
        );
    }
    
    showRewards() {
        document.getElementById('rewardModal').classList.remove('hidden');
    }
    
    closeRewards() {
        document.getElementById('rewardModal').classList.add('hidden');
    }
    
    markStepAsViewed(stepId) {
        this.completedSteps.add(stepId);
        this.saveProgress();
    }
    
    saveProgress() {
        const progress = {
            currentStep: this.currentStep,
            completedSteps: Array.from(this.completedSteps),
            timestamp: Date.now()
        };
        localStorage.setItem('tutorialProgress', JSON.stringify(progress));
    }
    
    loadProgress() {
        const saved = localStorage.getItem('tutorialProgress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                this.currentStep = progress.currentStep || 1;
                this.completedSteps = new Set(progress.completedSteps || []);
            } catch (e) {
                console.warn('Failed to load tutorial progress:', e);
            }
        }
    }
    
    updateTutorialTime() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeEl = document.getElementById('tutorialTime');
        if (timeEl) {
            timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
                type === 'success' ? 'bg-green-500' : 
                type === 'error' ? 'bg-red-500' : 
                type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
            } text-white`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }
    
    // Public methods
    restart() {
        localStorage.removeItem('tutorialCompleted');
        localStorage.removeItem('tutorialProgress');
        this.start();
    }
    
    showHelp() {
        this.start();
    }
    
    isCompleted() {
        return localStorage.getItem('tutorialCompleted') === 'true';
    }
}

// Initialize the wizard
let onboardingWizard;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onboardingWizard = new OnboardingWizard();
    });
} else {
    onboardingWizard = new OnboardingWizard();
}

// Make it globally accessible
window.OnboardingWizard = OnboardingWizard;
window.onboardingWizard = onboardingWizard;
