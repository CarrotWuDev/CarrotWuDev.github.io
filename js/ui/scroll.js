/**
 * 滚动条交互逻辑 (Auto-Hiding Scrollbar)
 * 监听滚动事件，设置 data-scrolling 属性用于 CSS 样式控制
 */
export function initScrollbarBehavior() {
    const main = document.querySelector('.main');
    if (!main) return;

    let timer;

    // 监听滚动事件
    main.addEventListener('scroll', () => {
        // 1. 标记为正在滚动
        if (!main.hasAttribute('data-scrolling')) {
            main.setAttribute('data-scrolling', 'true');
        }

        // 2. 清除之前的定时器
        if (timer) clearTimeout(timer);

        // 3. 设置防抖定时器：停止滚动 1秒 后移除标记
        timer = setTimeout(() => {
            main.removeAttribute('data-scrolling');
        }, 1000);
    }, { passive: true });
}
