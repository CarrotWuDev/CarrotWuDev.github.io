import { AudioPlayer } from './audio-player.js';

/**
 * NavIndicator - 导航栏音频状态指示器模块
 * 
 * 职责：
 * 1. 监听 AudioPlayer 播放/暂停事件
 * 2. 切换"音乐"导航链接的播放状态 class
 * 3. 仅在桌面端生效（移动端使用 Mini Player）
 * 
 * 依赖：
 * - AudioPlayer：音频播放状态事件
 */

export const NavIndicator = {
    // --- State ---
    state: {
        isInitialized: false,
        musicNavLink: null
    },

    // --- Selectors ---
    SELECTORS: {
        MUSIC_NAV: '.type-nav a[data-type="music"]'
    },

    // --- Class Names ---
    CLASSES: {
        PLAYING: 'is-playing',
        PAUSED: 'is-paused'
    },

    /**
     * 初始化指示器
     */
    init() {
        // 防止重复初始化
        if (this.state.isInitialized) return;

        // 获取音乐导航链接
        this.state.musicNavLink = document.querySelector(this.SELECTORS.MUSIC_NAV);

        if (!this.state.musicNavLink) {
            // 导航尚未渲染，延迟重试
            setTimeout(() => this.init(), 500);
            return;
        }

        // 注入指示器 HTML 结构
        this.injectIndicatorHTML();

        // 订阅音频事件
        this.subscribeToAudioEvents();

        this.state.isInitialized = true;
    },

    /**
     * 在导航链接中注入指示器 HTML
     */
    injectIndicatorHTML() {
        if (!this.state.musicNavLink) return;

        // 检查是否已存在
        if (this.state.musicNavLink.querySelector('.nav-audio-indicator')) return;

        const indicatorHTML = `
            <span class="nav-audio-indicator" aria-hidden="true">
                <span class="nav-audio-bar"></span>
                <span class="nav-audio-bar"></span>
                <span class="nav-audio-bar"></span>
            </span>
        `;

        this.state.musicNavLink.insertAdjacentHTML('beforeend', indicatorHTML);
    },

    /**
     * 订阅 AudioPlayer 事件
     */
    subscribeToAudioEvents() {
        const { EVENTS } = AudioPlayer.CONSTANTS;

        // 播放事件
        AudioPlayer.on(EVENTS.PLAY, () => {
            this.setPlayingState();
        });

        // 暂停事件
        AudioPlayer.on(EVENTS.PAUSE, () => {
            this.setPausedState();
        });

        // 错误事件（视为停止）
        AudioPlayer.on(EVENTS.ERROR, () => {
            this.clearState();
        });
    },

    /**
     * 设置播放状态
     */
    setPlayingState() {
        if (!this.state.musicNavLink) return;

        this.state.musicNavLink.classList.remove(this.CLASSES.PAUSED);
        this.state.musicNavLink.classList.add(this.CLASSES.PLAYING);
    },

    /**
     * 设置暂停状态
     */
    setPausedState() {
        if (!this.state.musicNavLink) return;

        this.state.musicNavLink.classList.remove(this.CLASSES.PLAYING);
        this.state.musicNavLink.classList.add(this.CLASSES.PAUSED);
    },

    /**
     * 清除状态（停止播放）
     */
    clearState() {
        if (!this.state.musicNavLink) return;

        this.state.musicNavLink.classList.remove(this.CLASSES.PLAYING);
        this.state.musicNavLink.classList.remove(this.CLASSES.PAUSED);
    }
};
