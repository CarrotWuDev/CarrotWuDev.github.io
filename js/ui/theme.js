/**
 * 主题管理器
 * 
 * 功能：
 * - 检测系统颜色偏好
 * - 读写 localStorage 持久化用户选择
 * - 切换 data-theme 属性
 * - 更新图标显示状态
 * 
 * 优先级：用户手动选择 > 系统偏好 > 默认亮色
 */

const STORAGE_KEY = 'theme-preference';

/**
 * 获取当前应使用的主题
 * @returns {'light' | 'dark'}
 */
function getPreferredTheme() {
    // 1. 优先读取用户保存的偏好
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
        return saved;
    }

    // 2. 检测系统偏好
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
}

/**
 * 应用主题到 DOM
 * @param {'light' | 'dark'} theme 
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleIcons(theme);
}

/**
 * 更新切换按钮图标显示状态
 * - 亮色模式：显示月亮（点击切换到暗色）
 * - 暗色模式：显示太阳（点击切换到亮色）
 * @param {'light' | 'dark'} theme 
 */
function updateToggleIcons(theme) {
    const moonIcon = document.getElementById('themeIconMoon');
    const sunIcon = document.getElementById('themeIconSun');

    if (moonIcon && sunIcon) {
        if (theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }
}

/**
 * 切换主题
 */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
}

/**
 * 绑定切换按钮点击事件
 */
function bindToggleButton() {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.addEventListener('click', toggleTheme);
    }
}

/**
 * 监听系统主题变化（仅当用户未手动选择时生效）
 */
function watchSystemPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', (e) => {
        // 仅当用户未手动选择时跟随系统
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/**
 * 初始化主题管理器
 * 应在 DOMContentLoaded 后调用
 */
export function initTheme() {
    const theme = getPreferredTheme();
    applyTheme(theme);
    bindToggleButton();
    watchSystemPreference();
}
