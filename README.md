# ProxyHub

> 智能代理节点管理工具 —— 基于 iori-nav UI 风格重构的多协议订阅转换器

## [在线演示](https://proxyhub.omail.us.kg/)



## 界面预览

| 浅色模式（自定义壁纸） | 深色模式（节点解析生成） |
|:---:|:---:|
| ![浅色模式](https://raw.githubusercontent.com/Vivo-Max/ProxyHub/main/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-06-13%20220434.png) | ![深色模式](https://raw.githubusercontent.com/Vivo-Max/ProxyHub/main/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-06-13%20220617.png) |

| 深色模式（自定义壁纸） | 界面外观设置 |
|:---:|:---:|
| ![深色模式壁纸](https://raw.githubusercontent.com/Vivo-Max/ProxyHub/main/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-06-13%20220738.png) | ![外观设置](https://raw.githubusercontent.com/Vivo-Max/ProxyHub/main/icon/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-06-13%20220820.png) |

## 项目概述

ProxyHub 是一款纯前端运行的代理节点管理工具，支持 VLESS、VMess、Shadowsocks、Trojan 等主流协议的解析与多客户端配置生成。采用 iori-nav 的毛玻璃卡片式 UI 设计，支持浅色/深色主题、自定义壁纸、界面外观调节等个性化功能。

**核心特点：**
- 纯前端运行，无需后端服务器，任意静态托管即可使用
- 节点数据不上传，本地处理保障隐私
- 零配置部署，双击 HTML 即可使用
- 支持文件拖拽导入、模板批量生成、自动缓存
- 配置文件内置 url-test，由客户端自行测速排序

## 功能特性

### 协议支持
- VLESS (XTLS / TLS / WS / TCP)
- VMess (WebSocket / TCP / HTTP)
- Shadowsocks (多种加密方式)
- Trojan (TLS / TCP)

### 客户端兼容
- **Clash** / **Clash Verge** / **FlClash**
- **V2RayN** / **V2RayNG**
- **SingBox**
- 配置文件内置 url-test，客户端自行测速排序

### 输入方式
- URL 粘贴解析（混合多协议）
- CSV / TXT 文件导入（拖拽上传）
- 模板链接 + 节点列表批量生成
- 加载示例数据

### UI 功能
- 浅色 / 深色主题切换（View Transitions 动画）
- 自定义背景壁纸（拖拽上传）
- 面板透明度 / 磨砂强度调节
- 所有输入自动缓存（localStorage）
- 响应式布局（桌面 / 平板 / 手机）

## 技术架构

```
前端：原生 HTML5 + CSS3 + ES6（无框架依赖）
CSS：Tailwind CSS（utility） + 自定义 CSS 变量
部署：任意静态托管（GitHub Pages / Cloudflare Pages / Vercel 等）
可选：Cloudflare Function（validate.js）用于 IP 地理位置查询
```

### 文件结构

```
app/
├── index.html                  # 主入口
├── css/
│   ├── tailwind.min.css        # Tailwind 基础样式
│   ├── main.css                # 毛玻璃效果 / 主题系统 / 布局
│   ├── dark-mode.css           # 深色模式适配
│   └── responsive.css          # 响应式断点
├── js/
│   ├── app.js                  # 应用主逻辑（618 行）
│   ├── protocol-parser.js      # 多协议 URL 解析（199 行）
│   ├── config-generator.js     # 客户端配置生成（298 行）
│   ├── template-generator.js   # 模板批量生成（442 行）
│   ├── ui-controller.js        # UI 交互 / 主题 / 外观设置（386 行）
│   ├── ip-lookup.js            # IP 地理位置查询（194 行）
│   ├── country-data.js         # 国家代码与 Emoji 映射（220 行）
│   ├── clash-rules.js          # Clash 规则预设（293 行）
│   └── file-handler.js         # 文件读写 / 下载（134 行）
├── assets/
│   ├── logo.svg                # 网站 Logo
│   ├── bg-default.jpg          # 浅色默认背景
│   └── bg-dark.jpg             # 深色默认背景
└── functions/
    └── validate.js             # Cloudflare Function（可选）
```

## 使用指南

### 方式一：直接打开（最简单）

```bash
# 1. 下载项目
# 2. 双击打开 index.html
```

### 方式二：本地静态服务器

```bash
cd app

# Python
python -m http.server 8080

# Node.js
npx serve

# 浏览器打开 http://localhost:8080
```

### 方式三：部署到 GitHub Pages

1. Fork 项目到 GitHub 仓库
2. 进入仓库 Settings → Pages
3. Source 选择 Deploy from a branch → main / root
4. 访问 `https://你的用户名.github.io/仓库名`

### 方式四：部署到 Cloudflare Pages

```bash
# 1. 安装 wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
npx wrangler login

# 3. 部署
npx wrangler pages deploy .

# 4. 浏览器打开部署的 URL
```

> Cloudflare Pages 部署后，`validate.js` Function 自动启用，可获得 IP 地理位置信息。

### 基本操作流程

1. **输入节点**：粘贴节点 URL 或拖拽 CSV/TXT 文件到上传区
2. **选择客户端**：点击 Clash / V2RayN / SingBox 标签
3. **调整设置**：修改订阅名称、规则预设（可选）
4. **获取配置**：点击"生成链接与配置"，预览后复制或下载

### 模板批量生成

1. 在"模板链接"框粘贴一个节点 URL 作为模板
2. 在"节点列表"框粘贴 CSV 格式数据（IP,端口,备注）
3. 选择生成协议（VLESS / Trojan / SS）
4. 点击"生成链接与配置"

## 自动缓存系统

所有输入元素自动保存到浏览器 localStorage，下次打开自动恢复：

| 缓存项 | 说明 |
|--------|------|
| 节点列表 | 实时保存，页面加载自动解析 |
| 模板配置 | 实时保存 |
| 订阅名称 / 规则预设 | change 事件保存 |
| UDP / TFO 开关 | change 事件保存 |
| 自定义规则 | input 事件保存 |
| 客户端选择 | click 事件保存 |
| 主题 / 外观设置 | 实时保存 |

## 注意事项

1. **浏览器兼容性**：推荐使用 Chrome / Edge / Firefox 最新版本。Safari 需 16.4+ 支持 View Transitions API。
2. **延迟显示**：本项目不实现浏览器端延迟探测（HTTP ping 与真实代理协议延迟严重不符）。节点列表显示地区信息（🇺🇸 美国），延迟测速由客户端配置文件内置的 `url-test` 完成。
3. **隐私安全**：所有处理在浏览器本地完成，节点数据不上传任何服务器。
4. **示例数据**：点击"加载示例"可查看支持的输入格式，示例中的域名（us.example.com 等）为虚构数据，仅供格式参考。
5. **文件格式**：
   - CSV：`IP,端口,备注,国家,国家代码`
   - TXT：`IP:端口#备注` 或 `IP,端口,备注`
   - URL：`vless://...` / `trojan://...` / `vmess://...` / `ss://...`

## 技术细节

### 协议解析
- VLESS：解析 URI 参数（uuid, security, sni, type, path, host）
- VMess：Base64 解码 JSON 配置
- Trojan：解析密码、SNI、端口
- SS：Base64 解码 method:password

### 配置生成
- **Clash**：YAML 格式，支持 proxy-provider / url-test / 规则预设
- **V2RayN**：JSON 格式，VLESS / VMess 出站配置
- **SingBox**：JSON 格式，sing-box 标准配置

### 主题系统
- CSS 变量驱动，`dark` class 切换
- View Transitions API 实现主题切换动画
- localStorage 持久化主题偏好

## 开源协议

MIT License
