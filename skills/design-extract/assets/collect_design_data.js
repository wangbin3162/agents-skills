/**
 * collect_design_data.js
 *
 * 注入到目标页面运行（通过浏览器 MCP 的 evaluate_script）。
 * 返回一个 JSON 可序列化对象，包含页面 meta、DOM 快照、computed CSS 证据，
 * 以及站点自带的设计 token、响应式断点、hover 态、容器宽度、表单字段。
 *
 * 使用方式（在浏览器 MCP 中）：
 *   将此文件内容包装成 IIFE，作为 function 字符串传入 evaluate_script:
 *     `() => { ...本文件全部内容... }`
 *   文件末尾自带 `return collectDesignData({ includeCss: true });`，
 *   所以包装层只需 `() => { ...全文... }` 即可拿到结构化返回值。
 *
 * 注意：此脚本不依赖任何外部库，全部使用浏览器原生 API。
 *       跨域样式表会抛 SecurityError，已用 try/catch 跳过。
 */

function collectDesignData({ includeCss = true } = {}) {
  const result = {
    meta: collectPageMeta(),
    domSnapshot: collectDomSnapshot(),
  };
  if (includeCss) {
    result.engineeredCssEvidence = collectCssEvidence();
  }
  // 站点自带设计 token 与工程化补充证据
  result.cssCustomProperties = collectCssCustomProperties();
  result.responsiveBreakpoints = collectResponsiveBreakpoints();
  result.hoverStates = collectHoverStates();
  result.containerWidths = collectContainerWidths();
  result.formFields = collectFormFields();
  return result;
}

function collectPageMeta() {
  const metaByName = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  const metaByProperty = (property) => document.querySelector(`meta[property="${property}"]`)?.content || '';
  return {
    title: document.title,
    hostname: window.location.hostname,
    description: metaByName('description'),
    keywords: metaByName('keywords'),
    themeColor: metaByName('theme-color'),
    colorScheme: metaByName('color-scheme'),
    viewport: metaByName('viewport'),
    ogType: metaByProperty('og:type'),
    ogSiteName: metaByProperty('og:site_name'),
    applicationName: metaByName('application-name'),
    url: window.location.href,
    prefersColorScheme: tryMatchMedia('(prefers-color-scheme: dark)'),
  };
}

function collectDomSnapshot() {
  const textOf = (el, limit = 120) =>
    (el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  const allText = textOf(document.body, 14000);
  const ctaSelector = [
    'button',
    'a[role="button"]',
    'a[href]',
    '[class*="btn" i]',
    '[class*="button" i]',
    '[data-testid*="button" i]',
  ].join(',');
  const distinctiveSelector = [
    'header',
    'nav',
    'main > section',
    'section',
    'article',
    'form',
    'table',
    '[role="banner"]',
    '[role="navigation"]',
    '[role="main"]',
    '[role="region"]',
    '[class*="hero" i]',
    '[class*="feature" i]',
    '[class*="pricing" i]',
    '[class*="plan" i]',
    '[class*="card" i]',
    '[class*="panel" i]',
    '[class*="grid" i]',
    '[class*="gallery" i]',
    '[class*="testimonial" i]',
    '[class*="metric" i]',
    '[class*="stats" i]',
    '[class*="badge" i]',
    '[class*="marquee" i]',
  ].join(',');

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .filter(isVisibleForEvidence)
    .slice(0, 24)
    .map((el) => ({ level: el.tagName.toLowerCase(), text: textOf(el, 140) }))
    .filter((item) => item.text);

  const navigation = Array.from(
    document.querySelectorAll('nav a, header a, [role="navigation"] a')
  )
    .filter(isVisibleForEvidence)
    .slice(0, 32)
    .map((el) => textOf(el, 60))
    .filter(Boolean);

  const ctas = Array.from(document.querySelectorAll(ctaSelector))
    .filter(isVisibleForEvidence)
    .slice(0, 36)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: textOf(el, 80),
      href: el.getAttribute('href') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
    }))
    .filter((item) => item.text || item.ariaLabel);

  const landmarks = Array.from(
    document.querySelectorAll('header,nav,main,section,article,aside,footer,[role]')
  )
    .filter(isVisibleForEvidence)
    .slice(0, 40)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      id: el.id || '',
      className: stringifyClassName(el.className).split(/\s+/).slice(0, 6).join(' '),
      text: textOf(el, 180),
    }));

  const distinctiveCandidates = collectDistinctiveCandidates(distinctiveSelector, textOf);

  return {
    headings,
    navigation,
    ctas,
    landmarks,
    distinctiveCandidates,
    bodyTextSample: allText,
    counts: {
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input,textarea,select').length,
      tables: document.querySelectorAll('table').length,
      codeBlocks: document.querySelectorAll('pre,code').length,
      articleContainers: document.querySelectorAll(
        'article,[class*="article" i],[class*="post" i],[class*="blog" i]'
      ).length,
      pricingSections: document.querySelectorAll(
        '[class*="pricing" i],[id*="pricing" i],[class*="plans" i],[id*="plans" i]'
      ).length,
      badges: document.querySelectorAll('[class*="badge" i],[class*="chip" i],[class*="tag" i]').length,
      tabs: document.querySelectorAll('[role="tablist"],[class*="tabs" i],[class*="tablist" i]').length,
      accordions: document.querySelectorAll('[class*="accordion" i],details').length,
      carousels: document.querySelectorAll('[class*="carousel" i],[class*="slider" i]').length,
      dropdowns: document.querySelectorAll('[class*="dropdown" i],[role="menu"]').length,
    },
  };
}

function collectDistinctiveCandidates(selector, textOf) {
  const seen = new Set();
  const viewportHeight = Math.max(window.innerHeight || 0, 1);

  return Array.from(document.querySelectorAll(selector))
    .filter((el) => {
      if (!isVisibleForEvidence(el) || seen.has(el)) return false;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      const text = textOf(el, 220);
      const marker = `${stringifyClassName(el.className)} ${el.id || ''}`.toLowerCase();
      const hasDesignMarker = /(hero|feature|pricing|plan|card|panel|grid|gallery|testimonial|metric|stats|badge|marquee|cta|banner)/i.test(marker);
      const isLargeSection = rect.width >= 240 && rect.height >= 120;
      return hasDesignMarker || (isLargeSection && text.length > 20);
    })
    .map((el) => summarizeDistinctiveElement(el, textOf, viewportHeight))
    .sort((a, b) => b.score - a.score || a.position.top - b.position.top)
    .slice(0, 12)
    .map(({ score, ...item }) => item);
}

function summarizeDistinctiveElement(el, textOf, viewportHeight) {
  const rect = el.getBoundingClientRect();
  const className = stringifyClassName(el.className);
  const childTags = Array.from(el.children)
    .slice(0, 8)
    .map((child) => child.tagName.toLowerCase());
  const mediaCount = el.querySelectorAll('img,video,canvas,svg,picture').length;
  const buttonCount = el.querySelectorAll('button,a[role="button"],[class*="btn" i],[class*="button" i]').length;
  const heading = textOf(el.querySelector('h1,h2,h3,h4,h5,h6'), 120);
  const kind = inferDistinctiveKind(el);
  const area = Math.round(rect.width * rect.height);
  const foldBoost = rect.top < viewportHeight * 1.2 ? 2 : 0;
  const markerBoost = kind === 'section' || kind === 'content' ? 0 : 3;

  return {
    kind,
    selectorHint: buildSelectorHint(el),
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || '',
    id: el.id || '',
    className: className.split(/\s+/).slice(0, 8).join(' '),
    heading,
    text: textOf(el, 260),
    position: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    structure: {
      childTags,
      mediaCount,
      buttonCount,
    },
    score: area + mediaCount * 24000 + buttonCount * 12000 + markerBoost * 10000 + foldBoost * 10000,
  };
}

function inferDistinctiveKind(el) {
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();
  const marker = `${stringifyClassName(el.className)} ${el.id || ''}`.toLowerCase();

  if (tag === 'header' || role === 'banner' || marker.includes('hero')) return 'hero/header';
  if (tag === 'nav' || role === 'navigation' || marker.includes('nav')) return 'navigation';
  if (tag === 'form') return 'form';
  if (tag === 'table') return 'table/data';
  if (marker.includes('pricing') || marker.includes('plan')) return 'pricing';
  if (marker.includes('feature')) return 'feature';
  if (marker.includes('testimonial')) return 'testimonial';
  if (marker.includes('metric') || marker.includes('stats')) return 'metrics';
  if (marker.includes('gallery')) return 'gallery/media';
  if (marker.includes('marquee')) return 'marquee';
  if (marker.includes('card')) return 'card';
  if (marker.includes('panel')) return 'panel';
  if (marker.includes('grid')) return 'grid';
  if (marker.includes('badge')) return 'badge';
  if (tag === 'section' || role === 'region') return 'section';
  return 'content';
}

const CSS_EVIDENCE_LIMIT = 280;

function collectCssEvidence() {
  const diagnostics = [];
  try {
    const totalElements = document.querySelectorAll('*').length;
    const sampled = collectSampledElements(CSS_EVIDENCE_LIMIT);
    const rows = collectComputedStyleRows(sampled);

    if (sampled.length < 30) {
      diagnostics.push('Low sample size: fewer than 30 visible elements were extracted.');
    }
    if (!document.fonts) {
      diagnostics.push('document.fonts is unavailable in this browser context.');
    }

    return {
      source: {
        url: window.location.href,
        title: document.title,
        hostname: window.location.hostname,
      },
      sampledAt: new Date().toISOString(),
      totalElements,
      sampledElements: rows.length,
      rows,
      diagnostics,
    };
  } catch (e) {
    return {
      source: {
        url: window.location.href,
        title: document.title,
        hostname: window.location.hostname,
      },
      sampledAt: new Date().toISOString(),
      totalElements: 0,
      sampledElements: 0,
      rows: [],
      error: e.message,
      diagnostics: [`Engineering CSS evidence extraction failed: ${e.message}`],
    };
  }
}

function collectSampledElements(limit) {
  const prioritySelectors = [
    'body',
    'h1,h2,h3,h4,h5,h6',
    'p',
    'a',
    'button',
    'input,textarea,select',
    'label',
    'nav,header,footer,main,section,article,aside',
    'ul li,ol li',
    'table,th,td',
    '[role="button"]',
    '[class*="card" i]',
    '[class*="btn" i]',
    '[tabindex]',
  ];

  const seen = new Set();
  const candidates = [];
  const addElement = (el, priority) => {
    if (!el || seen.has(el) || !isVisibleForEvidence(el)) return;
    seen.add(el);
    candidates.push({ el, priority, area: elementArea(el) });
  };

  prioritySelectors.forEach((selector, index) => {
    try {
      document.querySelectorAll(selector).forEach((el) => addElement(el, index));
    } catch (_) {}
  });

  return candidates
    .sort((a, b) => a.priority - b.priority || b.area - a.area)
    .slice(0, limit)
    .map((item) => item.el);
}

function isVisibleForEvidence(el) {
  if (!(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  return true;
}

function elementArea(el) {
  const rect = el.getBoundingClientRect();
  return Math.round(rect.width * rect.height);
}

function collectComputedStyleRows(elements) {
  const rows = [];
  for (const el of elements) {
    try {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const componentType = inferComponentType(el);
      const isLowConfidence = cs.opacity === '0';

      rows.push({
        selectorHint: buildSelectorHint(el),
        componentType,
        lowConfidence: isLowConfidence,
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        id: el.id || null,
        className: stringifyClassName(el.className),
        textSample: getTextSample(el),
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        },
        typography: {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
        },
        color: {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
          outlineColor: cs.outlineColor,
        },
        box: {
          margin: cs.margin,
          padding: cs.padding,
          marginTop: cs.marginTop,
          marginRight: cs.marginRight,
          marginBottom: cs.marginBottom,
          marginLeft: cs.marginLeft,
          paddingTop: cs.paddingTop,
          paddingRight: cs.paddingRight,
          paddingBottom: cs.paddingBottom,
          paddingLeft: cs.paddingLeft,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
        },
        motion: {
          transitionDuration: cs.transitionDuration,
          transitionTimingFunction: cs.transitionTimingFunction,
          animationDuration: cs.animationDuration,
          animationTimingFunction: cs.animationTimingFunction,
        },
      });
    } catch (_) {}
  }
  return rows;
}

function inferComponentType(el) {
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();
  const className = stringifyClassName(el.className).toLowerCase();
  const id = (el.id || '').toLowerCase();
  const marker = `${className} ${id}`;

  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'button' || role === 'button' || marker.includes('button') || marker.includes('btn'))
    return 'button';
  if (tag === 'a') return 'link';
  if (['input', 'textarea', 'select'].includes(tag)) return 'input';
  if (tag === 'nav' || marker.includes('nav')) return 'navigation';
  if (tag === 'section') return 'section';
  if (tag === 'ul' || tag === 'ol' || tag === 'li') return 'list';
  if (['table', 'thead', 'tbody', 'tr', 'td', 'th'].includes(tag)) return 'table';
  if (marker.includes('badge') || marker.includes('chip') || marker.includes('tag')) return 'badge';
  if (marker.includes('breadcrumb')) return 'breadcrumb';
  if (marker.includes('dropdown') || role === 'menu') return 'dropdown';
  if (marker.includes('tooltip') || role === 'tooltip') return 'tooltip';
  if (marker.includes('accordion')) return 'accordion';
  if (marker.includes('tabs') || marker.includes('tablist') || role === 'tablist') return 'tabs';
  if (marker.includes('carousel') || marker.includes('slider')) return 'carousel';
  if (marker.includes('progress') || role === 'progressbar') return 'progress';
  if (marker.includes('skeleton')) return 'skeleton';
  if (marker.includes('card')) return 'card';
  if (marker.includes('hero')) return 'hero';
  if (marker.includes('modal') || role === 'dialog') return 'modal';
  if (marker.includes('panel')) return 'panel';
  if (marker.includes('grid')) return 'grid';
  if (marker.includes('container')) return 'container';
  return 'content';
}

function buildSelectorHint(el) {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const className = stringifyClassName(el.className);
  if (className) {
    return `${tag}.${className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')}`;
  }
  const role = el.getAttribute('role');
  if (role) return `${tag}[role="${role}"]`;
  return tag;
}

function stringifyClassName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.baseVal === 'string') return value.baseVal;
  return String(value);
}

function getTextSample(el) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return '';
  return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// ── 工程化补充证据：站点自带 token / 断点 / hover / 容器 / 表单 ─────

function tryMatchMedia(query) {
  try {
    return window.matchMedia(query).matches ? 'dark' : 'light';
  } catch (_) {
    return null;
  }
}

/** 递归遍历样式规则，进入 @media / @supports / @layer 嵌套。 */
function walkStyleRules(rules, visit) {
  if (!rules) return;
  // 用 typeof 守卫：CSSLayerBlockRule / CSSSupportsRule 在旧浏览器可能未定义，
  // 直接 instanceof 会抛 ReferenceError 并被外层 catch 吞掉，导致整条规则被跳过。
  const MediaRule = typeof CSSMediaRule !== 'undefined' ? CSSMediaRule : null;
  const LayerRule = typeof CSSLayerBlockRule !== 'undefined' ? CSSLayerBlockRule : null;
  const SupportsRule = typeof CSSSupportsRule !== 'undefined' ? CSSSupportsRule : null;
  for (const rule of rules) {
    try {
      const isContainer =
        (MediaRule && rule instanceof MediaRule) ||
        (LayerRule && rule instanceof LayerRule) ||
        (SupportsRule && rule instanceof SupportsRule);
      if (isContainer) {
        walkStyleRules(rule.cssRules, visit);
      } else if (rule instanceof CSSStyleRule) {
        visit(rule);
      }
    } catch (_) {}
  }
}

/** 遍历所有样式表（跨域表会抛 SecurityError，逐表 try/catch 跳过）。 */
function forEachStyleSheet(callback) {
  const sheets = document.styleSheets || [];
  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules || sheet.rules || [];
      callback(rules);
    } catch (_) {
      // 跨域样式表无法访问，跳过
    }
  }
}

function collectCssCustomProperties() {
  const result = { rootVars: [], diagnostics: [] };
  try {
    const seen = new Set();
    forEachStyleSheet((rules) => {
      walkStyleRules(rules, (rule) => {
        const sel = rule.selectorText || '';
        if (sel === ':root' || sel === 'html' || /(^|,\s*)(:root|html)\b/.test(sel)) {
          const style = rule.style;
          if (!style) return;
          for (let i = 0; i < style.length; i++) {
            const name = style[i];
            if (name && name.startsWith('--')) {
              const value = style.getPropertyValue(name).trim();
              if (value && !seen.has(name)) {
                seen.add(name);
                result.rootVars.push({ name, value });
              }
            }
          }
        }
      });
    });
    result.rootVars = result.rootVars.slice(0, 200);
  } catch (e) {
    result.diagnostics.push(`cssCustomProperties failed: ${e.message}`);
  }
  return result;
}

function collectResponsiveBreakpoints() {
  const result = { fromMediaQueries: [], matchMediaProbes: {}, diagnostics: [] };
  try {
    const bpSet = new Set();
    forEachStyleSheet((rules) => {
      walkStyleRules(rules, (rule) => {
        // CSSStyleRule 不含 media；断点来自 CSSMediaRule，walkStyleRules 已下钻，
        // 这里通过 rule.parentRule 反查 media 条件
        const media = rule.parentRule && rule.parentRule.media
          ? (rule.parentRule.conditionText || rule.parentRule.media.mediaText)
          : '';
        if (media) {
          const nums = media.match(/\d+(?:\.\d+)?px/g) || [];
          nums.forEach((n) => bpSet.add(n));
        }
      });
    });
    // 也直接收集顶层 CSSMediaRule 的 conditionText
    forEachStyleSheet((rules) => {
      const collectMedia = (list) => {
        if (!list) return;
        for (const rule of list) {
          try {
            if (rule instanceof CSSMediaRule) {
              const media = rule.conditionText || (rule.media && rule.media.mediaText) || '';
              const nums = media.match(/\d+(?:\.\d+)?px/g) || [];
              nums.forEach((n) => bpSet.add(n));
              collectMedia(rule.cssRules);
            }
          } catch (_) {}
        }
      };
      collectMedia(rules);
    });
    result.fromMediaQueries = [...bpSet].sort(
      (a, b) => parseFloat(a) - parseFloat(b)
    );
    const probes = [640, 768, 1024, 1280, 1440, 1920];
    for (const w of probes) {
      try {
        result.matchMediaProbes[`${w}px`] = window.matchMedia(`(max-width: ${w}px)`).matches;
      } catch (_) {}
    }
  } catch (e) {
    result.diagnostics.push(`responsiveBreakpoints failed: ${e.message}`);
  }
  return result;
}

function collectHoverStates() {
  const result = { hoverRules: [], diagnostics: [] };
  try {
    const seen = new Set();
    forEachStyleSheet((rules) => {
      walkStyleRules(rules, (rule) => {
        const sel = rule.selectorText || '';
        if (!sel.includes(':hover')) return;
        const style = rule.style;
        if (!style) return;
        const props = {};
        for (let i = 0; i < style.length; i++) {
          const p = style[i];
          const v = style.getPropertyValue(p);
          if (v) props[p] = v;
        }
        const key = sel.slice(0, 120);
        if (Object.keys(props).length && !seen.has(key)) {
          seen.add(key);
          result.hoverRules.push({ selector: sel.slice(0, 200), properties: props });
        }
      });
    });
    result.hoverRules = result.hoverRules.slice(0, 40);
  } catch (e) {
    result.diagnostics.push(`hoverStates failed: ${e.message}`);
  }
  return result;
}

function collectContainerWidths() {
  const result = { containers: [], diagnostics: [] };
  try {
    const selector =
      'main, [class*="container" i], [class*="wrapper" i], [class*="inner" i], [role="main"]';
    const seen = new Set();
    const els = [...document.querySelectorAll(selector)].filter(isVisibleForEvidence).slice(0, 20);
    for (const el of els) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const hint = buildSelectorHint(el);
      if (seen.has(hint)) continue;
      seen.add(hint);
      result.containers.push({
        selectorHint: hint,
        maxWidth: cs.maxWidth,
        width: Math.round(rect.width),
        margin: cs.margin,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
      });
    }
  } catch (e) {
    result.diagnostics.push(`containerWidths failed: ${e.message}`);
  }
  return result;
}

function collectFormFields() {
  const result = { counts: {}, fields: [], diagnostics: [] };
  try {
    const inputs = [...document.querySelectorAll('input,textarea,select')];
    const byType = {};
    for (const el of inputs) {
      const type =
        el.tagName === 'INPUT' ? (el.type || 'text').toLowerCase() : el.tagName.toLowerCase();
      byType[type] = (byType[type] || 0) + 1;
    }
    result.counts = byType;
    const sample = inputs.filter(isVisibleForEvidence).slice(0, 12);
    result.fields = sample.map((el) => {
      const cs = getComputedStyle(el);
      return {
        selectorHint: buildSelectorHint(el),
        type:
          el.tagName === 'INPUT' ? (el.type || 'text').toLowerCase() : el.tagName.toLowerCase(),
        placeholder: el.placeholder || '',
        height: cs.height,
        padding: cs.padding,
        borderRadius: cs.borderRadius,
        border: cs.border,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
      };
    });
  } catch (e) {
    result.diagnostics.push(`formFields failed: ${e.message}`);
  }
  return result;
}

// 直接调用并返回结果（浏览器 MCP 的 evaluate_script 会序列化返回值）
return collectDesignData({ includeCss: true });
