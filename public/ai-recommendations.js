/**
 * AI-Powered Recommendations Module - Issue #112
 * Auction recommendations based on user behavior and preferences.
 * Uses client-side collaborative filtering with localStorage-persisted behavior tracking.
 */

const AIRecommendations = (() => {
  const STORAGE_KEY = 'auction_behavior';
  const MAX_HISTORY = 100;

  // --- Behavior Tracking ---
  function getBehavior() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { views: {}, bids: {}, searches: [] };
    } catch { return { views: {}, bids: {}, searches: [] }; }
  }

  function saveBehavior(b) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  }

  function trackView(auctionId, auction) {
    const b = getBehavior();
    b.views[auctionId] = (b.views[auctionId] || 0) + 1;
    // Store title keywords for content-based filtering
    if (auction && auction.title) {
      b.keywords = b.keywords || {};
      auction.title.toLowerCase().split(/\s+/).forEach(w => {
        if (w.length > 3) b.keywords[w] = (b.keywords[w] || 0) + 1;
      });
    }
    saveBehavior(b);
  }

  function trackBid(auctionId) {
    const b = getBehavior();
    b.bids[auctionId] = (b.bids[auctionId] || 0) + 1;
    saveBehavior(b);
  }

  function trackSearch(query) {
    const b = getBehavior();
    b.searches = [query, ...(b.searches || [])].slice(0, MAX_HISTORY);
    saveBehavior(b);
  }

  // --- Scoring Engine ---
  function scoreAuction(auction, behavior) {
    let score = 0;
    const id = String(auction.id);

    // Bid history: highest signal
    if (behavior.bids[id]) score += behavior.bids[id] * 10;

    // View history
    if (behavior.views[id]) score += behavior.views[id] * 2;

    // Keyword match
    if (behavior.keywords && auction.title) {
      const words = auction.title.toLowerCase().split(/\s+/);
      words.forEach(w => { if (behavior.keywords[w]) score += behavior.keywords[w]; });
    }

    // Recency boost: active auctions score higher
    if (auction.status === 'active') score += 5;

    // Novelty: unseen auctions get a small boost
    if (!behavior.views[id] && !behavior.bids[id]) score += 3;

    return score;
  }

  function getRecommendations(auctions, limit = 6) {
    const behavior = getBehavior();
    return [...auctions]
      .map(a => ({ ...a, _score: scoreAuction(a, behavior) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);
  }

  // --- A/B Testing ---
  function getVariant() {
    let variant = localStorage.getItem('rec_variant');
    if (!variant) {
      variant = Math.random() < 0.5 ? 'A' : 'B';
      localStorage.setItem('rec_variant', variant);
    }
    return variant;
  }

  // --- UI Rendering ---
  function renderRecommendations(auctions) {
    const container = document.getElementById('ai-recommendations-list');
    if (!container) return;

    const recs = getRecommendations(auctions);
    const variant = getVariant();

    if (recs.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-8 text-gray-400">
          <i class="fas fa-robot text-4xl mb-3 block"></i>
          <p>Browse some auctions to get personalized recommendations!</p>
        </div>`;
      return;
    }

    container.innerHTML = recs.map(a => {
      const isActive = a.status === 'active';
      const score = Math.min(100, Math.round(a._score * 5));
      // Variant A: compact cards; Variant B: cards with match score
      const scoreHtml = variant === 'B'
        ? `<div class="mt-2 flex items-center space-x-1">
             <div class="flex-1 bg-gray-600 rounded-full h-1.5">
               <div class="bg-purple-500 h-1.5 rounded-full" style="width:${score}%"></div>
             </div>
             <span class="text-xs text-gray-400">${score}% match</span>
           </div>`
        : '';

      return `
        <div class="glass-effect rounded-xl p-4 cursor-pointer hover:border-purple-500 border border-transparent transition-all"
             onclick="ARPreview && window.openBidModal && window.openBidModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-sm line-clamp-2 flex-1">${escapeHtml(a.title)}</h4>
            <span class="ml-2 px-2 py-0.5 rounded text-xs ${isActive ? 'bg-green-600' : 'bg-gray-600'}">${isActive ? 'Active' : 'Closed'}</span>
          </div>
          <p class="text-xs text-gray-400 mb-2 line-clamp-2">${escapeHtml(a.description || '')}</p>
          <div class="flex justify-between text-xs">
            <span class="text-purple-300">${a.starting_bid} XLM</span>
            <span class="text-gray-400">${a.bid_count || 0} bids</span>
          </div>
          ${scoreHtml}
        </div>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function refresh(auctions) {
    renderRecommendations(auctions || window._allAuctions || []);
    updateStats();
  }

  function updateStats() {
    const b = getBehavior();
    const viewCount = Object.values(b.views).reduce((s, v) => s + v, 0);
    const bidCount = Object.values(b.bids).reduce((s, v) => s + v, 0);
    const el = document.getElementById('ai-behavior-stats');
    if (el) el.textContent = `${viewCount} views · ${bidCount} bids tracked · Variant ${getVariant()}`;
  }

  function clearBehavior() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('rec_variant');
    refresh([]);
  }

  return { trackView, trackBid, trackSearch, getRecommendations, refresh, clearBehavior };
})();

// Inject recommendations tab content on load
document.addEventListener('DOMContentLoaded', () => {
  // Add tab button
  const tabNav = document.querySelector('.glass-effect.rounded-xl.p-1.mb-8');
  if (tabNav) {
    const btn = document.createElement('button');
    btn.id = 'aiTab';
    btn.className = 'tab-btn px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base';
    btn.setAttribute('onclick', "switchTab('ai')");
    btn.innerHTML = '<i class="fas fa-robot mr-1 sm:mr-2"></i><span class="hidden sm:inline">AI </span>Picks';
    tabNav.appendChild(btn);
  }

  // Add tab content
  const main = document.querySelector('main .container, main');
  const tabContent = document.createElement('div');
  tabContent.id = 'aiContent';
  tabContent.className = 'tab-content hidden';
  tabContent.innerHTML = `
    <div class="glass-effect rounded-xl p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold">
            <i class="fas fa-robot mr-2 text-purple-400"></i>AI-Powered Recommendations
          </h2>
          <p id="ai-behavior-stats" class="text-xs text-gray-400 mt-1">Loading behavior data...</p>
        </div>
        <div class="flex space-x-2">
          <button onclick="AIRecommendations.refresh(window._allAuctions)"
            class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <i class="fas fa-sync-alt mr-1"></i>Refresh
          </button>
          <button onclick="AIRecommendations.clearBehavior()"
            class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <i class="fas fa-trash mr-1"></i>Reset
          </button>
        </div>
      </div>

      <div class="mb-4 p-3 bg-purple-900/30 rounded-lg border border-purple-700/50">
        <p class="text-sm text-purple-300">
          <i class="fas fa-info-circle mr-2"></i>
          Recommendations improve as you browse and bid. Your behavior is stored locally and never sent to the server.
        </p>
      </div>

      <div id="ai-recommendations-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="col-span-full text-center py-8 text-gray-400">
          <i class="fas fa-robot text-4xl mb-3 block animate-pulse"></i>
          <p>Loading recommendations...</p>
        </div>
      </div>
    </div>
  `;

  // Insert before bid modal
  const bidModal = document.getElementById('bidModal');
  if (bidModal) {
    bidModal.parentNode.insertBefore(tabContent, bidModal);
  } else {
    document.querySelector('main').appendChild(tabContent);
  }
});
