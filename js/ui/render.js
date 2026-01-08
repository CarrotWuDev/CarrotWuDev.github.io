import { openLightbox } from './lightbox.js';
import { slugify } from '../core/utils.js';
import { AudioPlayer } from './audio-player.js';

/**
 * 类型注册表 - 集中定义所有已知类型
 */
const TYPE_REGISTRY = {
    project: { hasStaticCSS: true },
    game: { hasStaticCSS: true },
    photo: { hasStaticCSS: true },
    book: { hasStaticCSS: true },
    diary: { hasStaticCSS: true },
    music: { hasStaticCSS: true }
};

/**
 * 心情文字 → Emoji 映射
 * @see 日记.md 中定义的心情选项
 */
const MOOD_EMOJI_MAP = {
    '开心': '😊',
    '平静': '😌',
    '一般': '😐',
    '疲惫': '😩',
    '低落': '😔',
    '焦虑': '😰',
    '生气': '😠'
};

/**
 * 天气文字 → Emoji 映射
 * @see 日记.md 中定义的天气选项
 */
const WEATHER_EMOJI_MAP = {
    '晴朗': '☀️',
    '多云': '⛅',
    '阴天': '☁️',
    '小雨': '🌧️',
    '雷雨': '⛈️',
    '雪': '❄️',
    '雾': '🌫️',
    '风': '💨'
};

export const RenderService = {
    /**
     * 初始化交互 (事件委托)
     */
    init() {
        // Global Event Delegation using "focus-group" style management

        // 1. Click Handler (Lightbox, Nav, Gallery)
        document.body.addEventListener('click', (e) => {
            // A. Lightbox
            const lightboxTrigger = e.target.closest('.lightbox-trigger');
            if (lightboxTrigger) {
                const src = lightboxTrigger.dataset.src;
                const caption = lightboxTrigger.dataset.caption;
                if (src) openLightbox(src, caption);
                return;
            }

            // B. Type Nav (ScrollSpy Integration)
            // 阻止浏览器默认锚点行为，由自定义滚动逻辑接管
            // @see SPA navigation best practice: https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
            const navLink = e.target.closest('.type-nav a');
            if (navLink) {
                e.preventDefault();
                const event = new CustomEvent('nav-click', { detail: { id: navLink.dataset.target } });
                document.dispatchEvent(event);
                return;
            }

            // C. Gallery Navigation (Prev/Next)
            const galleryBtn = e.target.closest('.gallery-nav');
            if (galleryBtn) {
                const container = galleryBtn.parentElement.querySelector('.gallery-container');
                if (!container) return;

                const isNext = galleryBtn.classList.contains('next');
                const scrollAmount = 300;
                container.scrollBy({ left: isNext ? scrollAmount : -scrollAmount, behavior: 'smooth' });
            }
        });

        // 2. Scroll Handler (Capture Phase for non-bubbling scroll events)
        // Monitor gallery scroll to update indicators and buttons
        document.addEventListener('scroll', (e) => {
            if (!e.target.classList || !e.target.classList.contains('gallery-container')) return;

            const container = e.target;
            const wrapper = container.parentElement; // .gallery-wrapper inside .card-photo

            // Logic extracted from previous inline onscroll
            const w = container.clientWidth;
            const sl = container.scrollLeft;
            const sw = container.scrollWidth;
            const totalItems = parseInt(container.dataset.total || 0);

            // Update Index Indicator
            if (totalItems > 0) {
                const idx = Math.round(sl / w) + 1;
                const indicator = wrapper.querySelector('.gallery-indicator');
                if (indicator) indicator.textContent = `${idx} / ${totalItems}`;
            }

            // Update Nav Visibility
            const prev = wrapper.querySelector('.gallery-nav.prev');
            const next = wrapper.querySelector('.gallery-nav.next');

            if (prev) {
                if (sl <= 10) prev.classList.add('hidden');
                else prev.classList.remove('hidden');
            }

            if (next) {
                if (sl + w >= sw - 10) next.classList.add('hidden');
                else next.classList.remove('hidden');
            }
        }, true); // useCapture = true is essential for 'scroll'

        // 3. Initialize Music UI Subscriptions
        this.initMusicUI();
    },

    /**
     * 初始化音乐 UI 逻辑 (订阅模式)
     */
    /**
     * 初始化音乐 UI 逻辑 (订阅模式)
     */
    initMusicUI() {
        const { EVENTS, SELECTORS, CLASSES, ICONS } = AudioPlayer.CONSTANTS;
        let isDragging = false; // 拖拽状态标记

        // A. 事件订阅：音频状态 -> UI 更新
        AudioPlayer.on(EVENTS.TRACK_CHANGE, ({ track, index, duration }) => {
            // 更新播放器信息
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

            // 更新播放列表高亮
            const items = section.querySelectorAll(SELECTORS.PLAYLIST_ITEM);
            items.forEach((item, i) => {
                item.classList.toggle(CLASSES.CURRENT, i === index);
            });

            // 重置进度条
            const progress = section.querySelector(SELECTORS.PROGRESS_FILL);
            const currTime = section.querySelector(SELECTORS.TIME_CURRENT);
            if (progress) progress.style.width = '0%';
            if (currTime) currTime.textContent = '0:00';
        });

        AudioPlayer.on(EVENTS.PLAY, () => {
            const section = document.querySelector(SELECTORS.SECTION);
            const playBtn = section?.querySelector(SELECTORS.PLAY_BTN);

            if (section) section.classList.add(CLASSES.PLAYING);
            if (playBtn) {
                playBtn.innerHTML = ICONS.PAUSE; // Pause Icon
            }
        });

        AudioPlayer.on(EVENTS.PAUSE, () => {
            const section = document.querySelector(SELECTORS.SECTION);
            const playBtn = section?.querySelector(SELECTORS.PLAY_BTN);

            if (section) section.classList.remove(CLASSES.PLAYING);
            if (playBtn) {
                playBtn.innerHTML = ICONS.PLAY; // Play Icon
            }
        });

        AudioPlayer.on(EVENTS.TIME_UPDATE, ({ currentTime, duration }) => {
            // 如果正在拖拽，暂停更新 UI，避免冲突（抖动）
            if (isDragging) return;

            const section = document.querySelector(SELECTORS.SECTION);
            if (!section) return;

            const progressFill = section.querySelector(SELECTORS.PROGRESS_FILL);
            const currentTimeEl = section.querySelector(SELECTORS.TIME_CURRENT);

            if (progressFill && duration) {
                const percent = (currentTime / duration) * 100;
                progressFill.style.width = `${percent}%`;
            }
            if (currentTimeEl) {
                // Input is now MS, no need to multiply
                currentTimeEl.textContent = this.formatDuration(currentTime);
            }
        });

        // B. 事件绑定：UI 交互 -> 音频控制 (Event Delegation)
        document.body.addEventListener('click', (e) => {
            // Play/Pause
            if (e.target.closest(SELECTORS.PLAY_BTN)) {
                AudioPlayer.toggle();
                return;
            }
            // Prev
            if (e.target.closest(SELECTORS.PREV_BTN)) {
                AudioPlayer.prev();
                return;
            }
            // Next
            if (e.target.closest(SELECTORS.NEXT_BTN)) {
                AudioPlayer.next();
                return;
            }
            // Playlist Item
            const item = e.target.closest(SELECTORS.PLAYLIST_ITEM);
            if (item) {
                const index = parseInt(item.dataset.index, 10);
                if (!isNaN(index)) AudioPlayer.play(index);
                return;
            }
            // Progress Bar Click (Fallback for non-drag clicks)
            const bar = e.target.closest(SELECTORS.PROGRESS_BAR);
            if (bar && !isDragging) {
                const rect = bar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                AudioPlayer.seek(percent);
            }
        });

        // C. 进度条拖拽逻辑 (Drag & Drop)
        // 使用 mousedown/mousemove/mouseup 模拟拖拽
        document.body.addEventListener('mousedown', (e) => {
            const bar = e.target.closest(SELECTORS.PROGRESS_BAR);
            if (!bar) return;

            isDragging = true;
            const progressFill = bar.querySelector(SELECTORS.PROGRESS_FILL);
            const section = document.querySelector(SELECTORS.SECTION);
            const currentTimeEl = section?.querySelector(SELECTORS.TIME_CURRENT);
            const durationEl = section?.querySelector(SELECTORS.TIME_DURATION); // 获取总时长用于计算预览时间

            // 禁用过渡动画，通过 width 直接更新，实现跟手
            if (progressFill) progressFill.style.transition = 'none';

            const updateDrag = (clientX) => {
                const rect = bar.getBoundingClientRect();
                let percent = (clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent)); // Clamp 0-1

                if (progressFill) progressFill.style.width = `${percent * 100}%`;

                // 拖拽时实时更新时间预览
                if (currentTimeEl && AudioPlayer.audio && AudioPlayer.audio.duration) {
                    // AudioPlayer 使用 MS，所以 convert percent -> seconds -> MS
                    const previewTime = percent * AudioPlayer.audio.duration * 1000;
                    currentTimeEl.textContent = this.formatDuration(previewTime);
                }
            };

            // 立即响应点击位置
            updateDrag(e.clientX);

            const onMouseMove = (moveEvent) => {
                moveEvent.preventDefault(); // 防止选中文本
                updateDrag(moveEvent.clientX);
            };

            const onMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // 计算最终位置并 Seek
                const rect = bar.getBoundingClientRect();
                let percent = (upEvent.clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent));

                AudioPlayer.seek(percent);

                // 恢复动画并重置状态
                if (progressFill) {
                    // 稍作延迟恢复动画，避免跳变
                    requestAnimationFrame(() => {
                        progressFill.style.transition = '';
                    });
                }

                // 使用 setTimeout 让 seek 事件有机会先触发，然后再允许 UI 更新
                setTimeout(() => {
                    isDragging = false;
                }, 100);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    },

    /**
     * 设置 SEO 信息
     */
    updateSEO(blogInfo) {
        if (!blogInfo) return;
        if (blogInfo.title) document.title = blogInfo.title;
        if (blogInfo.desc) {
            const meta = document.querySelector('meta[name="description"]');
            if (meta) meta.content = blogInfo.desc;
        }
    },

    /**
     * 渲染所有内容
     */
    renderAll(config) {
        this.updateSEO(config.blogInfo);
        this.renderProfile(config.authorInfo);
        this.renderBot(config.blogInfo);

        this.renderNav(config.categories);
        this.renderContent(config.categories);

        // Apply colors and inject dynamic styles for unknown types
        config.categories.forEach(cat => {
            if (cat.color && cat.type) {
                document.documentElement.style.setProperty(`--accent-${cat.type}`, cat.color);

                // Inject dynamic CSS if type is not in registry
                if (!TYPE_REGISTRY[cat.type]?.hasStaticCSS) {
                    this.injectDynamicStyles(cat.type);
                }
            }
        });
    },

    /**
     * 动态注入 CSS 规则（用于未预定义的类型）
     */
    injectDynamicStyles(type) {
        const styleId = `dynamic-style-${type}`;
        if (document.getElementById(styleId)) return; // 避免重复注入

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Nav highlight for ${type} */
            nav a[aria-current="true"][data-type="${type}"] {
                background: var(--accent-${type});
            }
            /* Card hover for ${type} */
            .card-${type}:hover {
                border-color: var(--accent-${type});
                box-shadow: 4px 4px 0 color-mix(in srgb, var(--accent-${type}), transparent 40%);
            }
            .card-${type}:hover .tag {
                border-color: var(--accent-${type});
                color: var(--accent-${type});
                box-shadow: 2px 2px 0 color-mix(in srgb, var(--accent-${type}), transparent 40%);
            }
            .card-${type}:hover .out {
                color: var(--accent-${type});
            }
        `;
        document.head.appendChild(style);
    },

    renderProfile(info) {
        if (!info) return;
        // Header
        if (info.avatar) {
            const avatar = document.getElementById('avatar');
            avatar.src = info.avatar;
            avatar.classList.add('lightbox-trigger');
            avatar.dataset.src = info.avatar;
            avatar.dataset.caption = info.name || '头像';
        }
        if (info.name) document.getElementById('profileName').textContent = info.name;

        // Social
        const socialHtml = [];
        if (info.email) socialHtml.push(`<a href="mailto:${info.email}">Email</a>`);
        if (info.github) socialHtml.push(`<a href="${info.github}" target="_blank" rel="noopener">Github</a>`);
        document.getElementById('socialLinks').innerHTML = socialHtml.join('\n');

        // Tags
        if (info.tags) {
            document.getElementById('profileTags').innerHTML = info.tags.map(tag =>
                `<span class="tag profile-tag">${tag}</span>`
            ).join('');
        }
    },

    renderBot(info) {
        if (!info) return;
        if (info.slogan) document.getElementById('slogan').textContent = info.slogan;
        if (info.copyright) document.getElementById('copyright').textContent = info.copyright;
    },

    renderNav(categories) {
        const html = categories.map((cat, idx) => `
            <a href="#${cat.id}" 
               data-target="${cat.id}" 
               data-type="${cat.type}"
               ${idx === 0 ? 'aria-current="true"' : ''}>
               ${cat.title}
            </a>
        `).join('');
        document.getElementById('typeNav').innerHTML = html;
    },

    renderContent(categories) {
        const root = document.getElementById('contentRoot');
        root.innerHTML = categories.map(cat => {
            const hasItems = cat.items && cat.items.length > 0;

            // Music type uses special section layout
            if (cat.type === 'music') {
                const content = hasItems
                    ? this.renderMusicSection(cat.items)
                    : `<p class="empty-state">暂无内容</p>`;
                return `
                <section id="${cat.id}" aria-labelledby="h-${cat.id}">
                    <h2 id="h-${cat.id}">${cat.title}</h2>
                    ${content}
                </section>
            `;
            }

            // Default card-based layout
            const content = hasItems
                ? `<div class="cards">${cat.items.map(item => this.renderCard(item, cat.type)).join('')}</div>`
                : `<p class="empty-state">暂无内容</p>`;

            return `
            <section id="${cat.id}" aria-labelledby="h-${cat.id}">
                <h2 id="h-${cat.id}">${cat.title}</h2>
                ${content}
            </section>
        `}).join('');
    },

    renderCard(item, type) {
        // Special case: Photo gallery
        if (item.isSet && item.photos) return this.cardGallery(item);

        // Dispatch based on type registry
        switch (type) {
            case 'project': return this.cardProject(item);
            case 'game': return this.cardGame(item);
            case 'photo': return this.cardPhoto(item);
            case 'book': return this.cardBook(item);
            case 'diary': return this.cardDiary(item);
            default: return this.cardDefault(item, type);
        }
    },

    // --- Card Templates ---

    renderHeader(title, status) {
        return `
        <div class="card-header">
            <h3 data-tooltip="${title || ''}">${title || '未命名'}</h3>
            ${status ? `<span class="status" data-status="${status}">${status}</span>` : ''}
        </div>`;
    },

    renderTags(tagsStr, extraClass = '') {
        if (!tagsStr) return '';
        const tags = tagsStr.split(/[、,，\/|｜]/).map(t => t.trim()).filter(Boolean);
        return `<div class="tags-group ${extraClass}">
            ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>`;
    },

    renderFooterLink(url, text) {
        return `<a class="out" href="${url || '#'}" target="_blank" rel="noopener">${text || '访问'}</a>`;
    },

    cardProject(it) {
        return `
        <div class="card card-project">
            ${this.renderHeader(it.title, it.status)}
            ${it.desc ? `<p data-tooltip="${it.desc}">${it.desc}</p>` : ''}
            ${this.renderTags(it.tech, 'tech-tags')}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    /**
     * 读书卡片 - 左图右文布局
     */
    cardBook(it) {
        // 作者 · 出版年份
        const meta = [it.author, it.publishYear].filter(Boolean).join(' <span class="dot">&bull;</span> ');
        return `
        <div class="card card-book ${it.cover ? 'has-cover' : ''}">
            ${it.cover ? `<img class="book-cover" src="${it.cover}" loading="lazy" alt="${it.title} 封面">` : ''}
            ${this.renderHeader(it.title, it.status)}
            <div class="book-meta" data-tooltip="${[it.author, it.publishYear].filter(Boolean).join(' • ')}">${meta || '&nbsp;'}</div>
            ${this.renderTags(it.tags, 'book-tags')}
            ${it.review ? `<div class="book-review"><p data-tooltip="${it.review}">${it.review}</p></div>` : '<div class="book-review">&nbsp;</div>'}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    cardGame(it) {
        const meta = [it.dev, it.platform, it.releaseDate].filter(Boolean).join(' <span class="dot">&bull;</span> ');
        return `
        <div class="card card-game ${it.cover ? 'has-cover' : ''}">
            ${it.cover ? `<img class="card-cover" src="${it.cover}" loading="lazy" alt="封面">` : ''}
            ${this.renderHeader(it.title, it.status)}
            <div class="game-meta" data-tooltip="${[it.dev, it.platform, it.releaseDate].filter(Boolean).join(' • ')}">${meta || '&nbsp;'}</div>
            
            ${this.renderTags(it.tags || it.gameType, 'game-tags')}
            
            ${it.review ? `
                <div class="review"><p data-tooltip="${it.review}">${it.review}</p></div>
            ` : ''}
            
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    cardPhoto(it) {
        const meta = [it.photoLocation, it.photoDate].filter(Boolean).join(' <span class="dot">&bull;</span> ');
        return `
        <div class="card card-photo ${it.photoUrl ? 'has-photo' : ''}">
            ${it.photoUrl ? `
                <img class="card-photo-img lightbox-trigger" 
                     src="${it.photoUrl}" 
                     loading="lazy" 
                     alt="${it.title}"
                     data-src="${it.photoUrl}"
                     data-caption="${it.title}">
            ` : ''}
            <h3 data-tooltip="${it.title || ''}">${it.title || '未命名'}</h3>
            ${meta ? `<p class="photo-meta" data-tooltip="${[it.photoLocation, it.photoDate].filter(Boolean).join(' • ')}">${meta}</p>` : ''}
        </div>`;
    },

    cardGallery(it) {
        const photosHtml = it.photos.map((p, idx) => `
            <div class="gallery-item" id="alb-${slugify(it.title)}-${idx}">
                ${p.photoUrl ? `
                    <img class="card-photo-img lightbox-trigger" 
                         src="${p.photoUrl}" 
                         loading="lazy" 
                         data-src="${p.photoUrl}" 
                         data-caption="${p.title}">
                ` : ''}
                <div class="gallery-info">
                    <h4 data-tooltip="${p.title || ''}">${p.title || '图集'}</h4>
                    ${(p.photoLocation || p.photoDate) ? `<p class="photo-meta" data-tooltip="${[p.photoLocation, p.photoDate].filter(Boolean).join(' • ')}">${[p.photoLocation, p.photoDate].filter(Boolean).join(' &bull; ')}</p>` : ''}
                </div>
            </div>
        `).join('');

        return `
        <div class="card card-photo is-gallery" data-gallery-id="${slugify(it.title)}">
            <div class="card-header">
                <h3 data-tooltip="${it.title}">${it.title}</h3>
                <span class="gallery-tag" data-tooltip="图集">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </span>
            </div>
            <div class="gallery-wrapper">
                <div class="gallery-indicator">1 / ${it.photos.length}</div>
                <button class="gallery-nav prev hidden" aria-label="Previous image">❮</button>
                <button class="gallery-nav next" aria-label="Next image">❯</button>
                <div class="gallery-container" data-total="${it.photos.length}">
                    ${photosHtml}
                </div>
            </div>
        </div>`;
    },

    /**
     * 日记卡片 - 时间线布局
     * 设计方案 C：时间线 Emoji 徽章
     */
    cardDiary(it) {
        // 解析日期并添加星期
        const dateWithWeekday = this.formatDateWithWeekday(it.title);

        // 获取心情 emoji（用于时间线标记，默认使用 📝 作为 fallback）
        const moodEmoji = it.mood ? (MOOD_EMOJI_MAP[it.mood] || '📝') : '📝';

        // 获取天气 emoji（纯 emoji 显示，无文字）
        const weatherEmoji = it.weather ? (WEATHER_EMOJI_MAP[it.weather] || it.weather) : '';

        return `
        <article class="card card-diary">
            <div class="timeline-marker">${moodEmoji}</div>
            <div class="diary-header">
                <time class="diary-date">${dateWithWeekday}</time>
                ${weatherEmoji ? `<span class="diary-weather">${weatherEmoji}</span>` : ''}
            </div>
            ${it.content ? `<div class="diary-content"><p>${it.content}</p></div>` : ''}
            ${it.image ? `
                <img class="diary-image lightbox-trigger" 
                     src="${it.image}" 
                     loading="lazy" 
                     alt="日记配图"
                     data-src="${it.image}"
                     data-caption="${dateWithWeekday}">
            ` : ''}
        </article>`;
    },

    /**
     * 格式化日期并添加星期
     */
    formatDateWithWeekday(dateStr) {
        if (!dateStr) return '未标记日期';
        // 尝试解析中文日期格式：YYYY年M月D日
        const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
            const [, year, month, day] = match;
            const date = new Date(year, month - 1, day);
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[date.getDay()];
            return `${dateStr} 周${weekday}`;
        }
        return dateStr;
    },

    cardDefault(it, type = 'default') {
        return `
        <div class="card card-${type}">
            ${this.renderHeader(it.title, it.status)}
            ${it.desc ? `<p data-tooltip="${it.desc}">${it.desc}</p>` : ''}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    /**
     * 渲染音乐 Section - 左播放器 + 右播放列表
     * @param {Array} items - 歌曲列表
     * @returns {string} HTML 字符串
     */
    renderMusicSection(items) {
        if (!items || items.length === 0) return '';

        const firstTrack = items[0];

        // 处理封面路径
        const getCoverUrl = (item) => {
            if (!item.cover) return '';
            let url = item.cover;
            if (url.startsWith('../')) url = url.substring(3);
            return url;
        };

        // 获取艺术家名称 (artist 或 author 字段，兼容作者字段解析)
        const getArtist = (item) => item.artist || item.author || '未知艺术家';

        // 左侧播放器 HTML
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
                        ${AudioPlayer.CONSTANTS.ICONS.PREV}
                    </button>
                    <button class="player-btn player-btn-play" aria-label="播放">
                        ${AudioPlayer.CONSTANTS.ICONS.PLAY}
                    </button>
                    <button class="player-btn player-btn-next" aria-label="下一首">
                        ${AudioPlayer.CONSTANTS.ICONS.NEXT}
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

        // 右侧播放列表 HTML
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

        return `
            <div class="music-section" data-playlist='${JSON.stringify(items.map(item => ({
            title: item.title,
            artist: getArtist(item),
            cover: getCoverUrl(item),
            audioPreview: item.audioPreview,
            duration: item.duration,
            linkUrl: item.linkUrl
        })))}'>                ${playerHtml}
                ${playlistHtml}
            </div>
        `;
    },

    /**
     * 格式化时长 (ms → m:ss)
     * @param {number} ms - 毫秒
     * @returns {string}
     */
    formatDuration(ms) {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
};

// Helper for slugify needed in templates
// (Imported from utils.js)
