/**
 * Language Switcher Component
 * Provides UI for selecting and switching languages
 */

class LanguageSwitcher {
    constructor() {
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        // Listen for language changes
        window.addEventListener('languageChanged', (e) => {
            this.onLanguageChanged(e.detail.language);
        });
    }
    
    setupEventListeners() {
        // Language selector dropdown
        const selector = document.getElementById('languageSelector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                window.i18n.setLanguage(e.target.value);
            });
        }
        
        // Mobile language selector
        const mobileSelector = document.getElementById('mobileLanguageSelector');
        if (mobileSelector) {
            mobileSelector.addEventListener('change', (e) => {
                window.i18n.setLanguage(e.target.value);
            });
        }
    }
    
    onLanguageChanged(language) {
        // Update UI elements that need special handling
        this.updateDynamicContent();
        this.updateDateTimeDisplays();
        this.updateCurrencyDisplays();
        this.updateNumberDisplays();
        
        // Reload auctions to update displayed text
        if (typeof loadAuctions === 'function') {
            loadAuctions(true);
        }
        
        // Show notification
        if (typeof showToastNotification === 'function') {
            showToastNotification(window.i18n.t('settings.language') + ' changed', 'success');
        }
    }
    
    updateDynamicContent() {
        // Update auction cards
        document.querySelectorAll('.auction-card').forEach(card => {
            this.updateAuctionCard(card);
        });
        
        // Update notification texts
        this.updateNotifications();
    }
    
    updateAuctionCard(card) {
        // Update status badges
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge) {
            const status = statusBadge.dataset.status;
            if (status) {
                statusBadge.textContent = window.i18n.t(`auction.${status}`);
            }
        }
        
        // Update button texts
        const placeBidBtn = card.querySelector('[onclick*="openBidModal"]');
        if (placeBidBtn) {
            const icon = placeBidBtn.querySelector('i');
            placeBidBtn.innerHTML = '';
            if (icon) placeBidBtn.appendChild(icon);
            placeBidBtn.appendChild(document.createTextNode(window.i18n.t('auction.placeBid')));
        }
        
        const viewDetailsBtn = card.querySelector('[onclick*="viewAuctionDetails"]');
        if (viewDetailsBtn) {
            const icon = viewDetailsBtn.querySelector('i');
            viewDetailsBtn.innerHTML = '';
            if (icon) viewDetailsBtn.appendChild(icon);
            viewDetailsBtn.appendChild(document.createTextNode(window.i18n.t('auction.viewDetails')));
        }
    }
    
    updateDateTimeDisplays() {
        // Update all date/time displays
        document.querySelectorAll('[data-date]').forEach(element => {
            const date = element.dataset.date;
            if (date) {
                const format = element.dataset.dateFormat || 'medium';
                element.textContent = window.i18n.formatDate(date, format);
            }
        });
        
        // Update relative time displays
        document.querySelectorAll('[data-relative-time]').forEach(element => {
            const date = element.dataset.relativeTime;
            if (date) {
                element.textContent = window.i18n.formatRelativeTime(date);
            }
        });
    }
    
    updateCurrencyDisplays() {
        // Update all currency displays
        document.querySelectorAll('[data-currency]').forEach(element => {
            const amount = parseFloat(element.dataset.amount);
            const currency = element.dataset.currency || 'XLM';
            if (!isNaN(amount)) {
                element.textContent = window.i18n.formatCurrency(amount, currency);
            }
        });
    }
    
    updateNumberDisplays() {
        // Update all number displays
        document.querySelectorAll('[data-number]').forEach(element => {
            const number = parseFloat(element.dataset.number);
            if (!isNaN(number)) {
                const options = {
                    minDecimals: parseInt(element.dataset.minDecimals) || 0,
                    maxDecimals: parseInt(element.dataset.maxDecimals) || 2
                };
                element.textContent = window.i18n.formatNumber(number, options);
            }
        });
    }
    
    updateNotifications() {
        // Re-render notification center if open
        const notificationCenter = document.getElementById('notification-center');
        if (notificationCenter && !notificationCenter.classList.contains('hidden')) {
            if (typeof renderNotificationCenter === 'function') {
                renderNotificationCenter();
            }
        }
    }
    
    // Create language selector HTML
    static createLanguageSelector(id = 'languageSelector', classes = '') {
        const languages = window.i18n.getAvailableLanguages();
        const currentLang = window.i18n.currentLanguage;
        
        let html = `<select id="${id}" class="${classes}" aria-label="${window.i18n.t('settings.language')}">`;
        
        languages.forEach(lang => {
            const selected = lang.code === currentLang ? 'selected' : '';
            html += `<option value="${lang.code}" ${selected}>${lang.nativeName}</option>`;
        });
        
        html += '</select>';
        return html;
    }
    
    // Create language flag selector (visual alternative)
    static createFlagSelector(containerId = 'flagSelector') {
        const languages = window.i18n.getAvailableLanguages();
        const currentLang = window.i18n.currentLanguage;
        
        const flagEmojis = {
            'en': '🇺🇸',
            'es': '🇪🇸',
            'fr': '🇫🇷',
            'de': '🇩🇪',
            'zh': '🇨🇳',
            'ja': '🇯🇵',
            'ar': '🇸🇦',
            'pt': '🇧🇷',
            'ru': '🇷🇺',
            'hi': '🇮🇳'
        };
        
        let html = '<div class="flex items-center space-x-2">';
        
        languages.forEach(lang => {
            const active = lang.code === currentLang ? 'ring-2 ring-purple-500' : '';
            html += `
                <button 
                    onclick="window.i18n.setLanguage('${lang.code}')"
                    class="text-2xl hover:scale-110 transition-transform ${active} rounded-full"
                    title="${lang.nativeName}"
                    aria-label="${lang.nativeName}">
                    ${flagEmojis[lang.code] || '🌐'}
                </button>
            `;
        });
        
        html += '</div>';
        
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = html;
        }
        
        return html;
    }
}

// Initialize language switcher when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.languageSwitcher = new LanguageSwitcher();
    });
} else {
    window.languageSwitcher = new LanguageSwitcher();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageSwitcher;
}
