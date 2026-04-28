# Internationalization Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ index.html   │  │ Auction Cards│  │ Notifications│      │
│  │ (data-i18n)  │  │ (dynamic)    │  │ (dynamic)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                    i18n Core Layer                            │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │              i18n.js (Core Engine)                   │     │
│  │  ┌────────────────────────────────────────────┐     │     │
│  │  │ Translation Manager                        │     │     │
│  │  │  - Load translations                       │     │     │
│  │  │  - Key lookup                              │     │     │
│  │  │  - Parameter substitution                  │     │     │
│  │  └────────────────────────────────────────────┘     │     │
│  │  ┌────────────────────────────────────────────┐     │     │
│  │  │ Formatting Engine                          │     │     │
│  │  │  - Currency (Intl.NumberFormat)            │     │     │
│  │  │  - Date/Time (Intl.DateTimeFormat)         │     │     │
│  │  │  - Numbers (Intl.NumberFormat)             │     │     │
│  │  │  - Relative Time (Intl.RelativeTimeFormat) │     │     │
│  │  └────────────────────────────────────────────┘     │     │
│  │  ┌────────────────────────────────────────────┐     │     │
│  │  │ RTL Manager                                │     │     │
│  │  │  - Direction detection                     │     │     │
│  │  │  - HTML attribute management               │     │     │
│  │  └────────────────────────────────────────────┘     │     │
│  └──────────────────────────────────────────────────────┘     │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │         language-switcher.js (UI Component)          │     │
│  │  - Language selector rendering                       │     │
│  │  - Event handling                                    │     │
│  │  - Dynamic content updates                           │     │
│  └──────────────────────────────────────────────────────┘     │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │      i18n-integration.js (Integration Layer)         │     │
│  │  - Existing code integration                         │     │
│  │  - Automatic translation injection                   │     │
│  │  - Event listeners                                   │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                    Data Layer                                 │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │           Translation Files (JSON)                   │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │ en.json  │  │ es.json  │  │ ar.json  │  ...     │     │
│  │  │ (English)│  │ (Spanish)│  │ (Arabic) │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  └──────────────────────────────────────────────────────┘     │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │              LocalStorage                            │     │
│  │  - preferredLanguage: "en"                           │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                    Styling Layer                              │
│                             │                                 │
│  ┌──────────────────────────▼──────────────────────────┐     │
│  │           rtl-support.css                            │     │
│  │  - Direction-based styles                            │     │
│  │  - Margin/padding adjustments                        │     │
│  │  - Icon direction handling                           │     │
│  │  - Flexbox/grid RTL support                          │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Page Load Flow

```
User Opens Page
      │
      ▼
Check LocalStorage
      │
      ├─── Found ────► Load Saved Language
      │                      │
      └─── Not Found ───► Detect Browser Language
                             │
                             ▼
                    Load Translation File
                             │
                             ▼
                    Apply Language Settings
                             │
                             ├─► Set HTML lang attribute
                             ├─► Set HTML dir attribute (RTL)
                             └─► Translate Page Elements
                                      │
                                      ▼
                             Page Ready with i18n
```

### 2. Language Change Flow

```
User Selects Language
      │
      ▼
window.i18n.setLanguage(code)
      │
      ├─► Save to LocalStorage
      │
      ├─► Load Translation File
      │         │
      │         ▼
      │   Fetch /locales/{code}.json
      │         │
      │         ▼
      │   Parse JSON
      │         │
      │         ▼
      │   Store in Memory
      │
      ├─► Update HTML Attributes
      │         │
      │         ├─► document.documentElement.lang = code
      │         └─► document.documentElement.dir = rtl/ltr
      │
      ├─► Translate Page
      │         │
      │         ├─► Find all [data-i18n] elements
      │         ├─► Find all [data-i18n-placeholder] elements
      │         ├─► Find all [data-i18n-title] elements
      │         └─► Update text content
      │
      ├─► Update Dynamic Content
      │         │
      │         ├─► Auction cards
      │         ├─► Notifications
      │         └─► Other dynamic elements
      │
      └─► Emit languageChanged Event
                │
                ▼
          Listeners Update UI
```

### 3. Translation Flow

```
Request Translation
      │
      ▼
window.i18n.t('auction.placeBid', {count: 5})
      │
      ├─► Split key by '.'
      │         │
      │         ▼
      │   ['auction', 'placeBid']
      │
      ├─► Navigate translation object
      │         │
      │         ▼
      │   translations.auction.placeBid
      │         │
      │         ▼
      │   "Place Bid"
      │
      └─► Replace parameters
                │
                ▼
          Return translated text
```

### 4. Currency Formatting Flow

```
Format Currency Request
      │
      ▼
window.i18n.formatCurrency(1234.56, 'XLM')
      │
      ├─► Get current locale
      │         │
      │         ▼
      │   'en-US', 'ar-SA', etc.
      │
      ├─► Check currency type
      │         │
      │         ├─── XLM ────► Custom formatting
      │         │                  │
      │         │                  ▼
      │         │            Format with 7 decimals
      │         │                  │
      │         │                  ▼
      │         │            "1,234.5600000 XLM"
      │         │
      │         └─── Other ───► Intl.NumberFormat
      │                              │
      │                              ▼
      │                        Format with currency
      │                              │
      │                              ▼
      │                        "$1,234.56"
      │
      └─► Return formatted string
```

### 5. RTL Handling Flow

```
Language Change to RTL
      │
      ▼
Check if RTL language
      │
      ├─── Yes (ar, he, fa, ur) ───┐
      │                             │
      └─── No ──────────────────────┤
                                    │
                                    ▼
                          Set dir attribute
                                    │
                                    ├─► dir="rtl"
                                    └─► dir="ltr"
                                          │
                                          ▼
                                  CSS applies styles
                                          │
                                          ├─► Flip margins
                                          ├─► Flip paddings
                                          ├─► Reverse flex direction
                                          ├─► Flip icons
                                          └─► Adjust text alignment
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                   DOM                               │     │
│  │  ┌──────────────────────────────────────────┐      │     │
│  │  │  <html lang="en" dir="ltr">              │      │     │
│  │  │    <h1 data-i18n="app.title">...</h1>    │      │     │
│  │  │    <select id="languageSelector">...</select>   │     │
│  │  └──────────────────────────────────────────┘      │     │
│  └────────────────────────────────────────────────────┘     │
│                         ▲                                    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              JavaScript Runtime                      │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │  window.i18n                               │     │    │
│  │  │    - currentLanguage: "en"                 │     │    │
│  │  │    - translations: {...}                   │     │    │
│  │  │    - methods: t(), formatCurrency(), ...  │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │  window.languageSwitcher                   │     │    │
│  │  │    - Event listeners                       │     │    │
│  │  │    - UI updates                            │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └──────────────────────────────────────────────────────┘    │
│                         ▲                                    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              LocalStorage                            │    │
│  │    preferredLanguage: "en"                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                         ▲                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          │ HTTP Request
                          │
┌─────────────────────────┼────────────────────────────────────┐
│                      Server                                   │
│                         │                                     │
│  ┌──────────────────────▼──────────────────────────────┐     │
│  │           Static File Server                         │     │
│  │  /locales/en.json                                    │     │
│  │  /locales/es.json                                    │     │
│  │  /locales/ar.json                                    │     │
│  │  ...                                                 │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. No External Dependencies
- **Decision**: Use native JavaScript and Intl API
- **Rationale**: Reduce bundle size, improve performance
- **Trade-off**: Limited to modern browsers

### 2. JSON Translation Files
- **Decision**: Store translations in separate JSON files
- **Rationale**: Easy to edit, version control friendly
- **Trade-off**: Requires HTTP request per language

### 3. LocalStorage Persistence
- **Decision**: Save language preference in LocalStorage
- **Rationale**: Persist across sessions, no server needed
- **Trade-off**: Not synced across devices

### 4. Automatic RTL Detection
- **Decision**: Automatically switch to RTL based on language
- **Rationale**: Better UX, no manual configuration
- **Trade-off**: Assumes all speakers of RTL languages prefer RTL

### 5. Hierarchical Translation Keys
- **Decision**: Use dot notation (e.g., `auction.placeBid`)
- **Rationale**: Organized, prevents key collisions
- **Trade-off**: Slightly more verbose

## Performance Optimization

### 1. Lazy Loading
```
Only load translation file when language is selected
Not all languages loaded at once
```

### 2. Caching
```
Translation files cached in memory
No repeated HTTP requests
```

### 3. Minimal DOM Manipulation
```
Only update elements that need translation
Batch DOM updates when possible
```

### 4. Event Delegation
```
Single event listener for language selector
Not one per element
```

## Security Considerations

### 1. XSS Prevention
```
Translation values are text content, not HTML
No innerHTML usage for translations
```

### 2. Input Validation
```
Language codes validated against whitelist
Translation keys sanitized
```

### 3. CORS
```
Translation files served from same origin
No cross-origin requests
```

## Extensibility

### Adding New Features

1. **New Language**
   - Add JSON file
   - Update language list
   - Test RTL if applicable

2. **New Translation Key**
   - Add to all language files
   - Use in code
   - Test across languages

3. **New Formatting Function**
   - Add to i18n.js
   - Document in API
   - Add tests

4. **New UI Component**
   - Use data-i18n attributes
   - Call translatePage() after render
   - Test language switching

---

**Architecture Version**: 1.0.0  
**Last Updated**: 2026-04-28
