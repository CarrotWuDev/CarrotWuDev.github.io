import { openLightbox } from './lightbox.js';
import { slugify } from '../core/utils.js';

/**
 * 类型注册表 - 集中定义所有已知类型
 */
const TYPE_REGISTRY = {
    project: { hasStaticCSS: true },
    game: { hasStaticCSS: true },
    photo: { hasStaticCSS: true },
    book: { hasStaticCSS: true }
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
            const navLink = e.target.closest('.type-nav a');
            if (navLink) {
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
            default: return this.cardDefault(item, type);
        }
    },

    // --- Card Templates ---

    renderHeader(title, status) {
        return `
        <div class="card-header">
            <h3>${title || '未命名'}</h3>
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
            ${it.desc ? `<p class="line-clamp-3">${it.desc}</p>` : ''}
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
            <div class="book-meta">${meta || '&nbsp;'}</div>
            ${this.renderTags(it.tags, 'book-tags')}
            ${it.review ? `<div class="book-review"><p>${it.review}</p></div>` : '<div class="book-review">&nbsp;</div>'}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    },

    cardGame(it) {
        const meta = [it.dev, it.platform, it.releaseDate].filter(Boolean).join(' <span class="dot">&bull;</span> ');
        return `
        <div class="card card-game ${it.cover ? 'has-cover' : ''}">
            ${it.cover ? `<img class="card-cover" src="${it.cover}" loading="lazy" alt="封面">` : ''}
            ${this.renderHeader(it.title, it.status)}
            <div class="card-subtitle">${meta || '&nbsp;'}</div>
            
            ${this.renderTags(it.tags || it.gameType, 'game-tags')}
            
            ${it.review ? `
                <div class="review"><p class="line-clamp-2">${it.review}</p></div>
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
            <h3>${it.title || '未命名'}</h3>
            ${meta ? `<p class="photo-meta">${meta}</p>` : ''}
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
                    <h4>${p.title || '图集'}</h4>
                    ${(p.photoLocation || p.photoDate) ? `<p class="photo-meta">${[p.photoLocation, p.photoDate].filter(Boolean).join(' &bull; ')}</p>` : ''}
                </div>
            </div>
        `).join('');

        return `
        <div class="card card-photo is-gallery" data-gallery-id="${slugify(it.title)}">
            <div class="card-header">
                <h3>${it.title}</h3>
                <span class="status">图集</span>
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

    cardDefault(it, type = 'default') {
        return `
        <div class="card card-${type}">
            ${this.renderHeader(it.title, it.status)}
            ${it.desc ? `<p>${it.desc}</p>` : ''}
            ${this.renderFooterLink(it.linkUrl, it.linkText)}
        </div>`;
    }
};

// Helper for slugify needed in templates
// (Imported from utils.js)
