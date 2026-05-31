/**
 * 日期工具模块
 * 负责日期格式定义、解析、校验、比较
 * 
 * 支持格式：YYYY年M月D日（如：2026年1月6日）
 * 使用原生 Date API，无外部依赖
 */

export const DateUtils = {
    /**
     * 日期格式正则 - 中文格式
     * 支持：2026年1月6日、2026年01月06日
     */
    DATE_FORMAT_REGEX: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,

    /**
     * 从标题中提取日期信息
     * 
     * @param {string} title - 标题文本（如："2026年1月6日"）
     * @returns {Date|null} 解析成功返回 Date 对象，失败返回 null
     */
    extractDateFromTitle(title) {
        if (!title || typeof title !== 'string') {
            return null;
        }

        const trimmed = title.trim();
        const match = trimmed.match(this.DATE_FORMAT_REGEX);
        
        if (!match) {
            return null;
        }

        try {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);

            // 校验日期合法性
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() !== year || 
                date.getMonth() !== month - 1 || 
                date.getDate() !== day) {
                // 日期非法（如2月30日），Date 对象会自动进位，校验失败
                return null;
            }

            return date;
        } catch (error) {
            console.warn(`[DateUtils] Failed to parse date from title: "${title}"`, error);
            return null;
        }
    },

    /**
     * 检查标题是否符合日期格式
     * 
     * @param {string} title - 标题文本
     * @returns {boolean} 是否匹配日期格式
     */
    isDateFormatTitle(title) {
        if (!title || typeof title !== 'string') {
            return false;
        }
        return this.DATE_FORMAT_REGEX.test(title.trim());
    },

    /**
     * 转换日期为可排序的时间戳
     * 用于排序比较
     * 
     * @param {Date} date - Date 对象
     * @returns {number} 时间戳（毫秒）
     */
    getComparableDate(date) {
        if (!(date instanceof Date)) {
            return 0;
        }
        return date.getTime();
    },

    /**
     * 格式化日期为字符串
     * 用于显示或调试
     * 
     * @param {Date} date - Date 对象
     * @returns {string} 格式化后的日期字符串（如："2026年1月6日"）
     */
    formatDateToString(date) {
        if (!(date instanceof Date)) {
            return '';
        }
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}年${month}月${day}日`;
    },

    /**
     * 批量校验项目数组中的日期有效性
     * 用于数据验证
     * 
     * @param {Array} items - 内容项数组
     * @returns {Array} 校验结果数组，包含每项的日期有效性信息
     */
    validateItemDates(items) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items.map((item, index) => ({
            index,
            title: item.title,
            hasDate: !!item.date,
            dateTimestamp: item.dateTimestamp || null,
            isValid: item.dateTimestamp ? typeof item.dateTimestamp === 'number' : null
        }));
    }
};
