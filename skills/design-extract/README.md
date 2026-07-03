# design-extract

提取任意网站或截图的设计风格，输出一份对标 Claude.com 设计文档标准的 `DESIGN.md` 设计系统文档，作为 AI 编程 / 重设计的设计参考。

## 特性

- **三种输入模式** — URL 在线采集 / 本地截图（多模态分析）/ URL + 截图补充
- **零配置多模态分析** — 由 Claude 自身视觉能力分析截图与采集数据，无需外部 LLM、API Key 或 Python 脚本
- **工程化 CSS 采集** — 注入采集脚本拿 DOM、computed CSS、站点自带 `:root` 变量、响应式断点、hover 态、容器宽度、表单字段
- **token 引用体系** — 输出用 `{colors.*}` / `{typography.*}` / `{spacing.*}` / `{rounded.*}` / `{component.*}` 引用，不内联 hex，对标 Claude.com 设计文档标准
- **完整设计系统文档** — Overview / Colors / Typography / Layout / Elevation / Shapes / Components / Do-Don't / Responsive / Iteration / Known Gaps 全章节
- **交互式输入** — 不带参数启动时逐步询问输入源、截图、输出目录、语言
- **多浏览器 MCP 兼容** — chrome-devtools / Playwright / Puppeteer 等，自动检测并映射工具名
- **语言跟随提问** — 中文提问→中文输出，英文提问→英文输出，token 名键始终英文

## 触发方式

```
/design-extract
/design-extract https://example.com
/design-extract https://example.com --dir example-design
/design-extract --screenshots ~/Downloads/shot1.png ~/Downloads/shot2.png
/design-extract https://example.com --screenshots ~/Downloads/mobile.png --language zh
```

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `<url>` | 否（会询问） | 要提取设计的目标站点 URL |
| `--screenshots <path...>` | 否 | 本地截图路径，多个用空格分隔 |
| `--dir <name>` | 否（会询问） | 输出目录名称，默认从 hostname 派生 |
| `--language zh\|en` | 否（会询问） | 输出语言，默认跟随提问语言 |

## 交互流程

不带参数启动时，技能会逐步询问：

1. **输入源** — URL / 仅截图 / URL + 截图
2. **截图路径** —（截图模式时）提供 1-N 张截图，建议覆盖首屏 + 内容 + footer
3. **输出目录名** — 确认或自定义
4. **输出语言** — 跟随提问语言 / 英文 / 中文
5. **确认摘要** — 汇总信息，确认后开始

## 工作流程

### Phase 1: 采集（URL 模式）

- 浏览器打开目标 URL，桌面端 1440px + 移动端 390px 各截全页图
- 长页面（>8000px 或全页失败）回退为桌面 3 张视口截图（0% / 40% / 80%）+ 移动端全页
- 注入 `assets/collect_design_data.js` 采集 DOM、computed CSS、`:root` 变量、断点、hover 态、容器宽度、表单字段，写入 `collected.json`

### Phase 2: 分析与 token 归纳

- Claude 读 `collected.json` + 截图，归纳设计 token
- 颜色按高频值、字体按 fontFamily top-2、间距按 margin/padding 高频 px、圆角按分桶、阴影按出现率、动效按最大 duration
- 若站点自带 `:root` CSS 变量，优先采纳其命名
- 截图用于氛围、布局、视觉识别；采集数据用于精确 token 值

### Phase 3: 写 DESIGN.md

- 严格按 Claude.com 标准模板输出 12 章节
- 全文用 `{token}` 引用，不内联 hex
- 组件规格来自 distinctiveCandidates + componentType
- 响应式断点来自 `responsiveBreakpoints`

### 截图模式（无 URL）

- Claude 直接读截图（多模态），视觉推断 token
- 颜色 hex 近似（±5-10%），字体仅判类别 + 估权重
- Known Gaps 标注"无 computed CSS，数值为视觉推断，需人工校准"

## 输出结构

```
<dir>/
├── DESIGN.md                      # 设计系统文档
└── assets/
    ├── references/                # 分析用截图
    │   ├── desktop-full.png
    │   ├── mobile-full.png
    │   └── scroll-{1..3}.jpg      # 仅长页面回退时存在
    └── research/                  # 采集中间产物（URL 模式）
        └── collected.json
```

## 使用示例

### 从 URL 提取

```
/design-extract
> 用什么作为设计提取的来源？ https://stripe.com
> 输出目录叫什么名字？ [stripe-com] 确认
> DESIGN.md 用什么语言？ 跟随提问语言
> 即将提取：来源 https://stripe.com，输出 ./stripe-com/，语言中文，确认开始？ 确认
```

### 从截图提取

```
/design-extract
> 用什么作为设计提取的来源？ 仅截图
> 截图文件路径？ ~/Downloads/home.png ~/Downloads/pricing.png
> 输出目录叫什么名字？ my-design
> 确认开始？ 确认
```

### URL + 补充截图

```
/design-extract https://example.com --screenshots ~/Downloads/mobile.png
> 输出目录叫什么名字？ [example-com] 确认
> 确认开始？ 确认
```

## 前置要求

- **浏览器自动化**（URL 模式必需）— chrome-devtools MCP（推荐）、Playwright MCP、Puppeteer MCP 之一
- **截图模式** — 无需 MCP，仅需本地截图文件
- **无外部依赖** — 不需要 Python、不需要 API Key、不需要外部多模态 LLM；分析由 Claude 自身完成

## 注意事项

- 输出是设计系统文档（token + 组件规格），不是页面克隆；如需克隆整站请用 `website-cloner` 技能
- token 引用语法（`{colors.canvas}` 等）对标 Claude.com 设计文档，便于直接喂给 AI 编程工具复刻风格
- 截图模式下所有数值为视觉推断，颜色 ±5-10% 偏差，需人工校准
- 跨域样式表无法访问时（SecurityError），采集脚本会自动跳过，不影响主流程
- 输出语言跟随提问语言，但 token 名键始终为英文（如 `{colors.primary}`）
