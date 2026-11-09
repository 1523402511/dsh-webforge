// 严格校验工具 schema：抓出 provider 会拒收的写法（required 必须是数组、且键必须存在）
// 用法：node tools/validate.mjs
import * as plugin from '../plugin.mjs';

const registered = [];
const ctx = {
  effect: (fn) => fn(),
  tools: { register: (t) => { registered.push(t); return () => {}; } },
  systemPrompt: { section: () => () => {} },
};
plugin.apply(ctx, { outDir: process.cwd() });

const problems = [];
const KNOWN_TYPES = new Set(['object', 'string', 'number', 'integer', 'boolean', 'array', 'null']);

function walk(node, path, where) {
  if (node === null || typeof node !== 'object') {
    problems.push(`${where} ${path}: 不是对象`);
    return;
  }
  if (Array.isArray(node)) {
    problems.push(`${where} ${path}: 不应该直接是数组`);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    const here = `${path}.${k}`;
    if (k === 'required') {
      if (!Array.isArray(v)) problems.push(`${where} ${here}: required 必须是数组，现在是 ${JSON.stringify(v)}`);
      else if (v.some((x) => typeof x !== 'string')) problems.push(`${where} ${here}: required 里必须全是字符串`);
      continue;
    }
    if (k === 'type') {
      const list = Array.isArray(v) ? v : [v];
      for (const t of list) if (!KNOWN_TYPES.has(t)) problems.push(`${where} ${here}: 未知 type ${JSON.stringify(t)}`);
      continue;
    }
    if (k === 'parameters' || k === 'output') continue;
    if (k === 'properties') {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) { problems.push(`${where} ${here}: properties 必须是对象`); continue; }
      for (const [pk, pv] of Object.entries(v)) walk(pv, `${here}.${pk}`, where);
      continue;
    }
    if (k === 'items') { walk(v, here, where); continue; }
    if (k === 'additionalProperties') {
      if (typeof v !== 'boolean' && (v === null || typeof v !== 'object')) problems.push(`${where} ${here}: 必须是布尔或对象`);
      else if (typeof v === 'object') walk(v, here, where);
      continue;
    }
    if (k === 'enum') { if (!Array.isArray(v)) problems.push(`${where} ${here}: enum 必须是数组`); continue; }
    if (typeof v === 'object' && v !== null) walk(v, here, where);
  }
}

for (const tool of registered) {
  const where = tool.name;
  if (!tool.parameters || tool.parameters.type !== 'object') problems.push(`${where}: parameters 必须是 type:"object"`);
  walk(tool.parameters || {}, 'parameters', where);

  // required 的键必须真的在 properties 里
  const req = tool.parameters?.required || [];
  const props = Object.keys(tool.parameters?.properties || {});
  for (const r of req) if (!props.includes(r)) problems.push(`${where}: required 里的 "${r}" 不在 properties 中`);

  if (tool.output?.schema) walk(tool.output.schema, 'output.schema', where);
}

console.log(`工具数 ${registered.length}：${registered.map((t) => t.name).join(', ')}`);
if (problems.length) {
  console.log('\n发现 ' + problems.length + ' 个问题：');
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log('\nSchema 校验通过。');
