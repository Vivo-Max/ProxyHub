// Protocol Parser - 代理协议解析引擎

class ProxyNode {
  constructor(protocol, address, port, remark, params = {}, originalUrl = '', latency = null) {
    this.protocol = protocol;
    this.address = address;
    this.port = port;
    this.remark = remark;
    this.params = params;
    this.originalUrl = originalUrl;
    this.country = null;
    this.countryCode = null;
    this.emoji = '🌐';
    this.displayName = '';
    this.latency = latency;
  }
}

class ProtocolParser {
  static parse(input) {
    if (!input || !input.trim()) return [];
    const text = input.trim();
    if (this.looksLikeCSV(text)) {
      try {
        return FileHandler.parseCSV(text).map(n => new ProxyNode('trojan', n.address, n.port, n.remark, { password: '' }, '', n.latency));
      } catch (e) {
        console.warn('CSV parse failed:', e.message);
      }
    }
    const lines = text.split('\n');
    const nodes = [];
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const urlNode = this.parseUrl(line);
      if (urlNode) { nodes.push(urlNode); continue; }
      // 如果行以已知协议开头但 parseUrl 失败，说明 URL 格式异常，避免被 parseTextLine 误判为 trojan
      if (/^(vless|vmess|ss|socks5|trojan):\/\//i.test(line)) {
        console.warn('协议链接解析失败，已跳过:', line.slice(0, 80));
        continue;
      }
      const textNode = this.parseTextLine(line);
      if (textNode) nodes.push(textNode);
    }
    return nodes;
  }

  static looksLikeCSV(text) {
    const first = text.split('\n').find(l => l.trim());
    if (!first) return false;
    if (!first.includes(',')) return false;
    const headers = first.toLowerCase().split(',').map(h => h.trim());
    const keys = ['ip', 'host', 'server', 'port', 'remark', 'name', 'country', 'code', '国家', '端口', '备注', '节点'];
    return keys.some(k => headers.includes(k));
  }

  static parseUrl(url) {
    const protocols = ['vless', 'vmess', 'ss', 'socks5', 'trojan'];
    for (const p of protocols) {
      if (url.toLowerCase().startsWith(`${p}://`)) {
        return this[`parse${p.charAt(0).toUpperCase() + p.slice(1)}`](url);
      }
    }
    return null;
  }

  static parseVless(url) {
    try {
      const u = new URL(url);
      const uuid = u.username;
      const [host, portStr] = u.host.split(':');
      const port = parseInt(portStr) || 443;
      const params = Object.fromEntries(u.searchParams);
      const remark = decodeURIComponent(u.hash.slice(1) || '未命名');
      return new ProxyNode('vless', host, port, remark, {
        uuid,
        encryption: params.encryption || 'none',
        security: params.security || 'tls',
        type: params.type || 'ws',
        path: params.path || '/',
        host: params.host || '',
        sni: params.sni || '',
        fp: params.fp || '',
        ip: params.ip || ''
      }, url);
    } catch (e) { return null; }
  }

  static parseVmess(url) {
    try {
      const base64 = url.replace('vmess://', '');
      const json = JSON.parse(atob(base64));
      const remark = json.ps || '未命名';
      return new ProxyNode('vmess', json.add, parseInt(json.port) || 443, remark, {
        id: json.id,
        aid: parseInt(json.aid) || 0,
        scy: json.scy || 'auto',
        net: json.net || 'tcp',
        type: json.type || 'none',
        host: json.host || '',
        path: json.path || '',
        tls: json.tls || '',
        sni: json.sni || '',
        fp: json.fp || ''
      }, url);
    } catch (e) { return null; }
  }

  static parseSs(url) {
    try {
      let body = url.replace('ss://', '');
      const hashIdx = body.indexOf('#');
      const remark = hashIdx > -1 ? decodeURIComponent(body.slice(hashIdx + 1)) : '未命名';
      body = hashIdx > -1 ? body.slice(0, hashIdx) : body;
      let method = '', password = '', host = '', port = 8388;
      if (body.includes('@')) {
        const atIdx = body.indexOf('@');
        const userinfo = body.slice(0, atIdx);
        const serverPart = body.slice(atIdx + 1);
        let decodedUser = userinfo;
        if (!userinfo.includes(':')) {
          try { decodedUser = atob(userinfo); } catch {}
        }
        const [m, p] = decodedUser.split(':');
        method = m; password = p;
        const [h, ps] = serverPart.split(':');
        host = h; port = parseInt(ps) || 8388;
      } else {
        const decoded = atob(body);
        const m = decoded.match(/(.+):(.+)@(.+):(\d+)/);
        if (m) {
          method = m[1]; password = m[2]; host = m[3]; port = parseInt(m[4]) || 8388;
        }
      }
      if (!method || !host) return null;
      return new ProxyNode('ss', host, port, remark, { method, password }, url);
    } catch (e) { return null; }
  }

  static parseSocks5(url) {
    try {
      const u = new URL(url);
      const user = u.username || '';
      const pass = u.password || '';
      const [host, portStr] = u.host.split(':');
      const remark = decodeURIComponent(u.hash.slice(1) || '未命名');
      return new ProxyNode('socks5', host, parseInt(portStr) || 1080, remark, { user, pass }, url);
    } catch (e) { return null; }
  }

  static parseTrojan(url) {
    try {
      const u = new URL(url);
      const password = u.username;
      const [host, portStr] = u.host.split(':');
      const params = Object.fromEntries(u.searchParams);
      const remark = decodeURIComponent(u.hash.slice(1) || '未命名');
      return new ProxyNode('trojan', host, parseInt(portStr) || 443, remark, {
        password,
        security: params.security || 'tls',
        type: params.type || 'tcp',
        path: params.path || '',
        host: params.host || '',
        sni: params.sni || ''
      }, url);
    } catch (e) { return null; }
  }

  static parseTextLine(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return null;
    let address = '', port = 443, remark = '未命名';
    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim());
      address = parts[0];
      if (parts.length > 1) {
        if (/^\d+$/.test(parts[1])) {
          port = parseInt(parts[1]);
          if (parts.length > 2) remark = parts[2];
        } else {
          remark = parts[1];
          if (parts.length > 2 && /^\d+$/.test(parts[2])) port = parseInt(parts[2]);
        }
      }
    } else if (line.includes(':') && line.includes('#')) {
      const match = line.match(/(.+):(\d+)#(.+)/);
      if (match) { address = match[1]; port = parseInt(match[2]); remark = match[3]; }
    } else if (line.includes(':')) {
      [address, port] = line.split(':');
      port = parseInt(port) || 443;
    } else if (line.includes('#')) {
      [address, remark] = line.split('#', 2);
    } else {
      address = line;
    }
    if (!address) return null;
    return new ProxyNode('trojan', address, port, remark, { password: '' });
  }
}
