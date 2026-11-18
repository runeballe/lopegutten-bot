// Builds the Onkel-boten Tampermonkey script from bot.js + bergen.js + tromso.js + extra.js + sjef.user.tpl.js.
// Usage: node build-sjef-userscript.mjs [out]   (default ~/lopegutten-sjef.user.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || `${process.env.HOME}/lopegutten-sjef.user.js`;
// The layers write helpers to globalThis; in the page that would clobber game globals, so they go on BOT instead.
// Each file gets its own block (their top-level consts clash), and top-level function declarations become
// BOT properties, so later layers that override e.g. BOT.handle are seen by bot.js's own calls.
const layer = f => readFileSync(join(ROOT, f), 'utf8').replaceAll('globalThis.', 'BOT.')
  .replace(/^(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm, (m, a, n) => `;BOT.${n} = ${a || ''}function ${n}(`);
const src = ['bot.js', 'bergen.js', 'tromso.js', 'extra.js'].map(f => `// ---- ${f} ----\n{\n${layer(f)}\n}`).join('\n');
const tpl = readFileSync(join(ROOT, 'sjef.user.tpl.js'), 'utf8');
if (!tpl.includes("/*SRC*/''")) throw new Error('template marker missing');
writeFileSync(out, tpl.replace("/*SRC*/''", () => JSON.stringify(src)));
console.log('wrote', out);
