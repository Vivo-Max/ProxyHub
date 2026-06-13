// ProxyHub - Country Data
// 国家/地区 Emoji 与名称映射，以及从文本中识别国家的辅助函数

const COUNTRY_EMOJI = {
  CN: '🇨🇳', HK: '🇭🇰', MO: '🇲🇴',
  TW: '🇹🇼',
  JP: '🇯🇵',
  KR: '🇰🇷', SG: '🇸🇬', MY: '🇲🇾',
  TH: '🇹🇭', VN: '🇻🇳', ID: '🇮🇩', PH: '🇵🇭', IN: '🇮🇳',
  // 美洲
  US: '🇺🇸', CA: '🇨🇦', MX: '🇲🇽', BR: '🇧🇷',
  AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴', PE: '🇵🇪',
  // 欧洲
  GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹', SE: '🇸🇪',
  NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', PL: '🇵🇱', CZ: '🇨🇿',
  HU: '🇭🇺', RO: '🇷🇴', BG: '🇧🇬', GR: '🇬🇷', PT: '🇵🇹',
  IE: '🇮🇪', RU: '🇷🇺', UA: '🇺🇦', TR: '🇹🇷', LV: '🇱🇻',
  // 大洋洲
  AU: '🇦🇺', NZ: '🇳🇿',
  // 中东与非洲
  AE: '🇦🇪', SA: '🇸🇦', IL: '🇮🇱', ZA: '🇿🇦', EG: '🇪🇬',
  UNKNOWN: '🌐'
};

const COUNTRY_NAME = {
  CN: '中国', HK: '香港', MO: '澳门', TW: '台湾',
  JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚', TH: '泰国',
  VN: '越南', ID: '印尼', PH: '菲律宾', IN: '印度',
  US: '美国', CA: '加拿大', MX: '墨西哥', BR: '巴西',
  AR: '阿根廷', CL: '智利', CO: '哥伦比亚', PE: '秘鲁',
  GB: '英国', DE: '德国', FR: '法国', IT: '意大利', ES: '西班牙',
  NL: '荷兰', BE: '比利时', CH: '瑞士', AT: '奥地利', SE: '瑞典',
  NO: '挪威', DK: '丹麦', FI: '芬兰', PL: '波兰', CZ: '捷克',
  HU: '匈牙利', RO: '罗马尼亚', BG: '保加利亚', GR: '希腊', PT: '葡萄牙',
  IE: '爱尔兰', RU: '俄罗斯', UA: '乌克兰', TR: '土耳其', LV: '拉脱维亚',
  AU: '澳大利亚', NZ: '新西兰',
  AE: '阿联酋', SA: '沙特', IL: '以色列', ZA: '南非', EG: '埃及',
  UNKNOWN: '未知'
};

const COUNTRY_KEYWORDS = {
  CN: ['cn', 'china', '中国', '大陆', 'beijing', 'shanghai', '深圳'],
  HK: ['hk', 'hong kong', 'hongkong', '香港'],
  MO: ['mo', 'macao', 'macau', '澳门'],
  TW: ['tw', 'taiwan', '台湾', '台北'],
  JP: ['jp', 'japan', '日本', '东京', '大阪'],
  KR: ['kr', 'korea', '韩国', '首尔'],
  SG: ['sg', 'singapore', '新加坡'],
  MY: ['my', 'malaysia', '马来西亚'],
  TH: ['th', 'thailand', '泰国', '曼谷'],
  VN: ['vn', 'vietnam', '越南'],
  ID: ['id', 'indonesia', '印尼'],
  PH: ['ph', 'philippines', '菲律宾'],
  IN: ['in', 'india', '印度'],
  US: ['us', 'usa', 'united states', 'america', '美国', '洛杉矶', '纽约', '硅谷'],
  CA: ['ca', 'canada', '加拿大'],
  MX: ['mx', 'mexico', '墨西哥'],
  BR: ['br', 'brazil', '巴西'],
  AR: ['ar', 'argentina', '阿根廷'],
  CL: ['cl', 'chile', '智利'],
  CO: ['co', 'colombia', '哥伦比亚'],
  PE: ['pe', 'peru', '秘鲁'],
  GB: ['gb', 'uk', 'united kingdom', 'britain', '英国', '伦敦'],
  DE: ['de', 'germany', '德国'],
  FR: ['fr', 'france', '法国', '巴黎'],
  IT: ['it', 'italy', '意大利'],
  ES: ['es', 'spain', '西班牙'],
  NL: ['nl', 'netherlands', '荷兰'],
  BE: ['be', 'belgium', '比利时'],
  CH: ['ch', 'switzerland', '瑞士'],
  AT: ['at', 'austria', '奥地利'],
  SE: ['se', 'sweden', '瑞典'],
  NO: ['no', 'norway', '挪威'],
  DK: ['dk', 'denmark', '丹麦'],
  FI: ['fi', 'finland', '芬兰'],
  PL: ['pl', 'poland', '波兰'],
  CZ: ['cz', 'czech', '捷克'],
  HU: ['hu', 'hungary', '匈牙利'],
  RO: ['ro', 'romania', '罗马尼亚'],
  BG: ['bg', 'bulgaria', '保加利亚'],
  GR: ['gr', 'greece', '希腊'],
  PT: ['pt', 'portugal', '葡萄牙'],
  IE: ['ie', 'ireland', '爱尔兰'],
  RU: ['ru', 'russia', '俄罗斯'],
  UA: ['ua', 'ukraine', '乌克兰'],
  TR: ['tr', 'turkey', '土耳其'],
  LV: ['lv', 'latvia', '拉脱维亚'],
  AU: ['au', 'australia', '澳大利亚'],
  NZ: ['nz', 'new zealand', '新西兰'],
  AE: ['ae', 'uae', 'dubai', '阿联酋', '迪拜'],
  SA: ['sa', 'saudi', '沙特'],
  IL: ['il', 'israel', '以色列'],
  ZA: ['za', 'south africa', '南非'],
  EG: ['eg', 'egypt', '埃及']
};

function detectCountry(text) {
  if (!text) return { code: 'UNKNOWN', name: '未知', emoji: '🌐' };
  const t = text.toLowerCase();
  for (const [code, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      // 对短英文关键字使用前后非字母边界，避免 Angeles 里的 es 被误判为西班牙
      if (k.length <= 3 && /^[a-z]+$/.test(k)) {
        const regex = new RegExp(`(?<![a-z])${k}(?![a-z])`, 'i');
        if (regex.test(t)) {
          return { code, name: COUNTRY_NAME[code] || '未知', emoji: COUNTRY_EMOJI[code] || '🌐' };
        }
      } else if (t.includes(k)) {
        return { code, name: COUNTRY_NAME[code] || '未知', emoji: COUNTRY_EMOJI[code] || '🌐' };
      }
    }
  }
  return { code: 'UNKNOWN', name: '未知', emoji: '🌐' };
}

// 常见国家代码变体/ISO3/中英文名称 → 标准两字母代码
const COUNTRY_CODE_ALIASES = {
  'USA': 'US', 'AMERICA': 'US', 'UNITED STATES': 'US', '美国': 'US',
  'CHN': 'CN', 'CHINA': 'CN', '中国': 'CN', 'MAINLAND': 'CN',
  'GBR': 'GB', 'UK': 'GB', 'BRITAIN': 'GB', 'GREAT BRITAIN': 'GB', '英国': 'GB',
  'JPN': 'JP', 'JAPAN': 'JP', '日本': 'JP',
  'KOR': 'KR', 'KOREA': 'KR', '韩国': 'KR', 'SOUTH KOREA': 'KR',
  'RUS': 'RU', 'RUSSIA': 'RU', '俄罗斯': 'RU',
  'FRA': 'FR', 'FRANCE': 'FR', '法国': 'FR',
  'DEU': 'DE', 'GERMANY': 'DE', '德国': 'DE',
  'ITA': 'IT', 'ITALY': 'IT', '意大利': 'IT',
  'ESP': 'ES', 'SPAIN': 'ES', '西班牙': 'ES',
  'CAN': 'CA', 'CANADA': 'CA', '加拿大': 'CA',
  'AUS': 'AU', 'AUSTRALIA': 'AU', '澳大利亚': 'AU',
  'BRA': 'BR', 'BRAZIL': 'BR', '巴西': 'BR',
  'IND': 'IN', 'INDIA': 'IN', '印度': 'IN',
  'IDN': 'ID', 'INDONESIA': 'ID', '印尼': 'ID',
  'MYS': 'MY', 'MALAYSIA': 'MY', '马来西亚': 'MY',
  'PHL': 'PH', 'PHILIPPINES': 'PH', '菲律宾': 'PH',
  'THA': 'TH', 'THAILAND': 'TH', '泰国': 'TH',
  'VNM': 'VN', 'VIETNAM': 'VN', '越南': 'VN',
  'SGP': 'SG', 'SINGAPORE': 'SG', '新加坡': 'SG',
  'HKG': 'HK', 'HONG KONG': 'HK', 'HONGKONG': 'HK', '香港': 'HK',
  'TWN': 'TW', 'TAIWAN': 'TW', '台湾': 'TW', '台北': 'TW',
  'MAC': 'MO', 'MACAU': 'MO', 'MACAO': 'MO', '澳门': 'MO',
  'ARE': 'AE', 'UAE': 'AE', 'UNITED ARAB EMIRATES': 'AE', '阿联酋': 'AE',
  'SAU': 'SA', 'SAUDI ARABIA': 'SA', '沙特': 'SA',
  'ZAF': 'ZA', 'SOUTH AFRICA': 'ZA', '南非': 'ZA'
};

function normalizeCountryCode(value) {
  if (!value) return '';
  const s = String(value).trim();
  const upper = s.toUpperCase();
  if (COUNTRY_EMOJI[upper]) return upper;
  if (COUNTRY_CODE_ALIASES[upper]) return COUNTRY_CODE_ALIASES[upper];
  if (COUNTRY_CODE_ALIASES[s]) return COUNTRY_CODE_ALIASES[s];
  // 尝试按完整中文/英文名称匹配
  const lower = s.toLowerCase();
  for (const [code, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower === kw.toLowerCase()) return code;
    }
  }
  return '';
}

// 国旗 emoji → 国家代码（用于从已生成的节点名中恢复国家）
const EMOJI_TO_CODE = Object.fromEntries(
  Object.entries(COUNTRY_EMOJI)
    .filter(([code]) => code !== 'UNKNOWN')
    .map(([code, emoji]) => [emoji, code])
);

// 检测文本开头的国旗 emoji
function extractFlagCode(text) {
  if (!text) return '';
  const match = String(text).match(/^[\u{1F1E6}-\u{1F1FF}]{2}/u);
  return match ? (EMOJI_TO_CODE[match[0]] || '') : '';
}

// ================================
// 运营商（ISP）识别
// ================================
const ISP_EMOJI = {
  MOBILE: '📶',
  UNICOM: '🌐',
  TELECOM: '📡',
  TRIPLE: '⚡'
};

const ISP_NAME = {
  MOBILE: '移动',
  UNICOM: '联通',
  TELECOM: '电信',
  TRIPLE: '三网'
};

const ISP_KEYWORDS = {
  MOBILE: ['移动', 'mobile', 'cmcc', '中国移动', 'china mobile'],
  UNICOM: ['联通', 'unicom', 'cu', '中国联通', 'china unicom'],
  TELECOM: ['电信', 'telecom', 'ct', '中国电信', 'china telecom'],
  TRIPLE: ['三网', '全网', 'triple', 'all net', 'all-net']
};

function detectISP(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const [code, keywords] of Object.entries(ISP_KEYWORDS)) {
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (k.length <= 3 && /^[a-z]+$/.test(k)) {
        const regex = new RegExp(`(?<![a-z])${k}(?![a-z])`, 'i');
        if (regex.test(t)) {
          return { code, name: ISP_NAME[code], emoji: ISP_EMOJI[code] };
        }
      } else if (t.includes(k)) {
        return { code, name: ISP_NAME[code], emoji: ISP_EMOJI[code] };
      }
    }
  }
  return null;
}
