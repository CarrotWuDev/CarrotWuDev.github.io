import { openLightbox } from './lightbox.js';
import { CardRenderer } from './card-renderer.js';
import { MusicUI } from './music-ui.js';

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

export const RenderService = {
    /**
     * 初始化交互 (事件委托)
     */
    init() {
        // Global Event Delegation using "focus-group" style management

        // 1. Click Handler (Lightbox, Nav, Gallery)
        document.body.addEventListener('click', (e) => {
            // A. Lightbox
            // A. Lightbox
            const lightboxTrigger = e.target.closest('.lightbox-trigger');
            if (lightboxTrigger) {
                const src = lightboxTrigger.dataset.src;
                const caption = lightboxTrigger.dataset.caption;

                // Check if inside a gallery/album
                const galleryCard = lightboxTrigger.closest('.card.is-gallery');

                if (galleryCard) {
                    // Collect all items in this gallery
                    const triggers = Array.from(galleryCard.querySelectorAll('.lightbox-trigger'));
                    const items = triggers.map(el => ({
                        src: el.dataset.src,
                        caption: el.dataset.caption
                    }));
                    const index = triggers.indexOf(lightboxTrigger);

                    if (src && index !== -1) {
                        openLightbox(items, index);
                    }
                } else {
                    // Single image
                    if (src) openLightbox(src, caption);
                }
                return;
            }

            // B. Type Nav (ScrollSpy Integration)
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
        document.addEventListener('scroll', (e) => {
            if (!e.target.classList || !e.target.classList.contains('gallery-container')) return;

            const container = e.target;
            const wrapper = container.parentElement;

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

            if (prev) prev.classList.toggle('hidden', sl <= 10);
            if (next) next.classList.toggle('hidden', sl + w >= sw - 10);
        }, true);

        // 3. Initialize Music UI
        MusicUI.init();
    },

    /**
     * 设置 SEO 信息
     */


    /**
     * 设置 SEO 信息 (Title, Meta, OG, Twitter)
     */
    updateSEO(config) {
        if (!config || !config.blogInfo) return;

        const info = config.blogInfo;
        const author = config.authorInfo || {};
        const siteUrl = 'https://carrotwudev.github.io'; // Base URL

        // 1. Basic SEO
        if (info.title) document.title = info.title;
        this.setMeta('description', info.desc);
        this.setMeta('keywords', author.tags ? author.tags.join(', ') : '');
        this.setMeta('author', author.name);

        // 2. Open Graph
        this.setMeta('og:title', info.title, 'property');
        this.setMeta('og:description', info.desc, 'property');
        // Construct absolute URL for image
        if (info.favicon) {
            const imageUrl = info.favicon.startsWith('http') ? info.favicon : `${siteUrl}/${info.favicon}`;
            this.setMeta('og:image', imageUrl, 'property');
            this.setMeta('twitter:image', imageUrl, 'property');
            this.setFavicon(info.favicon);
        }

        // 3. Twitter Card
        this.setMeta('twitter:title', info.title, 'property');
        this.setMeta('twitter:description', info.desc, 'property');
        this.setMeta('twitter:creator', '@CarrotWuDev'); // 默认 Twitter 账号

        // 4. Update Canonical
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = siteUrl + '/';
    },

    setMeta(name, content, attr = 'name') {
        if (!content) return;
        let meta = document.querySelector(`meta[${attr}="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    },

    setFavicon(faviconUrl) {
        if (!faviconUrl) return;
        const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingLinks.forEach(link => link.remove());

        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = this.getFaviconMimeType(faviconUrl);
        link.href = faviconUrl;
        document.head.appendChild(link);
    },

    getFaviconMimeType(url) {
        const ext = url.split('.').pop().toLowerCase();
        const mimeTypes = {
            'ico': 'image/x-icon', 'png': 'image/png', 'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg', 'svg': 'image/svg+xml', 'gif': 'image/gif', 'webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/png';
    },

    /**
     * 渲染页面骨架（不含分类内容）
     * 内容将通过懒加载机制后续填充
     * 
     * @param {Object} config - 站点配置对象
     */
    renderAll(config) {
        this.updateSEO(config);
        this.renderProfile(config.authorInfo);
        this.renderBot(config.blogInfo);

        this.renderNav(config.categories);
        this.renderContentSkeleton(config.categories);

        // Apply colors and inject dynamic styles for unknown types
        config.categories.forEach(cat => {
            if (cat.color && cat.type) {
                document.documentElement.style.setProperty(`--accent-${cat.type}`, cat.color);
                if (!TYPE_REGISTRY[cat.type]?.hasStaticCSS) {
                    this.injectDynamicStyles(cat.type);
                }
            }
        });

        // 注意：MusicUI.initLayout() 将在音乐 section 内容加载后调用
    },

    injectDynamicStyles(type) {
        const styleId = `dynamic-style-${type}`;
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Nav highlight for ${type} */
            nav a[aria-current="true"][data-type="${type}"] {
                background: var(--accent-${type});
            }
            /* Card accent for ${type} */
            .card-${type} {
                --card-accent: var(--accent-${type});
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
        if (info.avatar) {
            const avatar = document.getElementById('avatar');
            avatar.src = info.avatar;
            avatar.alt = info.name || '头像';
        }
        if (info.name) document.getElementById('profileName').textContent = info.name;

        const socialHtml = [];
        if (info.email) socialHtml.push(`<a href="mailto:${info.email}">Email</a>`);
        if (info.github) socialHtml.push(`<a href="${info.github}" target="_blank" rel="noopener">Github</a>`);
        document.getElementById('socialLinks').innerHTML = socialHtml.join('\n');

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

    /**
     * 渲染所有分类的骨架结构（带加载状态）
     * 每个 section 包含标题和加载占位符，等待懒加载填充实际内容
     * 
     * @param {Array<Object>} categories - 分类配置数组
     */
    renderContentSkeleton(categories) {
        const root = document.getElementById('contentRoot');
        root.innerHTML = categories.map(cat => `
            <section 
                id="${cat.id}" 
                aria-labelledby="h-${cat.id}"
                data-loaded="false"
                data-type="${cat.type}"
            >
                <h2 id="h-${cat.id}">${cat.title}</h2>
                <div class="section-content">
                    <div class="loading-state" aria-live="polite">
                        <span class="loading-spinner" aria-hidden="true"></span>
                        <span class="loading-text">加载中...</span>
                    </div>
                </div>
            </section>
        `).join('');
    },

    /**
     * 渲染单个 section 的实际内容
     * 用于懒加载完成后替换加载状态
     * 
     * @param {HTMLElement} sectionEl - section DOM 元素
     * @param {Array} items - 分类内容项数组
     * @param {string} type - 分类类型（project, game, photo, book, diary, music, film 等）
     * @returns {void}
     */
    renderSectionContent(sectionEl, items, type) {
        const contentEl = sectionEl.querySelector('.section-content');
        if (!contentEl) {
            console.warn('[RenderService] Section content container not found');
            return;
        }

        const hasItems = items && items.length > 0;

        // 根据类型渲染不同的内容结构
        if (type === 'music') {
            contentEl.innerHTML = hasItems
                ? MusicUI.render(items)
                : `<p class="empty-state">暂无内容</p>`;

            // 音乐类型需要初始化布局
            if (hasItems) {
                MusicUI.initLayout();
            }
        } else {
            // 默认卡片布局
            contentEl.innerHTML = hasItems
                ? `<div class="cards">${items.map(item => CardRenderer.render(item, type)).join('')}</div>`
                : `<p class="empty-state">暂无内容</p>`;
        }

        // 标记为已加载
        sectionEl.dataset.loaded = 'true';

        // 移除加载状态的 ARIA 属性
        contentEl.removeAttribute('aria-live');
    },

    /**
     * 检查 section 是否已加载内容
     * @param {HTMLElement} sectionEl - section DOM 元素
     * @returns {boolean}
     */
    isSectionLoaded(sectionEl) {
        return sectionEl.dataset.loaded === 'true';
    }
};
