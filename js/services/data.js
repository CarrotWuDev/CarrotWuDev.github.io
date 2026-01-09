import { Parser } from '../core/parser.js';

const CONFIG_URL = 'contents/博客配置.md';

export const DataService = {
    /**
     * 加载所有站点数据 (配置 + 各分类内容)
     */
    async loadSiteData() {
        const configRes = await fetch(CONFIG_URL);
        if (!configRes.ok) throw new Error(`Failed to load config: ${configRes.status}`);

        const configMd = await configRes.text();
        const config = Parser.parseConfig(configMd);

        // 并行加载所有分类内容
        const loadPromises = config.categories.map(async (cat) => {
            if (!cat.path) return cat;

            try {
                const res = await fetch(cat.path);
                if (res.ok) {
                    const md = await res.text();
                    cat.items = Parser.parseContent(md);
                } else {
                    console.warn(`Category file not found: ${cat.path}`);
                    cat.items = [];
                }
            } catch (err) {
                console.error(`Error loading category ${cat.title}:`, err);
                cat.items = [];
            }
            return cat;
        });

        await Promise.all(loadPromises);
        return config;
    }
};
