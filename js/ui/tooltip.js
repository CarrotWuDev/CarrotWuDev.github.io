/**
 * Tooltip 模块
 * 将 Tooltip 挂载到 body 上，避免被父容器 overflow: hidden 裁剪
 */

let tooltipEl = null;
let currentTarget = null;
let hideTimeout = null;

/**
 * 初始化 Tooltip 系统
 */
export function initTooltip() {
    // 创建 Tooltip DOM 元素
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);

    // 事件委托：监听 mouseenter/mouseleave
    document.body.addEventListener('mouseenter', handleMouseEnter, true);
    document.body.addEventListener('mouseleave', handleMouseLeave, true);

    // 滚动时隐藏 Tooltip
    window.addEventListener('scroll', hideTooltip, true);
}

/**
 * 处理鼠标进入
 */
function handleMouseEnter(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const content = target.getAttribute('data-tooltip');
    if (!content || content.trim() === '') return;

    // 逻辑修正：
    // 1. 对于一般的文本类元素 (h3, p, .status)，我们只在文本被截断时显示 tooltip
    // 2. 对于显式的图标/按钮类元素 (如 .gallery-tag)，我们要强制显示 tooltip，不需要截断检测
    // 3. 通用支持：如果有 data-force-tooltip 属性，也强制显示
    const shouldForceShow = target.classList.contains('gallery-tag') || target.hasAttribute('data-force-tooltip');

    if (!shouldForceShow && !isTextTruncated(target)) return;

    // 清除隐藏延时
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }

    currentTarget = target;
    showTooltip(target, content);
}

/**
 * 检测元素文本是否被截断
 * - 单行截断：scrollWidth > clientWidth
 * - 多行截断：scrollHeight > clientHeight
 */
function isTextTruncated(el) {
    // 单行截断检测
    if (el.scrollWidth > el.clientWidth) {
        return true;
    }

    // 多行截断检测（line-clamp）
    if (el.scrollHeight > el.clientHeight) {
        return true;
    }

    return false;
}

/**
 * 处理鼠标离开
 */
function handleMouseLeave(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target || target !== currentTarget) return;

    // 延迟隐藏，避免鼠标移动到 Tooltip 上时闪烁
    hideTimeout = setTimeout(() => {
        hideTooltip();
    }, 100);
}

/**
 * 显示 Tooltip
 */
function showTooltip(target, content) {
    tooltipEl.textContent = content;
    tooltipEl.classList.add('visible');
    tooltipEl.setAttribute('aria-hidden', 'false');

    // 计算位置
    positionTooltip(target);
}

/**
 * 隐藏 Tooltip
 */
function hideTooltip() {
    if (!tooltipEl) return;

    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
    currentTarget = null;
}

/**
 * 计算并设置 Tooltip 位置
 */
function positionTooltip(target) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    // 默认显示在目标上方
    let top = targetRect.top - tooltipRect.height - 8;
    let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

    // 边界检测：如果上方空间不足，显示在下方
    if (top < 8) {
        top = targetRect.bottom + 8;
        tooltipEl.classList.add('tooltip--bottom');
    } else {
        tooltipEl.classList.remove('tooltip--bottom');
    }

    // 边界检测：左右边界
    const viewportWidth = window.innerWidth;
    if (left < 8) {
        left = 8;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
        left = viewportWidth - tooltipRect.width - 8;
    }

    // 应用位置（使用 transform 更高效）
    tooltipEl.style.top = `${top + window.scrollY}px`;
    tooltipEl.style.left = `${left + window.scrollX}px`;
}
