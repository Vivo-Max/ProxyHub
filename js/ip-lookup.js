// IP Lookup - 国家/地区识别（延迟探测已移除，浏览器无法准确测量代理协议延迟）
// Cloudflare Function 模式：真实 TCP connect ping（仅部署后可用）
// 本地模式：仅识别国家/地区，延迟由客户端 url-test 自行测量

class IpLookup {
  static CACHE_KEY = 'ipGeoCache_v2';
  static CACHE_TTL = 3600000; // 1 hour

  static getCache() {
    try {
      return JSON.parse(localStorage.getItem(this.CACHE_KEY)) || {};
    } catch {
      return {};
    }
  }

  static setCache(cache) {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
  }

  // 清理过期缓存
  static cleanCache() {
    const cache = this.getCache();
    const now = Date.now();
    let changed = false;
    for (const [ip, entry] of Object.entries(cache)) {
      if (now - entry.ts > this.CACHE_TTL) {
        delete cache[ip];
        changed = true;
      }
    }
    if (changed) this.setCache(cache);
  }

  // 单 IP 查询：只获取国家信息
  static async lookup(ip) {
    this.cleanCache();
    const cache = this.getCache();
    const cached = cache[ip];
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.data;

    // 1. 尝试 Cloudflare Function（部署后，可获取真实 TCP 延迟）
    try {
      const result = await this.cfLookup(ip);
      if (result && (result.latency != null || result.countryCode)) {
        cache[ip] = { ts: Date.now(), data: result };
        this.setCache(cache);
        return result;
      }
    } catch (e) { /* CF 不可用 */ }

    // 2. 本地模式：仅获取国家/地区，不测量延迟
    const result = await this.getGeoInfo(ip);
    cache[ip] = { ts: Date.now(), data: result };
    this.setCache(cache);
    return result;
  }

  // 批量查询：只获取国家信息
  static async lookupBatch(ips, concurrency = 5) {
    this.cleanCache();
    const cache = this.getCache();
    const results = {};
    const missing = [];

    for (const ip of ips) {
      const cached = cache[ip];
      if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
        results[ip] = cached.data;
      } else {
        missing.push(ip);
      }
    }

    if (missing.length === 0) return results;

    // 1. 尝试 CF Function 批量查询
    try {
      const cfResults = await this.cfBatchLookup(missing);
      const stillMissing = [];
      for (const ip of missing) {
        const data = cfResults[ip];
        if (data && data.countryCode) {
          results[ip] = data;
          cache[ip] = { ts: Date.now(), data };
        } else {
          stillMissing.push(ip);
        }
      }
      if (stillMissing.length === 0) {
        this.setCache(cache);
        return results;
      }
      missing.length = 0;
      missing.push(...stillMissing);
    } catch (e) { /* CF 不可用 */ }

    // 2. 本地模式：批量获取国家信息
    const geoResults = await Promise.all(
      missing.map(ip => this.getGeoInfo(ip))
    );
    for (let i = 0; i < missing.length; i++) {
      const ip = missing[i];
      const result = geoResults[i];
      results[ip] = result;
      cache[ip] = { ts: Date.now(), data: result };
    }

    this.setCache(cache);
    return results;
  }

  // ===== Cloudflare Function 模式（仅部署后可用）=====
  static async cfLookup(ip) {
    const resp = await fetch(`/api/validate?ip=${encodeURIComponent(ip)}&latency=1`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return this.normalizeResult(await resp.json());
  }

  static async cfBatchLookup(ips) {
    const resp = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ips, latency: 1 }),
      signal: AbortSignal.timeout(25000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const results = {};
    for (const [ip, info] of Object.entries(data.results || {})) {
      results[ip] = this.normalizeResult(info);
    }
    return results;
  }

  static normalizeResult(info) {
    return {
      countryCode: info.countryCode || info.country || '',
      countryName: info.countryName || COUNTRY_NAME[info.countryCode || info.country] || '',
      city: info.city || '',
      colo: info.colo || '',
      // 仅 CF Function 返回真实延迟，本地模式始终为 null
      latency: info.latency != null ? parseFloat(info.latency) : null,
      method: info.method || ''
    };
  }

  // ===== 本地模式：仅获取地理位置（无延迟探测）=====
  static async getGeoInfo(ip) {
    // 尝试 geojs.io
    try {
      const resp = await fetch(
        `https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`,
        { signal: AbortSignal.timeout(3000) }
      );
      const data = await resp.json();
      const cc = (data.country || '').toUpperCase();
      return {
        countryCode: cc,
        countryName: COUNTRY_NAME[cc] || '',
        city: '',
        colo: '',
        latency: null,
        method: ''
      };
    } catch (e) {
      // fallback: ipapi.co
      try {
        const resp = await fetch(
          `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
          { signal: AbortSignal.timeout(3000) }
        );
        const data = await resp.json();
        const cc = (data.country_code || '').toUpperCase();
        return {
          countryCode: cc,
          countryName: data.country_name || COUNTRY_NAME[cc] || '',
          city: '',
          colo: '',
          latency: null,
          method: ''
        };
      } catch (e2) {
        return { countryCode: '', countryName: '', city: '', colo: '', latency: null, method: '' };
      }
    }
  }

  static isPrivateIP(ip) {
    return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|::1|fc00:|fe80:)/i.test(ip);
  }
}
