# Accessibility Quick Start Guide

## 🚀 Getting Started with WCAG 2.1 AA Compliance

This guide will help you quickly implement and test accessibility features in the Sealed Auction Platform.

## Step 1: Include Accessibility Files

Add these files to your HTML pages:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- ... other head elements ... -->
    
    <!-- Accessibility CSS -->
    <link rel="stylesheet" href="accessibility.css">
</head>
<body>
    <!-- Your content -->
    
    <!-- Accessibility JavaScript (before closing body tag) -->
    <script src="accessibility.js"></script>
</body>
</html>
```

## Step 2: Add Skip Navigation Link

Add this as the first element in your `<body>`:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

And ensure your main content has the ID:

```html
<main id="main-content" role="main">
    <!-- Your main content -->
</main>
```

## Step 3: Use Semantic HTML

### Before (Non-semantic):
```html
<div class="header">
    <div class="nav">...</div>
</div>
<div class="content">...</div>
<div class="footer">...</div>
```

### After (Semantic):
```html
<header role="banner">
    <nav role="navigation" aria-label="Main navigation">...</nav>
</header>
<main role="main" id="main-content">...</main>
<footer role="contentinfo">...</footer>
```

## Step 4: Add ARIA Labels to Buttons

### Icon-only buttons:
```html
<button 
    onclick="doSomething()" 
    aria-label="Add new auction"
    type="button"
>
    <i class="fas fa-plus" aria-hidden="true"></i>
</button>
```

### Buttons with loading states:
```html
<button 
    id="submit-btn"
    aria-busy="false"
    aria-label="Submit form"
>
    Submit
</button>

<!-- When loading -->
<script>
document.getElementById('submit-btn').setAttribute('aria-busy', 'true');
</script>
```

## Step 5: Make Forms Accessible

```html
<form>
    <div>
        <label for="username">
            Username <span class="required" aria-label="required">*</span>
        </label>
        <input 
            type="text" 
            id="username" 
            name="username"
            required 
            aria-required="true"
            aria-describedby="username-help"
            autocomplete="username"
        >
        <span id="username-help" class="help-text">
            Enter your username (3-20 characters)
        </span>
        <span id="username-error" class="error-message hidden" role="alert">
            Username is required
        </span>
    </div>
</form>
```

## Step 6: Add Alt Text to Images

### Informative images:
```html
<img 
    src="auction-item.jpg" 
    alt="Vintage Rolex Submariner watch from 1965 in excellent condition"
>
```

### Decorative images:
```html
<img 
    src="decorative-pattern.jpg" 
    alt=""
    aria-hidden="true"
>
```

## Step 7: Make Modals Accessible

```html
<div 
    id="modal" 
    class="modal hidden" 
    role="dialog" 
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby="modal-description"
>
    <h2 id="modal-title">Modal Title</h2>
    <p id="modal-description">Modal description text</p>
    
    <button 
        onclick="closeModal()" 
        aria-label="Close dialog"
        type="button"
    >
        <i class="fas fa-times" aria-hidden="true"></i>
    </button>
    
    <!-- Modal content -->
</div>
```

## Step 8: Implement Tab Navigation

```html
<div role="tablist" aria-label="Auction sections">
    <button 
        role="tab" 
        aria-selected="true" 
        aria-controls="auctions-panel"
        id="auctions-tab"
        tabindex="0"
    >
        Auctions
    </button>
    <button 
        role="tab" 
        aria-selected="false" 
        aria-controls="create-panel"
        id="create-tab"
        tabindex="-1"
    >
        Create
    </button>
</div>

<div 
    role="tabpanel" 
    id="auctions-panel" 
    aria-labelledby="auctions-tab"
    tabindex="0"
>
    <!-- Panel content -->
</div>
```

## Step 9: Add Screen Reader Announcements

```javascript
// Announce success message
window.a11y.announce('Auction created successfully', 'polite');

// Announce error (urgent)
window.a11y.announce('Error: Please fill in all required fields', 'assertive');
```

## Step 10: Test Your Implementation

### Automated Testing:
```bash
# Run accessibility tests
node test-accessibility.js
```

### Manual Testing:
1. **Keyboard Navigation**: Navigate using only Tab, Shift+Tab, Enter, Space, Escape
2. **Screen Reader**: Test with NVDA (Windows), VoiceOver (Mac), or TalkBack (Android)
3. **Color Contrast**: Use browser DevTools or online contrast checkers
4. **Zoom**: Test at 200% browser zoom
5. **Focus Indicators**: Verify visible focus on all interactive elements

### Browser Testing Page:
Open `test-accessibility.html` in your browser to run interactive tests.

## Common Patterns

### Loading States
```javascript
function showLoading(button) {
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    window.a11y.announce('Loading, please wait', 'polite');
}

function hideLoading(button) {
    button.setAttribute('aria-busy', 'false');
    button.disabled = false;
}
```

### Error Handling
```javascript
function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorElement = document.getElementById(`${inputId}-error`);
    
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    
    window.a11y.announce(message, 'assertive');
}
```

### Dynamic Content Updates
```javascript
function updateAuctionList(auctions) {
    const container = document.getElementById('auctions-grid');
    container.innerHTML = renderAuctions(auctions);
    
    window.a11y.announce(
        `${auctions.length} auctions loaded`, 
        'polite'
    );
}
```

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| Tab | Move to next interactive element |
| Shift+Tab | Move to previous interactive element |
| Enter | Activate button or link |
| Space | Activate button or checkbox |
| Escape | Close modal or cancel action |
| Arrow Keys | Navigate within components (tabs, menus) |
| Home | Jump to first item |
| End | Jump to last item |

## ARIA Attributes Quick Reference

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `aria-label` | Provides label for element | `<button aria-label="Close">×</button>` |
| `aria-labelledby` | References element that labels this one | `<div aria-labelledby="title-id">` |
| `aria-describedby` | References element that describes this one | `<input aria-describedby="help-text">` |
| `aria-required` | Indicates required field | `<input aria-required="true">` |
| `aria-invalid` | Indicates validation error | `<input aria-invalid="true">` |
| `aria-live` | Announces dynamic content | `<div aria-live="polite">` |
| `aria-busy` | Indicates loading state | `<button aria-busy="true">` |
| `aria-hidden` | Hides from screen readers | `<i aria-hidden="true">` |
| `aria-expanded` | Indicates expanded/collapsed state | `<button aria-expanded="false">` |
| `aria-selected` | Indicates selected state | `<button aria-selected="true">` |

## Color Contrast Requirements

### WCAG AA Standards:
- **Normal text** (< 18pt): Minimum 4.5:1 contrast ratio
- **Large text** (≥ 18pt or 14pt bold): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio
- **Focus indicators**: Minimum 3:1 contrast ratio

### Testing Tools:
- Chrome DevTools Lighthouse
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Colour Contrast Analyser (CCA)

## Resources

### Documentation:
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Testing Tools:
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Screen Readers:
- [NVDA](https://www.nvaccess.org/) (Windows, Free)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) (Windows)
- VoiceOver (macOS/iOS, Built-in)
- TalkBack (Android, Built-in)

## Troubleshooting

### Issue: Focus not visible
**Solution**: Ensure `accessibility.css` is loaded and check for CSS that removes outlines.

### Issue: Screen reader not announcing changes
**Solution**: Verify ARIA live regions are present and use `window.a11y.announce()`.

### Issue: Keyboard navigation not working
**Solution**: Check that elements have proper `tabindex` and event handlers.

### Issue: Modal focus not trapped
**Solution**: Ensure `accessibility.js` is loaded and modal has `role="dialog"`.

## Next Steps

1. ✅ Include accessibility files in all HTML pages
2. ✅ Add ARIA labels to all interactive elements
3. ✅ Ensure all images have alt text
4. ✅ Make all forms accessible
5. ✅ Test with keyboard navigation
6. ✅ Test with screen readers
7. ✅ Verify color contrast
8. ✅ Run automated tests
9. ✅ Get feedback from users with disabilities

## Support

For questions or issues with accessibility implementation:
- Review the full documentation in `ACCESSIBILITY_COMPLIANCE.md`
- Check `ACCESSIBILITY_IMPROVEMENTS.md` for detailed examples
- Run tests using `test-accessibility.html`
- Consult WCAG 2.1 guidelines for specific requirements

---

**Remember**: Accessibility is an ongoing process, not a one-time fix. Regularly test and update your implementation as you add new features.
