/**
 * 照片发现服务
 * 职责：
 * - 通过 GitHub API 实时获取照片目录的文件列表
 * - 提供缓存机制以减少 API 调用
 * - 处理照片去重
 * - 支持排序合并（已配置 + 自动扫描）
 * 
 * 使用示例：
 *   const photos = await PhotoDiscovery.getPhotosFromDirectory('assets/images/photos/月亮湖');
 *   const deduped = PhotoDiscovery.deduplicatePhotos(allPhotos, configuredSet);
 *   const merged = PhotoDiscovery.mergeAndSort(configured, autodiscovered);
 */

class PhotoDiscovery {
  constructor() {
    this.cache = new Map(); // dirPath → { files, timestamp }
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时
    this.GITHUB_API_BASE = 'https://api.github.com/repos/CarrotWuDev/CarrotWuDev.github.io/contents';
    this.SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    this.REQUEST_TIMEOUT = 5000; // 5 秒超时
  }

  /**
   * 获取指定目录下的所有照片（通过 GitHub API）
   * @param {string} dirPath 目录相对路径，如 'assets/images/photos/月亮湖'
   * @returns {Promise<Array>} 照片数组，结构：[{ name, size, download_url, sha, type: 'file' }]
   */
  async getPhotosFromDirectory(dirPath) {
    // 检查缓存
    const cached = this.cache.get(dirPath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.files;
    }

    try {
      const apiUrl = `${this.GITHUB_API_BASE}/${dirPath}`;
      const response = await this._fetchWithTimeout(apiUrl, this.REQUEST_TIMEOUT);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[PhotoDiscovery] Directory not found: ${dirPath}`);
        } else {
          console.warn(`[PhotoDiscovery] API error ${response.status}: ${dirPath}`);
        }
        return [];
      }

      const data = await response.json();

      // 确保是数组
      if (!Array.isArray(data)) {
        console.warn(`[PhotoDiscovery] Expected array, got:`, data);
        return [];
      }

      // 过滤：仅保留图片文件
      const photos = data.filter(item => 
        item.type === 'file' && 
        this.SUPPORTED_EXTENSIONS.has(this._getFileExtension(item.name).toLowerCase())
      );

      // 缓存结果
      this.cache.set(dirPath, {
        files: photos,
        timestamp: Date.now()
      });

      return photos;
    } catch (error) {
      console.warn(`[PhotoDiscovery] Failed to fetch directory: ${dirPath}`, error);

      // 降级：尝试从缓存读取（即使过期）
      const staleCache = this.cache.get(dirPath);
      if (staleCache) {
        console.info(`[PhotoDiscovery] Using stale cache for: ${dirPath}`);
        return staleCache.files;
      }

      return [];
    }
  }

  /**
   * 私有方法：带超时的 fetch
   */
  _fetchWithTimeout(url, timeout) {
    return Promise.race([
      fetch(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * 私有方法：获取文件扩展名
   */
  _getFileExtension(filename) {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }

  /**
   * 去重：过滤已配置的照片
   * 兼容两种格式：
   * - GitHub API 响应：{ name: 'xxx.jpg', ... }
   * - 本地 JSON 格式：{ name: 'xxx.jpg', ... }
   * 
   * @param {Array} allFiles 所有文件数组
   * @param {Set<string>} configuredFilenames 已配置的文件名集合
   * @returns {Array} 去重后的文件数组
   */
  deduplicatePhotos(allFiles, configuredFilenames) {
    if (!allFiles || allFiles.length === 0) {
      return [];
    }

    if (!configuredFilenames || configuredFilenames.size === 0) {
      return allFiles;
    }

    return allFiles.filter(file => !configuredFilenames.has(file.name));
  }

  /**
   * 排序合并：已配置照片 + 自动扫描照片
   * 已配置：保持用户指定的序号
   * 自动扫描：保持 GitHub API 返回顺序（通常按字母序），序号自动递增
   * 
   * @param {Array} configuredPhotos 已配置的照片数组，结构：[{ filename, seq, ... }]
   * @param {Array} autodiscoveredPhotos 自动扫描的照片数组，结构（GitHub API）：[{ name, size, download_url, sha, ... }]
   * @param {number} startSeq 自动照片的起始序号（默认：已配置最大seq + 1）
   * @returns {Array} 合并后的照片数组
   */
  mergeAndSort(configuredPhotos, autodiscoveredPhotos, startSeq = null) {
    const configured = configuredPhotos || [];
    const autodiscovered = autodiscoveredPhotos || [];

    // 如果都为空
    if (configured.length === 0 && autodiscovered.length === 0) {
      return [];
    }

    // 1. 已配置照片按序号排序
    const sortedConfigured = [...configured].sort((a, b) => {
      const seqA = typeof a.seq === 'number' ? a.seq : Infinity;
      const seqB = typeof b.seq === 'number' ? b.seq : Infinity;
      return seqA - seqB;
    });

    // 2. 自动扫描照片保持原顺序（GitHub API 返回顺序通常为字母序）
    const sortedAutodiscovered = [...autodiscovered];

    // 3. 确定自动照片的起始序号
    let nextSeq = startSeq;
    if (nextSeq === null || typeof nextSeq !== 'number') {
      const maxConfigSeq = Math.max(
        0,
        ...sortedConfigured
          .map(p => typeof p.seq === 'number' ? p.seq : 0)
      );
      nextSeq = maxConfigSeq + 1;
    }

    // 4. 为自动照片补充序号和标准化字段
    const enrichedAutodiscovered = sortedAutodiscovered.map(photo => ({
      ...photo,
      filename: photo.name, // 统一字段名（GitHub API 用 name，本地用 filename）
      seq: nextSeq++,
      isAutoDiscovered: true // 标记为自动发现
    }));

    // 5. 合并：已配置 + 自动发现
    return [...sortedConfigured, ...enrichedAutodiscovered];
  }

  /**
   * 辅助：从 Markdown 链接提取文件名
   * 例如：../assets/images/photos/月亮湖/IMG_20250705_102829.jpg → IMG_20250705_102829.jpg
   * 
   * @param {string} photoUrl 照片 URL
   * @returns {string} 文件名
   */
  static extractFilenameFromUrl(photoUrl) {
    if (!photoUrl) return '';
    const match = photoUrl.match(/([^/\\]+)$/);
    return match ? match[1] : '';
  }

  /**
   * 辅助：从 Markdown 链接提取目录相对路径
   * 例如：../assets/images/photos/月亮湖/IMG.jpg → assets/images/photos/月亮湖
   * 例如：../assets/images/photos/月亮湖 → assets/images/photos/月亮湖
   * 
   * @param {string} photoPath 照片路径（从 Markdown "照片源" 字段）
   * @returns {string} 目录相对路径
   */
  static extractDirpathFromUrl(photoPath) {
    if (!photoPath) return '';
    // 移除前缀 ../
    let normalized = photoPath.replace(/^\.\.\//, '');
    // 移除尾部文件名（如果存在）
    normalized = normalized.replace(/\/[^/]+\.[^/]+$/, '');
    return normalized;
  }

  /**
   * 清除所有缓存（仅用于测试/手动刷新）
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 销毁实例（仅用于测试/重置）
   */
  destroy() {
    this.cache.clear();
  }
}

// 导出单例
const photoDiscoveryInstance = new PhotoDiscovery();

export { photoDiscoveryInstance, PhotoDiscovery };
