#!/usr/bin/env node

/**
 * Standalone test for i18n implementation
 * Tests core functionality without needing a browser
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing i18n Implementation\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

// Test 1: Check all required files exist
test('All core files exist', () => {
    const files = [
        'public/i18n.js',
        'public/language-switcher.js',
        'public/rtl-support.css',
        'public/i18n-integration.js',
        'public/test-i18n.html'
    ];
    
    files.forEach(file => {
        if (!fs.existsSync(file)) {
            throw new Error(`Missing file: ${file}`);
        }
    });
});

// Test 2: Check translation files exist
test('Translation files exist', () => {
    const langs = ['en', 'es', 'fr', 'de', 'ar', 'zh'];
    
    langs.forEach(lang => {
        const file = `public/locales/${lang}.json`;
        if (!fs.existsSync(file)) {
            throw new Error(`Missing translation: ${file}`);
        }
    });
});

// Test 3: Validate JSON structure
test('Translation files are valid JSON', () => {
    const langs = ['en', 'es', 'fr', 'de', 'ar', 'zh'];
    
    langs.forEach(lang => {
        const file = `public/locales/${lang}.json`;
        const content = fs.readFileSync(file, 'utf8');
        JSON.parse(content); // Will throw if invalid
    });
});

// Test 4: Check translation keys consistency
test('All languages have same keys as English', () => {
    const enFile = 'public/locales/en.json';
    const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));
    
    function getKeys(obj, prefix = '') {
        let keys = [];
        for (let key in obj) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                keys = keys.concat(getKeys(obj[key], fullKey));
            } else {
                keys.push(fullKey);
            }
        }
        return keys;
    }
    
    const enKeys = getKeys(enData).sort();
    const langs = ['es', 'fr', 'de', 'ar', 'zh'];
    
    langs.forEach(lang => {
        const file = `public/locales/${lang}.json`;
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const langKeys = getKeys(data).sort();
        
        if (JSON.stringify(enKeys) !== JSON.stringify(langKeys)) {
            throw new Error(`${lang} has different keys than English`);
        }
    });
});

// Test 5: Check i18n.js has required methods
test('i18n.js has required methods', () => {
    const content = fs.readFileSync('public/i18n.js', 'utf8');
    
    const requiredMethods = [
        'setLanguage',
        'formatCurrency',
        'formatDate',
        'formatNumber',
        'formatPercent',
        'isRTL',
        'getAvailableLanguages'
    ];
    
    requiredMethods.forEach(method => {
        if (!content.includes(method)) {
            throw new Error(`Missing method: ${method}`);
        }
    });
});

// Test 6: Check RTL CSS has required selectors
test('RTL CSS has required selectors', () => {
    const content = fs.readFileSync('public/rtl-support.css', 'utf8');
    
    const requiredSelectors = [
        '[dir="rtl"]',
        '.ml-',
        '.mr-',
        '.pl-',
        '.pr-'
    ];
    
    requiredSelectors.forEach(selector => {
        if (!content.includes(selector)) {
            throw new Error(`Missing CSS selector: ${selector}`);
        }
    });
});

// Test 7: Check test page exists and has required elements
test('Test page has required elements', () => {
    const content = fs.readFileSync('public/test-i18n.html', 'utf8');
    
    const required = [
        'languageSelector',
        'data-i18n',
        'i18n.js',
        'language-switcher.js',
        'rtl-support.css'
    ];
    
    required.forEach(item => {
        if (!content.includes(item)) {
            throw new Error(`Test page missing: ${item}`);
        }
    });
});

// Test 8: Check documentation exists
test('Documentation files exist', () => {
    const docs = [
        'INTERNATIONALIZATION_IMPLEMENTATION.md',
        'I18N_QUICK_START.md',
        'I18N_README.md'
    ];
    
    docs.forEach(doc => {
        if (!fs.existsSync(doc)) {
            throw new Error(`Missing documentation: ${doc}`);
        }
    });
});

// Test 9: Check translation completeness
test('Translations have required sections', () => {
    const enData = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    
    const requiredSections = ['app', 'nav', 'auth', 'auction', 'common', 'errors'];
    
    requiredSections.forEach(section => {
        if (!enData[section]) {
            throw new Error(`Missing section: ${section}`);
        }
    });
});

// Test 10: Check for common issues
test('No common issues found', () => {
    const i18nContent = fs.readFileSync('public/i18n.js', 'utf8');
    
    // Check for console.log (should use console.error for errors)
    const consoleLogCount = (i18nContent.match(/console\.log/g) || []).length;
    if (consoleLogCount > 2) {
        console.warn(`   Warning: Found ${consoleLogCount} console.log statements`);
    }
    
    // Check for TODO comments
    if (i18nContent.includes('TODO')) {
        console.warn('   Warning: Found TODO comments');
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log('='.repeat(50));

if (failed === 0) {
    console.log('\n🎉 All tests passed! Implementation looks good.');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Open: http://localhost:3000/test-i18n.html');
    console.log('   3. Test language switching manually');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
}
