import { DataService } from './services/data.js';
import { RenderService } from './ui/render.js';

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

        // 4. 启动滚动监听
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

        if (scrollTimeout) clearTimeout(scrollTimeout);
    });

    // 2. 监听滚动解除锁定
    main.addEventListener('scroll', () => {
        if (!isClickScrolling) return;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => isClickScrolling = false, 100);
    }, { passive: true });

    // 3. IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
        if (isClickScrolling) return;
        entries.forEach(entry => {
            if (entry.isIntersecting) highlight(entry.target.id);
        });
    }, {
        root: main,
        rootMargin: '-50% 0px -50% 0px', // 中心线检测
        threshold: 0
    });

    // 观察所有 section
    const sections = document.querySelectorAll('#contentRoot section');
    sections.forEach(sec => observer.observe(sec));
}

// 启动
init();
