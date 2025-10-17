/* 左侧标签点击 → 右侧容器平滑滚动 */
    const main = document.getElementById('main');
    document.querySelectorAll('.type-nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const id = a.dataset.target;
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* 右侧滚动联动左侧高亮 */
    const linkMap = new Map();
    document.querySelectorAll('.type-nav a').forEach(a => linkMap.set(a.dataset.target, a));

    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          linkMap.forEach(el => el.removeAttribute('aria-current'));
          linkMap.get(en.target.id)?.setAttribute('aria-current', 'true');
        }
      });
    }, { root: main, threshold: 0.6 });

    document.querySelectorAll('main section[id]').forEach(sec => io.observe(sec));

    /* 年份 */
    document.getElementById('y').textContent = new Date().getFullYear();