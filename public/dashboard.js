class AuctionDashboard {
    constructor() {
        this.socket = io();
        this.charts = {};
        this.data = {
            auctions: [],
            bids: [],
            revenue: []
        };
        this.filters = {
            dateRange: 30,
            status: 'all',
            minBid: 0,
            maxBid: 10000
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupSocketListeners();
        this.showLoading();
        this.fetchData();
    }
    
    setupEventListeners() {
        // Filter controls
        document.getElementById('dateRange').addEventListener('change', (e) => {
            this.filters.dateRange = e.target.value;
            this.refreshDashboard();
        });
        
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.refreshDashboard();
        });
        
        document.getElementById('minBid').addEventListener('change', (e) => {
            this.filters.minBid = parseFloat(e.target.value) || 0;
            this.refreshDashboard();
        });
        
        document.getElementById('maxBid').addEventListener('change', (e) => {
            this.filters.maxBid = parseFloat(e.target.value) || 10000;
            this.refreshDashboard();
        });
        
        // Button controls
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshDashboard();
        });
        
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.exportToPDF();
        });
        
        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportToCSV();
        });
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server for real-time updates');
            this.socket.emit('joinDashboard');
        });
        
        this.socket.on('auction_update', (data) => {
            console.log('Real-time auction update:', data);
            this.handleRealtimeUpdate(data);
        });
        
        this.socket.on('bid_update', (data) => {
            console.log('Real-time bid update:', data);
            this.handleRealtimeUpdate(data);
        });
    }
    
    async fetchData() {
        try {
            const response = await fetch('/api/dashboard/data');
            const data = await response.json();
            
            if (data.success) {
                this.data = data.data;
                this.updateDashboard();
            } else {
                console.error('Failed to fetch dashboard data:', data.error);
                this.showError('Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            this.showError('Network error while loading dashboard');
        } finally {
            this.hideLoading();
        }
    }
    
    refreshDashboard() {
        this.showLoading();
        this.fetchData();
    }
    
    handleRealtimeUpdate(update) {
        // Update local data
        if (update.type === 'auction') {
            const index = this.data.auctions.findIndex(a => a.id === update.data.id);
            if (index !== -1) {
                this.data.auctions[index] = { ...this.data.auctions[index], ...update.data };
            } else {
                this.data.auctions.push(update.data);
            }
        } else if (update.type === 'bid') {
            const index = this.data.bids.findIndex(b => b.id === update.data.id);
            if (index !== -1) {
                this.data.bids[index] = { ...this.data.bids[index], ...update.data };
            } else {
                this.data.bids.push(update.data);
            }
        }
        
        // Update dashboard without showing loading
        this.updateDashboard(false);
    }
    
    getFilteredData() {
        const now = new Date();
        const dateFilter = this.filters.dateRange === 'all' 
            ? null 
            : new Date(now.getTime() - (this.filters.dateRange * 24 * 60 * 60 * 1000));
        
        const filteredAuctions = this.data.auctions.filter(auction => {
            // Date filter
            if (dateFilter && new Date(auction.created_at) < dateFilter) {
                return false;
            }
            
            // Status filter
            if (this.filters.status !== 'all' && auction.status !== this.filters.status) {
                return false;
            }
            
            return true;
        });
        
        const auctionIds = filteredAuctions.map(a => a.id);
        const filteredBids = this.data.bids.filter(bid => {
            if (!auctionIds.includes(bid.auction_id)) return false;
            
            // Bid amount filter
            if (bid.amount < this.filters.minBid || bid.amount > this.filters.maxBid) {
                return false;
            }
            
            return true;
        });
        
        return {
            auctions: filteredAuctions,
            bids: filteredBids,
            revenue: this.data.revenue.filter(r => auctionIds.includes(r.auction_id))
        };
    }
    
    updateDashboard(showLoading = true) {
        if (showLoading) this.showLoading();
        
        const filteredData = this.getFilteredData();
        
        this.updateStats(filteredData);
        this.updateCharts(filteredData);
        this.updateTopAuctionsTable(filteredData);
        
        if (showLoading) this.hideLoading();
    }
    
    updateStats(data) {
        // Update stats cards
        document.getElementById('totalAuctions').textContent = data.auctions.length.toLocaleString();
        document.getElementById('activeAuctions').textContent = 
            data.auctions.filter(a => a.status === 'active').length.toLocaleString();
        document.getElementById('totalBids').textContent = data.bids.length.toLocaleString();
        
        const totalRevenue = data.revenue
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + r.amount, 0);
        
        document.getElementById('totalRevenue').textContent = 
            '$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    updateCharts(data) {
        this.updateAuctionTrendsChart(data);
        this.updateBidDistributionChart(data);
        this.updateRevenueChart(data);
        this.updateStatusChart(data);
    }
    
    updateAuctionTrendsChart(data) {
        const ctx = document.getElementById('auctionTrendsChart').getContext('2d');
        
        // Group auctions by date
        const auctionCounts = {};
        const bidCounts = {};
        
        data.auctions.forEach(auction => {
            const date = new Date(auction.created_at).toLocaleDateString();
            auctionCounts[date] = (auctionCounts[date] || 0) + 1;
        });
        
        data.bids.forEach(bid => {
            const date = new Date(bid.timestamp).toLocaleDateString();
            bidCounts[date] = (bidCounts[date] || 0) + 1;
        });
        
        const labels = Object.keys(auctionCounts).sort();
        const auctionData = labels.map(date => auctionCounts[date] || 0);
        const bidData = labels.map(date => bidCounts[date] || 0);
        
        if (this.charts.auctionTrends) {
            this.charts.auctionTrends.destroy();
        }
        
        this.charts.auctionTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Auctions Created',
                    data: auctionData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1
                }, {
                    label: 'Bids Placed',
                    data: bidData,
                    borderColor: 'rgb(168, 85, 247)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    updateBidDistributionChart(data) {
        const ctx = document.getElementById('bidDistributionChart').getContext('2d');
        
        // Create bid amount ranges
        const ranges = [
            { label: '$0-$100', min: 0, max: 100 },
            { label: '$100-$500', min: 100, max: 500 },
            { label: '$500-$1000', min: 500, max: 1000 },
            { label: '$1000-$5000', min: 1000, max: 5000 },
            { label: '$5000+', min: 5000, max: Infinity }
        ];
        
        const distribution = ranges.map(range => {
            return data.bids.filter(bid => bid.amount >= range.min && bid.amount < range.max).length;
        });
        
        if (this.charts.bidDistribution) {
            this.charts.bidDistribution.destroy();
        }
        
        this.charts.bidDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ranges.map(r => r.label),
                datasets: [{
                    label: 'Number of Bids',
                    data: distribution,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(251, 191, 36, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(139, 92, 246, 0.8)'
                    ]
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
    }
    
    updateRevenueChart(data) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        // Group revenue by date
        const revenueByDate = {};
        
        data.revenue
            .filter(r => r.status === 'completed')
            .forEach(revenue => {
                const date = new Date(revenue.created_at).toLocaleDateString();
                revenueByDate[date] = (revenueByDate[date] || 0) + revenue.amount;
            });
        
        const labels = Object.keys(revenueByDate).sort();
        const revenueData = labels.map(date => revenueByDate[date]);
        
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Revenue',
                    data: revenueData,
                    borderColor: 'rgb(251, 191, 36)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateStatusChart(data) {
        const ctx = document.getElementById('statusChart').getContext('2d');
        
        const statusCounts = {
            active: data.auctions.filter(a => a.status === 'active').length,
            closed: data.auctions.filter(a => a.status === 'closed').length,
            cancelled: data.auctions.filter(a => a.status === 'cancelled').length
        };
        
        if (this.charts.status) {
            this.charts.status.destroy();
        }
        
        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Closed', 'Cancelled'],
                datasets: [{
                    data: [statusCounts.active, statusCounts.closed, statusCounts.cancelled],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }
    
    updateTopAuctionsTable(data) {
        const tbody = document.getElementById('topAuctionsTable');
        
        // Sort auctions by number of bids
        const topAuctions = data.auctions
            .map(auction => {
                const bidCount = data.bids.filter(b => b.auction_id === auction.id).length;
                const highestBid = Math.max(...data.bids
                    .filter(b => b.auction_id === auction.id)
                    .map(b => b.amount), 0);
                
                return {
                    ...auction,
                    bidCount,
                    highestBid
                };
            })
            .sort((a, b) => b.bidCount - a.bidCount)
            .slice(0, 10);
        
        tbody.innerHTML = topAuctions.map(auction => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${auction.title}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${auction.status === 'active' ? 'bg-green-100 text-green-800' : 
                          auction.status === 'closed' ? 'bg-blue-100 text-blue-800' : 
                          'bg-red-100 text-red-800'}">
                        ${auction.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${auction.bidCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    $${auction.highestBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(auction.created_at).toLocaleDateString()}
                </td>
            </tr>
        `).join('');
    }
    
    exportToPDF() {
        this.showLoading();
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(20);
        doc.text('Auction Analytics Dashboard', 20, 20);
        
        // Add date
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
        
        // Add stats
        const filteredData = this.getFilteredData();
        doc.setFontSize(14);
        doc.text('Summary Statistics', 20, 45);
        
        doc.setFontSize(10);
        doc.text(`Total Auctions: ${filteredData.auctions.length}`, 20, 55);
        doc.text(`Active Auctions: ${filteredData.auctions.filter(a => a.status === 'active').length}`, 20, 62);
        doc.text(`Total Bids: ${filteredData.bids.length}`, 20, 69);
        
        const totalRevenue = filteredData.revenue
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + r.amount, 0);
        doc.text(`Total Revenue: $${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, 76);
        
        // Save the PDF
        doc.save('auction-dashboard.pdf');
        this.hideLoading();
    }
    
    exportToCSV() {
        this.showLoading();
        
        const filteredData = this.getFilteredData();
        
        // Prepare CSV data
        const csvData = [
            ['Auction Title', 'Status', 'Total Bids', 'Highest Bid', 'Created Date'],
            ...filteredData.auctions.map(auction => {
                const bidCount = filteredData.bids.filter(b => b.auction_id === auction.id).length;
                const highestBid = Math.max(...filteredData.bids
                    .filter(b => b.auction_id === auction.id)
                    .map(b => b.amount), 0);
                
                return [
                    auction.title,
                    auction.status,
                    bidCount,
                    highestBid,
                    new Date(auction.created_at).toLocaleDateString()
                ];
            })
        ];
        
        // Convert to CSV string
        const csvString = Papa.unparse(csvData);
        
        // Download CSV file
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'auction-dashboard.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.hideLoading();
    }
    
    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
    
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 5000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuctionDashboard();
});
