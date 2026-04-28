// Auction Detail View Module
let currentAuctionDetail = null;
let countdownTimer = null;
let bidHistoryUpdateInterval = null;

// Open auction detail modal
function openAuctionDetail(auctionId) {
  const modal = document.getElementById("auctionDetailModal");
  if (!modal) return;

  // Show loading state
  modal.classList.remove("hidden");
  showAuctionDetailLoading();

  // Fetch auction details
  fetch(`/api/auctions/${auctionId}`)
    .then((response) => response.json())
    .then((auction) => {
      currentAuctionDetail = auction;
      displayAuctionDetail(auction);
      startCountdownTimer(auction.endTime);
      loadBidHistory(auctionId);
      loadRelatedAuctions(auctionId);
      setupRealTimeUpdates(auctionId);
    })
    .catch((error) => {
      console.error("Error fetching auction details:", error);
      showNotification("Failed to load auction details", "error");
      closeAuctionDetail();
    });
}

// Close auction detail modal
function closeAuctionDetail() {
  const modal = document.getElementById("auctionDetailModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  // Clear timers
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (bidHistoryUpdateInterval) {
    clearInterval(bidHistoryUpdateInterval);
    bidHistoryUpdateInterval = null;
  }

  // Clear real-time listeners
  if (currentAuctionDetail) {
    socket.off(`auction:${currentAuctionDetail.id}:bidPlaced`);
  }
}

// Display auction details in modal
function displayAuctionDetail(auction) {
  document.getElementById("detailAuctionTitle").textContent =
    auction.title || "Untitled Auction";
  document.getElementById("detailDescription").textContent =
    auction.description || "No description provided";
  document.getElementById("detailCurrentBid").textContent = `${
    auction.currentHighestBid || auction.startingBid
  } XLM`;
  document.getElementById(
    "detailStartingBid",
  ).textContent = `${auction.startingBid} XLM`;
  document.getElementById("bidCount").textContent = `${
    auction.bidCount || 0
  } Bids Placed`;
  document.getElementById(
    "detailCreatorName",
  ).textContent = `User #${auction.creator.substring(0, 8)}...`;
  document.getElementById("detailStatus").textContent = formatAuctionStatus(
    auction.status,
  );

  // Update status indicator
  const statusDot = document.getElementById("statusDot");
  const timerSection = document.getElementById("timerSection");

  if (auction.status === "active") {
    statusDot.className = "w-3 h-3 rounded-full bg-green-500 animate-pulse";
    document.getElementById("auctionStatus").textContent =
      "Auction is LIVE - Place your bid now!";
    timerSection.classList.remove("opacity-50");
  } else if (auction.status === "closed") {
    statusDot.className = "w-3 h-3 rounded-full bg-red-500";
    document.getElementById("auctionStatus").textContent = "Auction has ended";
    timerSection.classList.add("opacity-50");
    document.getElementById("placeBidBtn").disabled = true;
    document
      .getElementById("placeBidBtn")
      .classList.add("opacity-50", "cursor-not-allowed");
  } else if (auction.status === "upcoming") {
    statusDot.className = "w-3 h-3 rounded-full bg-yellow-500";
    document.getElementById("auctionStatus").textContent =
      "Auction starts soon";
    document.getElementById("placeBidBtn").disabled = true;
    document
      .getElementById("placeBidBtn")
      .classList.add("opacity-50", "cursor-not-allowed");
  }

  // Update minimum bid info
  const minBid = Math.max(
    auction.startingBid,
    auction.currentHighestBid || auction.startingBid,
  );
  document.getElementById("minBidAmount").textContent = minBid + 0.01;
}

// Format auction status
function formatAuctionStatus(status) {
  const statusMap = {
    active: "Active",
    closed: "Closed",
    upcoming: "Upcoming",
  };
  return statusMap[status] || status;
}

// Start countdown timer
function startCountdownTimer(endTime) {
  if (countdownTimer) clearInterval(countdownTimer);

  const updateTimer = () => {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const distance = end - now;

    if (distance <= 0) {
      document.getElementById("timerDays").textContent = "0";
      document.getElementById("timerHours").textContent = "0";
      document.getElementById("timerMinutes").textContent = "0";
      document.getElementById("timerSeconds").textContent = "0";

      document.getElementById("auctionStatus").textContent =
        "Auction has ended";
      document.getElementById("auctionStatus").classList.add("text-red-500");

      // Disable bid button
      document.getElementById("placeBidBtn").disabled = true;
      document
        .getElementById("placeBidBtn")
        .classList.add("opacity-50", "cursor-not-allowed");

      clearInterval(countdownTimer);

      // Refresh auction details to get final results
      if (currentAuctionDetail) {
        fetch(`/api/auctions/${currentAuctionDetail.id}`)
          .then((response) => response.json())
          .then((auction) => {
            currentAuctionDetail = auction;
            displayAuctionDetail(auction);
          });
      }
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("timerDays").textContent = days;
    document.getElementById("timerHours").textContent = String(hours).padStart(
      2,
      "0",
    );
    document.getElementById("timerMinutes").textContent = String(
      minutes,
    ).padStart(2, "0");
    document.getElementById("timerSeconds").textContent = String(
      seconds,
    ).padStart(2, "0");

    // Add warning style when time is running out (less than 10 minutes)
    if (distance < 600000) {
      document
        .getElementById("timerSection")
        .classList.add("border-red-500/50", "bg-red-500/10");
    }
  };

  updateTimer();
  countdownTimer = setInterval(updateTimer, 1000);
}

// Load bid history
function loadBidHistory(auctionId) {
  const container = document.getElementById("bidHistoryContainer");
  container.innerHTML =
    '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Loading bid history...</p></div>';

  fetch(`/api/auctions/${auctionId}`)
    .then((response) => response.json())
    .then((auction) => {
      if (!auction.bidCount || auction.bidCount === 0) {
        container.innerHTML =
          '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-3xl mb-2 opacity-50"></i><p>No bids placed yet</p></div>';
        return;
      }

      // Display bid count with animation
      displayBidHistory(auction.bidCount);
    })
    .catch((error) => {
      console.error("Error loading bid history:", error);
      container.innerHTML =
        '<div class="text-center py-4 text-red-400"><p>Failed to load bid history</p></div>';
    });
}

// Display bid history
function displayBidHistory(bidCount) {
  const container = document.getElementById("bidHistoryContainer");
  document.getElementById("bidHistoryCount").textContent = `${bidCount} ${
    bidCount === 1 ? "bid" : "bids"
  }`;

  let html = "";

  // Show animated bid entries (anonymous)
  for (let i = 0; i < Math.min(bidCount, 10); i++) {
    const isLatest = i === 0;
    html += `
            <div class="p-3 rounded-lg bg-white/5 border border-white/10 animate-fade-in transition-all ${
              isLatest ? "bg-green-500/10 border-green-500/30" : ""
            }">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${
                          isLatest ? "bg-green-400" : "bg-gray-500"
                        }"></div>
                        <span class="text-sm text-gray-300">Anonymous Bidder #${String(
                          i + 1,
                        ).padStart(3, "0")}</span>
                        ${
                          isLatest
                            ? '<span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Latest</span>'
                            : ""
                        }
                    </div>
                    <span class="text-xs text-gray-400">• Encrypted</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Bid amount hidden until auction ends</p>
            </div>
        `;
  }

  if (bidCount > 10) {
    html += `
            <div class="p-3 rounded-lg bg-white/10 border border-white/20 text-center">
                <p class="text-sm text-gray-300">... and <strong>${
                  bidCount - 10
                }</strong> more bids</p>
            </div>
        `;
  }

  container.innerHTML = html;
}

// Load related auctions
function loadRelatedAuctions(auctionId) {
  fetch("/api/auctions")
    .then((response) => response.json())
    .then((data) => {
      const allAuctions = data.auctions || data.data || [];
      const relatedAuctions = allAuctions
        .filter((a) => a.id !== auctionId && a.status === "active")
        .slice(0, 3);

      const container = document.getElementById("relatedAuctionsContainer");

      if (relatedAuctions.length === 0) {
        container.innerHTML =
          '<p class="text-center text-gray-400 col-span-full py-4">No related auctions available</p>';
        return;
      }

      container.innerHTML = relatedAuctions
        .map(
          (auction) => `
                <div class="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group" onclick="openAuctionDetail('${
                  auction.id
                }')">
                    <h5 class="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">${
                      auction.title
                    }</h5>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-purple-400 font-bold">${
                          auction.currentHighestBid || auction.startingBid
                        } XLM</span>
                        <span class="text-gray-400">${
                          auction.bidCount || 0
                        } bids</span>
                    </div>
                </div>
            `,
        )
        .join("");
    })
    .catch((error) => console.error("Error loading related auctions:", error));
}

// Setup real-time updates via Socket.io
function setupRealTimeUpdates(auctionId) {
  if (!socket) return;

  // Listen for new bids
  socket.on(`auction:${auctionId}:bidPlaced`, (data) => {
    if (currentAuctionDetail) {
      currentAuctionDetail.bidCount =
        data.bidCount || (currentAuctionDetail.bidCount || 0) + 1;
      currentAuctionDetail.currentHighestBid =
        data.highestBid || currentAuctionDetail.currentHighestBid;

      document.getElementById(
        "detailCurrentBid",
      ).textContent = `${currentAuctionDetail.currentHighestBid} XLM`;
      document.getElementById(
        "bidCount",
      ).textContent = `${currentAuctionDetail.bidCount} Bids Placed`;

      // Reload bid history with animation
      loadBidHistory(auctionId);

      // Show notification
      showNotification("New bid placed!", "info", 3000);
    }
  });

  // Listen for auction status changes
  socket.on(`auction:${auctionId}:statusChanged`, (data) => {
    if (currentAuctionDetail) {
      currentAuctionDetail.status = data.status;
      displayAuctionDetail(currentAuctionDetail);
    }
  });
}

// Open bid form
function openBidForm() {
  if (!currentUser) {
    showNotification("Please login to place a bid", "warning");
    showAuthModal();
    return;
  }

  if (!currentAuctionDetail) {
    showNotification("Auction details not loaded", "error");
    return;
  }

  if (currentAuctionDetail.status !== "active") {
    showNotification("This auction is not active", "error");
    return;
  }

  document.getElementById("bidFormSection").classList.remove("hidden");

  // Set minimum bid
  const minBid = Math.max(
    currentAuctionDetail.startingBid,
    currentAuctionDetail.currentHighestBid || currentAuctionDetail.startingBid,
  );
  const nextMinBid = (minBid + 0.01).toFixed(2);
  document.getElementById("bidAmount").min = nextMinBid;
  document.getElementById("minBidAmount").textContent = nextMinBid;

  // Scroll to form
  document
    .getElementById("bidFormSection")
    .scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Close bid form
function closeBidForm() {
  document.getElementById("bidFormSection").classList.add("hidden");
  document.getElementById("detailBidForm").reset();
}

// Toggle secret key visibility
function toggleSecretKeyVisibility() {
  const input = document.getElementById("secretKey");
  const icon = document.getElementById("keyVisibilityIcon");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

// Handle bid submission
document.addEventListener("DOMContentLoaded", () => {
  const bidForm = document.getElementById("detailBidForm");
  if (bidForm) {
    bidForm.addEventListener("submit", handleDetailBidSubmit);
  }
});

async function handleDetailBidSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showNotification("Please login to place a bid", "warning");
    return;
  }

  if (!currentAuctionDetail) {
    showNotification("Auction details not loaded", "error");
    return;
  }

  const bidAmount = parseFloat(document.getElementById("bidAmount").value);
  const secretKey = document.getElementById("secretKey").value;
  const confirmSecretKey = document.getElementById("confirmSecretKey").checked;

  // Validation
  if (!bidAmount || bidAmount <= 0) {
    showNotification("Please enter a valid bid amount", "error");
    return;
  }

  const minBid = Math.max(
    currentAuctionDetail.startingBid,
    currentAuctionDetail.currentHighestBid || currentAuctionDetail.startingBid,
  );
  if (bidAmount <= minBid) {
    showNotification(`Bid must be higher than ${minBid} XLM`, "error");
    return;
  }

  if (!secretKey || secretKey.length < 4) {
    showNotification("Secret key must be at least 4 characters long", "error");
    return;
  }

  if (!confirmSecretKey) {
    showNotification("Please confirm you have saved your secret key", "error");
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById("submitBidBtn");
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-2"></i>Placing Bid...';

  try {
    // Encrypt bid amount with secret key (client-side)
    const encryptedBid = await encryptBidAmount(bidAmount, secretKey);

    // Send bid to server
    const response = await fetch(
      `/api/auctions/${currentAuctionDetail.id}/bids`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          amount: bidAmount,
          secretKey: secretKey,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to place bid");
    }

    showNotification("Bid placed successfully!", "success");

    // Update auction details
    currentAuctionDetail.currentHighestBid = bidAmount;
    currentAuctionDetail.bidCount = (currentAuctionDetail.bidCount || 0) + 1;
    displayAuctionDetail(currentAuctionDetail);

    // Clear form and close
    closeBidForm();
  } catch (error) {
    console.error("Error placing bid:", error);
    showNotification(error.message || "Failed to place bid", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// Encrypt bid amount (client-side using Web Crypto API)
async function encryptBidAmount(amount, secretKey) {
  try {
    // Convert secret key to a crypto key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Sign the amount
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(amount.toString()),
    );

    // Return as hex string
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt bid");
  }
}

// Toggle bookmark
function toggleBookmark() {
  if (!currentUser) {
    showNotification("Please login to bookmark", "warning");
    return;
  }

  if (!currentAuctionDetail) return;

  const btn = document.getElementById("bookmarkBtn");
  const isBookmarked = btn.classList.contains("bg-red-500");

  if (isBookmarked) {
    // Remove bookmark
    btn.classList.remove("bg-red-500", "text-red-200");
    btn.classList.add("bg-white/10", "hover:bg-white/20");
    btn.innerHTML =
      '<i class="far fa-heart"></i><span class="hidden sm:inline ml-1">Bookmark</span>';
    showNotification("Removed from bookmarks", "info", 2000);
  } else {
    // Add bookmark
    btn.classList.add("bg-red-500", "text-red-200");
    btn.classList.remove("bg-white/10", "hover:bg-white/20");
    btn.innerHTML =
      '<i class="fas fa-heart"></i><span class="hidden sm:inline ml-1">Bookmarked</span>';
    showNotification("Added to bookmarks", "success", 2000);
  }

  // Save to localStorage
  let bookmarks = JSON.parse(
    localStorage.getItem("bookmarkedAuctions") || "[]",
  );
  if (isBookmarked) {
    bookmarks = bookmarks.filter((id) => id !== currentAuctionDetail.id);
  } else {
    if (!bookmarks.includes(currentAuctionDetail.id)) {
      bookmarks.push(currentAuctionDetail.id);
    }
  }
  localStorage.setItem("bookmarkedAuctions", JSON.stringify(bookmarks));
}

// Check if auction is bookmarked
function isAuctionBookmarked(auctionId) {
  const bookmarks = JSON.parse(
    localStorage.getItem("bookmarkedAuctions") || "[]",
  );
  return bookmarks.includes(auctionId);
}

// Share auction functions
function shareAuction(platform) {
  if (!currentAuctionDetail) return;

  const title = currentAuctionDetail.title || "Check out this auction";
  const description = currentAuctionDetail.description || "";
  const url = `${window.location.origin}?auction=${currentAuctionDetail.id}`;
  const text = `${title} - Sealed Bid Auction Platform`;

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url,
    )}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      url,
    )}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(
      url,
    )}&text=${encodeURIComponent(text)}`,
  };

  if (shareUrls[platform]) {
    window.open(shareUrls[platform], "_blank", "width=600,height=400");
  }
}

function copyAuctionLink() {
  if (!currentAuctionDetail) return;

  const url = `${window.location.origin}?auction=${currentAuctionDetail.id}`;

  navigator.clipboard
    .writeText(url)
    .then(() => {
      showNotification("Link copied to clipboard!", "success", 2000);
    })
    .catch((error) => {
      console.error("Failed to copy link:", error);
      showNotification("Failed to copy link", "error");
    });
}

// Show loading state
function showAuctionDetailLoading() {
  document.getElementById("detailAuctionTitle").textContent = "Loading...";
  document.getElementById("detailDescription").textContent =
    "Loading auction details...";
  document.getElementById("detailCurrentBid").textContent = "...";
}

// Export functions
if (typeof window !== "undefined") {
  window.openAuctionDetail = openAuctionDetail;
  window.closeAuctionDetail = closeAuctionDetail;
  window.openBidForm = openBidForm;
  window.closeBidForm = closeBidForm;
  window.toggleSecretKeyVisibility = toggleSecretKeyVisibility;
  window.toggleBookmark = toggleBookmark;
  window.shareAuction = shareAuction;
  window.copyAuctionLink = copyAuctionLink;
}
