/**
 * Image Optimization Module
 * Handles WebP conversion, lazy loading, and responsive images
 */

class ImageOptimizer {
    constructor() {
        this.supportsWebP = this.checkWebPSupport();
        this.loadedImages = new Set();
        this.imageCache = new Map();
        
        this.init();
    }

    init() {
        this.setupLazyLoading();
        this.setupResponsiveImages();
        this.preloadCriticalImages();
        this.setupImageErrorHandling();
    }

    checkWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        imageObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Fallback for older browsers
            this.loadAllImages();
        }
    }

    async loadImage(img) {
        const src = img.dataset.src;
        if (!src || this.loadedImages.has(src)) return;

        try {
            // Show loading state
            img.classList.add('loading');
            
            // Get optimized image URL
            const optimizedSrc = await this.getOptimizedImageUrl(src);
            
            // Create new image to preload
            const newImg = new Image();
            
            newImg.onload = () => {
                img.src = optimizedSrc;
                img.classList.remove('loading');
                img.classList.add('loaded');
                this.loadedImages.add(src);
                
                // Add fade-in effect
                img.style.opacity = '0';
                setTimeout(() => {
                    img.style.transition = 'opacity 0.3s ease';
                    img.style.opacity = '1';
                }, 10);
            };
            
            newImg.onerror = () => {
                // Fallback to original image
                img.src = src;
                img.classList.remove('loading');
                img.classList.add('loaded', 'error');
                this.loadedImages.add(src);
            };
            
            newImg.src = optimizedSrc;
            
        } catch (error) {
            console.error('Failed to load image:', error);
            img.src = src;
            img.classList.remove('loading');
            img.classList.add('error');
        }
    }

    async getOptimizedImageUrl(originalUrl) {
        // Check cache first
        if (this.imageCache.has(originalUrl)) {
            return this.imageCache.get(originalUrl);
        }

        let optimizedUrl = originalUrl;
        
        // Convert to WebP if supported and not already WebP
        if (this.supportsWebP && !originalUrl.includes('.webp')) {
            optimizedUrl = this.convertToWebP(originalUrl);
        }
        
        // Add responsive parameters if it's a placeholder service
        if (originalUrl.includes('via.placeholder.com')) {
            optimizedUrl = this.addResponsiveParams(optimizedUrl);
        }
        
        // Cache the result
        this.imageCache.set(originalUrl, optimizedUrl);
        
        return optimizedUrl;
    }

    convertToWebP(url) {
        // For external services that support WebP conversion
        if (url.includes('via.placeholder.com')) {
            return url.replace('via.placeholder.com', 'via.placeholder.com/webp');
        }
        
        // For images served from our own server
        if (url.startsWith('/') || url.includes(window.location.hostname)) {
            return `${url}${url.includes('?') ? '&' : '?'}format=webp`;
        }
        
        // For other external images, we can't convert them directly
        // In a real implementation, you might use a proxy service
        return url;
    }

    addResponsiveParams(url) {
        // Add device pixel ratio and size parameters
        const dpr = window.devicePixelRatio || 1;
        const width = Math.min(window.innerWidth, 1200);
        
        // Example: https://via.placeholder.com/300x200/667eea/ffffff?text=Rolex
        const match = url.match(/via\.placeholder\.com\/(\d+)x(\d+)/);
        if (match) {
            const originalWidth = parseInt(match[1]);
            const originalHeight = parseInt(match[2]);
            
            // Adjust for device pixel ratio
            const optimizedWidth = Math.min(originalWidth * dpr, width * dpr);
            const optimizedHeight = Math.round((originalHeight / originalWidth) * optimizedWidth);
            
            return url.replace(
                /\/(\d+)x(\d+)/,
                `/${optimizedWidth}x${optimizedHeight}`
            );
        }
        
        return url;
    }

    loadAllImages() {
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.loadImage(img);
        });
    }

    setupResponsiveImages() {
        // Create responsive image elements for better performance
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.createResponsiveImage(img);
        });
    }

    createResponsiveImage(img) {
        const src = img.dataset.src;
        if (!src) return;

        // Create srcset for different screen sizes
        const sizes = [
            { width: 320, media: '(max-width: 640px)' },
            { width: 640, media: '(max-width: 768px)' },
            { width: 768, media: '(max-width: 1024px)' },
            { width: 1024, media: '(max-width: 1280px)' },
            { width: 1280, media: '(min-width: 1281px)' }
        ];

        const srcset = sizes.map(size => {
            const optimizedUrl = this.getOptimizedImageUrlForSize(src, size.width);
            return `${optimizedUrl} ${size.width}w`;
        }).join(', ');

        const sizesAttr = sizes.map(size => size.media).join(', ');

        // Set attributes on the image
        img.setAttribute('srcset', srcset);
        img.setAttribute('sizes', sizesAttr);
    }

    getOptimizedImageUrlForSize(originalUrl, width) {
        let optimizedUrl = originalUrl;
        
        // Add size parameter for placeholder service
        if (originalUrl.includes('via.placeholder.com')) {
            const match = originalUrl.match(/via\.placeholder\.com\/(\d+)x(\d+)/);
            if (match) {
                const originalWidth = parseInt(match[1]);
                const originalHeight = parseInt(match[2]);
                const aspectRatio = originalHeight / originalWidth;
                const newHeight = Math.round(width * aspectRatio);
                
                optimizedUrl = originalUrl.replace(
                    /\/(\d+)x(\d+)/,
                    `/${width}x${newHeight}`
                );
            }
        }
        
        return this.getOptimizedImageUrl(optimizedUrl);
    }

    preloadCriticalImages() {
        // Identify and preload critical above-the-fold images
        const criticalImages = document.querySelectorAll('img[data-critical="true"]');
        
        criticalImages.forEach(img => {
            const src = img.dataset.src;
            if (src && !this.loadedImages.has(src)) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = this.getOptimizedImageUrl(src);
                document.head.appendChild(link);
            }
        });
    }

    setupImageErrorHandling() {
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
                this.handleImageError(e.target);
            }
        }, true);
    }

    handleImageError(img) {
        // Add error class for styling
        img.classList.add('image-error');
        
        // Try to reload once
        if (!img.dataset.retried) {
            img.dataset.retried = 'true';
            setTimeout(() => {
                img.src = img.dataset.src;
            }, 1000);
        } else {
            // Show fallback image
            img.src = this.getFallbackImageUrl();
            img.alt = 'Image not available';
        }
    }

    getFallbackImageUrl() {
        // Return a generic fallback image
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgNzVIMTc1VjEyNUgxMjVWNzVaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xMzcuNSA5My43NUwxNTAgMTA2LjI1TDE2Mi41IDkzLjc1TDE3NSAxMDYuMjVWMTI1SDEyNVYxMDYuMjVMMTM3LjUgOTMuNzVaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xMDAgMTI1SDEyNVYxNTBIMTAwVjEyNVoiIGZpbGw9IiM5QjlCQTAiLz4KPHA+Cjx0c3BhbiB4PSIxNTAiIHk9IjE3MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOUI5QkEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBOb3QgQXZhaWxhYmxlPC90c3Bhbj4KPC9wPgo8L3N2Zz4K';
    }

    // Progressive image loading
    loadProgressiveImage(img) {
        const lowQualitySrc = img.dataset.lowQuality;
        const highQualitySrc = img.dataset.src;
        
        if (!lowQualitySrc || !highQualitySrc) return;
        
        // Load low quality image first
        img.src = lowQualitySrc;
        img.classList.add('low-quality');
        
        // Then load high quality image
        const highQualityImg = new Image();
        highQualityImg.onload = () => {
            img.src = highQualitySrc;
            img.classList.remove('low-quality');
            img.classList.add('high-quality');
        };
        highQualityImg.src = highQualitySrc;
    }

    // Image compression utility (for uploaded images)
    async compressImage(file, quality = 0.8, maxWidth = 1920, maxHeight = 1080) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to WebP if supported, otherwise JPEG
                const format = this.supportsWebP ? 'image/webp' : 'image/jpeg';
                
                canvas.toBlob(resolve, format, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    // Generate image thumbnails
    generateThumbnail(file, width = 150, height = 150) {
        return this.compressImage(file, 0.7, width, height);
    }

    // Batch optimize images
    async optimizeImages(files) {
        const optimizedImages = [];
        
        for (const file of files) {
            try {
                const optimized = await this.compressImage(file);
                const thumbnail = await this.generateThumbnail(file);
                
                optimizedImages.push({
                    original: file,
                    optimized,
                    thumbnail,
                    size: {
                        original: file.size,
                        optimized: optimized.size,
                        thumbnail: thumbnail.size
                    }
                });
            } catch (error) {
                console.error('Failed to optimize image:', error);
                optimizedImages.push({
                    original: file,
                    error: error.message
                });
            }
        }
        
        return optimizedImages;
    }

    // Get image statistics
    getImageStats() {
        const images = document.querySelectorAll('img');
        const stats = {
            total: images.length,
            loaded: this.loadedImages.size,
            errors: document.querySelectorAll('img.image-error').length,
            webpSupported: this.supportsWebP,
            cacheSize: this.imageCache.size
        };
        
        return stats;
    }
}

// Initialize image optimizer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.imageOptimizer = new ImageOptimizer();
});

// Export for use in other modules
window.ImageOptimizer = ImageOptimizer;
