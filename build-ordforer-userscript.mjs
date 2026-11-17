// Builds the Tampermonkey script for the mayor election: bot.js + ordforer.js (globals moved onto a
// private BOT object) + ordforer.user.tpl.js. Usage: node build-ordforer-userscript.mjs [out]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || `${process.env.HOME}/lopegutten-ordforer.user.js`;
const src = f => readFileSync(join(ROOT, f), 'utf8').replaceAll('globalThis.', 'BOT.');
let tpl = readFileSync(join(ROOT, 'ordforer.user.tpl.js'), 'utf8');
for (const [mark, f] of [["/*BOTJS*/''", 'bot.js'], ["/*ORDJS*/''", 'ordforer.js']]) {
  if (!tpl.includes(mark)) throw new Error('template marker missing: ' + mark);
  tpl = tpl.replace(mark, () => JSON.stringify(src(f)));
}
writeFileSync(out, tpl);
console.log('wrote', out);
