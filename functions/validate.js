// Cloudflare Pages Function - 批量验证 IP 端口可用性、CF colo/国家与延迟
// 请求体：{ endpoints: ["ip:port", ...] } 或 { ips: ["ip", ...] }
// 返回：{ results: { "ip:port": { ip, port, countryCode, colo, latency, open, method } } }

import { connect } from 'cloudflare:sockets';

const CF_TRACE_URL = 'https://cloudflare.com/cdn-cgi/trace';
const BATCH_CONCURRENCY = 10;

function parseTrace(text) {
  const loc = text.match(/loc=([A-Z]{2})/);
  const colo = text.match(/colo=([A-Z0-9]+)/);
  return {
    countryCode: loc ? loc[1] : '',
    colo: colo ? colo[1] : ''
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function parseEndpoint(ep) {
  if (typeof ep === 'string') {
    let ip = ep;
    let port = 443;
    if (ep.startsWith('[')) {
      const end = ep.indexOf(']');
      if (end !== -1) {
        ip = ep.slice(1, end);
        const portPart = ep.slice(end + 1);
        if (portPart.startsWith(':')) port = parseInt(portPart.slice(1)) || 443;
      }
    } else if (ep.includes(':')) {
      const parts = ep.split(':');
      port = parseInt(parts[parts.length - 1]) || 443;
      ip = parts.slice(0, -1).join(':');
    }
    return { ip, port, key: ep };
  }
  if (ep && typeof ep === 'object') {
    const ip = ep.ip || ep.address || '';
    const port = parseInt(ep.port) || 443;
    return { ip, port, key: `${ip}:${port}` };
  }
  return { ip: String(ep), port: 443, key: String(ep) };
}

async function tcpCheck(ip, port, timeoutMs = 5000) {
  const start = Date.now();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TCP connect timeout')), timeoutMs)
  );
  try {
    const socket = connect({ hostname: ip, port });
    const writer = socket.writable.getWriter();
    await Promise.race([writer.ready, timeoutPromise]);
    const latency = Date.now() - start;
    try { writer.close(); } catch (e) {}
    try { socket.close(); } catch (e) {}
    return { open: true, latency };
  } catch (e) {
    return { open: false, latency: null };
  }
}

async function httpCheck(ip, port, timeoutMs = 5000) {
  // 常见 HTTPS 替代端口：先尝试 HTTPS；非 TLS 端口则尝试 HTTP
  const protocols = [80, 8080].includes(port) ? ['http'] : ['https', 'http'];
  for (const proto of protocols) {
    const url = `${proto}://${ip}:${port}/`;
    const start = Date.now();
    try {
      // 使用 resolveOverride 强制解析到目标 IP；Host 头避免 SNI 相关错误被误判
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Host': 'cloudflare.com' },
        cf: { resolveOverride: ip }
      }, timeoutMs);
      // 能拿到 HTTP 响应（任意状态码）说明端口在监听
      return { open: true, latency: Date.now() - start, protocol: proto };
    } catch (e) {
      const msg = e.message || '';
      // 明确连接失败/超时视为关闭
      if (msg.includes('Network connection lost') ||
          msg.includes('timed out') ||
          msg.includes('Connection refused') ||
          msg.includes('Could not connect') ||
          msg.includes('ECONNREFUSED')) {
        return { open: false, latency: null, protocol: proto };
      }
      // 其它错误（TLS 握手失败、协议不匹配等）说明端口有响应，尝试下一个协议
      continue;
    }
  }
  return { open: false, latency: null };
}

async function portCheck(ip, port) {
  // 先用 TCP connect（生产环境更准确）；本地 wrangler 可能被 mock
  const tcp = await tcpCheck(ip, port, 4000);
  // 如果 TCP 返回 0ms（本地 mock 特征），再用 HTTP fetch 交叉验证
  if (tcp.open && tcp.latency === 0) {
    const http = await httpCheck(ip, port, 4000);
    if (!http.open) return { open: false, latency: null };
    return { open: true, latency: http.latency };
  }
  return tcp;
}

async function getCountryFromCF(ip) {
  try {
    const res = await fetchWithTimeout(CF_TRACE_URL, {
      method: 'GET',
      headers: { 'Host': 'cloudflare.com' },
      cf: { resolveOverride: ip }
    }, 5000);
    const text = await res.text();
    const parsed = parseTrace(text);
    if (parsed.countryCode) {
      return { countryCode: parsed.countryCode, colo: parsed.colo, method: 'cf' };
    }
  } catch (e) {
    // CF 方法失败
  }
  return null;
}

async function getCountryFromGeoJS(ip) {
  try {
    const res = await fetchWithTimeout(`https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`, {}, 5000);
    const data = await res.json();
    if (data.country) {
      return { countryCode: data.country.toUpperCase(), colo: '', method: 'geojs' };
    }
  } catch (e) {
    // geojs 也失败
  }
  return null;
}

async function probeEndpoint(ip, port) {
  const portInfo = await portCheck(ip, port);

  let country = await getCountryFromCF(ip);
  if (!country) {
    country = await getCountryFromGeoJS(ip);
  }

  return {
    ip,
    port,
    countryCode: country?.countryCode || '',
    colo: country?.colo || '',
    latency: portInfo.latency,
    open: portInfo.open,
    method: country?.method || ''
  };
}

async function processBatch(endpoints) {
  const results = {};
  const list = endpoints.map(parseEndpoint).filter(e => e.ip);

  for (let i = 0; i < list.length; i += BATCH_CONCURRENCY) {
    const chunk = list.slice(i, i + BATCH_CONCURRENCY);
    await Promise.all(chunk.map(async ({ ip, port, key }) => {
      results[key] = await probeEndpoint(ip, port);
    }));
  }

  return results;
}

export async function onRequestPost(context) {
  const { request } = context;
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 兼容旧版单 IP 调用
  if (body.ip && typeof body.ip === 'string') {
    const { ip, port } = parseEndpoint({ ip: body.ip, port: body.port });
    const info = await probeEndpoint(ip, port);
    return new Response(JSON.stringify(info), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  const endpoints = body.endpoints || body.ips || [];
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing endpoints or ips' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 限制批量大小，避免超时
  const limited = endpoints.slice(0, 100);
  const results = await processBatch(limited);

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
