/**
 * Accessibility Utilities for WCAG 2.1 AA Compliance
 * Provides keyboard navigation, focus management, and screen reader support
 */

class AccessibilityManager {
    constructor() {
        this.focusableSelectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(', ');
        
        this.init();
    }

    init() {
        this.setupSkipLinks();
        this.setupFocusManagement();
        this.setupKeyboardNavigation();
        this.setupAriaLiveRegions();
        this.setupModalAccessibility();
        this.enhanceFormAccessibility();
        this.setupReducedMotion();
    }

    /**
     * Setup skip navigation links
     */
    setupSkipLinks() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        skipLink.setAttribute('aria-label', 'Skip to main content');
        
        // Style skip link
        const style = document.createElement('style');
        style.textContent = `
            .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: var(--button-primary);
                color: white;
                padding: 8px 16px;
                text-decoration: none;
                z-index: 10000;
                border-radius: 0 0 4px 0;
                font-weight: 600;
            }
            .skip-link:focus {
                top: 0;
                outline: 3px solid var(--button-primary);
                outline-offset: 2px;
            }
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border-width: 0;
            }
            .sr-only-focusable:focus {
                position: static;
                width: auto;
                height: auto;
                padding: inherit;
                margin: inherit;
                overflow: visible;
                clip: auto;
                white-space: normal;
            }
        `;
        
        document.head.appendChild(style);
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Ensure main content has ID
        const main = document.querySelector('main');
        if (main && !main.id) {
            main.id = 'main-content';
        }
    }

    /**
     * Setup focus management
     */
    setupFocusManagement() {
        // Add visible focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });

        // Enhance focus visibility
        const focusStyle = document.createElement('style');
        focusStyle.textContent = `
            body.keyboard-navigation *:focus {
                outline: 3px solid var(--button-primary) !important;
                outline-offset: 2px !important;
            }
            
            body.keyboard-navigation *:focus:not(:focus-visible) {
                outline: none;
            }
            
            *:focus-visible {
                outline: 3px solid var(--button-primary);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(focusStyle);
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
        });

        // Arrow key navigation for tabs
        document.querySelectorAll('[role="tablist"]').forEach(tablist => {
            this.setupTabNavigation(tablist);
        });
    }

    /**
     * Setup tab navigation with arrow keys
     */
    setupTabNavigation(tablist) {
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('keydown', (e) => {
                let newIndex = index;
                
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    newIndex = (index + 1) % tabs.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    newIndex = (index - 1 + tabs.length) % tabs.length;
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    newIndex = 0;
                } else if (e.key === 'End') {
                    e.preventDefault();
                    newIndex = tabs.length - 1;
                }
                
                if (newIndex !== index) {
                    tabs[newIndex].focus();
                    tabs[newIndex].click();
                }
            });
        });
    }

    /**
     * Setup ARIA live regions for announcements
     */
    setupAriaLiveRegions() {
        // Create polite live region for status messages
        if (!document.getElementById('aria-live-polite')) {
            const politeRegion = document.createElement('div');
            politeRegion.id = 'aria-live-polite';
            politeRegion.setAttribute('role', 'status');
            politeRegion.setAttribute('aria-live', 'polite');
            politeRegion.setAttribute('aria-atomic', 'true');
            politeRegion.className = 'sr-only';
            document.body.appendChild(politeRegion);
        }

        // Create assertive live region for alerts
        if (!document.getElementById('aria-live-assertive')) {
            const assertiveRegion = document.createElement('div');
            assertiveRegion.id = 'aria-live-assertive';
            assertiveRegion.setAttribute('role', 'alert');
            assertiveRegion.setAttribute('aria-live', 'assertive');
            assertiveRegion.setAttribute('aria-atomic', 'true');
            assertiveRegion.className = 'sr-only';
            document.body.appendChild(assertiveRegion);
        }
    }

    /**
     * Announce message to screen readers
     */
    announce(message, priority = 'polite') {
        const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
        const region = document.getElementById(regionId);
        
        if (region) {
            // Clear and set new message
            region.textContent = '';
            setTimeout(() => {
                region.textContent = message;
            }, 100);
        }
    }

    /**
     * Setup modal accessibility
     */
    setupModalAccessibility() {
        // Observe for modal additions
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.matches('[role="dialog"], .modal, [id*="modal"]')) {
                        this.enhanceModal(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Enhance modal with accessibility features
     */
    enhanceModal(modal) {
        // Set ARIA attributes
        if (!modal.getAttribute('role')) {
            modal.setAttribute('role', 'dialog');
        }
        modal.setAttribute('aria-modal', 'true');
        
        // Find or create title
        const title = modal.querySelector('h1, h2, h3, [class*="title"]');
        if (title && !title.id) {
            title.id = `modal-title-${Date.now()}`;
            modal.setAttribute('aria-labelledby', title.id);
        }

        // Trap focus
        this.trapFocus(modal);

        // Store last focused element
        const lastFocused = document.activeElement;
        modal.dataset.lastFocused = lastFocused ? lastFocused.id || '' : '';

        // Focus first focusable element
        setTimeout(() => {
            const firstFocusable = modal.querySelector(this.focusableSelectors);
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);

        // Restore focus on close
        const closeButtons = modal.querySelectorAll('[data-dismiss], [onclick*="close"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.restoreFocus(modal);
            });
        });
    }

    /**
     * Trap focus within element
     */
    trapFocus(element) {
        element.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            const focusableElements = Array.from(element.querySelectorAll(this.focusableSelectors));
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        });
    }

    /**
     * Restore focus to previous element
     */
    restoreFocus(modal) {
        const lastFocusedId = modal.dataset.lastFocused;
        if (lastFocusedId) {
            const element = document.getElementById(lastFocusedId);
            if (element) {
                element.focus();
            }
        }
    }

    /**
     * Close top modal
     */
    closeTopModal() {
        const modals = document.querySelectorAll('[role="dialog"]:not(.hidden), .modal:not(.hidden)');
        if (modals.length > 0) {
            const topModal = modals[modals.length - 1];
            const closeButton = topModal.querySelector('[data-dismiss], [onclick*="close"]');
            if (closeButton) {
                closeButton.click();
            } else {
                topModal.classList.add('hidden');
                this.restoreFocus(topModal);
            }
        }
    }

    /**
     * Enhance form accessibility
     */
    enhanceFormAccessibility() {
        document.querySelectorAll('form').forEach(form => {
            // Ensure all inputs have labels
            form.querySelectorAll('input, select, textarea').forEach(input => {
                if (!input.id) {
                    input.id = `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }

                // Check for associated label
                let label = form.querySelector(`label[for="${input.id}"]`);
                if (!label && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                    // Try to find nearby label
                    label = input.closest('div')?.querySelector('label');
                    if (label) {
                        label.setAttribute('for', input.id);
                    }
                }

                // Mark required fields
                if (input.required && !input.getAttribute('aria-required')) {
                    input.setAttribute('aria-required', 'true');
                }

                // Add error message association
                const errorElement = input.parentElement?.querySelector('.error-message, [class*="error"]');
                if (errorElement && !errorElement.id) {
                    errorElement.id = `error-${input.id}`;
                    input.setAttribute('aria-describedby', errorElement.id);
                }
            });

            // Announce form errors
            form.addEventListener('submit', (e) => {
                const errors = form.querySelectorAll('.error-message:not(:empty), [class*="error"]:not(:empty)');
                if (errors.length > 0) {
                    this.announce(`Form has ${errors.length} error${errors.length > 1 ? 's' : ''}. Please correct and try again.`, 'assertive');
                }
            });
        });
    }

    /**
     * Setup reduced motion support
     */
    setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const updateMotion = (e) => {
            if (e.matches) {
                document.body.classList.add('reduce-motion');
            } else {
                document.body.classList.remove('reduce-motion');
            }
        };

        updateMotion(prefersReducedMotion);
        prefersReducedMotion.addEventListener('change', updateMotion);
    }

    /**
     * Add ARIA label to element
     */
    addAriaLabel(element, label) {
        if (element && label) {
            element.setAttribute('aria-label', label);
        }
    }

    /**
     * Update ARIA live region
     */
    updateLiveRegion(message, priority = 'polite') {
        this.announce(message, priority);
    }

    /**
     * Make element focusable
     */
    makeFocusable(element) {
        if (element && !element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }
    }

    /**
     * Remove from tab order
     */
    removeFromTabOrder(element) {
        if (element) {
            element.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Check color contrast (basic check)
     */
    checkContrast(foreground, background) {
        // Convert hex to RGB
        const getRGB = (color) => {
            const hex = color.replace('#', '');
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16)
            };
        };

        // Calculate relative luminance
        const getLuminance = (rgb) => {
            const rsRGB = rgb.r / 255;
            const gsRGB = rgb.g / 255;
            const bsRGB = rgb.b / 255;

            const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
            const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
            const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const fgRGB = getRGB(foreground);
        const bgRGB = getRGB(background);

        const fgLum = getLuminance(fgRGB);
        const bgLum = getLuminance(bgRGB);

        const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

        return {
            ratio: ratio.toFixed(2),
            passAA: ratio >= 4.5,
            passAAA: ratio >= 7,
            passLargeAA: ratio >= 3,
            passLargeAAA: ratio >= 4.5
        };
    }
}

// Initialize accessibility manager
const accessibilityManager = new AccessibilityManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}

// Global helper functions
window.a11y = {
    announce: (message, priority) => accessibilityManager.announce(message, priority),
    addAriaLabel: (element, label) => accessibilityManager.addAriaLabel(element, label),
    makeFocusable: (element) => accessibilityManager.makeFocusable(element),
    removeFromTabOrder: (element) => accessibilityManager.removeFromTabOrder(element),
    checkContrast: (fg, bg) => accessibilityManager.checkContrast(fg, bg)
};

console.log('✅ Accessibility features initialized');
