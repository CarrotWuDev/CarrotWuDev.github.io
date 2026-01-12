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
 * 
 * 使用"主动计算距离法"：
 * - 在滚动时计算每个 section 与视口中心的距离
 * - 选择距离最近的 section 进行高亮
 * - 使用 requestAnimationFrame 节流保证性能
 */
function setupScrollSpy() {
    const main = document.getElementById('main');
    const mobileQuery = window.matchMedia('(max-width: 767px)');

    // 响应式检测：使用 MediaQueryList 监听，支持窗口大小变化
    let isMobile = mobileQuery.matches;
    mobileQuery.addEventListener('change', (e) => {
        isMobile = e.matches;
    });

    // 状态变量
    let isClickScrolling = false;
    let scrollTimeout;
    let ticking = false;
    let currentActiveId = null;

    /**
     * 高亮指定 ID 的导航项
     * @param {string} id - section 的 ID
     */
    const highlight = (id) => {
        // 避免重复操作
        if (id === currentActiveId) return;
        currentActiveId = id;

        const nav = document.querySelector('.type-nav');
        const navLinks = document.querySelectorAll('.type-nav a');
        let activeLink = null;

        navLinks.forEach(link => {
            if (link.dataset.target === id) {
                link.setAttribute('aria-current', 'true');
                activeLink = link;
            } else {
                link.removeAttribute('aria-current');
            }
        });

        // 将高亮选项滚动到可见区域（桌面端和移动端都生效）
        if (nav && activeLink) {
            scrollNavToActiveLink(nav, activeLink, isMobile);
        }
    };

    /**
     * 将高亮的导航选项滚动到可见区域
     * 仅在选项不完全可见时触发滚动，避免不必要的滚动动画
     * 
     * @param {HTMLElement} nav - 导航容器
     * @param {HTMLElement} activeLink - 当前活跃的链接元素
     * @param {boolean} isMobileView - 是否为移动端视图
     */
    const scrollNavToActiveLink = (nav, activeLink, isMobileView) => {
        const navRect = nav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();

        // 根据设备类型检测可见性
        // 移动端：检测水平方向（横向滚动）
        // 桌面端：检测垂直方向（纵向滚动）
        let isFullyVisible;

        if (isMobileView) {
            // 移动端：检测水平方向
            isFullyVisible = linkRect.left >= navRect.left && linkRect.right <= navRect.right;
        } else {
            // 桌面端：检测垂直方向
            isFullyVisible = linkRect.top >= navRect.top && linkRect.bottom <= navRect.bottom;
        }

        if (!isFullyVisible) {
            // 使用 scrollIntoView 将选项滚动到居中位置
            activeLink.scrollIntoView({
                behavior: 'smooth',
                inline: isMobileView ? 'center' : 'nearest',  // 移动端水平居中
                block: isMobileView ? 'nearest' : 'center'    // 桌面端垂直居中
            });
        }
    };

    /**
     * 计算并更新当前活跃的 section
     * 使用距离算法：选择与视口中心距离最近的 section
     */
    const updateActiveSection = () => {
        const sections = document.querySelectorAll('#contentRoot section');
        if (sections.length === 0) {
            ticking = false;
            return;
        }

        // 获取滚动容器的滚动位置和视口高度
        const scrollTop = isMobile ? window.scrollY : main.scrollTop;
        const viewportHeight = isMobile ? window.innerHeight : main.clientHeight;

        // 计算视口中心线位置（相对于文档顶部）
        const centerLine = scrollTop + viewportHeight / 2;

        let activeSection = null;
        let minDistance = Infinity;

        sections.forEach(section => {
            // 获取 section 相对于滚动容器的位置
            let sectionTop;
            if (isMobile) {
                // 移动端：使用 getBoundingClientRect + scrollY
                sectionTop = section.getBoundingClientRect().top + window.scrollY;
            } else {
                // 桌面端：使用 offsetTop（相对于 main）
                sectionTop = section.offsetTop;
            }

            const sectionHeight = section.offsetHeight;
            const sectionCenter = sectionTop + sectionHeight / 2;

            // 计算与视口中心的距离
            const distance = Math.abs(sectionCenter - centerLine);

            if (distance < minDistance) {
                minDistance = distance;
                activeSection = section;
            }
        });

        if (activeSection) {
            highlight(activeSection.id);
        }

        ticking = false;
    };

    /**
     * 滚动事件处理器
     * 使用 requestAnimationFrame 节流
     */
    const onScroll = () => {
        // 点击滚动期间不处理
        if (isClickScrolling) return;

        if (!ticking) {
            requestAnimationFrame(updateActiveSection);
            ticking = true;
        }
    };

    // 1. 监听导航点击 (通过 RenderService 派发的事件)
    document.addEventListener('nav-click', (e) => {
        isClickScrolling = true;
        highlight(e.detail.id);

        // 手动滚动到目标 section
        // 移动端需考虑 Sticky Nav 的遮挡偏移 (约60px)
        const targetSection = document.getElementById(e.detail.id);
        if (targetSection) {
            const offset = isMobile ? 60 : 0;

            if (isMobile) {
                const elementPosition = targetSection.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - offset;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            } else {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // 清除之前的定时器
        if (scrollTimeout) clearTimeout(scrollTimeout);
    });

    // 2. 监听滚动事件
    // 注意：需要同时监听 window 和 main，因为用户可能在不同视口宽度下操作
    const setupScrollListeners = () => {
        // 移动端监听 window，桌面端监听 main
        const scrollContainer = isMobile ? window : main;

        // 主滚动监听
        scrollContainer.addEventListener('scroll', onScroll, { passive: true });

        // 解除点击滚动锁定
        scrollContainer.addEventListener('scroll', () => {
            if (!isClickScrolling) return;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isClickScrolling = false;
            }, 150);  // 略微增加延迟，确保平滑滚动完成
        }, { passive: true });
    };

    // 初始化滚动监听
    // 同时监听 window 和 main 以确保在任何情况下都能响应
    window.addEventListener('scroll', onScroll, { passive: true });
    if (main) {
        main.addEventListener('scroll', onScroll, { passive: true });
    }

    // 解除点击滚动锁定（两个容器都监听）
    window.addEventListener('scroll', () => {
        if (!isClickScrolling) return;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => isClickScrolling = false, 150);
    }, { passive: true });

    if (main) {
        main.addEventListener('scroll', () => {
            if (!isClickScrolling) return;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => isClickScrolling = false, 150);
        }, { passive: true });
    }

    // 3. 初始化：延迟执行以确保 DOM 渲染完成
    setTimeout(() => {
        updateActiveSection();
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
