// Template Generator - 基于模板链接/配置批量生成节点链接

class TemplateGenerator {
  // 主入口：识别模板是 URL 还是 INI 配置
  static async generate(templateText, nodeText, protocolSelect = 'all', options = {}) {
    const t = (templateText || '').trim();
    if (!t) return null;
    // 先判断 INI 格式，避免注释中的 URL 触发 URL 模式
    if (t.startsWith('[') || /^\[vless\]/im.test(t) || /^\[trojan\]/im.test(t) ||
        t.toLowerCase().includes('[vless') || t.toLowerCase().includes('[trojan') ||
        t.toLowerCase().includes('[shadowsocks') || t.toLowerCase().includes('[ss]')) {
      return await this.generateFromIni(t, nodeText, protocolSelect, options);
    }
    if (t.includes('://')) {
      return await this.generateFromUrl(t, nodeText, options);
    }
    return null;
  }

  // 如果启用了延迟过滤且无延迟数据，则通过 Pages Function 获取延迟
  static async ensureLatency(nodes) {
    const missing = nodes.filter(n => n.latency == null && n.address && !IpLookup.isPrivateIP(n.address));
    if (missing.length === 0) return;
    try {
      const results = await IpLookup.lookupBatch(missing.map(n => n.address), 5);
      for (const node of missing) {
        const info = results[node.address];
        if (info && info.latency != null) {
          node.latency = info.latency;
        }
      }
    } catch (e) {
      console.warn('获取节点延迟失败:', e.message);
    }
  }

  // ===================== URL 模板模式 =====================
  static async generateFromUrl(templateUrl, nodeText, options = {}) {
    const templateNode = ProtocolParser.parseUrl(templateUrl);
    if (!templateNode) throw new Error('无法识别模板链接协议，请检查 URL 格式');

    const nodes = this.parseNodeList(nodeText, templateNode.port);
    if (nodes.length === 0) throw new Error('未找到有效的节点列表，请检查 CSV/TXT 格式');

    const countryCount = {};
    const ispCount = {};
    const links = [];
    nodes.forEach(node => {
      let remark;
      const isp = node.isp ? detectISP(node.isp) : detectISP(node.baseRemark);
      if (isp) {
        ispCount[isp.code] = (ispCount[isp.code] || 0) + 1;
        remark = `${isp.emoji} ${isp.name}-${ispCount[isp.code]}`;
      } else {
        const cc = node.countryCode ? normalizeCountryCode(node.countryCode) : 'UNKNOWN';
        countryCount[cc] = (countryCount[cc] || 0) + 1;
        const emoji = node.emoji || COUNTRY_EMOJI[cc] || '🌐';
        const name = node.countryName || (cc !== 'UNKNOWN' ? COUNTRY_NAME[cc] : '') || '未知';
        remark = `${emoji} ${name}-${countryCount[cc]}`;
      }
      links.push(this.buildUrlFromTemplate(templateNode, node.address, node.port, remark));
    });

    return { links, text: links.join('\n'), protocol: templateNode.protocol };
  }

  static buildUrlFromTemplate(templateNode, host, port, remark) {
    if (templateNode.protocol === 'vmess') {
      const obj = JSON.parse(JSON.stringify(templateNode.params));
      obj.add = host;
      obj.port = String(port);
      obj.ps = remark;
      return 'vmess://' + btoa(this.utf8ToBinaryString(JSON.stringify(obj)));
    }

    const newHostPort = host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
    // 始终从模板参数重构 URL，避免原始 URL 未编码/格式异常导致二次解析失败
    let url = this.reconstructOriginalUrl(templateNode, host, port, newHostPort);

    // 替换 # 后的备注
    const hashIdx = url.indexOf('#');
    if (hashIdx !== -1) {
      url = url.slice(0, hashIdx) + '#' + encodeURIComponent(remark);
    } else {
      url += '#' + encodeURIComponent(remark);
    }

    return url;
  }

  static reconstructOriginalUrl(node, host = node.address, port = node.port, ip = node.params.ip) {
    const hostPort = host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
    switch (node.protocol) {
      case 'vless': {
        const ipPart = ip ? `&ip=${encodeURIComponent(ip)}` : '';
        return `vless://${node.params.uuid}@${hostPort}?encryption=${node.params.encryption || 'none'}&security=${node.params.security || 'tls'}&type=${node.params.type || 'ws'}&path=${encodeURIComponent(node.params.path || '/')}&host=${encodeURIComponent(node.params.host || '')}&sni=${encodeURIComponent(node.params.sni || '')}${ipPart}#${encodeURIComponent(node.remark)}`;
      }
      case 'trojan':
        return `trojan://${encodeURIComponent(node.params.password || 'your_password')}@${hostPort}?security=${node.params.security || 'tls'}&type=${node.params.type || 'tcp'}&sni=${encodeURIComponent(node.params.sni || '')}#${encodeURIComponent(node.remark)}`;
      case 'ss':
        return `ss://${btoa(`${node.params.method}:${node.params.password}`)}@${hostPort}#${encodeURIComponent(node.remark)}`;
      case 'socks5': {
        const user = node.params.user ? encodeURIComponent(node.params.user) : '';
        const pass = node.params.pass ? encodeURIComponent(node.params.pass) : '';
        const auth = user ? (pass ? `${user}:${pass}` : user) : '';
        return `socks5://${auth ? auth + '@' : ''}${hostPort}#${encodeURIComponent(node.remark)}`;
      }
      default:
        return '';
    }
  }

  // ===================== INI 配置模式 =====================
  static async generateFromIni(iniText, nodeText, protocolSelect, options = {}) {
    const configs = this.parseIniConfigs(iniText);
    const backupPort = configs.vless[0]?.BackupPort || configs.trojan[0]?.BackupPort || '443';
    const nodes = this.parseNodeList(nodeText, backupPort);
    if (nodes.length === 0) throw new Error('未找到有效的节点列表，请检查 CSV/TXT 格式');

    const selected = [];
    if (protocolSelect === 'vless' || protocolSelect === 'all') {
      selected.push(...configs.vless.map(c => ({ ...c, protocol: 'vless' })));
    }
    if (protocolSelect === 'trojan' || protocolSelect === 'all') {
      selected.push(...configs.trojan.map(c => ({ ...c, protocol: 'trojan' })));
    }
    if (protocolSelect === 'ss' || protocolSelect === 'all') {
      selected.push(...configs.shadowsocks.map(c => ({ ...c, protocol: 'ss' })));
    }
    if (selected.length === 0) throw new Error('未选择有效的协议配置');

    const countryCount = {};
    const links = [];
    nodes.forEach(node => {
      selected.forEach(config => {
        const cc = node.countryCode || 'UNKNOWN';
        countryCount[cc] = (countryCount[cc] || 0) + 1;
        const emoji = node.emoji || '🌐';
        const name = node.countryName || '未知';
        const remark = `${emoji} ${name}-${countryCount[cc]}`;
        const nodeInfo = [{ address: node.address, port: node.port, remark }];
        if (config.protocol === 'vless') links.push(...this.generateVlessLinks(config, nodeInfo));
        else if (config.protocol === 'trojan') links.push(...this.generateTrojanLinks(config, nodeInfo));
        else if (config.protocol === 'ss' && config.SS_Method && config.SS_Pass && config.SS_Method !== 'none') {
          links.push(...this.generateSsLinks(config, nodeInfo));
        }
      });
    });

    return { links, text: links.join('\n'), protocol: protocolSelect === 'all' ? 'mixed' : protocolSelect };
  }

  static generateVlessLinks(config, nodes) {
    return nodes.map(node => {
      const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
      let link = `vless://${config.UUID}@${hostPort}?encryption=${config.Encryption || 'none'}&security=${config.Security || 'tls'}&type=${config.Transport || 'ws'}`;
      if (config.Path) link += `&path=${encodeURIComponent(config.Path)}`;
      if (config.Host) link += `&host=${encodeURIComponent(config.Host)}`;
      if (config.SNI) link += `&sni=${encodeURIComponent(config.SNI)}`;
      link += `#${encodeURIComponent(node.remark)}`;
      return link;
    });
  }

  static generateTrojanLinks(config, nodes) {
    return nodes.map(node => {
      const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
      let link = `trojan://${encodeURIComponent(config.Password || '')}@${hostPort}?security=${config.Security || 'tls'}&type=${config.Transport || 'tcp'}`;
      if (config.Path) link += `&path=${encodeURIComponent(config.Path)}`;
      if (config.Host) link += `&host=${encodeURIComponent(config.Host)}`;
      if (config.SNI) link += `&sni=${encodeURIComponent(config.SNI)}`;
      link += `#${encodeURIComponent(node.remark)}`;
      return link;
    });
  }

  static generateSsLinks(config, nodes) {
    return nodes.map(node => {
      const userinfo = `${config.SS_Method}:${config.SS_Pass}`;
      const encUserinfo = btoa(userinfo).replace(/=+$/, '');
      const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
      return `ss://${encUserinfo}@${hostPort}#${encodeURIComponent(node.remark)}`;
    });
  }

  // ===================== 节点列表解析 =====================
  static parseNodeList(text, defaultPort = '443') {
    if (!text || !text.trim()) return [];
    // 去除 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/);
    const nodes = [];
    const seen = new Set();

    // 判断是否为 CSV（首行包含表头关键字或分隔符且包含 IP/端口关键字）
    const firstLine = lines.find(l => l.trim()) || '';
    const delimiter = this.detectDelimiter(firstLine);
    let isCsv = firstLine.includes(delimiter) && this.hasCsvHeader(firstLine);

    let headers = [];
    let ipIdx = -1, portIdx = -1, remarkIdx = -1, countryIdx = -1, codeIdx = -1, cityIdx = -1, ispIdx = -1, latencyIdx = -1;
    let startRow = 0;

    if (isCsv) {
      headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
      ipIdx = this.findHeaderIndex(headers, ['ip', 'ip地址', 'ipaddress', 'host', 'server', '地址', 'addr']);
      portIdx = this.findHeaderIndex(headers, ['port', '端口']);
      remarkIdx = this.findHeaderIndex(headers, ['remark', '备注', 'name', '节点名称', '节点']);
      countryIdx = this.findHeaderIndex(headers, ['country', '国家', '地区']);
      codeIdx = this.findHeaderIndex(headers, ['code', '国家代码', 'countrycode', 'cc', '国际代码']);
      cityIdx = this.findHeaderIndex(headers, ['city', '城市']);
      ispIdx = this.findHeaderIndex(headers, ['isp', '运营商', '线路', 'carrier', 'network']);
      latencyIdx = this.findHeaderIndex(headers, ['latency', 'delay', 'ping', '延迟', '延时']);
      if (ipIdx === -1 || portIdx === -1) {
        // 表头识别失败，回退到普通文本解析
        isCsv = false;
      } else {
        startRow = 1;
      }
    }

    for (let i = startRow; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw || raw.startsWith('#')) continue;

      let address = '', port = defaultPort, remark = '';
      let country = '', code = '', city = '';

      let isp = '';
      let latency = null;
      if (isCsv) {
        const parts = raw.split(delimiter).map(p => p.trim());
        address = parts[ipIdx] || '';
        port = parts[portIdx] || defaultPort;
        if (remarkIdx !== -1) remark = parts[remarkIdx] || '';
        if (countryIdx !== -1) country = parts[countryIdx] || '';
        if (codeIdx !== -1) code = parts[codeIdx] || '';
        if (cityIdx !== -1) city = parts[cityIdx] || '';
        if (ispIdx !== -1) isp = parts[ispIdx] || '';
        if (latencyIdx !== -1) {
          const rawLatency = parseFloat(parts[latencyIdx]);
          if (!isNaN(rawLatency)) latency = rawLatency;
        }
      } else {
        const parsed = this.parseTextLine(raw, defaultPort);
        if (!parsed) continue;
        address = parsed.address;
        port = parsed.port;
        remark = parsed.remark;
      }

      address = address.trim();
      port = parseInt(port) || parseInt(defaultPort) || 443;
      if (!address) continue;
      if (!/^\[?[a-zA-Z0-9.:_-]+\]?$/.test(address)) continue;

      const key = `${address}:${port}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // 确定国家/备注：优先用城市名，其次国家名
      let detected;
      if (code) {
        const normalizedCode = normalizeCountryCode(code);
        detected = {
          code: normalizedCode,
          name: city || country || COUNTRY_NAME[normalizedCode] || '',
          emoji: COUNTRY_EMOJI[normalizedCode] || '🌐'
        };
      } else if (country) {
        detected = {
          code: '',
          name: city || country,
          emoji: '🌐'
        };
      } else {
        detected = detectCountry(remark);
      }

      nodes.push({
        address,
        port,
        baseRemark: remark,
        countryCode: detected.code,
        countryName: detected.name,
        emoji: detected.emoji,
        isp: isp || '',
        latency
      });
    }

    return nodes;
  }

  static parseTextLine(line, defaultPort = '443') {
    line = line.trim();
    if (!line || line.startsWith('#')) return null;

    let address = '', port = defaultPort, remark = '';

    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim());
      address = parts[0];
      if (parts.length > 1) {
        if (/^\d+$/.test(parts[1])) {
          port = parts[1];
          if (parts.length > 2) remark = parts[2];
        } else {
          remark = parts[1];
          if (parts.length > 2 && /^\d+$/.test(parts[2])) port = parts[2];
        }
      }
    } else if (line.includes(':') && line.includes('#')) {
      const match = line.match(/^(.+):(\d+)#(.+)$/);
      if (match) { address = match[1]; port = match[2]; remark = match[3]; }
    } else if (line.includes(':')) {
      [address, port] = line.split(':', 2);
    } else if (line.includes('#')) {
      [address, remark] = line.split('#', 2);
    } else {
      address = line;
    }

    address = address.trim();
    port = parseInt(port) || parseInt(defaultPort) || 443;
    if (!address) return null;
    return { address, port, remark };
  }

  static utf8ToBinaryString(str) {
    return encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
  }

  static detectDelimiter(line) {
    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let maxCount = 1;
    for (let d of delimiters) {
      const count = line.split(d).length;
      if (count > maxCount) {
        maxCount = count;
        best = d;
      }
    }
    return best;
  }

  static hasCsvHeader(line) {
    const lowered = line.toLowerCase();
    const keys = ['ip', 'host', 'server', 'port', 'remark', 'name', 'country', 'code',
                  'ip地址', '端口', '备注', '国家', '国家代码', '节点', '地址',
                  '国际代码', '城市', 'isp', '运营商', '线路', 'carrier'];
    return keys.some(k => lowered.includes(k));
  }

  static findHeaderIndex(headers, aliases) {
    // 按 aliases 的优先级查找，而不是按表头顺序，确保“国家”优先于“地区”
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  // ===================== INI 配置解析 =====================
  static parseIniConfigs(content) {
    if (!content) return { vless: [], trojan: [], shadowsocks: [] };
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    content = content.replace(/[\r\n\t]+/g, '\n').trim();
    const sections = {};
    let currentSection = null;

    for (let raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1).trim();
        sections[currentSection] = {};
      } else if (currentSection && line.includes('=')) {
        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim().toLowerCase();
        sections[currentSection][key] = line.slice(idx + 1).trim();
      }
    }

    const defaults = {
      vless: { UUID: '', Host: '', SNI: '', Path: '', Security: 'tls', Transport: 'ws', Encryption: 'none', SubName: '自定义订阅', UDP: false, BackupPort: '443' },
      trojan: { Password: '', Host: '', SNI: '', Path: '', Security: 'tls', Transport: 'ws', SubName: '自定义订阅', UDP: false, BackupPort: '443' },
      shadowsocks: { SS_Method: 'none', SS_Pass: '', SubName: '自定义订阅' }
    };

    const result = { vless: [], trojan: [], shadowsocks: [] };
    const general = sections.general || sections.GENERAL || {};
    const global = sections.global || sections.GLOBAL || {};

    for (const sectionKey in sections) {
      const lower = sectionKey.toLowerCase();
      if (lower === 'general' || lower === 'global') continue;

      let protocol = '';
      if (lower.startsWith('vless')) protocol = 'vless';
      else if (lower.startsWith('trojan')) protocol = 'trojan';
      else if (lower.startsWith('shadowsocks') || lower.startsWith('ss')) protocol = 'shadowsocks';
      if (!protocol) continue;

      const sec = sections[sectionKey];
      const cfg = JSON.parse(JSON.stringify(defaults[protocol]));

      // 继承 global / general
      cfg.SubName = global.sub_name || cfg.SubName;
      cfg.Host = general.host || cfg.Host;
      cfg.SNI = general.sni || general.host || cfg.SNI;
      cfg.Path = general.path || cfg.Path;
      cfg.Security = general.security || cfg.Security;
      if (general.tls !== undefined) cfg.Security = general.tls.toLowerCase() === 'true' ? 'tls' : 'none';
      cfg.Transport = general.network || general.transport || cfg.Transport;

      // 段落专属配置覆盖
      cfg.UUID = sec.uuid || cfg.UUID;
      cfg.Password = sec.password || cfg.Password;
      cfg.SS_Method = sec.ss_method || cfg.SS_Method;
      cfg.SS_Pass = sec.ss_pass || cfg.SS_Pass;
      cfg.Host = sec.host || cfg.Host;
      cfg.SNI = sec.sni || sec.host || cfg.SNI;
      cfg.Path = sec.path || cfg.Path;
      cfg.Security = sec.security || cfg.Security;
      if (sec.tls !== undefined) cfg.Security = sec.tls.toLowerCase() === 'true' ? 'tls' : 'none';
      cfg.Transport = sec.network || sec.transport || cfg.Transport;
      cfg.Encryption = sec.encryption || cfg.Encryption;
      cfg.SubName = sec.sub_name || cfg.SubName;
      cfg.BackupPort = sec.backup_port || cfg.BackupPort;
      cfg.UDP = sec.udp ? sec.udp.toLowerCase() === 'true' : cfg.UDP;

      // 校验并加入
      if (protocol === 'vless' && cfg.UUID) result.vless.push(cfg);
      if (protocol === 'trojan' && cfg.Password) result.trojan.push(cfg);
      if (protocol === 'shadowsocks' && cfg.SS_Method !== 'none' && cfg.SS_Pass) result.shadowsocks.push(cfg);
    }

    return result;
  }
}
