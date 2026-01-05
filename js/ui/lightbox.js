/**
 * 极简 Lightbox 组件
 * 用于全屏查看照片原图
 */

let lightboxEl = null;
let imgEl = null;

/**
 * 初始化 Lightbox DOM 结构 (Lazy Load)
 */
function ensureLightbox() {
    if (lightboxEl) return;

    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.innerHTML = `
        <div class="lightbox-overlay"></div>
        <div class="lightbox-content">
            <img src="" alt="原图预览" class="lightbox-img">
            <button class="lightbox-close" aria-label="关闭">×</button>
        </div>
    `;

    // 绑定事件
    imgEl = lightboxEl.querySelector('.lightbox-img');
    const closeBtn = lightboxEl.querySelector('.lightbox-close');
    const overlay = lightboxEl.querySelector('.lightbox-overlay');

    const close = () => {
        lightboxEl.classList.remove('active');
        setTimeout(() => {
            if (!lightboxEl.classList.contains('active')) {
                imgEl.src = ''; // 清理 src 释放内存
            }
        }, 300); // 等待淡出动画结束
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl) close();
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxEl.classList.contains('active')) {
            close();
        }
    });

    document.body.appendChild(lightboxEl);
}

/**
 * 显示原图
 * @param {string} src 图片地址
 * @param {string} alt 图片描述
 */
export function openLightbox(src, alt = '') {
    ensureLightbox();
    imgEl.src = src;
    imgEl.alt = alt;
    // 强制重绘以触发 transition
    requestAnimationFrame(() => {
        lightboxEl.classList.add('active');
    });
}
