# website-cloner

克隆一个在线站点为纯静态站点（HTML + CSS + JS），无框架依赖，输出可迁移到任何框架。

## 特性

- **纯静态输出** — 不依赖 React、Vue、Next.js 等任何框架，输出标准 HTML/CSS/JS
- **资源完整本地化** — 自动下载 CSS、JS、字体、图片、favicon、内联 SVG，所有路径改为相对路径，完全离线可用
- **交互式输入** — 不带参数启动时逐步询问目标 URL、参考站点、输出目录
- **支持本地参考** — 可接受已下载的静态站点作为补充参考，填补在线抓取可能遗漏的资源
- **行为保真** — 通过浏览器 MCP 提取精确 CSS 值和交互行为（滚动动画、悬停态、Tab 切换等），用 vanilla JS/CSS 重现
- **响应式** — 在 1440px / 768px / 390px 三档视口下测试并适配
- **视觉 QA** — 截图对比验证，确保克隆结果与原始站点一致

## 触发方式

```
/website-cloner
/website-cloner https://example.com
/website-cloner https://example.com --dir my-clone
/website-cloner https://example.com --dir my-clone --reference ~/Downloads/example-site
```

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `<url>` | 否（会询问） | 要克隆的目标站点 URL |
| `--dir <name>` | 否（会询问） | 输出目录名称，默认从 hostname 派生 |
| `--reference <path>` | 否（会询问） | 本地已下载的静态站点路径，作为参考 |

## 交互流程

不带参数启动时，技能会逐步询问：

1. **目标 URL** — 输入要克隆的网址，或选择"仅本地参考"
2. **本地参考** — 是否有已下载的静态站点作为参考
3. **输出目录名** — 确认或自定义输出文件夹名称
4. **确认摘要** — 汇总信息，确认后开始克隆

## 工作流程

### Phase 1: 侦察（Reconnaissance）
- 浏览器打开目标 URL，截取桌面端和移动端全页截图
- 提取全局样式：字体、颜色、favicon、全局 UI 模式
- 交互行为扫描：滚动、点击、悬停、响应式
- 生成页面拓扑结构文档

### Phase 2: 资源发现与下载
- 通过浏览器 JS 枚举所有资源（img、video、background-image、SVG、字体、样式表、脚本）
- 批量下载到本地目录结构
- 字体文件（woff2/woff）、图片（处理 HEIF → JPG 转换）、CSS、JS

### Phase 3: 逐段提取与构建
- 对每个页面区域提取精确计算样式（getComputedStyle）
- 提取多状态样式（滚动触发、悬停、Tab 切换等）
- 提取真实文本内容
- 构建对应的 HTML + CSS + JS

### Phase 4: 组装
- 合并为完整的 `index.html`、`styles.css`、`scripts.js`
- 语义化 HTML 结构
- CSS 自定义属性定义设计令牌
- 响应式媒体查询
- `prefers-reduced-motion` 无障碍保护

### Phase 5: 验证
- 本地 HTTP 服务器启动，curl 验证所有资源 200
- 截图视觉 QA 对比（桌面端 + 移动端）
- 交互行为测试

## 输出结构

```
<dir>/
├── index.html                  # 主页面（根目录）
├── favicon.ico                 # 网站图标（根目录）
├── favicon.svg                 # SVG 图标（根目录，如有）
└── assets/                     # 所有资源统一放在此目录
    ├── styles/                 # 样式文件
    │   ├── styles.css          # 整合后的主样式表
    │   ├── style-0.css         # 外部样式表（如保留独立）
    │   └── style-1.css
    ├── scripts/                # 脚本文件
    │   ├── scripts.js          # 主行为脚本
    │   ├── download-assets.mjs # 资源下载工具脚本
    │   └── original-script.js  # 外部脚本（仅保留必要）
    ├── fonts/                  # 所有字体文件
    │   ├── fontname-regular.woff2
    │   └── fontname-bold.woff2
    ├── images/                 # 所有图片
    │   ├── logo.svg
    │   ├── hero-bg.jpg
    │   ├── icons/              # UI 图标
    │   └── svg/                # 提取的内联 SVG
    ├── references/             # 截图参考
    │   ├── desktop-full.png
    │   └── mobile-full.png
    └── research/               # 提取过程文档
        ├── BEHAVIORS.md
        ├── PAGE_TOPOLOGY.md
        └── section-data/       # 每段提取的 JSON 数据
```

## 使用示例

### 克隆一个站点

```
/website-cloner
> 要克隆哪个网站？ https://example.com
> 是否有已下载的静态站点作为参考？ 没有
> 输出目录叫什么名字？ [example-com] 确认
> 即将克隆：目标 https://example.com，输出 ./example-com/，确认开始？ 确认
```

### 带本地参考克隆

```
/website-cloner https://example.com --reference ~/Downloads/example-site
> 输出目录叫什么名字？ [example-com] my-clone
> 即将克隆：目标 https://example.com，参考 ~/Downloads/example-site，输出 ./my-clone/，确认开始？ 确认
```

### 仅从本地文件重建（无 URL）

```
/website-cloner
> 要克隆哪个网站？ 仅本地参考
> 本地参考路径？ ~/Downloads/example-site
> 输出目录叫什么名字？ example-rebuild
> 确认开始？ 确认
```

## 前置要求

- **浏览器自动化** — 需要 Chrome MCP、Playwright MCP、Browserbase MCP 或 Puppeteer MCP 之一
- **Python 3** — 用于本地预览服务器
- **Node.js** — 用于运行资源下载脚本

## 注意事项

- 克隆 JS 框架站点（Next.js、Nuxt 等）时，不会运行其构建系统，而是将渲染后的 DOM 逆向重建为静态 HTML
- HEIF 格式图片会通过 CDN 参数自动转换为 JPG/PNG
- 所有外部 CDN 引用都会替换为本地文件，确保完全离线可用
- 动画和过渡效果会保留在 `prefers-reduced-motion` 媒体查询之后，尊重用户无障碍设置
