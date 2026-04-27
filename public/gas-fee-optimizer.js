/**
 * Gas Fee Optimization UI - Issue #116
 * Interface for optimizing gas fees with estimation and scheduling options.
 */

const GasFeeOptimizer = (() => {
  let currentEstimates = null;
  let feeHistoryData = [];
  let congestionData = [];
  let scheduledTransactions = [];
  let savingsAnalysis = null;
  let updateInterval = null;

  // --- Initialization ---
  async function init() {
    await loadInitialData();
    startRealTimeUpdates();
    setupEventListeners();
    renderGasOptimizerUI();
  }

  // --- Data Loading ---
  async function loadInitialData() {
    try {
      const [estimates, history, congestion, scheduled, savings] = await Promise.all([
        fetch('/api/gas/estimate').then(r => r.json()),
        fetch('/api/gas/history?hours=24').then(r => r.json()),
        fetch('/api/gas/congestion').then(r => r.json()),
        fetch('/api/gas/scheduled').then(r => r.json()),
        fetch('/api/gas/savings').then(r => r.json())
      ]);

      currentEstimates = estimates;
      feeHistoryData = history.history;
      congestionData = congestion.recent;
      scheduledTransactions = scheduled.scheduled;
      savingsAnalysis = savings;

      updateAllDisplays();
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Failed to load gas fee data', 'error');
    }
  }

  // --- Real-time Updates ---
  function startRealTimeUpdates() {
    updateInterval = setInterval(async () => {
      try {
        const estimates = await fetch('/api/gas/estimate').then(r => r.json());
        currentEstimates = estimates;
        updateFeeEstimates();
        updateNetworkStatus();
      } catch (error) {
        console.error('Error updating estimates:', error);
      }
    }, 30000); // Update every 30 seconds
  }

  // --- UI Rendering ---
  function renderGasOptimizerUI() {
    const tabNav = document.querySelector('.glass-effect.rounded-xl.p-1.mb-8');
    if (tabNav) {
      const btn = document.createElement('button');
      btn.id = 'gasOptimizerTab';
      btn.className = 'tab-btn px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base';
      btn.setAttribute('onclick', "switchTab('gasOptimizer')");
      btn.innerHTML = '<i class="fas fa-gas-pump mr-1 sm:mr-2"></i><span class="hidden sm:inline">Gas</span> Fees';
      tabNav.appendChild(btn);
    }

    const tabContent = document.createElement('div');
    tabContent.id = 'gasOptimizerContent';
    tabContent.className = 'tab-content hidden';
    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
        
        <!-- Current Fee Estimates -->
        <div class="glass-effect rounded-xl p-4 lg:p-5">
          <h3 class="font-bold text-lg mb-4">
            <i class="fas fa-chart-line mr-2 text-green-400"></i>Current Estimates
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Min Fee</span>
              <span id="min-fee" class="font-mono text-sm">-- stroops</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Recommended</span>
              <span id="recommended-fee" class="font-mono text-sm font-bold text-green-400">-- stroops</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Fast</span>
              <span id="fast-fee" class="font-mono text-sm text-yellow-400">-- stroops</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Instant</span>
              <span id="instant-fee" class="font-mono text-sm text-red-400">-- stroops</span>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t border-white/10">
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-400">Savings Potential</span>
              <span id="savings-potential" class="text-xs font-bold text-green-400">--%</span>
            </div>
          </div>
        </div>

        <!-- Network Congestion -->
        <div class="glass-effect rounded-xl p-4 lg:p-5">
          <h3 class="font-bold text-lg mb-4">
            <i class="fas fa-traffic-light mr-2 text-yellow-400"></i>Network Status
          </h3>
          <div class="text-center mb-4">
            <div id="congestion-indicator" class="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2">
              <i class="fas fa-circle text-2xl"></i>
            </div>
            <p id="congestion-level" class="text-lg font-bold">--</p>
            <p id="congestion-trend" class="text-xs text-gray-400">--</p>
          </div>
          <div class="space-y-2">
            <div id="congestion-recommendations" class="text-xs text-gray-300">
              <!-- Recommendations will be inserted here -->
            </div>
          </div>
          <button onclick="GasFeeOptimizer.refreshCongestion()" 
            class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <i class="fas fa-sync-alt mr-1"></i>Refresh Status
          </button>
        </div>

        <!-- Best Time to Transact -->
        <div class="glass-effect rounded-xl p-4 lg:p-5">
          <h3 class="font-bold text-lg mb-4">
            <i class="fas fa-clock mr-2 text-purple-400"></i>Optimal Timing
          </h3>
          <div class="text-center">
            <div class="text-3xl font-bold text-purple-400 mb-2">
              <span id="best-hour">--</span>:00
            </div>
            <p id="best-time-reason" class="text-xs text-gray-400 mb-4">--</p>
            <div class="bg-purple-600/20 rounded-lg p-3">
              <p class="text-xs text-purple-300">Estimated Savings</p>
              <p id="estimated-savings" class="text-lg font-bold text-purple-400">--%</p>
            </div>
          </div>
          <button onclick="GasFeeOptimizer.scheduleOptimalTime()" 
            class="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <i class="fas fa-calendar-plus mr-1"></i>Schedule for Optimal Time
          </button>
        </div>

      </div>

      <!-- Fee History Chart -->
      <div class="glass-effect rounded-xl p-4 lg:p-5 mb-8">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">
            <i class="fas fa-chart-area mr-2 text-blue-400"></i>Fee History
          </h3>
          <div class="flex space-x-2">
            <button onclick="GasFeeOptimizer.changeHistoryPeriod(6)" class="history-btn px-3 py-1 rounded text-xs bg-white/10 hover:bg-white/20">6H</button>
            <button onclick="GasFeeOptimizer.changeHistoryPeriod(24)" class="history-btn px-3 py-1 rounded text-xs bg-blue-600">24H</button>
            <button onclick="GasFeeOptimizer.changeHistoryPeriod(168)" class="history-btn px-3 py-1 rounded text-xs bg-white/10 hover:bg-white/20">7D</button>
          </div>
        </div>
        <div id="fee-chart" class="h-64 flex items-center justify-center">
          <canvas id="feeChartCanvas"></canvas>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 lg:gap-4 mt-4">
          <div class="text-center">
            <p class="text-xs text-gray-400">Average</p>
            <p id="avg-fee" class="font-mono text-sm">--</p>
          </div>
          <div class="text-center">
            <p class="text-xs text-gray-400">Minimum</p>
            <p id="min-fee-hist" class="font-mono text-sm text-green-400">--</p>
          </div>
          <div class="text-center">
            <p class="text-xs text-gray-400">Maximum</p>
            <p id="max-fee-hist" class="font-mono text-sm text-red-400">--</p>
          </div>
          <div class="text-center">
            <p class="text-xs text-gray-400">Trend</p>
            <p id="fee-trend" class="font-mono text-sm">--</p>
          </div>
        </div>
      </div>

      <!-- Transaction Scheduling -->
      <div class="glass-effect rounded-xl p-4 lg:p-5 mb-8">
        <h3 class="font-bold text-lg mb-4">
          <i class="fas fa-calendar-alt mr-2 text-orange-400"></i>Transaction Scheduling
        </h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div>
            <h4 class="font-semibold mb-3">Schedule New Transaction</h4>
            <form id="schedule-form" class="space-y-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Transaction Type</label>
                <select id="transaction-type" class="w-full p-2 rounded bg-white/10 border border-white/20 text-sm">
                  <option value="create_auction">Create Auction</option>
                  <option value="commit_bid">Commit Bid</option>
                  <option value="reveal_bid">Reveal Bid</option>
                  <option value="end_auction">End Auction</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Maximum Fee (stroops)</label>
                <input type="number" id="max-fee-input" class="w-full p-2 rounded bg-white/10 border border-white/20 text-sm" 
                  placeholder="1000" value="1000">
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Priority</label>
                <select id="priority" class="w-full p-2 rounded bg-white/10 border border-white/20 text-sm">
                  <option value="low">Low (Slow, Cheap)</option>
                  <option value="normal" selected>Normal (Balanced)</option>
                  <option value="high">High (Fast)</option>
                  <option value="instant">Instant (Very Fast)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Schedule Time</label>
                <input type="datetime-local" id="schedule-time" class="w-full p-2 rounded bg-white/10 border border-white/20 text-sm">
              </div>
              <button type="submit" class="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <i class="fas fa-plus mr-2"></i>Schedule Transaction
              </button>
            </form>
          </div>
          <div>
            <h4 class="font-semibold mb-3">Scheduled Transactions</h4>
            <div id="scheduled-list" class="space-y-2 max-h-64 overflow-y-auto">
              <!-- Scheduled transactions will be inserted here -->
            </div>
          </div>
        </div>
      </div>

      <!-- Cost Savings Analysis -->
      <div class="glass-effect rounded-xl p-4 lg:p-5">
        <h3 class="font-bold text-lg mb-4">
          <i class="fas fa-piggy-bank mr-2 text-green-400"></i>Cost Savings Analysis
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-400 mb-2">
              <span id="total-savings">--</span> XLM
            </div>
            <p class="text-xs text-gray-400">Total Savings</p>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400 mb-2">
              <span id="avg-savings">--</span> XLM
            </div>
            <p class="text-xs text-gray-400">Average per Transaction</p>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-400 mb-2">
              <span id="optimization-rate">--</span>%
            </div>
            <p class="text-xs text-gray-400">Optimization Rate</p>
          </div>
        </div>
        
        <div class="mt-6">
          <h4 class="font-semibold mb-3">Recommendations</h4>
          <div id="savings-recommendations" class="space-y-2">
            <!-- Recommendations will be inserted here -->
          </div>
        </div>

        <div class="mt-6">
          <h4 class="font-semibold mb-3">Savings Breakdown</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="text-xs text-gray-400 mb-2">By Transaction Type</p>
              <div id="savings-by-type" class="space-y-1">
                <!-- Breakdown will be inserted here -->
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-2">By Priority</p>
              <div id="savings-by-priority" class="space-y-1">
                <!-- Breakdown will be inserted here -->
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-2">By Month</p>
              <div id="savings-by-month" class="space-y-1">
                <!-- Breakdown will be inserted here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const bidModal = document.getElementById('bidModal');
    if (bidModal) {
      bidModal.parentNode.insertBefore(tabContent, bidModal);
    } else {
      document.querySelector('main').appendChild(tabContent);
    }

    // Initialize chart
    initializeFeeChart();
  }

  // --- Update Functions ---
  function updateAllDisplays() {
    updateFeeEstimates();
    updateNetworkStatus();
    updateOptimalTiming();
    updateScheduledTransactions();
    updateSavingsAnalysis();
    updateFeeChart();
  }

  function updateFeeEstimates() {
    if (!currentEstimates) return;

    document.getElementById('min-fee').textContent = `${currentEstimates.current.min} stroops`;
    document.getElementById('recommended-fee').textContent = `${currentEstimates.current.recommended} stroops`;
    document.getElementById('fast-fee').textContent = `${currentEstimates.current.fast} stroops`;
    document.getElementById('instant-fee').textContent = `${currentEstimates.current.instant} stroops`;
    document.getElementById('savings-potential').textContent = `${currentEstimates.optimization.savings_potential}%`;
  }

  function updateNetworkStatus() {
    if (!currentEstimates) return;

    const congestion = currentEstimates.network.congestion;
    const indicator = document.getElementById('congestion-indicator');
    const level = document.getElementById('congestion-level');
    const trend = document.getElementById('trend');
    const recommendations = document.getElementById('congestion-recommendations');

    const colors = {
      low: 'bg-green-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500'
    };

    indicator.className = `w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${colors[congestion]}`;
    level.textContent = congestion.charAt(0).toUpperCase() + congestion.slice(1);
    
    // Update recommendations
    const recs = currentEstimates.optimization.recommendations || [];
    recommendations.innerHTML = recs.map(rec => `<p class="text-xs">• ${rec}</p>`).join('');
  }

  function updateOptimalTiming() {
    if (!currentEstimates) return;

    const bestTime = currentEstimates.optimization.best_time_to_transact;
    document.getElementById('best-hour').textContent = bestTime.hour;
    document.getElementById('best-time-reason').textContent = bestTime.reason;
    document.getElementById('estimated-savings').textContent = bestTime.estimatedSavings;
  }

  function updateScheduledTransactions() {
    const list = document.getElementById('scheduled-list');
    if (scheduledTransactions.length === 0) {
      list.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No scheduled transactions</p>';
      return;
    }

    list.innerHTML = scheduledTransactions.map(tx => `
      <div class="bg-white/5 rounded-lg p-3">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-sm font-semibold">${tx.transactionType.replace('_', ' ').toUpperCase()}</p>
            <p class="text-xs text-gray-400">Priority: ${tx.priority}</p>
            <p class="text-xs text-gray-400">Max Fee: ${tx.maxFee} stroops</p>
            <p class="text-xs text-gray-400">Executes: ${new Date(tx.targetTime).toLocaleString()}</p>
          </div>
          <div class="flex space-x-1">
            ${tx.status === 'pending' ? `
              <button onclick="GasFeeOptimizer.cancelSchedule('${tx.id}')" 
                class="text-red-400 hover:text-red-300 text-xs">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-white/10">
          <p class="text-xs text-green-400">Est. Savings: ${tx.savings} stroops</p>
        </div>
      </div>
    `).join('');
  }

  function updateSavingsAnalysis() {
    if (!savingsAnalysis) return;

    document.getElementById('total-savings').textContent = (savingsAnalysis.totalSavings / 1e7).toFixed(6);
    document.getElementById('avg-savings').textContent = (savingsAnalysis.averageSavingsPerTransaction / 1e7).toFixed(6);
    document.getElementById('optimization-rate').textContent = savingsAnalysis.optimizationRate;

    // Update recommendations
    const recsElement = document.getElementById('savings-recommendations');
    recsElement.innerHTML = savingsAnalysis.recommendations.map(rec => `
      <div class="bg-white/5 rounded p-2">
        <p class="text-xs">• ${rec}</p>
      </div>
    `).join('');

    // Update breakdowns
    updateBreakdown('savings-by-type', savingsAnalysis.breakdown.byType);
    updateBreakdown('savings-by-priority', savingsAnalysis.breakdown.byPriority);
    updateBreakdown('savings-by-month', savingsAnalysis.breakdown.byMonth);
  }

  function updateBreakdown(elementId, data) {
    const element = document.getElementById(elementId);
    if (!data || Object.keys(data).length === 0) {
      element.innerHTML = '<p class="text-xs text-gray-400">No data</p>';
      return;
    }

    element.innerHTML = Object.entries(data)
      .sort(([,a], [,b]) => b - a)
      .map(([key, value]) => `
        <div class="flex justify-between text-xs">
          <span class="text-gray-400">${key}:</span>
          <span class="font-mono">${(value / 1e7).toFixed(6)} XLM</span>
        </div>
      `).join('');
  }

  // --- Chart Functions ---
  let feeChart = null;

  function initializeFeeChart() {
    const canvas = document.getElementById('feeChartCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Simple chart implementation - in production, you'd use Chart.js or similar
    updateFeeChart();
  }

  function updateFeeChart() {
    if (!feeHistoryData.length) return;

    const canvas = document.getElementById('feeChartCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Simple line chart
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const fees = feeHistoryData.map(d => d.p50_fee);
    const maxFee = Math.max(...fees);
    const minFee = Math.min(...fees);
    const feeRange = maxFee - minFee || 1;

    // Draw axes
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw line chart
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();

    fees.forEach((fee, index) => {
      const x = padding + (index / (fees.length - 1)) * chartWidth;
      const y = height - padding - ((fee - minFee) / feeRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Update statistics
    const avgFee = fees.reduce((sum, fee) => sum + fee, 0) / fees.length;
    document.getElementById('avg-fee').textContent = `${Math.round(avgFee)} stroops`;
    document.getElementById('min-fee-hist').textContent = `${minFee} stroops`;
    document.getElementById('max-fee-hist').textContent = `${maxFee} stroops`;
    
    const trend = calculateFeeTrend(fees);
    const trendElement = document.getElementById('fee-trend');
    trendElement.textContent = trend;
    trendElement.className = `font-mono text-sm ${trend === 'increasing' ? 'text-red-400' : trend === 'decreasing' ? 'text-green-400' : 'text-gray-400'}`;
  }

  function calculateFeeTrend(fees) {
    if (fees.length < 2) return 'stable';
    
    const recent = fees.slice(-10);
    const older = fees.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, fee) => sum + fee, 0) / recent.length;
    const olderAvg = older.reduce((sum, fee) => sum + fee, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  // --- Event Handlers ---
  function setupEventListeners() {
    const scheduleForm = document.getElementById('schedule-form');
    if (scheduleForm) {
      scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }

    // Set default schedule time to optimal time
    const scheduleTimeInput = document.getElementById('schedule-time');
    if (scheduleTimeInput && currentEstimates) {
      const bestHour = currentEstimates.optimization.best_time_to_transact.hour;
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(bestHour, 0, 0, 0);
      
      // If the optimal time has passed today, schedule for tomorrow
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      scheduleTimeInput.value = targetTime.toISOString().slice(0, 16);
    }
  }

  async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const formData = {
      transactionType: document.getElementById('transaction-type').value,
      maxFee: parseInt(document.getElementById('max-fee-input').value),
      priority: document.getElementById('priority').value,
      targetTime: document.getElementById('schedule-time').value
    };

    try {
      const response = await fetch('/api/gas/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('Transaction scheduled successfully!', 'success');
        
        // Refresh scheduled transactions
        const scheduled = await fetch('/api/gas/scheduled').then(r => r.json());
        scheduledTransactions = scheduled.scheduled;
        updateScheduledTransactions();
        
        // Reset form
        e.target.reset();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to schedule transaction', 'error');
      }
    } catch (error) {
      console.error('Error scheduling transaction:', error);
      showNotification('Failed to schedule transaction', 'error');
    }
  }

  // --- Public Methods ---
  async function refreshCongestion() {
    try {
      const congestion = await fetch('/api/gas/congestion').then(r => r.json());
      congestionData = congestion.recent;
      updateNetworkStatus();
      showNotification('Network status updated', 'success');
    } catch (error) {
      console.error('Error refreshing congestion:', error);
      showNotification('Failed to update network status', 'error');
    }
  }

  async function scheduleOptimalTime() {
    if (!currentEstimates) return;

    const bestHour = currentEstimates.optimization.best_time_to_transact.hour;
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(bestHour, 0, 0, 0);
    
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    document.getElementById('schedule-time').value = targetTime.toISOString().slice(0, 16);
    showNotification(`Scheduled for optimal time: ${targetTime.toLocaleString()}`, 'info');
  }

  async function cancelSchedule(scheduleId) {
    try {
      const response = await fetch(`/api/gas/schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showNotification('Transaction cancelled', 'success');
        
        // Refresh scheduled transactions
        const scheduled = await fetch('/api/gas/scheduled').then(r => r.json());
        scheduledTransactions = scheduled.scheduled;
        updateScheduledTransactions();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to cancel transaction', 'error');
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      showNotification('Failed to cancel transaction', 'error');
    }
  }

  async function changeHistoryPeriod(hours) {
    try {
      const history = await fetch(`/api/gas/history?hours=${hours}`).then(r => r.json());
      feeHistoryData = history.history;
      updateFeeChart();
      
      // Update button styles
      document.querySelectorAll('.history-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600');
        btn.classList.add('bg-white/10');
      });
      event.target.classList.remove('bg-white/10');
      event.target.classList.add('bg-blue-600');
    } catch (error) {
      console.error('Error changing history period:', error);
      showNotification('Failed to update history', 'error');
    }
  }

  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 animate-fade-in ${
      type === 'success' ? 'bg-green-600' :
      type === 'error' ? 'bg-red-600' :
      'bg-blue-600'
    } text-white`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  function cleanup() {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  }

  return {
    init,
    refreshCongestion,
    scheduleOptimalTime,
    cancelSchedule,
    changeHistoryPeriod,
    cleanup
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  GasFeeOptimizer.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  GasFeeOptimizer.cleanup();
});
