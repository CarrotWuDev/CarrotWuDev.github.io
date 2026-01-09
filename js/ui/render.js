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
    updateSEO(blogInfo) {
        if (!blogInfo) return;
        if (blogInfo.title) document.title = blogInfo.title;
        if (blogInfo.desc) {
            const meta = document.querySelector('meta[name="description"]');
            if (meta) meta.content = blogInfo.desc;
        }
        if (blogInfo.favicon) this.setFavicon(blogInfo.favicon);
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
                if (!TYPE_REGISTRY[cat.type]?.hasStaticCSS) {
                    this.injectDynamicStyles(cat.type);
                }
            }
        });

        // Lifecycle: Initialize component layouts after DOM injection
        MusicUI.initLayout();
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

    renderContent(categories) {
        const root = document.getElementById('contentRoot');
        root.innerHTML = categories.map(cat => {
            const hasItems = cat.items && cat.items.length > 0;

            // Music type uses delegated renderer
            if (cat.type === 'music') {
                const content = hasItems
                    ? MusicUI.render(cat.items)
                    : `<p class="empty-state">暂无内容</p>`;
                return `
                <section id="${cat.id}" aria-labelledby="h-${cat.id}">
                    <h2 id="h-${cat.id}">${cat.title}</h2>
                    ${content}
                </section>
            `;
            }

            // Default card-based layout uses CardRenderer
            const content = hasItems
                ? `<div class="cards">${cat.items.map(item => CardRenderer.render(item, cat.type)).join('')}</div>`
                : `<p class="empty-state">暂无内容</p>`;

            return `
            <section id="${cat.id}" aria-labelledby="h-${cat.id}">
                <h2 id="h-${cat.id}">${cat.title}</h2>
                ${content}
            </section>
        `;
        }).join('');
    }
};
