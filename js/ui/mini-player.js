import { AudioPlayer } from './audio-player.js';

/**
 * MiniPlayer - 移动端迷你播放器模块
 * 
 * 职责：
 * 1. 当音乐区滚出视野且音乐正在播放时，显示迷你播放条
 * 2. 同步当前歌曲信息（封面、标题、艺术家）
 * 3. 提供播放/暂停/下一首控制
 * 4. 点击跳转回音乐区
 * 
 * 依赖：
 * - AudioPlayer：音频播放状态和控制
 * - IntersectionObserver：检测音乐区可见性
 */

export const MiniPlayer = {
    // --- State ---
    state: {
        isPlaying: false,
        isMusicSectionVisible: true,
        currentTrack: null,
        isInitialized: false
    },

    // --- DOM References ---
    elements: {
        container: null,
        cover: null,
        title: null,
        artist: null,
        playBtn: null,
        nextBtn: null
    },

    // --- Observer ---
    intersectionObserver: null,

    // --- Constants ---
    SELECTORS: {
        MUSIC_SECTION: '.music-section'
    },

    ICONS: {
        PLAY: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        PAUSE: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>',
        NEXT: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/></svg>'
    },

    /**
     * 初始化迷你播放器
     * 仅在移动端生效
     */
    init() {
        // 防止重复初始化
        if (this.state.isInitialized) return;

        // 检测是否为移动端视口
        if (!this.isMobileViewport()) {
            // 非移动端不初始化，但监听视口变化
            this.setupViewportListener();
            return;
        }

        this.createDOM();
        this.bindEvents();
        this.setupIntersectionObserver();
        this.subscribeToAudioEvents();

        this.state.isInitialized = true;
    },

    /**
     * 检测是否为移动端视口
     */
    isMobileViewport() {
        return window.matchMedia('(max-width: 767px)').matches;
    },

    /**
     * 监听视口变化，必要时初始化或销毁
     */
    setupViewportListener() {
        const mediaQuery = window.matchMedia('(max-width: 767px)');

        const handleChange = (e) => {
            if (e.matches && !this.state.isInitialized) {
                // 切换到移动端，初始化
                this.createDOM();
                this.bindEvents();
                this.setupIntersectionObserver();
                this.subscribeToAudioEvents();
                this.state.isInitialized = true;
            }
            // 注意：切换到桌面端时不销毁，CSS 会隐藏它
        };

        mediaQuery.addEventListener('change', handleChange);
    },

    /**
     * 创建迷你播放器 DOM 结构
     */
    createDOM() {
        // 如果已存在则不重复创建
        if (document.querySelector('.mini-player')) return;

        const html = `
            <div class="mini-player" role="region" aria-label="迷你播放器">
                <img class="mini-player-cover" src="" alt="专辑封面" />
                <div class="mini-player-info">
                    <p class="mini-player-title">未播放</p>
                    <p class="mini-player-artist">--</p>
                </div>
                <div class="mini-player-controls">
                    <button class="mini-player-btn mini-player-btn-play" 
                            aria-label="播放/暂停">
                        ${this.ICONS.PLAY}
                    </button>
                    <button class="mini-player-btn mini-player-btn-next" 
                            aria-label="下一首">
                        ${this.ICONS.NEXT}
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        // 缓存 DOM 引用
        this.elements.container = document.querySelector('.mini-player');
        this.elements.cover = this.elements.container.querySelector('.mini-player-cover');
        this.elements.title = this.elements.container.querySelector('.mini-player-title');
        this.elements.artist = this.elements.container.querySelector('.mini-player-artist');
        this.elements.playBtn = this.elements.container.querySelector('.mini-player-btn-play');
        this.elements.nextBtn = this.elements.container.querySelector('.mini-player-btn-next');
    },

    /**
     * 绑定用户交互事件
     */
    bindEvents() {
        if (!this.elements.container) return;

        // 播放/暂停按钮
        this.elements.playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            AudioPlayer.toggle();
        });

        // 下一首按钮
        this.elements.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            AudioPlayer.next();
        });

        // 点击信息区域滚动到音乐区
        this.elements.container.querySelector('.mini-player-info').addEventListener('click', () => {
            this.scrollToMusicSection();
        });

        // 点击封面也滚动到音乐区
        this.elements.cover.addEventListener('click', () => {
            this.scrollToMusicSection();
        });
    },

    /**
     * 设置 IntersectionObserver 监听音乐区可见性
     */
    setupIntersectionObserver() {
        const musicSection = document.querySelector(this.SELECTORS.MUSIC_SECTION);
        if (!musicSection) {
            // 音乐区尚未渲染，延迟重试
            setTimeout(() => this.setupIntersectionObserver(), 500);
            return;
        }

        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    this.state.isMusicSectionVisible = entry.isIntersecting;
                    this.updateVisibility();
                });
            },
            {
                root: null, // Mobile uses viewport scrolling
                threshold: 0.1 // 10% 可见即认为可见
            }
        );

        this.intersectionObserver.observe(musicSection);
    },

    /**
     * 订阅 AudioPlayer 事件
     */
    subscribeToAudioEvents() {
        const { EVENTS } = AudioPlayer.CONSTANTS;

        // 播放事件
        AudioPlayer.on(EVENTS.PLAY, () => {
            this.state.isPlaying = true;
            this.updatePlayButton();
            this.updateVisibility();
        });

        // 暂停事件
        AudioPlayer.on(EVENTS.PAUSE, () => {
            this.state.isPlaying = false;
            this.updatePlayButton();
            this.updateVisibility();
        });

        // 曲目变更事件
        AudioPlayer.on(EVENTS.TRACK_CHANGE, ({ track }) => {
            this.state.currentTrack = track;
            this.syncTrackInfo(track);
        });
    },

    /**
     * 更新迷你播放器可见性
     * 条件：正在播放 且 音乐区不可见
     */
    updateVisibility() {
        if (!this.elements.container) return;

        const shouldShow = this.state.isPlaying && !this.state.isMusicSectionVisible;

        if (shouldShow) {
            this.elements.container.classList.add('is-visible');
        } else {
            this.elements.container.classList.remove('is-visible');
        }
    },

    /**
     * 同步歌曲信息到迷你播放器
     */
    syncTrackInfo(track) {
        if (!this.elements.container || !track) return;

        // 封面
        if (track.cover) {
            this.elements.cover.src = track.cover;
            this.elements.cover.alt = `${track.title || '专辑'} 封面`;
        }

        // 标题
        if (track.title) {
            this.elements.title.textContent = track.title;
        }

        // 艺术家
        if (track.artist) {
            this.elements.artist.textContent = track.artist;
        }
    },

    /**
     * 更新播放/暂停按钮图标
     */
    updatePlayButton() {
        if (!this.elements.playBtn) return;

        this.elements.playBtn.innerHTML = this.state.isPlaying
            ? this.ICONS.PAUSE
            : this.ICONS.PLAY;

        this.elements.playBtn.setAttribute(
            'aria-label',
            this.state.isPlaying ? '暂停' : '播放'
        );
    },

    /**
     * 平滑滚动到音乐区
     */
    scrollToMusicSection() {
        const musicSection = document.querySelector(this.SELECTORS.MUSIC_SECTION);
        if (!musicSection) return;

        musicSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    },

    /**
     * 销毁迷你播放器（清理资源）
     */
    destroy() {
        // 断开观察器
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }

        // 移除 DOM
        if (this.elements.container) {
            this.elements.container.remove();
        }

        // 重置状态
        this.state.isInitialized = false;
        this.elements = {
            container: null,
            cover: null,
            title: null,
            artist: null,
            playBtn: null,
            nextBtn: null
        };
    }
};
