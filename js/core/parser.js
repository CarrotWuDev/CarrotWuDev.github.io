import { parseField, parseLink, slugify } from './utils.js';

export const Parser = {
    /**
     * 解析博客配置文件
     */
    parseConfig(md) {
        const lines = md.split(/\r?\n/);
        const config = {
            blogInfo: {},
            authorInfo: {},
            categories: []
        };

        let currentSection = null;
        let currentCategory = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (/^##\s+博客信息/.test(trimmed)) { currentSection = 'blog'; continue; }
            if (/^##\s+作者信息/.test(trimmed)) { currentSection = 'author'; continue; }
            if (/^##\s+展示类别/.test(trimmed)) { currentSection = 'categories'; continue; }

            if (currentSection === 'blog') {
                const title = parseField(trimmed, '博客名称');
                if (title) config.blogInfo.title = title;

                const desc = parseField(trimmed, '网站描述');
                if (desc) config.blogInfo.desc = desc;

                const slogan = parseField(trimmed, '标语');
                if (slogan) config.blogInfo.slogan = slogan;

                const copyright = parseField(trimmed, '版权');
                if (copyright) config.blogInfo.copyright = copyright;
            } else if (currentSection === 'author') {
                const name = parseField(trimmed, '姓名');
                if (name) config.authorInfo.name = name;

                const avatar = parseField(trimmed, '头像');
                if (avatar) {
                    const m = avatar.match(/^!\[.*?\]\((.*?)\)$/);
                    let url = m ? m[1] : avatar;
                    if (url.startsWith('../')) url = url.substring(3);
                    config.authorInfo.avatar = url;
                }

                const email = parseField(trimmed, 'Email');
                if (email) {
                    const m = email.match(/<(.+?)>/);
                    config.authorInfo.email = m ? m[1] : email;
                }

                const github = parseField(trimmed, 'Github');
                if (github) {
                    const m = github.match(/^\[(.*?)\]\((.*?)\)$/);
                    config.authorInfo.github = m ? m[2] : github;
                }

                const tags = parseField(trimmed, '标签');
                if (tags) config.authorInfo.tags = tags.split(/[、,，]/).map(t => t.trim());
            } else if (currentSection === 'categories') {
                if (/^###\s+/.test(trimmed)) {
                    const title = trimmed.replace(/^###\s+/, '').trim();
                    currentCategory = {
                        title: title,
                        id: slugify(title),
                        type: 'default' // Default type
                    };
                    config.categories.push(currentCategory);
                    continue;
                }
                if (currentCategory) {
                    const type = parseField(trimmed, '样式类型');
                    if (type) currentCategory.type = type;

                    const order = parseField(trimmed, '展示序号');
                    if (order) currentCategory.order = parseInt(order, 10);
                    const color = parseField(trimmed, '强调色');
                    if (color) currentCategory.color = color;
                    if (trimmed.startsWith('链接：')) {
                        const m = trimmed.match(/\((.*?)\)$/);
                        if (m) {
                            let path = m[1];
                            if (path.startsWith('../')) path = path.substring(3);
                            currentCategory.path = path;
                        }
                    }
                }
            }
        }
        config.categories.sort((a, b) => (a.order || 99) - (b.order || 99));
        return config;
    },

    /**
     * 解析分类内容文件 (markdown -> items array)
     */
    parseContent(md) {
        const lines = md.split(/\r?\n/);
        const items = [];
        let currentItem = null;

        const pushItem = () => {
            if (currentItem && currentItem.title) {
                items.push(currentItem);
            }
            currentItem = null;
        };

        for (const line of lines) {
            const trimmed = line.trim();

            // H2: New Item
            if (/^##\s+/.test(trimmed)) {
                pushItem();
                currentItem = {
                    title: trimmed.replace(/^##\s+/, '').trim(),
                    photos: [] // For photo sets
                };
                continue;
            }

            // H3: Sub Item (Gallery Photo)
            if (/^###\s+/.test(trimmed)) {
                if (currentItem) {
                    currentItem.isSet = true;
                    // Switch context to new photo object
                    const photoTitle = trimmed.replace(/^###\s+/, '').trim();
                    currentItem.currentSubItem = { title: photoTitle };
                    currentItem.photos.push(currentItem.currentSubItem);
                }
                continue;
            }

            if (!currentItem) continue;

            // Target is either the main item or the sub-item (photo)
            let target = currentItem;
            if (currentItem.isSet && currentItem.currentSubItem) {
                target = currentItem.currentSubItem;
            }

            // --- Fields ---
            // Support both '展示序号' (legacy) and '序号' (new local index)
            const order = parseField(trimmed, '展示序号') || parseField(trimmed, '序号');
            if (order) {
                // For gallery sub-items, this effectively becomes a local index (e.g., "1", "2")
                target.order = order;
                continue;
            }

            const quantity = parseField(trimmed, '数量');
            if (quantity) {
                const count = parseInt(quantity, 10);
                // 数量大于1视为图集
                if (!isNaN(count) && count > 1) {
                    currentItem.isSet = true;
                    continue;
                }
            }

            const desc = parseField(trimmed, '描述');
            if (desc) { target.desc = desc; continue; }

            const tech = parseField(trimmed, '技术栈');
            if (tech) { target.tech = tech; continue; }

            // Game fields
            const status = parseField(trimmed, '状态');
            if (status) { target.status = status; continue; }

            const gameType = parseField(trimmed, '游戏类型') || parseField(trimmed, '标签');
            if (gameType) { target.tags = gameType; continue; } // Unify as tags

            const dev = parseField(trimmed, '开发商') || parseField(trimmed, '厂商');
            if (dev) { target.dev = dev; continue; }

            const platform = parseField(trimmed, '发售平台') || parseField(trimmed, '平台');
            if (platform) { target.platform = platform; continue; }

            const releaseDate = parseField(trimmed, '发售日期') || parseField(trimmed, '日期');
            if (releaseDate) { target.releaseDate = releaseDate; continue; }

            const review = parseField(trimmed, '评价');
            if (review) { target.review = review; continue; }

            // Book fields
            const author = parseField(trimmed, '作者');
            if (author) { target.author = author; continue; }

            const publishYear = parseField(trimmed, '出版年份') || parseField(trimmed, '出版时间');
            if (publishYear) { target.publishYear = publishYear; continue; }

            const bookType = parseField(trimmed, '书籍类型');
            if (bookType) { target.tags = bookType; continue; } // Unify as tags

            // Photo fields
            const pLoc = parseField(trimmed, '拍摄地点');
            if (pLoc) { target.photoLocation = pLoc; continue; }
            const pDate = parseField(trimmed, '拍摄日期');
            if (pDate) { target.photoDate = pDate; continue; }

            // Images
            // Images
            const coverRaw = parseField(trimmed, '封面') || parseField(trimmed, 'Cover');
            if (coverRaw) {
                // Strict validation: must be markdown image format ![alt](url)
                const m = coverRaw.match(/^!\[(.*?)\]\((.+?)\)$/);
                if (m && m[2] && m[2].trim()) {
                    target.cover = m[2].trim();
                }
                // If format invalid or url empty, target.cover remains undefined
                // allowing fallback to ISBN logic below
                if (target.cover) continue;
            }

            const isbn = parseField(trimmed, 'ISBN');
            if (isbn && !target.cover) {
                // Auto-generate cover from ISBN using Open Library if no custom cover provided
                target.cover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
                continue;
            }

            const steamId = parseField(trimmed, 'SteamID') || parseField(trimmed, 'SteamAppID');
            if (steamId && !target.cover) {
                // Auto-generate cover from Steam CDN if no custom cover provided
                target.cover = `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`;
                continue;
            }

            const photoRaw = parseField(trimmed, '照片链接');
            if (photoRaw) {
                const m = photoRaw.match(/\((.*?)\)$/);
                let url = m ? m[1] : photoRaw;
                if (url.startsWith('../')) url = url.substring(3);
                target.photoUrl = url;
                continue;
            }

            // Link
            if (/^链接\s*[:：]/.test(trimmed)) {
                const link = parseLink(trimmed);
                target.linkText = link.text;
                target.linkUrl = link.url;
                continue;
            }
        }
        pushItem();

        // Sort Items
        const sortFn = (a, b) => {
            // Safe compare: default to 999 if no order
            const oA = a.order || '999';
            const oB = b.order || '999';
            // Try numeric sort first
            const nA = parseFloat(oA);
            const nB = parseFloat(oB);
            if (!isNaN(nA) && !isNaN(nB) && nA !== nB) return nA - nB;
            // Fallback to string sort
            return oA.localeCompare(oB);
        };

        items.sort(sortFn);

        // Sort Sub-items (Photos in Gallery)
        items.forEach(item => {
            if (item.isSet && item.photos) {
                item.photos.sort(sortFn);
            }
        });

        return items;
    }
};
