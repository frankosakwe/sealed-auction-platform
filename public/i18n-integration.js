/**
 * i18n Integration Script
 * Integrates internationalization into existing auction platform
 */

// Add language selector to header
function addLanguageSelectorToHeader() {
    const header = document.querySelector('header') || document.querySelector('.gradient-bg');
    if (!header) return;
    
    const langSelectorHTML = `
        <div class="flex items-center space-x-3 ml-4">
            <i class="fas fa-globe text-white"></i>
            <select id="languageSelector" class="px-3 py-1 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ar">العربية</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="pt">Português</option>
                <option value="ru">Русский</option>
                <option value="hi">हिन्दी</option>
            </select>
        </div>
    `;
    
    // Find a suitable place to insert
    const headerContent = header.querySelector('.flex') || header;
    if (headerContent) {
        headerContent.insertAdjacentHTML('beforeend', langSelectorHTML);
    }
}

// Override showNotification to use i18n
const originalShowNotification = window.showToastNotification;
if (originalShowNotification) {
    window.showToastNotification = function(message, type, duration) {
        // Translate message if it looks like a translation key
        const translatedMessage = message.includes('.') && window.i18n ? 
            window.i18n.t(message) : message;
        return originalShowNotification.call(this, translatedMessage, type, duration);
    };
}

// Override createAuctionCard to use i18n
const originalCreateAuctionCard = window.createAuctionCard;
if (originalCreateAuctionCard) {
    window.createAuctionCard = function(auction) {
        const card = originalCreateAuctionCard.call(this, auction);
        
        // If i18n is available, enhance the card
        if (window.i18n) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = card;
            
            // Translate status
            const statusBadge = tempDiv.querySelector('.bg-red-500, .bg-green-500');
            if (statusBadge) {
                const status = auction.status === 'closed' || new Date(auction.endTime) <= new Date() ? 'closed' : 'active';
                statusBadge.textContent = window.i18n.t(`auction.${status}`);
                statusBadge.dataset.i18n = `auction.${status}`;
            }
            
            // Format currency
            const currencyElements = tempDiv.querySelectorAll('[class*="XLM"]');
            currencyElements.forEach(el => {
                const match = el.textContent.match(/(\d+\.?\d*)\s*XLM/);
                if (match) {
                    const amount = parseFloat(match[1]);
                    el.textContent = window.i18n.formatCurrency(amount, 'XLM');
                }
            });
            
            // Format dates
            const dateElements = tempDiv.querySelectorAll('[class*="toLocaleDateString"]');
            dateElements.forEach(el => {
                if (auction.endTime) {
                    el.textContent = window.i18n.formatDate(auction.endTime, 'short');
                }
            });
            
            return tempDiv.innerHTML;
        }
        
        return card;
    };
}

// Initialize i18n integration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for i18n to be ready
    const checkI18n = setInterval(() => {
        if (window.i18n && window.i18n.translations && Object.keys(window.i18n.translations).length > 0) {
            clearInterval(checkI18n);
            initializeI18nIntegration();
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkI18n), 5000);
});

function initializeI18nIntegration() {
    console.log('Initializing i18n integration...');
    
    // Add language selector
    addLanguageSelectorToHeader();
    
    // Translate existing page elements
    if (window.i18n) {
        window.i18n.translatePage();
    }
    
    // Listen for language changes and reload auctions
    window.addEventListener('languageChanged', () => {
        if (typeof loadAuctions === 'function') {
            loadAuctions(true);
        }
    });
    
    console.log('i18n integration complete');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { addLanguageSelectorToHeader, initializeI18nIntegration };
}
