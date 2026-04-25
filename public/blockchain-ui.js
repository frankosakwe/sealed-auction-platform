/**
 * Blockchain Integration UI - Issue #113
 * User interface for blockchain interactions including wallet connection,
 * transaction monitoring, balance display, gas fee estimation, and network status.
 */

const BlockchainUI = (() => {
  const STELLAR_HORIZON = 'https://horizon-testnet.stellar.org';
  let walletKeypair = null;
  let monitorInterval = null;
  let transactions = [];

  // --- Wallet Connection ---
  async function connectWallet(secretKey) {
    try {
      const keypair = StellarSdk.Keypair.fromSecret(secretKey.trim());
      walletKeypair = keypair;
      localStorage.setItem('blockchain_wallet_pub', keypair.publicKey());
      await refreshBalance();
      renderWalletConnected();
      startTransactionMonitor();
      showStatus('Wallet connected successfully!', 'success');
      return true;
    } catch (err) {
      showStatus('Invalid secret key. Please check and try again.', 'error');
      return false;
    }
  }

  function disconnectWallet() {
    walletKeypair = null;
    localStorage.removeItem('blockchain_wallet_pub');
    stopTransactionMonitor();
    transactions = [];
    renderWalletDisconnected();
    showStatus('Wallet disconnected.', 'info');
  }

  // --- Balance ---
  async function refreshBalance() {
    if (!walletKeypair) return;
    const pubKey = walletKeypair.publicKey();
    try {
      const resp = await fetch(`${STELLAR_HORIZON}/accounts/${pubKey}`);
      if (!resp.ok) throw new Error('Account not found');
      const data = await resp.json();
      const xlmBalance = data.balances.find(b => b.asset_type === 'native');
      const balance = xlmBalance ? parseFloat(xlmBalance.balance).toFixed(2) : '0.00';
      updateElement('blockchain-balance', `${balance} XLM`);
      updateElement('blockchain-pubkey', `${pubKey.substring(0, 8)}...${pubKey.substring(pubKey.length - 8)}`);
      return balance;
    } catch {
      updateElement('blockchain-balance', 'Account not funded');
      return null;
    }
  }

  // --- Network Status ---
  async function checkNetworkStatus() {
    try {
      const start = Date.now();
      const resp = await fetch(`${STELLAR_HORIZON}/`);
      const latency = Date.now() - start;
      if (resp.ok) {
        const data = await resp.json();
        updateElement('network-status-dot', '', el => {
          el.className = 'w-3 h-3 rounded-full bg-green-400 animate-pulse';
        });
        updateElement('network-status-text', `Testnet · ${latency}ms`);
        updateElement('network-ledger', `Ledger: ${data.history_latest_ledger || 'N/A'}`);
      }
    } catch {
      updateElement('network-status-dot', '', el => {
        el.className = 'w-3 h-3 rounded-full bg-red-400';
      });
      updateElement('network-status-text', 'Offline');
    }
  }

  // --- Fee Estimation ---
  async function estimateFee() {
    try {
      const resp = await fetch(`${STELLAR_HORIZON}/fee_stats`);
      const data = await resp.json();
      const fee = data.fee_charged ? data.fee_charged.p50 : '100';
      updateElement('fee-estimate', `~${fee} stroops (${(fee / 1e7).toFixed(7)} XLM)`);
    } catch {
      updateElement('fee-estimate', '~100 stroops (0.0000100 XLM)');
    }
  }

  // --- Transaction Monitor ---
  async function fetchTransactions() {
    if (!walletKeypair) return;
    const pubKey = walletKeypair.publicKey();
    try {
      const resp = await fetch(`${STELLAR_HORIZON}/accounts/${pubKey}/transactions?limit=10&order=desc`);
      if (!resp.ok) return;
      const data = await resp.json();
      transactions = (data._embedded?.records || []).map(tx => ({
        id: tx.id,
        hash: tx.hash,
        created: tx.created_at,
        fee: tx.fee_charged,
        successful: tx.successful,
        memo: tx.memo || ''
      }));
      renderTransactions();
    } catch { /* network error */ }
  }

  function startTransactionMonitor() {
    fetchTransactions();
    monitorInterval = setInterval(fetchTransactions, 15000);
  }

  function stopTransactionMonitor() {
    if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  }

  // --- UI Helpers ---
  function updateElement(id, text, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    if (fn) fn(el);
    else el.textContent = text;
  }

  function showStatus(msg, type) {
    const el = document.getElementById('blockchain-status-msg');
    if (!el) return;
    const colors = { success: 'text-green-400', error: 'text-red-400', info: 'text-blue-400' };
    el.className = `text-sm mt-2 ${colors[type] || 'text-gray-400'}`;
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function renderWalletConnected() {
    const connectSection = document.getElementById('wallet-connect-section');
    const walletInfo = document.getElementById('wallet-info-section');
    if (connectSection) connectSection.classList.add('hidden');
    if (walletInfo) walletInfo.classList.remove('hidden');
  }

  function renderWalletDisconnected() {
    const connectSection = document.getElementById('wallet-connect-section');
    const walletInfo = document.getElementById('wallet-info-section');
    if (connectSection) connectSection.classList.remove('hidden');
    if (walletInfo) walletInfo.classList.add('hidden');
    updateElement('blockchain-balance', '--');
    updateElement('blockchain-pubkey', '--');
    const txList = document.getElementById('tx-list');
    if (txList) txList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Connect wallet to view transactions</p>';
  }

  function renderTransactions() {
    const el = document.getElementById('tx-list');
    if (!el) return;
    if (transactions.length === 0) {
      el.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No transactions found</p>';
      return;
    }
    el.innerHTML = transactions.map(tx => `
      <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-2">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center ${tx.successful ? 'bg-green-600' : 'bg-red-600'}">
            <i class="fas ${tx.successful ? 'fa-check' : 'fa-times'} text-xs text-white"></i>
          </div>
          <div>
            <p class="text-sm font-mono">${tx.hash.substring(0, 16)}...</p>
            <p class="text-xs text-gray-400">${new Date(tx.created).toLocaleString()}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400">Fee: ${tx.fee} stroops</p>
          <a href="https://stellar.expert/explorer/testnet/tx/${tx.hash}" target="_blank" rel="noopener"
             class="text-xs text-purple-400 hover:text-purple-300">View <i class="fas fa-external-link-alt"></i></a>
        </div>
      </div>`).join('');
  }

  function init() {
    checkNetworkStatus();
    estimateFee();
    setInterval(checkNetworkStatus, 30000);
    // Restore wallet from localStorage (public key only for display)
    const savedPub = localStorage.getItem('blockchain_wallet_pub');
    if (savedPub) {
      updateElement('blockchain-pubkey', `${savedPub.substring(0, 8)}...${savedPub.substring(savedPub.length - 8)}`);
    }
  }

  return { connectWallet, disconnectWallet, refreshBalance, init };
})();

// Inject Blockchain UI tab on load
document.addEventListener('DOMContentLoaded', () => {
  // Add tab button
  const tabNav = document.querySelector('.glass-effect.rounded-xl.p-1.mb-8');
  if (tabNav) {
    const btn = document.createElement('button');
    btn.id = 'blockchainTab';
    btn.className = 'tab-btn px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base';
    btn.setAttribute('onclick', "switchTab('blockchain')");
    btn.innerHTML = '<i class="fas fa-link mr-1 sm:mr-2"></i><span class="hidden sm:inline">Block</span>chain';
    tabNav.appendChild(btn);
  }

  // Add tab content
  const tabContent = document.createElement('div');
  tabContent.id = 'blockchainContent';
  tabContent.className = 'tab-content hidden';
  tabContent.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Network Status Card -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-4"><i class="fas fa-network-wired mr-2 text-blue-400"></i>Network Status</h3>
        <div class="flex items-center space-x-2 mb-3">
          <div id="network-status-dot" class="w-3 h-3 rounded-full bg-gray-400"></div>
          <span id="network-status-text" class="text-sm">Checking...</span>
        </div>
        <p id="network-ledger" class="text-xs text-gray-400 mb-3">Ledger: --</p>
        <div class="border-t border-white/10 pt-3">
          <p class="text-xs text-gray-400 mb-1">Estimated Fee</p>
          <p id="fee-estimate" class="text-sm font-mono">Loading...</p>
        </div>
        <button onclick="BlockchainUI.init()"
          class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <i class="fas fa-sync-alt mr-1"></i>Refresh Status
        </button>
      </div>

      <!-- Wallet Connection Card -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-4"><i class="fas fa-wallet mr-2 text-yellow-400"></i>Wallet</h3>

        <div id="wallet-connect-section">
          <p class="text-sm text-gray-400 mb-3">Connect your Stellar wallet to view balance and transactions.</p>
          <div class="space-y-3">
            <input id="wallet-secret-input" type="password" placeholder="Enter Stellar secret key (S...)"
              class="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-sm font-mono focus:outline-none focus:border-purple-500"
              autocomplete="off">
            <button onclick="BlockchainUI.connectWallet(document.getElementById('wallet-secret-input').value)"
              class="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <i class="fas fa-plug mr-2"></i>Connect Wallet
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            <i class="fas fa-shield-alt mr-1"></i>Your key is never sent to the server
          </p>
        </div>

        <div id="wallet-info-section" class="hidden">
          <div class="space-y-3">
            <div class="bg-white/5 rounded-lg p-3">
              <p class="text-xs text-gray-400">Public Key</p>
              <p id="blockchain-pubkey" class="text-sm font-mono mt-1">--</p>
            </div>
            <div class="bg-white/5 rounded-lg p-3">
              <p class="text-xs text-gray-400">Balance</p>
              <p id="blockchain-balance" class="text-xl font-bold text-yellow-400 mt-1">--</p>
            </div>
            <div class="flex space-x-2">
              <button onclick="BlockchainUI.refreshBalance()"
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <i class="fas fa-sync-alt mr-1"></i>Refresh
              </button>
              <button onclick="BlockchainUI.disconnectWallet()"
                class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <i class="fas fa-unlink mr-1"></i>Disconnect
              </button>
            </div>
          </div>
        </div>

        <p id="blockchain-status-msg" class="text-sm mt-2"></p>
      </div>

      <!-- Transaction Monitor Card -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-4"><i class="fas fa-history mr-2 text-green-400"></i>Transactions</h3>
        <div id="tx-list">
          <p class="text-gray-400 text-sm text-center py-4">Connect wallet to view transactions</p>
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

  BlockchainUI.init();
});
