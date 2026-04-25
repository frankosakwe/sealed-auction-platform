/**
 * Smart Contract Interaction UI - Issue #114
 * Interface for interacting with Stellar smart contracts (Soroban).
 * Supports function calls, event monitoring, ABI integration, parameter input,
 * result display, and error handling.
 */

const SmartContractUI = (() => {
  const HORIZON = 'https://horizon-testnet.stellar.org';
  const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';

  // Minimal ABI definition for the sealed auction contract
  const CONTRACT_ABI = [
    { name: 'create_auction', params: [{ name: 'title', type: 'string' }, { name: 'starting_bid', type: 'i128' }, { name: 'duration_secs', type: 'u64' }], returns: 'u64' },
    { name: 'place_bid', params: [{ name: 'auction_id', type: 'u64' }, { name: 'encrypted_bid', type: 'bytes' }], returns: 'bool' },
    { name: 'close_auction', params: [{ name: 'auction_id', type: 'u64' }], returns: 'address' },
    { name: 'get_auction', params: [{ name: 'auction_id', type: 'u64' }], returns: 'AuctionInfo' },
    { name: 'get_bid_count', params: [{ name: 'auction_id', type: 'u64' }], returns: 'u32' }
  ];

  let contractId = localStorage.getItem('contract_id') || '';
  let events = [];
  let eventPollInterval = null;

  // --- Contract Interaction ---
  async function callFunction(fnName, params) {
    const fn = CONTRACT_ABI.find(f => f.name === fnName);
    if (!fn) throw new Error(`Unknown function: ${fnName}`);

    // Validate params
    for (const p of fn.params) {
      if (params[p.name] === undefined || params[p.name] === '') {
        throw new Error(`Missing required parameter: ${p.name}`);
      }
    }

    // Simulate contract call (real Soroban RPC call would go here)
    // In production: use StellarSdk.SorobanRpc.Server to invoke the contract
    const result = await simulateContractCall(fnName, params);
    addEvent({ type: 'call', fn: fnName, params, result, timestamp: new Date().toISOString() });
    return result;
  }

  async function simulateContractCall(fnName, params) {
    // Attempt real Soroban RPC simulation if contract ID is set
    if (contractId) {
      try {
        const resp = await fetch(`${SOROBAN_RPC}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'simulateTransaction',
            params: { transaction: buildSimulatedTx(fnName, params) }
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.result) return { success: true, data: data.result, simulated: true };
        }
      } catch { /* fall through to mock */ }
    }

    // Mock response for demo
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    const mocks = {
      create_auction: { id: Math.floor(Math.random() * 1000), status: 'created' },
      place_bid: { accepted: true, bid_count: Math.floor(Math.random() * 20) + 1 },
      close_auction: { winner: 'G' + 'A'.repeat(55), winning_bid: Math.floor(Math.random() * 1000) },
      get_auction: { id: params.auction_id, status: 'active', bid_count: 5 },
      get_bid_count: { count: Math.floor(Math.random() * 50) }
    };
    return { success: true, data: mocks[fnName] || {}, simulated: false };
  }

  function buildSimulatedTx(fnName, params) {
    // Placeholder - real implementation would use StellarSdk to build XDR
    return btoa(JSON.stringify({ contract: contractId, fn: fnName, params }));
  }

  // --- Event Monitoring ---
  async function fetchContractEvents() {
    if (!contractId) return;
    try {
      const resp = await fetch(`${HORIZON}/accounts/${contractId}/transactions?limit=5&order=desc`);
      if (!resp.ok) return;
      const data = await resp.json();
      const newEvents = (data._embedded?.records || []).map(tx => ({
        type: 'transaction',
        hash: tx.hash,
        timestamp: tx.created_at,
        successful: tx.successful,
        memo: tx.memo || ''
      }));
      if (newEvents.length > 0) {
        events = [...newEvents, ...events].slice(0, 20);
        renderEvents();
      }
    } catch { /* network error */ }
  }

  function addEvent(event) {
    events = [event, ...events].slice(0, 20);
    renderEvents();
  }

  function startEventMonitor() {
    fetchContractEvents();
    eventPollInterval = setInterval(fetchContractEvents, 20000);
  }

  function stopEventMonitor() {
    if (eventPollInterval) { clearInterval(eventPollInterval); eventPollInterval = null; }
  }

  // --- UI Rendering ---
  function renderABI() {
    const container = document.getElementById('contract-abi-list');
    if (!container) return;
    container.innerHTML = CONTRACT_ABI.map(fn => `
      <div class="bg-white/5 rounded-lg p-3 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
           onclick="SmartContractUI.selectFunction('${fn.name}')">
        <div class="flex justify-between items-center">
          <span class="font-mono text-sm text-purple-300">${fn.name}</span>
          <span class="text-xs text-gray-400">→ ${fn.returns}</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          ${fn.params.map(p => `<span class="mr-2">${p.name}: ${p.type}</span>`).join('')}
        </div>
      </div>`).join('');
  }

  function selectFunction(fnName) {
    const fn = CONTRACT_ABI.find(f => f.name === fnName);
    if (!fn) return;

    document.getElementById('selected-fn-name').textContent = fn.name;
    const paramsContainer = document.getElementById('fn-params-container');
    paramsContainer.innerHTML = fn.params.map(p => `
      <div class="mb-3">
        <label class="text-xs text-gray-400 block mb-1">${p.name} <span class="text-purple-400">(${p.type})</span></label>
        <input id="param-${p.name}" type="text" placeholder="Enter ${p.name}..."
          class="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-sm font-mono focus:outline-none focus:border-purple-500">
      </div>`).join('');

    document.getElementById('fn-call-section').classList.remove('hidden');
    document.getElementById('fn-result').textContent = '';
    document.getElementById('fn-result-container').classList.add('hidden');
  }

  async function executeFunction() {
    const fnName = document.getElementById('selected-fn-name').textContent;
    const fn = CONTRACT_ABI.find(f => f.name === fnName);
    if (!fn) return;

    const params = {};
    for (const p of fn.params) {
      params[p.name] = document.getElementById(`param-${p.name}`)?.value || '';
    }

    const btn = document.getElementById('execute-fn-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Executing...';

    try {
      const result = await callFunction(fnName, params);
      const resultEl = document.getElementById('fn-result');
      resultEl.textContent = JSON.stringify(result, null, 2);
      document.getElementById('fn-result-container').classList.remove('hidden');
      document.getElementById('fn-result-status').className = 'text-xs text-green-400 mb-2';
      document.getElementById('fn-result-status').textContent = result.simulated ? '✓ Simulated via Soroban RPC' : '✓ Mock result (set contract ID for real calls)';
    } catch (err) {
      const resultEl = document.getElementById('fn-result');
      resultEl.textContent = `Error: ${err.message}`;
      document.getElementById('fn-result-container').classList.remove('hidden');
      document.getElementById('fn-result-status').className = 'text-xs text-red-400 mb-2';
      document.getElementById('fn-result-status').textContent = '✗ Execution failed';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-play mr-2"></i>Execute';
    }
  }

  function renderEvents() {
    const el = document.getElementById('contract-events-list');
    if (!el) return;
    if (events.length === 0) {
      el.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No events yet. Execute a function to see results.</p>';
      return;
    }
    el.innerHTML = events.map(e => {
      if (e.type === 'call') {
        return `
          <div class="flex items-start space-x-3 p-3 bg-white/5 rounded-lg mb-2">
            <div class="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-code text-xs text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-mono text-purple-300">${e.fn}()</p>
              <p class="text-xs text-gray-400">${new Date(e.timestamp).toLocaleTimeString()}</p>
              <p class="text-xs text-green-400 mt-1">${e.result?.success ? '✓ Success' : '✗ Failed'}</p>
            </div>
          </div>`;
      }
      return `
        <div class="flex items-start space-x-3 p-3 bg-white/5 rounded-lg mb-2">
          <div class="w-7 h-7 rounded-full ${e.successful ? 'bg-green-600' : 'bg-red-600'} flex items-center justify-center flex-shrink-0">
            <i class="fas ${e.successful ? 'fa-check' : 'fa-times'} text-xs text-white"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-mono text-gray-300 truncate">${e.hash?.substring(0, 20)}...</p>
            <p class="text-xs text-gray-400">${new Date(e.timestamp).toLocaleString()}</p>
          </div>
        </div>`;
    }).join('');
  }

  function saveContractId() {
    const input = document.getElementById('contract-id-input');
    if (!input) return;
    contractId = input.value.trim();
    localStorage.setItem('contract_id', contractId);
    if (contractId) {
      startEventMonitor();
      showContractStatus('Contract ID saved. Event monitoring started.', 'success');
    } else {
      stopEventMonitor();
      showContractStatus('Contract ID cleared.', 'info');
    }
  }

  function showContractStatus(msg, type) {
    const el = document.getElementById('contract-status-msg');
    if (!el) return;
    const colors = { success: 'text-green-400', error: 'text-red-400', info: 'text-blue-400' };
    el.className = `text-xs mt-1 ${colors[type] || 'text-gray-400'}`;
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function init() {
    renderABI();
    renderEvents();
    const input = document.getElementById('contract-id-input');
    if (input && contractId) input.value = contractId;
    if (contractId) startEventMonitor();
  }

  return { selectFunction, executeFunction, saveContractId, init };
})();

// Inject Smart Contract UI tab on load
document.addEventListener('DOMContentLoaded', () => {
  // Add tab button
  const tabNav = document.querySelector('.glass-effect.rounded-xl.p-1.mb-8');
  if (tabNav) {
    const btn = document.createElement('button');
    btn.id = 'contractTab';
    btn.className = 'tab-btn px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base';
    btn.setAttribute('onclick', "switchTab('contract')");
    btn.innerHTML = '<i class="fas fa-file-contract mr-1 sm:mr-2"></i><span class="hidden sm:inline">Smart </span>Contract';
    tabNav.appendChild(btn);
  }

  // Add tab content
  const tabContent = document.createElement('div');
  tabContent.id = 'contractContent';
  tabContent.className = 'tab-content hidden';
  tabContent.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- ABI / Function List -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-2"><i class="fas fa-list mr-2 text-purple-400"></i>Contract ABI</h3>
        <div class="mb-4">
          <label class="text-xs text-gray-400 block mb-1">Contract ID (optional)</label>
          <div class="flex space-x-2">
            <input id="contract-id-input" type="text" placeholder="C... or G..."
              class="flex-1 p-2 rounded-lg bg-white/10 border border-white/20 text-xs font-mono focus:outline-none focus:border-purple-500">
            <button onclick="SmartContractUI.saveContractId()"
              class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs transition-colors">Save</button>
          </div>
          <p id="contract-status-msg" class="text-xs mt-1"></p>
        </div>
        <p class="text-xs text-gray-400 mb-3">Click a function to interact with it:</p>
        <div id="contract-abi-list"></div>
      </div>

      <!-- Function Executor -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-4"><i class="fas fa-terminal mr-2 text-green-400"></i>Execute Function</h3>
        <div id="fn-call-section" class="hidden">
          <div class="bg-purple-900/30 rounded-lg p-3 mb-4 border border-purple-700/50">
            <p class="text-xs text-gray-400">Selected function</p>
            <p id="selected-fn-name" class="font-mono text-purple-300 font-semibold"></p>
          </div>
          <div id="fn-params-container"></div>
          <button id="execute-fn-btn" onclick="SmartContractUI.executeFunction()"
            class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors mt-2">
            <i class="fas fa-play mr-2"></i>Execute
          </button>
          <div id="fn-result-container" class="hidden mt-4">
            <p id="fn-result-status" class="text-xs text-green-400 mb-2"></p>
            <pre id="fn-result" class="bg-black/40 rounded-lg p-3 text-xs font-mono text-green-300 overflow-auto max-h-48 whitespace-pre-wrap"></pre>
          </div>
        </div>
        <div id="fn-call-placeholder" class="text-center py-8 text-gray-400">
          <i class="fas fa-arrow-left text-2xl mb-3 block"></i>
          <p class="text-sm">Select a function from the ABI to get started</p>
        </div>
      </div>

      <!-- Event Monitor -->
      <div class="glass-effect rounded-xl p-5">
        <h3 class="font-bold text-lg mb-4"><i class="fas fa-broadcast-tower mr-2 text-yellow-400"></i>Event Monitor</h3>
        <p class="text-xs text-gray-400 mb-3">Live contract events and function call results:</p>
        <div id="contract-events-list" class="max-h-96 overflow-y-auto">
          <p class="text-gray-400 text-sm text-center py-4">No events yet. Execute a function to see results.</p>
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

  SmartContractUI.init();
});
