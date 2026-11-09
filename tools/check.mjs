// 自检：用假的 ctx 跑一遍三个工具，确认插件能注册、能搜、能读、能拼。
// 用法：node tools/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import * as plugin from '../plugin.mjs';

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

const search = await byName.webforge_search.execute({ query: '看板 dashboard', kind: 'template', limit: 5 });
console.log('[search]', search.summary);
const found = JSON.parse(search.details);
console.log('  top:', found.items.map((i) => i.id).join(', '));

const sysRes = await byName.webforge_search.execute({ query: '极简 深色', kind: 'system', limit: 3 });
const sysList = JSON.parse(sysRes.details).items;
console.log('[system]', sysList.map((s) => `${s.id}(${s.modeHint})`).join(', '));

const readRes = await byName.webforge_read.execute({ id: sysList[0].id, maxChars: 400 });
const readBody = JSON.parse(readRes.details);
assert.ok(readBody.tokens && readBody.tokens.excerpt.includes('--'), '体系应该读到 tokens.css');
console.log('[read]', readRes.summary, '· tokens', readBody.tokens.totalChars, 'chars');

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
console.log('[build]', build.summary);
console.log('  patches:', built.patches.join(' | '));
console.log('  colorMap:', built.colorMap.map((c) => `${c.role} ${c.from}→${c.to}×${c.n}`).join(', ') || '无');

fs.rmSync(built.dir, { recursive: true, force: true });

// deck：搜 → 读页数 → 打 PDF
const deckRes = await byName.webforge_search.execute({ query: '董事会 预读 deck', kind: 'deck', limit: 3 });
const decks = JSON.parse(deckRes.details).items;
assert.ok(decks.length > 0, '应该能搜到 deck');
const deckRead = JSON.parse((await byName.webforge_read.execute({ id: decks[0].id, part: 'meta' })).details);
console.log(`[deck] ${decks[0].id} · ${deckRead.slides} 页 · printReady=${deckRead.printReady}`);

const exp = await byName.webforge_export.execute({ id: decks[0].id, title: '自检演示稿', width: 1280, height: 720 });
const pdf = JSON.parse(exp.details);
assert.ok(fs.existsSync(pdf.pdf), 'PDF 应该真的存在');
assert.ok(pdf.pages > 0, 'PDF 应该有页');
console.log('[export]', exp.summary);
console.log('  slides', pdf.slides, '· pages', pdf.pages, '· bytes', pdf.bytes);
fs.rmSync(pdf.dir, { recursive: true, force: true });

console.log('\n全部通过。');
