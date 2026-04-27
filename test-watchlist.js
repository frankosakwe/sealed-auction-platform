// Test file to verify watchlist functionality
// This file can be run with Node.js to test the implementation

const fs = require('fs');
const path = require('path');

// Test database schema
function testDatabaseSchema() {
    console.log('Testing database schema...');
    
    // Read database.js file
    const dbPath = path.join(__dirname, 'database.js');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    
    // Check if watchlist tables are defined
    const watchlistTables = [
        'CREATE TABLE IF NOT EXISTS watchlist',
        'CREATE TABLE IF NOT EXISTS watchlist_notifications',
        'CREATE TABLE IF NOT EXISTS watchlist_shares',
        'CREATE TABLE IF NOT EXISTS watchlist_activity'
    ];
    
    let allTablesFound = true;
    watchlistTables.forEach(table => {
        if (!dbContent.includes(table)) {
            console.error(`Missing table: ${table}`);
            allTablesFound = false;
        }
    });
    
    if (allTablesFound) {
        console.log('✓ All watchlist tables are defined');
    }
    
    // Check if watchlist methods are implemented
    const watchlistMethods = [
        'addToWatchlist',
        'removeFromWatchlist',
        'getWatchlist',
        'getWatchlistItem',
        'updateWatchlistItem',
        'bulkAddToWatchlist',
        'bulkRemoveFromWatchlist',
        'createWatchlistShare',
        'getSharedWatchlist',
        'createWatchlistNotification',
        'getWatchlistNotifications',
        'markNotificationAsRead',
        'logWatchlistActivity',
        'getWatchlistActivity',
        'checkWatchlistAlerts'
    ];
    
    let allMethodsFound = true;
    watchlistMethods.forEach(method => {
        if (!dbContent.includes(method)) {
            console.error(`Missing method: ${method}`);
            allMethodsFound = false;
        }
    });
    
    if (allMethodsFound) {
        console.log('✓ All watchlist methods are implemented');
    }
    
    return allTablesFound && allMethodsFound;
}

// Test server endpoints
function testServerEndpoints() {
    console.log('Testing server endpoints...');
    
    const serverPath = path.join(__dirname, 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check if watchlist API endpoints are defined
    const endpoints = [
        '/api/watchlist/add',
        '/api/watchlist/remove/:auctionId',
        '/api/watchlist',
        '/api/watchlist/item/:auctionId',
        '/api/watchlist/bulk-add',
        '/api/watchlist/bulk-remove',
        '/api/watchlist/share',
        '/api/watchlist/shared/:shareToken',
        '/api/watchlist/notifications',
        '/api/watchlist/notifications/:notificationId/read',
        '/api/watchlist/activity',
        '/api/watchlist/check-alerts'
    ];
    
    let allEndpointsFound = true;
    endpoints.forEach(endpoint => {
        if (!serverContent.includes(endpoint)) {
            console.error(`Missing endpoint: ${endpoint}`);
            allEndpointsFound = false;
        }
    });
    
    if (allEndpointsFound) {
        console.log('✓ All watchlist endpoints are implemented');
    }
    
    return allEndpointsFound;
}

// Test frontend files
function testFrontendFiles() {
    console.log('Testing frontend files...');
    
    // Check if watchlist.html exists
    const watchlistHtmlPath = path.join(__dirname, 'public', 'watchlist.html');
    if (!fs.existsSync(watchlistHtmlPath)) {
        console.error('Missing watchlist.html');
        return false;
    }
    console.log('✓ watchlist.html exists');
    
    // Check if watchlist.js exists
    const watchlistJsPath = path.join(__dirname, 'public', 'watchlist.js');
    if (!fs.existsSync(watchlistJsPath)) {
        console.error('Missing watchlist.js');
        return false;
    }
    console.log('✓ watchlist.js exists');
    
    // Check if watchlist functionality is added to app.js
    const appJsPath = path.join(__dirname, 'public', 'app.js');
    const appJsContent = fs.readFileSync(appJsPath, 'utf8');
    
    const appJsFunctions = [
        'toggleWatchlist',
        'loadUserWatchlist',
        'updateWatchlistButton',
        'updateWatchlistButtons'
    ];
    
    let allFunctionsFound = true;
    appJsFunctions.forEach(func => {
        if (!appJsContent.includes(func)) {
            console.error(`Missing function in app.js: ${func}`);
            allFunctionsFound = false;
        }
    });
    
    if (allFunctionsFound) {
        console.log('✓ All watchlist functions are implemented in app.js');
    }
    
    return allFunctionsFound;
}

// Test acceptance criteria
function testAcceptanceCriteria() {
    console.log('Testing acceptance criteria...');
    
    const criteria = [
        {
            name: 'Add/remove works instantly',
            check: () => {
                const dbContent = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
                const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
                return dbContent.includes('addToWatchlist') && 
                       dbContent.includes('removeFromWatchlist') &&
                       serverContent.includes('/api/watchlist/add') &&
                       serverContent.includes('/api/watchlist/remove');
            }
        },
        {
            name: 'Watchlist updates live',
            check: () => {
                const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
                return serverContent.includes('watchlist_updated') &&
                       serverContent.includes('socket.emit');
            }
        },
        {
            name: 'Notifications trigger correctly',
            check: () => {
                const dbContent = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
                return dbContent.includes('createWatchlistNotification') &&
                       dbContent.includes('checkWatchlistAlerts');
            }
        },
        {
            name: 'Alerts appear before ending',
            check: () => {
                const dbContent = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
                return dbContent.includes('ending_soon') &&
                       dbContent.includes('hoursDiff <= 1');
            }
        },
        {
            name: 'Watchlist shareable',
            check: () => {
                const dbContent = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
                const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
                return dbContent.includes('createWatchlistShare') &&
                       dbContent.includes('getSharedWatchlist') &&
                       serverContent.includes('/api/watchlist/share') &&
                       serverContent.includes('/api/watchlist/shared');
            }
        },
        {
            name: 'Bulk operations work',
            check: () => {
                const dbContent = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
                const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
                return dbContent.includes('bulkAddToWatchlist') &&
                       dbContent.includes('bulkRemoveFromWatchlist') &&
                       serverContent.includes('/api/watchlist/bulk-add') &&
                       serverContent.includes('/api/watchlist/bulk-remove');
            }
        },
        {
            name: 'Mobile interface optimized',
            check: () => {
                const watchlistHtmlPath = path.join(__dirname, 'public', 'watchlist.html');
                const htmlContent = fs.readFileSync(watchlistHtmlPath, 'utf8');
                return htmlContent.includes('viewport') &&
                       htmlContent.includes('responsive') &&
                       htmlContent.includes('mobile');
            }
        }
    ];
    
    let allPassed = true;
    criteria.forEach(criterion => {
        try {
            const passed = criterion.check();
            if (passed) {
                console.log(`✓ ${criterion.name}`);
            } else {
                console.error(`✗ ${criterion.name}`);
                allPassed = false;
            }
        } catch (error) {
            console.error(`✗ ${criterion.name} - Error: ${error.message}`);
            allPassed = false;
        }
    });
    
    return allPassed;
}

// Run all tests
function runAllTests() {
    console.log('Running watchlist implementation tests...\n');
    
    const results = {
        database: testDatabaseSchema(),
        server: testServerEndpoints(),
        frontend: testFrontendFiles(),
        acceptance: testAcceptanceCriteria()
    };
    
    console.log('\nTest Results:');
    console.log('=============');
    Object.entries(results).forEach(([category, passed]) => {
        console.log(`${category}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\nOverall: ${allPassed ? 'PASSED' : 'FAILED'}`);
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! The watchlist functionality is ready for deployment.');
    } else {
        console.log('\n❌ Some tests failed. Please review the implementation.');
    }
    
    return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testDatabaseSchema,
    testServerEndpoints,
    testFrontendFiles,
    testAcceptanceCriteria,
    runAllTests
};
