// Builds the Tampermonkey script: bot.js (its globals moved onto a private BOT object) + gjeng.user.tpl.js.
// Usage: node build-userscript.mjs [out]   (default ~/lopegutten-gjeng.user.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || `${process.env.HOME}/lopegutten-gjeng.user.js`;
// bot.js writes helpers to globalThis; in the page that would clobber game globals, so they go on BOT instead.
const bot = readFileSync(join(ROOT, 'bot.js'), 'utf8').replaceAll('globalThis.', 'BOT.');
const tpl = readFileSync(join(ROOT, 'gjeng.user.tpl.js'), 'utf8');
if (!tpl.includes("/*BOTJS*/''")) throw new Error('template marker missing');
// Card codes live outside the repo so they never land in git.
let cards = '[]'; try { cards = JSON.stringify(JSON.parse(readFileSync(`${process.env.HOME}/.config/lopegutten-bot/userscript-cards.json`, 'utf8'))) } catch (_) {}
writeFileSync(out, tpl.replace("/*BOTJS*/''", () => JSON.stringify(bot)).replace('/*CARDS*/[]', () => cards));
console.log('wrote', out);
