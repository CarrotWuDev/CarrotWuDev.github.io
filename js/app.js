// ====== 配置：Markdown 数据地址（相对路径即可） ======
const APP_CONTENT_URL = 'contents/record.md';

// ====== 类型配置：定义每种类型支持的字段 ======
const TYPE_CONFIG = {
  '独立开发者': {
    type: 'project',
    fields: ['描述', '技术栈', '状态', '链接']
  },
  '游戏': {
    type: 'game',
    fields: ['描述', '标签', '状态', '链接']
  },
  // 默认配置（其他未定义的类型）
  _default: {
    type: 'default',
    fields: ['描述', '状态', '链接']
  }
};

// ====== 工具：slug 化（做 section id / 锚点用） ======
function slugify(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ====== 解析单行字段 ======
function parseField(line, fieldName) {
  const regex = new RegExp(`^${fieldName}\\s*[:：]`);
  if (regex.test(line)) {
    return line.replace(regex, '').trim();
  }
  return null;
}

// ====== 解析链接字段 ======
function parseLink(line) {
  const rest = line.replace(/^链接\s*[:：]\s*/, '').trim();
  const m = rest.match(/^\[(.*?)\]\((.*?)\)$/);
  if (m) {
    return { text: m[1].trim(), url: m[2].trim() };
  }
  const url = rest.match(/https?:\/\/\S+/);
  if (url) {
    return { text: '访问', url: url[0] };
  }
  return { text: rest || '访问', url: '#' };
}

// ====== 解析 record.md -> 结构化数据 ======
function parseMarkdownToModel(md) {
  const lines = md.split(/\r?\n/);
  const categories = [];
  let currentCat = null;
  let currentItem = null;

  const pushItem = () => {
    if (currentCat && currentItem && currentItem.title) {
      currentCat.items.push(currentItem);
    }
    currentItem = null;
  };

  for (let raw of lines) {
    const line = raw.trim();

    // 新类别
    if (/^##\s+/.test(line)) {
      pushItem();
      const title = line.replace(/^##\s+/, '').trim();
      const config = TYPE_CONFIG[title] || TYPE_CONFIG._default;
      currentCat = {
        title,
        id: slugify(title),
        type: config.type,
        items: []
      };
      categories.push(currentCat);
      continue;
    }

    // 新条目
    if (/^###\s+/.test(line)) {
      pushItem();
      if (!currentCat) {
        currentCat = { title: '未分类', id: 'uncategorized', type: 'default', items: [] };
        categories.push(currentCat);
      }
      const title = line.replace(/^###\s+/, '').trim();
      currentItem = { title };
      continue;
    }

    if (!currentItem) continue;

    // 描述
    const desc = parseField(line, '描述');
    if (desc !== null) { currentItem.desc = desc; continue; }

    // 技术栈（独立开发者类型）
    const tech = parseField(line, '技术栈');
    if (tech !== null) { currentItem.tech = tech; continue; }

    // 标签（游戏类型）
    const tags = parseField(line, '标签');
    if (tags !== null) { currentItem.tags = tags; continue; }

    // 评价（游戏类型）
    const review = parseField(line, '评价');
    if (review !== null) { currentItem.review = review; continue; }

    // 状态
    const status = parseField(line, '状态');
    if (status !== null) { currentItem.status = status; continue; }

    // 链接
    if (/^链接\s*[:：]/.test(line)) {
      const link = parseLink(line);
      currentItem.linkText = link.text;
      currentItem.linkUrl = link.url;
      continue;
    }
  }

  pushItem();
  return categories.filter(c => c.items.length > 0 || !!c.title);
}


// ====== DOM 渲染 ======
function renderSidebarNav(categories) {
  const nav = document.getElementById('typeNav');
  nav.innerHTML = '';
  categories.forEach((cat, idx) => {
    const a = document.createElement('a');
    a.textContent = cat.title;
    a.href = `#${cat.id}`;
    a.dataset.target = cat.id;
    if (idx === 0) a.setAttribute('aria-current', 'true');
    nav.appendChild(a);
  });
}

// ====== 组件构建辅助函数 ======

/**
 * 创建卡片头部：包含标题和状态
 * @param {string} title - 项目标题
 * @param {string} status - 项目状态
 * @returns {HTMLElement} - 头部 DOM
 */
function createCardHeader(title, status) {
  const header = document.createElement('div');
  header.className = 'card-header';

  const h3 = document.createElement('h3');
  h3.textContent = title || '未命名';
  header.appendChild(h3);

  if (status) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'status';
    statusSpan.dataset.status = status;
    statusSpan.textContent = status;
    header.appendChild(statusSpan);
  }

  return header;
}

/**
 * 创建标签列表
 * @param {string} tagsStr - 原始标签字符串
 * @param {string} containerClass - 容器类名
 * @param {string} tagClass - 单个标签类名
 * @param {RegExp} separator - 分隔符正则
 * @returns {HTMLElement|null} - 标签容器 DOM，无标签时不返回
 */
function createTagList(tagsStr, containerClass, tagClass, separator = /[、,，\/|｜]/) {
  if (!tagsStr) return null;

  const tagsContainer = document.createElement('div');
  tagsContainer.className = containerClass;

  tagsStr.split(separator).map(t => t.trim()).filter(Boolean).forEach(t => {
    const tag = document.createElement('span');
    tag.className = tagClass;
    tag.textContent = t;
    tagsContainer.appendChild(tag);
  });

  return tagsContainer;
}

/**
 * 创建卡片底部链接（包含无障碍增强）
 * @param {string} url - 链接地址
 * @param {string} text - 链接文本
 * @param {string} contextTitle - 用于 aria-label 的项目标题
 * @returns {HTMLElement} - 链接 DOM
 */
function createCardFooter(url, text, contextTitle) {
  const link = document.createElement('a');
  link.className = 'out';
  link.href = url || '#';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = text || '访问';
  // A11y: 增加无障碍描述
  link.setAttribute('aria-label', `访问 ${contextTitle} 的 ${text || '链接'}`);
  return link;
}

// ====== 卡片渲染器：独立开发者类型 ======
function renderProjectCard(it) {
  const card = document.createElement('div');
  card.className = 'card card-project';

  // 1. 头部
  card.appendChild(createCardHeader(it.title, it.status));

  // 2. 描述
  if (it.desc) {
    const p = document.createElement('p');
    p.textContent = it.desc;
    card.appendChild(p);
  }

  // 3. 技术栈
  const techTags = createTagList(it.tech, 'tech-tags', 'tech-tag');
  if (techTags) {
    card.appendChild(techTags);
  }

  // 4. 底部链接
  card.appendChild(createCardFooter(it.linkUrl, it.linkText, it.title));

  return card;
}

// ====== 卡片渲染器：游戏类型 ======
function renderGameCard(it) {
  const card = document.createElement('div');
  card.className = 'card card-game';

  // 1. 头部
  card.appendChild(createCardHeader(it.title, it.status));

  // 2. 描述
  if (it.desc) {
    const p = document.createElement('p');
    p.textContent = it.desc;
    card.appendChild(p);
  }

  // 3. 评价 (游戏特有)
  if (it.review) {
    const reviewP = document.createElement('p');
    reviewP.className = 'review';
    reviewP.textContent = it.review;
    card.appendChild(reviewP);
  }

  // 4. 游戏标签
  const gameTags = createTagList(it.tags, 'game-tags', 'game-tag');
  if (gameTags) {
    card.appendChild(gameTags);
  }

  // 5. 底部链接
  card.appendChild(createCardFooter(it.linkUrl, it.linkText, it.title));

  return card;
}

// ====== 卡片渲染器：默认类型 ======
function renderDefaultCard(it) {
  const card = document.createElement('div');
  card.className = 'card';

  const h3 = document.createElement('h3');
  h3.textContent = it.title || '未命名';
  card.appendChild(h3);

  if (it.desc) {
    const p = document.createElement('p');
    p.textContent = it.desc;
    card.appendChild(p);
  }

  if (it.status) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'status';
    statusSpan.dataset.status = it.status;
    statusSpan.textContent = it.status;
    card.appendChild(statusSpan);
  }

  const link = document.createElement('a');
  link.className = 'out';
  link.href = it.linkUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = it.linkText || '访问';
  card.appendChild(link);

  return card;
}

// ====== 渲染器映射 ======
const CARD_RENDERERS = {
  project: renderProjectCard,
  game: renderGameCard,
  default: renderDefaultCard
};

function renderMainSections(categories) {
  const root = document.getElementById('contentRoot');
  root.innerHTML = '';

  categories.forEach(cat => {
    const sec = document.createElement('section');
    sec.id = cat.id;
    sec.setAttribute('aria-labelledby', `h-${cat.id}`);

    const h2 = document.createElement('h2');
    h2.id = `h-${cat.id}`;
    h2.textContent = cat.title;

    const cards = document.createElement('div');
    cards.className = 'cards';

    const renderer = CARD_RENDERERS[cat.type] || CARD_RENDERERS.default;
    cat.items.forEach(it => {
      cards.appendChild(renderer(it));
    });

    sec.appendChild(h2);
    sec.appendChild(cards);
    root.appendChild(sec);
  });
}

// 左侧点击 -> 右侧容器滚动；右侧滚动联动高亮
function bindScrollSync() {
  const main = document.getElementById('main');
  const links = Array.from(document.querySelectorAll('.type-nav a'));
  const linkMap = new Map(links.map(a => [a.dataset.target, a]));

  let isScrollingByClick = false; // 标记是否由点击触发的滚动

  // 点击左侧标签
  links.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.target;

      // 立即高亮点击的选项
      linkMap.forEach(el => el.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');

      // 标记正在程序滚动，暂停滚动监听干扰
      isScrollingByClick = true;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // 滚动结束后恢复监听
      setTimeout(() => { isScrollingByClick = false; }, 600);
    });
  });

  // 滚动时高亮距离视口顶部最近的区块
  main.addEventListener('scroll', () => {
    if (isScrollingByClick) return; // 跳过程序滚动

    const sections = Array.from(document.querySelectorAll('main section[id]'));
    let closest = null;
    let minDistance = Infinity;
    const mainTop = main.getBoundingClientRect().top;

    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      const distance = Math.abs(rect.top - mainTop);
      if (distance < minDistance) {
        minDistance = distance;
        closest = sec;
      }
    });

    if (closest) {
      linkMap.forEach(el => el.removeAttribute('aria-current'));
      linkMap.get(closest.id)?.setAttribute('aria-current', 'true');
    }
  }, { passive: true });
}

// ====== 启动：加载 MD -> 解析 -> 渲染 -> 绑定交互 ======
async function boot() {
  document.getElementById('y').textContent = new Date().getFullYear();

  try {
    const res = await fetch(APP_CONTENT_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`加载失败：${res.status} ${res.statusText}`);
    const md = await res.text();

    const data = parseMarkdownToModel(md);
    if (!data.length) {
      document.getElementById('contentRoot').innerHTML =
        '<section><h2>暂无内容</h2><div class="desc">请在 contents/record.md 中添加 “## 类别 / ### 条目 / 描述 / 链接”。</div></section>';
      return;
    }

    renderSidebarNav(data);
    renderMainSections(data);
    bindScrollSync();
  } catch (err) {
    console.error(err);
    document.getElementById('contentRoot').innerHTML =
      `<section><h2>加载失败</h2><div class="desc">${String(err)}</div></section>`;
  }
}

boot();
