// ProxyHub - Clash Rules Presets
// Clash 规则预设，支持均衡、GFW、全局、直连、ACL4SSR 与自定义规则

const ACL4SSR_RULE_PROVIDERS = {
  LocalAreaNetwork: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list', path: './providers/rule/LocalAreaNetwork.yaml', interval: 86400 },
  BanAD: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list', path: './providers/rule/BanAD.yaml', interval: 86400 },
  BanProgramAD: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanProgramAD.list', path: './providers/rule/BanProgramAD.yaml', interval: 86400 },
  GoogleCN: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GoogleCN.list', path: './providers/rule/GoogleCN.yaml', interval: 86400 },
  SteamCN: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/SteamCN.list', path: './providers/rule/SteamCN.yaml', interval: 86400 },
  Microsoft: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list', path: './providers/rule/Microsoft.yaml', interval: 86400 },
  Apple: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list', path: './providers/rule/Apple.yaml', interval: 86400 },
  ProxyMedia: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list', path: './providers/rule/ProxyMedia.yaml', interval: 86400 },
  Telegram: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list', path: './providers/rule/Telegram.yaml', interval: 86400 },
  ProxyLite: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyLite.list', path: './providers/rule/ProxyLite.yaml', interval: 86400 },
  ChinaDomain: { type: 'http', behavior: 'domain', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list', path: './providers/rule/ChinaDomain.yaml', interval: 86400 },
  ChinaCompanyIp: { type: 'http', behavior: 'ipcidr', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaCompanyIp.list', path: './providers/rule/ChinaCompanyIp.yaml', interval: 86400 }
};

const ACL4SSR_RULES = [
  'RULE-SET,LocalAreaNetwork,🎯 全球直连',
  'RULE-SET,BanAD,🛑 全球拦截',
  'RULE-SET,BanProgramAD,🍃 应用净化',
  'RULE-SET,GoogleCN,🎯 全球直连',
  'RULE-SET,SteamCN,🎯 全球直连',
  'RULE-SET,Microsoft,Ⓜ️ 微软服务',
  'RULE-SET,Apple,🍎 苹果服务',
  'RULE-SET,ProxyMedia,🌍 国外媒体',
  'RULE-SET,Telegram,📲 电报信息',
  'RULE-SET,ProxyLite,🚀 节点选择',
  'RULE-SET,ChinaDomain,🎯 全球直连',
  'RULE-SET,ChinaCompanyIp,🎯 全球直连,no-resolve',
  'GEOIP,CN,🎯 全球直连,no-resolve',
  'MATCH,🐟 漏网之鱼'
];

const ClashRules = {
  getPresetRules(preset) {
    const data = this.getPresetData(preset, []);
    return data.rules.split('\n').filter(l => l.trim());
  },

  getPresetData(preset, proxyNames = []) {
    const map = {
      balanced: this.balanced,
      gfwlist: this.gfwlist,
      global: this.global,
      direct: this.direct,
      acl4ssr: this.acl4ssr
    };
    const fn = map[preset] || this.balanced;
    return fn.call(this, proxyNames);
  },

  // 返回默认分组（用于内置预设与自定义规则）
  getDefaultProxyGroups(proxyNames) {
    const list = proxyNames.map(n => `    - ${n}`).join('\n');
    return `- name: 🚀 节点选择
  type: select
  proxies:
    - 自动选择
    - ♻️ 自动选择(低延迟)
${list}
- name: ♻️ 自动选择(低延迟)
  type: url-test
  url: http://www.gstatic.com/generate_204
  interval: 300
  tolerance: 50
  lazy: true
  proxies:
${list}
- name: 漏网之鱼
  type: select
  proxies:
    - DIRECT
    - 🚀 节点选择`;
  },

  getCommonRules() {
    return [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
      'IP-CIDR,fc00::/7,DIRECT,no-resolve',
      'IP-CIDR,fe80::/10,DIRECT,no-resolve',
      'GEOIP,private,DIRECT,no-resolve',
      'GEOIP,cn,DIRECT,no-resolve'
    ];
  },

  balanced(proxyNames) {
    const rules = this.getCommonRules().concat([
      'DOMAIN-SUFFIX,github.com,🚀 节点选择',
      'DOMAIN-SUFFIX,google.com,🚀 节点选择',
      'DOMAIN-SUFFIX,youtube.com,🚀 节点选择',
      'DOMAIN-SUFFIX,gstatic.com,🚀 节点选择',
      'DOMAIN-SUFFIX,googleapis.com,🚀 节点选择',
      'DOMAIN-KEYWORD,google,🚀 节点选择',
      'DOMAIN-KEYWORD,youtube,🚀 节点选择',
      'DOMAIN-SUFFIX,facebook.com,🚀 节点选择',
      'DOMAIN-SUFFIX,twitter.com,🚀 节点选择',
      'DOMAIN-SUFFIX,x.com,🚀 节点选择',
      'DOMAIN-SUFFIX,instagram.com,🚀 节点选择',
      'DOMAIN-SUFFIX,telegram.org,🚀 节点选择',
      'DOMAIN-SUFFIX,openai.com,🚀 节点选择',
      'DOMAIN-SUFFIX,chatgpt.com,🚀 节点选择',
      'DOMAIN-SUFFIX,anthropic.com,🚀 节点选择',
      'DOMAIN-SUFFIX,bing.com,🚀 节点选择',
      'DOMAIN-SUFFIX,netflix.com,🚀 节点选择',
      'DOMAIN-SUFFIX,spotify.com,🚀 节点选择',
      'DOMAIN-SUFFIX,apple.com,DIRECT',
      'DOMAIN-SUFFIX,icloud.com,DIRECT',
      'DOMAIN-SUFFIX,alicdn.com,DIRECT',
      'DOMAIN-SUFFIX,alipay.com,DIRECT',
      'DOMAIN-SUFFIX,bilibili.com,DIRECT',
      'DOMAIN-KEYWORD,bilibili,DIRECT',
      'DOMAIN-SUFFIX,baidu.com,DIRECT',
      'DOMAIN-SUFFIX,qq.com,DIRECT',
      'DOMAIN-SUFFIX,taobao.com,DIRECT',
      'DOMAIN-SUFFIX,tmall.com,DIRECT',
      'DOMAIN-SUFFIX,jd.com,DIRECT',
      'DOMAIN-SUFFIX,163.com,DIRECT',
      'DOMAIN-SUFFIX,weibo.com,DIRECT',
      'DOMAIN-SUFFIX,douyin.com,DIRECT',
      'MATCH,漏网之鱼'
    ]).join('\n');
    return {
      proxyGroups: this.getDefaultProxyGroups(proxyNames),
      ruleProviders: '',
      rules
    };
  },

  gfwlist(proxyNames) {
    const rules = this.getCommonRules().concat([
      'DOMAIN-SUFFIX,github.com,🚀 节点选择',
      'DOMAIN-SUFFIX,google.com,🚀 节点选择',
      'DOMAIN-SUFFIX,youtube.com,🚀 节点选择',
      'DOMAIN-SUFFIX,gstatic.com,🚀 节点选择',
      'DOMAIN-SUFFIX,googleapis.com,🚀 节点选择',
      'DOMAIN-SUFFIX,facebook.com,🚀 节点选择',
      'DOMAIN-SUFFIX,twitter.com,🚀 节点选择',
      'DOMAIN-SUFFIX,x.com,🚀 节点选择',
      'DOMAIN-SUFFIX,instagram.com,🚀 节点选择',
      'DOMAIN-SUFFIX,whatsapp.com,🚀 节点选择',
      'DOMAIN-SUFFIX,telegram.org,🚀 节点选择',
      'DOMAIN-SUFFIX,openai.com,🚀 节点选择',
      'DOMAIN-SUFFIX,chatgpt.com,🚀 节点选择',
      'DOMAIN-SUFFIX,anthropic.com,🚀 节点选择',
      'DOMAIN-SUFFIX,bing.com,🚀 节点选择',
      'DOMAIN-SUFFIX,netflix.com,🚀 节点选择',
      'DOMAIN-SUFFIX,spotify.com,🚀 节点选择',
      'DOMAIN-KEYWORD,google,🚀 节点选择',
      'DOMAIN-KEYWORD,youtube,🚀 节点选择',
      'DOMAIN-KEYWORD,github,🚀 节点选择',
      'DOMAIN-KEYWORD,twitter,🚀 节点选择',
      'DOMAIN-KEYWORD,facebook,🚀 节点选择',
      'DOMAIN-KEYWORD,instagram,🚀 节点选择',
      'DOMAIN-KEYWORD,telegram,🚀 节点选择',
      'DOMAIN-KEYWORD,whatsapp,🚀 节点选择',
      'DOMAIN-KEYWORD,netflix,🚀 节点选择',
      'DOMAIN-KEYWORD,spotify,🚀 节点选择',
      'MATCH,漏网之鱼'
    ]).join('\n');
    return {
      proxyGroups: this.getDefaultProxyGroups(proxyNames),
      ruleProviders: '',
      rules
    };
  },

  global(proxyNames) {
    const rules = [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'MATCH,🚀 节点选择'
    ].join('\n');
    return {
      proxyGroups: this.getDefaultProxyGroups(proxyNames),
      ruleProviders: '',
      rules
    };
  },

  direct(proxyNames) {
    const rules = [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'MATCH,DIRECT'
    ].join('\n');
    return {
      proxyGroups: this.getDefaultProxyGroups(proxyNames),
      ruleProviders: '',
      rules
    };
  },

  acl4ssr(proxyNames) {
    const list = proxyNames.map(n => `    - ${n}`).join('\n');
    const proxyGroups = `- name: 🚀 节点选择
  type: select
  proxies:
    - ♻️ 自动选择
    - DIRECT
${list}
- name: ♻️ 自动选择
  type: url-test
  url: http://www.gstatic.com/generate_204
  interval: 300
  tolerance: 50
  proxies:
${list}
- name: 🌍 国外媒体
  type: select
  proxies:
    - 🚀 节点选择
    - ♻️ 自动选择
    - 🎯 全球直连
${list}
- name: 📲 电报信息
  type: select
  proxies:
    - 🚀 节点选择
    - 🎯 全球直连
${list}
- name: Ⓜ️ 微软服务
  type: select
  proxies:
    - 🎯 全球直连
    - 🚀 节点选择
${list}
- name: 🍎 苹果服务
  type: select
  proxies:
    - 🚀 节点选择
    - 🎯 全球直连
${list}
- name: 🎯 全球直连
  type: select
  proxies:
    - DIRECT
    - 🚀 节点选择
    - ♻️ 自动选择
- name: 🛑 全球拦截
  type: select
  proxies:
    - REJECT
    - DIRECT
- name: 🍃 应用净化
  type: select
  proxies:
    - REJECT
    - DIRECT
- name: 🐟 漏网之鱼
  type: select
  proxies:
    - 🚀 节点选择
    - 🎯 全球直连
    - ♻️ 自动选择
${list}`;

    const ruleProviders = Object.entries(ACL4SSR_RULE_PROVIDERS).map(([name, cfg]) => {
      return `  ${name}:
    type: ${cfg.type}
    behavior: ${cfg.behavior}
    url: "${cfg.url}"
    path: ${cfg.path}
    interval: ${cfg.interval}`;
    }).join('\n');

    return {
      proxyGroups,
      ruleProviders,
      rules: ACL4SSR_RULES.join('\n')
    };
  },

  // 自定义规则：按行分割，过滤空行与注释，返回字符串
  custom(rawRules) {
    if (!rawRules) return '';
    return rawRules.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith(';'))
      .map(l => (l.startsWith('- ') ? l.slice(2) : l))
      .join('\n');
  }
};
