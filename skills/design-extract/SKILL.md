---
name: design-extract
description: Extract a complete DESIGN.md design-system style guide from any live website URL or local screenshots. Captures screenshots and samples DOM/computed CSS via browser MCP, then uses Claude's own multimodal vision to analyze visual style and produce a structured DESIGN.md with design tokens ({colors.*}, {typography.*}, {spacing.*}, {rounded.*}, {component.*}), full component specs, do's/don'ts, responsive behavior, iteration guide, and known gaps. Use when the user says "extract design from this site", "生成 DESIGN.md", "分析这个网站的设计风格", "提取设计风格", "get web design", or provides a URL/screenshots to reverse-engineer into a design reference. Accepts a URL, local screenshots, or both.
argument-hint: "[<url>] [--screenshots <path...>] [--dir <directory-name>] [--language zh|en]"
user-invocable: true
---

# Design Extract

You are about to extract a website's design language into a single structured `DESIGN.md` — a design-system reference document that another AI (or human) can use to reproduce the site's visual identity. The output is **not** a clone of the page; it is a token-level specification of the design system: colors, typography, layout, elevation, shapes, components, responsive behavior, and the editorial voice that makes the brand recognizable.

The reference standard for the output is the Claude.com design document: a warm, editorial, token-referenced spec where every value is a `{token.name}` reference and every component is documented to the pixel.

## Interactive Input

If `$ARGUMENTS` is empty or incomplete, ask the user interactively. Do NOT proceed without the required information. Ask questions one at a time — don't overwhelm with a long form.

### Step 1: Input Source

If no URL and no screenshots were provided, ask:

> **Q: 用什么作为设计提取的来源？**
> - Option A: 输入 URL（推荐）— "提供目标网址，例如 https://example.com，我会打开并采集"
> - Option B: 仅截图 — "我没有 URL，只有本地截图（需多模态分析）"
> - Option C: URL + 截图 — "我有 URL，同时补充几张截图（交互态/移动端/特定页面）"

If the user chooses B (screenshots only), note that extraction relies entirely on visual inference — no computed CSS. Skip to Step 2 (screenshots).

Validate URL format. If invalid, ask again.

### Step 2: Screenshots (only if B or C)

> **Q: 截图文件路径？**
> - 请提供 1-N 张截图路径（建议 ≥2 张，覆盖首屏 + 内容区 + footer）
> - Option A: 输入路径（多个用空格分隔）
> - Option B: 我还没截图 — "帮我从 URL 自动截"（仅 C 模式可用，转 URL 自动截图流程）

Verify each path exists. If not, ask again.

### Step 3: Output Directory Name

If `--dir` was not provided, suggest a default derived from the hostname (URL mode) or the first screenshot's name (screenshot mode) and ask:

> **Q: 输出目录叫什么名字？**
> - 显示建议名称（如 `example-com`），让用户确认或自定义
> - 用户可直接回车确认默认值，或输入新名称

If the directory already exists, ask whether to overwrite or pick a new name.

### Step 4: Output Language

> **Q: DESIGN.md 用什么语言？**
> - Option A: 跟随你的提问语言（推荐）— 中文提问→中文输出，英文提问→英文输出
> - Option B: 英文 — 对标 Claude.com 标准，便于喂给 AI 编程工具
> - Option C: 中文 — 章节说明用中文，token 名键仍用英文

Default to A (follow the user's question language). Token keys (`{colors.canvas}`) are always English; only the prose varies.

### Step 5: Confirm Summary

Before starting, show a summary and ask for confirmation:

> **即将提取设计：**
> - 来源: `https://example.com`（+ 3 张补充截图，如有）
> - 输出目录: `./example-com/`
> - 语言: 中文
>
> 确认开始？

Only proceed after the user confirms.

---

Once all inputs are gathered, the workflow proceeds with the collected information.

## Input Modes

1. **URL only** — Open the live site, capture screenshots + DOM/CSS, analyze, write DESIGN.md.
2. **Screenshots only** — No live site; analyze the provided screenshots visually (no computed CSS; tokens are visually inferred).
3. **URL + screenshots** — URL capture is primary; user screenshots supplement (interaction states, mobile, specific pages).

## Pre-Flight

1. **Browser automation (URL mode only)** — Check for available browser MCP tools. Preference order: `chrome-devtools` → `playwright` → `chrome` (Chrome MCP) → `browserbase` → `puppeteer`. This skill requires browser automation for screenshots and script injection. If none available in URL mode, ask the user to install one or switch to screenshot mode.

   **MCP tool name mapping** — detect which MCP is connected, then use the matching tool names:

   | Operation | chrome-devtools | playwright | puppeteer |
   |---|---|---|---|
   | Navigate | `new_page({url})` / `navigate_page({url})` | `browser_navigate({url})` | `puppeteer_navigate({url})` |
   | Screenshot | `take_screenshot({format,quality,filePath})` | `browser_take_screenshot({filename,fullPage,raw})` | `puppeteer_screenshot({filePath,fullPage})` |
   | Evaluate JS | `evaluate_script({function})` | `browser_evaluate({function})` | `puppeteer_evaluate({script})` |
   | Resize viewport | `resize_page({width,height})` | `browser_resize({width,height})` | (set on launch) |

   **Fallbacks:**
   - If `take_screenshot` doesn't support `filePath`, use the base64 return value and write to disk via `echo <b64> | base64 -d > <path>`.
   - If `evaluate_script` returns `[object Object]`, wrap the return value in `JSON.stringify(...)`.
   - If a screenshot rate-limits, sleep 1s and retry once.

2. **Create output directory** — `<dir>/` in the current working directory, plus `<dir>/assets/references/` and (URL mode) `<dir>/assets/research/`.
3. **Screenshot mode** — Verify all provided image files exist and are readable.

## Guiding Principles

### 1. Exact Values, Not Approximations
In URL mode, extract actual computed CSS values from `collected.json`. Never guess "it looks like 16px." If the computed value is `15.7px`, write `15.7px`. In screenshot mode, mark visually-inferred values explicitly in Known Gaps.

### 2. Token References, Not Inline Hex
Every color, font size, spacing, radius, and component is a `{token.name}` reference. Hex values appear **only** at the token definition site. The body of the document never inlines `#cc785c` — it writes `{colors.primary}`.

### 3. Real Evidence, No Invention
Components and tokens must be grounded in `collected.json` (URL mode) or the screenshots (screenshot mode). If evidence is limited for a section, write fewer items and list the gap in Known Gaps — do not fabricate.

### 4. The Document Is a System, Not a Page
The output is a design system spec, not a page clone. It describes the *vocabulary* (tokens) and *grammar* (components, rhythm, do/don'ts) so any page in the brand can be built from it.

## Phase 1: Capture (URL mode)

### Screenshots

Capture strategy (stays within Chrome's ≤2 screenshots/second rate limit — ≥600ms between shots):

1. **Desktop full-page** at 1440px width → `<dir>/assets/references/desktop-full.png`
2. **Mobile full-page** at 390px width → `<dir>/assets/references/mobile-full.png`

If desktop full-page fails or exceeds ~8000px height (Chrome's full-page limit), fall back to **3 viewport screenshots** at desktop scroll positions 0% / 40% / 80% → `scroll-1.jpg`, `scroll-2.jpg`, `scroll-3.jpg` (jpeg, quality 70), plus the mobile full-page.

Resize viewport between desktop/mobile captures. Reset scroll to top before each full-page shot. Wait for first-paint (a stable text via `wait_for`, or sleep 1-2s) before the first screenshot.

### Inject Collection Script

Read `assets/collect_design_data.js` in full, wrap it as an IIFE, and pass to `evaluate_script`:

```
const SCRIPT = readFile('<skill_dir>/assets/collect_design_data.js');
evaluate_script({ function: `() => { ${SCRIPT} }` })
```

The script ends with `return collectDesignData({ includeCss: true });`, so the wrapper `() => { ...全文... }` returns the structured object directly. Serialize the return value and write to `<dir>/assets/research/collected.json`.

The collected object contains:
- `meta` — title, hostname, description, theme-color, color-scheme, viewport, url, prefersColorScheme
- `domSnapshot` — headings, navigation, ctas, landmarks, distinctiveCandidates (top 12 modules), bodyTextSample, counts (forms/inputs/tables/codeBlocks/badges/tabs/accordions/carousels/dropdowns/...)
- `engineeredCssEvidence` — up to 280 sampled visible elements, each with selectorHint, componentType, rect, typography, color, box, motion
- `cssCustomProperties` — the site's own `:root` CSS variables (design tokens already named by the site)
- `responsiveBreakpoints` — breakpoints parsed from `@media` rules + matchMedia probes
- `hoverStates` — `:hover` rules parsed from stylesheets
- `containerWidths` — main containers and their max-width
- `formFields` — form field types and sample styles

If `evaluate_script` returns a huge object (>1MB), truncate `bodyTextSample` or omit it.

## Phase 2: Analysis & Token Inference

Read `collected.json` (URL mode) and the screenshots. You (Claude) are the multimodal analyzer — no external LLM call is needed. Use the screenshots for atmosphere, layout, and visual identity; use `collected.json` for exact token values.

### Token Inference Rules

Infer design tokens from `engineeredCssEvidence.rows` (the 280 computed-style samples). Filter noise values first: drop `none`, `normal`, `auto`, `0`, `transparent`, `rgba(0, 0, 0, 0)`.

| Token | Inference method |
|---|---|
| `color.text.primary` / `secondary` | top-1 / top-2 most frequent `color` value (across all elements; `secondary` from body-type elements) |
| `color.surface.base` | top-1 most frequent `backgroundColor` |
| `color.accent` | top-1 from the button + link elements' `color`/`backgroundColor`/`borderColor` pool |
| `color.border.default` | top-1 most frequent `borderColor` |
| `mode` | light / dark / mixed, judged by background luminance |
| `font.family.primary` / `secondary` | top-2 most frequent `fontFamily`, take the first family in each stack |
| `font.size.display` / `body` / `label` | max `fontSize` among headings / top-1 among body elements / min |
| `spacing.baseUnit` | the value among 4/5/6/8 that divides the most padding/margin values evenly |
| `spacing.scale` | top-5 most frequent px values in margin/padding |
| `radius.sharp` / `medium` / `pill` | top-1 in buckets ≤4px / 4-16px / >16px |
| `shadow.level` | layered / subtle / rare / none, by `boxShadow` occurrence rate |
| `motion.level` | subtle (<300ms) / moderate (≥300ms) / expressive (≥700ms), by max `transitionDuration` |

**Priority:** If `cssCustomProperties.rootVars` contains the site's own `:root` variables (e.g. `--color-primary`, `--space-4`), adopt their names and values as the primary tokens — the site has already named its system. Map them to the `{colors.*}` / `{spacing.*}` / `{rounded.*}` namespaces.

Use `responsiveBreakpoints` for the Responsive Behavior section. Use `containerWidths` for the Grid & Container max-width. Use `hoverStates` for component state variants. Use `distinctiveCandidates` to pick which components to document in the Components section.

## Phase 3: Write DESIGN.md

Write `<dir>/DESIGN.md` following the output template below strictly. The structure is fixed — every section is required.

### Output Template (Claude.com standard)

**1. frontmatter**
```
---
name: <Hostname> Design System
version: 1.0.0
last_updated: <YYYY-MM-DD>
source_url: <url or "local screenshots">
---
```

**2. Overview** — 2-3 paragraphs of atmosphere narrative: the canvas tone, the type pairing (display vs body), the brand voltage color, the surface-mode alternation rhythm (e.g. cream → cream-card → dark-mockup → coral-callout). End with a **Key Characteristics** bullet list of the 6-8 defining choices.

**3. Colors** — four sub-sections, each token formatted as `**Name** (\`{colors.xxx}\` — #hex): usage.`:
- **Brand & Accent** — primary, primary-active, accent-teal, accent-amber, etc.
- **Surface** — canvas, surface-soft, surface-card, surface-dark, hairline, etc.
- **Text** — ink, body, body-strong, muted, muted-soft, on-primary, on-dark, etc.
- **Semantic** — success, warning, error

**4. Typography** — three parts:
- **Font Family** — display/body/code split, fallback stacks, and licensed-font substitutes (open-source approximations)
- **Hierarchy** — a table: `| Token | Size | Weight | Line Height | Letter Spacing | Use |` covering display-xl/lg/md/sm, title-lg/md/sm, body-md/sm, caption, caption-uppercase, code, button, nav-link
- **Principles** — display weight 400 never bold, negative letter-spacing, serif/sans split rationale

**5. Layout** — three parts:
- **Spacing System** — base unit (4px), token list (`{spacing.xxs}` 4px ... `{spacing.section}` 96px), section padding, card padding
- **Grid & Container** — max content width (from `containerWidths`), column counts at each breakpoint
- **Whitespace Philosophy** — the editorial pacing rationale

**6. Elevation & Depth** — a table `| Level | Treatment | Use |` (flat / soft-hairline / cream-card / dark-surface-card / subtle-shadow) + a **Decorative Depth** paragraph (logo glyph, code-mockup internal chrome, illustration style).

**7. Shapes** — **Border Radius Scale** table `| Token | Value | Use |` (`{rounded.xs}` 4px ... `{rounded.pill}` 9999px) + **Photography & Illustrations** paragraph (photo vs line-art vs code-mockup usage).

**8. Components** — document each component present on the page (from `distinctiveCandidates` + `componentType`). Cover at least: `top-nav`, `button-primary`/`button-secondary`/`button-text-link`, `feature-card`/`product-mockup-card`/`code-window-card`/`pricing-tier-card`, `text-input`, `badge-pill`/`badge-coral`, `category-tab`, `cta-band`/`footer`. For each: name, background (`{colors.*}`), text color, font token (`{typography.*}`), padding, height, rounded token (`{rounded.*}`), and state variants (active/pressed/focused — from `hoverStates`). Reference components as `{component.xxx}`.

**9. Do's and Don'ts** — two bullet lists. Do's: anchor on the canvas, reserve the accent for CTAs, use the display serif, alternate surface modes. Don'ts: no cool gray canvas, no bold serif, no accent everywhere, no repeating surface mode in consecutive bands.

**10. Responsive Behavior** — **Breakpoints** table `| Name | Width | Key Changes |` (from `responsiveBreakpoints`), **Touch Targets**, **Collapsing Strategy**, **Image Behavior**.

**11. Iteration Guide** — a numbered list of rules for extending the system (one component at a time, use `{token.refs}`, never document hover beyond encoded states, etc.).

**12. Known Gaps** — list what could not be extracted: licensed fonts (only substitutes available), animation/transition timings, form validation states beyond focus, the actual product surface (chat UI etc.), and — in screenshot mode — all computed CSS precision.

### Token Reference Syntax

Throughout the document, reference tokens as:
- Colors: `{colors.canvas}`, `{colors.primary}`, `{colors.surface-dark}`
- Typography: `{typography.display-xl}`, `{typography.body-md}`, `{typography.code}`
- Spacing: `{spacing.section}`, `{spacing.xl}`, `{spacing.lg}`
- Radius: `{rounded.md}`, `{rounded.lg}`, `{rounded.pill}`
- Components: `{component.feature-card}`, `{component.button-primary}`, `{component.code-window-card}`

Never inline hex outside token definitions. Never inline raw px outside spacing/radius token definitions.

## Screenshot Mode (no URL)

When the user provides only screenshots:
1. Read each screenshot (multimodal vision).
2. Infer tokens visually: estimate hex values, identify font categories (serif/sans-serif/mono) and approximate weights, estimate spacing/radius.
3. Write DESIGN.md following the same template, but in **Known Gaps** explicitly state:
   - No computed CSS — all token values are visually estimated and need manual calibration
   - Color hex values approximate (±5-10% variance)
   - Font family cannot be confirmed — only category and approximate weight
   - Exact spacing/padding/radius cannot be measured precisely
   - No interaction state data (hover/focus/active)
   - No responsive breakpoint data (only what's visible in the provided screenshots)
   - No DOM structure / semantic markup / accessibility attributes
4. In the Colors/Typography sections, prefix visually-inferred hex with `~` (e.g. `#~cc785c`) or note "approximate" so downstream readers know to calibrate.

## Output Structure

```
<dir>/
├── DESIGN.md                      # The design system document
└── assets/
    ├── references/                # Screenshots used for analysis
    │   ├── desktop-full.png
    │   ├── mobile-full.png
    │   └── scroll-{1..3}.jpg      # Only present for long-page fallback
    └── research/                  # Collection artifacts (URL mode only)
        └── collected.json
```

## What NOT to Do

- **Don't invent token values.** If `collected.json` lacks evidence for a token, write fewer tokens and list the gap in Known Gaps.
- **Don't inline hex.** Use `{token}` references everywhere; hex only at the definition site.
- **Don't skip component specs or Do/Don'ts.** Every section of the template is required.
- **Don't call an external LLM.** You (Claude) are the multimodal analyzer — no API key, no Python, no external vision model.
- **Don't pretend screenshot-mode has CSS precision.** Mark visually-inferred values and document the gap.
- **Don't exceed Chrome's screenshot rate limit.** ≥600ms between shots; max ~5 shots total.
- **Don't analyze raw CSS in the prose.** The DESIGN.md describes the *system*; the `collected.json` is your evidence, not content to paste in.
- **Don't scatter files at root.** Only `DESIGN.md` lives at `<dir>/` root. Screenshots and research go under `assets/`.

## Completion Report

When done, report:
- Output directory path
- Input mode (URL / screenshots / URL + screenshots)
- Number of screenshots captured or provided
- Number of elements sampled (from `engineeredCssEvidence.sampledElements`, URL mode)
- DESIGN.md section completeness self-check (all 12 sections present, token references used, no inline hex)
- Known Gaps summary
- How to use: open `<dir>/DESIGN.md` as a design reference for AI coding or redesign
