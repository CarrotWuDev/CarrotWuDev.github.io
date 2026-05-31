/**
 * 排序策略工厂
 * 根据分类类型返回相应的排序函数
 * 
 * 设计：策略模式，支持多种排序规则
 * - diary: 按日期倒序（最新优先）
 * - default: 按 order 字段排序（现有逻辑）
 */

export const SortStrategyFactory = {
    /**
     * 日期倒序排序函数（用于日记分类）
     * 最新的日期优先显示
     * 
     * @private
     */
    _dateDescendingSortFn: (a, b) => {
        // 提取日期时间戳，无效值视为 0（排在最后）
        const dateA = a.dateTimestamp || 0;
        const dateB = b.dateTimestamp || 0;

        // 倒序：时间戳大的（更新的日期）排在前面
        if (dateA !== dateB) {
            return dateB - dateA;
        }

        // 日期相同时，保持原有顺序（稳定排序）
        return 0;
    },

    /**
     * 序号字段排序函数（用于其他分类）
     * 与原有逻辑保持一致：
     * - 尝试数值排序
     * - 降级为字符串排序
     * - 缺少 order 字段的项排在后面
     * 
     * @private
     */
    _orderFieldSortFn: (a, b) => {
        // 获取排序字段，默认值为 '999'
        const orderA = a.order !== undefined ? String(a.order) : '999';
        const orderB = b.order !== undefined ? String(b.order) : '999';

        // 尝试数值比较
        const numA = parseFloat(orderA);
        const numB = parseFloat(orderB);

        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
        }

        // 降级为字符串比较
        return orderA.localeCompare(orderB, 'zh-CN');
    },

    /**
     * 根据分类类型获取对应的排序函数
     * 
     * @param {string} categoryType - 分类类型（'diary' | 'default'）
     * @returns {Function} 排序函数 (a, b) => number
     * 
     * @example
     * const sortFn = SortStrategyFactory.createSortStrategy('diary');
     * items.sort(sortFn);
     */
    createSortStrategy(categoryType) {
        switch (categoryType) {
            case 'diary':
                return this._dateDescendingSortFn;
            
            case 'default':
            default:
                return this._orderFieldSortFn;
        }
    },

    /**
     * 批量应用排序策略到多个分类
     * 用于加载时一次性排序所有分类内容
     * 
     * @param {Array} items - 内容项数组
     * @param {string} categoryType - 分类类型
     * @returns {Array} 排序后的数组（原数组已被排序）
     */
    sortItems(items, categoryType = 'default') {
        if (!Array.isArray(items)) {
            return items;
        }

        const sortFn = this.createSortStrategy(categoryType);
        items.sort(sortFn);
        
        // 同时对图集内部的子项进行排序
        items.forEach(item => {
            if (item.isSet && Array.isArray(item.photos)) {
                // 图集内部通常不涉及日期排序，使用 order 字段
                item.photos.sort(this._orderFieldSortFn);
            }
        });

        return items;
    },

    /**
     * 支持的分类类型枚举
     */
    CATEGORY_TYPES: {
        DIARY: 'diary',
        DEFAULT: 'default'
    }
};
