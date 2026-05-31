/**
 * Image Load Manager
 * 图片加载生命周期管理模块
 * 
 * 职责：
 * - 集中管理全局 Intersection Observer
 * - 按优先级加载图片（首张优先，相邻预加载）
 * - 跟踪加载状态（待加/加载中/完成/失败/降级）
 * - 处理加载错误和降级逻辑
 * 
 * @module services/image-load-manager
 */

import { ImageProxyService } from './image-proxy.js';

/**
 * 加载状态常量
 */
const LOAD_STATE = {
    PENDING: 'pending',         // 待加载
    LOADING: 'loading',         // 加载中
    LOADED: 'loaded',           // 加载完成
    FAILED: 'failed',           // 加载失败
    FALLBACK: 'fallback'        // 已降级到原图
};

/**
 * 加载优先级常量
 */
const PRIORITY = {
    IMMEDIATE: 2,   // 立即加载（首张、当前可见）
    PRELOAD: 1,     // 预加载（相邻）
    DEFERRED: 0,    // 延迟加载（其他）
    DISABLED: -1    // 禁用（预留）
};

export const ImageLoadManager = {
    /**
     * 全局 Intersection Observer 实例
     * @private
     * @type {IntersectionObserver|null}
     */
    _observer: null,

    /**
     * 已初始化标志
     * @private
     * @type {boolean}
     */
    _initialized: false,

    /**
     * 加载队列 Map: url → { state, priority, element, retryCount }
     * @private
     * @type {Map}
     */
    _loadQueue: new Map(),

    /**
     * 加载中的图片集合（防止并发重复加载）
     * @private
     * @type {Set}
     */
    _loadingUrls: new Set(),

    /**
     * 已加载的图片集合（缓存已成功加载的 URL）
     * @private
     * @type {Set}
     */
    _loadedUrls: new Set(),

    /**
     * 失败重试的最大次数
     * @private
     * @type {number}
     */
    _maxRetries: 3,

    /**
     * 初始化加载管理器
     * 创建全局 Intersection Observer
     */
    init() {
        if (this._initialized) {
            return;
        }

        const options = {
            // threshold: 0.1 表示图片至少有 10% 进入视口时触发
            threshold: 0.1,
            // rootMargin: '100px' 表示在视口外提前 100px 时就开始加载
            rootMargin: '100px'
        };

        this._observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this._onImageIntersect(entry.target);
                }
            });
        }, options);

        this._initialized = true;
    },

    /**
     * 确保已初始化
     * @private
     */
    _ensureInitialized() {
        if (!this._initialized) {
            this.init();
        }
    },

    /**
     * 注册图集内的所有图片进行懒加载管理
     * 
     * @param {HTMLElement} galleryEl - 图集容器元素
     */
    registerGalleryImages(galleryEl) {
        this._ensureInitialized();

        if (!galleryEl) return;

        const images = galleryEl.querySelectorAll('[data-src]');

        images.forEach((img, index) => {
            const dataSrc = img.dataset.src;
            if (!dataSrc) return;

            // 确定优先级
            // - 第 0 张（首张）：优先级 IMMEDIATE（用户一定会看到）
            // - 第 1, 2 张：优先级 PRELOAD（相邻，用户可能看到）
            // - 其他：优先级 DEFERRED（延迟加载）
            let priority = PRIORITY.DEFERRED;
            if (index === 0) {
                priority = PRIORITY.IMMEDIATE;
            } else if (index <= 2) {
                priority = PRIORITY.PRELOAD;
            }

            // 记录到队列
            const key = dataSrc;
            if (!this._loadQueue.has(key)) {
                this._loadQueue.set(key, {
                    state: LOAD_STATE.PENDING,
                    priority,
                    elements: new Set([img]),
                    retryCount: 0,
                    originalUrl: dataSrc
                });
            } else {
                // 多个图片使用同一 URL 时，将 img 元素加入集合
                this._loadQueue.get(key).elements.add(img);
            }

            // 立即加载优先级高的图
            if (priority >= PRIORITY.PRELOAD) {
                this._loadImageImmediate(img, dataSrc);
            } else {
                // 其他图片注册到 observer
                this._observer.observe(img);
            }
        });
    },

    /**
     * 当图片进入视口时的回调
     * @private
     * @param {HTMLImageElement} img - 图片元素
     */
    _onImageIntersect(img) {
        const dataSrc = img.dataset.src;
        if (!dataSrc) return;

        this._observer.unobserve(img);
        this._loadImageImmediate(img, dataSrc);
    },

    /**
     * 立即加载图片
     * @private
     * @param {HTMLImageElement} img - 图片元素
     * @param {string} dataSrc - 优化后的图片 URL
     */
    _loadImageImmediate(img, dataSrc) {
        // 如果已加载过，直接赋值
        if (this._loadedUrls.has(dataSrc)) {
            img.src = dataSrc;
            img.removeAttribute('data-src');
            return;
        }

        // 如果正在加载，等待
        if (this._loadingUrls.has(dataSrc)) {
            return;
        }

        // 标记为加载中
        this._loadingUrls.add(dataSrc);

        // 创建临时 Image 对象进行预加载
        const tempImg = new Image();

        tempImg.onload = () => {
            // 加载成功
            this._loadingUrls.delete(dataSrc);
            this._loadedUrls.add(dataSrc);

            // 将真实 src 赋值到所有引用这个 URL 的 img 元素
            this._applyLoadedUrl(dataSrc);
        };

        tempImg.onerror = () => {
            // 加载失败，尝试降级
            this._loadingUrls.delete(dataSrc);
            this._handleLoadError(dataSrc);
        };

        // 触发加载
        tempImg.src = dataSrc;
    },

    /**
     * 应用已加载的 URL 到所有相关元素
     * @private
     * @param {string} url - 已加载的 URL
     */
    _applyLoadedUrl(url) {
        const queueEntry = this._loadQueue.get(url);
        if (!queueEntry) return;

        queueEntry.elements.forEach((img) => {
            if (img && img.parentElement) {  // 检查元素仍在 DOM 中
                img.src = url;
                img.removeAttribute('data-src');
            }
        });

        queueEntry.state = LOAD_STATE.LOADED;
    },

    /**
     * 处理图片加载错误，尝试降级方案
     * @private
     * @param {string} optimizedUrl - 优化后的 URL（失败）
     */
    _handleLoadError(optimizedUrl) {
        const queueEntry = this._loadQueue.get(optimizedUrl);
        if (!queueEntry) return;

        const retryCount = (queueEntry.retryCount || 0) + 1;
        queueEntry.retryCount = retryCount;

        // 降级策略链：优化URL → 原始URL → 占位符
        let fallbackUrl = null;

        if (retryCount === 1) {
            // 第1次失败：尝试原始 URL（去掉代理）
            fallbackUrl = queueEntry.originalUrl;
        } else if (retryCount === 2) {
            // 第2次失败：尝试预加载版本（可能更稳定）
            fallbackUrl = ImageProxyService.getPreloadUrl(queueEntry.originalUrl);
        } else {
            // 多次失败：使用灰色占位符，放弃重试
            queueEntry.elements.forEach((img) => {
                if (img && img.parentElement) {
                    img.style.backgroundColor = '#e5e5e5';
                    img.removeAttribute('data-src');
                }
            });
            queueEntry.state = LOAD_STATE.FALLBACK;

            console.warn(
                `[ImageLoadManager] Failed to load image after ${retryCount} retries: ${optimizedUrl}`
            );
            return;
        }

        // 重试加载
        if (fallbackUrl && retryCount <= this._maxRetries) {
            console.debug(
                `[ImageLoadManager] Retrying with fallback URL (attempt ${retryCount}): ${fallbackUrl}`
            );

            const tempImg = new Image();
            tempImg.onload = () => {
                this._loadedUrls.add(fallbackUrl);
                queueEntry.elements.forEach((img) => {
                    if (img && img.parentElement) {
                        img.src = fallbackUrl;
                        img.removeAttribute('data-src');
                    }
                });
                queueEntry.state = LOAD_STATE.LOADED;
            };

            tempImg.onerror = () => {
                this._handleLoadError(optimizedUrl);
            };

            tempImg.src = fallbackUrl;
        }
    },

    /**
     * 清理和销毁管理器
     * 用于页面卸载或主动清理
     */
    destroy() {
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }

        this._loadQueue.clear();
        this._loadingUrls.clear();
        this._initialized = false;
    },

    /**
     * 获取统计信息（用于调试）
     * @returns {Object} 统计数据
     */
    getStats() {
        return {
            initialized: this._initialized,
            queueSize: this._loadQueue.size,
            loadingCount: this._loadingUrls.size,
            loadedCount: this._loadedUrls.size,
            observerConnected: this._observer ? true : false
        };
    }
};
