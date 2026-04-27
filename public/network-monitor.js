// Network Status Monitor Module
class NetworkMonitor {
  constructor() {
    this.status = null;
    this.alerts = [];
    this.history = [];
    this.recommendations = [];
    this.isMonitoring = false;
    this.updateInterval = null;
    this.chartInstances = {};
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadInitialData();
    this.startRealTimeUpdates();
  }

  setupEventListeners() {
    // Network tab click
    document.addEventListener('click', (e) => {
      if (e.target.dataset.tab === 'network') {
        this.showNetworkPanel();
      }
    });

    // Alert acknowledgment
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('acknowledge-alert')) {
        const alertId = e.target.dataset.alertId;
        await this.acknowledgeAlert(alertId);
      }
    });

    // Clear alerts
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'clearAlerts') {
        await this.clearAlerts();
      }
    });

    // Refresh network status
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'refreshNetwork') {
        await this.refreshNetworkStatus();
      }
    });

    // Time range selection
    document.addEventListener('change', (e) => {
      if (e.target.id === 'timeRange') {
        this.updateTimeRange(e.target.value);
      }
    });
  }

  async loadInitialData() {
    try {
      await Promise.all([
        this.loadNetworkStatus(),
        this.loadAlerts(),
        this.loadRecommendations(),
        this.loadHistory(24)
      ]);
      
      this.updateUI();
    } catch (error) {
      console.error('Error loading initial network data:', error);
      this.showError('Failed to load network monitoring data');
    }
  }

  async loadNetworkStatus() {
    try {
      const response = await fetch('/api/network/status');
      this.status = await response.json();
    } catch (error) {
      console.error('Error loading network status:', error);
      throw error;
    }
  }

  async loadAlerts() {
    try {
      const response = await fetch('/api/network/alerts');
      this.alerts = await response.json();
    } catch (error) {
      console.error('Error loading alerts:', error);
      this.alerts = [];
    }
  }

  async loadRecommendations() {
    try {
      const response = await fetch('/api/network/recommendations');
      this.recommendations = await response.json();
    } catch (error) {
      console.error('Error loading recommendations:', error);
      this.recommendations = [];
    }
  }

  async loadHistory(hours = 24) {
    try {
      const response = await fetch(`/api/network/history?hours=${hours}`);
      this.history = await response.json();
    } catch (error) {
      console.error('Error loading history:', error);
      this.history = [];
    }
  }

  async loadCongestion() {
    try {
      const response = await fetch('/api/network/congestion');
      return await response.json();
    } catch (error) {
      console.error('Error loading congestion data:', error);
      return null;
    }
  }

  startRealTimeUpdates() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.updateInterval = setInterval(async () => {
      try {
        await this.loadNetworkStatus();
        await this.loadAlerts();
        this.updateUI();
      } catch (error) {
        console.error('Error in real-time update:', error);
      }
    }, 30000); // Update every 30 seconds
  }

  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isMonitoring = false;
  }

  showNetworkPanel() {
    const networkPanel = document.getElementById('networkPanel');
    if (networkPanel) {
      networkPanel.style.display = 'block';
      this.updateUI();
    }
  }

  updateUI() {
    this.updateStatusIndicators();
    this.updateAlertsList();
    this.updateRecommendations();
    this.updateCharts();
    this.updateNodeStatus();
  }

  updateStatusIndicators() {
    if (!this.status) return;

    // Health indicator
    const healthIndicator = document.getElementById('networkHealth');
    if (healthIndicator) {
      healthIndicator.className = `status-indicator ${this.status.healthy ? 'healthy' : 'unhealthy'}`;
      healthIndicator.textContent = this.status.healthy ? 'Healthy' : 'Unhealthy';
    }

    // Block time
    const blockTimeElement = document.getElementById('blockTime');
    if (blockTimeElement) {
      const blockTimeSeconds = (this.status.blockTime / 1000).toFixed(1);
      blockTimeElement.textContent = `${blockTimeSeconds}s`;
      
      // Add warning class if slow
      if (this.status.blockTime > 8000) {
        blockTimeElement.classList.add('warning');
      } else {
        blockTimeElement.classList.remove('warning');
      }
    }

    // Congestion level
    const congestionElement = document.getElementById('congestionLevel');
    if (congestionElement) {
      congestionElement.textContent = this.status.congestionLevel || 'Unknown';
      congestionElement.className = `congestion-indicator ${this.status.congestionLevel || 'unknown'}`;
    }

    // Node health
    const nodeHealthElement = document.getElementById('nodeHealth');
    if (nodeHealthElement && this.status.nodeHealth !== undefined) {
      nodeHealthElement.textContent = `${Math.round(this.status.nodeHealth)}%`;
      nodeHealthElement.className = `node-health-indicator ${this.getNodeHealthClass(this.status.nodeHealth)}`;
    }

    // Current ledger
    const ledgerElement = document.getElementById('currentLedger');
    if (ledgerElement && this.status.currentLedger) {
      ledgerElement.textContent = this.status.currentLedger.toLocaleString();
    }

    // Operations per second
    const opsElement = document.getElementById('operationsPerSecond');
    if (opsElement && this.status.operationsPerSecond !== undefined) {
      opsElement.textContent = this.status.operationsPerSecond.toFixed(1);
    }

    // Last update time
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement && this.status.lastCheck) {
      const updateTime = new Date(this.status.lastCheck);
      lastUpdateElement.textContent = updateTime.toLocaleTimeString();
    }
  }

  updateAlertsList() {
    const alertsContainer = document.getElementById('alertsList');
    if (!alertsContainer) return;

    if (this.alerts.length === 0) {
      alertsContainer.innerHTML = `
        <div class="no-alerts">
          <i class="fas fa-check-circle text-green-500"></i>
          <p>No active alerts</p>
        </div>
      `;
      return;
    }

    const alertsHTML = this.alerts.map(alert => `
      <div class="alert-item ${alert.type} ${alert.acknowledged ? 'acknowledged' : ''}" data-alert-id="${alert.id}">
        <div class="alert-header">
          <span class="alert-type">
            <i class="fas ${this.getAlertIcon(alert.type)}"></i>
            ${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
          </span>
          <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
        </div>
        <div class="alert-content">
          <h4>${alert.title}</h4>
          <p>${alert.message}</p>
        </div>
        ${!alert.acknowledged ? `
          <button class="acknowledge-alert btn btn-sm btn-secondary" data-alert-id="${alert.id}">
            Acknowledge
          </button>
        ` : ''}
      </div>
    `).join('');

    alertsContainer.innerHTML = alertsHTML;
  }

  updateRecommendations() {
    const recommendationsContainer = document.getElementById('recommendationsList');
    if (!recommendationsContainer) return;

    if (this.recommendations.length === 0) {
      recommendationsContainer.innerHTML = '<p class="text-gray-500">No recommendations at this time</p>';
      return;
    }

    const recommendationsHTML = this.recommendations.map(rec => `
      <div class="recommendation-item">
        <i class="fas fa-lightbulb text-yellow-500"></i>
        <p>${rec}</p>
      </div>
    `).join('');

    recommendationsContainer.innerHTML = recommendationsHTML;
  }

  async updateCharts() {
    await this.updateBlockTimeChart();
    await this.updateCongestionChart();
    await this.updateResponseTimeChart();
  }

  async updateBlockTimeChart() {
    const chartContainer = document.getElementById('blockTimeChart');
    if (!chartContainer || this.history.length === 0) return;

    const data = this.history.slice(-50).map(entry => ({
      time: new Date(entry.timestamp),
      blockTime: entry.blockTime || 5000
    }));

    this.createLineChart(chartContainer, data, 'Block Time (ms)', 'blockTime');
  }

  async updateCongestionChart() {
    const chartContainer = document.getElementById('congestionChart');
    if (!chartContainer) return;

    const congestionData = await this.loadCongestion();
    if (!congestionData || !congestionData.history) return;

    const data = congestionData.history.map(entry => ({
      time: new Date(entry.timestamp),
      opsPerSecond: entry.opsPerSecond
    }));

    this.createLineChart(chartContainer, data, 'Operations per Second', 'opsPerSecond');
  }

  async updateResponseTimeChart() {
    const chartContainer = document.getElementById('responseTimeChart');
    if (!chartContainer || this.history.length === 0) return;

    const data = this.history.slice(-50).map(entry => ({
      time: new Date(entry.timestamp),
      responseTime: entry.responseTime || 1000
    }));

    this.createLineChart(chartContainer, data, 'Response Time (ms)', 'responseTime');
  }

  createLineChart(container, data, label, dataKey) {
    // Simple chart implementation using canvas
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth;
    canvas.height = 200;
    
    const ctx = canvas.getContext('2d');
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Clear container and add canvas
    container.innerHTML = '';
    container.appendChild(canvas);

    if (data.length === 0) return;

    // Calculate scales
    const maxValue = Math.max(...data.map(d => d[dataKey]));
    const minValue = Math.min(...data.map(d => d[dataKey]));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    // Draw data line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = canvas.height - padding - ((point[dataKey] - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, padding, padding - 10);
    ctx.fillText(`${minValue.toFixed(0)}ms`, padding - 30, canvas.height - padding);
    ctx.fillText(`${maxValue.toFixed(0)}ms`, padding - 30, padding);
  }

  updateNodeStatus() {
    const nodesContainer = document.getElementById('nodesList');
    if (!nodesContainer || !this.status.nodes) return;

    const nodesHTML = this.status.nodes.map(node => `
      <div class="node-item ${node.status}">
        <div class="node-info">
          <span class="node-name">${node.name}</span>
          <span class="node-region">${node.region}</span>
        </div>
        <div class="node-status">
          <span class="status-dot ${node.status}"></span>
          <span class="status-text">${node.status}</span>
          ${node.responseTime ? `<span class="response-time">${node.responseTime}ms</span>` : ''}
        </div>
      </div>
    `).join('');

    nodesContainer.innerHTML = nodesHTML;
  }

  async acknowledgeAlert(alertId) {
    try {
      const response = await fetch(`/api/network/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadAlerts();
        this.updateAlertsList();
        this.showSuccess('Alert acknowledged');
      } else {
        throw new Error('Failed to acknowledge alert');
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      this.showError('Failed to acknowledge alert');
    }
  }

  async clearAlerts() {
    try {
      const response = await fetch('/api/network/alerts', {
        method: 'DELETE'
      });

      if (response.ok) {
        this.alerts = [];
        this.updateAlertsList();
        this.showSuccess('All alerts cleared');
      } else {
        throw new Error('Failed to clear alerts');
      }
    } catch (error) {
      console.error('Error clearing alerts:', error);
      this.showError('Failed to clear alerts');
    }
  }

  async refreshNetworkStatus() {
    try {
      const refreshButton = document.getElementById('refreshNetwork');
      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      }

      await this.loadInitialData();
      this.showSuccess('Network status refreshed');
    } catch (error) {
      console.error('Error refreshing network status:', error);
      this.showError('Failed to refresh network status');
    } finally {
      const refreshButton = document.getElementById('refreshNetwork');
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.innerHTML = '<i class="fas fa-sync"></i> Refresh';
      }
    }
  }

  async updateTimeRange(hours) {
    try {
      await this.loadHistory(parseInt(hours));
      this.updateCharts();
    } catch (error) {
      console.error('Error updating time range:', error);
      this.showError('Failed to update time range');
    }
  }

  getAlertIcon(type) {
    const icons = {
      error: 'fa-exclamation-triangle',
      warning: 'fa-exclamation-circle',
      info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
  }

  getNodeHealthClass(health) {
    if (health >= 90) return 'excellent';
    if (health >= 70) return 'good';
    if (health >= 50) return 'fair';
    return 'poor';
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  showSuccess(message) {
    // Use existing notification system
    if (typeof showNotification === 'function') {
      showNotification(message, 'success');
    } else {
      console.log('Success:', message);
    }
  }

  showError(message) {
    // Use existing notification system
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      console.error('Error:', message);
    }
  }

  destroy() {
    this.stopRealTimeUpdates();
    
    // Clean up chart instances
    Object.values(this.chartInstances).forEach(chart => {
      if (chart.destroy) chart.destroy();
    });
    this.chartInstances = {};
  }
}

// Initialize network monitor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.networkMonitor = new NetworkMonitor();
});
