// ====== 配置：Markdown 数据地址（相对路径即可） ======
const APP_CONTENT_URL = 'contents/record.md';

// ====== 工具：slug 化（做 section id / 锚点用） ======
function slugify(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, '') // 允许中英文与数字、空格、- _ .
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ====== 解析 record.md -> 结构化数据 ======
// 规则：
// ## 类别
// ### 条目名
// 描述：xxxx
// 链接：[文本](https://...)
// 备注：全角/半角冒号均支持；链接也可仅给 URL（无 []() 也能解析）
function parseMarkdownToModel(md) {
  const lines = md.split(/\r?\n/);
  const categories = [];
  let currentCat = null;
  let currentItem = null;

  const pushItem = () => {
    if (currentCat && currentItem && currentItem.title) {
      // 描述或链接可为空，但尽量保留条目
      currentCat.items.push(currentItem);
    }
    currentItem = null;
  };

  for (let raw of lines) {
    const line = raw.trim();

    if (/^##\s+/.test(line)) {
      // 新类别
      pushItem(); // 先收尾上一个 item
      const title = line.replace(/^##\s+/, '').trim();
      currentCat = {
        title,
        id: slugify(title),
        items: []
      };
      categories.push(currentCat);
      continue;
    }

    if (/^###\s+/.test(line)) {
      // 新条目
      pushItem();
      if (!currentCat) {
        // 若还未出现过 ##，则忽略该条或创建默认分类
        currentCat = { title: '未分类', id: 'uncategorized', items: [] };
        categories.push(currentCat);
      }
      const title = line.replace(/^###\s+/, '').trim();
      currentItem = { title, desc: '', linkText: '', linkUrl: '' };
      continue;
    }

    // 描述
    if (/^描述\s*[:：]/.test(line)) {
      if (currentItem) {
        currentItem.desc = line.replace(/^描述\s*[:：]\s*/, '').trim();
      }
      continue;
    }

    // 链接
    if (/^链接\s*[:：]/.test(line)) {
      if (currentItem) {
        const rest = line.replace(/^链接\s*[:：]\s*/, '').trim();
        // 匹配 [文本](url)
        const m = rest.match(/^\[(.*?)\]\((.*?)\)$/);
        if (m) {
          currentItem.linkText = m[1].trim();
          currentItem.linkUrl = m[2].trim();
        } else {
          // 尝试匹配裸 URL
          const url = rest.match(/https?:\/\/\S+/);
          if (url) {
            currentItem.linkText = '访问';
            currentItem.linkUrl = url[0];
          } else {
            currentItem.linkText = rest || '访问';
            currentItem.linkUrl = '#';
          }
        }
      }
      continue;
    }

    // 空行/其他文字：忽略（可扩展为更多字段）
  }

  // 最后一个 item 收尾
  pushItem();

  // 过滤空分类（没有任何条目且标题不需要展示的）
  return categories.filter(c => c.items.length > 0 || !!c.title);
}

// ====== DOM 渲染 ======
function renderSidebarNav(categories) {
  const nav = document.getElementById('typeNav');
  nav.innerHTML = ''; // 清空
  categories.forEach((cat, idx) => {
    const a = document.createElement('a');
    a.textContent = cat.title;
    a.href = `#${cat.id}`;
    a.dataset.target = cat.id;
    if (idx === 0) a.setAttribute('aria-current', 'true');
    nav.appendChild(a);
  });
}

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

    cat.items.forEach(it => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = it.linkUrl || '#';
      a.target = '_blank';
      a.rel = 'noopener';

      const h3 = document.createElement('h3');
      h3.textContent = it.title || '未命名';

      const p = document.createElement('p');
      p.textContent = it.desc || '';

      const out = document.createElement('span');
      out.className = 'out';
      out.textContent = it.linkText || '访问';

      a.appendChild(h3);
      if (it.desc) a.appendChild(p);
      a.appendChild(out);
      cards.appendChild(a);
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

  // 点击左侧标签
  links.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.target;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 观察右侧 section 可见性，联动高亮
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        linkMap.forEach(el => el.removeAttribute('aria-current'));
        linkMap.get(en.target.id)?.setAttribute('aria-current', 'true');
      }
    });
  }, { root: main, threshold: 0.6 });

  document.querySelectorAll('main section[id]').forEach(sec => io.observe(sec));
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
