// PENGER for hovedkortet: fortsetter normal-spillet, trader til time-slutt.
// Usage: node penger.mjs [minutter]   (default 60)
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.LG_PROFILE || '/home/rune/.local/share/lopegutten-bot/chrome';
const CODE = process.env.LG_CARD || '';
const MIN = Number(process.argv[2] || 60);
const tag = (CODE || 'HUV').slice(0, 4);
const say = (...a) => process.stdout.write(`[${tag}] ` + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
console.log = say;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', err => say('PAGEERR', String(err).slice(0, 200)));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined' && typeof skyPull === 'function', { timeout: 120000 });
const shim = { evaluate: (fn, a) => page.evaluate(fn, a), select: (s, v) => page.select(s, v),
  fill: async sel => { await page.$eval(sel, el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })) }) },
  type: (sel, text) => page.type(sel, text, { delay: 15 }) };
globalThis.browser = { tab: () => shim };
globalThis.print = () => {};
(0, eval)(readFileSync(join(ROOT, 'bot.js'), 'utf8'));
globalThis.COAST = false;
globalThis.LAYLOW_AT = 50;
const { info2, handle, fallback } = globalThis;
async function settle(max = 40) {
  for (let k = 0; k < max; k++) {
    const i = await info2(); if (!i) return true;
    try { let h = await handle(i); if (h === 'decide') h = await fallback(i) } catch (e) { say('SETTLE ERR', String(e.message || e).slice(0, 120)); await globalThis.closeAll() }
    await sleep(500);
  }
  return !(await info2());
}
// fortsett normal-spillet
for (let k = 0; k < 20 && !(await page.evaluate(() => !!(typeof S !== 'undefined' && S && !S.over && !$('#game').hidden))); k++) {
  await settle(10);
  const r = await page.evaluate(() => { if ($('#title').hidden) return 'wait';
    if (impSaved()) { impResume(); return 'imp' }
    if (loadSave()) { resumeGame(); return 'resume' }
    return 'nosave' });
  if (r === 'nosave') { say('INGEN LAGRING'); await browser.close(); process.exit(2) }
  await sleep(1500);
}
await settle();
say('GAME', await page.evaluate(() => ({ day: S.day, money: Math.round(S.money), rank: S.rankIdx, imp: !!S.imp })));
const route = gi => gi.money < 2e6 ? 'se' : (gi.money < 15e6 ? 'tr' : (Math.random() < .5 ? 'ru' : 'nl'));
const stop = Date.now() + MIN * 60000;
let lastBuy = -99;
while (Date.now() < stop) {
  const g = await page.evaluate(() => ({ day: S.day, money: Math.round(S.money), rank: S.rankIdx, over: S.over, heat: Math.round(S.heat || 0), imp: !!S.imp, invTot: Object.values(S.inv || {}).reduce((a, b) => a + b, 0) }));
  if (g.over) { say('OVER'); break }
  const inf = await info2();
  if (inf) { try { let h = await handle(inf); if (h === 'decide') await fallback(inf) } catch (e) { await globalThis.closeAll() } await sleep(600); continue }
  if (g.heat > 50) { await page.evaluate(() => { layLow() }); await sleep(1200); continue }
  if (g.invTot > 0) { await page.evaluate(() => { doSell() }); await sleep(900); continue }
  if (g.money < 4000) { await page.evaluate(() => { waitDay() }); await sleep(1300); continue }
  if (g.day - lastBuy < 12) { await page.evaluate(() => { waitDay() }); await sleep(1300); continue }
  lastBuy = g.day;
  const cid = route(g);
  await page.evaluate(c => { window._planCountry = c }, cid);
  await page.evaluate(() => { doBuy() });
  say('kjøper tur (' + cid + ') dag ' + g.day);
  await sleep(1500);
}
await settle();
await page.evaluate(async () => { try { if (S && !S.over) { saveGame(); await skyPush('save'); await skyPush('prof') } } catch (e) {} });
say('SLUTT', await page.evaluate(() => ({ day: S.day, money: Math.round(S.money), rank: S.rankIdx })));
await browser.close();
