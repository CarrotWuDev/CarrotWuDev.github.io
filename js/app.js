import { DataService } from './services/data.js';
import { RenderService } from './ui/render.js';
import { initTheme } from './ui/theme.js';
import { initTooltip } from './ui/tooltip.js';
import { initScrollbarBehavior } from './ui/scroll.js';
import { AudioPlayer } from './ui/audio-player.js';

/**
 * 应用程序入口
 */
async function init() {
    try {
        // 1. 初始化 UI 事件委托
        RenderService.init();

        // 2. 加载数据
        const data = await DataService.loadSiteData();

        // 3. 渲染页面
        RenderService.renderAll(data);

        // 4. 初始化音乐播放器
        initAudioPlayer();

        // 5. 启动滚动监听
        setupScrollSpy();

    } catch (e) {
        console.error('App initialization failed:', e);
        document.getElementById('contentRoot').innerHTML = `<p class="error" style="padding:20px;color:red;">Start Error: ${e.message}</p>`;
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
 * 初始化音乐播放器
 * 查找 .music-section 元素并解析播放列表数据
 */
function initAudioPlayer() {
    const musicSection = document.querySelector('.music-section');
    if (!musicSection) {
        console.log('[App] No music section found, skipping AudioPlayer init');
        return;
    }

    // 解析 data-playlist 属性中的 JSON 数据
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
