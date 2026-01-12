/**
 * Enhanced Lightbox Component
 * Features: Zoom, Pan, Gestures (Swipe), Keyboard Nav, Gallery Support
 */

const Lightbox = {
    // --- State ---
    el: null,
    img: null,
    items: [], // Array of { src, caption }
    currentIndex: 0,

    // Zoom State
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0,

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
        const { el, img, els } = this;

        // Core UI Events
        els.closeBtn.addEventListener('click', () => this.close());
        els.overlay.addEventListener('click', () => this.close());
        els.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
        els.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

        // Zoom & Pan Events (Mouse/Pointer)
        img.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        img.addEventListener('dblclick', (e) => this.handleDblClick(e));

        img.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

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

        this.resetZoom();
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

        // Reset state before loading new image
        this.resetZoom();

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

    // --- Zoom Logic ---

    resetZoom() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.updateTransform();
        this.img.classList.remove('zoomed');
    },

    handleWheel(e) {
        if (!this.el.classList.contains('active')) return;
        e.preventDefault();

        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        const newScale = Math.max(1, Math.min(4, this.scale + delta));

        if (newScale !== this.scale) {
            this.scale = newScale;
            this.img.classList.toggle('zoomed', this.scale > 1);
            this.updateTransform();
        }
    },

    handleDblClick(e) {
        if (this.scale > 1) {
            this.resetZoom();
        } else {
            this.scale = 2; // Double zoom
            this.img.classList.add('zoomed');
            this.updateTransform();
        }
    },

    updateTransform() {
        // Apply transform to image
        this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
    },

    // --- Pointer Events (Zoom & Pan & Pinch & DoubleTap) ---

    // Track active pointers
    pointers: new Map(),
    prevDist: -1,

    // Tap detection
    lastTapTime: 0,
    lastTapPoint: { x: 0, y: 0 },

    handlePointerDown(e) {
        e.preventDefault();
        this.el.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, e);

        // Double Tap Detection
        const now = Date.now();
        const isDoubleTap = (now - this.lastTapTime < 300) &&
            (Math.abs(e.clientX - this.lastTapPoint.x) < 20) &&
            (Math.abs(e.clientY - this.lastTapPoint.y) < 20);

        if (isDoubleTap && this.pointers.size === 1) {
            // Manually trigger double click logic
            this.handleDblClick(e);
            // Reset to prevent triple-tap triggering again immediately
            this.lastTapTime = 0;
            return;
        }

        // Store for next tap check
        this.lastTapTime = now;
        this.lastTapPoint = { x: e.clientX, y: e.clientY };

        // If dragging with mouse or single touch (and zoomed)
        if (this.pointers.size === 1 && this.scale > 1) {
            this.panning = true;
            this.startX = e.clientX - this.pointX;
            this.startY = e.clientY - this.pointY;
            this.img.classList.add('dragging');
        }

        // If two fingers (Pinch)
        if (this.pointers.size === 2) {
            this.panning = false; // Disable single finger pan
            // Calculate initial distance
            const points = Array.from(this.pointers.values());
            this.prevDist = this.getDistance(points[0], points[1]);
        }
    },

    handlePointerMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        e.preventDefault();

        // Update stored pointer
        this.pointers.set(e.pointerId, e);

        // 1. Pinch Zoom (2 fingers)
        if (this.pointers.size === 2) {
            const points = Array.from(this.pointers.values());
            const curDist = this.getDistance(points[0], points[1]);

            if (this.prevDist > 0) {
                const diff = curDist - this.prevDist;
                // Sensible zoom speed factor
                const scaleFactor = 0.005;
                const newScale = Math.max(1, Math.min(4, this.scale + diff * scaleFactor));

                if (newScale !== this.scale) {
                    this.scale = newScale;
                    this.img.classList.toggle('zoomed', this.scale > 1);
                    this.updateTransform();
                }
            }
            this.prevDist = curDist;
            return;
        }

        // 2. Pan (1 finger/mouse) - Only if zoomed
        if (this.pointers.size === 1 && this.panning && this.scale > 1) {
            this.pointX = e.clientX - this.startX;
            this.pointY = e.clientY - this.startY;
            this.updateTransform();
        }
    },

    handlePointerUp(e) {
        this.pointers.delete(e.pointerId);

        // Reset pinch state if < 2 fingers
        if (this.pointers.size < 2) {
            this.prevDist = -1;
        }

        // Reset pan state if 0 fingers
        if (this.pointers.size === 0) {
            this.panning = false;
            this.img.classList.remove('dragging');
        } else if (this.pointers.size === 1) {
            // Re-engage panning for remaining finger? 
            // Usually better to wait for new gesture to avoid jump
            // But checking bounds here would be good
            this.panning = false;
        }
    },

    getDistance(p1, p2) {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.hypot(dx, dy);
    },

    // --- Gesture Logic (Swipe) ---
    // Keep touch handlers for simple swipe detection when NOT zoomed

    handleTouchStart(e) {
        if (this.scale > 1 || e.touches.length > 1) return; // Disable swipe when zoomed or multitouch
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
    },

    handleTouchEnd(e) {
        if (this.scale > 1 || e.changedTouches.length > 1) return;

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
            case '+':
            case '=': // Check for plus
                this.scale = Math.min(4, this.scale + 0.5);
                this.updateTransform();
                break;
            case '-':
            case '_':
                this.scale = Math.max(1, this.scale - 0.5);
                this.updateTransform();
                break;
            case '0': this.resetZoom(); break;
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
