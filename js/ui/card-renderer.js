import { slugify } from '../core/utils.js';
import { ImageProxyService } from '../services/image-proxy.js';

/**
 * CardRenderer - 负责生成各种类型的卡片 HTML
 * 遵循工厂模式
 */
/**
 * Emoji 映射表
 */
const MOOD_EMOJI_MAP = {
    '开心': '😊', '平静': '😌', '一般': '😐', '疲惫': '😩',
    '低落': '😔', '焦虑': '😰', '生气': '😠'
};

const WEATHER_EMOJI_MAP = {
    '晴朗': '☀️', '多云': '⛅', '阴天': '☁️', '小雨': '🌧️',
    '雷雨': '⛈️', '雪': '❄️', '雾': '🌫️', '风': '💨'
};

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

    /**
     * 渲染图片标签（统一处理代理）
     * 
     * @param {Object} options - 图片选项
     * @param {string} options.src - 图片源地址
     * @param {string} [options.alt=''] - 替代文本
     * @param {string} [options.className=''] - CSS 类名
     * @param {boolean} [options.lazy=true] - 是否懒加载
     * @param {Object} [options.dataAttrs={}] - data-* 属性
     * @returns {string} img 标签 HTML
     */
    img({ src, alt = '', className = '', lazy = true, dataAttrs = {} }) {
        if (!src) return '';

        const proxiedSrc = ImageProxyService.getProxiedUrl(src);
        const loadingAttr = lazy ? 'loading="lazy"' : '';

        // 构建 data-* 属性字符串
        const dataAttrStr = Object.entries(dataAttrs)
            .map(([key, value]) => `data-${key}="${value}"`)
            .join(' ');

        return `<img class="${className}" src="${proxiedSrc}" ${loadingAttr} alt="${alt}" ${dataAttrStr}>`.trim();
    },

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
        // 构建作者和年份的语义化 HTML 结构
        // 使用独立的 span 包裹，以支持 CSS 对作者名的截断控制
        const authorHtml = it.author
            ? `<span class="book-author" data-tooltip="${it.author}">${it.author}</span>`
            : '';
        const yearHtml = it.publishYear
            ? `<span class="book-year">${it.publishYear}</span>`
            : '';
        const dotHtml = '<span class="dot">&bull;</span>';

        // 根据是否有作者和年份决定 meta 内容
        let metaHtml = '';
        if (it.author && it.publishYear) {
            metaHtml = `${authorHtml} ${dotHtml} ${yearHtml}`;
        } else if (it.author) {
            metaHtml = authorHtml;
        } else if (it.publishYear) {
            metaHtml = yearHtml;
        } else {
            metaHtml = '&nbsp;';
        }

        // 封面区域：包含封面图片和状态标签
        const coverSection = it.cover ? `
            <div class="book-cover-wrapper">
                ${this.img({ src: it.cover, alt: `${it.title} 封面`, className: 'book-cover' })}
                ${it.status ? `<div class="book-status">${it.status}</div>` : ''}
            </div>
        ` : '';

        return `
        <div class="card card-book ${it.cover ? 'has-cover' : ''}">
            ${coverSection}
            ${this.renderHeader(it.title)}
            <div class="card-meta book-meta">${metaHtml}</div>
            ${this.renderTags(it.tags, 'book-tags')}
            ${it.review ? `<div class="book-review"><p data-tooltip="${it.review}">${it.review}</p></div>` : '<div class="book-review">&nbsp;</div>'}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    cardGame(it) {
        const meta = [it.dev, it.platform, it.releaseDate].filter(Boolean).join(' <span class="dot">&bull;</span> ');

        // 封面区域：包含封面图片和状态标签
        const coverSection = it.cover ? `
            <div class="game-cover-wrapper">
                ${this.img({ src: it.cover, alt: `${it.title} 封面`, className: 'card-cover' })}
                ${it.status ? `<div class="game-status">${it.status}</div>` : ''}
            </div>
        ` : '';

        return `
        <div class="card card-game ${it.cover ? 'has-cover' : ''}">
            ${coverSection}
            ${this.renderHeader(it.title)}
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
        // 获取代理后的图片 URL，用于 lightbox
        const proxiedPhotoUrl = it.photoUrl ? ImageProxyService.getProxiedUrl(it.photoUrl) : '';

        return `
        <div class="card card-photo ${it.photoUrl ? 'has-photo' : ''}">
            ${it.photoUrl ? this.img({
            src: it.photoUrl,
            alt: it.title,
            className: 'card-photo-img lightbox-trigger',
            dataAttrs: { src: proxiedPhotoUrl, caption: it.title }
        }) : ''}
            <h3 data-tooltip="${it.title || ''}">${it.title || '未命名'}</h3>
            ${meta ? `<p class="card-meta photo-meta" data-tooltip="${[it.photoLocation, it.photoDate].filter(Boolean).join(' • ')}">${meta}</p>` : ''}
        </div>`;
    },

    cardGallery(it) {
        const photosHtml = it.photos.map((p, idx) => {
            const proxiedPhotoUrl = p.photoUrl ? ImageProxyService.getProxiedUrl(p.photoUrl) : '';
            return `
            <div class="gallery-item" id="alb-${slugify(it.title)}-${idx}">
                ${p.photoUrl ? this.img({
                src: p.photoUrl,
                alt: p.title || '图集',
                className: 'card-photo-img lightbox-trigger',
                dataAttrs: { src: proxiedPhotoUrl, caption: p.title }
            }) : ''}
                <div class="gallery-info">
                    <h4 data-tooltip="${p.title || ''}">${p.title || '图集'}</h4>
                    ${(p.photoLocation || p.photoDate) ? `<p class="card-meta photo-meta" data-tooltip="${[p.photoLocation, p.photoDate].filter(Boolean).join(' • ')}">${[p.photoLocation, p.photoDate].filter(Boolean).join(' &bull; ')}</p>` : ''}
                </div>
            </div>
        `}).join('');

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
                    ${it.cover ? this.img({ src: it.cover, alt: it.title, className: 'film-poster' }) : ''}
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
            ${it.image ? this.img({
            src: it.image,
            alt: '日记配图',
            className: 'diary-image lightbox-trigger',
            dataAttrs: { src: ImageProxyService.getProxiedUrl(it.image), caption: dateWithWeekday }
        }) : ''}
            ${it.content ? `<div class="diary-content"><p>${it.content}</p></div>` : ''}
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
