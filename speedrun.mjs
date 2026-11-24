// Runs the Gudfar speedrun (bot.js + speedrun.js) in headless Chromium on the linked player card.
//   node speedrun.mjs [minutes] [fresh]
// Each attempt is a new figure in family Kodesen with «Familiens velsignelse». A failed attempt
// (lost gamble, death, behind schedule) starts the next figure until the time is up or Gudfar is reached.
import puppeteer from 'puppeteer-core';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.LG_PROFILE || '/home/rune/.local/share/lopegutten-bot/chrome';
const FAM = process.env.LG_FAM || 'Kodesen';
const PREFIX = process.env.LG_PREFIX || 'SPURT';
const STAMP = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const LOGF = process.env.LG_LOG || `/tmp/lg/speedrun-${STAMP}.log`;
const ATTEMPTS = process.env.LG_ATTEMPTS || '/tmp/lg/speedrun-attempts.jsonl';
const minutes = Number(process.argv[2] || 60);
let fresh = process.argv.includes('fresh');
const say = (...a) => {
  const line = new Date().toISOString().slice(11, 19) + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  process.stdout.write(line + '\n');
  appendFileSync(LOGF, line + '\n');
};
console.log = say;

// behind-schedule limits: [day, minimum rank, minimum net worth]
const MILESTONES = JSON.parse(process.env.LG_MILESTONES || '[]');

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(60000);
const seenErr = new Map();
page.on('pageerror', err => { const k = String(err).slice(0, 300); if (Date.now() - (seenErr.get(k) || 0) > 600000) { seenErr.set(k, Date.now()); say('PAGEERR', k) } });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined' && typeof kbList === 'function', { timeout: 120000 });
// dialog-auto-lukking: oppdateringer kan poppe modaler som fryser attempts (watchdog 'dag uendret')
await page.evaluate(() => { if (window.__dlgFix) return; window.__dlgFix = setInterval(() => { const v = document.querySelector('#veil'); if (!v || v.hidden) return; const b = [...document.querySelectorAll('#slip button, .dlg button')].find(x => !x.disabled && /^(ok|lukk|ferdig|videre|forstått|prøv igjen)$/i.test(x.textContent.trim())); if (b) b.click(); }, 2000); });
await new Promise(r => setTimeout(r, 3000));
const linked = await page.evaluate(() => !!store.get('cardCode', ''));
if (!linked) { await browser.close(); throw new Error('profile is not linked to a player card') }
for (let n = 0; n < 6; n++) {
  // two-games conflict (e.g. the owner plays Imperiet on another device): never choose, just stop
  if (await page.evaluate(() => { const v = document.querySelector('#veil'); return !!(v && !v.hidden && /TO SPILL, ÉN SPILLER|TWO GAMES, ONE PLAYER/i.test(document.querySelector('#slip')?.innerText || '')) })) { say('CONFLICT dialog – stopping without choosing'); await browser.close(); process.exit(5) }
  const c = await page.evaluate(() => { const v = document.querySelector('#veil'); if (!v || v.hidden) return null; const b = [...document.querySelectorAll('#slip footer button')].filter(b => !b.disabled); const x = b.find(b => /SENERE|LUKK|OK|FORTSETT/i.test(b.innerText)) || b[0]; if (x) { x.click(); return x.innerText } return 'none' });
  if (!c) break; await new Promise(r => setTimeout(r, 1000));
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
globalThis.SR_LOG = (s) => say('EV', s);
globalThis.SR_CFG = JSON.parse(process.env.LG_CFG || '{}');
for (const f of ['bot.js', 'speedrun.js']) (0, eval)(readFileSync(join(ROOT, f), 'utf8'));
globalThis.COAST = false;
globalThis.SR_MILESTONES = MILESTONES;

const nAttempts = () => existsSync(ATTEMPTS) ? readFileSync(ATTEMPTS, 'utf8').split('\n').filter(Boolean).length : 0;
const snap = () => page.evaluate(() => S ? { nick: S.dyn && S.dyn.nick, fam: S.dyn && S.dyn.fam, day: S.day, rank: S.rankIdx, money: Math.round(S.money), nw: Math.round(netWorth()), heat: Math.round(S.heat || 0), over: !!S.over, gfDay: S.gfDay } : null);

async function startNew() {
  const n = nAttempts() + 1;
  const pick = await page.evaluate((fam) => {
    const d = dynStore(), f = d.fams && d.fams[fam];
    const used = f ? Object.values(f.b).map(b => b.f) : [];
    let free = 0; for (let i = 1; i <= 10; i++) if (!used.includes(i)) { free = i; break }
    return { free, branches: used.length, kinds: f ? Object.values(f.b).map(b => b.n + ':' + b.e) : [], fams: Object.keys(d.fams || {}) };
  }, FAM);
  say('FAM', pick);
  const nick = PREFIX + n;
  const started = await globalThis.startFig(nick, pick.free || 1, FAM);
  say('STARTED', started);
  if (!started || !started.dyn || (started.famSet !== 'plain' && started.dyn.nick !== nick)) throw new Error('new game did not start');
  Object.assign(SR, { abort: null, done: null, finale: null, route: null, fullRev: 0, waits: 0, betCache: null, midDone: null, noSellDay: null, t0: Date.now(), nick });
  return nick;
}

if (!fresh) {
  const r = await page.evaluate((pre) => {
    const d = loadSave(); const Sx = d && d.S;
    if (!Sx || Sx.over || Sx.imp || !(Sx.dyn && String(Sx.dyn.nick || '').toLowerCase().startsWith(pre.toLowerCase()))) return { ok: false, nick: Sx && Sx.dyn && Sx.dyn.nick };
    const onTitle = !document.querySelector('#title').hidden; if (onTitle) resumeGame(); return { ok: true, nick: Sx.dyn.nick, day: Sx.day };
  }, PREFIX);
  say('RESUME', r);
  if (!r.ok) fresh = true; else { SR.nick = r.nick; SR.t0 = Date.now() }
}
if (fresh) await startNew();

const stopAt = Date.now() + minutes * 60000;
let result = null;
while (Date.now() < stopAt) {
  const why = await globalThis.srDriver(Math.min(stopAt - Date.now(), 4 * 60000));
  await page.evaluate(() => { try { if (S && !S.over) saveGame() } catch (e) {} });
  const s = await snap();
  say('TICK', { why, ...s, last: SR.last && { inv: SR.last.invV, e0: SR.last.e0, fronts: SR.last.fronts, lawyer: SR.last.lawyer, prot: SR.last.prot }, wall: Math.round((Date.now() - SR.t0) / 60000) });
  if (why === 'gudfar' || (s && s.gfDay != null)) {
    result = { nick: SR.nick, gfDay: s.gfDay, day: s.day, finale: SR.finale, wall: Math.round((Date.now() - SR.t0) / 60000) };
    appendFileSync(ATTEMPTS, JSON.stringify({ t: Date.now(), ...result, ok: true }) + '\n');
    say('GUDFAR', result);
    break;
  }
  if (why === 'abort' || why === 'over' || why === 'decide' || SR.abort || (s && s.over)) {
    const rec = { t: Date.now(), nick: SR.nick, why, abort: SR.abort, day: s && s.day, rank: s && s.rank, money: s && s.money, nw: s && s.nw, rankDays: SR.rankDays, finale: SR.finale, wall: Math.round((Date.now() - SR.t0) / 60000) };
    if (why === 'decide') rec.dialog = await globalThis.info2();
    appendFileSync(ATTEMPTS, JSON.stringify(rec) + '\n');
    say('ATTEMPT END', rec);
    if (why === 'decide') break;
    if (Date.now() > stopAt - 5 * 60000) break;
    await globalThis.closeAll();
    await startNew();
  }
}
if (result) {
  await new Promise(r => setTimeout(r, 8000));
  const pid = await page.evaluate(() => typeof hsPid === 'function' ? hsPid() : '');
  try { const r = await fetch('https://lopegutten.com/api/fast.php?pid=' + encodeURIComponent(pid)); say('FAST', (await r.text()).slice(0, 1500)) } catch (e) { say('FAST err', String(e)) }
}
say('SAVES', await page.evaluate(() => { const slot = s => { const d = store.get(s, null), Sx = d && d.S; return Sx ? { day: Sx.day, rank: Sx.rankIdx, nick: Sx.dyn && Sx.dyn.nick, over: !!Sx.over } : null }; return { save: slot('save'), saveI: slot('saveI') } }));
await browser.close();
