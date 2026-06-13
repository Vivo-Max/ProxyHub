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
  static async getGeoInfo(host) {
    // 1. 先判断是否是域名，如果是则通过 DoH 解析到 IP
    let targetIP = host;
    if (!this.isIPAddress(host)) {
      // 先尝试域名关键词匹配
      const keywordMatch = this.matchDomainKeyword(host);
      if (keywordMatch.countryCode) return keywordMatch;

      // 通过 DNS over HTTPS 解析域名
      try {
        const resolvedIP = await this.resolveDNS(host);
        if (resolvedIP) targetIP = resolvedIP;
      } catch (e) {
        // DNS 解析失败，返回域名关键词保底结果
        return this.matchDomainKeyword(host);
      }
    }

    // 2. 用 IP 查询地理位置
    try {
      const resp = await fetch(
        `https://get.geojs.io/v1/ip/country/${encodeURIComponent(targetIP)}.json`,
        { signal: AbortSignal.timeout(3000) }
      );
      const data = await resp.json();
      const cc = (data.country || '').toUpperCase();
      if (cc && cc !== 'UNKNOWN') {
        return {
          countryCode: cc,
          countryName: COUNTRY_NAME[cc] || '',
          city: '', colo: '',
          latency: null,
          method: ''
        };
      }
    } catch (e) { /* 忽略 */ }

    // fallback: ipapi.co
    try {
      const resp = await fetch(
        `https://ipapi.co/${encodeURIComponent(targetIP)}/json/`,
        { signal: AbortSignal.timeout(3000) }
      );
      const data = await resp.json();
      const cc = (data.country_code || '').toUpperCase();
      if (cc) {
        return {
          countryCode: cc,
          countryName: data.country_name || COUNTRY_NAME[cc] || '',
          city: '', colo: '',
          latency: null,
          method: ''
        };
      }
    } catch (e2) { /* 忽略 */ }

    // 都失败了，返回域名关键词保底
    return this.matchDomainKeyword(host);
  }

  // 判断是否是 IP 地址
  static isIPAddress(str) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str) ||
           /^[0-9a-fA-F:]+$/.test(str);
  }

  // DNS over HTTPS 解析域名到 IP
  static async resolveDNS(domain) {
    // Cloudflare DoH
    try {
      const resp = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
        {
          headers: { 'Accept': 'application/dns-json' },
          signal: AbortSignal.timeout(3000)
        }
      );
      const data = await resp.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find(r => r.type === 1);
        if (aRecord) return aRecord.data;
      }
    } catch (e) { /* 忽略 */ }

    // fallback: Google DoH
    try {
      const resp = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
        { signal: AbortSignal.timeout(3000) }
      );
      const data = await resp.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find(r => r.type === 1);
        if (aRecord) return aRecord.data;
      }
    } catch (e) { /* 忽略 */ }

    return null;
  }

  // 域名关键词匹配国家
  static matchDomainKeyword(domain) {
    const domainLower = domain.toLowerCase();

    const keywordMap = {
      '.hk': 'HK', 'hongkong': 'HK', 'hong-kong': 'HK', 'hkg': 'HK', 'hkt': 'HK',
      '.sg': 'SG', 'singapore': 'SG', 'sgp': 'SG',
      '.jp': 'JP', 'japan': 'JP', 'tokyo': 'JP', 'osaka': 'JP', 'tyo': 'JP',
      '.us': 'US', 'usa': 'US', 'america': 'US', 'lax': 'US', 'sfo': 'US', 'nyc': 'US',
      '.uk': 'GB', 'british': 'GB', 'london': 'GB',
      '.de': 'DE', 'germany': 'DE', 'frankfurt': 'DE', 'fra': 'DE',
      '.kr': 'KR', 'korea': 'KR', 'seoul': 'KR',
      '.tw': 'TW', 'taiwan': 'TW', 'tpe': 'TW',
      '.au': 'AU', 'australia': 'AU', 'sydney': 'AU',
      '.nl': 'NL', 'netherlands': 'NL', 'amsterdam': 'NL',
      '.fr': 'FR', 'france': 'FR', 'paris': 'FR',
      '.ca': 'CA', 'canada': 'CA',
      '.in': 'IN', 'india': 'IN', 'mumbai': 'IN', 'bom': 'IN',
      '.br': 'BR', 'brazil': 'BR', 'sao': 'BR',
      '.ru': 'RU', 'russia': 'RU', 'moscow': 'RU',
      '.tr': 'TR', 'turkey': 'TR', 'istanbul': 'TR',
      '.ae': 'AE', 'dubai': 'AE', 'uae': 'AE',
      '.vn': 'VN', 'vietnam': 'VN', 'viet': 'VN',
      '.th': 'TH', 'thailand': 'TH',
      '.my': 'MY', 'malaysia': 'MY',
      '.id': 'ID', 'indonesia': 'ID',
      '.ph': 'PH', 'philippines': 'PH',
      '.pl': 'PL', 'poland': 'PL',
      '.se': 'SE', 'sweden': 'SE', 'stockholm': 'SE',
      '.ch': 'CH', 'switzerland': 'CH', 'zurich': 'CH',
      '.it': 'IT', 'italy': 'IT', 'milan': 'IT',
      '.es': 'ES', 'spain': 'ES', 'madrid': 'ES',
      '.za': 'ZA', 'southafrica': 'ZA',
      '.cn': 'CN', 'china': 'CN',
    };

    for (const [keyword, code] of Object.entries(keywordMap)) {
      if (domainLower.includes(keyword)) {
        return {
          countryCode: code,
          countryName: COUNTRY_NAME[code] || '',
          city: '', colo: '',
          latency: null,
          method: 'domain-keyword'
        };
      }
    }

    return { countryCode: '', countryName: '', city: '', colo: '', latency: null, method: '' };
  }

  static isPrivateIP(ip) {
    return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|::1|fc00:|fe80:)/i.test(ip);
  }
}
