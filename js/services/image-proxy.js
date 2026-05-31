/**
 * Image Proxy Service
 * 图片代理服务模块
 * 
 * 用于解决国内无法直接访问 GitHub Pages 等服务的图片问题
 * 通过第三方 CDN 代理服务（如 weserv.nl）加速图片加载
 * 
 * @module services/image-proxy
 */

/**
 * 代理服务配置
 * @typedef {Object} ProxyConfig
 * @property {boolean} enabled - 是否启用代理
 * @property {string} proxyBaseUrl - 代理服务基础 URL
 * @property {string} siteBaseUrl - 站点基础 URL（用于将相对路径转换为绝对路径）
 * @property {string[]} proxyPatterns - 需要代理的 URL 模式（正则表达式字符串）
 * @property {string[]} excludePatterns - 排除代理的 URL 模式
 */

/**
 * 默认配置
 * @type {ProxyConfig}
 */
const DEFAULT_CONFIG = {
    enabled: true,
    proxyBaseUrl: 'https://images.weserv.nl/?url=',
    siteBaseUrl: '', // 运行时自动检测
    proxyPatterns: [
        // GitHub Pages
        /\.github\.io/,
        // GitHub Raw
        /raw\.githubusercontent\.com/,
        // GitHub User Content
        /githubusercontent\.com/
    ],
    excludePatterns: [
        // 已经是代理 URL
        /images\.weserv\.nl/,
        // Data URLs
        /^data:/,
        // 本地开发
        /localhost/,
        /127\.0\.0\.1/
    ]
};

/**
 * ImageProxyService - 图片代理服务
 * 
 * 设计原则：
 * - 单一职责：仅负责图片 URL 的代理转换
 * - 可配置：支持自定义代理服务和规则
 * - 惰性初始化：首次使用时自动检测环境
 */
export const ImageProxyService = {
    /**
     * 当前配置
     * @private
     * @type {ProxyConfig}
     */
    _config: { ...DEFAULT_CONFIG },

    /**
     * 是否已初始化
     * @private
     * @type {boolean}
     */
    _initialized: false,

    /**
     * 初始化服务
     * 自动检测运行环境并设置站点基础 URL
     * 
     * @param {Partial<ProxyConfig>} [customConfig] - 自定义配置
     */
    init(customConfig = {}) {
        // 合并自定义配置
        this._config = { ...DEFAULT_CONFIG, ...customConfig };

        // 自动检测站点基础 URL
        if (!this._config.siteBaseUrl && typeof window !== 'undefined') {
            this._config.siteBaseUrl = window.location.origin;
        }

        this._initialized = true;
    },

    /**
     * 确保服务已初始化
     * @private
     */
    _ensureInitialized() {
        if (!this._initialized) {
            this.init();
        }
    },

    /**
     * 检查 URL 是否需要代理
     * 
     * @param {string} url - 图片 URL
     * @returns {boolean} 是否需要代理
     */
    shouldProxy(url) {
        this._ensureInitialized();

        if (!this._config.enabled || !url) {
            return false;
        }

        // 检查排除规则
        for (const pattern of this._config.excludePatterns) {
            if (pattern instanceof RegExp) {
                if (pattern.test(url)) return false;
            } else if (typeof pattern === 'string') {
                if (url.includes(pattern)) return false;
            }
        }

        // 检查代理规则
        for (const pattern of this._config.proxyPatterns) {
            if (pattern instanceof RegExp) {
                if (pattern.test(url)) return true;
            } else if (typeof pattern === 'string') {
                if (url.includes(pattern)) return true;
            }
        }

        return false;
    },

    /**
     * 将相对路径转换为绝对 URL
     * 
     * @param {string} path - 相对路径或绝对 URL
     * @returns {string} 绝对 URL
     */
    resolveUrl(path) {
        this._ensureInitialized();

        if (!path) return '';

        // 已经是绝对 URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        // Data URL
        if (path.startsWith('data:')) {
            return path;
        }

        // 相对路径转绝对路径
        const baseUrl = this._config.siteBaseUrl.replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;

        return `${baseUrl}${cleanPath}`;
    },

    /**
     * 获取代理后的图片 URL
     * 
     * @param {string} originalUrl - 原始图片 URL（可以是相对路径或绝对 URL）
     * @returns {string} 代理后的 URL（如果需要代理）或原始 URL
     */
    getProxiedUrl(originalUrl) {
        this._ensureInitialized();

        if (!originalUrl) return '';

        // 解析为绝对 URL
        const absoluteUrl = this.resolveUrl(originalUrl);

        // 检查是否需要代理
        if (!this.shouldProxy(absoluteUrl)) {
            return absoluteUrl;
        }

        // 构建代理 URL
        return `${this._config.proxyBaseUrl}${encodeURIComponent(absoluteUrl)}`;
    },

    /**
     * 批量处理图片 URL
     * 
     * @param {string[]} urls - 原始 URL 数组
     * @returns {string[]} 处理后的 URL 数组
     */
    getProxiedUrls(urls) {
        return urls.map(url => this.getProxiedUrl(url));
    },

    /**
     * 更新配置
     * 
     * @param {Partial<ProxyConfig>} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this._config = { ...this._config, ...newConfig };
    },

    /**
     * 启用代理
     */
    enable() {
        this._config.enabled = true;
    },

    /**
     * 禁用代理
     */
    disable() {
        this._config.enabled = false;
    },

    /**
     * 获取优化后的图片 URL（带尺寸/质量参数）
     * 用于展示和加载阶段
     * 
     * @param {string} originalUrl - 原始图片 URL
     * @param {Object} [options] - 优化选项
     * @param {number} [options.width=800] - 目标宽度（像素）
     * @param {number} [options.quality=80] - 图片质量（1-100）
     * @param {string} [options.format='auto'] - 输出格式（auto/webp/jpeg/png）
     * @returns {string} 优化后的代理 URL
     */
    getOptimizedUrl(originalUrl, options = {}) {
        this._ensureInitialized();

        const { width = 800, quality = 80, format = 'auto' } = options;

        // 先获取基础代理 URL
        const baseProxiedUrl = this.getProxiedUrl(originalUrl);

        // 如果不需要代理，返回原 URL（无法添加 weserv 参数）
        if (!this.shouldProxy(this.resolveUrl(originalUrl))) {
            return baseProxiedUrl;
        }

        // 为 weserv.nl 代理 URL 添加优化参数
        // 参数说明：
        // w=宽度: 缩放到指定宽度
        // q=质量: 1-100，推荐 75-85（对 JPEG）
        // f=格式: auto 表示自动选择最优格式（WebP/AVIF/JPEG）
        const params = `&w=${width}&q=${quality}&f=${format}`;
        return `${baseProxiedUrl}${params}`;
    },

    /**
     * 获取预加载用的中等尺寸 URL（用于渐进加载）
     * 尺寸：500px，质量：75%（平衡体积和清晰度）
     * 
     * @param {string} originalUrl - 原始图片 URL
     * @returns {string} 预加载 URL
     */
    getPreloadUrl(originalUrl) {
        return this.getOptimizedUrl(originalUrl, {
            width: 500,
            quality: 75,
            format: 'auto'
        });
    },

    /**
     * 获取极小的模糊占位符 URL（Base64 编码）
     * 用作 loading 状态下的初始 src
     * 这是一个 1×1 像素的灰色 JPEG（极小，~200 字节）
     * 
     * @returns {string} Base64 Data URL
     */
    getPlaceholderUrl() {
        // 1×1 灰色像素的最小 JPEG（Base64）
        // 生成方式：gray.jpg 压缩到极限
        return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
    },

    /**
     * 获取当前配置（只读）
     * 
     * @returns {Readonly<ProxyConfig>} 当前配置
     */
    getConfig() {
        this._ensureInitialized();
        return Object.freeze({ ...this._config });
    }
};
