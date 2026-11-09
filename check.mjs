// 自检：用假的 ctx 跑一遍四个工具，确认插件能注册、能搜、能读、能拼、能导。
// 用法：
//   node tools/check.mjs                  # 用本机完整库（eac-design-world 或 WEBFORGE_LIB）
//   node tools/check.mjs --bundled        # 用包内起步库，CI 与干净环境用这个
//   node tools/check.mjs --no-export      # 跳过 PDF 导出（没有 Edge/Chrome 的机器）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = new Set(process.argv.slice(2));
const useBundled = argv.has('--bundled');
const skipExport = argv.has('--no-export') || process.env.WF_NO_EXPORT === '1';

// 必须在 import 之前设好：plugin.mjs 在模块加载时就要定位库
if (useBundled) process.env.WEBFORGE_LIB = path.join(HERE, '..', 'library');
const plugin = await import('../plugin.mjs');

const registered = [];
const sections = [];
const ctx = {
  effect: (fn) => fn(),
  tools: { register: (tool) => { registered.push(tool); return () => {}; } },
  systemPrompt: { section: (s) => { sections.push(s); return () => {}; } },
};

assert.equal(plugin.name, 'webforge');
assert.ok(plugin.inject.includes('tools'), 'inject 里要有 tools');
plugin.apply(ctx, { outDir: path.join(os.tmpdir(), 'wf-check') });

assert.equal(registered.length, 4, '应该注册 4 个工具');
assert.equal(sections.length, 1, '应该注入 1 段系统提示');
const byName = Object.fromEntries(registered.map((t) => [t.name, t]));
for (const n of ['webforge_search', 'webforge_read', 'webforge_build', 'webforge_export']) {
  assert.ok(byName[n], '缺工具 ' + n);
}

/* ---- 搜索 ---- */
const search = await byName.webforge_search.execute({ query: '看板 dashboard', kind: 'template', limit: 5 });
const found = JSON.parse(search.details);
console.log('[search]', search.summary);
assert.ok(found.items.length > 0, '应该能搜到模板');
console.log('  top:', found.items.map((i) => i.id).join(', '));

/* ---- 体系 ---- */
const sysRes = await byName.webforge_search.execute({ query: '极简 深色', kind: 'system', limit: 3 });
const sysList = JSON.parse(sysRes.details).items;
assert.ok(sysList.length > 0, '应该能搜到设计体系');
console.log('[system]', sysList.map((s) => `${s.id}(${s.modeHint})`).join(', '));

const readRes = await byName.webforge_read.execute({ id: sysList[0].id, maxChars: 400 });
const readBody = JSON.parse(readRes.details);
assert.ok(readBody.tokens && readBody.tokens.excerpt.includes('--'), '体系应该读到 tokens.css');
console.log('[read]', readRes.summary, '· tokens', readBody.tokens.totalChars, 'chars');

/* ---- 技能 ---- */
const skillRes = await byName.webforge_search.execute({ kind: 'skill', limit: 3 });
const skills = JSON.parse(skillRes.details).items;
assert.ok(skills.length > 0, '应该能搜到技能');
const skillBody = JSON.parse((await byName.webforge_read.execute({ id: skills[0].id, maxChars: 300 })).details);
assert.ok(skillBody.skill && skillBody.skill.excerpt.length > 20, '技能应该读到 SKILL.md');
console.log('[skill]', skills[0].id, '·', skillBody.skill.totalChars, 'chars');

/* ---- 拼初稿 ---- */
const tplId = found.items[0].id;
const build = await byName.webforge_build.execute({
  template: tplId,
  system: sysList[0].id,
  title: '自检页面',
  pitch: '这是一次自检。',
  brand: '#2f6feb',
});
const built = JSON.parse(build.details);
assert.ok(fs.existsSync(built.file), '初稿应该真的落盘');
const html = fs.readFileSync(built.file, 'utf8');
assert.ok(html.includes('wf-tokens'), '初稿应该注入 tokens');
assert.ok(html.includes('自检页面'), '初稿应该写入标题');
assert.ok(built.file.startsWith(path.join(os.tmpdir(), 'wf-check')), '产物应该落在指定的 outDir');
console.log('[build]', build.summary);
console.log('  patches:', built.patches.join(' | '));
console.log('  colorMap:', built.colorMap.map((c) => `${c.role} ${c.from}→${c.to}×${c.n}`).join(', ') || '无');
fs.rmSync(built.dir, { recursive: true, force: true });

/* ---- deck ---- */
const deckRes = await byName.webforge_search.execute({ query: '董事会 预读 deck', kind: 'deck', limit: 3 });
const decks = JSON.parse(deckRes.details).items;
assert.ok(decks.length > 0, '应该能搜到 deck');
const deckRead = JSON.parse((await byName.webforge_read.execute({ id: decks[0].id, part: 'meta' })).details);
assert.ok(deckRead.slides > 0, 'deck 应该有 section');
assert.equal(deckRead.printReady, true, 'deck 应该带打印 CSS');
console.log(`[deck] ${decks[0].id} · ${deckRead.slides} 页 · printReady=${deckRead.printReady}`);

/* ---- 导出 ---- */
if (skipExport) {
  console.log('[export] 已跳过（--no-export）');
} else {
  try {
    const exp = await byName.webforge_export.execute({ id: decks[0].id, title: '自检演示稿', width: 1280, height: 720 });
    const pdf = JSON.parse(exp.details);
    assert.ok(fs.existsSync(pdf.pdf), 'PDF 应该真的存在');
    assert.ok(pdf.pages > 0, 'PDF 应该有页');
    assert.equal(pdf.pages, pdf.slides, `页数应等于 section 数（${pdf.pages} vs ${pdf.slides}）`);
    console.log('[export]', exp.summary);
    console.log('  slides', pdf.slides, '· pages', pdf.pages, '· bytes', pdf.bytes, '·', pdf.browser);
    fs.rmSync(pdf.dir, { recursive: true, force: true });
  } catch (err) {
    if (/没找到 Edge\/Chrome|WF_BROWSER/.test(String(err.message))) {
      console.log('[export] 跳过：本机没有 Edge/Chrome，可用 WF_BROWSER 指定，或加 --no-export');
    } else {
      throw err;
    }
  }
}

console.log(`\n全部通过（库：${useBundled ? '包内起步库' : '本机完整库'}）。`);
