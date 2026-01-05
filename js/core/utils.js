/**
 * 核心工具库 - 纯函数
 */

// 生成 ID (Slugify)
export function slugify(s) {
    return (s || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s\-_.]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// 解析 Key: Value 字段
export function parseField(line, fieldName) {
    const regex = new RegExp(`^${fieldName}\\s*[:：]`);
    if (regex.test(line)) {
        return line.replace(regex, '').trim();
    }
    return null;
}

// 解析 Link: [Text](URL) 或直接 URL
export function parseLink(line) {
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
