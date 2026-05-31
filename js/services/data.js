import { Parser } from '../core/parser.js';
import { SortStrategyFactory } from '../core/sort-strategy.js';

const CONFIG_URL = 'contents/博客配置.md';

/**
 * 数据服务层
 * 负责加载和缓存博客配置及分类内容
 * 
 * 加载策略：首屏优先 + 后台加载
 * - 配置文件立即加载
 * - 分类内容按需加载，支持缓存
 */
export const DataService = {
    /**
     * 已加载的分类内容缓存
     * @type {Map<string, Array>}
     * @private
     */
    _contentCache: new Map(),

    /**
     * 正在进行的加载请求（防止重复请求）
     * @type {Map<string, Promise>}
     * @private
     */
    _pendingRequests: new Map(),

    /**
     * 加载站点配置（仅元数据，不含分类内容）
     * @returns {Promise<Object>} 站点配置对象
     */
    async loadSiteConfig() {
        const response = await fetch(CONFIG_URL);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }

        const markdown = await response.text();
        return Parser.parseConfig(markdown);
    },

    /**
     * 加载单个分类的内容
     * 支持缓存和请求去重
     * 
     * @param {Object} category - 分类对象，需包含 id、path、type 和 limit 属性
     * @returns {Promise<Array>} 分类内容项数组
     */
    async loadCategoryContent(category) {
        const { id, path, type = 'default', limit } = category;

        // 无路径则返回空数组
        if (!path) {
            return [];
        }

        // 命中缓存，直接返回
        if (this._contentCache.has(id)) {
            return this._contentCache.get(id);
        }

        // 请求去重：如果该分类正在加载中，返回同一个 Promise
        if (this._pendingRequests.has(id)) {
            return this._pendingRequests.get(id);
        }

        // 创建加载 Promise
        const loadPromise = this._fetchAndParseCategoryContent(id, path, type, limit);
        this._pendingRequests.set(id, loadPromise);

        try {
            const items = await loadPromise;
            return items;
        } finally {
            // 请求完成后移除 pending 状态
            this._pendingRequests.delete(id);
        }
    },

    /**
     * 实际执行分类内容的获取、解析、排序、限制
     * @private
     * @param {string} id - 分类 ID
     * @param {string} path - 分类文件路径
     * @param {string} type - 分类类型（用于选择排序策略）
     * @param {string|number} limit - 最多显示的项目数（可选）
     * @returns {Promise<Array>} 分类内容项数组
     */
    async _fetchAndParseCategoryContent(id, path, type = 'default', limit) {
        try {
            const response = await fetch(path);

            if (!response.ok) {
                console.warn(`[DataService] Category file not found: ${path}`);
                this._contentCache.set(id, []);
                return [];
            }

            const markdown = await response.text();
            let items = Parser.parseContent(markdown);

            // 应用排序策略
            SortStrategyFactory.sortItems(items, type);

            // 应用数量限制
            items = this._limitItems(items, limit);

            // 写入缓存
            this._contentCache.set(id, items);
            return items;

        } catch (error) {
            console.error(`[DataService] Error loading category "${id}":`, error);
            this._contentCache.set(id, []);
            return [];
        }
    },

    /**
     * 根据配置限制项目数量
     * @private
     * @param {Array} items - 内容项数组
     * @param {string|number|undefined} limit - 限制数量
     * @returns {Array} 限制后的数组
     * 
     * 限制规则：
     * - 无 limit 或为 undefined/null：返回全部
     * - limit 为 '999' 或 999：返回全部（特殊值表示不限制）
     * - limit 为正整数：返回前 limit 条
     * - limit 为非法值：记录警告，返回全部
     */
    _limitItems(items, limit) {
        // 检查输入
        if (!Array.isArray(items)) {
            return [];
        }

        // 未指定限制或为 999：返回全部
        if (limit === undefined || limit === null || limit === '999' || limit === 999) {
            return items;
        }

        // 转换为数字
        const numLimit = parseInt(limit, 10);

        // 检查合法性
        if (isNaN(numLimit) || numLimit <= 0) {
            console.warn(`[DataService] Invalid limit value: "${limit}", displaying all items`);
            return items;
        }

        // 返回前 limit 条
        return items.slice(0, numLimit);
    },

    /**
     * 批量预加载多个分类内容（后台静默加载）
     * @param {Array<Object>} categories - 分类对象数组
     * @returns {Promise<void>}
     */
    async preloadCategories(categories) {
        const loadPromises = categories.map(cat => this.loadCategoryContent(cat));
        await Promise.allSettled(loadPromises);
    },

    /**
     * 检查分类内容是否已加载
     * @param {string} categoryId - 分类 ID
     * @returns {boolean}
     */
    isCategoryLoaded(categoryId) {
        return this._contentCache.has(categoryId);
    },

    /**
     * 清除缓存（用于刷新数据）
     */
    clearCache() {
        this._contentCache.clear();
        this._pendingRequests.clear();
    }
};
