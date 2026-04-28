/**
 * Optimized Service Worker with Advanced Caching Strategies
 * Implements cache-first, network-first, and stale-while-revalidate strategies
 */

const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE_NAME = `sealed-auction-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `sealed-auction-dynamic-${CACHE_VERSION}`;
const API_CACHE_NAME = `sealed-auction-api-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `sealed-auction-images-${CACHE_VERSION}`;

// Cache strategies configuration
const CACHE_STRATEGIES = {
    // Critical assets - cache first
    STATIC: {
        cacheName: STATIC_CACHE_NAME,
        strategy: 'cacheFirst',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxEntries: 100
    },
    // API responses - network first with fallback
    API: {
        cacheName: API_CACHE_NAME,
        strategy: 'networkFirst',
        maxAge: 5 * 60 * 1000, // 5 minutes
        maxEntries: 50
    },
    // Images - cache first with long expiration
    IMAGES: {
        cacheName: IMAGE_CACHE_NAME,
        strategy: 'cacheFirst',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxEntries: 200
    },
    // Dynamic content - stale while revalidate
    DYNAMIC: {
        cacheName: DYNAMIC_CACHE_NAME,
        strategy: 'staleWhileRevalidate',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxEntries: 100
    }
};

// Critical assets to cache immediately
const CRITICAL_ASSETS = [
    '/',
    '/index-optimized.html',
    '/performance-optimizer.js',
    '/app.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
    /^\/api\/auctions/,
    /^\/api\/bookmarks/,
    /^\/api\/dashboard\/data/,
    /^\/api\/analytics/
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching critical assets');
                return cache.addAll(CRITICAL_ASSETS);
            })
            .then(() => {
                console.log('[SW] Critical assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache critical assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName.startsWith('sealed-auction-') && 
                                   !cacheName.includes(CACHE_VERSION);
                        })
                        .map((cacheName) => {
                            console.log(`[SW] Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Old caches cleaned up');
                return self.clients.claim();
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Chrome extensions
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Route to appropriate caching strategy
    if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(handleStaticRequest(request));
    } else {
        event.respondWith(handleDynamicRequest(request));
    }
});

// API request handler - Network First
async function handleAPIRequest(request) {
    const strategy = CACHE_STRATEGIES.API;
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful response
            const cache = await caches.open(strategy.cacheName);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        // Fallback to cache
        return getCachedResponse(request, strategy);
    } catch (error) {
        console.log('[SW] Network failed, falling back to cache:', error);
        return getCachedResponse(request, strategy);
    }
}

// Image request handler - Cache First
async function handleImageRequest(request) {
    const strategy = CACHE_STRATEGIES.IMAGES;
    
    // Try cache first
    const cachedResponse = await getCachedResponse(request, strategy);
    if (cachedResponse) {
        // Update cache in background
        updateCacheInBackground(request, strategy);
        return cachedResponse;
    }
    
    // Fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(strategy.cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Failed to fetch image:', error);
        return new Response('Image not available offline', { status: 503 });
    }
}

// Static asset handler - Cache First
async function handleStaticRequest(request) {
    const strategy = CACHE_STRATEGIES.STATIC;
    
    // Try cache first
    const cachedResponse = await getCachedResponse(request, strategy);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(strategy.cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Failed to fetch static asset:', error);
        return new Response('Asset not available offline', { status: 503 });
    }
}

// Dynamic content handler - Stale While Revalidate
async function handleDynamicRequest(request) {
    const strategy = CACHE_STRATEGIES.DYNAMIC;
    
    // Get cached response immediately
    const cachedResponse = await getCachedResponse(request, strategy);
    
    // Fetch in background
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                const cache = await caches.open(strategy.cacheName);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.error('[SW] Background fetch failed:', error);
            return cachedResponse || new Response('Content not available', { status: 503 });
        });
    
    // Return cached response immediately, or wait for network if no cache
    return cachedResponse || fetchPromise;
}

// Helper functions
function isAPIRequest(url) {
    return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isStaticAsset(url) {
    return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
           url.pathname.includes('/icons/') ||
           CRITICAL_ASSETS.some(asset => url.href.includes(asset));
}

async function getCachedResponse(request, strategy) {
    const cache = await caches.open(strategy.cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, strategy.maxAge)) {
        return cachedResponse;
    }
    
    return null;
}

function isExpired(response, maxAge) {
    const dateHeader = response.headers.get('date');
    if (!dateHeader) return false;
    
    const responseTime = new Date(dateHeader).getTime();
    return Date.now() - responseTime > maxAge;
}

async function updateCacheInBackground(request, strategy) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(strategy.cacheName);
            cache.put(request, networkResponse);
        }
    } catch (error) {
        console.log('[SW] Background cache update failed:', error);
    }
}

// Cache cleanup function
async function cleanupCache(strategy) {
    const cache = await caches.open(strategy.cacheName);
    const requests = await cache.keys();
    
    if (requests.length > strategy.maxEntries) {
        // Remove oldest entries
        const toDelete = requests.slice(0, requests.length - strategy.maxEntries);
        await Promise.all(toDelete.map(request => cache.delete(request)));
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Handle offline actions that need to be synced
    console.log('[SW] Performing background sync');
    
    // Get pending actions from IndexedDB
    // This would integrate with your offline storage solution
    // For now, just log the action
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/badge-72x72.png',
                tag: data.tag,
                data: data.data
            })
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.notification.data) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

// Performance monitoring
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PERFORMANCE_METRICS') {
        console.log('[SW] Received performance metrics:', event.data.metrics);
        // Could send these to analytics service
    }
});

// Cache warming for critical resources
async function warmCache() {
    const importantPages = [
        '/',
        '/dashboard.html',
        '/bookmarks.html'
    ];
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    
    for (const page of importantPages) {
        try {
            const response = await fetch(page);
            if (response.ok) {
                cache.put(page, response);
            }
        } catch (error) {
            console.log(`[SW] Failed to warm cache for ${page}:`, error);
        }
    }
}

// Periodic cache maintenance
setInterval(async () => {
    console.log('[SW] Performing cache maintenance');
    
    // Clean up expired entries
    for (const [name, strategy] of Object.entries(CACHE_STRATEGIES)) {
        await cleanupCache(strategy);
    }
    
    // Warm cache for important resources
    await warmCache();
}, 60 * 60 * 1000); // Every hour

console.log(`[SW] Service Worker ${CACHE_VERSION} loaded successfully`);
