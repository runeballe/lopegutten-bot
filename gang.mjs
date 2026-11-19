// Daily gang chores for one player card: tribute up to the daily respect cap,
// the daily street fight, and this member's daily share of the weekly sales job.
// Usage: LG_CARD=XXXXXXXXXXXX node gang.mjs [tribute,fight,job] [chunk]
// Each card gets its own browser profile, so several cards can run in parallel.
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CODE = (process.env.LG_CARD || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!CODE) throw new Error('LG_CARD is empty');
const PROFILE = process.env.LG_PROFILE || `/home/rune/.local/share/lopegutten-bot/card-${CODE}`;
const STEPS = new Set((process.argv[2] || 'tribute,fight,job').split(','));
// Respect per payment ≈ 396 + 300·log10(kr / 1 mill.); respect per krone peaks near kr 130 000.
const CHUNK = Number(process.argv[3] || 130000);
const JOB_MINUTES = Number(process.env.LG_JOB_MIN || 20);
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
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined' && typeof gPost === 'function' && typeof skyPull === 'function', { timeout: 120000 });

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

// ---- kernel shim so bot.js can drive this page ----
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
globalThis.LATE_TRADE = true;
// Short trips near the end of 1999, so a sale lands before the year-2000 window when possible.
const baseRoute = globalThis.route;
globalThis.route = gi => (!gi.imp && gi.day >= 3560 ? (gi.flire === 'se' ? 'pl' : 'se') : baseRoute(gi));
// Year-2000 window: continue in Imperiet when this card's Imperiet slot is empty, so the card
// keeps a running game for tribute and job sales. An occupied slot is never overwritten.
const baseHandle = globalThis.handle;
globalThis.handle = async inf => {
  if (/y2kslip/.test(inf.cls) && await page.evaluate(() => !impSaved())) {
    const b = inf.btns.find(b => b.primary && !b.dis);
    if (b) { await globalThis.clickIdx(b.i); say('Y2K -> Imperiet'); return 'y2k-imp' }
  }
  return baseHandle(inf);
};
const { info2, handle, fallback } = globalThis;
async function settle(max = 40) {
  for (let k = 0; k < max; k++) {
    const i = await info2(); if (!i) return true;
    if (/gjslip|kgslip/.test(i.cls)) { await globalThis.closeAll(); continue }
    // A dialog the rules cannot answer must not crash the run before the cloud save at the end.
    try { let h = await handle(i); if (h === 'decide') h = await fallback(i) } catch (e) { say('SETTLE ERR', String(e.message || e).slice(0, 120)); await globalThis.closeAll() }
    await sleep(500);
  }
  return !(await info2());
}

// ---- resume this card's normal game from the cloud save ----
const inGame = () => page.evaluate(() => !!(typeof S !== 'undefined' && S && !S.over && !S.wk && !$('#game').hidden));
for (let k = 0; k < 20 && !await inGame(); k++) {
  await settle(10);
  // LG_PREFER_IMP=1: use the Imperiet game first. It usually has the strongest figure (better fight
  // odds) and the most money (tribute and the gang sales job finish faster).
  const r = await page.evaluate(async (preferImp) => {
    if (!store.get('save', null) && !store.get('saveI', null)) { await skyPull('card'); return 'pull' }
    if ($('#title').hidden) return 'wait';
    if (preferImp && impSaved()) { impResume(); return 'imp' }
    if (loadSave()) { resumeGame(); return 'resume' }
    if (impSaved()) { impResume(); return 'imp' }
    return 'nosave';
  }, process.env.LG_PREFER_IMP === '1');
  if (r === 'nosave') break;
  await sleep(1500);
}
if (!await inGame()) { say('NO NORMAL GAME'); await browser.close(); process.exit(2) }
await settle();
const game = () => page.evaluate(() => ({ day: S.day, money: Math.round(S.money), rank: S.rankIdx, imp: !!S.imp }));
say('GAME', await game());

const gang = () => page.evaluate(async () => {
  for (let k = 0; k < 6; k++) {
    const d = await gPost('me');
    if (d && d.ok) { GJ = d; GJt = Date.now(); return d.gang ? { respToday: d.respToday, respCap: d.respCap, job: d.job && { kind: d.job.kind, good: d.job.good, prog: d.job.prog, target: d.job.target, done: d.job.done, perDay: d.job.perDay, myToday: d.job.myToday } } : null }
    await new Promise(r => setTimeout(r, 1500 * (k + 1)));
  }
  return null;
});
let G = await gang();
if (!G) { say('NOT IN A GANG'); await browser.close(); process.exit(3) }
say('GANG', G);

// ---- tribute: many small payments, last one sized to land on the cap ----
if (STEPS.has('tribute') && G.respToday < G.respCap) {
  await globalThis.closeAll();
  await page.evaluate(() => { gjengDialog('k'); return 0 });
  await page.waitForSelector('#slip #gTGo', { timeout: 20000 });
  let left = G.respCap - G.respToday, paid = 0, n = 0;
  while (left > 0 && n < 80) {
    const money = (await game()).money;
    const fill = Math.ceil(1e6 * 10 ** ((left - 396) / 300) * 1.02);
    const amt = Math.max(1000, Math.min(left <= 140 ? fill : CHUNK, money - 100000));
    if (amt < 1000 || money - amt < 100000) { say('TRIBUTE: low money', money); break }
    const msg = await page.evaluate(async a => {
      const ta = document.querySelector('#gTA'), go = document.querySelector('#gTGo'), m = document.querySelector('#gTM');
      if (!ta || !go) return 'noform';
      const before = m.textContent; ta.value = String(a); go.click();
      for (let k = 0; k < 60; k++) { await new Promise(r => setTimeout(r, 250)); if (!go.disabled && m.textContent !== before) break }
      return m.textContent;
    }, amt);
    n++;
    const got = /fikk\s+([\d\s\u00a0]+)\s+respekt/i.exec(msg);
    if (!got) { say('TRIBUTE STOP', msg); break }
    const r = +got[1].replace(/\D/g, '');
    paid += amt; left -= r;
    say(`tribute #${n} kr ${amt} -> ${r} respect (left ${left})`);
    if (r <= 0) break;
  }
  await globalThis.closeAll();
  G = await gang();
  say('TRIBUTE DONE', { respToday: G.respToday, respCap: G.respCap, paid, payments: n });
}

// ---- daily street fight: district with the best expected control gain ----
if (STEPS.has('fight')) {
  const pick = await page.evaluate(async () => {
    const m = await kgLoad(true); if (!m || !m.me) return { err: 'nomap' };
    if (!(m.left > 0)) return { err: 'used', left: m.left };
    const str = kgStr(), rows = [];
    const pre = async id => { for (let k = 0; k < 5; k++) { const P = await kgPost('pre', { d: id, str }); if (P && P.ok) return P; if (P && P.err === 'nogang') return null; await new Promise(r => setTimeout(r, 1500 * (k + 1))) } return null };
    const lead = d => { const mine = (d.pts.find(p => p.gid === m.me.gid) || {}).pts || 0; const oth = Math.max(0, ...d.pts.filter(p => p.gid !== m.me.gid).map(p => p.pts)); return mine - oth };
    for (const d of m.dists) { const P = await pre(d.id); if (P) rows.push({ id: d.id, chance: P.chance, gain: P.gain || m.win, duel: !!P.duel, arch: !!P.arch, def: P.def, left: P.left, lead: lead(d) }); await new Promise(r => setTimeout(r, 300)) }
    rows.sort((a, b) => b.chance * b.gain - a.chance * a.gain);
    return { str, rows };
  });
  say('FIGHT PICK', pick);
  if (pick.rows && pick.rows.length) {
    const wanted = process.env.LG_FIGHT || '';
    // LG_FIGHT=duel: ta bydelen som er merket som ukas duell, ellers beste bydel.
    // LG_FIGHT=toyen,gamle[:20]: første bydel i lista der vi ikke leder med minst marginen (standard 20), ellers den siste.
    const [list, mg] = wanted.split(':'), want = list.split(',').filter(Boolean), margin = +mg || 20;
    const prio = want.length > 1 || (want.length && want[0] !== 'duel') ? (want.map(id => pick.rows.find(r => r.id === id)).find(r => r && r.lead < margin) || pick.rows.find(r => r.id === want[want.length - 1]))?.id : null;
    const best = prio || (wanted === 'duel' ? pick.rows.find(r => r.duel)?.id : null) || pick.rows[0].id;
    say('FIGHT TARGET', best, wanted || 'auto');
    await globalThis.closeAll();
    await page.evaluate(id => { kgFight(id); return 0 }, best);
    let result = null;
    for (let k = 0; k < 40 && !result; k++) {
      await sleep(500);
      result = await page.evaluate(() => {
        const s = document.querySelector('#slip'); if (!s || document.querySelector('#veil').hidden) return null;
        if (!/kgslip/.test(s.className)) return 'MSG: ' + (s.innerText || '').replace(/\s+/g, ' ').slice(0, 200);
        const res = s.querySelector('.kgres'); if (res) return res.textContent.trim() + ' · ' + (s.querySelector('.kgresx')?.textContent || '');
        const go = [...s.querySelectorAll('footer button.primary')].find(b => /SLÅSS|KJEMP|FIGHT|SLÅ/i.test(b.innerText));
        if (go && s.querySelector('.kgchance')) { if (go.disabled) return 'fight button disabled'; go.click() }
        return null;
      });
    }
    say('FIGHT', result || 'no result');
    await globalThis.closeAll();
  }
}

// ---- weekly job: trade until this member's daily cap is reached ----
if (STEPS.has('job') && G.job && !G.job.done && G.job.myToday < G.job.perDay) {
  if (G.job.kind !== 'sale') say('JOB kind', G.job.kind, '(only sales are driven here; trading still counts goods)');
  const need = G.job.perDay - G.job.myToday;
  const stopAt = Date.now() + JOB_MINUTES * 60000;
  const queued = () => page.evaluate(k => k === 'fight' ? GQ.fight : k === 'good' ? 0 : GQ.sale, G.job.kind);
  let sold = 0;
  while (Date.now() < stopAt) {
    const g = await game();
    if (!g.imp && g.day >= 3645 && await page.evaluate(() => !!impSaved())) { say('JOB: Imperiet slot taken, stop before year 2000 at day', g.day); break }
    const r = await globalThis.run(40, async () => (await queued()) + sold >= need);
    const q = await queued();
    if (q > 0) { await page.evaluate(() => gFlush()); sold += q }
    if (r.stop === 'over' && sold < need) { await settle(); if (await inGame()) continue }
    if (sold >= need || r.stop === 'over' || r.stop === 'stuck' || r.stop === 'decide') { if (r.stop !== 'cond' && r.stop !== 'steps') say('JOB run stop', r.stop); break }
  }
  await page.evaluate(() => gFlush());
  G = await gang();
  say('JOB DONE', G.job);
}

// ---- persist: local save and cloud push ----
await settle();
await page.evaluate(async () => { try { if (S && !S.over) saveGame(); await skyPush(S && S.imp ? 'saveI' : 'save'); await skyPush('prof') } catch (e) {} });
say('END', await game(), G);
await browser.close();
