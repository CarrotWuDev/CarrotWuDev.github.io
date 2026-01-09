import { AudioPlayer } from './audio-player.js';
import { attachScrollBehavior } from './scroll.js';

/**
 * MusicUI - 音乐板块统一管理模块
 * 职责：渲染、交互、布局同步
 */
export const MusicUI = {
    layoutState: {
        section: null,
        player: null,
        playlist: null,
        resizeObserver: null,
        mobileQuery: null,
        isInitialized: false
    },

    /**
     * 初始化音乐模块
     */
    init() {
        this.initPlayerEvents(); // 订阅播放器事件
        this.initDOMEvents();    // 绑定 DOM 交互
    },

    /**
     * 渲染音乐 Section HTML
     * @param {Array} items - 歌曲列表
     */
    render(items) {
        if (!items || items.length === 0) return '';

        const firstTrack = items[0];

        // Helper: Process cover URL
        const getCoverUrl = (item) => {
            if (!item.cover) return '';
            let url = item.cover;
            if (url.startsWith('../')) url = url.substring(3);
            return url;
        };

        const getArtist = (item) => item.artist || item.author || '未知艺术家';

        // Icons shorthand
        const { ICONS } = AudioPlayer.CONSTANTS;

        const playerHtml = `
            <div class="music-player">
                <img class="player-cover" 
                     src="${getCoverUrl(firstTrack)}" 
                     alt="${firstTrack.title || '专辑封面'}"
                     loading="lazy">
                <div class="player-info">
                    <h3 class="player-title">${firstTrack.title || '未命名'}</h3>
                    <p class="player-artist">${getArtist(firstTrack)}</p>
                </div>
                <div class="player-progress-wrapper">
                    <div class="player-progress-bar">
                        <div class="player-progress-fill"></div>
                    </div>
                    <div class="player-time">
                        <span class="player-time-current">0:00</span>
                        <span class="player-time-duration">${this.formatDuration(firstTrack.duration)}</span>
                    </div>
                </div>
                <div class="player-controls">
                    <button class="player-btn player-btn-prev" aria-label="上一首">
                        ${ICONS.PREV}
                    </button>
                    <button class="player-btn player-btn-play" aria-label="播放">
                        ${ICONS.PLAY}
                    </button>
                    <button class="player-btn player-btn-next" aria-label="下一首">
                        ${ICONS.NEXT}
                    </button>
                </div>
                ${firstTrack.linkUrl ? `
                    <a class="player-link" href="${firstTrack.linkUrl}" target="_blank" rel="noopener">
                        <svg class="spotify-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                        在 Spotify 收听
                    </a>
                ` : ''}
            </div>
        `;

        const playlistItemsHtml = items.map((item, index) => `
            <div class="playlist-item ${index === 0 ? 'is-current' : ''}" 
                 data-index="${index}"
                 data-audio="${item.audioPreview || ''}">
                <div class="playlist-item-cover-wrapper">
                    <img class="playlist-item-cover" 
                         src="${getCoverUrl(item)}" 
                         alt="${item.title}"
                         loading="lazy">
                    <div class="playing-indicator">
                        <span class="bar bar-1"></span>
                        <span class="bar bar-2"></span>
                        <span class="bar bar-3"></span>
                        <span class="bar bar-4"></span>
                    </div>
                </div>
                <div class="playlist-item-info">
                    <h4 class="playlist-item-title">${item.title || '未命名'}</h4>
                    <p class="playlist-item-artist">${getArtist(item)}</p>
                </div>
                <span class="playlist-item-duration">${this.formatDuration(item.duration)}</span>
            </div>
        `).join('');

        const playlistHtml = `
            <div class="music-playlist">
                <div class="playlist-header">
                    <h3 class="playlist-title">播放列表 (${items.length})</h3>
                </div>
                <div class="playlist-content">
                    ${playlistItemsHtml}
                </div>
            </div>
        `;

        // Store minimal data in dataset for player to pick up if needed, though we use AudioPlayer directly now
        return `
            <div class="music-section" data-playlist='${JSON.stringify(items.map(item => ({
            title: item.title,
            artist: getArtist(item),
            cover: getCoverUrl(item),
            audioPreview: item.audioPreview,
            duration: item.duration,
            linkUrl: item.linkUrl
        })))}'>
                ${playerHtml}
                ${playlistHtml}
            </div>
        `;
    },

    initPlayerEvents() {
        const { EVENTS, SELECTORS, CLASSES, ICONS } = AudioPlayer.CONSTANTS;

        AudioPlayer.on(EVENTS.TRACK_CHANGE, ({ track, index, duration }) => {
            const section = document.querySelector(SELECTORS.SECTION);
            if (!section) return;

            const cover = section.querySelector(SELECTORS.COVER);
            const title = section.querySelector(SELECTORS.TITLE);
            const artist = section.querySelector(SELECTORS.ARTIST);
            const durationEl = section.querySelector(SELECTORS.TIME_DURATION);
            const link = section.querySelector(SELECTORS.LINK);

            if (cover) { cover.src = track.cover; cover.alt = track.title; }
            if (title) title.textContent = track.title || '未命名';
            if (artist) artist.textContent = track.artist || '未知艺术家';
            if (durationEl) durationEl.textContent = this.formatDuration(duration || track.duration);
            if (link) link.href = track.linkUrl || '#';

            // 更新列表高亮
            const items = section.querySelectorAll(SELECTORS.PLAYLIST_ITEM);
            items.forEach((item, i) => item.classList.toggle(CLASSES.CURRENT, i === index));

            // 重置进度
            const progress = section.querySelector(SELECTORS.PROGRESS_FILL);
            const currTime = section.querySelector(SELECTORS.TIME_CURRENT);
            if (progress) progress.style.width = '0%';
            if (currTime) currTime.textContent = '0:00';
        });

        AudioPlayer.on(EVENTS.PLAY, () => {
            const section = document.querySelector(SELECTORS.SECTION);
            const playBtn = section?.querySelector(SELECTORS.PLAY_BTN);
            if (section) section.classList.add(CLASSES.PLAYING);
            if (playBtn) playBtn.innerHTML = ICONS.PAUSE;
        });

        AudioPlayer.on(EVENTS.PAUSE, () => {
            const section = document.querySelector(SELECTORS.SECTION);
            const playBtn = section?.querySelector(SELECTORS.PLAY_BTN);
            if (section) section.classList.remove(CLASSES.PLAYING);
            if (playBtn) playBtn.innerHTML = ICONS.PLAY;
        });

        AudioPlayer.on(EVENTS.TIME_UPDATE, ({ currentTime, duration }) => {
            if (this.isDragging) return;

            const section = document.querySelector(SELECTORS.SECTION);
            if (!section) return;

            const progressFill = section.querySelector(SELECTORS.PROGRESS_FILL);
            const currentTimeEl = section.querySelector(SELECTORS.TIME_CURRENT);

            if (progressFill && duration) {
                const percent = (currentTime / duration) * 100;
                progressFill.style.width = `${percent}%`;
            }
            if (currentTimeEl) {
                currentTimeEl.textContent = this.formatDuration(currentTime);
            }
        });
    },

    initDOMEvents() {
        const { SELECTORS } = AudioPlayer.CONSTANTS;
        this.isDragging = false;

        document.body.addEventListener('click', (e) => {
            if (e.target.closest(SELECTORS.PLAY_BTN)) {
                AudioPlayer.toggle();
                return;
            }
            if (e.target.closest(SELECTORS.PREV_BTN)) {
                AudioPlayer.prev();
                return;
            }
            if (e.target.closest(SELECTORS.NEXT_BTN)) {
                AudioPlayer.next();
                return;
            }
            const item = e.target.closest(SELECTORS.PLAYLIST_ITEM);
            if (item) {
                const index = parseInt(item.dataset.index, 10);
                if (!isNaN(index)) AudioPlayer.play(index);
                return;
            }
            const bar = e.target.closest(SELECTORS.PROGRESS_BAR);
            if (bar && !this.isDragging) {
                const rect = bar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                AudioPlayer.seek(percent);
            }
        });

        // 拖拽逻辑
        document.body.addEventListener('mousedown', (e) => {
            const bar = e.target.closest(SELECTORS.PROGRESS_BAR);
            if (!bar) return;

            this.isDragging = true;
            const progressFill = bar.querySelector(SELECTORS.PROGRESS_FILL);
            const section = document.querySelector(SELECTORS.SECTION);
            const currentTimeEl = section?.querySelector(SELECTORS.TIME_CURRENT);
            if (progressFill) progressFill.style.transition = 'none';

            const updateDrag = (clientX) => {
                const rect = bar.getBoundingClientRect();
                let percent = (clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent));
                if (progressFill) progressFill.style.width = `${percent * 100}%`;
                if (currentTimeEl && AudioPlayer.audio && AudioPlayer.audio.duration) {
                    const previewTime = percent * AudioPlayer.audio.duration * 1000;
                    currentTimeEl.textContent = this.formatDuration(previewTime);
                }
            };

            updateDrag(e.clientX);

            const onMouseMove = (moveEvent) => {
                moveEvent.preventDefault();
                updateDrag(moveEvent.clientX);
            };

            const onMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                const rect = bar.getBoundingClientRect();
                let percent = (upEvent.clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent));
                AudioPlayer.seek(percent);

                if (progressFill) {
                    requestAnimationFrame(() => progressFill.style.transition = '');
                }
                setTimeout(() => this.isDragging = false, 100);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    },

    // --- Layout Logic (Merged from music-layout.js) ---

    initLayout() {
        const state = this.layoutState;
        if (state.isInitialized) return;

        state.section = document.querySelector('.music-section');
        if (!state.section) return; // Might happen if no music section rendered

        state.player = state.section.querySelector('.music-player');
        state.playlist = state.section.querySelector('.music-playlist');

        if (!state.player || !state.playlist) return;

        // Mobile Breakpoint (767px)
        state.mobileQuery = window.matchMedia('(max-width: 767px)');

        state.resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => this.syncLayoutHeight());
        });

        state.resizeObserver.observe(state.player);
        state.mobileQuery.addEventListener('change', (e) => this.handleMediaChange(e));

        this.syncLayoutHeight();

        // Initialize custom scrollbar behavior for playlist content
        const content = state.playlist.querySelector('.playlist-content');
        if (content) attachScrollBehavior(content);

        state.isInitialized = true;
    },

    handleMediaChange(e) {
        if (e.matches) {
            this.clearLayoutHeight();
        } else {
            this.syncLayoutHeight();
        }
    },

    syncLayoutHeight() {
        const state = this.layoutState;
        if (state.mobileQuery && state.mobileQuery.matches) return;
        if (!state.player || !state.playlist) return;

        const h = state.player.offsetHeight;
        if (h > 0) state.playlist.style.maxHeight = `${h}px`;
    },

    clearLayoutHeight() {
        if (this.layoutState.playlist) {
            this.layoutState.playlist.style.maxHeight = '';
        }
    },

    // --- Utils ---

    formatDuration(ms) {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
};
