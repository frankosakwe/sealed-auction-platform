/**
 * AR Preview Module - Issue #110
 * Augmented Reality preview for auction items using device camera and AR markers.
 */

const ARPreview = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let animFrameId = null;
  let currentAuction = null;
  let markerDetected = false;

  // Simple AR overlay: draws item info over the camera feed when a bright region is detected
  function detectMarker(imageData) {
    const data = imageData.data;
    let brightPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 200 && g > 200 && b > 200) brightPixels++;
    }
    // Treat a region with >5% bright pixels as a marker
    return brightPixels / (data.length / 4) > 0.05;
  }

  function drawOverlay(auction) {
    if (!ctx || !canvasEl) return;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    markerDetected = detectMarker(imageData);

    if (markerDetected && auction) {
      // Draw AR overlay panel
      const pw = 280, ph = 120;
      const px = (canvasEl.width - pw) / 2;
      const py = canvasEl.height - ph - 20;

      ctx.fillStyle = 'rgba(102, 126, 234, 0.85)';
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(auction.title.substring(0, 30), px + 12, py + 28);

      ctx.font = '13px sans-serif';
      ctx.fillText(`Starting Bid: ${auction.starting_bid} XLM`, px + 12, py + 52);
      ctx.fillText(`Bids: ${auction.bid_count || 0}`, px + 12, py + 72);

      const status = auction.status === 'active' ? '🟢 Active' : '🔴 Closed';
      ctx.fillText(status, px + 12, py + 92);

      // Corner markers
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 3;
      const corners = [[px - 10, py - 10], [px + pw + 10, py - 10], [px - 10, py + ph + 10], [px + pw + 10, py + ph + 10]];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
      });
    } else {
      // Scanning indicator
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, canvasEl.height - 50, canvasEl.width, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Point camera at a bright surface to preview item', canvasEl.width / 2, canvasEl.height - 20);
      ctx.textAlign = 'left';
    }

    animFrameId = requestAnimationFrame(() => drawOverlay(auction));
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      canvasEl.width = videoEl.videoWidth || 640;
      canvasEl.height = videoEl.videoHeight || 480;
      drawOverlay(currentAuction);
      return true;
    } catch (err) {
      console.error('Camera access denied:', err);
      return false;
    }
  }

  function stopCamera() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (videoEl) { videoEl.srcObject = null; }
  }

  function open(auction) {
    currentAuction = auction;
    const modal = document.getElementById('ar-preview-modal');
    if (!modal) return;

    document.getElementById('ar-auction-title').textContent = auction.title;
    modal.classList.remove('hidden');

    videoEl = document.getElementById('ar-video');
    canvasEl = document.getElementById('ar-canvas');
    ctx = canvasEl.getContext('2d');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.getElementById('ar-no-camera').classList.remove('hidden');
      document.getElementById('ar-canvas').classList.add('hidden');
      return;
    }

    startCamera().then(ok => {
      if (!ok) {
        document.getElementById('ar-no-camera').classList.remove('hidden');
        document.getElementById('ar-canvas').classList.add('hidden');
      }
    });
  }

  function close() {
    stopCamera();
    const modal = document.getElementById('ar-preview-modal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('ar-no-camera').classList.add('hidden');
    document.getElementById('ar-canvas').classList.remove('hidden');
  }

  return { open, close };
})();

// Inject AR modal HTML on load
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.createElement('div');
  modal.id = 'ar-preview-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-90 hidden z-50 flex flex-col items-center justify-center p-4';
  modal.innerHTML = `
    <div class="w-full max-w-2xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-white text-xl font-bold">
          <i class="fas fa-camera mr-2 text-purple-400"></i>AR Preview:
          <span id="ar-auction-title" class="text-purple-300"></span>
        </h2>
        <button onclick="ARPreview.close()" class="text-white hover:text-red-400 transition-colors text-2xl">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="relative bg-black rounded-xl overflow-hidden" style="aspect-ratio:4/3;">
        <video id="ar-video" class="hidden" playsinline muted></video>
        <canvas id="ar-canvas" class="w-full h-full object-contain"></canvas>
        <div id="ar-no-camera" class="hidden absolute inset-0 flex flex-col items-center justify-center text-white">
          <i class="fas fa-camera-slash text-5xl mb-4 text-red-400"></i>
          <p class="text-lg font-semibold">Camera not available</p>
          <p class="text-sm text-gray-400 mt-2">Please allow camera access to use AR preview</p>
        </div>
      </div>
      <p class="text-gray-400 text-sm text-center mt-3">
        <i class="fas fa-info-circle mr-1"></i>
        Point your camera at a bright surface or AR marker to see item details overlaid
      </p>
    </div>
  `;
  document.body.appendChild(modal);
});
