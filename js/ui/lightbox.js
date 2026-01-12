/**
 * Simple Lightbox Component
 * Features: Gallery Support, Swipe Navigation, Keyboard Nav
 * Note: Zoom feature removed for simplicity
 */

const Lightbox = {
    // --- State ---
    el: null,
    img: null,
    items: [], // Array of { src, caption }
    currentIndex: 0,

    // Gesture State
    touchStartX: 0,
    touchStartY: 0,

    // --- DOM Elements ---
    els: {
        overlay: null,
        content: null,
        closeBtn: null,
        prevBtn: null,
        nextBtn: null,
        counter: null
    },

    /**
     * Initialize DOM structure
     */
    init() {
        if (this.el) return;

        this.el = document.createElement('div');
        this.el.className = 'lightbox';
        this.el.innerHTML = `
            <div class="lightbox-overlay"></div>
            <div class="lightbox-content">
                <img src="" alt="" class="lightbox-img">
            </div>
            <button class="lightbox-nav prev" aria-label="上一张">❮</button>
            <button class="lightbox-nav next" aria-label="下一张">❯</button>
            <div class="lightbox-counter"></div>
            <button class="lightbox-close" aria-label="关闭">×</button>
        `;

        // Cache elements
        this.img = this.el.querySelector('.lightbox-img');
        this.els.overlay = this.el.querySelector('.lightbox-overlay');
        this.els.content = this.el.querySelector('.lightbox-content');
        this.els.prevBtn = this.el.querySelector('.prev');
        this.els.nextBtn = this.el.querySelector('.next');
        this.els.counter = this.el.querySelector('.lightbox-counter');
        this.els.closeBtn = this.el.querySelector('.lightbox-close');

        // Bind Events
        this.bindEvents();

        document.body.appendChild(this.el);
    },

    bindEvents() {
        const { el, els } = this;

        // Core UI Events
        els.closeBtn.addEventListener('click', () => this.close());
        els.overlay.addEventListener('click', () => this.close());
        els.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
        els.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

        // Swipe Gestures (Touch)
        el.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        el.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Keyboard Nav
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    },

    // --- Actions ---

    open(items, index = 0) {
        this.init();
        this.items = items;
        this.currentIndex = index;

        this.updateImage();

        requestAnimationFrame(() => this.el.classList.add('active'));
    },

    close() {
        if (!this.el) return;
        this.el.classList.remove('active');
        setTimeout(() => {
            if (!this.el.classList.contains('active')) {
                this.img.src = '';
                this.items = [];
            }
        }, 300);
    },

    updateImage() {
        const item = this.items[this.currentIndex];
        if (!item) return;

        this.img.src = item.src;
        this.img.alt = item.caption || '';

        // Update UI
        this.updateCounter();
        this.updateNavButtons();
    },

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateImage();
        }
    },

    next() {
        if (this.currentIndex < this.items.length - 1) {
            this.currentIndex++;
            this.updateImage();
        }
    },

    updateCounter() {
        if (this.items.length > 1) {
            this.els.counter.style.display = 'block';
            this.els.counter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
        } else {
            this.els.counter.style.display = 'none';
        }
    },

    updateNavButtons() {
        if (this.items.length <= 1) {
            this.els.prevBtn.style.display = 'none';
            this.els.nextBtn.style.display = 'none';
            return;
        }

        this.els.prevBtn.style.display = 'block';
        this.els.nextBtn.style.display = 'block';

        this.els.prevBtn.disabled = this.currentIndex === 0;
        this.els.nextBtn.disabled = this.currentIndex === this.items.length - 1;

        this.els.prevBtn.style.opacity = this.currentIndex === 0 ? '0.1' : '1';
        this.els.nextBtn.style.opacity = this.currentIndex === this.items.length - 1 ? '0.1' : '1';
    },

    // --- Gesture Logic (Swipe) ---

    handleTouchStart(e) {
        if (e.touches.length > 1) return; // Disable swipe when multitouch
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
    },

    handleTouchEnd(e) {
        if (e.changedTouches.length > 1) return;

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const dx = touchEndX - this.touchStartX;
        const dy = touchEndY - this.touchStartY;

        // Horizontal Swipe Detection
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) this.prev();
            else this.next();
        }
    },

    // --- Keyboard Logic ---

    handleKeydown(e) {
        if (!this.el || !this.el.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape': this.close(); break;
            case 'ArrowLeft': this.prev(); break;
            case 'ArrowRight': this.next(); break;
        }
    }
};

/**
 * Public API
 * @param {string|Array} target - Image src or Array of Items
 * @param {string|number} param2 - Caption or Start Index
 */
export function openLightbox(target, param2) {
    if (Array.isArray(target)) {
        // Open Gallery: target = items[], param2 = index
        Lightbox.open(target, Number(param2) || 0);
    } else {
        // Open Single: target = src, param2 = caption
        Lightbox.open([{ src: target, caption: param2 }], 0);
    }
}
