// Config Generator - 客户端配置生成器

class ConfigGenerator {
  // YAML 安全转义：包含特殊字符时用双引号包裹并转义
  static yamlSafe(str) {
    if (str == null) return '';
    const s = String(str);
    // 如果包含 YAML 特殊字符，用双引号包裹
    if (/[":#\[\]{}|>&*!?'\n\r]/.test(s)) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  static generate(nodes, clientType, options = {}) {
    const filtered = this.filterNodes(nodes, clientType);
    const named = this.applyNaming(filtered);
    switch (clientType) {
      case 'clash': return this.generateClash(named, options);
      case 'v2rayn': return this.generateV2rayN(named);
      case 'singbox': return this.generateSingbox(named, options);
      case 'flclash': return this.generateFlClash(named, options);
      default: throw new Error('Unknown client type');
    }
  }

  static filterNodes(nodes, clientType) {
    const support = {
      clash: ['vless', 'vmess', 'ss', 'trojan'],
      v2rayn: ['vless', 'vmess', 'ss', 'socks5', 'trojan'],
      flclash: ['vless', 'vmess', 'ss', 'socks5', 'trojan'],
      singbox: ['vless', 'vmess', 'ss', 'socks5', 'trojan']
    };
    const allowed = support[clientType] || [];
    return nodes.filter(n => allowed.includes(n.protocol));
  }

  static applyNaming(nodes) {
    const countryCount = {};
    const ispCount = {};
    return nodes.map(node => {
      // 优先识别运营商（ISP），其次国家/城市
      const isp = detectISP(node.remark);
      if (isp) {
        ispCount[isp.code] = (ispCount[isp.code] || 0) + 1;
        node.isp = isp;
        node.countryCode = 'UNKNOWN';
        node.country = isp.name;
        node.emoji = isp.emoji;
        node.displayName = `${isp.emoji} ${isp.name}-${ispCount[isp.code]}`;
        return node;
      }

      // 优先使用 CSV/模板已解析的国家/城市信息，避免被二次识别覆盖
      let detected;
      if (node.countryCode && node.countryCode !== 'UNKNOWN') {
        const code = normalizeCountryCode(node.countryCode);
        detected = {
          code,
          name: node.countryName || node.country || COUNTRY_NAME[code] || '未知',
          emoji: COUNTRY_EMOJI[code] || '🌐'
        };
      } else {
        // 优先从 remark 开头的国旗 emoji 恢复国家，避免“Los Angeles”被误判为 ES
        const flagCode = extractFlagCode(node.remark);
        if (flagCode) {
          detected = {
            code: flagCode,
            name: node.countryName || node.country || COUNTRY_NAME[flagCode] || '未知',
            emoji: COUNTRY_EMOJI[flagCode] || '🌐'
          };
        } else {
          detected = detectCountry(node.remark);
        }
      }
      node.countryCode = detected.code;
      node.country = detected.name;
      node.emoji = detected.emoji;
      const cc = node.countryCode || 'UNKNOWN';
      countryCount[cc] = (countryCount[cc] || 0) + 1;
      const name = node.country || '未知';
      node.displayName = `${node.emoji} ${name}-${countryCount[cc]}`;
      return node;
    });
  }

  static generateClash(nodes, options) {
    const subName = options.subName || 'ProxyHub订阅';
    const proxyYamls = nodes.map(n => this.nodeToClashProxy(n, options)).filter(Boolean);
    // YAML 安全转义节点名称，防止特殊字符破坏代理组格式
    const proxyDisplayNames = nodes.map(n => this.yamlSafe(n.displayName));

    let presetData;
    if (options.ruleSource === 'custom' && options.customRules) {
      presetData = {
        proxyGroups: ClashRules.getDefaultProxyGroups(proxyDisplayNames),
        ruleProviders: '',
        rules: ClashRules.custom(options.customRules)
      };
    } else {
      presetData = ClashRules.getPresetData(options.preset || 'balanced', proxyDisplayNames);
    }

    const ruleProvidersSection = presetData.ruleProviders ? `\nrule-providers:\n${presetData.ruleProviders}\n` : '\n';
    const rulesYaml = presetData.rules.split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => `  - ${l}`)
      .join('\n');

    return `# 订阅名称: ${this.yamlSafe(subName)}
profile:
  store-selected: true
  store-name: ${this.yamlSafe(subName)}
dns:
  nameserver:
    - 180.76.76.76
    - 2400:da00::6666
  fallback:
    - 8.8.8.8
    - 2001:4860:4860::8888
proxies:
${proxyYamls.join(String.fromCharCode(10))}${ruleProvidersSection}proxy-groups:
${presetData.proxyGroups}
rules:
${rulesYaml}`;
  }

  static nodeToClashProxy(node, options = {}) {
    const udp = options.udpRelay !== false ? 'true' : 'false';
    const base = `  - name: ${this.yamlSafe(node.displayName)}
    type: ${node.protocol}
    server: ${this.yamlSafe(node.address)}
    port: ${node.port}`;
    switch (node.protocol) {
      case 'vless':
        return `${base}
    uuid: ${this.yamlSafe(node.params.uuid)}
    cipher: ${this.yamlSafe(node.params.encryption || 'none')}
    tls: ${node.params.security === 'tls'}
    network: ${this.yamlSafe(node.params.type || 'ws')}
${node.params.type === 'ws' ? `    ws-opts:\n      path: "${node.params.path || '/'}"\n      headers:\n        Host: ${this.yamlSafe(node.params.host || node.params.sni || node.address)}` : ''}
${node.params.sni ? `    sni: ${this.yamlSafe(node.params.sni)}` : ''}
    udp: ${udp}`;
      case 'vmess':
        return `${base}
    uuid: ${this.yamlSafe(node.params.id)}
    alterId: ${node.params.aid || 0}
    cipher: ${this.yamlSafe(node.params.scy || 'auto')}
    tls: ${node.params.tls === 'tls'}
    network: ${this.yamlSafe(node.params.net || 'tcp')}
${(node.params.net === 'ws' || node.params.net === 'h2') ? `    ws-opts:\n      path: "${node.params.path || '/'}"\n      headers:\n        Host: ${this.yamlSafe(node.params.host || node.address)}` : ''}
    udp: ${udp}`;
      case 'trojan':
        return `${base}
    password: ${this.yamlSafe(node.params.password || 'your_password')}
    tls: ${node.params.security !== 'none'}
    network: ${this.yamlSafe(node.params.type || 'tcp')}
${node.params.sni ? `    sni: ${this.yamlSafe(node.params.sni)}` : ''}
    udp: ${udp}`;
      case 'ss':
        return `${base}
    cipher: ${this.yamlSafe(node.params.method)}
    password: ${this.yamlSafe(node.params.password)}
    udp: true`;
      case 'socks5':
        return `${base}
    udp: ${udp}`;
      default:
        return base;
    }
  }

  static generateV2rayN(nodes) {
    const urls = nodes.map(n => this.nodeToUrl(n)).filter(Boolean);
    if (urls.length === 0) return '';
    const raw = urls.join(String.fromCharCode(10));
    try {
      return btoa(unescape(encodeURIComponent(raw)));
    } catch (e) {
      return btoa(raw);
    }
  }

  static nodeToUrl(node) {
    if (node.originalUrl && !node.displayName) return node.originalUrl;
    const remark = node.displayName || node.remark;
    try {
      switch (node.protocol) {
        case 'vless': {
          const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
          const ipParam = node.params.ip ? `&ip=${encodeURIComponent(node.params.ip)}` : '';
          return `vless://${node.params.uuid}@${hostPort}?encryption=${node.params.encryption || 'none'}&security=${node.params.security || 'tls'}&type=${node.params.type || 'ws'}&path=${encodeURIComponent(node.params.path || '/')}&host=${encodeURIComponent(node.params.host || '')}&sni=${encodeURIComponent(node.params.sni || '')}${ipParam}#${encodeURIComponent(remark)}`;
        }
        case 'vmess': {
          const obj = {
            v: '2', ps: remark, add: node.address, port: String(node.port),
            id: node.params.id, aid: String(node.params.aid || 0), scy: node.params.scy || 'auto',
            net: node.params.net || 'tcp', type: node.params.type || 'none', host: node.params.host || '',
            path: node.params.path || '', tls: node.params.tls || '', sni: node.params.sni || ''
          };
          return 'vmess://' + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
        }
        case 'ss': {
          const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
          return `ss://${btoa(`${node.params.method}:${node.params.password}`)}@${hostPort}#${encodeURIComponent(remark)}`;
        }
        case 'trojan': {
          const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
          return `trojan://${encodeURIComponent(node.params.password || 'your_password')}@${hostPort}?security=${node.params.security || 'tls'}&type=${node.params.type || 'tcp'}&sni=${encodeURIComponent(node.params.sni || '')}#${encodeURIComponent(remark)}`;
        }
        case 'socks5': {
          const hostPort = node.address.includes(':') ? `[${node.address}]:${node.port}` : `${node.address}:${node.port}`;
          const user = node.params.user ? encodeURIComponent(node.params.user) : '';
          const pass = node.params.pass ? encodeURIComponent(node.params.pass) : '';
          const auth = user ? (pass ? `${user}:${pass}` : user) : '';
          return `socks5://${auth ? auth + '@' : ''}${hostPort}#${encodeURIComponent(remark)}`;
        }
        default:
          return null;
      }
    } catch (e) { return null; }
  }

  static generateSingbox(nodes, options) {
    const subName = options.subName || 'ProxyHub订阅';
    const outbounds = nodes.map(n => this.nodeToSingboxOutbound(n)).filter(Boolean);
    const tags = outbounds.map(o => o.tag);
    const config = {
      log: { level: 'info' },
      dns: {
        servers: [
          { tag: 'local', address: 'local', detour: 'direct' },
          { tag: 'remote', address: 'https://1.1.1.1/dns-query', detour: 'select' }
        ],
        rules: [{ geosite: 'cn', server: 'local' }],
        final: 'remote',
        strategy: 'ipv4_only'
      },
      inbounds: [
        { type: 'mixed', listen: '127.0.0.1', listen_port: 7890 }
      ],
      outbounds: [
        { type: 'selector', tag: 'select', outbounds: ['auto'].concat(tags), default: 'auto' },
        { type: 'urltest', tag: 'auto', outbounds: tags, url: 'http://www.gstatic.com/generate_204', interval: '1m' },
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' }
      ].concat(outbounds),
      route: {
        geoip: { download_url: 'https://github.com/SagerNet/sing-geoip/releases/latest/download/geoip.db' },
        geosite: { download_url: 'https://github.com/SagerNet/sing-geosite/releases/latest/download/geosite.db' },
        rules: [
          { geosite: 'cn', outbound: 'direct' },
          { geoip: 'cn', outbound: 'direct' },
          { geoip: 'private', outbound: 'direct' }
        ],
        final: 'select',
        auto_detect_interface: true
      }
    };
    return JSON.stringify(config, null, 2);
  }

  static nodeToSingboxOutbound(node) {
    const base = { tag: node.displayName, server: node.address, server_port: node.port };
    switch (node.protocol) {
      case 'vless':
        return Object.assign(base, {
          type: 'vless',
          uuid: node.params.uuid,
          flow: '',
          tls: node.params.security === 'tls' ? { enabled: true, server_name: node.params.sni || node.address, insecure: false } : undefined,
          transport: node.params.type === 'ws' ? { type: 'ws', path: node.params.path || '/', headers: { Host: node.params.host || node.params.sni || node.address } } : undefined
        });
      case 'vmess':
        return Object.assign(base, {
          type: 'vmess',
          uuid: node.params.id,
          alter_id: node.params.aid || 0,
          security: node.params.scy || 'auto',
          tls: node.params.tls === 'tls' ? { enabled: true, server_name: node.params.sni || node.address } : undefined,
          transport: (node.params.net === 'ws' || node.params.net === 'h2') ? { type: node.params.net, path: node.params.path || '/', headers: { Host: node.params.host || node.address } } : undefined
        });
      case 'ss':
        return Object.assign(base, { type: 'shadowsocks', method: node.params.method, password: node.params.password });
      case 'trojan':
        return Object.assign(base, { type: 'trojan', password: node.params.password || 'your_password', tls: { enabled: true, server_name: node.params.sni || node.address } });
      case 'socks5':
        return Object.assign(base, { type: 'socks', username: node.params.user, password: node.params.pass });
      default:
        return null;
    }
  }

  static generateFlClash(nodes, options) {
    return this.generateClash(nodes, options);
  }
}
