// Bid History Analytics JavaScript
class BidAnalytics {
    constructor() {
        this.currentUser = null;
        this.charts = {};
        this.timelineOffset = 0;
        this.filters = {};
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadInitialData();
        this.setupEventListeners();
    }

    async checkAuth() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'index.html';
                return;
            }

            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return;
            }

            this.currentUser = await response.json();
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = 'index.html';
        }
    }

    async loadInitialData() {
        await Promise.all([
            this.loadStatistics(),
            this.loadTimeline(),
            this.loadSpendingAnalytics(),
            this.loadCompetitionAnalysis()
        ]);
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/bid-statistics', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.updateStatisticsCards(stats);
                this.updateWinLossChart(stats);
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    updateStatisticsCards(stats) {
        document.getElementById('totalBids').textContent = stats.total_bids || 0;
        document.getElementById('totalSpent').textContent = `$${(stats.total_spent || 0).toFixed(2)}`;
        document.getElementById('wonAuctions').textContent = stats.won_auctions || 0;
        
        const winRate = stats.won_auctions > 0 && stats.lost_auctions > 0 
            ? ((stats.won_auctions / (stats.won_auctions + stats.lost_auctions)) * 100).toFixed(1)
            : '0.0';
        document.getElementById('winRate').textContent = `${winRate}%`;
    }

    async loadTimeline() {
        try {
            const response = await fetch(`/api/timeline-data?limit=20&offset=${this.timelineOffset}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const timelineData = await response.json();
                this.renderTimeline(timelineData);
            }
        } catch (error) {
            console.error('Failed to load timeline:', error);
            document.getElementById('timelineContainer').innerHTML = `
                <div class="text-center py-8">
                    <p class="text-red-500">Failed to load timeline data</p>
                </div>
            `;
        }
    }

    renderTimeline(data) {
        const container = document.getElementById('timelineContainer');
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-inbox text-gray-300 text-4xl mb-4"></i>
                    <p class="text-gray-500">No bid history available</p>
                </div>
            `;
            return;
        }

        const timelineHTML = data.map(item => {
            const date = new Date(item.timestamp);
            const resultClass = item.result === 'won' ? 'won' : item.result === 'lost' ? 'lost' : 'pending';
            const resultIcon = item.result === 'won' ? 'fa-trophy' : item.result === 'lost' ? 'fa-times' : 'fa-clock';
            const resultColor = item.result === 'won' ? 'text-green-600' : item.result === 'lost' ? 'text-red-600' : 'text-yellow-600';
            
            return `
                <div class="timeline-item animate-fade-in">
                    <div class="timeline-dot ${resultClass}"></div>
                    <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h4 class="font-semibold text-gray-800">${item.auction_title}</h4>
                                <p class="text-sm text-gray-500">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</p>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="text-lg font-bold text-purple-600">$${item.amount.toFixed(2)}</span>
                                <i class="fas ${resultIcon} ${resultColor}"></i>
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="px-2 py-1 bg-gray-200 rounded-full text-gray-700 capitalize">${item.result}</span>
                            <span class="text-gray-500">Auction Status: ${item.auction_status}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (this.timelineOffset === 0) {
            container.innerHTML = timelineHTML;
        } else {
            container.insertAdjacentHTML('beforeend', timelineHTML);
        }
    }

    async loadSpendingAnalytics(period = 'monthly') {
        try {
            const response = await fetch(`/api/spending-analytics?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateSpendingChart(data);
            }
        } catch (error) {
            console.error('Failed to load spending analytics:', error);
        }
    }

    updateSpendingChart(data) {
        const ctx = document.getElementById('spendingChart').getContext('2d');
        
        if (this.charts.spending) {
            this.charts.spending.destroy();
        }

        const labels = data.map(d => d.period).reverse();
        const spendingData = data.map(d => d.total_spent || 0).reverse();
        const bidCountData = data.map(d => d.bid_count || 0).reverse();

        this.charts.spending = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Spent ($)',
                    data: spendingData,
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                }, {
                    label: 'Number of Bids',
                    data: bidCountData,
                    borderColor: 'rgb(234, 88, 12)',
                    backgroundColor: 'rgba(234, 88, 12, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Bid Count'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                }
            }
        });
    }

    updateWinLossChart(stats) {
        const ctx = document.getElementById('winLossChart').getContext('2d');
        
        if (this.charts.winLoss) {
            this.charts.winLoss.destroy();
        }

        const won = stats.won_auctions || 0;
        const lost = stats.lost_auctions || 0;
        const pending = (stats.total_bids || 0) - won - lost;

        this.charts.winLoss = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Won', 'Lost', 'Pending'],
                datasets: [{
                    data: [won, lost, pending],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(245, 158, 11, 0.8)'
                    ],
                    borderColor: [
                        'rgb(16, 185, 129)',
                        'rgb(239, 68, 68)',
                        'rgb(245, 158, 11)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    async loadCompetitionAnalysis() {
        try {
            const response = await fetch('/api/competition-analysis', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateCompetitionChart(data);
            }
        } catch (error) {
            console.error('Failed to load competition analysis:', error);
        }
    }

    updateCompetitionChart(data) {
        const ctx = document.getElementById('competitionChart').getContext('2d');
        
        if (this.charts.competition) {
            this.charts.competition.destroy();
        }

        const labels = data.slice(0, 10).map(d => d.username);
        const bidCounts = data.slice(0, 10).map(d => d.bid_count);
        const totalSpent = data.slice(0, 10).map(d => d.total_spent);

        this.charts.competition = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Bids',
                    data: bidCounts,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgb(102, 126, 234)',
                    borderWidth: 1
                }, {
                    label: 'Total Spent ($)',
                    data: totalSpent,
                    backgroundColor: 'rgba(234, 88, 12, 0.8)',
                    borderColor: 'rgb(234, 88, 12)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Bid Count'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Spent ($)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Filter changes
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFromFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateToFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('sortByFilter').addEventListener('change', () => this.applyFilters());
    }

    async applyFilters() {
        this.filters = {
            status: document.getElementById('statusFilter').value,
            dateFrom: document.getElementById('dateFromFilter').value,
            dateTo: document.getElementById('dateToFilter').value,
            sortBy: document.getElementById('sortByFilter').value,
            sortOrder: 'DESC'
        };

        this.timelineOffset = 0;
        await this.loadTimeline();
        await this.loadStatistics();
    }

    resetFilters() {
        document.getElementById('statusFilter').value = '';
        document.getElementById('dateFromFilter').value = '';
        document.getElementById('dateToFilter').value = '';
        document.getElementById('sortByFilter').value = 'timestamp';
        
        this.filters = {};
        this.timelineOffset = 0;
        this.loadInitialData();
    }

    async loadMoreTimeline() {
        this.timelineOffset += 20;
        await this.loadTimeline();
    }

    async exportData(format) {
        try {
            const params = new URLSearchParams({
                format: format,
                ...this.filters
            });

            const response = await fetch(`/api/export-bid-history?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bid-history-${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export data. Please try again.');
        }
    }
}

// Global functions for button clicks
window.updateSpendingChart = function(period) {
    analytics.loadSpendingAnalytics(period);
};

window.applyFilters = function() {
    analytics.applyFilters();
};

window.resetFilters = function() {
    analytics.resetFilters();
};

window.loadMoreTimeline = function() {
    analytics.loadMoreTimeline();
};

window.exportData = function(format) {
    analytics.exportData(format);
};

// Initialize analytics when DOM is loaded
let analytics;
document.addEventListener('DOMContentLoaded', () => {
    analytics = new BidAnalytics();
});
