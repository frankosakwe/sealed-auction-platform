const { Horizon, Networks } = require('@stellar/stellar-sdk');

class NetworkMonitor {
  constructor() {
    this.server = new Horizon.Server(process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org');
    this.networkStatus = {
      healthy: true,
      lastCheck: new Date(),
      blockTime: 5000, // Default 5 seconds
      nodeStatus: 'online',
      congestionLevel: 'low',
      alerts: [],
      historicalData: []
    };
    
    this.nodes = [
      { url: 'https://horizon.stellar.org', name: 'Public Horizon', region: 'global' },
      { url: 'https://horizon-testnet.stellar.org', name: 'Testnet Horizon', region: 'global' }
    ];
    
    this.alertThresholds = {
      blockTime: 10000, // 10 seconds
      responseTime: 5000, // 5 seconds
      errorRate: 0.1 // 10%
    };
    
    this.metrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastBlockTimes: [],
      congestionHistory: []
    };
    
    this.startMonitoring();
  }

  async startMonitoring() {
    // Check network status every 30 seconds
    setInterval(() => {
      this.checkNetworkHealth();
    }, 30000);
    
    // Check block times every 5 seconds
    setInterval(() => {
      this.checkBlockTimes();
    }, 5000);
    
    // Check node status every 60 seconds
    setInterval(() => {
      this.checkNodeStatus();
    }, 60000);
    
    // Initial checks
    await this.checkNetworkHealth();
    await this.checkBlockTimes();
    await this.checkNodeStatus();
  }

  async checkNetworkHealth() {
    const startTime = Date.now();
    this.metrics.totalChecks++;
    
    try {
      // Test basic connectivity
      const root = await this.server.root();
      const responseTime = Date.now() - startTime;
      
      // Check latest ledger
      const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
      const currentLedger = latestLedger.records[0];
      
      // Update network status
      this.networkStatus.healthy = true;
      this.networkStatus.lastCheck = new Date();
      this.networkStatus.currentLedger = currentLedger.sequence;
      this.networkStatus.protocolVersion = currentLedger.protocol_version;
      
      // Update metrics
      this.metrics.successfulChecks++;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulChecks - 1) + responseTime) / 
        this.metrics.successfulChecks;
      
      // Check for alerts
      this.checkAlerts(responseTime, currentLedger);
      
      // Store historical data
      this.storeHistoricalData({
        timestamp: new Date(),
        healthy: true,
        responseTime,
        ledger: currentLedger.sequence,
        baseFee: currentLedger.base_fee_in_stroops || 100
      });
      
    } catch (error) {
      this.metrics.failedChecks++;
      this.networkStatus.healthy = false;
      this.networkStatus.lastCheck = new Date();
      this.networkStatus.error = error.message;
      
      this.addAlert('error', 'Network Health Check Failed', error.message);
    }
  }

  async checkBlockTimes() {
    try {
      const ledgers = await this.server.ledgers()
        .order('desc')
        .limit(10)
        .call();
      
      if (ledgers.records.length >= 2) {
        const blockTimes = [];
        for (let i = 0; i < ledgers.records.length - 1; i++) {
          const current = new Date(ledgers.records[i].closed_at);
          const previous = new Date(ledgers.records[i + 1].closed_at);
          const blockTime = current - previous;
          blockTimes.push(blockTime);
        }
        
        const averageBlockTime = blockTimes.reduce((sum, time) => sum + time, 0) / blockTimes.length;
        this.networkStatus.blockTime = Math.round(averageBlockTime);
        this.metrics.lastBlockTimes = blockTimes;
        
        // Check if block times are within acceptable range
        if (averageBlockTime > this.alertThresholds.blockTime) {
          this.addAlert('warning', 'Slow Block Times', 
            `Average block time: ${Math.round(averageBlockTime / 1000)}s`);
        }
      }
    } catch (error) {
      this.addAlert('error', 'Block Time Check Failed', error.message);
    }
  }

  async checkNodeStatus() {
    const nodeStatuses = [];
    
    for (const node of this.nodes) {
      try {
        const startTime = Date.now();
        const server = new Server(node.url);
        await server.root();
        const responseTime = Date.now() - startTime;
        
        nodeStatuses.push({
          name: node.name,
          url: node.url,
          region: node.region,
          status: 'online',
          responseTime,
          lastCheck: new Date()
        });
        
      } catch (error) {
        nodeStatuses.push({
          name: node.name,
          url: node.url,
          region: node.region,
          status: 'offline',
          error: error.message,
          lastCheck: new Date()
        });
        
        this.addAlert('error', `Node Offline: ${node.name}`, error.message);
      }
    }
    
    this.networkStatus.nodes = nodeStatuses;
    
    // Calculate overall node health
    const onlineNodes = nodeStatuses.filter(n => n.status === 'online').length;
    const totalNodes = nodeStatuses.length;
    this.networkStatus.nodeHealth = (onlineNodes / totalNodes) * 100;
  }

  async checkCongestion() {
    try {
      // Get recent operations to gauge network activity
      const operations = await this.server.operations()
        .order('desc')
        .limit(100)
        .call();
      
      // Calculate operations per second
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const recentOps = operations.records.filter(op => 
        new Date(op.created_at) > oneMinuteAgo
      );
      
      const opsPerSecond = recentOps.length / 60;
      
      // Determine congestion level
      let congestionLevel = 'low';
      if (opsPerSecond > 100) congestionLevel = 'critical';
      else if (opsPerSecond > 50) congestionLevel = 'high';
      else if (opsPerSecond > 20) congestionLevel = 'medium';
      
      this.networkStatus.congestionLevel = congestionLevel;
      this.networkStatus.operationsPerSecond = opsPerSecond;
      
      // Store congestion history
      this.metrics.congestionHistory.push({
        timestamp: new Date(),
        level: congestionLevel,
        opsPerSecond
      });
      
      // Keep only last 100 entries
      if (this.metrics.congestionHistory.length > 100) {
        this.metrics.congestionHistory = this.metrics.congestionHistory.slice(-100);
      }
      
      // Alert on high congestion
      if (congestionLevel === 'critical' || congestionLevel === 'high') {
        this.addAlert('warning', 'High Network Congestion', 
          `Current level: ${congestionLevel} (${opsPerSecond.toFixed(1)} ops/sec)`);
      }
      
    } catch (error) {
      this.addAlert('error', 'Congestion Check Failed', error.message);
    }
  }

  checkAlerts(responseTime, ledger) {
    // Response time alert
    if (responseTime > this.alertThresholds.responseTime) {
      this.addAlert('warning', 'High Response Time', 
        `${responseTime}ms response time detected`);
    }
    
    // Error rate alert
    const errorRate = this.metrics.failedChecks / this.metrics.totalChecks;
    if (errorRate > this.alertThresholds.errorRate) {
      this.addAlert('error', 'High Error Rate', 
        `${(errorRate * 100).toFixed(1)}% error rate detected`);
    }
    
    // Ledger sequence alert (stalled network)
    if (this.networkStatus.currentLedger && 
        this.networkStatus.currentLedger === ledger.sequence) {
      this.addAlert('warning', 'Network Stalled', 
        'Ledger sequence has not progressed');
    }
  }

  addAlert(type, title, message) {
    const alert = {
      id: Date.now().toString(),
      type, // 'error', 'warning', 'info'
      title,
      message,
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.networkStatus.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.networkStatus.alerts.length > 50) {
      this.networkStatus.alerts = this.networkStatus.alerts.slice(0, 50);
    }
  }

  storeHistoricalData(data) {
    this.networkStatus.historicalData.push(data);
    
    // Keep only last 1000 entries
    if (this.networkStatus.historicalData.length > 1000) {
      this.networkStatus.historicalData = this.networkStatus.historicalData.slice(-1000);
    }
  }

  getNetworkStatus() {
    return {
      ...this.networkStatus,
      metrics: this.metrics
    };
  }

  getHistoricalData(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.networkStatus.historicalData.filter(entry => 
      entry.timestamp > cutoff
    );
  }

  acknowledgeAlert(alertId) {
    const alert = this.networkStatus.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  clearAlerts() {
    this.networkStatus.alerts = [];
  }

  getCongestionTrend() {
    const recent = this.metrics.congestionHistory.slice(-10);
    if (recent.length < 3) return 'stable';
    
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    const avgLevel = recent.reduce((sum, c) => sum + levels[c.level], 0) / recent.length;
    
    if (avgLevel <= 1.5) return 'improving';
    if (avgLevel >= 3.5) return 'worsening';
    return 'stable';
  }

  getRecommendations() {
    const recommendations = [];
    const status = this.networkStatus;
    
    if (!status.healthy) {
      recommendations.push('Network is experiencing issues - consider delaying transactions');
    }
    
    if (status.blockTime > 8000) {
      recommendations.push('Block times are elevated - transactions may be delayed');
    }
    
    if (status.congestionLevel === 'high' || status.congestionLevel === 'critical') {
      recommendations.push('Network congestion is high - consider using higher fees');
    }
    
    if (status.nodeHealth < 80) {
      recommendations.push('Some nodes are offline - network reliability may be affected');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Network conditions are optimal for transactions');
    }
    
    return recommendations;
  }
}

module.exports = NetworkMonitor;
