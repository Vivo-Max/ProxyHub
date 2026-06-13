// ProxyHub - Application Main Logic

class App {
  constructor() {
    this.ui = new UIController();
    this.currentNodes = [];
    this.currentClient = 'clash';
    this.currentConfig = '';
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSavedInput();
  }

  bindEvents() {
    document.getElementById('parseBtn')?.addEventListener('click', () => this.handleParse());
    document.getElementById('clearBtn')?.addEventListener('click', () => this.handleClear());
    document.getElementById('loadExampleBtn')?.addEventListener('click', () => this.loadExample());

    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    if (fileInput && dropZone) {
      dropZone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
    }

    document.querySelectorAll('.client-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.client-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentClient = tab.dataset.client;
        localStorage.setItem('ph_client', this.currentClient);
        if (this.currentNodes.length > 0) await this.generateConfig();
      });
    });

    // ===== 自动缓存：所有输入元素 =====
    this.bindCachedInput('nodeInput', 'ph_nodeInput', 'input', 600, (val) => this.handleRealtimeParse());
    this.bindCachedInput('templateInput', 'ph_template', 'input');
    this.bindCachedInput('protocolSelect', 'ph_protocol', 'change');
    this.bindCachedInput('subName', 'ph_subName', 'input');
    this.bindCachedInput('rulePreset', 'ph_rulePreset', 'change', 0, () => this.toggleCustomRules());
    this.bindCachedInput('udpRelay', 'ph_udpRelay', 'change');
    this.bindCachedInput('tcpFastOpen', 'ph_tcpFastOpen', 'change');
    this.bindCachedInput('customRules', 'ph_customRules', 'input');

    document.getElementById('copyBtn')?.addEventListener('click', () => this.handleCopy());
    document.getElementById('downloadBtn')?.addEventListener('click', () => this.handleDownload());
    document.getElementById('autoIdentifyBtn')?.addEventListener('click', () => this.handleAutoIdentify());

    document.querySelectorAll('.example-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const example = tab.dataset.example;
        document.querySelectorAll('.example-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.example-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.example-content[data-example="${example}"]`).classList.add('active');
      });
    });

    this.toggleCustomRules();
  }

  // 通用缓存输入绑定：元素ID, localStorage键, 事件类型, 防抖ms, 回调
  bindCachedInput(elId, storageKey, eventType, debounceMs = 0, callback = null) {
    const el = document.getElementById(elId);
    if (!el) return;

    const save = () => {
      const val = el.type === 'checkbox' ? el.checked : el.value;
      localStorage.setItem(storageKey, JSON.stringify(val));
      if (callback) callback(val);
    };

    if (debounceMs > 0) {
      let timer;
      el.addEventListener(eventType, () => {
        clearTimeout(timer);
        timer = setTimeout(save, debounceMs);
      });
    } else {
      el.addEventListener(eventType, save);
    }

    // checkbox 同时绑定 change 确保可靠
    if (eventType === 'change' && el.type === 'checkbox') {
      // change 已绑定，不需要额外绑定
    }
  }

  async loadSavedInput() {
    // 恢复所有缓存的输入值
    const restore = (elId, storageKey, defaultVal = '') => {
      const el = document.getElementById(elId);
      if (!el) return defaultVal;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw === null) return defaultVal;
        const val = JSON.parse(raw);
        if (el.type === 'checkbox') {
          el.checked = Boolean(val);
        } else {
          el.value = String(val);
        }
        return val;
      } catch {
        return defaultVal;
      }
    };

    restore('templateInput', 'ph_template', '');
    restore('protocolSelect', 'ph_protocol', 'all');
    restore('subName', 'ph_subName', 'ProxyHub订阅');
    restore('rulePreset', 'ph_rulePreset', 'balanced');
    restore('udpRelay', 'ph_udpRelay', true);
    restore('tcpFastOpen', 'ph_tcpFastOpen', false);
    restore('customRules', 'ph_customRules', '');

    // 恢复客户端选择
    const savedClient = localStorage.getItem('ph_client') || 'clash';
    this.currentClient = savedClient;
    document.querySelectorAll('.client-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.client === savedClient);
    });

    // 恢复节点输入（最后恢复，会触发解析）
    const savedNodes = localStorage.getItem('ph_nodeInput');
    if (savedNodes) {
      const input = document.getElementById('nodeInput');
      if (input) {
        input.value = JSON.parse(savedNodes);
        await this.handleRealtimeParse();
      }
    }

    this.toggleCustomRules();
  }

  async handleParse() {
    const input = document.getElementById('nodeInput');
    const templateInput = document.getElementById('templateInput');

    if (!input) return;

    const template = templateInput ? templateInput.value.trim() : '';
    const nodesText = input.value.trim();

    if (!nodesText) {
      this.showToast('请输入节点列表', 'error');
      return;
    }

    // 保存原始输入，便于延迟过滤变化时重新生成
    this.sourceTemplate = template;
    this.sourceNodesText = nodesText;

    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'flex';
    try {
      await this.regenerateFromSource(false);
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  // 根据保存的 sourceTemplate/sourceNodesText 重新生成链接与配置
  async regenerateFromSource(silent = false) {
    const input = document.getElementById('nodeInput');
    const templateInput = document.getElementById('templateInput');
    const protocolSelect = document.getElementById('protocolSelect');

    const template = this.sourceTemplate ?? (templateInput ? templateInput.value.trim() : '');
    const nodesText = this.sourceNodesText ?? (input ? input.value.trim() : '');

    if (!nodesText) return;

    // 模板模式：使用 TemplateGenerator 批量生成链接
    if (template) {
      const protocol = protocolSelect ? protocolSelect.value : 'all';
      const options = this.getConfigOptions();
      const result = await TemplateGenerator.generate(template, nodesText, protocol, {
        latencyFilter: options.latencyFilter,
        latencyThreshold: options.latencyThreshold
      });
      if (result && result.text) {
        if (input) {
          input.value = result.text;
          localStorage.setItem('ph_nodeInput', JSON.stringify(result.text));
        }
        if (!silent) this.showToast(`已生成 ${result.links.length} 条链接`, 'success');
        await this.parseAndGenerate(result.text);
        return;
      }
      this.showToast('模板格式无法识别，请检查是否为有效 URL 或 config.ini', 'error');
      return;
    }

    // 普通模式
    await this.parseAndGenerate(nodesText, true);
  }

  async handleRealtimeParse() {
    const input = document.getElementById('nodeInput');
    if (!input) return;
    const value = input.value.trim();
    if (!value) {
      this.currentNodes = [];
      this.updateStats([]);
      this.updateNodeList([]);
      return;
    }
    try {
      const nodes = ProtocolParser.parse(value);
      this.currentNodes = nodes;
      this.updateStats(nodes);

      // 异步探测延迟，不阻塞界面更新
      const needProbe = nodes.some(n => n.latency == null && n.address && !IpLookup.isPrivateIP(n.address));
      if (needProbe) {
        // 先显示"探测中..."
        this.updateNodeListProbing(nodes);
        // 后台探测延迟
        setTimeout(async () => {
          try {
            await this.ensureLatency(this.currentNodes);
            this.updateNodeList(this.currentNodes);
            this.updateStats(this.currentNodes);
          } catch (e) {
            console.warn('延迟探测失败:', e.message);
          }
        }, 100);
      } else {
        this.updateNodeList(nodes);
      }

      if (nodes.length > 0) {
        const output = document.getElementById('output');
        const grid = document.querySelector('.converter-grid');
        if (output && grid) {
          output.style.display = '';
          grid.classList.add('has-output');
          await this.generateConfig();
        }
      }
    } catch (e) {
      console.warn('实时解析错误:', e.message);
    }
  }

  // 延迟探测中状态显示
  updateNodeListProbing(nodes) {
    const container = document.getElementById('nodeList');
    if (!container) return;
    container.innerHTML = nodes.map((node, index) => {
      const protocol = node.protocol || 'unknown';
      const name = node.displayName || node.remark || '未命名';
      const addr = node.address ? `${node.address}:${node.port}` : '';
      return `
        <div class="node-item" style="animation: fadeIn 0.3s ease ${index * 0.03}s both;">
          <span class="node-protocol ${protocol}">${protocol}</span>
          <span class="node-name">${name}</span>
          <span class="node-address">${addr}</span>
          <span class="node-latency probing">探测中...</span>
        </div>
      `;
    }).join('');
  }

  async parseAndGenerate(input, updateInput = false) {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'flex';
    try {
      let nodes = ProtocolParser.parse(input);
      const originalCount = nodes.length;
      this.currentNodes = nodes;
      if (nodes.length === 0) {
        this.showToast('未识别到有效节点，请检查输入格式', 'error');
        return;
      }
      this.updateStats(nodes, originalCount);
      this.updateNodeList(nodes);
      const output = document.getElementById('output');
      const grid = document.querySelector('.converter-grid');
      if (output) output.style.display = '';
      if (grid) grid.classList.add('has-output');
      await this.generateConfig();
      this.showToast(`成功解析 ${nodes.length} 个节点`, 'success');
      if (updateInput) {
        const nodeInput = document.getElementById('nodeInput');
        if (nodeInput) {
          nodeInput.value = this.reconstructNodeText(nodes);
          localStorage.setItem('ph_nodeInput', JSON.stringify(nodeInput.value));
        }
      }
    } catch (e) {
      this.showToast(`解析错误: ${e.message}`, 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  async ensureLatency(nodes) {
    const missing = nodes.filter(n => n.latency == null && n.address && !IpLookup.isPrivateIP(n.address));
    if (missing.length === 0) return 0;
    try {
      const results = await IpLookup.lookupBatch(missing.map(n => n.address), 5);
      let filled = 0;
      for (const node of missing) {
        const info = results[node.address];
        if (info && info.latency != null) {
          node.latency = info.latency;
          filled++;
        }
      }
      if (filled === 0) {
        this.showToast('延迟探测失败，请确认已部署到 Cloudflare Pages 或使用 wrangler 本地启动', 'warning');
      }
      return filled;
    } catch (e) {
      console.warn('延迟获取失败:', e.message);
      this.showToast('延迟探测失败，请确认已部署到 Cloudflare Pages 或使用 wrangler 本地启动', 'warning');
      return 0;
    }
  }

  reconstructNodeText(nodes) {
    if (nodes.some(n => n.originalUrl)) {
      return nodes.map(n => n.originalUrl || `${n.address}:${n.port}`).join('\n');
    }
    return nodes.map(n => `${n.address}:${n.port}`).join('\n');
  }

  async generateConfig() {
    if (this.currentNodes.length === 0) return;
    try {
      const options = this.getConfigOptions();
      const nodes = this.currentNodes;
      const config = ConfigGenerator.generate(nodes, this.currentClient, options);
      this.currentConfig = config;
      const preview = document.getElementById('configPreview');
      if (preview) preview.textContent = config;
    } catch (e) {
      console.error('配置生成错误:', e);
      this.showToast(`配置生成失败: ${e.message}`, 'error');
    }
  }

  getConfigOptions() {
    const subName = document.getElementById('subName')?.value || 'ProxyHub订阅';
    const preset = document.getElementById('rulePreset')?.value || 'balanced';
    const udpRelay = document.getElementById('udpRelay')?.checked ?? true;
    const tcpFastOpen = document.getElementById('tcpFastOpen')?.checked ?? false;
    const ruleSource = preset === 'custom' ? 'custom' : 'preset';
    const customRules = ruleSource === 'custom' ? (document.getElementById('customRules')?.value || '') : '';
    return { subName, preset, udpRelay, tcpFastOpen, ruleSource, customRules };
  }

  toggleCustomRules() {
    const preset = document.getElementById('rulePreset')?.value;
    const group = document.getElementById('customRulesGroup');
    if (group) group.style.display = preset === 'custom' ? 'block' : 'none';
  }

  updateStats(nodes, filteredCount = null) {
    const stats = {
      total: nodes.length,
      vless: nodes.filter(n => n.protocol === 'vless').length,
      vmess: nodes.filter(n => n.protocol === 'vmess').length,
      ss: nodes.filter(n => n.protocol === 'ss').length,
      socks5: nodes.filter(n => n.protocol === 'socks5').length,
      trojan: nodes.filter(n => n.protocol === 'trojan').length
    };
    Object.entries(stats).forEach(([key, value]) => {
      const el = document.getElementById(`stat${key.charAt(0).toUpperCase() + key.slice(1)}`);
      if (el) this.animateNumber(el, parseInt(el.textContent) || 0, value);
    });
    const statusEl = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    if (statusEl && statusText) {
      statusEl.className = 'status-dot ready';
      let msg = nodes.length > 0 ? `已识别 ${nodes.length} 个节点` : '就绪，等待输入';
      if (filteredCount != null && filteredCount > nodes.length) {
        msg += `，已过滤 ${filteredCount - nodes.length} 个`;
      }
      statusText.textContent = msg;
    }
  }

  animateNumber(el, from, to) {
    if (from === to) return;
    const duration = 400;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  updateNodeList(nodes) {
    const container = document.getElementById('nodeList');
    if (!container) return;
    container.innerHTML = nodes.map((node, index) => {
      const region = node.countryName || node.country || '未知地区';
      const emoji = node.emoji || '🌐';
      const hasRealLatency = node.latency != null && (node.method === 'cf-tcp');
      let latencyText = '';
      if (hasRealLatency) {
        const cls = node.latency <= 100 ? 'low' : node.latency <= 300 ? 'medium' : 'high';
        latencyText = `<span class="node-latency ${cls}" title="CF TCP 真实探测">${Math.round(node.latency)}ms</span>`;
      }
      return `
        <div class="node-item" style="animation: fadeIn 0.3s ease ${index * 0.03}s both;">
          <span class="node-protocol ${node.protocol}">${node.protocol}</span>
          <span class="node-name">${node.displayName || node.remark || '未命名'}</span>
          <span class="node-address">${node.address}:${node.port}</span>
          <span class="node-region">${emoji} ${region}</span>
          ${latencyText}
        </div>
      `;
    }).join('');
    if (!document.getElementById('fadeInStyle')) {
      const style = document.createElement('style');
      style.id = 'fadeInStyle';
      style.textContent = '@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }';
      document.head.appendChild(style);
    }
    const autoBtn = document.getElementById('autoIdentifyBtn');
    if (autoBtn) {
      const hasUnknown = nodes.some(n => !n.countryCode || n.countryCode === 'UNKNOWN');
      autoBtn.style.display = hasUnknown ? 'inline-flex' : 'none';
    }
  }

  async handleFiles(files) {
    if (!files || files.length === 0) return;
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'flex';
    try {
      const results = [];
      for (const file of Array.from(files)) results.push(await FileHandler.readFile(file));
      const combined = results.join('\n');
      const input = document.getElementById('nodeInput');
      if (input) {
        input.value = combined;
        localStorage.setItem('ph_nodeInput', JSON.stringify(combined));
      }
      this.showToast(`成功导入 ${files.length} 个文件`, 'success');
      await this.parseAndGenerate(combined);
    } catch (e) {
      this.showToast(`文件读取失败: ${e.message}`, 'error');
    } finally {
      if (loading) loading.style.display = 'none';
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';
    }
  }

  handleClear() {
    const input = document.getElementById('nodeInput');
    if (input) input.value = '';
    localStorage.removeItem('ph_nodeInput');
    this.currentNodes = [];
    this.currentConfig = '';
    this.sourceTemplate = null;
    this.sourceNodesText = null;
    this.updateStats([]);
    const nodeList = document.getElementById('nodeList');
    if (nodeList) nodeList.innerHTML = '';
    const output = document.getElementById('output');
    const grid = document.querySelector('.converter-grid');
    if (output) output.style.display = 'none';
    if (grid) grid.classList.remove('has-output');
    const preview = document.getElementById('configPreview');
    if (preview) preview.textContent = '';
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    if (statusDot) statusDot.className = 'status-dot';
    if (statusText) statusText.textContent = '就绪，等待输入';
    this.showToast('已清空', 'info');
  }

  loadExample() {
    const examples = [
      '// VLESS 节点',
      'vless://12345678-1234-1234-1234-123456789abc@us.example.com:443?encryption=none&security=tls&type=ws&path=/proxy&host=cdn.example.com&sni=us.example.com#美国节点',
      '',
      '// Trojan 节点',
      'trojan://mypassword@jp.example.com:443?security=tls&type=tcp&sni=jp.example.com#日本节点',
      '',
      '// Shadowsocks 节点',
      'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@sg.example.com:8388#新加坡节点',
      '',
      '// 纯文本格式',
      'hk.example.com:443,香港节点',
      'de.example.com:8388,德国节点'
    ];
    const input = document.getElementById('nodeInput');
    if (input) {
      input.value = examples.join('\n');
      localStorage.setItem('ph_nodeInput', JSON.stringify(input.value));
      this.showToast('已加载示例数据', 'info');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
      this.parseAndGenerate(input.value);
    }
  }

  handleCopy() {
    const preview = document.getElementById('configPreview');
    if (!preview || !preview.textContent) {
      this.showToast('没有可复制的内容', 'error');
      return;
    }
    navigator.clipboard.writeText(preview.textContent).then(() => {
      this.showToast('已复制到剪贴板', 'success');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = preview.textContent;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('已复制到剪贴板', 'success');
    });
  }

  handleDownload() {
    if (!this.currentConfig) {
      this.showToast('没有可下载的内容', 'error');
      return;
    }
    let ext = '';
    let mime = 'text/plain';
    if (this.currentClient === 'v2rayn' || this.currentClient === 'singbox') {
      ext = '.json';
      mime = 'application/json';
    } else if (this.currentClient === 'clash' || this.currentClient === 'flclash') {
      mime = 'application/yaml';
    }
    const subName = this.getConfigOptions().subName || 'ProxyHub订阅';
    const safeSubName = String(subName).trim().replace(/[\\/:*?"<>|]/g, '_') || 'proxyhub';
    const filename = `${safeSubName}${ext}`;
    FileHandler.download(filename, this.currentConfig, mime);
    this.showToast(`已下载 ${filename}`, 'success');
  }

  async handleAutoIdentify() {
    if (!this.currentNodes.length) return;
    const unknownNodes = this.currentNodes.filter(n => !n.countryCode || n.countryCode === 'UNKNOWN');
    if (unknownNodes.length === 0) {
      this.showToast('没有需要识别的未知节点', 'info');
      return;
    }
    const uniqueEntries = [...new Map(unknownNodes.map(n => [n.address, n.port])).entries()];
    if (uniqueEntries.length === 0) return;

    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'flex';
    try {
      this.showToast(`正在识别 ${uniqueEntries.length} 个 IP 的国家/延迟...`, 'info');
      const results = await IpLookup.lookupBatch(uniqueEntries.map(e => e[0]), 3);

      let updated = 0;
      for (const node of unknownNodes) {
        const info = results[node.address];
        if (info && info.countryCode) {
          node.countryCode = info.countryCode;
          node.countryName = info.countryName || COUNTRY_NAME[info.countryCode] || '';
          node.country = node.countryName;
          node.emoji = COUNTRY_EMOJI[info.countryCode] || '🌐';
          if (info.latency != null) node.latency = info.latency;
          updated++;
        }
      }

      // 重新生成命名和配置
      this.currentNodes = ConfigGenerator.applyNaming(this.currentNodes);
      this.updateStats(this.currentNodes);
      this.updateNodeList(this.currentNodes);
      await this.generateConfig();
      this.showToast(`已识别 ${updated} 个节点`, updated > 0 ? 'success' : 'warning');
    } catch (e) {
      console.error('自动识别失败:', e);
      this.showToast('IP 识别失败，请检查网络', 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${iconMap[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 清除旧缓存键（一次性迁移）
  if (localStorage.getItem('nodeInput') !== null) {
    localStorage.removeItem('nodeInput');
  }
  window.app = new App();
});
