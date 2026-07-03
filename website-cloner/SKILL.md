---
name: website-cloner
description: Clone a live website into a complete, self-contained static site (pure HTML/CSS/JS, no framework). Produces a portable static site with all assets downloaded locally — CSS, JS, fonts, images, favicon. The output can be migrated to any framework later. Use when the user says "clone this site", "make a static copy", "download this website", "save this page offline", or provides a URL to replicate as plain static files. Optionally accepts a locally downloaded static site as reference.
argument-hint: "<url> [--dir <directory-name>] [--reference <path-to-downloaded-site>]"
user-invocable: true
---

# Website Cloner

You are about to clone a website into a fully self-contained static site — pure HTML, CSS, and JavaScript with zero framework dependencies. The output is a folder of static files that can be opened directly in a browser, served by any static server, or migrated into any framework later.

## Interactive Input

If `$ARGUMENTS` is empty or incomplete, ask the user interactively. Do NOT proceed without the required information. Ask questions one at a time — don't overwhelm with a long form.

### Step 1: Target URL

If no URL was provided in `$ARGUMENTS`, ask:

> **Q: 要克隆哪个网站？请提供目标 URL。**
> - Option A: 输入 URL（推荐）— "提供目标网址，例如 https://example.com"
> - Option B: 仅本地参考 — "我没有 URL，只有本地已下载的静态文件"

If the user chooses B (no URL), skip to Step 2 but note that extraction will rely entirely on local files — no live fetch possible.

Validate the URL format. If invalid, ask again.

### Step 2: Local Reference (Optional)

Ask:

> **Q: 是否有已下载的静态站点作为参考？**
> - Option A: 有（推荐）— "提供本地目录路径"
> - Option B: 没有 — "直接克隆，无需参考"

If the user provides a path, verify the directory exists. If not, ask again or offer to skip.

### Step 3: Output Directory Name

If `--dir` was not provided in `$ARGUMENTS`, suggest a default derived from the hostname and ask:

> **Q: 输出目录叫什么名字？**
> - 显示建议名称（如 `example-com`），让用户确认或自定义
> - 用户可直接回车确认默认值，或输入新名称

If the directory already exists, ask whether to overwrite or pick a new name.

### Step 4: Confirm Summary

Before starting, show a summary and ask for confirmation:

> **即将克隆：**
> - 目标 URL: `https://example.com`
> - 本地参考: `~/Downloads/example-site`（如有）
> - 输出目录: `./example-com/`
>
> 确认开始？

Only proceed after the user confirms.

---

Once all inputs are gathered, the workflow proceeds with the collected information.

## Input Modes

Based on gathered input, this skill operates in three modes:

1. **URL only** — Fetch the live site, extract everything, rebuild as static files.
2. **URL + local reference** — The user has already downloaded a static version (e.g., via browser "Save Page" or `wget`). Use it as a reference to cross-check assets and structure, fill in gaps the live fetch might miss.
3. **Local reference only** — No live URL; rebuild from the downloaded files alone.

## Pre-Flight

1. **Browser automation** — Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP). Prefer Chrome MCP. This skill requires browser automation for accurate CSS/behavior extraction. If none available, ask the user.
2. **Create output directory** — `<dir>/` in the current working directory.
3. **If local reference provided** — Inspect its structure first. List all HTML files, asset directories (`_files/`, `css/`, `js/`, `images/`, etc.). Note what is complete vs. broken/missing. This is your fallback source.

## Guiding Principles

### 1. Exact Values, Not Approximations
Extract actual computed CSS values via `getComputedStyle()`. Never guess "it looks like 16px." If the computed value is `15.7px`, write `15.7px`.

### 2. Real Assets, Real Content
Download actual images, fonts, CSS, and JS from the live site. Extract real text content via `element.textContent`. This is a clone, not a mockup.

### 3. Layered Assets
A section that looks like one image is often multiple layers — background gradient + foreground PNG + overlay icon. Inspect each container's full DOM tree and capture ALL `<img>` elements and background images.

### 4. Behavior Matters
A clone that looks right but feels dead is a failed clone. Capture scroll-triggered animations, hover states, and transitions — then reproduce them with vanilla CSS/JS.

### 5. Self-Contained Output
All assets use relative paths. No external CDN references remain. The output works fully offline.

## Phase 1: Reconnaissance

Navigate to the target URL with browser MCP.

### Screenshots
- Full-page screenshot at desktop (1440px) → save to `<dir>/assets/references/desktop-full.png`
- Full-page screenshot at mobile (390px) → save to `<dir>/assets/references/mobile-full.png`
- These are your master reference for visual QA later.

### Global Extraction

**Fonts** — Inspect `<link>` tags for Google Fonts or self-hosted fonts. Check computed `font-family` on key elements (headings, body, code, labels). Document every family, weight, and style. Download all font files (woff2 preferred, woff fallback).

**Colors** — Extract the site's color palette from computed styles. Define them as CSS custom properties in `:root`.

**Favicons & Meta** — Download favicon, apple-touch-icon, OG image.

**Global UI patterns** — Identify: custom scrollbar, scroll-snap, global keyframe animations, backdrop filters, smooth scroll libraries (Lenis, Locomotive Scroll).

### Interaction Sweep

**Scroll sweep:** Scroll top to bottom. At each section, observe:
- Header appearance changes (record trigger scroll position)
- Elements animating into view (type and timing)
- Scroll-snap points
- Smooth scroll library presence

**Click sweep:** Click every interactive element. Record what changes.

**Hover sweep:** Hover over buttons, cards, links, images. Record property changes and transitions.

**Responsive sweep:** Test at 1440px, 768px, 390px. Note layout changes and approximate breakpoints.

Save findings to `<dir>/assets/research/BEHAVIORS.md`.

### Page Topology

Map every distinct section top to bottom. Document:
- Visual order and working names
- Fixed/sticky overlays vs. flow content
- Z-index layers
- Interaction model per section (static / click / scroll / time)

Save to `<dir>/assets/research/PAGE_TOPOLOGY.md`.

## Phase 2: Asset Discovery & Download

### Discover All Assets

Run this via browser MCP to enumerate everything:

```javascript
JSON.stringify({
  images: [...document.querySelectorAll('img')].map(img => ({
    src: img.src || img.currentSrc,
    alt: img.alt,
    width: img.naturalWidth,
    height: img.naturalHeight,
    parentClasses: img.parentElement?.className,
    siblings: img.parentElement ? [...img.parentElement.querySelectorAll('img')].length : 0,
    position: getComputedStyle(img).position,
    zIndex: getComputedStyle(img).zIndex
  })),
  videos: [...document.querySelectorAll('video')].map(v => ({
    src: v.src || v.querySelector('source')?.src,
    poster: v.poster,
    autoplay: v.autoplay,
    loop: v.loop,
    muted: v.muted
  })),
  backgroundImages: [...document.querySelectorAll('*')].filter(el => {
    const bg = getComputedStyle(el).backgroundImage;
    return bg && bg !== 'none';
  }).map(el => ({
    url: getComputedStyle(el).backgroundImage,
    element: el.tagName + '.' + el.className?.split(' ')[0]
  })),
  svgs: [...document.querySelectorAll('svg')].map(s => ({
    outerHTML: s.outerHTML.slice(0, 500),
    parentClasses: s.parentElement?.className,
    width: s.getAttribute('width'),
    height: s.getAttribute('height'),
    viewBox: s.getAttribute('viewBox')
  })),
  fonts: [...new Set([...document.querySelectorAll('*')].slice(0, 300).map(el => getComputedStyle(el).fontFamily))],
  favicons: [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ href: l.href, sizes: l.sizes?.toString() })),
  stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href),
  scripts: [...document.querySelectorAll('script[src]')].map(s => s.src)
});
```

### Download Everything

Create `<dir>/assets/scripts/download-assets.mjs` and run it. Download to:
- `<dir>/assets/styles/` — external stylesheets (rename to `style-0.css`, `style-1.css`, etc.)
- `<dir>/assets/scripts/` — external scripts that are essential for functionality
- `<dir>/assets/fonts/` — all font files (woff2, woff, ttf)
- `<dir>/assets/images/` — all images, preserving logical structure
- `<dir>/favicon.ico` / `<dir>/favicon.svg` — favicons (at root, not in assets)

Use batched parallel downloads (4 at a time) with error handling. For each failed download, try the local reference as fallback.

**Font handling:** For Google Fonts, download the actual woff2 files from the CSS `@font-face` URLs (the browser-specific URLs), not just the CSS API. For self-hosted fonts, download directly.

**Image handling:** For CDN images with format options (Sanity, Cloudinary, etc.), request browser-compatible formats (jpg/png/webp) rather than HEIF.

### Extract Inline SVGs

Deduplicate inline `<svg>` elements. Save each unique one as a separate file in `<dir>/assets/images/svg/` or embed directly in HTML if small. Reference them consistently.

## Phase 3: Section-by-Section Extraction & Build

For each section in your page topology (top to bottom):

### Step 1: Extract Computed Styles

Run per-component extraction via browser MCP:

```javascript
(function(selector) {
  const el = document.querySelector(selector);
  if (!el) return JSON.stringify({ error: 'Element not found: ' + selector });
  const props = [
    'fontSize','fontWeight','fontFamily','lineHeight','letterSpacing','color',
    'textTransform','textDecoration','backgroundColor','background',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'margin','marginTop','marginRight','marginBottom','marginLeft',
    'width','height','maxWidth','minWidth','maxHeight','minHeight',
    'display','flexDirection','justifyContent','alignItems','gap',
    'gridTemplateColumns','gridTemplateRows',
    'borderRadius','border','borderTop','borderBottom','borderLeft','borderRight',
    'boxShadow','overflow','overflowX','overflowY',
    'position','top','right','bottom','left','zIndex',
    'opacity','transform','transition','cursor',
    'objectFit','objectPosition','mixBlendMode','filter','backdropFilter',
    'whiteSpace','textOverflow','WebkitLineClamp'
  ];
  function extractStyles(element) {
    const cs = getComputedStyle(element);
    const styles = {};
    props.forEach(p => { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') styles[p] = v; });
    return styles;
  }
  function walk(element, depth) {
    if (depth > 5) return null;
    const children = [...element.children];
    return {
      tag: element.tagName.toLowerCase(),
      classes: element.className?.toString().split(' ').slice(0, 5).join(' '),
      text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3 ? element.textContent.trim().slice(0, 300) : null,
      styles: extractStyles(element),
      images: element.tagName === 'IMG' ? { src: element.src, alt: element.alt, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight } : null,
      childCount: children.length,
      children: children.slice(0, 25).map(c => walk(c, depth + 1)).filter(Boolean)
    };
  }
  return JSON.stringify(walk(el, 0), null, 2);
})('SELECTOR');
```

### Step 2: Extract Multi-State Styles

For elements with multiple states (scroll-triggered, hover, active tab):
1. Capture computed styles at initial state
2. Trigger the state change (scroll, click, hover via browser MCP)
3. Re-run extraction
4. Diff the two — the diff IS the behavior specification

Record: "Property X changes from VALUE_A to VALUE_B, triggered by TRIGGER, with transition: TRANSITION_CSS."

### Step 3: Extract Real Content

All text via `element.textContent`. All alt attributes, aria labels, placeholder text. For tabbed/stateful content — click each tab and extract content per state.

### Step 4: Build the Section as Static HTML

Write the section's HTML with:
- Semantic elements (`<nav>`, `<header>`, `<main>`, `<section>`, `<footer>`)
- CSS classes matching the extraction
- Inline `data-` attributes for JS hooks if needed
- Relative paths to all assets

### Step 5: Build Corresponding CSS

Write styles using:
- CSS custom properties for colors, spacing, fonts (defined once in `:root`)
- Exact computed values (not approximations)
- Media queries for responsive breakpoints identified in the sweep
- `prefers-reduced-motion` guards for all animations

### Step 6: Build Corresponding JS (if needed)

For interactive behaviors:
- Scroll-triggered animations → vanilla IntersectionObserver or CSS `animation-timeline`
- Hover effects → CSS `:hover` with transitions (prefer CSS over JS)
- Tab switching → vanilla JS click handlers
- Smooth scroll → CSS `scroll-behavior: smooth` or lightweight vanilla JS
- Parallax → CSS `transform` with scroll listener (throttled)

Keep JS minimal and dependency-free. Do NOT import jQuery, GSAP, or other libraries unless the original site's behavior absolutely requires it — and even then, prefer a lightweight vanilla implementation.

## Phase 4: Assembly

### Write `<dir>/index.html`

Assemble all sections into a single `index.html`:
- `<!DOCTYPE html>` with `lang` attribute matching original
- `<meta charset="UTF-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- `<title>` from original
- `<link>` to all CSS files
- `<script>` to all JS files (deferred)
- `no-js` → `js` class toggle in `<head>` (to prevent FOUC)
- All sections in semantic HTML

### Write `<dir>/assets/styles/styles.css`

Consolidate all section CSS:
- `:root` custom properties first (colors, fonts, spacing)
- Reset/normalize (minimal)
- Global styles (body, typography, links)
- Section-specific styles (grouped, commented)
- Media queries at the end (grouped by breakpoint)
- Keyframe animations
- `prefers-reduced-motion` overrides at the very end

### Write `<dir>/assets/scripts/scripts.js`

Consolidate all JS:
- Feature detection (IntersectionObserver support etc.)
- Scroll behavior handlers
- Tab/accordion toggles
- Any other interactive behavior
- All behind `prefers-reduced-motion` check where applicable

## Phase 5: Verification

### Asset Integrity Check

1. Start a local server: `cd <dir> && python3 -m http.server 8080`
2. `curl` the index page — confirm 200
3. `curl` each CSS, JS, font, image file — confirm 200
4. Check for any 404s in browser console (via browser MCP)
5. Fix any broken paths

### Visual QA Diff

1. Open the original site and your clone side-by-side (or screenshot both)
2. Compare section by section at desktop (1440px)
3. Compare again at mobile (390px)
4. For each discrepancy:
   - Re-extract the correct value from the live site
   - Update CSS/HTML to match
5. Test all interactions: scroll, click, hover
6. Verify responsive behavior at tablet (768px)

### Cross-Check with Local Reference (if provided)

If the user provided a downloaded static site:
1. Compare your clone's structure with the reference
2. Check if any assets in the reference are missing from your download
3. Use reference assets to fill gaps

## Output Structure

```
<dir>/
├── index.html                  # Main page (root only)
├── favicon.ico                 # Favicon (root)
├── favicon.svg                 # SVG favicon (root, if available)
└── assets/                     # ALL resources under this directory
    ├── styles/                 # Stylesheets
    │   ├── styles.css          # Consolidated main stylesheet
    │   ├── style-0.css         # External stylesheets (if kept separate)
    │   └── style-1.css
    ├── scripts/                # JavaScript files
    │   ├── scripts.js          # Main behavior script
    │   ├── download-assets.mjs # Utility: asset download script
    │   └── original-script.js  # External scripts (only if essential)
    ├── fonts/                  # All font files
    │   ├── fontname-regular.woff2
    │   └── fontname-bold.woff2
    ├── images/                 # All images
    │   ├── logo.svg
    │   ├── hero-bg.jpg
    │   ├── icons/              # UI icons
    │   └── svg/                # Extracted inline SVGs
    │       ├── arrow.svg
    │       └── checkmark.svg
    ├── references/             # Screenshots for QA
    │   ├── desktop-full.png
    │   └── mobile-full.png
    └── research/               # Extraction artifacts
        ├── BEHAVIORS.md
        ├── PAGE_TOPOLOGY.md
        └── section-data/       # Per-section extracted JSON
            ├── hero.json
            └── nav.json
```

## What NOT to Do

- **Don't use a framework.** No React, Vue, Next.js, or Tailwind. Pure HTML/CSS/JS only.
- **Don't approximate CSS values.** Extract exact computed values.
- **Don't skip font downloading.** A clone with system fonts instead of the real fonts looks wrong.
- **Don't leave external references.** All CDN links, Google Fonts API calls, etc. must be replaced with local files.
- **Don't ignore responsive design.** Test at desktop, tablet, and mobile.
- **Don't miss layered images.** Check every container for multiple background images and positioned overlays.
- **Don't extract only the default state.** Capture hover, scroll, active, and focus states.
- **Don't build click-based tabs when the original is scroll-driven (or vice versa).** Determine the interaction model by scrolling first, then clicking.
- **Don't skip the visual QA.** Screenshot comparison is mandatory.
- **Don't leave broken asset paths.** Every `curl` must return 200.
- **Don't scatter files at root.** Only `index.html`, `favicon.ico`, `favicon.svg` live at the cluster root. Everything else goes under `assets/`.

## Completion Report

When done, report:
- Output directory path
- Total sections cloned
- Total assets downloaded (images, fonts, CSS, JS — with counts)
- Any assets that couldn't be downloaded (with reasons)
- Responsive breakpoints implemented
- Interactions reproduced
- Visual QA results (any remaining discrepancies)
- How to preview: `cd <dir> && python3 -m http.server 8080`
