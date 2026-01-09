/**
 * 滚动条交互逻辑 (Auto-Hiding Scrollbar)
 * 监听滚动事件，设置 data-scrolling 属性用于 CSS 样式控制
 * 
 * 支持的容器：
 * - .main（主内容区）
 * - .playlist-content（音乐播放列表）
 */

/**
 * 为指定元素添加自动隐藏滚动条行为
 * @param {HTMLElement} element - 可滚动的容器元素
 * @param {number} hideDelay - 停止滚动后隐藏滚动条的延迟（毫秒）
 */
function attachScrollBehavior(element, hideDelay = 1000) {
    if (!element) return;

    let timer = null;

    element.addEventListener('scroll', () => {
        // 1. 标记为正在滚动
        if (!element.hasAttribute('data-scrolling')) {
            element.setAttribute('data-scrolling', 'true');
        }

        // 2. 清除之前的定时器
        if (timer) clearTimeout(timer);

        // 3. 设置防抖定时器：停止滚动后移除标记
        timer = setTimeout(() => {
            element.removeAttribute('data-scrolling');
        }, hideDelay);
    }, { passive: true });
}

/**
 * 初始化所有滚动条行为
 */
export function initScrollbarBehavior() {
    // 主内容区滚动条
    const main = document.querySelector('.main');
    attachScrollBehavior(main, 1000);

    // 音乐播放列表滚动条
    const playlistContent = document.querySelector('.playlist-content');
    attachScrollBehavior(playlistContent, 1000);
}
