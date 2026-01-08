/**
 * AudioPlayer - 音频播放控制模块 (Refactored)
 * 
 * 职责：
 * 1. 管理 HTMLAudioElement 实例
 * 2. 处理播放/暂停/切换歌曲
 * 3. 发布音频状态事件 (Pub/Sub)
 * 
 * 优化点：
 * - 解耦 UI：不再直接操作 DOM，而是发布事件
 * - 集中配置：CONSTANTS 管理类名和选择器
 * - 性能优化：防抖处理
 */

const CONSTANTS = {
    CLASSES: {
        PLAYING: 'is-playing',
        CURRENT: 'is-current'
    },
    SELECTORS: {
        SECTION: '.music-section',
        PLAY_BTN: '.player-btn-play',
        PREV_BTN: '.player-btn-prev',
        NEXT_BTN: '.player-btn-next',
        PROGRESS_BAR: '.player-progress-bar',
        PROGRESS_FILL: '.player-progress-fill',
        TIME_CURRENT: '.player-time-current',
        TIME_DURATION: '.player-time-duration',
        TITLE: '.player-title',
        ARTIST: '.player-artist',
        COVER: '.player-cover',
        LINK: '.player-link',
        PLAYLIST_ITEM: '.playlist-item'
    },
    EVENTS: {
        PLAY: 'audio:play',
        PAUSE: 'audio:pause',
        TIME_UPDATE: 'audio:timeupdate',
        TRACK_CHANGE: 'audio:trackchange',
        ERROR: 'audio:error'
    },
    ICONS: {
        PLAY: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        PAUSE: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>',
        PREV: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
        NEXT: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/></svg>'
    }
};

// 简单的事件总线
const EventBus = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
};

export const AudioPlayer = {
    audio: null,
    currentIndex: 0,
    playlist: [],
    isPlaying: false,
    progressTimer: null,

    // 暴露常量供外部使用
    CONSTANTS,

    // 暴露事件订阅方法
    on: EventBus.on.bind(EventBus),

    /**
     * 初始化播放器
     */
    init(playlist) {
        if (!playlist || playlist.length === 0) {
            console.warn('[AudioPlayer] Empty playlist');
            return;
        }

        this.playlist = playlist;
        this.currentIndex = 0;
        this.isPlaying = false;

        this.audio = new Audio();
        this.audio.preload = 'metadata';

        this.bindAudioEvents();
        // UI 绑定逻辑移至 render.js 或外部模块

        // 加载第一首
        this.loadTrack(0, false);
    },

    bindAudioEvents() {
        if (!this.audio) return;

        this.audio.addEventListener('ended', () => this.next());

        this.audio.addEventListener('loadedmetadata', () => {
            EventBus.emit(CONSTANTS.EVENTS.TRACK_CHANGE, {
                track: this.playlist[this.currentIndex],
                index: this.currentIndex,
                track: this.playlist[this.currentIndex],
                index: this.currentIndex,
                duration: this.audio.duration * 1000 // Convert to MS for consistency
            });
        });

        this.audio.addEventListener('error', (e) => {
            console.error('[AudioPlayer] Error:', e);
            EventBus.emit(CONSTANTS.EVENTS.ERROR, e);
            this.pause();
        });

        // 使用 timeupdate 事件替代以前的定时器，更准确
        this.audio.addEventListener('timeupdate', () => {
            EventBus.emit(CONSTANTS.EVENTS.TIME_UPDATE, {
                currentTime: this.audio.currentTime * 1000, // Convert to MS
                duration: this.audio.duration * 1000 // Convert to MS
            });
        });
    },

    loadTrack(index, autoPlay = true) {
        if (index < 0 || index >= this.playlist.length) return;

        const track = this.playlist[index];
        this.currentIndex = index;

        if (this.audio && track.audioPreview) {
            this.audio.src = track.audioPreview;

            // 立即触发一次轨道变更事件，更新 UI 信息
            EventBus.emit(CONSTANTS.EVENTS.TRACK_CHANGE, {
                track: track,
                index: index,
                duration: 0 // 时长稍后由 loadedmetadata 更新
            });

            if (autoPlay) {
                this.audio.play()
                    .then(() => {
                        this.isPlaying = true;
                        EventBus.emit(CONSTANTS.EVENTS.PLAY, index);
                    })
                    .catch((err) => {
                        console.warn('[AudioPlayer] Autoplay blocked:', err);
                        this.isPlaying = false;
                        EventBus.emit(CONSTANTS.EVENTS.PAUSE, index);
                    });
            } else {
                this.isPlaying = false;
                EventBus.emit(CONSTANTS.EVENTS.PAUSE, index);
            }
        }
    },

    play(index) {
        if (index === this.currentIndex && this.isPlaying) {
            this.pause();
        } else {
            this.loadTrack(index, true);
        }
    },

    pause() {
        if (this.audio) this.audio.pause();
        this.isPlaying = false;
        EventBus.emit(CONSTANTS.EVENTS.PAUSE, this.currentIndex);
    },

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else if (this.audio) {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    EventBus.emit(CONSTANTS.EVENTS.PLAY, this.currentIndex);
                })
                .catch(() => { });
        }
    },

    prev() {
        const newIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        this.loadTrack(newIndex, true);
    },

    next() {
        const newIndex = this.currentIndex < this.playlist.length - 1 ? this.currentIndex + 1 : 0;
        this.loadTrack(newIndex, true);
    },

    seek(percent) {
        if (this.audio && this.audio.duration) {
            this.audio.currentTime = percent * this.audio.duration;
        }
    },

    destroy() {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
            this.audio = null;
        }
        this.playlist = [];
        EventBus.listeners = {};
    }
};
