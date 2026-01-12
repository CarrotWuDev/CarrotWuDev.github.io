import { DataService } from './services/data.js';
import { RenderService } from './ui/render.js';
import { initTheme } from './ui/theme.js';
import { initTooltip } from './ui/tooltip.js';
import { initScrollbarBehavior } from './ui/scroll.js';
import { AudioPlayer } from './ui/audio-player.js';

/**
 * 站点配置缓存（模块级）
 * 用于在懒加载时访问分类信息
 * @type {Object|null}
 */
let siteConfig = null;

/**
 * 应用程序入口
 * 
 * 加载策略：首屏优先 + 后台预加载
 * 1. 加载站点配置（元数据）
 * 2. 渲染页面骨架（带加载状态）
 * 3. 加载并渲染首个 section
 * 4. 后台静默加载其余所有 section
 * 5. 启动滚动监听等功能
 */
async function init() {
    try {
        // 1. 初始化 UI 事件委托
        RenderService.init();

        // 2. 加载站点配置（仅元数据，不含分类内容）
        siteConfig = await DataService.loadSiteConfig();

        // 3. 渲染页面骨架（所有 section 显示加载状态）
        RenderService.renderAll(siteConfig);

        // 4. 启动滚动监听（需要在骨架渲染后立即启动）
        setupScrollSpy();

        // 5. 加载并渲染首个 section（首屏优先）
        const firstCategory = siteConfig.categories[0];
        if (firstCategory) {
            await loadAndRenderSection(firstCategory);
        }

        // 6. 后台静默加载其余 section
        const remainingCategories = siteConfig.categories.slice(1);
        preloadRemainingCategories(remainingCategories);

    } catch (e) {
        console.error('[App] Initialization failed:', e);
        const contentRoot = document.getElementById('contentRoot');
        if (contentRoot) {
            contentRoot.innerHTML = `
                <div class="error-state" style="padding: 40px; text-align: center;">
                    <p style="color: var(--color-error, #dc2626); margin-bottom: 8px;">
                        加载失败
                    </p>
                    <p style="color: var(--color-text-secondary, #888); font-size: 0.875rem;">
                        ${e.message}
                    </p>
                </div>
            `;
        }
    }
}

/**
 * 加载并渲染单个 section 的内容
 * 
 * @param {Object} category - 分类配置对象
 * @returns {Promise<void>}
 */
async function loadAndRenderSection(category) {
    const sectionEl = document.getElementById(category.id);
    if (!sectionEl) {
        console.warn(`[App] Section element not found: ${category.id}`);
        return;
    }

    // 已加载则跳过
    if (RenderService.isSectionLoaded(sectionEl)) {
        return;
    }

    // 加载分类内容
    const items = await DataService.loadCategoryContent(category);

    // 缓存到 category 对象（供其他功能使用，如音乐播放器）
    category.items = items;

    // 渲染内容
    RenderService.renderSectionContent(sectionEl, items, category.type);

    // 如果是音乐类型，初始化音乐播放器
    if (category.type === 'music' && items.length > 0) {
        initAudioPlayerForSection();
    }
}

/**
 * 后台静默预加载其余分类
 * 使用 requestIdleCallback 或 setTimeout 避免阻塞主线程
 * 
 * @param {Array<Object>} categories - 待预加载的分类数组
 */
function preloadRemainingCategories(categories) {
    if (categories.length === 0) return;

    /**
     * 执行预加载任务
     */
    const doPreload = async () => {
        for (const category of categories) {
            try {
                await loadAndRenderSection(category);
            } catch (e) {
                console.error(`[App] Failed to preload category "${category.id}":`, e);
            }
        }
    };

    // 使用 requestIdleCallback（如果支持）在浏览器空闲时执行
    // 否则使用 setTimeout 延迟执行
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => doPreload(), { timeout: 2000 });
    } else {
        setTimeout(doPreload, 100);
    }
}

/**
 * 为音乐 section 初始化播放器
 * 在音乐内容渲染完成后调用
 */
function initAudioPlayerForSection() {
    const musicSection = document.querySelector('.music-section');
    if (!musicSection) {
        return;
    }

    const playlistData = musicSection.dataset.playlist;
    if (!playlistData) {
        console.warn('[App] Music section found but no playlist data');
        return;
    }

    try {
        const playlist = JSON.parse(playlistData);
        AudioPlayer.init(playlist);
    } catch (e) {
        console.error('[App] Failed to parse playlist data:', e);
    }
}

/**
 * 滚动监听与导航高亮 (ScrollSpy)
 */
function setupScrollSpy() {
    const main = document.getElementById('main');
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    // 我们需要动态获取 navLinks 和 sections，因为它们是渲染出来的
    // 使用闭包或实时查询

    let isClickScrolling = false;
    let scrollTimeout;

    // 辅助：高亮 ID
    const highlight = (id) => {
        const navLinks = document.querySelectorAll('.type-nav a');
        navLinks.forEach(link => {
            if (link.dataset.target === id) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    // 1. 监听导航点击 (通过 RenderService 派发的事件)
    document.addEventListener('nav-click', (e) => {
        isClickScrolling = true;
        highlight(e.detail.id);

        // 手动滚动到目标 section
        // 移动端需考虑 Sticky Nav 的遮挡偏移 (约54px)
        const targetSection = document.getElementById(e.detail.id);
        if (targetSection) {
            const offset = isMobile ? 60 : 0; // Mobile Sticky Nav height comp

            if (isMobile) {
                const elementPosition = targetSection.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - offset;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            } else {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        if (scrollTimeout) clearTimeout(scrollTimeout);
    });

    // 2. 监听滚动解除锁定
    // 移动端滚动的是 window，桌面端滚动的是 main
    const scrollContainer = isMobile ? window : main;

    scrollContainer.addEventListener('scroll', () => {
        if (!isClickScrolling) return;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => isClickScrolling = false, 100);
    }, { passive: true });

    // 3. IntersectionObserver
    // 移动端视口为 null (Browser Viewport)，桌面端为 main
    const observer = new IntersectionObserver((entries) => {
        if (isClickScrolling) return;
        entries.forEach(entry => {
            if (entry.isIntersecting) highlight(entry.target.id);
        });
    }, {
        root: isMobile ? null : main,
        rootMargin: '-50% 0px -50% 0px', // 中心线检测
        threshold: 0
    });

    // 观察所有 section
    // 稍作延迟以确保 DOM 渲染完成
    setTimeout(() => {
        const sections = document.querySelectorAll('#contentRoot section');
        sections.forEach(sec => observer.observe(sec));
    }, 100);
}

/**
 * 移动端顶部导航栏滚动隐藏
 * - 向下滚动超过阈值：隐藏
 * - 向上滚动：显示
 * - 仅在移动端生效 (< 768px)
 */
function setupAutoHideHeader() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 媒体查询：仅移动端生效
    const mobileQuery = window.matchMedia('(max-width: 767px)');

    let lastScrollY = 0;
    let ticking = false;

    // 滚动阈值：超过此值才开始检测
    const SCROLL_THRESHOLD = 60;
    // 最小滚动差值：避免微小滚动触发
    const SCROLL_DELTA = 10;

    /**
     * 更新侧边栏显示/隐藏状态
     */
    function updateHeaderVisibility() {
        // 非移动端不处理
        if (!mobileQuery.matches) {
            sidebar.classList.remove('header-hidden');
            return;
        }

        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY;

        // 未超过阈值：始终显示
        if (currentScrollY <= SCROLL_THRESHOLD) {
            sidebar.classList.remove('header-hidden');
        }
        // 向下滚动超过最小差值：隐藏
        else if (scrollDelta > SCROLL_DELTA) {
            sidebar.classList.add('header-hidden');
        }
        // 向上滚动超过最小差值：显示
        else if (scrollDelta < -SCROLL_DELTA) {
            sidebar.classList.remove('header-hidden');
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    /**
     * 滚动事件处理（使用 requestAnimationFrame 节流）
     */
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeaderVisibility);
            ticking = true;
        }
    }

    // 监听滚动事件
    window.addEventListener('scroll', onScroll, { passive: true });

    // 监听窗口大小变化：非移动端时移除隐藏状态
    mobileQuery.addEventListener('change', (e) => {
        if (!e.matches) {
            sidebar.classList.remove('header-hidden');
        }
    });
}

// 启动
init();

// 初始化移动端滚动隐藏和主题管理（在 DOM 加载后执行）
document.addEventListener('DOMContentLoaded', () => {
    setupAutoHideHeader();
    initTheme();
    initTooltip();
    initScrollbarBehavior();
});
