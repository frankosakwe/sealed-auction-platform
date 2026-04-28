// Analytics Dashboard UI
class AnalyticsDashboardUI {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.charts = new Map();
        this.realTimeData = null;
        this.autoRefresh = true;
        this.refreshInterval = 30000; // 30 seconds
        this.currentTimeRange = '24h';
        this.currentInterval = 'hour';
        
        this.init();
    }

    async init() {
        try {
            // Initialize socket connection
            this.initSocket();
            
            // Load user data
            await this.loadUserData();
            
            // Load initial dashboard data
            await this.loadDashboardData();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Analytics Dashboard UI initialized');
        } catch (error) {
            console.error('Failed to initialize Analytics Dashboard UI:', error);
            this.showError('Failed to initialize analytics dashboard');
        }
    }

    initSocket() {
        this.socket = io();
        
        // Join user-specific room for their analytics
        this.socket.on('connect', () => {
            if (this.currentUser) {
                this.socket.emit('joinUserAnalytics', this.currentUser.id);
            }
        });

        // Listen for analytics events
        this.socket.on('analyticsUpdate', (data) => {
            this.handleAnalyticsUpdate(data);
        });

        this.socket.on('realTimeUpdate', (data) => {
            this.handleRealTimeUpdate(data);
        });

        this.socket.on('analyticsError', (data) => {
            this.handleAnalyticsError(data);
        });
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                
                // Join user room after getting user data
                if (this.socket && this.socket.connected) {
                    this.socket.emit('joinUserAnalytics', this.currentUser.id);
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadDashboardData() {
        try {
            // Load dashboard overview
            await this.loadDashboardOverview();
            
            // Load individual analytics sections
            await this.loadTransactionAnalytics();
            await this.loadNetworkStatistics();
            await this.loadPerformanceMetrics();
            await this.loadCostAnalysis();
            
            // Load real-time data
            await this.loadRealTimeData();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadDashboardOverview() {
        try {
            const response = await fetch(`/api/analytics/dashboard?timeRange=${this.currentTimeRange}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardOverview(data);
            }
        } catch (error) {
            console.error('Failed to load dashboard overview:', error);
        }
    }

    async loadTransactionAnalytics() {
        try {
            const response = await fetch(`/api/analytics/transactions?timeRange=${this.currentTimeRange}&interval=${this.currentInterval}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateTransactionAnalytics(data);
            }
        } catch (error) {
            console.error('Failed to load transaction analytics:', error);
        }
    }

    async loadNetworkStatistics() {
        try {
            const response = await fetch(`/api/analytics/network?timeRange=${this.currentTimeRange}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateNetworkStatistics(data);
            }
        } catch (error) {
            console.error('Failed to load network statistics:', error);
        }
    }

    async loadPerformanceMetrics() {
        try {
            const response = await fetch(`/api/analytics/performance?timeRange=${this.currentTimeRange}&interval=${this.currentInterval}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updatePerformanceMetrics(data);
            }
        } catch (error) {
            console.error('Failed to load performance metrics:', error);
        }
    }

    async loadCostAnalysis() {
        try {
            const response = await fetch(`/api/analytics/costs?timeRange=30d&interval=day`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateCostAnalysis(data);
            }
        } catch (error) {
            console.error('Failed to load cost analysis:', error);
        }
    }

    async loadRealTimeData() {
        try {
            const response = await fetch('/api/analytics/realtime', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateRealTimeData(data);
            }
        } catch (error) {
            console.error('Failed to load real-time data:', error);
        }
    }

    updateDashboardOverview(data) {
        // Update overview cards
        this.updateMetricCard('total-transactions', data.overview.totalTransactions);
        this.updateMetricCard('success-rate', `${data.overview.successRate}%`);
        this.updateMetricCard('network-health', data.overview.networkHealth);
        this.updateMetricCard('avg-response-time', `${data.overview.averageResponseTime}ms`);
        this.updateMetricCard('total-costs', `$${data.overview.totalCosts.toLocaleString()}`);
        this.updateMetricCard('uptime', `${data.overview.uptime}%`);
        
        // Update alerts
        this.updateAlerts(data.alerts);
        
        // Update charts
        this.updateChart('transaction-trends', data.charts.transactionTrends);
        this.updateChart('network-throughput', data.charts.networkThroughput);
        this.updateChart('performance-overview', data.charts.performanceOverview);
        this.updateChart('cost-breakdown', data.charts.costBreakdown);
    }

    updateTransactionAnalytics(data) {
        // Update transaction summary
        const summaryEl = document.getElementById('transaction-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="label">Total Transactions</div>
                        <div class="value">${data.summary.totalTransactions.toLocaleString()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Success Rate</div>
                        <div class="value">${data.summary.successRate}%</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Average Value</div>
                        <div class="value">$${data.summary.averageValue.toLocaleString()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Total Volume</div>
                        <div class="value">$${data.summary.totalValue.toLocaleString()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Unique Users</div>
                        <div class="value">${data.summary.uniqueUsers.toLocaleString()}</div>
                    </div>
                </div>
            `;
        }
        
        // Update transaction distribution
        this.updateDistributionChart('transaction-distribution', data.distribution);
        
        // Update transaction performance
        this.updatePerformanceTable('transaction-performance', data.performance);
    }

    updateNetworkStatistics(data) {
        // Update network overview
        const overviewEl = document.getElementById('network-overview');
        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="network-stats">
                    <div class="stat-item">
                        <div class="label">Network Type</div>
                        <div class="value">${data.overview.networkType}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Status</div>
                        <div class="value status-${data.overview.status}">${data.overview.status}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Node Count</div>
                        <div class="value">${data.overview.nodeCount}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Active Nodes</div>
                        <div class="value">${data.overview.activeNodes}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Latest Ledger</div>
                        <div class="value">${data.overview.latestLedger.toLocaleString()}</div>
                    </div>
                </div>
            `;
        }
        
        // Update network health
        this.updateHealthIndicator('network-health', data.health);
        
        // Update network congestion
        this.updateCongestionChart('network-congestion', data.congestion);
        
        // Update throughput and latency charts
        this.updateChart('network-throughput-detail', data.throughput);
        this.updateChart('network-latency', data.latency);
    }

    updatePerformanceMetrics(data) {
        // Update performance overview
        const overviewEl = document.getElementById('performance-overview');
        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="performance-stats">
                    <div class="stat-item">
                        <div class="label">Average Response Time</div>
                        <div class="value">${data.responseTime[0]?.avg || 0}ms</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Throughput</div>
                        <div class="value">${data.throughput[0]?.requests || 0} req/min</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Error Rate</div>
                        <div class="value">${data.errorRate[0]?.rate || 0}%</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Uptime</div>
                        <div class="value">${data.availability.uptime}%</div>
                    </div>
                </div>
            `;
        }
        
        // Update performance charts
        this.updateChart('response-time-chart', data.responseTime);
        this.updateChart('throughput-chart', data.throughput);
        this.updateChart('error-rate-chart', data.errorRate);
        this.updateChart('resource-usage-chart', data.resourceUsage);
    }

    updateCostAnalysis(data) {
        // Update cost overview
        const overviewEl = document.getElementById('cost-overview');
        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="cost-stats">
                    <div class="stat-item">
                        <div class="label">Total Costs</div>
                        <div class="value">$${data.totalCosts.total.toLocaleString()}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Trend</div>
                        <div class="value trend-${data.totalCosts.trend}">${data.totalCosts.trend}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Change</div>
                        <div class="value">${data.totalCosts.change > 0 ? '+' : ''}${data.totalCosts.change}%</div>
                    </div>
                </div>
            `;
        }
        
        // Update cost breakdown chart
        this.updatePieChart('cost-breakdown-detail', data.totalCosts.breakdown);
        
        // Update cost trends
        this.updateChart('cost-trends', data.costTrends);
        
        // Update cost per transaction
        this.updateChart('cost-per-transaction', data.costPerTransaction);
        
        // Update optimization recommendations
        this.updateOptimizationRecommendations(data.optimization);
    }

    updateRealTimeData(data) {
        this.realTimeData = data;
        
        // Update real-time metrics
        this.updateMetricCard('active-users', data.activeUsers);
        this.updateMetricCard('current-tps', data.currentTPS);
        this.updateMetricCard('avg-latency', `${data.avgLatency}ms`);
        
        // Update real-time chart
        this.updateRealTimeChart(data);
    }

    updateMetricCard(id, value) {
        const card = document.getElementById(id);
        if (card) {
            card.querySelector('.value').textContent = value;
        }
    }

    updateChart(id, data) {
        const chartContainer = document.getElementById(id);
        if (!chartContainer) return;
        
        // Destroy existing chart if it exists
        if (this.charts.has(id)) {
            this.charts.get(id).destroy();
        }
        
        // Create new chart
        const ctx = chartContainer.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.timestamp),
                datasets: [{
                    label: 'Value',
                    data: data.map(item => item.count || item.volume || item.avg || item.total || item.value),
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        this.charts.set(id, chart);
    }

    updatePieChart(id, data) {
        const chartContainer = document.getElementById(id);
        if (!chartContainer) return;
        
        // Destroy existing chart if it exists
        if (this.charts.has(id)) {
            this.charts.get(id).destroy();
        }
        
        const ctx = chartContainer.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: [
                        '#4299e1',
                        '#48bb78',
                        '#ed8936',
                        '#f56565',
                        '#9f7aea'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        
        this.charts.set(id, chart);
    }

    updateDistributionChart(id, data) {
        const container = document.getElementById(id);
        if (!container) return;
        
        container.innerHTML = `
            <div class="distribution-grid">
                <div class="distribution-section">
                    <h4>By Type</h4>
                    ${Object.entries(data.byType).map(([type, value]) => `
                        <div class="distribution-item">
                            <span class="label">${type}</span>
                            <div class="bar">
                                <div class="fill" style="width: ${value}%"></div>
                            </div>
                            <span class="value">${value}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="distribution-section">
                    <h4>By Value</h4>
                    ${Object.entries(data.byValue).map(([type, value]) => `
                        <div class="distribution-item">
                            <span class="label">${type}</span>
                            <div class="bar">
                                <div class="fill" style="width: ${value}%"></div>
                            </div>
                            <span class="value">${value}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="distribution-section">
                    <h4>By Status</h4>
                    ${Object.entries(data.byStatus).map(([status, value]) => `
                        <div class="distribution-item">
                            <span class="label">${status}</span>
                            <div class="bar">
                                <div class="fill" style="width: ${value}%"></div>
                            </div>
                            <span class="value">${value}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updatePerformanceTable(id, data) {
        const container = document.getElementById(id);
        if (!container) return;
        
        container.innerHTML = `
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Average Confirmation Time</td>
                        <td>${data.averageConfirmationTime}ms</td>
                        <td class="status-good">Good</td>
                    </tr>
                    <tr>
                        <td>Median Confirmation Time</td>
                        <td>${data.medianConfirmationTime}ms</td>
                        <td class="status-good">Good</td>
                    </tr>
                    <tr>
                        <td>P95 Confirmation Time</td>
                        <td>${data.p95ConfirmationTime}ms</td>
                        <td class="status-warning">Warning</td>
                    </tr>
                    <tr>
                        <td>Throughput</td>
                        <td>${data.throughput} tx/min</td>
                        <td class="status-good">Good</td>
                    </tr>
                    <tr>
                        <td>Peak Throughput</td>
                        <td>${data.peakThroughput} tx/min</td>
                        <td class="status-good">Good</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    updateHealthIndicator(id, data) {
        const container = document.getElementById(id);
        if (!container) return;
        
        container.innerHTML = `
            <div class="health-indicator">
                <div class="health-status status-${data.overall}">
                    <div class="status-icon"></div>
                    <div class="status-text">${data.overall}</div>
                </div>
                <div class="health-metrics">
                    <div class="metric">
                        <span class="label">Uptime</span>
                        <span class="value">${data.uptime}%</span>
                    </div>
                    <div class="metric">
                        <span class="label">Response Time</span>
                        <span class="value">${data.responseTime}ms</span>
                    </div>
                    <div class="metric">
                        <span class="label">Error Rate</span>
                        <span class="value">${data.errorRate}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateCongestionChart(id, data) {
        const container = document.getElementById(id);
        if (!container) return;
        
        container.innerHTML = `
            <div class="congestion-indicator">
                <div class="congestion-level level-${data.level}">
                    <div class="level-text">${data.level.toUpperCase()}</div>
                    <div class="level-bar">
                        <div class="fill" style="width: ${data.utilization}%"></div>
                    </div>
                    <div class="utilization">${data.utilization}%</div>
                </div>
                <div class="congestion-details">
                    <div class="detail">
                        <span class="label">Current TPS</span>
                        <span class="value">${data.operationsPerSecond}</span>
                    </div>
                    <div class="detail">
                        <span class="label">Max TPS</span>
                        <span class="value">${data.maxOperationsPerSecond}</span>
                    </div>
                    <div class="detail">
                        <span class="label">Trend</span>
                        <span class="value trend-${data.trend}">${data.trend}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateOptimizationRecommendations(data) {
        const container = document.getElementById('optimization-recommendations');
        if (!container) return;
        
        container.innerHTML = `
            <div class="optimization-section">
                <div class="potential-savings">
                    <h4>Potential Savings</h4>
                    <div class="savings-amount">$${data.potential_savings.toLocaleString()}</div>
                </div>
                <div class="recommendations">
                    <h4>Recommendations</h4>
                    <ul>
                        ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
                <div class="efficiency-score">
                    <h4>Efficiency Score</h4>
                    <div class="score-circle">
                        <div class="score" style="--score: ${data.efficiency_score}">${data.efficiency_score}</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        if (!container) return;
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert alert-${alert.type}">
                <div class="alert-icon"></div>
                <div class="alert-content">
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    }

    updateRealTimeChart(data) {
        const container = document.getElementById('realtime-chart');
        if (!container) return;
        
        // Add new data point to real-time chart
        if (!this.realTimeChartData) {
            this.realTimeChartData = [];
        }
        
        this.realTimeChartData.push({
            timestamp: data.timestamp,
            tps: data.currentTPS,
            latency: data.avgLatency,
            users: data.activeUsers
        });
        
        // Keep only last 50 data points
        if (this.realTimeChartData.length > 50) {
            this.realTimeChartData.shift();
        }
        
        // Update real-time chart
        if (this.charts.has('realtime-chart')) {
            const chart = this.charts.get('realtime-chart');
            chart.data.labels = this.realTimeChartData.map(item => new Date(item.timestamp).toLocaleTimeString());
            chart.data.datasets[0].data = this.realTimeChartData.map(item => item.tps);
            chart.update('none');
        }
    }

    handleAnalyticsUpdate(data) {
        console.log('Analytics update received:', data);
        // Refresh relevant sections based on update type
        if (data.type === 'transaction') {
            this.loadTransactionAnalytics();
        } else if (data.type === 'network') {
            this.loadNetworkStatistics();
        } else if (data.type === 'performance') {
            this.loadPerformanceMetrics();
        } else if (data.type === 'cost') {
            this.loadCostAnalysis();
        }
    }

    handleRealTimeUpdate(data) {
        this.updateRealTimeData(data);
    }

    handleAnalyticsError(data) {
        console.error('Analytics error:', data);
        this.showError(`Analytics error: ${data.error}`);
    }

    setupEventListeners() {
        // Time range selector
        const timeRangeSelect = document.getElementById('time-range');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.currentTimeRange = e.target.value;
                this.loadDashboardData();
            });
        }

        // Interval selector
        const intervalSelect = document.getElementById('interval');
        if (intervalSelect) {
            intervalSelect.addEventListener('change', (e) => {
                this.currentInterval = e.target.value;
                this.loadDashboardData();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.showExportModal();
            });
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.autoRefresh = e.target.checked;
                if (this.autoRefresh) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }

        // Mobile view toggle
        const mobileViewToggle = document.getElementById('mobile-view-toggle');
        if (mobileViewToggle) {
            mobileViewToggle.addEventListener('click', () => {
                this.toggleMobileView();
            });
        }
    }

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        
        if (this.autoRefresh) {
            this.refreshTimer = setInterval(() => {
                this.loadDashboardData();
            }, this.refreshInterval);
        }
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    showExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Export Analytics Data</h3>
                        <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="export-form" onsubmit="analyticsDashboardUI.handleExport(event)">
                            <div class="form-group">
                                <label for="export-format">Format:</label>
                                <select id="export-format" required>
                                    <option value="json">JSON</option>
                                    <option value="csv">CSV</option>
                                    <option value="xlsx">Excel</option>
                                    <option value="pdf">PDF</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="export-timeRange">Time Range:</label>
                                <select id="export-timeRange" required>
                                    <option value="24h">Last 24 Hours</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                    <option value="90d">Last 90 Days</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="export-metrics">Metrics:</label>
                                <div class="checkbox-group">
                                    <label><input type="checkbox" name="metrics" value="transactions" checked> Transactions</label>
                                    <label><input type="checkbox" name="metrics" value="network" checked> Network</label>
                                    <label><input type="checkbox" name="metrics" value="performance" checked> Performance</label>
                                    <label><input type="checkbox" name="metrics" value="costs" checked> Costs</label>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="include-raw" name="includeRaw">
                                    Include Raw Data
                                </label>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">Cancel</button>
                                <button type="submit" class="btn btn-primary">Export</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    async handleExport(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const options = {
            format: formData.get('format'),
            timeRange: formData.get('timeRange'),
            metrics: Array.from(formData.getAll('metrics')),
            includeRaw: formData.has('includeRaw')
        };
        
        try {
            const response = await fetch(`/api/analytics/export?${new URLSearchParams(options)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.${options.format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showSuccess('Analytics data exported successfully');
                document.getElementById('export-modal').style.display = 'none';
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export analytics data');
        }
    }

    toggleMobileView() {
        document.body.classList.toggle('mobile-view');
        const isMobileView = document.body.classList.contains('mobile-view');
        
        // Update button text
        const toggleBtn = document.getElementById('mobile-view-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = isMobileView ? 'Desktop View' : 'Mobile View';
        }
        
        // Load mobile-optimized data if in mobile view
        if (isMobileView) {
            this.loadMobileAnalytics();
        }
    }

    async loadMobileAnalytics() {
        try {
            const response = await fetch('/api/analytics/mobile?timeRange=24h&limit=20', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateMobileAnalytics(data);
            }
        } catch (error) {
            console.error('Failed to load mobile analytics:', error);
        }
    }

    updateMobileAnalytics(data) {
        // Update mobile-specific UI elements
        const mobileContainer = document.getElementById('mobile-analytics');
        if (mobileContainer) {
            mobileContainer.innerHTML = `
                <div class="mobile-dashboard">
                    <div class="mobile-summary">
                        <div class="summary-card">
                            <div class="title">Transactions</div>
                            <div class="value">${data.summary.totalTransactions.toLocaleString()}</div>
                        </div>
                        <div class="summary-card">
                            <div class="title">Success Rate</div>
                            <div class="value">${data.summary.successRate}%</div>
                        </div>
                        <div class="summary-card">
                            <div class="title">Avg Cost</div>
                            <div class="value">$${data.summary.averageCost}</div>
                        </div>
                        <div class="summary-card">
                            <div class="title">Network</div>
                            <div class="value">${data.summary.networkHealth}</div>
                        </div>
                    </div>
                    
                    <div class="mobile-alerts">
                        <h4>Alerts</h4>
                        ${data.alerts.map(alert => `
                            <div class="mobile-alert alert-${alert.type}">
                                ${alert.message}
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mobile-quick-stats">
                        <h4>Quick Stats</h4>
                        <div class="stats-grid">
                            <div class="stat">
                                <div class="label">Today</div>
                                <div class="value">${data.quickStats.today.transactions}</div>
                            </div>
                            <div class="stat">
                                <div class="label">Week</div>
                                <div class="value">${data.quickStats.week.transactions}</div>
                            </div>
                            <div class="stat">
                                <div class="label">Month</div>
                                <div class="value">${data.quickStats.month.transactions}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
}

// Initialize the UI when DOM is ready
let analyticsDashboardUI;

document.addEventListener('DOMContentLoaded', () => {
    analyticsDashboardUI = new AnalyticsDashboardUI();
    
    // Make it globally available for onclick handlers
    window.analyticsDashboardUI = analyticsDashboardUI;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsDashboardUI;
}
