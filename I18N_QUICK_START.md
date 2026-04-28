# Internationalization Quick Start Guide

## Quick Integration (5 Minutes)

### Step 1: Add Scripts to index.html

Add these lines to your `<head>` section in `public/index.html`:

```html
<!-- RTL Support -->
<link rel="stylesheet" href="/rtl-support.css">

<!-- i18n Core (add before closing </body> tag) -->
<script src="/i18n.js"></script>
<script src="/language-switcher.js"></script>
<script src="/i18n-integration.js"></script>
```

### Step 2: Test the Implementation

Open your browser and navigate to:
```
http://localhost:3000/test-i18n.html
```

This comprehensive test page will verify:
- ✅ Language switching
- ✅ Text translation
- ✅ Currency formatting
- ✅ Date/time localization
- ✅ Number formatting
- ✅ RTL support

### Step 3: Use in Your Code

#### Translate Text
```javascript
// In HTML
<h1 data-i18n="app.title">Sealed Bid Auction Platform</h1>
<button data-i18n="auction.placeBid">Place Bid</button>

// In JavaScript
const text = window.i18n.t('auction.placeBid');
```

#### Format Currency
```javascript
const xlm = window.i18n.formatCurrency(1234.56, 'XLM');
// Result: "1,234.56 XLM" (or localized)
```

#### Format Dates
```javascript
const date = window.i18n.formatDate(new Date(), 'medium');
// Result: "Dec 25, 2024" (or localized)
```

#### Format Numbers
```javascript
const num = window.i18n.formatNumber(1234567.89);
// Result: "1,234,567.89" (or localized)
```

## Supported Languages

| Code | Language | Native Name | RTL |
|------|----------|-------------|-----|
| en | English | English | No |
| es | Spanish | Español | No |
| fr | French | Français | No |
| de | German | Deutsch | No |
| ar | Arabic | العربية | Yes |
| zh | Chinese | 中文 | No |
| ja | Japanese | 日本語 | No |
| pt | Portuguese | Português | No |
| ru | Russian | Русский | No |
| hi | Hindi | हिन्दी | No |

## Common Use Cases

### 1. Auction Card with i18n
```javascript
function createAuctionCard(auction) {
    return `
        <div class="auction-card">
            <h3>${auction.title}</h3>
            <span data-i18n="auction.status">Status:</span>
            <span data-i18n="auction.${auction.status}">${window.i18n.t(`auction.${auction.status}`)}</span>
            
            <div>
                <span data-i18n="auction.startingBid">Starting Bid:</span>
                ${window.i18n.formatCurrency(auction.startingBid, 'XLM')}
            </div>
            
            <div>
                <span data-i18n="auction.ends">Ends:</span>
                ${window.i18n.formatDate(auction.endTime, 'short')}
            </div>
            
            <button data-i18n="auction.placeBid">Place Bid</button>
        </div>
    `;
}
```

### 2. Notification with i18n
```javascript
function showAuctionNotification(auctionTitle) {
    const message = window.i18n.t('notifications.newAuction') + ': ' + auctionTitle;
    showToastNotification(message, 'info');
}
```

### 3. Form with i18n
```html
<form>
    <label data-i18n="auction.title">Title</label>
    <input type="text" data-i18n-placeholder="auction.title" placeholder="Title">
    
    <label data-i18n="auction.description">Description</label>
    <textarea data-i18n-placeholder="auction.description" placeholder="Description"></textarea>
    
    <button type="submit" data-i18n="common.save">Save</button>
    <button type="button" data-i18n="common.cancel">Cancel</button>
</form>
```

## Troubleshooting

### Language not changing?
1. Check browser console for errors
2. Verify translation files exist in `/public/locales/`
3. Clear browser cache and reload

### RTL not working?
1. Ensure `rtl-support.css` is loaded
2. Check that `<html dir="rtl">` is set
3. Verify language code is in RTL list

### Translations not showing?
1. Check translation key exists in JSON file
2. Verify `data-i18n` attribute is correct
3. Call `window.i18n.translatePage()` after dynamic content

## Next Steps

1. **Add more languages**: Create new JSON files in `/public/locales/`
2. **Customize translations**: Edit existing JSON files
3. **Add to existing pages**: Use `data-i18n` attributes
4. **Test thoroughly**: Use `/test-i18n.html`

## Full Documentation

See `INTERNATIONALIZATION_IMPLEMENTATION.md` for complete documentation.
