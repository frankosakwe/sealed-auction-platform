// Test file for form validation
// This file tests the validation logic without requiring a server

// Mock DOM elements for testing
const mockDOM = {
    elements: {},
    getElementById: function(id) {
        if (!this.elements[id]) {
            this.elements[id] = {
                value: '',
                classList: {
                    add: function() {},
                    remove: function() {}
                },
                parentNode: {
                    insertBefore: function() {}
                }
            };
        }
        return this.elements[id];
    }
};

// Mock document for testing
global.document = mockDOM;

// Copy validation rules from app.js
const validationRules = {
    username: {
        required: true,
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
        message: 'Username must be 3-20 characters, alphanumeric and underscores only'
    },
    password: {
        required: true,
        minLength: 6,
        maxLength: 100,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        message: 'Password must be 6+ characters with uppercase, lowercase, and number'
    },
    auctionTitle: {
        required: true,
        minLength: 3,
        maxLength: 100,
        message: 'Title must be 3-100 characters'
    },
    auctionDescription: {
        required: true,
        minLength: 10,
        maxLength: 1000,
        message: 'Description must be 10-1000 characters'
    },
    startingBid: {
        required: true,
        min: 0.01,
        max: 1000000,
        message: 'Starting bid must be between $0.01 and $1,000,000'
    },
    bidAmount: {
        required: true,
        min: 0.01,
        max: 1000000,
        message: 'Bid amount must be between $0.01 and $1,000,000'
    },
    secretKey: {
        required: true,
        minLength: 8,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/,
        message: 'Secret key must be 8-100 characters'
    }
};

// Copy validation function from app.js
function validateField(fieldName, value) {
    const rules = validationRules[fieldName];
    if (!rules) return null;
    
    // Check if required
    if (rules.required && (!value || value.toString().trim() === '')) {
        return 'This field is required';
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value.toString().trim() === '') {
        return null;
    }
    
    const stringValue = value.toString();
    
    // Check minimum length
    if (rules.minLength && stringValue.length < rules.minLength) {
        return rules.message || `Must be at least ${rules.minLength} characters`;
    }
    
    // Check maximum length
    if (rules.maxLength && stringValue.length > rules.maxLength) {
        return rules.message || `Must be no more than ${rules.maxLength} characters`;
    }
    
    // Check pattern
    if (rules.pattern && !rules.pattern.test(stringValue)) {
        return rules.message || 'Invalid format';
    }
    
    // Check minimum value (for numbers)
    if (rules.min !== undefined && parseFloat(value) < rules.min) {
        return rules.message || `Must be at least ${rules.min}`;
    }
    
    // Check maximum value (for numbers)
    if (rules.max !== undefined && parseFloat(value) > rules.max) {
        return rules.message || `Must be no more than ${rules.max}`;
    }
    
    return null;
}

// Test cases
const testCases = [
    // Username tests
    { field: 'username', value: '', expected: 'This field is required' },
    { field: 'username', value: 'ab', expected: 'Username must be 3-20 characters, alphanumeric and underscores only' },
    { field: 'username', value: 'user@name', expected: 'Username must be 3-20 characters, alphanumeric and underscores only' },
    { field: 'username', value: 'validuser123', expected: null },
    
    // Password tests
    { field: 'password', value: '', expected: 'This field is required' },
    { field: 'password', value: '123', expected: 'Password must be 6+ characters with uppercase, lowercase, and number' },
    { field: 'password', value: 'password', expected: 'Password must be 6+ characters with uppercase, lowercase, and number' },
    { field: 'password', value: 'PASSWORD', expected: 'Password must be 6+ characters with uppercase, lowercase, and number' },
    { field: 'password', value: 'ValidPass123', expected: null },
    
    // Auction title tests
    { field: 'auctionTitle', value: '', expected: 'This field is required' },
    { field: 'auctionTitle', value: 'ab', expected: 'Title must be 3-100 characters' },
    { field: 'auctionTitle', value: 'Valid Auction Title', expected: null },
    
    // Auction description tests
    { field: 'auctionDescription', value: '', expected: 'This field is required' },
    { field: 'auctionDescription', value: 'short', expected: 'Description must be 10-1000 characters' },
    { field: 'auctionDescription', value: 'This is a valid description for an auction', expected: null },
    
    // Starting bid tests
    { field: 'startingBid', value: '', expected: 'This field is required' },
    { field: 'startingBid', value: 0, expected: 'Starting bid must be between $0.01 and $1,000,000' },
    { field: 'startingBid', value: 100.50, expected: null },
    
    // Bid amount tests
    { field: 'bidAmount', value: '', expected: 'This field is required' },
    { field: 'bidAmount', value: 0, expected: 'Bid amount must be between $0.01 and $1,000,000' },
    { field: 'bidAmount', value: 250.75, expected: null },
    
    // Secret key tests
    { field: 'secretKey', value: '', expected: 'This field is required' },
    { field: 'secretKey', value: '123', expected: 'Secret key must be 8-100 characters' },
    { field: 'secretKey', value: 'validSecretKey123', expected: null }
];

// Run tests
console.log('Running form validation tests...\n');
let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = validateField(test.field, test.value);
    const success = result === test.expected;
    
    if (success) {
        console.log(`✓ Test ${index + 1}: ${test.field} = "${test.value}" - PASSED`);
        passed++;
    } else {
        console.log(`✗ Test ${index + 1}: ${test.field} = "${test.value}" - FAILED`);
        console.log(`  Expected: ${test.expected}`);
        console.log(`  Got: ${result}`);
        failed++;
    }
});

console.log(`\nTest Results: ${passed} passed, ${failed} failed out of ${testCases.length} total tests`);

if (failed === 0) {
    console.log('\n🎉 All validation tests passed! The form validation is working correctly.');
} else {
    console.log('\n❌ Some tests failed. Please review the validation logic.');
}
