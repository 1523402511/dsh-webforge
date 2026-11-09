/**
 * dsh-webforge — 把本地网页素材库变成 DSH 工具
 *
 * 库来源（按优先级）：WEBFORGE_LIB → 同级 eac-design-world → ~/.dsh/profiles/<名>/node_modules
 *   → 包内 library/（起步库，随包分发，保证装完可用）
 *   完整库：176 个网站模板 · 77 个 deck · 152 套设计体系 · 153 个技能
 *   起步库：4 模板 · 2 deck · 2 体系 · 2 技能
 *
 * 四个工具：
 *   webforge_search  搜库（按关键词/类型/就绪状态）
 *   webforge_read    读某一条的正文（模板 HTML / 体系 tokens+DESIGN / 技能 SKILL.md / deck 页数）
 *   webforge_build   模板 + 体系 + 内容 → 拼一份能打开的初稿，写到磁盘
 *   webforge_export  deck / 页面 → 本机 Edge/Chrome 无头打印 PDF
 *
 * 零依赖：只用 node 内置模块；不启动服务、不联网。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const name = 'webforge';
export const version = '0.3.1';
export const inject = ['tools', 'systemPrompt'];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZH = 'zh-CN';
const MAX_READ = 20000;
const BUNDLED_LIB = path.join(HERE, 'library');
const DEFAULT_OUT = process.env.WEBFORGE_OUT || path.join(os.homedir(), 'webforge', '网站');

/* ------------------------------------------------------------------ 定位源库 */
function profileLibraries() {
  const root = path.join(os.homedir(), '.dsh', 'profiles');
  const out = [];
  try {
    for (const name of fs.readdirSync(root)) out.push(path.join(root, name, 'node_modules', 'eac-design-world'));
  } catch { /* 没有 profiles 目录就跳过 */ }
  return out;
}

function findLibrary() {
  const cands = [
    process.env.WEBFORGE_LIB,
    path.join(HERE, '..', 'eac-design-world'),
    ...profileLibraries(),
    'D:\\Deepseek\\resources\\app.asar\\node_modules\\eac-design-world',
    BUNDLED_LIB,
  ].filter(Boolean);
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'vendor', 'open-design', 'catalog.json'))) return c;
  }
  return null;
}

const LIB = findLibrary();
const abs = (rel) => path.join(LIB, rel);
const exists = (rel) => Boolean(rel) && fs.existsSync(abs(rel));

/* ------------------------------------------------------------------ 小工具 */
const textOf = (v, fallback = '') => {
  if (!v) return fallback;
  if (typeof v === 'string') return v;
  return v[ZH] || v.en || Object.values(v).find((x) => typeof x === 'string') || fallback;
};
const colorOf = (hex) => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const lum = (hex) => {
  const c = colorOf(hex);
  return c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 : null;
};
const chroma = (hex) => {
  const c = colorOf(hex);
  return c ? (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255 : 0;
};
const toLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const relLum = (hex) => {
  const c = colorOf(hex);
  return c ? 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b) : null;
};
const contrast = (a, b) => {
  const l1 = relLum(a);
  const l2 = relLum(b);
  if (l1 == null || l2 == null) return 1;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
};
const escHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const safeName = (s) => {
  const t = String(s || '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return t || 'page';
};

/* ------------------------------------------------------------------ 建索引 */
/* 视频生产类技能不进网页库：它们交付的是片子或视频模板，不是网页。
   animate（UI 动效）与 oil-motion（滚动/指针/拖动驱动的网页动效）保留；
   fal-generate 也保留——它同时能出图，图像是网页素材。 */
const VIDEO_SKILLS = new Set([
  'od-sk-8-bit-orbit-video-template',
  'od-sk-after-hours-editorial-template',
  'od-sk-chat-motion-overlay',
  'od-sk-fal-kling-o3',
  'od-sk-fal-lip-sync',
  'od-sk-fal-video-edit',
  'od-sk-motion-design',
  'od-sk-sora',
  'od-sk-swiss-user-research-video-template',
  'od-sk-venice-video',
  'od-sk-video-downloader',
  'od-sk-video-hyperframes',
  'od-sk-weread-year-in-review-video-template',
  'od-sk-youtube-clipper',
  'od-sk-remotion',
  'od-sk-huashu-art-motion',
]);

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  if (!LIB) throw new Error('找不到设计库：内置起步库缺失，且没有在本机找到完整库。修复任选一条——① 检查包内 library/vendor/open-design/catalog.json 是否被删除；② 把 WEBFORGE_LIB 指向含 vendor/open-design/catalog.json 的目录（例如 eac-design-world 包目录）；③ 重新从 GitHub 安装本插件。');
  const raw = JSON.parse(fs.readFileSync(path.join(LIB, 'vendor', 'open-design', 'catalog.json'), 'utf8'));
  const items = [];

  for (const t of raw.templates || []) {
    // 只收网页与 deck。motion 是视频动效模板（79 条 OpenDesign 动效 + 15 条 MG 风格片），
    // 归视频工具；混进来会让人以为这个插件能做片子。
    const isWeb = t.kind === 'website';
    const isDeck = t.kind === 'deck';
    if (!isWeb && !isDeck) continue;
    const entry = t.entry && t.entry.exists ? t.entry : null;
    if (!entry) continue;
    items.push({
      id: t.id,
      kind: isWeb ? 'template' : 'deck',
      zh: textOf(t.titleI18n) || textOf(t.title) || t.slug,
      en: textOf(t.title, t.slug),
      desc: t.description || '',
      tags: (t.tags || []).filter((x) => x && !/^(first-party|untitled)$/.test(x)).slice(0, 8),
      license: t.license || '—',
      runtime: t.runtime || '',
      ready: t.runtime === 'source-ready',
      entryPath: entry ? entry.path : null,
      entryUrl: entry ? entry.url : null,
      rel: t.path || '',
      files: (t.files || []).filter((f) => !/\.(md|json)$/i.test(f)),
      w: t.width || null,
      h: t.height || null,
      dur: t.duration || null,
    });
  }

  for (const d of raw.designSystems || []) {
    const colors = (d.colors || []).filter((c) => typeof c.value === 'string' && /^#|^rgb/.test(c.value));
    const bg = (colors.find((c) => c.name === '--bg') || {}).value;
    items.push({
      id: d.id,
      kind: 'system',
      zh: textOf(d.title) || d.name || d.slug,
      en: d.name || d.slug,
      desc: d.description || '',
      tags: (d.tags || []).slice(0, 8),
      license: d.license || '—',
      runtime: d.runtime || '',
      ready: d.runtime === 'source-ready',
      rel: d.path || '',
      tokensPath: d.tokensCss || null,
      colors: colors.map((c) => ({ name: c.name, value: c.value })),
      fonts: d.fonts?.families || [],
      modeHint: /^#[0-9a-fA-F]{3,6}$/.test(bg || '') && lum(bg) > 0.5 ? 'light' : 'dark',
      files: (d.files || []).slice(0, 30),
    });
  }

  for (const s of raw.skills || []) {
    if (VIDEO_SKILLS.has(s.id)) continue;
    items.push({
      id: s.id,
      kind: 'skill',
      zh: textOf(s.titleI18n) || textOf(s.title) || s.slug,
      en: textOf(s.title, s.slug),
      desc: s.description || '',
      tags: (s.tags || []).slice(0, 6),
      triggers: (s.triggers || []).slice(0, 6),
      license: s.license || '—',
      runtime: s.runtime || '',
      ready: s.runtime === 'source-ready',
      rel: s.path || '',
      files: (s.files || []).slice(0, 12),
    });
  }

  const counts = { template: 0, deck: 0, system: 0, skill: 0 };
  for (const it of items) counts[it.kind]++;
  INDEX = { items, counts, builtAt: new Date().toISOString(), lib: LIB };
  return INDEX;
}

/* 数 deck 有多少页：先去掉注释、<style>、<script>，再数真正的 <section> 标签——
   注释或样式里提到 <section> 不算一页，否则页数会虚高、导出告警误报。 */
const countSlides = (html) => String(html)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .match(/<section\b/gi)?.length || 0;

const brief = (it) => ({
  id: it.id,
  kind: it.kind,
  name: it.zh,
  nameEn: it.en,
  desc: it.desc.slice(0, 200),
  tags: it.tags,
  license: it.license,
  runtime: it.runtime,
  ...(it.kind === 'system' ? { modeHint: it.modeHint, colors: it.colors.slice(0, 4) } : {}),
  ...(it.kind === 'template' ? { size: it.w && it.h ? `${it.w}×${it.h}` : null } : {}),
});

/* 中文需求 → 库里英文描述也认得的词（体系/技能的描述几乎都是英文） */
const SYNONYMS = {
  极简: ['minimal', 'clean', 'swiss', 'simple'],
  编辑感: ['editorial', 'magazine', 'newspaper', 'serif'],
  深色: ['dark', 'night', 'black', 'obsidian'],
  暗色: ['dark', 'night', 'black'],
  亮色: ['light', 'white', 'paper', 'cream'],
  浅色: ['light', 'white', 'paper'],
  科技: ['tech', 'futuristic', 'sci-fi', 'hud'],
  未来: ['futuristic', 'sci-fi', 'hud'],
  复古: ['retro', 'vintage', 'synthwave'],
  赛博: ['neon', 'cyber', 'glitch'],
  温暖: ['warm', 'beige', 'parchment', 'cream'],
  冷静: ['cool', 'muted', 'nordic', 'monochrome'],
  北欧: ['nordic', 'muted', 'monochrome'],
  粗野: ['brutalist', 'contrast', 'bold'],
  强对比: ['contrast', 'bold', 'monolithic'],
  柔和: ['soft', 'rounded', 'gentle'],
  奢华: ['luxury', 'elegant', 'premium'],
  高级: ['luxury', 'elegant', 'premium', 'refined'],
  商务: ['business', 'corporate', 'enterprise'],
  可爱: ['playful', 'cute', 'candy'],
  插画: ['illustration', 'illustrated'],
  看板: ['dashboard', 'analytics', 'admin'],
  落地页: ['landing', 'marketing', 'promo'],
  文档: ['docs', 'documentation', 'guide'],
  定价: ['pricing', 'plan'],
  个人: ['personal', 'portfolio', 'profile'],
  作品集: ['portfolio', 'showcase', 'gallery'],
};

function expand(token) {
  const out = new Set();
  for (const [k, list] of Object.entries(SYNONYMS)) {
    if (token.includes(k) || k.includes(token)) for (const x of list) out.add(x);
  }
  return [...out];
}

/* ------------------------------------------------------------------ 搜索 */
function search({ query = '', kind = 'all', limit = 12, readyOnly = false }) {
  const idx = index();
  const q = String(query || '').trim().toLowerCase();
  const tokens = q ? [...new Set([q, ...q.split(/[\s,，、/]+/).filter(Boolean)])] : [];
  const n = Math.min(40, Math.max(1, Math.floor(Number(limit) || 12)));

  let pool = idx.items.filter((it) => kind === 'all' || it.kind === kind);
  if (readyOnly) pool = pool.filter((it) => it.ready);

  const wantsDark = /深色|暗色|dark|黑色/.test(q);
  const wantsLight = /亮色|浅色|light|白色/.test(q);

  let hits;
  if (!tokens.length) {
    const order = { template: 0, deck: 1, system: 2, skill: 3 };
    hits = pool
      .map((it) => ({ it, s: (it.ready ? 2 : 0) - order[it.kind] * 0.1 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, n);
  } else {
    hits = pool
      .map((it) => {
        const hay = `${it.zh} ${it.en} ${it.desc} ${(it.tags || []).join(' ')} ${(it.triggers || []).join(' ')}`.toLowerCase();
        let s = 0;
        for (const t of tokens) {
          if (it.id.toLowerCase() === t) s += 10;
          else if (it.id.toLowerCase().includes(t)) s += 3;
          if (it.zh.toLowerCase().includes(t) || it.en.toLowerCase().includes(t)) s += 4;
          else if (hay.includes(t)) s += 1.5;
          for (const e of expand(t)) if (hay.includes(e)) s += 0.8;
        }
        if (it.kind === 'system') {
          if (wantsDark && it.modeHint === 'dark') s += 3;
          if (wantsLight && it.modeHint === 'light') s += 3;
        }
        if (!s) s = -1;
        if (it.ready) s += 0.5;
        return { it, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, n);
  }

  return {
    query: q,
    kind,
    counts: idx.counts,
    total: hits.length,
    items: hits.map(({ it, s }) => ({ ...brief(it), score: Number(s.toFixed(1)) })),
  };
}

/* ------------------------------------------------------------------ 读取 */
function one(id) {
  const it = index().items.find((x) => x.id === id);
  if (!it) throw new Error(`没有这一条：${id}。先用 webforge_search 查准确 id。`);
  return it;
}

function readPlain(rel, maxChars) {
  if (!rel || !exists(rel)) return null;
  const raw = fs.readFileSync(abs(rel), 'utf8');
  return raw.length > maxChars
    ? { excerpt: raw.slice(0, maxChars), truncated: true, totalChars: raw.length, path: rel }
    : { excerpt: raw, truncated: false, totalChars: raw.length, path: rel };
}

function read({ id, part = 'auto', maxChars = 6000 }) {
  const it = one(id);
  const cap = Math.min(MAX_READ, Math.max(800, Math.floor(Number(maxChars) || 6000)));
  const out = { id: it.id, kind: it.kind, name: it.zh, nameEn: it.en, desc: it.desc, tags: it.tags, license: it.license, runtime: it.runtime };

  if (it.kind === 'template' || it.kind === 'deck') {
    out.sourcePath = it.entryPath;
    out.sourceDir = it.rel;
    out.files = it.files.slice(0, 20);
    if (it.kind === 'deck') {
      const full = exists(it.entryPath) ? fs.readFileSync(abs(it.entryPath), 'utf8') : '';
      out.slides = countSlides(full);
      out.printReady = /@media\s+print/i.test(full);
    }
    if (part === 'auto' || part === 'html') out.html = readPlain(it.entryPath, cap);
    return out;
  }

  if (it.kind === 'system') {
    out.modeHint = it.modeHint;
    out.colors = it.colors;
    out.fonts = it.fonts.slice(0, 6);
    out.sourceDir = it.rel;
    if (part === 'auto' || part === 'tokens') out.tokens = readPlain(it.tokensPath, cap);
    if (part === 'auto' || part === 'design') out.design = readPlain((it.rel || '') + '/DESIGN.md', cap);
    return out;
  }

  // skill
  const md = (it.files || []).find((f) => /SKILL\.md$/i.test(f)) || (it.files || []).find((f) => /\.md$/i.test(f));
  out.triggers = it.triggers;
  out.sourceDir = it.rel;
  if (md) out.skill = readPlain(md, cap);
  return out;
}

/* ------------------------------------------------------------------ 拼初稿 */
function collectColors(html, re) {
  const m = new Map();
  const r = new RegExp(re.source, 'gi');
  let x;
  while ((x = r.exec(html))) {
    const h = x[1].toLowerCase();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(h)) continue;
    m.set(h, (m.get(h) || 0) + 1);
  }
  return [...m.entries()]
    .map(([hex, n]) => ({ hex, n, l: lum(hex), c: chroma(hex) }))
    .filter((x) => x.l !== null)
    .sort((a, b) => b.n - a.n);
}

function pickRoles(html) {
  const HEX = /(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))/;
  const neutralFirst = (list) => {
    const n = list.filter((x) => x.c < 0.12);
    return n.length ? n : list;
  };
  const bgs = neutralFirst(collectColors(html, new RegExp('background(?:-color)?\\s*:[^;{}]*?' + HEX.source, 'i')));
  const fgs = neutralFirst(collectColors(html, new RegExp('(?:^|[;{\\s])color\\s*:\\s*' + HEX.source, 'i')));
  const all = collectColors(html, new RegExp(HEX.source, 'i'));
  const bg = bgs[0] || null;
  let fg = null;
  if (fgs.length) fg = bg ? [...fgs].sort((a, b) => contrast(b.hex, bg.hex) - contrast(a.hex, bg.hex))[0] : fgs[0];
  const accent = all.filter((x) => x.c >= 0.1)[0] || null;
  return bg || fg || accent ? { bg, fg, accent } : null;
}

function systemRole(system, roleName) {
  const hit = (system.colors || []).find((c) => c.name === roleName && /^#[0-9a-fA-F]{3,6}$/.test(c.value));
  if (hit) return hit.value;
  const hexes = (system.colors || []).filter((c) => /^#[0-9a-fA-F]{3,6}$/.test(c.value));
  if (!hexes.length) return null;
  if (roleName === '--bg') return [...hexes].sort((a, b) => lum(a.value) - lum(b.value))[0].value;
  if (roleName === '--fg') return [...hexes].sort((a, b) => lum(b.value) - lum(a.value))[0].value;
  return [...hexes].sort((a, b) => chroma(b.value) - chroma(a.value))[0].value;
}

function build({ template, system = null, title = '', pitch = '', brand = '', lang = 'zh-CN', remap = true, outDir = DEFAULT_OUT }) {
  const tpl = one(template);
  if (tpl.kind !== 'template') throw new Error(`${template} 不是网站模板（kind=${tpl.kind}），不能拼初稿。`);
  if (!tpl.entryPath) throw new Error('该模板没有可读入口 HTML。');
  const sys = system ? one(system) : null;
  if (sys && sys.kind !== 'system') throw new Error(`${system} 不是设计体系（kind=${sys.kind}）。`);

  let html = fs.readFileSync(abs(tpl.entryPath), 'utf8');
  const base = html;
  const patches = [];
  const colorMap = [];

  if (/<html\b[^>]*\blang="[^"]*"/i.test(html)) {
    html = html.replace(/(<html\b[^>]*\blang=")[^"]*(")/i, `$1${escAttr(lang)}$2`);
    patches.push(`<html lang> → ${lang}`);
  }

  const t = String(title || '').trim();
  if (t) {
    const safe = escHtml(t);
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
      patches.push('<title> 已替换');
    }
    const h1 = /(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/i.exec(html);
    if (h1) {
      if (/<[a-z]/i.test(h1[2])) patches.push('首个 <h1> 含子元素，保持原样');
      else {
        html = html.replace(h1[0], h1[1] + safe + h1[3]);
        patches.push('首个 <h1> 文案已替换');
      }
    }
  }

  const p = String(pitch || '').trim();
  if (p) {
    const tag = `<meta name="description" content="${escAttr(p)}" />`;
    if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, tag);
    else if (/<\/title>/i.test(html)) html = html.replace(/<\/title>/i, `</title>\n${tag}`);
    patches.push('meta description 已写入');
  }

  if (sys) {
    const tokens = sys.tokensPath && exists(sys.tokensPath) ? fs.readFileSync(abs(sys.tokensPath), 'utf8') : '';
    const override = /^#[0-9a-fA-F]{3,6}$/.test(brand || '') ? `  --accent: ${brand};` : '';
    const css = `/* webforge: 注入 ${sys.id} 的 tokens */\n${tokens}\n:root{\n${override}\n}`;
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `<style id="wf-tokens">\n${css}\n</style>\n</head>`);
      patches.push(`设计体系 ${sys.zh} 的 tokens 已注入`);
    }

    if (remap) {
      const roles = pickRoles(base);
      if (!roles) {
        patches.push('配色：模板没用到可识别的色值，未做替换');
      } else {
        const apply = (roleName, role, to) => {
          if (!to || to.toLowerCase() === role.hex) return false;
          const re = new RegExp(role.hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const hit = (html.match(re) || []).length;
          if (!hit) return false;
          html = html.replace(re, to);
          colorMap.push({ role: roleName, from: role.hex, to: to.toLowerCase(), n: hit });
          return true;
        };
        const skip = [];
        const sysBg = systemRole(sys, '--bg');
        const sysFg = systemRole(sys, '--fg');
        const sysAccent = systemRole(sys, '--accent');
        const tplLight = roles.bg ? roles.bg.l > 0.5 : null;
        const sysLight = sysBg ? lum(sysBg) > 0.5 : null;
        let bgNow = null;

        if (roles.bg && sysBg) {
          if (tplLight !== null && sysLight !== null && tplLight !== sysLight) {
            skip.push(`模板是${tplLight ? '亮底' : '暗底'}、体系是${sysLight ? '亮底' : '暗底'}，翻明暗会毁版式，只换强调色`);
          } else if (roles.bg.l > 0.25 && roles.bg.l < 0.75) {
            skip.push('模板主底色是中间调，判断不了往亮还是往暗换');
          } else if (roles.fg && contrast(sysBg, roles.fg.hex) < 4.5) {
            skip.push(`换底色后与正文对比只有 ${contrast(sysBg, roles.fg.hex).toFixed(1)}:1`);
          } else if (apply('--bg', roles.bg, sysBg)) {
            bgNow = sysBg;
          }
        }
        if (roles.fg && sysFg) {
          const ref = bgNow || (roles.bg ? roles.bg.hex : null);
          if (roles.fg.n < 2) skip.push('正文色只出现 1 次，疑似局部反白，不动');
          else if (ref && contrast(sysFg, ref) < 4.5) skip.push(`换正文色后对比只有 ${contrast(sysFg, ref).toFixed(1)}:1`);
          else apply('--fg', roles.fg, sysFg);
        }
        if (roles.accent && sysAccent) {
          if (chroma(sysAccent) < 0.08) skip.push('体系强调色本身是中性色，替换没有意义');
          else apply('--accent', roles.accent, sysAccent);
        }
        if (skip.length) patches.push('配色跳过：' + skip.join('；'));
      }
    }
  }

  const dir = path.join(outDir, `${safeName(title || tpl.zh)}-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });

  let assets = 0;
  const tplDir = abs(tpl.rel);
  for (const f of tpl.files) {
    const from = abs(f);
    if (!from.startsWith(tplDir)) continue;
    if (path.resolve(from) === path.resolve(abs(tpl.entryPath))) continue;
    const to = path.join(dir, path.relative(tplDir, from));
    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      assets++;
    } catch { /* 单个资源失败不阻塞 */ }
  }

  html = html.replace(/<\/head>/i, `<meta name="generator" content="webforge / template=${escAttr(tpl.id)} system=${escAttr(sys ? sys.id : 'none')}" />\n</head>`);
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  fs.writeFileSync(path.join(dir, 'wf-manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    template: { id: tpl.id, name: tpl.zh, source: tpl.rel, license: tpl.license },
    system: sys ? { id: sys.id, name: sys.zh } : null,
    title, pitch, brand, lang, patches, colorMap, assets,
    note: '这是版式 + 体系的初稿：结构沿用模板，只换标题/描述/配色。文案与结构要自己写。',
  }, null, 2), 'utf8');

  return { dir, file, patches, colorMap, assets, template: tpl.id, system: sys ? sys.id : null };
}

/* ------------------------------------------------------------------ 导出 PDF */
const BROWSERS = [
  process.env.WF_BROWSER,
  // Windows
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

const isFile = (p) => {
  try { return fs.existsSync(p); } catch { return false; }
};

function findBrowser() {
  const direct = BROWSERS.find(isFile);
  if (direct) return direct;
  // 上面没命中就叫 PATH 里找一次（Linux 发行版、Windows 用户目录安装、macOS Homebrew 都在这里）
  const names = process.platform === 'win32'
    ? ['msedge.exe', 'chrome.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const n of names) {
      const p = path.join(dir, n);
      if (isFile(p)) return p;
    }
  }
  return null;
}

function countPdfPages(buf) {
  const s = buf.toString('latin1');
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function exportDeck({ id, title = '', outDir = DEFAULT_OUT, width = 1280, height = 720, timeout = 90000 }) {
  const it = one(id);
  if (!it.entryPath) throw new Error('这一条没有入口 HTML，导不出 PDF。');
  if (it.kind !== 'deck' && it.kind !== 'template') throw new Error(`${it.id} 不是页面类素材（kind=${it.kind}）。`);
  const browser = findBrowser();
  if (!browser) throw new Error('没找到 Edge/Chrome，无法无头打印。可用 WF_BROWSER 环境变量指定浏览器路径。');

  const w = Math.max(640, Math.min(3840, Math.floor(Number(width) || 1280)));
  const h = Math.max(360, Math.min(2160, Math.floor(Number(height) || 720)));
  const html = fs.readFileSync(abs(it.entryPath), 'utf8');
  // 注入打印规则：页面尺寸跟着来，去掉 deck 的外边距/间隙，动画在 @media print 里本就被模板关掉
  const printStyle = `<style id="wf-print">@page{size:${w}px ${h}px;margin:0}html,body{margin:0;padding:0}.deck{padding:0!important;gap:0!important}</style>`;
  const patched = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${printStyle}</head>`) : printStyle + html;

  const dir = path.join(outDir, `${safeName(title || it.zh)}-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });
  const deckHtml = path.join(dir, 'deck.html');
  fs.writeFileSync(deckHtml, patched, 'utf8');
  const pdf = path.join(dir, `${safeName(title || it.zh)}.pdf`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-print-'));
  try {
    await execFileAsync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-pdf-header-footer',
      `--user-data-dir=${profile}`,
      `--print-to-pdf=${pdf}`,
      pathToFileURL(deckHtml).href,
    ], { timeout, windowsHide: true });
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* 临时 profile 清不掉不影响产物 */ }
  }

  if (!fs.existsSync(pdf)) throw new Error('浏览器没有产出 PDF（可能是页面加载失败或被安全策略拦住）。');
  const bytes = fs.statSync(pdf).size;
  const pages = countPdfPages(fs.readFileSync(pdf));
  return {
    dir, pdf, deckHtml,
    pages, bytes,
    size: `${w}×${h}`,
    slides: countSlides(patched),
    deck: it.id,
    browser: path.basename(browser),
  };
}

/* ------------------------------------------------------------------ 工具定义 */
const OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      details: { type: 'string' },
    },
    required: ['summary', 'details'],
  },
  render: (_args, value) => [{ type: 'text', text: `${value.summary}\n${value.details}` }],
};

const ok = (summary, payload) => ({ summary, details: JSON.stringify(payload, null, 1) });

const TOOL_SEARCH = {
  name: 'webforge_search',
  description: '搜本地网页素材库。本机装了完整库时是 176 个网站模板（真实 HTML，含 16 个 WebGL/3D 首屏）、77 个 deck（16:9，可导出 PDF）、152 套设计体系（带 tokens.css）、153 个技能；没装完整库时自动用包内起步库（4 模板 / 2 deck / 2 体系 / 2 技能），一样能拼能导出。只收网页与 deck：视频动效模板不在这里。用户说要做网页/官网/落地页/看板/文档页，或要做 PPT/演示稿/汇报时，先用它看清有什么可用的版式与体系，再决定用哪套；返回的 id 供 webforge_read / webforge_build / webforge_export 使用。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: '关键词，中英文都行：dashboard / 看板 / 极简 / webgl / 中文 / 定价页' },
      kind: { type: 'string', enum: ['all', 'template', 'deck', 'system', 'skill'], description: '限定类型：template 网页 / deck 演示稿 / system 体系 / skill 技能，默认 all' },
      limit: { type: 'number', description: '返回条数 1–40，默认 12' },
      readyOnly: { type: 'boolean', description: '只要 source-ready 的条目' },
    },
  },
  output: OUTPUT,
  isConcurrencySafe: () => true,
  async execute(args = {}) {
    const r = search(args);
    return ok(`找到 ${r.total} 条（库：模板 ${r.counts.template} / deck ${r.counts.deck} / 体系 ${r.counts.system} / 技能 ${r.counts.skill}）`, r);
  },
};

const TOOL_READ = {
  name: 'webforge_read',
  description: '读一条素材的正文：模板与 deck 返回入口 HTML 源码与文件清单；设计体系返回 tokens.css、DESIGN.md 与配色字体；技能返回 SKILL.md。写页面前先读，别凭名字猜。源码可能被截断，返回里有完整路径可再用文件工具读。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', description: 'webforge_search 返回的 id' },
      part: { type: 'string', enum: ['auto', 'html', 'tokens', 'design', 'meta'], description: '读哪部分，默认 auto' },
      maxChars: { type: 'number', description: '正文最多返回多少字符，默认 6000，上限 20000' },
    },
    required: ['id'],
  },
  output: OUTPUT,
  isConcurrencySafe: () => true,
  async execute(args = {}) {
    const r = read(args);
    return ok(`已读 ${r.id}（${r.kind}）`, r);
  },
};

const TOOL_BUILD_DESC = '用「模板 + 设计体系 + 内容」拼一份能直接打开的初稿，写到磁盘（默认 ~/webforge/网站/<标题>-<时间>/index.html，可用 outDir 覆盖），复制模板资源，返回改了什么、跳过了什么。只替换标题/描述/首个 h1、注入体系 tokens、做有护栏的保守换色——不写文案、不改结构；真正的成品要在初稿基础上继续写。';

function buildTool(defaultOutDir) {
  return {
    name: 'webforge_build',
    description: TOOL_BUILD_DESC,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        template: { type: 'string', description: '模板 id（kind=template）' },
        system: { type: 'string', description: '设计体系 id（kind=system），可空' },
        title: { type: 'string', description: '页面标题，会写进 <title> 与首个 <h1>' },
        pitch: { type: 'string', description: '一句话描述，写进 meta description' },
        brand: { type: 'string', description: '品牌主色 #RRGGBB，覆盖体系 --accent' },
        lang: { type: 'string', description: '页面语言，默认 zh-CN' },
        remap: { type: 'boolean', description: '是否做保守配色替换，默认 true' },
        outDir: { type: 'string', description: '输出根目录，默认取插件配置里的 outDir' },
      },
      required: ['template'],
    },
    output: OUTPUT,
    async execute(args = {}) {
      const r = build({ ...args, outDir: args.outDir || defaultOutDir });
      return ok(`初稿已生成：${r.file}`, r);
    },
  };
}

function exportTool(defaultOutDir) {
  return {
    name: 'webforge_export',
    description: '把 deck 演示稿（或任何带入口 HTML 的页面）按指定尺寸打成 PDF：注入 @page 尺寸与打印规则，用本机 Edge/Chrome 无头打印，返回页数、体积、文件路径。默认 1280×720（16:9）。用于交付给人看的演示稿。注意：HTML→PPTX 没有无损转换，要可编辑 pptx 只能用 python-pptx 重建。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'deck / template 的 id' },
        title: { type: 'string', description: '输出文件名与目录名用，不传就用素材名' },
        width: { type: 'number', description: '页面宽（px），默认 1280' },
        height: { type: 'number', description: '页面高（px），默认 720' },
        outDir: { type: 'string', description: '输出根目录，默认取插件配置里的 outDir' },
      },
      required: ['id'],
    },
    output: OUTPUT,
    async execute(args = {}) {
      const r = await exportDeck({ ...args, outDir: args.outDir || defaultOutDir });
      const kb = Math.round(r.bytes / 1024);
      const warn = r.pages && r.slides && r.pages !== r.slides
        ? `（注意：${r.slides} 个 section 打成了 ${r.pages} 页，检查是否有多余空白页）`
        : '';
      return ok(`PDF 已生成：${r.pdf}（${r.pages} 页 / ${kb} KB / ${r.size}）${warn}`, r);
    },
  };
}

const PROMPT = `## 网页制作（webforge）

本地有一套可直接用的网页素材库。装了完整库时：176 个网站模板（真实 HTML，含 16 个 WebGL/3D 首屏）、77 个 deck（16:9、自带页码与打印 CSS）、152 套设计体系（每套带 tokens.css 与字体栈）、153 个技能；没装时自动落到包内起步库（4 模板 / 2 deck / 2 体系 / 2 技能），流程一样跑得通。只收网页与 deck，视频动效素材不在这里（要视频请用视频工具）。

用户说「做个网页 / 官网 / 落地页 / 产品页 / 看板 / 文档页 / 个人主页」时，先搜库，别从零凭空写：

1. \`webforge_search\` 看清版式与体系（按用途、行业、气质、3D/WebGL 搜），挑 1 个模板 + 1 套体系；
2. \`webforge_read\` 读这套的 tokens 与模板 HTML，确认结构、配色变量、字体真的能对上；
3. \`webforge_build\` 拼出初稿到磁盘（只换标题/描述/配色，不写文案）；
4. 在初稿上继续写：换真实文案、补结构、做响应式，再按工作区里的网页设计规范（若有 design-rules/WEB-DESIGN-RULES.md）过一遍 page 剖面，floor 清零。

用户说「做个 PPT / 演示稿 / 汇报 / 路演 / 董事会预读」时，走 deck 这条线：

1. \`webforge_search\` 传 kind: "deck" 挑版式（完整库 77 个，起步库 2 个；决策型 deck 居多）；
2. \`webforge_read\` 先看 slides（几页）与 printReady，再读 HTML，按页替换文案；
3. \`webforge_export\` 打 16:9 PDF（默认 1280×720），返回页数与体积；页数应等于 section 数，不等就要查断页。

**PPTX 不能无损转**：PowerPoint 的文本框/表格语义在 HTML deck 里不存在，要可编辑 pptx 只能拿 deck 当版式参考、用 python-pptx 逐页重建。别跟用户承诺「一键转 PPT」。

诚实边界：\`webforge_build\` 产出的是「版式 + 体系的初稿」，不是成品；模板自带的示例数据仍在，文案必须自己重写；配色替换是启发式的，界面会列出替换与跳过项，别把跳过说成成功。`;

/* ------------------------------------------------------------------ 插件入口 */
export function apply(ctx, config = {}) {
  const outDir = config.outDir || DEFAULT_OUT;
  const tools = [TOOL_SEARCH, TOOL_READ, buildTool(outDir), exportTool(outDir)];

  for (const tool of tools) {
    ctx.effect(() => ctx.tools.register(tool));
  }
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'webforge:web-production',
    order: 8600,
    interpolate: false,
    text: `${PROMPT}\n\n默认输出目录：${outDir}`,
  }));
}

export default { name, version, inject, apply };
