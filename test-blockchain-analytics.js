// Blockchain Analytics Tests
const { BlockchainAnalytics, AGGREGATION_INTERVALS, METRIC_TYPES } = require('./utils/blockchain-analytics');

async function runTests() {
  console.log('🚀 Starting Blockchain Analytics Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Analytics Engine Initialization
  try {
    console.log('Test 1: Analytics Engine Initialization');
    const analytics = new BlockchainAnalytics({
      cacheTimeout: 60000,
      batchSize: 500,
      maxCacheSize: 5000
    });
    
    if (analytics.cacheTimeout === 60000 && 
        analytics.batchSize === 500 &&
        analytics.maxCacheSize === 5000 &&
        analytics.cache.size === 0 &&
        analytics.realTimeData.size === 0) {
      console.log('✓ Analytics engine initialized correctly');
      passed++;
    } else {
      console.log('✗ Analytics engine initialization failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Initialization test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 2: Transaction Analytics
  try {
    console.log('Test 2: Transaction Analytics');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '24h',
      interval: AGGREGATION_INTERVALS.HOUR,
      filters: {},
      groupBy: []
    };
    
    const transactionAnalytics = await analytics.getTransactionAnalytics(options);
    
    if (transactionAnalytics &&
        transactionAnalytics.summary &&
        transactionAnalytics.trends &&
        transactionAnalytics.distribution &&
        transactionAnalytics.performance &&
        transactionAnalytics.volume) {
      console.log('✓ Transaction analytics generated successfully');
      
      // Validate summary data
      if (transactionAnalytics.summary.totalTransactions > 0 &&
          transactionAnalytics.summary.successRate >= 0 &&
          transactionAnalytics.summary.successRate <= 100) {
        console.log('✓ Transaction summary data valid');
        passed++;
      } else {
        console.log('✗ Transaction summary data invalid');
        failed++;
      }
    } else {
      console.log('✗ Transaction analytics missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Transaction analytics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 3: Network Statistics
  try {
    console.log('Test 3: Network Statistics');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '24h',
      metrics: ['all']
    };
    
    const networkStats = await analytics.getNetworkStatistics(options);
    
    if (networkStats &&
        networkStats.overview &&
        networkStats.health &&
        networkStats.congestion &&
        networkStats.throughput &&
        networkStats.latency) {
      console.log('✓ Network statistics generated successfully');
      
      // Validate network overview
      if (networkStats.overview &&
          networkStats.overview.networkType &&
          networkStats.overview.status &&
          networkStats.overview.nodeCount > 0) {
        console.log('✓ Network overview data valid');
        passed++;
      } else {
        console.log('✗ Network overview data invalid');
        failed++;
      }
    } else {
      console.log('✗ Network statistics missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Network statistics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 4: Performance Metrics
  try {
    console.log('Test 4: Performance Metrics');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '24h',
      interval: AGGREGATION_INTERVALS.HOUR,
      component: 'all'
    };
    
    const performanceMetrics = await analytics.getPerformanceMetrics(options);
    
    if (performanceMetrics &&
        performanceMetrics.responseTime &&
        performanceMetrics.throughput &&
        performanceMetrics.errorRate &&
        performanceMetrics.resourceUsage &&
        performanceMetrics.availability) {
      console.log('✓ Performance metrics generated successfully');
      
      // Validate availability metrics
      if (performanceMetrics.availability.uptime >= 0 &&
          performanceMetrics.availability.uptime <= 100) {
        console.log('✓ Performance metrics data valid');
        passed++;
      } else {
        console.log('✗ Performance metrics data invalid');
        failed++;
      }
    } else {
      console.log('✗ Performance metrics missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Performance metrics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 5: Cost Analysis
  try {
    console.log('Test 5: Cost Analysis');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '30d',
      interval: AGGREGATION_INTERVALS.DAY,
      category: 'all'
    };
    
    const costAnalysis = await analytics.getCostAnalysis(options);
    
    if (costAnalysis &&
        costAnalysis.totalCosts &&
        costAnalysis.costBreakdown &&
        costAnalysis.costTrends &&
        costAnalysis.costPerTransaction &&
        costAnalysis.optimization) {
      console.log('✓ Cost analysis generated successfully');
      
      // Validate total costs
      if (costAnalysis.totalCosts.total > 0 &&
          costAnalysis.totalCosts.breakdown &&
          Object.keys(costAnalysis.totalCosts.breakdown).length > 0) {
        console.log('✓ Cost analysis data valid');
        passed++;
      } else {
        console.log('✗ Cost analysis data invalid');
        failed++;
      }
    } else {
      console.log('✗ Cost analysis missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Cost analysis test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 6: Trend Visualization
  try {
    console.log('Test 6: Trend Visualization');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '7d',
      metrics: ['transactions', 'costs', 'performance'],
      chartType: 'line'
    };
    
    const trendViz = await analytics.getTrendVisualization(options);
    
    if (trendViz &&
        trendViz.chartData &&
        trendViz.annotations &&
        trendViz.insights) {
      console.log('✓ Trend visualization generated successfully');
      
      // Validate chart data
      if (Object.keys(trendViz.chartData).length > 0 &&
          Array.isArray(trendViz.annotations)) {
        console.log('✓ Trend visualization data valid');
        passed++;
      } else {
        console.log('✗ Trend visualization data invalid');
        failed++;
      }
    } else {
      console.log('✗ Trend visualization missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Trend visualization test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 7: Export Analytics
  try {
    console.log('Test 7: Export Analytics');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      format: 'json',
      timeRange: '30d',
      metrics: ['all'],
      includeRaw: false
    };
    
    const exportData = await analytics.exportAnalytics(options);
    
    if (exportData &&
        exportData.metadata &&
        exportData.analytics &&
        exportData.metadata.exportedAt &&
        exportData.metadata.timeRange &&
        exportData.metadata.metrics.includes('all')) {
      console.log('✓ Export analytics generated successfully');
      
      // Validate metadata
      if (exportData.metadata.recordCount >= 0 &&
          exportData.analytics.transaction &&
          exportData.analytics.network &&
          exportData.analytics.performance &&
          exportData.analytics.cost) {
        console.log('✓ Export analytics data valid');
        passed++;
      } else {
        console.log('✗ Export analytics data invalid');
        failed++;
      }
    } else {
      console.log('✗ Export analytics missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Export analytics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 8: Mobile Analytics
  try {
    console.log('Test 8: Mobile Analytics');
    const analytics = new BlockchainAnalytics();
    
    const options = {
      timeRange: '24h',
      limit: 50
    };
    
    const mobileAnalytics = await analytics.getMobileAnalytics(options);
    
    if (mobileAnalytics &&
        mobileAnalytics.summary &&
        mobileAnalytics.keyMetrics &&
        mobileAnalytics.alerts &&
        mobileAnalytics.quickStats) {
      console.log('✓ Mobile analytics generated successfully');
      
      // Validate mobile summary
      if (mobileAnalytics.summary.totalTransactions >= 0 &&
          mobileAnalytics.summary.successRate >= 0 &&
          mobileAnalytics.summary.successRate <= 100) {
        console.log('✓ Mobile analytics data valid');
        passed++;
      } else {
        console.log('✗ Mobile analytics data invalid');
        failed++;
      }
    } else {
      console.log('✗ Mobile analytics missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Mobile analytics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 9: Caching Functionality
  try {
    console.log('Test 9: Caching Functionality');
    const analytics = new BlockchainAnalytics({ cacheTimeout: 1000 });
    
    const options = { timeRange: '24h' };
    
    // First call should cache miss
    await analytics.getTransactionAnalytics(options);
    const initialCacheHits = analytics.queryStats.cacheHits;
    const initialCacheMisses = analytics.queryStats.cacheMisses;
    
    // Second call should cache hit
    await analytics.getTransactionAnalytics(options);
    const finalCacheHits = analytics.queryStats.cacheHits;
    const finalCacheMisses = analytics.queryStats.cacheMisses;
    
    if (finalCacheHits > initialCacheHits &&
        finalCacheMisses === initialCacheMisses) {
      console.log('✓ Caching functionality working correctly');
      passed++;
    } else {
      console.log('✗ Caching functionality not working');
      failed++;
    }
  } catch (error) {
    console.log('✗ Caching test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 10: Real-time Data Collection
  try {
    console.log('Test 10: Real-time Data Collection');
    const analytics = new BlockchainAnalytics();
    
    // Wait for real-time data collection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const realTimeData = analytics.realTimeData.get('current');
    
    if (realTimeData &&
        realTimeData.timestamp &&
        realTimeData.activeUsers >= 0 &&
        realTimeData.currentTPS >= 0 &&
        realTimeData.avgLatency >= 0) {
      console.log('✓ Real-time data collection working');
      passed++;
    } else {
      console.log('✗ Real-time data collection failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Real-time data test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 11: Time Interval Generation
  try {
    console.log('Test 11: Time Interval Generation');
    const analytics = new BlockchainAnalytics();
    
    const intervals = analytics.generateTimeIntervals('24h', AGGREGATION_INTERVALS.HOUR);
    
    if (Array.isArray(intervals) && intervals.length > 0) {
      console.log('✓ Time intervals generated successfully');
      
      // Validate interval format
      const firstInterval = intervals[0];
      if (typeof firstInterval === 'string' && firstInterval.includes('T')) {
        console.log('✓ Time interval format valid');
        passed++;
      } else {
        console.log('✗ Time interval format invalid');
        failed++;
      }
    } else {
      console.log('✗ Time interval generation failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Time interval test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 12: Analytics Engine Statistics
  try {
    console.log('Test 12: Analytics Engine Statistics');
    const analytics = new BlockchainAnalytics();
    
    // Perform some operations to generate stats
    await analytics.getTransactionAnalytics({ timeRange: '24h' });
    await analytics.getNetworkStatistics({ timeRange: '24h' });
    
    const stats = analytics.getStats();
    
    if (stats &&
        stats.cacheSize >= 0 &&
        stats.queryStats &&
        stats.queryStats.totalQueries >= 0 &&
        stats.queryStats.cacheHits >= 0 &&
        stats.queryStats.cacheMisses >= 0) {
      console.log('✓ Analytics engine statistics valid');
      passed++;
    } else {
      console.log('✗ Analytics engine statistics invalid');
      failed++;
    }
  } catch (error) {
    console.log('✗ Analytics engine statistics test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 13: Cache Clear Functionality
  try {
    console.log('Test 13: Cache Clear Functionality');
    const analytics = new BlockchainAnalytics();
    
    // Add some data to cache
    await analytics.getTransactionAnalytics({ timeRange: '24h' });
    
    const cacheSizeBefore = analytics.cache.size;
    
    // Clear cache
    analytics.clearCache();
    
    const cacheSizeAfter = analytics.cache.size;
    
    if (cacheSizeBefore > 0 && cacheSizeAfter === 0) {
      console.log('✓ Cache clear functionality working');
      passed++;
    } else {
      console.log('✗ Cache clear functionality failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Cache clear test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 14: Error Handling
  try {
    console.log('Test 14: Error Handling');
    const analytics = new BlockchainAnalytics();
    
    let errorCaught = false;
    
    try {
      // Test with invalid options
      await analytics.getTransactionAnalytics({ timeRange: 'invalid_range' });
    } catch (error) {
      errorCaught = true;
    }
    
    if (errorCaught) {
      console.log('✓ Error handling working correctly');
      passed++;
    } else {
      console.log('✗ Error handling not working');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error handling test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 15: Event Emission
  try {
    console.log('Test 15: Event Emission');
    const analytics = new BlockchainAnalytics();
    
    let eventReceived = false;
    
    // Listen for analytics generated event
    analytics.on('analyticsGenerated', (data) => {
      eventReceived = true;
    });
    
    // Generate analytics
    await analytics.getTransactionAnalytics({ timeRange: '24h' });
    
    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (eventReceived) {
      console.log('✓ Event emission working correctly');
      passed++;
    } else {
      console.log('✗ Event emission not working');
      failed++;
    }
  } catch (error) {
    console.log('✗ Event emission test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 16: Data Limiting for Mobile
  try {
    console.log('Test 16: Data Limiting for Mobile');
    const analytics = new BlockchainAnalytics();
    
    const largeArray = Array.from({ length: 100 }, (_, i) => ({ id: i, value: i }));
    const limitedArray = analytics.limitDataSize(largeArray, 10);
    
    if (Array.isArray(limitedArray) && limitedArray.length === 10) {
      console.log('✓ Data limiting for mobile working correctly');
      passed++;
    } else {
      console.log('✗ Data limiting for mobile failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Data limiting test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 17: Record Count Calculation
  try {
    console.log('Test 17: Record Count Calculation');
    const analytics = new BlockchainAnalytics();
    
    const testData = {
      analytics: {
        transactions: [{ id: 1 }, { id: 2 }],
        network: [{ id: 3 }],
        performance: [{ id: 4 }, { id: 5 }, { id: 6 }]
      }
    };
    
    const recordCount = analytics.calculateRecordCount(testData);
    
    if (recordCount === 6) {
      console.log('✓ Record count calculation correct');
      passed++;
    } else {
      console.log('✗ Record count calculation incorrect');
      failed++;
    }
  } catch (error) {
    console.log('✗ Record count test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 18: Aggregation Intervals
  try {
    console.log('Test 18: Aggregation Intervals');
    const analytics = new BlockchainAnalytics();
    
    const minuteMs = analytics.getIntervalMs(AGGREGATION_INTERVALS.MINUTE);
    const hourMs = analytics.getIntervalMs(AGGREGATION_INTERVALS.HOUR);
    const dayMs = analytics.getIntervalMs(AGGREGATION_INTERVALS.DAY);
    
    if (minuteMs === 60000 &&
        hourMs === 3600000 &&
        dayMs === 86400000) {
      console.log('✓ Aggregation intervals correct');
      passed++;
    } else {
      console.log('✗ Aggregation intervals incorrect');
      failed++;
    }
  } catch (error) {
    console.log('✗ Aggregation intervals test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 19: Constants Validation
  try {
    console.log('Test 19: Constants Validation');
    
    if (AGGREGATION_INTERVALS &&
        AGGREGATION_INTERVALS.MINUTE &&
        AGGREGATION_INTERVALS.HOUR &&
        AGGREGATION_INTERVALS.DAY &&
        METRIC_TYPES &&
        METRIC_TYPES.TRANSACTION &&
        METRIC_TYPES.NETWORK &&
        METRIC_TYPES.PERFORMANCE &&
        METRIC_TYPES.COST) {
      console.log('✓ Constants defined correctly');
      passed++;
    } else {
      console.log('✗ Constants not defined correctly');
      failed++;
    }
  } catch (error) {
    console.log('✗ Constants validation test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Test 20: Dashboard Overview Integration
  try {
    console.log('Test 20: Dashboard Overview Integration');
    const analytics = new BlockchainAnalytics();
    
    // Test multiple analytics calls for dashboard
    const [
      transactionAnalytics,
      networkStatistics,
      performanceMetrics,
      costAnalysis
    ] = await Promise.all([
      analytics.getTransactionAnalytics({ timeRange: '24h' }),
      analytics.getNetworkStatistics({ timeRange: '24h' }),
      analytics.getPerformanceMetrics({ timeRange: '24h' }),
      analytics.getCostAnalysis({ timeRange: '30d' })
    ]);
    
    if (transactionAnalytics &&
        networkStatistics &&
        performanceMetrics &&
        costAnalysis) {
      console.log('✓ Dashboard overview integration working');
      passed++;
    } else {
      console.log('✗ Dashboard overview integration failed');
      failed++;
    }
  } catch (error) {
    console.log('✗ Dashboard overview integration test failed:', error.message);
    failed++;
  }
  
  console.log('');

  // Results
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Blockchain Analytics implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return failed === 0;
}

// Run tests
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
