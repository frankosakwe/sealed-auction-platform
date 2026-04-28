/**
 * DeFi Portfolio Dashboard JavaScript
 * Handles portfolio management, charts, and DeFi operations
 */

class DeFiDashboard {
    constructor() {
        this.userAddress = null;
        this.portfolio = null;
        this.liquidityPositions = [];
        this.stakingPositions = [];
        this.compositionChart = null;
        this.performanceChart = null;
        
        this.init();
    }

    async init() {
        // Load user data
        await this.loadUserData();
        
        // Initialize charts
        this.initCharts();
        
        // Load portfolio data
        await this.loadPortfolioData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start real-time updates
        this.startRealTimeUpdates();
    }

    async loadUserData() {
        try {
            // Get user address from session or local storage
            this.userAddress = localStorage.getItem('userAddress') || 'demo-user';
            document.getElementById('userAddress').textContent = this.formatAddress(this.userAddress);
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showError('Failed to load user data');
        }
    }

    async loadPortfolioData() {
        try {
            // Show loading state
            this.showLoading(true);

            // Fetch portfolio data
            const response = await fetch('/api/defi/portfolio');
            const data = await response.json();
            
            this.portfolio = data.portfolio;
            this.liquidityPositions = data.liquidityPositions;
            this.stakingPositions = data.stakingPositions;
            
            // Update UI
            this.updatePortfolioOverview();
            this.updateLiquidityTable();
            this.updateStakingTable();
            this.updateCharts();
            this.updateRiskAssessment();
            
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            this.showError('Failed to load portfolio data');
        } finally {
            this.showLoading(false);
        }
    }

    updatePortfolioOverview() {
        if (!this.portfolio) return;

        // Update total value
        const totalValue = this.portfolio.total_value_usd || 0;
        document.getElementById('totalValue').textContent = this.formatCurrency(totalValue);
        
        // Update value change (mock data for demo)
        const valueChange = (Math.random() - 0.5) * 10; // Random change between -5% and +5%
        const changeElement = document.getElementById('valueChange');
        changeElement.textContent = `${valueChange >= 0 ? '+' : ''}${valueChange.toFixed(2)}%`;
        changeElement.className = valueChange >= 0 ? 'text-green-500' : 'text-red-500';
        
        // Update liquidity value
        const liquidityValue = this.portfolio.total_liquidity_usd || 0;
        document.getElementById('liquidityValue').textContent = this.formatCurrency(liquidityValue);
        document.getElementById('liquidityPositions').textContent = this.liquidityPositions.length;
        
        // Update staking value
        const stakingValue = this.portfolio.total_staked_usd || 0;
        document.getElementById('stakingValue').textContent = this.formatCurrency(stakingValue);
        const pendingRewards = this.portfolio.total_pending_rewards_usd || 0;
        document.getElementById('pendingRewards').textContent = this.formatCurrency(pendingRewards);
        
        // Update risk score
        const riskScore = this.calculateOverallRiskScore();
        document.getElementById('riskScore').textContent = riskScore.toFixed(1);
        
        const riskLevel = this.getRiskLevel(riskScore);
        const riskElement = document.getElementById('riskLevel');
        riskElement.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
        riskElement.className = `px-2 py-1 rounded-full text-xs text-white risk-${riskLevel}`;
    }

    updateLiquidityTable() {
        const tbody = document.getElementById('liquidityTableBody');
        tbody.innerHTML = '';

        this.liquidityPositions.forEach(position => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="text-sm font-medium text-gray-900">
                            ${position.token_a_symbol}/${position.token_b_symbol}
                        </div>
                        <div class="text-sm text-gray-500">Pool #${position.pool_id}</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${this.formatNumber(position.lp_amount)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                        ${this.formatCurrency(position.value_usd || 0)}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm ${position.change_24h >= 0 ? 'text-green-500' : 'text-red-500'}">
                        ${position.change_24h >= 0 ? '+' : ''}${position.change_24h?.toFixed(2) || '0.00'}%
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white risk-${position.risk_level || 'low'}">
                        ${(position.risk_level || 'low').charAt(0).toUpperCase() + (position.risk_level || 'low').slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="dashboard.showRemoveLiquidityModal(${position.position_id})" class="text-red-600 hover:text-red-900">
                        Remove
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (this.liquidityPositions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        No liquidity positions found. Add liquidity to get started.
                    </td>
                </tr>
            `;
        }
    }

    updateStakingTable() {
        const tbody = document.getElementById('stakingTableBody');
        tbody.innerHTML = '';

        this.stakingPositions.forEach(position => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="text-sm font-medium text-gray-900">${position.farm_name}</div>
                        <div class="text-sm text-gray-500">${position.staking_token_symbol}</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${this.formatNumber(position.amount)}</div>
                    <div class="text-sm text-gray-500">${this.formatCurrency(position.value_usd || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${position.apr?.toFixed(2) || '0.00'}%</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${this.formatNumber(position.pending_rewards || 0)}</div>
                    <div class="text-sm text-gray-500">${this.formatCurrency(position.pending_rewards_usd || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white risk-${position.risk_level || 'low'}">
                        ${(position.risk_level || 'low').charAt(0).toUpperCase() + (position.risk_level || 'low').slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="dashboard.claimRewards(${position.stake_id})" class="text-green-600 hover:text-green-900 mr-3">
                        Claim
                    </button>
                    <button onclick="dashboard.showUnstakeModal(${position.stake_id})" class="text-red-600 hover:text-red-900">
                        Unstake
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (this.stakingPositions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        No staking positions found. Stake tokens to earn rewards.
                    </td>
                </tr>
            `;
        }
    }

    initCharts() {
        // Portfolio Composition Chart
        const compositionCtx = document.getElementById('compositionChart').getContext('2d');
        this.compositionChart = new Chart(compositionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Liquidity', 'Staking', 'Pending Rewards'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(168, 85, 247, 0.8)',
                        'rgba(251, 191, 36, 0.8)'
                    ],
                    borderColor: [
                        'rgba(34, 197, 94, 1)',
                        'rgba(168, 85, 247, 1)',
                        'rgba(251, 191, 36, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Performance Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        this.performanceChart = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [],
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateCharts() {
        if (!this.portfolio) return;

        // Update composition chart
        const liquidityValue = this.portfolio.total_liquidity_usd || 0;
        const stakingValue = this.portfolio.total_staked_usd || 0;
        const rewardsValue = this.portfolio.total_pending_rewards_usd || 0;

        this.compositionChart.data.datasets[0].data = [liquidityValue, stakingValue, rewardsValue];
        this.compositionChart.update();

        // Update performance chart (mock data for demo)
        const hours = Array.from({length: 24}, (_, i) => `${23-i}h ago`).reverse();
        const values = Array.from({length: 24}, () => 
            (this.portfolio.total_value_usd || 0) * (0.9 + Math.random() * 0.2)
        );

        this.performanceChart.data.labels = hours;
        this.performanceChart.data.datasets[0].data = values;
        this.performanceChart.update();
    }

    async updateRiskAssessment() {
        try {
            const response = await fetch('/api/defi/risk-assessment');
            const riskData = await response.json();

            const riskContainer = document.getElementById('riskAssessment');
            riskContainer.innerHTML = '';

            riskData.assessments.forEach(assessment => {
                const riskCard = document.createElement('div');
                riskCard.className = 'bg-gray-50 rounded-lg p-4';
                riskCard.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-medium text-gray-900">${assessment.name}</h4>
                        <span class="px-2 py-1 rounded-full text-xs text-white risk-${assessment.risk_level}">
                            ${assessment.risk_level.toUpperCase()}
                        </span>
                    </div>
                    <div class="text-2xl font-bold text-gray-900 mb-2">${assessment.risk_score.toFixed(1)}/10</div>
                    <div class="text-sm text-gray-600">
                        <div>Liquidity Risk: ${assessment.assessments.liquidity.score.toFixed(1)}</div>
                        <div>Volatility Risk: ${assessment.assessments.volatility.score.toFixed(1)}</div>
                        <div>Concentration Risk: ${assessment.assessments.concentration.score.toFixed(1)}</div>
                        <div>Smart Contract Risk: ${assessment.assessments.smart_contract.score.toFixed(1)}</div>
                    </div>
                `;
                riskContainer.appendChild(riskCard);
            });
        } catch (error) {
            console.error('Error loading risk assessment:', error);
        }
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadPortfolioData();
        });

        // Add liquidity button
        document.getElementById('addLiquidityBtn').addEventListener('click', () => {
            this.showAddLiquidityModal();
        });

        // Stake button
        document.getElementById('stakeBtn').addEventListener('click', () => {
            this.showStakeModal();
        });

        // Add liquidity form
        document.getElementById('addLiquidityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddLiquidity();
        });

        // Stake form
        document.getElementById('stakeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStake();
        });
    }

    async showAddLiquidityModal() {
        try {
            // Load available pools
            const response = await fetch('/api/defi/pools');
            const pools = await response.json();

            const poolSelect = document.getElementById('poolSelect');
            poolSelect.innerHTML = '';

            pools.forEach(pool => {
                const option = document.createElement('option');
                option.value = pool.pool_id;
                option.textContent = `${pool.token_a_symbol}/${pool.token_b_symbol} - Fee: ${pool.fee_rate / 100}%`;
                poolSelect.appendChild(option);
            });

            document.getElementById('addLiquidityModal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading pools:', error);
            this.showError('Failed to load available pools');
        }
    }

    async showStakeModal() {
        try {
            // Load available farms
            const response = await fetch('/api/defi/farms');
            const farms = await response.json();

            const farmSelect = document.getElementById('farmSelect');
            farmSelect.innerHTML = '';

            farms.forEach(farm => {
                const option = document.createElement('option');
                option.value = farm.farm_id;
                option.textContent = `${farm.name} - APR: ${farm.apr?.toFixed(2) || '0.00'}%`;
                farmSelect.appendChild(option);
            });

            document.getElementById('stakeModal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading farms:', error);
            this.showError('Failed to load available farms');
        }
    }

    async handleAddLiquidity() {
        try {
            const poolId = document.getElementById('poolSelect').value;
            const tokenAAmount = parseFloat(document.getElementById('tokenAAmount').value);
            const tokenBAmount = parseFloat(document.getElementById('tokenBAmount').value);
            const minLPAmount = parseFloat(document.getElementById('minLPAmount').value);

            if (!tokenAAmount || !tokenBAmount || !minLPAmount) {
                this.showError('Please fill in all fields');
                return;
            }

            this.showLoading(true);

            const response = await fetch('/api/defi/add-liquidity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    poolId,
                    tokenAAmount,
                    tokenBAmount,
                    minLPAmount
                })
            });

            if (response.ok) {
                this.showSuccess('Liquidity added successfully!');
                this.closeModal('addLiquidityModal');
                await this.loadPortfolioData();
            } else {
                const error = await response.json();
                this.showError(error.message || 'Failed to add liquidity');
            }
        } catch (error) {
            console.error('Error adding liquidity:', error);
            this.showError('Failed to add liquidity');
        } finally {
            this.showLoading(false);
        }
    }

    async handleStake() {
        try {
            const farmId = document.getElementById('farmSelect').value;
            const amount = parseFloat(document.getElementById('stakeAmount').value);

            if (!amount) {
                this.showError('Please enter an amount to stake');
                return;
            }

            this.showLoading(true);

            const response = await fetch('/api/defi/stake', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    farmId,
                    amount
                })
            });

            if (response.ok) {
                this.showSuccess('Tokens staked successfully!');
                this.closeModal('stakeModal');
                await this.loadPortfolioData();
            } else {
                const error = await response.json();
                this.showError(error.message || 'Failed to stake tokens');
            }
        } catch (error) {
            console.error('Error staking tokens:', error);
            this.showError('Failed to stake tokens');
        } finally {
            this.showLoading(false);
        }
    }

    async claimRewards(stakeId) {
        try {
            this.showLoading(true);

            const response = await fetch('/api/defi/claim-rewards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stakeId })
            });

            if (response.ok) {
                this.showSuccess('Rewards claimed successfully!');
                await this.loadPortfolioData();
            } else {
                const error = await response.json();
                this.showError(error.message || 'Failed to claim rewards');
            }
        } catch (error) {
            console.error('Error claiming rewards:', error);
            this.showError('Failed to claim rewards');
        } finally {
            this.showLoading(false);
        }
    }

    startRealTimeUpdates() {
        // Update portfolio every 30 seconds
        setInterval(() => {
            this.loadPortfolioData();
        }, 30000);

        // Update prices every 10 seconds
        setInterval(() => {
            this.updatePrices();
        }, 10000);
    }

    async updatePrices() {
        try {
            const response = await fetch('/api/defi/prices');
            const prices = await response.json();
            
            // Update UI with new prices
            // This would update individual position values
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }

    calculateOverallRiskScore() {
        if (!this.liquidityPositions.length && !this.stakingPositions.length) {
            return 0;
        }

        let totalRisk = 0;
        let count = 0;

        this.liquidityPositions.forEach(position => {
            totalRisk += position.risk_score || 0;
            count++;
        });

        this.stakingPositions.forEach(position => {
            totalRisk += position.risk_score || 0;
            count++;
        });

        return count > 0 ? totalRisk / count : 0;
    }

    getRiskLevel(score) {
        if (score >= 8) return 'critical';
        if (score >= 6) return 'high';
        if (score >= 4) return 'medium';
        if (score >= 2) return 'low';
        return 'very_low';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatNumber(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        }).format(amount);
    }

    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    showLoading(show) {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    }

    showError(message) {
        // Simple error notification (in production, use a proper toast library)
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Simple success notification (in production, use a proper toast library)
        alert(`Success: ${message}`);
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }
}

// Helper functions for global access
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DeFiDashboard();
});
