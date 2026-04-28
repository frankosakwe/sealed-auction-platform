/**
 * Features Module - Lazy loaded feature cards
 * Provides interactive feature showcase with animations
 */

class FeaturesModule {
    constructor() {
        this.features = [
            {
                icon: 'fa-shield-alt',
                title: 'Secure Bidding',
                description: 'Military-grade encryption protects your bids until auction ends',
                color: 'blue'
            },
            {
                icon: 'fa-lock',
                title: 'Private Input',
                description: 'Your bid amounts remain completely confidential until auction completion',
                color: 'green'
            },
            {
                icon: 'fa-link',
                title: 'Blockchain Powered',
                description: 'Stellar blockchain ensures transparency and immutability of auction results',
                color: 'purple'
            },
            {
                icon: 'fa-chart-line',
                title: 'Real-time Analytics',
                description: 'Track auction performance with comprehensive analytics dashboard',
                color: 'orange'
            },
            {
                icon: 'fa-mobile-alt',
                title: 'Mobile Optimized',
                description: 'Full functionality on all devices with responsive design',
                color: 'pink'
            },
            {
                icon: 'fa-bolt',
                title: 'Lightning Fast',
                description: 'Optimized performance ensures smooth bidding experience',
                color: 'yellow'
            }
        ];
        
        this.init();
    }

    init() {
        this.renderFeatures();
        this.setupAnimations();
        this.setupIntersectionObserver();
    }

    renderFeatures() {
        const featuresContainer = document.querySelector('.features');
        if (!featuresContainer) return;

        // Clear loading skeletons
        featuresContainer.innerHTML = '';

        // Create feature cards
        this.features.forEach((feature, index) => {
            const card = document.createElement('div');
            card.className = `feature-card bg-white rounded-lg shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl opacity-0`;
            card.dataset.featureIndex = index;
            
            card.innerHTML = `
                <div class="feature-icon text-${feature.color}-500 text-4xl mb-4">
                    <i class="fas ${feature.icon}"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">${feature.title}</h3>
                <p class="text-gray-600">${feature.description}</p>
                <button class="mt-4 text-${feature.color}-600 hover:text-${feature.color}-800 font-semibold flex items-center">
                    Learn More <i class="fas fa-arrow-right ml-2"></i>
                </button>
            `;

            featuresContainer.appendChild(card);
        });

        // Animate cards in sequence
        setTimeout(() => this.animateCards(), 100);
    }

    animateCards() {
        const cards = document.querySelectorAll('.feature-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.remove('opacity-0');
                card.classList.add('translate-y-0');
            }, index * 100);
        });
    }

    setupAnimations() {
        // Add hover effects
        document.addEventListener('mouseover', (e) => {
            const card = e.target.closest('.feature-card');
            if (card) {
                this.animateCardHover(card, true);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const card = e.target.closest('.feature-card');
            if (card) {
                this.animateCardHover(card, false);
            }
        });

        // Add click handlers
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.feature-card button');
            if (button) {
                const card = button.closest('.feature-card');
                const index = parseInt(card.dataset.featureIndex);
                this.showFeatureDetails(this.features[index]);
            }
        });
    }

    animateCardHover(card, isHovering) {
        const icon = card.querySelector('.feature-icon i');
        if (isHovering) {
            icon.style.transform = 'scale(1.2) rotate(5deg)';
            icon.style.transition = 'transform 0.3s ease';
        } else {
            icon.style.transform = 'scale(1) rotate(0deg)';
        }
    }

    showFeatureDetails(feature) {
        // Create modal for feature details
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-md w-full transform transition-all duration-300 scale-95">
                <div class="text-${feature.color}-500 text-5xl mb-4 text-center">
                    <i class="fas ${feature.icon}"></i>
                </div>
                <h3 class="text-2xl font-bold mb-4 text-center">${feature.title}</h3>
                <p class="text-gray-600 mb-6">${feature.description}</p>
                <div class="space-y-3 mb-6">
                    <div class="flex items-center text-sm">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <span>Advanced security protocols</span>
                    </div>
                    <div class="flex items-center text-sm">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <span>Regular security audits</span>
                    </div>
                    <div class="flex items-center text-sm">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <span>Industry best practices</span>
                    </div>
                </div>
                <button class="w-full bg-gradient-to-r from-${feature.color}-500 to-${feature.color}-600 text-white rounded-lg py-3 font-semibold hover:from-${feature.color}-600 hover:to-${feature.color}-700 transition">
                    Get Started
                </button>
                <button class="close-modal mt-3 w-full bg-gray-200 text-gray-700 rounded-lg py-2 font-semibold hover:bg-gray-300 transition">
                    Close
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate modal in
        setTimeout(() => {
            modal.querySelector('div > div').classList.remove('scale-95');
            modal.querySelector('div > div').classList.add('scale-100');
        }, 10);

        // Setup modal close handlers
        const closeModal = () => {
            modal.querySelector('div > div').classList.remove('scale-100');
            modal.querySelector('div > div').classList.add('scale-95');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            // Observe feature cards
            document.querySelectorAll('.feature-card').forEach(card => {
                observer.observe(card);
            });
        }
    }
}

// Initialize features module when loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the right page
    if (document.querySelector('.features')) {
        new FeaturesModule();
    }
});

// Export for potential use in other modules
window.FeaturesModule = FeaturesModule;
