// Ukens Oslo for one player card: enter the weekly city (this week: Bombebølgen),
// play until the day target (or death), log the result. Best attempt counts server-side.
// Usage: LG_CARD=XXXXXXXXXXXX node ukens.mjs [targetDays]   (default 450)
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CODE = (process.env.LG_CARD || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!CODE) throw new Error('LG_CARD is empty');
const PROFILE = process.env.LG_PROFILE || `/home/rune/.local/share/lopegutten-bot/card-${CODE}`;
const TARGET = Number(process.argv[2] || process.env.LG_UKE_DAYS || 450);
const LAYLOW = Number(process.env.LG_UKE_LAYLOW || 40);
const tag = CODE.slice(0, 4);
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

// ---- player card ----
if (await page.evaluate(() => store.get('cardCode', '')) !== CODE) {
  await page.evaluate(code => { restoreDialog(code); return 0 }, CODE);
  await page.waitForSelector('#kIn');
  for (let i = 0; i < 10 && await page.evaluate(() => store.get('cardCode', '')) !== CODE; i++) {
    await page.evaluate(() => { const go = document.querySelector('#kGo'); if (go && !go.disabled) go.click() });
    await sleep(1500);
  }
  if (await page.evaluate(() => store.get('cardCode', '')) !== CODE) throw new Error('card not linked');
}

// ---- kernel shim ----
const shim = {
  evaluate: (fn, arg) => page.evaluate(fn, arg),
  select: (sel, value) => page.select(sel, value),
  fill: async sel => { await page.$eval(sel, el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })) }) },
  type: (sel, text) => page.type(sel, text, { delay: 15 }),
};
globalThis.browser = { tab: () => shim };
globalThis.print = () => {};
(0, eval)(readFileSync(join(ROOT, 'bot.js'), 'utf8'));
globalThis.COAST = false;
globalThis.LAYLOW_AT = LAYLOW;
// route: Sverige på små kassaer, Tyrkia (heroin) fra 2 mill, Russland (bomber ×0.3) fra 15 mill
const baseRoute = globalThis.route;
globalThis.route = gi => process.env.LG_UKE_BOMB ? (gi.rank < 3 ? 'de' : 'ru') : (gi.money < 2e6 ? 'se' : (gi.money < 15e6 ? 'tr' : (Math.random() < .5 ? 'ru' : 'nl')));

const { info2, handle, fallback } = globalThis;
async function settle(max = 40) {
  for (let k = 0; k < max; k++) {
    const i = await info2(); if (!i) return true;
    try { let h = await handle(i); if (h === 'decide') h = await fallback(i) } catch (e) { say('SETTLE ERR', String(e.message || e).slice(0, 120)); await globalThis.closeAll() }
    await sleep(500);
  }
  return !(await info2());
}

// ---- inn i Ukens Oslo: tUke FØR settle (settile kan klikke SENERE vekk) ----
for (let k = 0; k < 6; k++) {
  const vis = await page.evaluate(() => !document.querySelector('#title').hidden);
  if (!vis) break;
  await page.evaluate(() => { const t = document.querySelector('#tUke'); t && t.click() });
  await sleep(2000); await settle(10);
}
await sleep(2000);
// enkel dagscheck: er vi i ukens-byen (1990-1994)?
const wk0 = await page.evaluate(() => (typeof S !== 'undefined' && S && S.wk) ? { day: S.day, money: Math.round(S.money) } : null);
say('UKE', wk0 || { note: 'S.wk mangler – driver videre uansett' });

// ---- kjør til dagmål eller død ----
let logged = '';
while (true) {
  const inf0 = await globalThis.info2();
  if (inf0) say('LOOP "' + inf0.title + '" | ' + String(inf0.body).replace(/\s+/g,' ').slice(0,110) + ' | ' + inf0.btns.map(b=>b.t).join('/'));
  const r = await globalThis.run(40, async () => (await page.evaluate(() => typeof S !== 'undefined' && S ? S.day >= TARGET || !!S.over : true)));
  const st = await page.evaluate(() => (typeof S !== 'undefined' && S) ? { day: S.day, money: Math.round(S.money), rank: S.rankIdx, over: S.over, heat: Math.round(S.heat || 0) } : null);
  say('RUN', r.stop || 'ok', st || '');
  if (!st) break;
  const inWk = await page.evaluate(() => !!(typeof S !== 'undefined' && S && S.wk));
  if (st.over && inWk) {
    await settle(20);
    // ukens: best forsøk teller - logg og avslutt kortet
    const fin = await page.evaluate(() => (typeof fameTop === 'function') ? null : null);
    break;
  }
  if (st.day >= TARGET) break;
  if (r.stop === 'decide' || r.stop === 'stuck') {
    const inf = await globalThis.info2();
    if (inf) say('STALL "' + inf.title + '" | ' + String(inf.body).replace(/\s+/g,' ').slice(0,150) + ' | knapper: ' + inf.btns.map(b=>b.t).join('/'));
    const i = await info2(); if (i) { try { let h = await handle(i); if (h === 'decide') await fallback(i) } catch (e) { await globalThis.closeAll() } }
    await sleep(1200);
    if (await page.evaluate(() => !!(typeof S !== 'undefined' && S && S.over))) break;
    continue;
  }
  await settle(8);
}

// ---- result + persist ----
await settle();
const fin = await page.evaluate(() => (typeof S !== 'undefined' && S) ? { day: S.day, money: Math.round(S.money), rank: S.rankIdx, over: S.over, wk: S.wk ? S.wk.wk : null } : null);
say('FINAL', fin);
try { await page.evaluate(async () => { if (typeof skyPush === 'function') await skyPush('save') }) } catch (e) {}
await browser.close();
