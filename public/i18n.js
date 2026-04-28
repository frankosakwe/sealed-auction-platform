/**
 * Internationalization (i18n) System
 * Supports multiple languages, RTL, currency formatting, date/time localization, and number formatting
 */

class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.rtlLanguages = ['ar', 'he', 'fa', 'ur'];
        this.currencyFormats = {};
        this.dateFormats = {};
        this.numberFormats = {};
        
        // Load saved language preference
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang) {
            this.currentLanguage = savedLang;
        } else {
            // Auto-detect browser language
            this.currentLanguage = this.detectBrowserLanguage();
        }
        
        this.init();
    }
    
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0];
        
        // Check if we support this language
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'pt', 'ru', 'hi'];
        return supportedLanguages.includes(langCode) ? langCode : 'en';
    }
    
    async init() {
        await this.loadTranslations(this.currentLanguage);
        this.applyLanguage();
    }
    
    async loadTranslations(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (response.ok) {
                this.translations = await response.json();
            } else {
                console.warn(`Failed to load translations for ${lang}, falling back to English`);
                if (lang !== 'en') {
                    const fallbackResponse = await fetch('/locales/en.json');
                    this.translations = await fallbackResponse.json();
                }
            }
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }
    
    async setLanguage(lang) {
        if (lang === this.currentLanguage) return;
        
        this.currentLanguage = lang;
        localStorage.setItem('preferredLanguage', lang);
        
        await this.loadTranslations(lang);
        this.applyLanguage();
        
        // Emit language change event
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
    
    applyLanguage() {
        // Set HTML lang and dir attributes
        document.documentElement.lang = this.currentLanguage;
        document.documentElement.dir = this.isRTL() ? 'rtl' : 'ltr';
        
        // Update all translatable elements
        this.translatePage();
        
        // Update language selector
        this.updateLanguageSelector();
    }
    
    isRTL() {
        return this.rtlLanguages.includes(this.currentLanguage);
    }
    
    translatePage() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder) {
                    element.placeholder = translation;
                }
            } else {
                element.textContent = translation;
            }
        });
        
        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
        
        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
        
        // Translate aria-labels
        document.querySelectorAll('[data-i18n-aria]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria');
            element.setAttribute('aria-label', this.t(key));
        });
    }
    
    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }
        
        if (typeof value === 'string') {
            // Replace parameters
            return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
                return params[param] !== undefined ? params[param] : match;
            });
        }
        
        return key;
    }
    
    // Currency formatting
    formatCurrency(amount, currency = 'XLM') {
        const locale = this.getLocale();
        
        // Special handling for XLM (Stellar Lumens)
        if (currency === 'XLM') {
            const formatted = new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 7
            }).format(amount);
            return `${formatted} XLM`;
        }
        
        // Standard currency formatting
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if currency not supported
            return `${amount} ${currency}`;
        }
    }
    
    // Date formatting
    formatDate(date, format = 'short') {
        const locale = this.getLocale();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        const formats = {
            short: { dateStyle: 'short' },
            medium: { dateStyle: 'medium' },
            long: { dateStyle: 'long' },
            full: { dateStyle: 'full' },
            datetime: { dateStyle: 'medium', timeStyle: 'short' },
            time: { timeStyle: 'short' }
        };
        
        try {
            return new Intl.DateTimeFormat(locale, formats[format] || formats.medium).format(dateObj);
        } catch (error) {
            return dateObj.toLocaleDateString();
        }
    }
    
    // Relative time formatting (e.g., "2 hours ago")
    formatRelativeTime(date) {
        const locale = this.getLocale();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const diffMs = now - dateObj;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        try {
            const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
            
            if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
            if (diffMins < 60) return rtf.format(-diffMins, 'minute');
            if (diffHours < 24) return rtf.format(-diffHours, 'hour');
            if (diffDays < 30) return rtf.format(-diffDays, 'day');
            
            return this.formatDate(dateObj, 'short');
        } catch (error) {
            return this.formatDate(dateObj, 'short');
        }
    }
    
    // Number formatting
    formatNumber(number, options = {}) {
        const locale = this.getLocale();
        
        try {
            return new Intl.NumberFormat(locale, {
                minimumFractionDigits: options.minDecimals || 0,
                maximumFractionDigits: options.maxDecimals || 2,
                useGrouping: options.useGrouping !== false
            }).format(number);
        } catch (error) {
            return number.toString();
        }
    }
    
    // Percentage formatting
    formatPercent(number, decimals = 1) {
        const locale = this.getLocale();
        
        try {
            return new Intl.NumberFormat(locale, {
                style: 'percent',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(number / 100);
        } catch (error) {
            return `${number}%`;
        }
    }
    
    // Get full locale string (e.g., 'en-US', 'ar-SA')
    getLocale() {
        const localeMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ar': 'ar-SA',
            'pt': 'pt-BR',
            'ru': 'ru-RU',
            'hi': 'hi-IN',
            'he': 'he-IL',
            'fa': 'fa-IR',
            'ur': 'ur-PK'
        };
        
        return localeMap[this.currentLanguage] || 'en-US';
    }
    
    // Get available languages
    getAvailableLanguages() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'es', name: 'Spanish', nativeName: 'Español' },
            { code: 'fr', name: 'French', nativeName: 'Français' },
            { code: 'de', name: 'German', nativeName: 'Deutsch' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
            { code: 'ru', name: 'Russian', nativeName: 'Русский' },
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
        ];
    }
    
    updateLanguageSelector() {
        const selector = document.getElementById('languageSelector');
        if (selector) {
            selector.value = this.currentLanguage;
        }
    }
    
    // Pluralization helper
    plural(count, singular, plural) {
        return count === 1 ? singular : plural;
    }
}

// Initialize global i18n instance
window.i18n = new I18n();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
}
