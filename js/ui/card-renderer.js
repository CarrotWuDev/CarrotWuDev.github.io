import { slugify } from '../core/utils.js';

/**
 * CardRenderer - 负责生成各种类型的卡片 HTML
 * 遵循工厂模式
 */
export const CardRenderer = {
    /**
     * 渲染卡片入口
     * @param {Object} item - 数据项
     * @param {string} type - 类型 (project, game, book, etc.)
     */
    render(item, type) {
        // 特殊情况: 图集 (Photo Gallery)
        if (item.isSet && item.photos) return this.cardGallery(item);

        // 根据类型分发
        switch (type) {
            case 'project': return this.cardProject(item);
            case 'game': return this.cardGame(item);
            case 'photo': return this.cardPhoto(item);
            case 'book': return this.cardBook(item);
            case 'diary': return this.cardDiary(item);
            case 'film': return this.cardFilm(item);
            default: return this.cardDefault(item, type);
        }
    },

    // --- 辅助方法 ---

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

    // --- 具体卡片模板 ---

    cardProject(it) {
        return `
        <div class="card card-project">
            ${this.renderHeader(it.title, it.status)}
            ${it.desc ? `<p data-tooltip="${it.desc}">${it.desc}</p>` : ''}
            ${this.renderTags(it.tech, 'tech-tags')}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    cardBook(it) {
        // 作者 · 出版年份
        const meta = [it.author, it.publishYear].filter(Boolean).join(' <span class="dot">&bull;</span> ');
        return `
        <div class="card card-book ${it.cover ? 'has-cover' : ''}">
            ${it.cover ? `<img class="book-cover" src="${it.cover}" loading="lazy" alt="${it.title} 封面">` : ''}
            ${this.renderHeader(it.title, it.status)}
            <div class="card-meta book-meta" data-tooltip="${[it.author, it.publishYear].filter(Boolean).join(' • ')}">${meta || '&nbsp;'}</div>
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
            <div class="card-meta game-meta" data-tooltip="${[it.dev, it.platform, it.releaseDate].filter(Boolean).join(' • ')}">${meta || '&nbsp;'}</div>
            
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
            ${meta ? `<p class="card-meta photo-meta" data-tooltip="${[it.photoLocation, it.photoDate].filter(Boolean).join(' • ')}">${meta}</p>` : ''}
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
                    ${(p.photoLocation || p.photoDate) ? `<p class="card-meta photo-meta" data-tooltip="${[p.photoLocation, p.photoDate].filter(Boolean).join(' • ')}">${[p.photoLocation, p.photoDate].filter(Boolean).join(' &bull; ')}</p>` : ''}
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

    cardFilm(it) {
        // Meta: Region • Duration • Year
        const metaParts = [];
        if (it.region) metaParts.push(it.region);
        if (it.duration) metaParts.push(`${it.duration}分钟`);
        if (it.releaseDate) {
            const match = it.releaseDate.match(/^\d{4}/);
            const yearStr = match ? match[0] : '';
            if (yearStr) metaParts.push(yearStr);
        }
        const metaStr = metaParts.join(' &bull; ');

        return `
        <div class="card card-film">
            <div class="card-film-container">
                <!-- Divider Line -->
                <div class="card-film-divider"></div>

                <!-- Stub -->
                <div class="film-stub">
                    ${it.status ? `<div class="film-status">${it.status}</div>` : ''}
                    ${it.cover ? `<img class="film-poster" src="${it.cover}" loading="lazy" alt="${it.title}">` : ''}
                </div>

                <!-- Main -->
                <div class="film-main">
                    <h3 class="film-title" data-tooltip="${it.title}">${it.title}</h3>
                    <div class="film-meta-row">${metaStr}</div>
                    
                    <div class="film-credits">
                        ${it.director ? `<div class="film-credit-line film-director" data-tooltip="${it.director}"><strong>导演：</strong>${it.director}</div>` : ''}
                        ${it.starring ? `<div class="film-credit-line film-starring" data-tooltip="${it.starring}"><strong>主演：</strong>${it.starring}</div>` : ''}
                    </div>
                    
                    ${it.review ? `<div class="film-review"><p data-tooltip="${it.review}">${it.review}</p></div>` : ''}

                    <div class="film-footer">
                        ${this.renderTags(it.tags, 'film-tags')}
                        
                        ${it.linkUrl ? `
                            <div class="film-actions">
                            <a href="${it.linkUrl}" target="_blank" class="btn-douban">豆瓣</a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    },

    cardDiary(it) {
        const MOOD_EMOJI_MAP = {
            '开心': '😊', '平静': '😌', '一般': '😐', '疲惫': '😩',
            '低落': '😔', '焦虑': '😰', '生气': '😠'
        };
        const WEATHER_EMOJI_MAP = {
            '晴朗': '☀️', '多云': '⛅', '阴天': '☁️', '小雨': '🌧️',
            '雷雨': '⛈️', '雪': '❄️', '雾': '🌫️', '风': '💨'
        };

        const dateWithWeekday = this.formatDateWithWeekday(it.title);
        const moodEmoji = it.mood ? (MOOD_EMOJI_MAP[it.mood] || '📝') : '📝';
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

    cardDefault(it, type = 'default') {
        return `
        <div class="card card-${type}">
            ${this.renderHeader(it.title, it.status)}
            ${it.desc ? `<p data-tooltip="${it.desc}">${it.desc}</p>` : ''}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    }
};
