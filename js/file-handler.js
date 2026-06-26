class FileHandler {
  static async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  
  static parseCSV(content, options = {}) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const firstLine = lines[0].trim();
    const delimiter = this.detectDelimiter(firstLine);
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

    // 映射表头字段（与 TemplateGenerator 保持一致）
    const fieldMap = {
      ip: ['ip', 'ip地址', 'ipaddress', 'host', 'server', '地址', 'addr'],
      port: ['port', '端口'],
      remark: ['remark', '备注', 'name', '节点名称', '节点'],
      country: ['country', '国家', '地区'],
      code: ['code', '国家代码', 'countrycode', 'cc', '国际代码'],
      city: ['city', '城市'],
      isp: ['isp', '运营商', '线路', 'carrier', 'network'],
      latency: ['latency', 'delay', 'ping', '延迟', '延时'],
      speed: ['speed', 'download', 'downloadspeed', 'speedmbps', '下载速度', '速度']
    };

    const indices = {};
    for (let [field, aliases] of Object.entries(fieldMap)) {
      // 按 aliases 优先级匹配表头，确保“国家”优先于“地区”
      let idx = -1;
      for (const alias of aliases) {
        idx = headers.indexOf(alias);
        if (idx !== -1) break;
      }
      indices[field] = idx;
    }

    if (indices.ip === -1 || indices.port === -1) {
      throw new Error('CSV文件缺少必要的IP地址或端口字段');
    }

    const nodes = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(delimiter).map(f => f.trim());
      const address = fields[indices.ip];
      const port = parseInt(fields[indices.port]) || 443;
      let remark = indices.remark !== -1 ? fields[indices.remark] : '';
      const country = indices.country !== -1 ? fields[indices.country] : '';
      const code = indices.code !== -1 ? fields[indices.code] : '';
      const city = indices.city !== -1 ? fields[indices.city] : '';
      const isp = indices.isp !== -1 ? fields[indices.isp] : '';
      const latencyRaw = indices.latency !== -1 ? fields[indices.latency] : '';
      const latency = parseFloat(latencyRaw);
      const speedRaw = indices.speed !== -1 ? fields[indices.speed] : '';
      const downloadSpeed = parseFloat(speedRaw);

      if (isp) {
        const ispInfo = detectISP(isp);
        if (ispInfo) {
          remark = `${ispInfo.emoji} ${ispInfo.name}`;
        }
      } else if (code) {
        const normalizedCode = normalizeCountryCode(code);
        remark = `${COUNTRY_EMOJI[normalizedCode] || '🌐'} ${city || country || COUNTRY_NAME[normalizedCode] || '未知'}`;
      } else if (country) {
        remark = `🌐 ${city || country}`;
      }
      if (!remark) remark = '未命名';

      nodes.push({
        address,
        port,
        remark,
        latency: isNaN(latency) ? null : latency,
        downloadSpeed: isNaN(downloadSpeed) ? null : downloadSpeed
      });
    }
    return nodes;
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
  
  static parseTextLine(line, backupPort = '443') {
    line = line.trim();
    if (!line || line.startsWith('#')) return null;

    let address = '', port = backupPort, remark = '';

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
      const match = line.match(/(.+):(\d+)#(.+)/);
      if (match) [, address, port, remark] = match;
    } else if (line.includes(':')) {
      [address, port] = line.split(':', 2);
    } else if (line.includes('#')) {
      [address, remark] = line.split('#', 2);
    } else {
      address = line;
    }
    
    port = parseInt(port) || parseInt(backupPort) || 443;
    return { address, port, remark };
  }
  
  static download(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}