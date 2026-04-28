/**
 * Token Management Interface - Issue #115
 * Comprehensive token management system for creating, transferring, and managing auction tokens
 */

const TokenManagement = (() => {
  let currentTokens = [];
  let userPortfolio = [];
  let selectedToken = null;
  let currentPage = 1;
  let itemsPerPage = 20;

  // Initialize token management
  async function initialize() {
    await loadTokens();
    await loadUserPortfolio();
    setupEventListeners();
    renderTokenManagement();
  }

  // Load all tokens
  async function loadTokens() {
    try {
      const response = await fetch('/api/tokens');
      const data = await response.json();
      currentTokens = data.tokens || [];
      return currentTokens;
    } catch (error) {
      console.error('Error loading tokens:', error);
      showStatus('Failed to load tokens', 'error');
      return [];
    }
  }

  // Load user portfolio
  async function loadUserPortfolio() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return [];

      const response = await fetch('/api/tokens/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      userPortfolio = data.portfolio || [];
      return userPortfolio;
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return [];
    }
  }

  // Create new token
  async function createToken(tokenData) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showStatus('Please login to create tokens', 'error');
        return;
      }

      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tokenData)
      });

      const result = await response.json();
      
      if (response.ok) {
        showStatus('Token created successfully!', 'success');
        await loadTokens();
        await loadUserPortfolio();
        renderTokenList();
        closeTokenCreationModal();
        return result.token;
      } else {
        throw new Error(result.error || 'Failed to create token');
      }
    } catch (error) {
      console.error('Error creating token:', error);
      showStatus(error.message, 'error');
      return null;
    }
  }

  // Transfer tokens
  async function transferTokens(tokenId, transferData) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showStatus('Please login to transfer tokens', 'error');
        return;
      }

      const response = await fetch(`/api/tokens/${tokenId}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transferData)
      });

      const result = await response.json();
      
      if (response.ok) {
        showStatus('Transfer completed successfully!', 'success');
        await loadTokens();
        await loadUserPortfolio();
        renderTokenList();
        renderPortfolio();
        closeTransferModal();
        return result;
      } else {
        throw new Error(result.error || 'Failed to transfer tokens');
      }
    } catch (error) {
      console.error('Error transferring tokens:', error);
      showStatus(error.message, 'error');
      return null;
    }
  }

  // Approve token spending
  async function approveTokenSpending(tokenId, approvalData) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showStatus('Please login to approve token spending', 'error');
        return;
      }

      const response = await fetch(`/api/tokens/${tokenId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(approvalData)
      });

      const result = await response.json();
      
      if (response.ok) {
        showStatus('Token approval created successfully!', 'success');
        await loadTokenApprovals(tokenId);
        renderTokenApprovals();
        closeApprovalModal();
        return result;
      } else {
        throw new Error(result.error || 'Failed to create token approval');
      }
    } catch (error) {
      console.error('Error approving token spending:', error);
      showStatus(error.message, 'error');
      return null;
    }
  }

  // Get token details
  async function getTokenDetails(tokenId) {
    try {
      const response = await fetch(`/api/tokens/${tokenId}`);
      const data = await response.json();
      
      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to get token details');
      }
    } catch (error) {
      console.error('Error getting token details:', error);
      showStatus(error.message, 'error');
      return null;
    }
  }

  // Get token transfers
  async function getTokenTransfers(tokenId, filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/tokens/${tokenId}/transfers?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        return data.transfers;
      } else {
        throw new Error(data.error || 'Failed to get token transfers');
      }
    } catch (error) {
      console.error('Error getting token transfers:', error);
      showStatus(error.message, 'error');
      return [];
    }
  }

  // Get token history
  async function getTokenHistory(tokenId, filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/tokens/${tokenId}/history?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        return data.history;
      } else {
        throw new Error(data.error || 'Failed to get token history');
      }
    } catch (error) {
      console.error('Error getting token history:', error);
      showStatus(error.message, 'error');
      return [];
    }
  }

  // Get token balance
  async function getTokenBalance(tokenId) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return { balance: 0, frozenBalance: 0 };

      const response = await fetch(`/api/tokens/${tokenId}/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to get token balance');
      }
    } catch (error) {
      console.error('Error getting token balance:', error);
      return { balance: 0, frozenBalance: 0 };
    }
  }

  // Render token management interface
  function renderTokenManagement() {
    const container = document.getElementById('token-management-container');
    if (!container) return;

    container.innerHTML = `
      <div class="token-management">
        <!-- Header Section -->
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Token Management</h2>
          <div class="flex gap-3">
            <button onclick="TokenManagement.showTokenCreationModal()" 
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <i class="fas fa-plus mr-2"></i>Create Token
            </button>
            <button onclick="TokenManagement.refreshData()" 
                    class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              <i class="fas fa-refresh mr-2"></i>Refresh
            </button>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav class="flex space-x-8">
            <button onclick="TokenManagement.switchTab('tokens')" 
                    class="tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-blue-500 text-blue-600 dark:text-blue-400"
                    data-tab="tokens">
              <i class="fas fa-coins mr-2"></i>Tokens
            </button>
            <button onclick="TokenManagement.switchTab('portfolio')" 
                    class="tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    data-tab="portfolio">
              <i class="fas fa-wallet mr-2"></i>Portfolio
            </button>
            <button onclick="TokenManagement.switchTab('transfers')" 
                    class="tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    data-tab="transfers">
              <i class="fas fa-exchange-alt mr-2"></i>Transfers
            </button>
            <button onclick="TokenManagement.switchTab('approvals')" 
                    class="tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    data-tab="approvals">
              <i class="fas fa-check-circle mr-2"></i>Approvals
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div id="token-tabs-content">
          <!-- Tokens Tab -->
          <div id="tokens-tab" class="tab-content">
            <div id="token-list-container"></div>
          </div>

          <!-- Portfolio Tab -->
          <div id="portfolio-tab" class="tab-content hidden">
            <div id="portfolio-container"></div>
          </div>

          <!-- Transfers Tab -->
          <div id="transfers-tab" class="tab-content hidden">
            <div id="transfers-container"></div>
          </div>

          <!-- Approvals Tab -->
          <div id="approvals-tab" class="tab-content hidden">
            <div id="approvals-container"></div>
          </div>
        </div>
      </div>
    `;

    renderTokenList();
    renderPortfolio();
  }

  // Render token list
  function renderTokenList() {
    const container = document.getElementById('token-list-container');
    if (!container) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTokens = currentTokens.slice(startIndex, endIndex);

    container.innerHTML = `
      <!-- Search and Filter -->
      <div class="mb-6 flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <input type="text" 
                 id="token-search" 
                 placeholder="Search tokens..." 
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
        </div>
        <select id="token-status-filter" 
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <!-- Token Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        ${paginatedTokens.map(token => renderTokenCard(token)).join('')}
      </div>

      <!-- Pagination -->
      <div class="flex justify-center">
        <nav class="flex space-x-2">
          ${renderPagination(currentTokens.length, currentPage, itemsPerPage)}
        </nav>
      </div>
    `;

    // Setup search and filter handlers
    setupTokenFilters();
  }

  // Render individual token card
  function renderTokenCard(token) {
    const isInPortfolio = userPortfolio.some(p => p.id === token.id);
    
    return `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white">${token.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${token.symbol}</p>
          </div>
          <span class="px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(token.status)}">
            ${token.status}
          </span>
        </div>
        
        <p class="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">${token.description || 'No description'}</p>
        
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Total Supply:</span>
            <span class="font-medium text-gray-800 dark:text-white">${formatNumber(token.total_supply)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Circulating:</span>
            <span class="font-medium text-gray-800 dark:text-white">${formatNumber(token.circulating_supply)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Creator:</span>
            <span class="font-medium text-gray-800 dark:text-white">${token.creator_name || 'Unknown'}</span>
          </div>
        </div>
        
        <div class="mt-4 flex gap-2">
          <button onclick="TokenManagement.viewTokenDetails('${token.id}')" 
                  class="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
            <i class="fas fa-eye mr-1"></i>View
          </button>
          <button onclick="TokenManagement.showTransferModal('${token.id}')" 
                  class="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
            <i class="fas fa-exchange-alt mr-1"></i>Transfer
          </button>
          <button onclick="TokenManagement.showApprovalModal('${token.id}')" 
                  class="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors">
            <i class="fas fa-check mr-1"></i>Approve
          </button>
        </div>
      </div>
    `;
  }

  // Render portfolio
  function renderPortfolio() {
    const container = document.getElementById('portfolio-container');
    if (!container) return;

    if (userPortfolio.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <i class="fas fa-wallet text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Tokens in Portfolio</h3>
          <p class="text-gray-500 dark:text-gray-500">Start by creating or receiving tokens</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        ${userPortfolio.map(token => renderPortfolioToken(token)).join('')}
      </div>
    `;
  }

  // Render portfolio token
  function renderPortfolioToken(token) {
    const ownershipPercentage = (token.ownership_percentage || 0).toFixed(2);
    
    return `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white">${token.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${token.symbol}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${formatNumber(token.balance)}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${ownershipPercentage}% owned</p>
          </div>
        </div>
        
        <div class="space-y-2 text-sm mb-4">
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Frozen Balance:</span>
            <span class="font-medium text-gray-800 dark:text-white">${formatNumber(token.frozen_balance)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Total Supply:</span>
            <span class="font-medium text-gray-800 dark:text-white">${formatNumber(token.total_supply)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Value:</span>
            <span class="font-medium text-gray-800 dark:text-white">${formatNumber(token.balance * 1)} USD</span>
          </div>
        </div>
        
        <div class="flex gap-2">
          <button onclick="TokenManagement.showTransferModal('${token.id}')" 
                  class="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
            <i class="fas fa-exchange-alt mr-1"></i>Transfer
          </button>
          <button onclick="TokenManagement.showApprovalModal('${token.id}')" 
                  class="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors">
            <i class="fas fa-check mr-1"></i>Approve
          </button>
        </div>
      </div>
    `;
  }

  // Show token creation modal
  function showTokenCreationModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Create New Token</h3>
        
        <form id="token-creation-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token Name</label>
            <input type="text" 
                   name="name" 
                   required 
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
            <input type="text" 
                   name="symbol" 
                   required 
                   maxlength="10"
                   pattern="[A-Z0-9]+"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Uppercase letters and numbers only</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea name="description" 
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Supply</label>
            <input type="number" 
                   name="totalSupply" 
                   required 
                   min="1"
                   step="0.0000001"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Decimals</label>
            <input type="number" 
                   name="decimals" 
                   min="0" 
                   max="18" 
                   value="7"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="submit" 
                    class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Create Token
            </button>
            <button type="button" 
                    onclick="TokenManagement.closeTokenCreationModal()"
                    class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup form submission
    modal.querySelector('#token-creation-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const tokenData = {
        name: formData.get('name'),
        symbol: formData.get('symbol').toUpperCase(),
        description: formData.get('description'),
        totalSupply: parseFloat(formData.get('totalSupply')),
        decimals: parseInt(formData.get('decimals'))
      };
      
      await createToken(tokenData);
    });
  }

  // Show transfer modal
  function showTransferModal(tokenId) {
    const token = currentTokens.find(t => t.id === tokenId);
    if (!token) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Transfer ${token.symbol}</h3>
        
        <form id="transfer-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient User ID</label>
            <input type="text" 
                   name="toUserId" 
                   required 
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
            <input type="number" 
                   name="amount" 
                   required 
                   min="0.0000001"
                   step="0.0000001"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memo (Optional)</label>
            <textarea name="memo" 
                      rows="2"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="submit" 
                    class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Transfer
            </button>
            <button type="button" 
                    onclick="TokenManagement.closeTransferModal()"
                    class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup form submission
    modal.querySelector('#transfer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const transferData = {
        toUserId: formData.get('toUserId'),
        amount: parseFloat(formData.get('amount')),
        memo: formData.get('memo')
      };
      
      await transferTokens(tokenId, transferData);
    });
  }

  // Show approval modal
  function showApprovalModal(tokenId) {
    const token = currentTokens.find(t => t.id === tokenId);
    if (!token) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Approve ${token.symbol} Spending</h3>
        
        <form id="approval-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spender User ID</label>
            <input type="text" 
                   name="spenderId" 
                   required 
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allowance Amount</label>
            <input type="number" 
                   name="allowance" 
                   required 
                   min="0"
                   step="0.0000001"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (Optional)</label>
            <input type="datetime-local" 
                   name="expiresAt"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="submit" 
                    class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Approve
            </button>
            <button type="button" 
                    onclick="TokenManagement.closeApprovalModal()"
                    class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup form submission
    modal.querySelector('#approval-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const approvalData = {
        spenderId: formData.get('spenderId'),
        allowance: parseFloat(formData.get('allowance')),
        expiresAt: formData.get('expiresAt') || null
      };
      
      await approveTokenSpending(tokenId, approvalData);
    });
  }

  // View token details
  async function viewTokenDetails(tokenId) {
    const details = await getTokenDetails(tokenId);
    if (!details) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">${details.token.name} Details</h3>
          <button onclick="TokenManagement.closeTokenDetailsModal()" 
                  class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Token Information -->
          <div class="space-y-4">
            <div>
              <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Token Information</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Name:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.token.name}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Symbol:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.token.symbol}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Status:</span>
                  <span class="px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(details.token.status)}">
                    ${details.token.status}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Decimals:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.token.decimals}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Creator:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.token.creator_name || 'Unknown'}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Supply Information</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Total Supply:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${formatNumber(details.token.total_supply)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Circulating Supply:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${formatNumber(details.token.circulating_supply)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Holders:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.stats?.holder_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Statistics -->
          <div class="space-y-4">
            <div>
              <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Statistics</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Total Transfers:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.stats?.total_transfers || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Completed Transfers:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.stats?.completed_transfers || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Active Approvals:</span>
                  <span class="font-medium text-gray-800 dark:text-white">${details.stats?.active_approvals || 0}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
              <div class="space-y-2">
                <button onclick="TokenManagement.showTransferModal('${details.token.id}')" 
                        class="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                  <i class="fas fa-exchange-alt mr-2"></i>Transfer
                </button>
                <button onclick="TokenManagement.showApprovalModal('${details.token.id}')" 
                        class="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors">
                  <i class="fas fa-check mr-2"></i>Approve Spending
                </button>
                <button onclick="TokenManagement.viewTokenHistory('${details.token.id}')" 
                        class="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                  <i class="fas fa-history mr-2"></i>View History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // View token history
  async function viewTokenHistory(tokenId) {
    const history = await getTokenHistory(tokenId);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">Token History</h3>
          <button onclick="TokenManagement.closeHistoryModal()" 
                  class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b dark:border-gray-700">
                <th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Date</th>
                <th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Action</th>
                <th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300">User</th>
                <th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Amount</th>
                <th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Details</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(item => `
                <tr class="border-b dark:border-gray-700">
                  <td class="py-2 px-3 text-gray-600 dark:text-gray-400">${formatDate(item.created_at)}</td>
                  <td class="py-2 px-3">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${getActionColor(item.action_type)}">
                      ${item.action_type}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-gray-600 dark:text-gray-400">${item.user_name || 'Unknown'}</td>
                  <td class="py-2 px-3 text-gray-600 dark:text-gray-400">${formatNumber(item.amount)}</td>
                  <td class="py-2 px-3 text-gray-600 dark:text-gray-400">${item.details || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // Switch tabs
  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.className = 'tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-blue-500 text-blue-600 dark:text-blue-400';
      } else {
        btn.className = 'tab-btn py-2 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300';
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');

    // Load tab-specific data
    if (tabName === 'transfers') {
      renderTransfers();
    } else if (tabName === 'approvals') {
      renderApprovals();
    }
  }

  // Render transfers tab
  async function renderTransfers() {
    const container = document.getElementById('transfers-container');
    if (!container) return;

    // For now, show a placeholder - in a real implementation, you'd load transfers for all tokens
    container.innerHTML = `
      <div class="text-center py-12">
        <i class="fas fa-exchange-alt text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Transfer History</h3>
        <p class="text-gray-500 dark:text-gray-500">Select a token to view its transfer history</p>
      </div>
    `;
  }

  // Render approvals tab
  async function renderApprovals() {
    const container = document.getElementById('approvals-container');
    if (!container) return;

    // For now, show a placeholder - in a real implementation, you'd load approvals for all tokens
    container.innerHTML = `
      <div class="text-center py-12">
        <i class="fas fa-check-circle text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Token Approvals</h3>
        <p class="text-gray-500 dark:text-gray-500">Select a token to manage its approvals</p>
      </div>
    `;
  }

  // Helper functions
  function getStatusColor(status) {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
    };
    return colors[status] || colors.inactive;
  }

  function getActionColor(action) {
    const colors = {
      created: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
      minted: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      burned: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
      transferred: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
      approved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
      received: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200',
      frozen: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      unfrozen: 'bg-teal-100 text-teal-800 dark:bg-teal-800 dark:text-teal-200'
    };
    return colors[action] || colors.created;
  }

  function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return parseFloat(num).toLocaleString(undefined, { maximumFractionDigits: 7 });
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function renderPagination(totalItems, currentPage, itemsPerPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let pagination = '';

    // Previous button
    pagination += `
      <button onclick="TokenManagement.goToPage(${currentPage - 1})" 
              ${currentPage === 1 ? 'disabled' : ''}
              class="px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'} border border-gray-300 dark:border-gray-600">
        <i class="fas fa-chevron-left"></i>
      </button>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pagination += `
          <button onclick="TokenManagement.goToPage(${i})" 
                  class="px-3 py-1 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'} border border-gray-300 dark:border-gray-600">
            ${i}
          </button>
        `;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pagination += `<span class="px-2 py-1">...</span>`;
      }
    }

    // Next button
    pagination += `
      <button onclick="TokenManagement.goToPage(${currentPage + 1})" 
              ${currentPage === totalPages ? 'disabled' : ''}
              class="px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'} border border-gray-300 dark:border-gray-600">
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

    return pagination;
  }

  function setupTokenFilters() {
    const searchInput = document.getElementById('token-search');
    const statusFilter = document.getElementById('token-status-filter');

    if (searchInput) {
      searchInput.addEventListener('input', filterTokens);
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', filterTokens);
    }
  }

  function filterTokens() {
    const searchTerm = document.getElementById('token-search')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('token-status-filter')?.value || '';

    const filteredTokens = currentTokens.filter(token => {
      const matchesSearch = token.name.toLowerCase().includes(searchTerm) || 
                           token.symbol.toLowerCase().includes(searchTerm) ||
                           (token.description && token.description.toLowerCase().includes(searchTerm));
      const matchesStatus = !statusFilter || token.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Update display with filtered results
    const container = document.getElementById('token-list-container');
    if (container) {
      const startIndex = 0;
      const endIndex = startIndex + itemsPerPage;
      const paginatedTokens = filteredTokens.slice(startIndex, endIndex);

      container.querySelector('.grid').innerHTML = paginatedTokens.map(token => renderTokenCard(token)).join('');
    }
  }

  function setupEventListeners() {
    // Add any global event listeners here
  }

  function goToPage(page) {
    currentPage = page;
    renderTokenList();
  }

  async function refreshData() {
    showStatus('Refreshing data...', 'info');
    await loadTokens();
    await loadUserPortfolio();
    renderTokenList();
    renderPortfolio();
    showStatus('Data refreshed successfully', 'success');
  }

  // Modal close functions
  function closeTokenCreationModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
  }

  function closeTransferModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
  }

  function closeApprovalModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
  }

  function closeTokenDetailsModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
  }

  function closeHistoryModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
  }

  function showStatus(message, type = 'info') {
    // Use existing status display function if available
    if (typeof showStatus === 'function') {
      showStatus(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Public API
  return {
    initialize,
    createToken,
    transferTokens,
    approveTokenSpending,
    viewTokenDetails,
    showTokenCreationModal,
    showTransferModal,
    showApprovalModal,
    closeTokenCreationModal,
    closeTransferModal,
    closeApprovalModal,
    closeTokenDetailsModal,
    closeHistoryModal,
    switchTab,
    goToPage,
    refreshData,
    viewTokenHistory,
    loadTokens,
    loadUserPortfolio
  };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('token-management-container')) {
    TokenManagement.initialize();
  }
});

// Make available globally
window.TokenManagement = TokenManagement;
