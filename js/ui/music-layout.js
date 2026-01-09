/**
 * MusicLayout - 音乐区块布局管理模块
 * 
 * 职责：
 * 1. 同步播放器与播放列表的高度
 * 2. 响应式适配（仅桌面端生效）
 * 
 * 实现原理：
 * - 使用 ResizeObserver 监听播放器高度变化
 * - 将播放器高度同步为播放列表的 max-height
 * - 移动端（垂直堆叠布局）时禁用同步
 */

/**
 * 布局常量配置
 */
const LAYOUT_CONSTANTS = {
    SELECTORS: {
        SECTION: '.music-section',
        PLAYER: '.music-player',
        PLAYLIST: '.music-playlist'
    },
    BREAKPOINTS: {
        /** 移动端断点，与 CSS 媒体查询保持一致 */
        MOBILE_MAX: 767
    }
};

/**
 * MusicLayoutManager 类
 * 管理音乐区块的布局同步
 */
class MusicLayoutManager {
    constructor() {
        /** @type {HTMLElement|null} */
        this.section = null;
        /** @type {HTMLElement|null} */
        this.player = null;
        /** @type {HTMLElement|null} */
        this.playlist = null;
        /** @type {ResizeObserver|null} */
        this.resizeObserver = null;
        /** @type {MediaQueryList|null} */
        this.mobileQuery = null;
        /** @type {boolean} */
        this.isInitialized = false;
    }

    /**
     * 初始化布局管理器
     * @returns {boolean} 是否初始化成功
     */
    init() {
        // 防止重复初始化
        if (this.isInitialized) {
            console.warn('[MusicLayout] Already initialized');
            return false;
        }

        // 获取 DOM 元素
        this.section = document.querySelector(LAYOUT_CONSTANTS.SELECTORS.SECTION);
        if (!this.section) {
            return false;
        }

        this.player = this.section.querySelector(LAYOUT_CONSTANTS.SELECTORS.PLAYER);
        this.playlist = this.section.querySelector(LAYOUT_CONSTANTS.SELECTORS.PLAYLIST);

        if (!this.player || !this.playlist) {
            console.warn('[MusicLayout] Player or playlist element not found');
            return false;
        }

        // 初始化媒体查询监听
        this.mobileQuery = window.matchMedia(
            `(max-width: ${LAYOUT_CONSTANTS.BREAKPOINTS.MOBILE_MAX}px)`
        );

        // 初始化 ResizeObserver
        this.resizeObserver = new ResizeObserver(
            this.handleResize.bind(this)
        );

        // 开始观察播放器尺寸变化
        this.resizeObserver.observe(this.player);

        // 监听视口变化（响应式切换）
        this.mobileQuery.addEventListener('change', this.handleMediaChange.bind(this));

        // 立即执行一次同步
        this.syncHeight();

        this.isInitialized = true;
        return true;
    }

    /**
     * ResizeObserver 回调处理
     * @param {ResizeObserverEntry[]} entries - 观察条目
     */
    handleResize(entries) {
        // 使用 requestAnimationFrame 避免布局抖动
        window.requestAnimationFrame(() => {
            this.syncHeight();
        });
    }

    /**
     * 媒体查询变化处理
     * @param {MediaQueryListEvent} event - 媒体查询事件
     */
    handleMediaChange(event) {
        if (event.matches) {
            // 切换到移动端：移除 max-height 限制
            this.clearHeight();
        } else {
            // 切换到桌面端：恢复高度同步
            this.syncHeight();
        }
    }

    /**
     * 同步播放列表高度为播放器高度
     */
    syncHeight() {
        // 移动端不执行同步
        if (this.mobileQuery && this.mobileQuery.matches) {
            return;
        }

        if (!this.player || !this.playlist) {
            return;
        }

        // 获取播放器的 border-box 高度（包含 padding 和 border）
        const playerHeight = this.player.offsetHeight;

        if (playerHeight > 0) {
            this.playlist.style.maxHeight = `${playerHeight}px`;
        }
    }

    /**
     * 清除播放列表的高度限制
     */
    clearHeight() {
        if (this.playlist) {
            this.playlist.style.maxHeight = '';
        }
    }

    /**
     * 销毁布局管理器，释放资源
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.mobileQuery) {
            this.mobileQuery.removeEventListener('change', this.handleMediaChange.bind(this));
            this.mobileQuery = null;
        }

        this.clearHeight();

        this.section = null;
        this.player = null;
        this.playlist = null;
        this.isInitialized = false;
    }
}

// 单例实例
const musicLayoutInstance = new MusicLayoutManager();

/**
 * 初始化音乐布局管理
 * @returns {boolean} 是否初始化成功
 */
export function initMusicLayout() {
    return musicLayoutInstance.init();
}

/**
 * 销毁音乐布局管理
 */
export function destroyMusicLayout() {
    musicLayoutInstance.destroy();
}

/**
 * 获取布局管理器实例（供调试使用）
 */
export function getMusicLayoutInstance() {
    return musicLayoutInstance;
}
