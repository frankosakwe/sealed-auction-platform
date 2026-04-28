# Internationalization (i18n) Implementation

## Overview

This document describes the comprehensive internationalization system implemented for the Sealed Auction Platform. The system supports multiple languages, RTL (Right-to-Left) languages, currency formatting, date/time localization, and number formatting.

## Features Implemented

### ✅ 1. Language Selection
- **Dropdown selector** with native language names
- **Flag-based visual selector** for better UX
- **Auto-detection** of browser language
- **10 supported languages**: English, Spanish, French, German, Chinese, Japanese, Arabic, Portuguese, Russian, Hindi

### ✅ 2. Text Translation
- **Hierarchical translation keys** (e.g., `auction.placeBid`)
- **Parameter substitution** (e.g., `{{count}} items`)
- **Automatic page translation** using `data-i18n` attributes
- **Dynamic content translation** for auction cards, notifications, etc.

### ✅ 3. Date/Time Localization
- **Multiple formats**: short, medium, long, full, datetime, time
- **Relative time formatting** (e.g., "2 hours ago")
- **Locale-aware formatting** using `Intl.DateTimeFormat`
- **Automatic timezone handling**

### ✅ 4. Currency Formatting
- **XLM (Stellar Lumens)** with custom formatting (up to 7 decimals)
- **Standard currencies** (USD, EUR, GBP, JPY, CNY, etc.)
- **Locale-aware symbols and separators**
- **Fallback for unsupported currencies**

### ✅ 5. RTL Language Support
- **Automatic direction switching** (`dir="rtl"`)
- **Complete CSS adjustments** for RTL layouts
- **Icon direction handling** (arrows, chevrons)
- **Form input alignment**
- **Flexbox and grid adjustments**

### ✅ 6. Number Formatting
- **Locale-aware grouping** (commas, periods, spaces)
- **Decimal precision control**
- **Percentage formatting**
- **Large number handling**

### ✅ 7. Language Preference Persistence
- **LocalStorage persistence** of selected language
- **Automatic restoration** on page reload
- **Cross-tab synchronization** support

## File Structure

```
sealed-auction-platform/
├── public/
│   ├── i18n.js                    # Core i18n engine
│   ├── language-switcher.js       # Language switcher component
│   ├── rtl-support.css            # RTL styling
│   ├── test-i18n.html             # Comprehensive test page
│   └── locales/
│       ├── en.json                # English translations
│       ├── es.json                # Spanish translations
│       ├── fr.json                # French translations
│       ├── de.json                # German translations
│       ├── ar.json                # Arabic translations (RTL)
│       ├── zh.json                # Chinese translations
│       ├── ja.json                # Japanese translations
│       ├── pt.json                # Portuguese translations
│       ├── ru.json                # Russian translations
│       └── hi.json                # Hindi translations
```

## Usage Guide

### 1. Basic Setup

Add the following scripts to your HTML:

```html
<!-- RTL Support CSS -->
<link rel="stylesheet" href="/rtl-support.css">

<!-- i18n Core -->
<script src="/i18n.js"></script>

<!-- Language Switcher -->
<script src="/language-switcher.js"></script>
```

### 2. Text Translation

Use `data-i18n` attributes for automatic translation:

```html
<h1 data-i18n="app.title">Sealed Bid Auction Platform</h1>
<button data-i18n="auction.placeBid">Place Bid</button>
```

For placeholders:

```html
<input type="text" data-i18n-placeholder="auth.username" placeholder="Username">
```

For titles:

```html
<button data-i18n-title="auction.share" title="Share">
    <i class="fas fa-share"></i>
</button>
```

### 3. Programmatic Translation

```javascript
// Simple translation
const text = window.i18n.t('auction.placeBid');

// Translation with parameters
const text = window.i18n.t('time.minutesAgo', { count: 5 });
// Result: "5 minutes ago" (or localized equivalent)
```

### 4. Currency Formatting

```javascript
// XLM (Stellar Lumens)
const xlm = window.i18n.formatCurrency(1234.5678, 'XLM');
// Result: "1,234.5678 XLM" (or localized)

// Standard currencies
const usd = window.i18n.formatCurrency(1234.56, 'USD');
// Result: "$1,234.56" (or localized)
```

### 5. Date/Time Formatting

```javascript
const date = new Date('2024-12-25T15:30:00');

// Different formats
const short = window.i18n.formatDate(date, 'short');     // 12/25/24
const medium = window.i18n.formatDate(date, 'medium');   // Dec 25, 2024
const long = window.i18n.formatDate(date, 'long');       // December 25, 2024
const full = window.i18n.formatDate(date, 'full');       // Wednesday, December 25, 2024
const datetime = window.i18n.formatDate(date, 'datetime'); // Dec 25, 2024, 3:30 PM

// Relative time
const relative = window.i18n.formatRelativeTime(date);
// Result: "2 hours ago" (or localized)
```

### 6. Number Formatting

```javascript
// Basic number
const num = window.i18n.formatNumber(1234567.89);
// Result: "1,234,567.89" (or localized)

// With options
const num = window.i18n.formatNumber(1234.5678, {
    minDecimals: 2,
    maxDecimals: 4
});

// Percentage
const percent = window.i18n.formatPercent(75.5);
// Result: "75.5%" (or localized)
```

### 7. Language Switching

```javascript
// Change language
await window.i18n.setLanguage('es');

// Get current language
const currentLang = window.i18n.currentLanguage;

// Check if RTL
const isRTL = window.i18n.isRTL();

// Get available languages
const languages = window.i18n.getAvailableLanguages();
```

### 8. Language Selector UI

```javascript
// Create dropdown selector
const html = LanguageSwitcher.createLanguageSelector('languageSelector', 'px-4 py-2 border rounded');

// Create flag selector
LanguageSwitcher.createFlagSelector('flagContainer');
```

## Translation File Structure

Each language file follows this structure:

```json
{
  "app": {
    "title": "Application Title",
    "subtitle": "Application Subtitle"
  },
  "nav": {
    "auctions": "Auctions",
    "create": "Create Auction"
  },
  "auction": {
    "title": "Title",
    "placeBid": "Place Bid"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

## RTL Language Support

The system automatically handles RTL languages (Arabic, Hebrew, Persian, Urdu):

- **Automatic direction switching**: `<html dir="rtl">`
- **Text alignment**: Right-aligned by default
- **Margin/padding**: Automatically flipped
- **Icons**: Directional icons (arrows, chevrons) are flipped
- **Flexbox**: Row direction reversed
- **Forms**: Input text aligned right

## Adding New Languages

1. Create a new JSON file in `public/locales/` (e.g., `it.json` for Italian)
2. Copy the structure from `en.json`
3. Translate all values
4. Add the language to the `getAvailableLanguages()` method in `i18n.js`:

```javascript
{ code: 'it', name: 'Italian', nativeName: 'Italiano' }
```

5. If the language is RTL, add it to the `rtlLanguages` array:

```javascript
this.rtlLanguages = ['ar', 'he', 'fa', 'ur', 'your-rtl-lang'];
```

## Testing

A comprehensive test page is available at `/test-i18n.html` that tests:

- ✅ Language switching
- ✅ Text translation
- ✅ Currency formatting (multiple currencies)
- ✅ Date/time localization (multiple formats)
- ✅ Number formatting
- ✅ RTL support
- ✅ Sample auction card with all features
- ✅ Automated test suite

## Integration with Existing Code

### Update Auction Cards

```javascript
function createAuctionCard(auction) {
    return `
        <div class="auction-card">
            <h3>${auction.title}</h3>
            <span class="status-badge" data-status="${auction.status}" data-i18n="auction.${auction.status}">
                ${window.i18n.t(`auction.${auction.status}`)}
            </span>
            <div>
                <span data-i18n="auction.startingBid">Starting Bid:</span>
                <span data-currency data-amount="${auction.startingBid}" data-currency="XLM">
                    ${window.i18n.formatCurrency(auction.startingBid, 'XLM')}
                </span>
            </div>
            <div>
                <span data-i18n="auction.ends">Ends:</span>
                <span data-date data-date="${auction.endTime}" data-date-format="short">
                    ${window.i18n.formatDate(auction.endTime, 'short')}
                </span>
            </div>
            <button onclick="openBidModal('${auction.id}')" data-i18n="auction.placeBid">
                Place Bid
            </button>
        </div>
    `;
}
```

### Update Notifications

```javascript
function addNotification(message, type) {
    // Translate message if it's a key
    const translatedMessage = message.includes('.') ? window.i18n.t(message) : message;
    
    // Show notification with translated message
    showToastNotification(translatedMessage, type);
}
```

## Browser Compatibility

- ✅ Chrome 24+
- ✅ Firefox 29+
- ✅ Safari 10+
- ✅ Edge 12+
- ✅ Opera 15+

Uses `Intl` API which is supported in all modern browsers.

## Performance Considerations

- **Lazy loading**: Translations are loaded on demand
- **Caching**: Loaded translations are cached in memory
- **LocalStorage**: Language preference is persisted
- **Minimal overhead**: ~50KB for core i18n engine + ~10KB per language file

## Accessibility

- ✅ `lang` attribute automatically set on `<html>`
- ✅ `dir` attribute automatically set for RTL
- ✅ `aria-label` support via `data-i18n-aria`
- ✅ Screen reader compatible
- ✅ Keyboard navigation maintained

## Future Enhancements

- [ ] Pluralization rules for complex languages
- [ ] Gender-specific translations
- [ ] Translation management UI
- [ ] Automatic translation via API
- [ ] Translation coverage reports
- [ ] A/B testing for translations

## Acceptance Criteria Status

| Criteria | Status | Notes |
|----------|--------|-------|
| Language switcher works | ✅ | Dropdown and flag selectors implemented |
| All text is translatable | ✅ | Via data-i18n attributes and programmatic API |
| Dates format correctly | ✅ | Multiple formats, locale-aware |
| Currencies display properly | ✅ | XLM and standard currencies supported |
| RTL languages work | ✅ | Complete CSS and layout support |
| Numbers format correctly | ✅ | Locale-aware grouping and decimals |
| Language preference persists | ✅ | LocalStorage persistence |

## Support

For issues or questions about the i18n implementation, please refer to:
- Test page: `/test-i18n.html`
- This documentation
- Code comments in `i18n.js` and `language-switcher.js`
