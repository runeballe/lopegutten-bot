// Trygg runde: én figur til Gudfar (uten kasino), deretter videre til 31.12.1999 så familien får en GF-gren.
//   node trygg.mjs [minutter]
// Gjenopptar lagret figur med prefikset (LG_PREFIX, standard «Trygg») hvis den ikke er over.
import puppeteer from 'puppeteer-core';
import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.LG_PROFILE || '/home/rune/.local/share/lopegutten-bot/chrome';
const FAM = process.env.LG_FAM_TRYGG || 'Sæther';
const PREFIX = process.env.LG_PREFIX || 'Trygg';
const LOGF = process.env.LG_LOG || '/home/rune/.local/share/lopegutten-bot/gudfar/trygg.log';
const minutes = Number(process.argv[2] || 600);
mkdirSync(dirname(LOGF), { recursive: true });
const say = (...a) => {
  const line = new Date().toISOString().slice(11, 19) + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  process.stdout.write(line + '\n'); appendFileSync(LOGF, line + '\n');
};
console.log = say;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 600000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
} catch (e) { console.error('FEIL: får ikke startet Chromium på profilen (kjører en annen bot/Chromium?):', String(e).slice(0, 300)); process.exit(1) }
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', err => say('PAGEERR', String(err).slice(0, 200)));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
try {
  await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined' && typeof kbList === 'function', { timeout: 120000 });
} catch (e) { console.error('FEIL: spillet lastet ikke:', String(e).slice(0, 300)); await browser.close(); process.exit(1) }
await sleep(3000);
if (!await page.evaluate(() => !!store.get('cardCode', ''))) { await browser.close(); console.error('FEIL: profilen er ikke koblet til spillerkort'); process.exit(1) }
// lukk oppstartsdialoger
for (let n = 0; n < 6; n++) {
  const c = await page.evaluate(() => { const v = document.querySelector('#veil'); if (!v || v.hidden) return null; const b = [...document.querySelectorAll('#slip footer button')].filter(b => !b.disabled); const x = b.find(b => /SENERE|LUKK|OK|FORTSETT/i.test(b.innerText)) || b[0]; if (x) { x.click(); return x.innerText } return 'none' });
  if (!c) break; await sleep(1000);
}

const tab = {
  evaluate: (fn, arg) => page.evaluate(fn, arg),
  select: (sel, value) => page.select(sel, value),
  fill: async (sel) => { await page.$eval(sel, el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })) }) },
  type: (sel, text) => page.type(sel, text, { delay: 15 }),
};
globalThis.browser = { tab: () => tab };
globalThis.print = (...a) => say(...a);
globalThis.tab = tab;
(0, eval)(readFileSync(join(ROOT, 'bot.js'), 'utf8'));
globalThis.COAST = false;

const snap = () => page.evaluate(() => S ? { nick: S.dyn && S.dyn.nick, day: S.day, rank: S.rankIdx, money: Math.round(S.money), nw: Math.round(netWorth()), gf: S.gfDay != null, gfDay: S.gfDay, over: !!S.over, year: dayDate(S.day).getFullYear() } : null);

// gjenoppta eller start ny figur
let nick;
const r = await page.evaluate((pre) => {
  const d = loadSave(); const Sx = d && d.S;
  if (!Sx || Sx.over || !(Sx.dyn && String(Sx.dyn.nick || '').startsWith(pre))) return { ok: false, nick: Sx && Sx.dyn && Sx.dyn.nick };
  if (!document.querySelector('#title').hidden) resumeGame(); return { ok: true, nick: Sx.dyn.nick, day: Sx.day };
}, PREFIX);
say('RESUME', r);
if (r.ok) nick = r.nick;
else {
  const n = await page.evaluate((fam) => { const f = dynStore().fams[fam]; const used = f ? Object.values(f.b).map(b => b.f) : []; for (let i = 1; i <= 10; i++) if (!used.includes(i)) return i; return 1 }, FAM);
  nick = PREFIX + Date.now().toString(36).slice(-3);
  const started = await globalThis.startFig(nick, n, FAM);
  say('STARTED', started);
  if (!started || !started.dyn || started.dyn.nick !== nick) { console.error('FEIL: ny figur startet ikke'); await browser.close(); process.exit(1) }
}

const stopAt = Date.now() + minutes * 60000;
let end = 'tid';
// hjerteslag hvert minutt (egen timeout, så et hengt vindu synes i loggen)
setInterval(async () => { const t = await Promise.race([snap().catch(e => 'ERR ' + String(e).slice(0, 80)), sleep(20000).then(() => 'HENGT')]); say('HB', t) }, 60000);
while (Date.now() < stopAt) {
  let s = await snap();
  globalThis.COAST = !!(s && s.gf);
  const why = await globalThis.driver(Math.min(stopAt - Date.now(), 4 * 60000));
  await page.evaluate(() => { try { if (S && !S.over) saveGame() } catch (e) {} });
  s = await snap();
  globalThis.COAST = !!(s && s.gf);
  const br = await globalThis.branches();
  say('TICK', { why, day: s && s.day, year: s && s.year, rank: s && s.rank, money: s && s.money, nw: s && s.nw, godfather: s && s.gf, gfDay: s && s.gfDay, branches: br });
  const gfBranch = br.some(b => /:GF$/.test(b));
  if (why === 'decide' || why === 'stuck') { say('DIALOG', await globalThis.info2()); end = why; break }
  if (why === 'done' || (s && s.over) || (s && s.year >= 2000)) { end = (s && s.over) ? 'over' : 'ferdig'; if (gfBranch || !(s && s.over)) await sleep(3000); say('SLUTT', { s, branches: await globalThis.branches() }); break }
}
say('END', end);
await browser.close();
