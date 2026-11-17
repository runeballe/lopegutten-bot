// Drives bot.js through Chromium. The player card stays in LG_CARD, never in the repo.
import puppeteer from 'puppeteer-core';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.LG_PROFILE || '/home/rune/.local/share/lopegutten-bot/chrome';
const CODE = (process.env.LG_CARD || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const MODE = process.argv[2] || 'status';
const LOGF = process.env.LG_LOG || '';
const say = (...a) => {
  const line = a.map(x => typeof x === 'string' ? x : String(x)).join(' ');
  process.stdout.write(line + '\n');
  if (LOGF) appendFileSync(LOGF, line + '\n');
};
console.log = say;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  userDataDir: PROFILE,
  protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(60000);
page.on('console', msg => console.log('PAGE', msg.type(), msg.text().slice(0, 200)));
page.on('pageerror', err => console.log('PAGEERR', String(err).slice(0, 300)));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof ACH !== 'undefined' && typeof store !== 'undefined', { timeout: 120000 });

async function clickThrough(max = 6) {
  for (let n = 0; n < max; n++) {
    const open = await page.evaluate(() => {
      const v = document.querySelector('#veil');
      return !!(v && !v.hidden);
    });
    if (!open) return;
    const clicked = await page.evaluate(() => {
      const go = document.querySelector('#kGo');
      if (go && !go.disabled) { go.click(); return 'kGo'; }
      const btns = [...document.querySelectorAll('#slip footer button')].filter(b => !b.disabled);
      const b = btns.find(b => /BLI |SJEKK|FORTSETT|OK|LUKK|SENERE/i.test(b.innerText)) || btns[0];
      if (b) { b.click(); return b.innerText.trim().slice(0, 40); }
      return null;
    });
    if (!clicked) break;
    await new Promise(r => setTimeout(r, 1200));
  }
}

const linked = await page.evaluate(() => !!store.get('cardCode', ''));
console.log('card linked', linked);
if (!linked) {
  if (!CODE) throw new Error('No saved session and LG_CARD is empty');
  await page.evaluate(code => { restoreDialog(code); return 0 }, CODE);
  await page.waitForSelector('#kIn', { timeout: 20000 });
  console.log('card dialog open');
  for (let i = 0; i < 6; i++) {
    const step = await page.evaluate(() => {
      const go = document.querySelector('#kGo');
      const label = go ? go.innerText.replace(/\s+/g, ' ').slice(0, 60) : '';
      if (go && !go.disabled) go.click();
      return { label, card: !!store.get('cardCode', ''), out: (document.querySelector('#kOut')?.innerText || '').replace(/\s+/g, ' ').slice(0, 140) };
    });
    console.log('card step', i, JSON.stringify(step));
    if (step.card) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  await new Promise(r => setTimeout(r, 5000));
  await clickThrough(4);
}

async function report() {
  return page.evaluate(() => {
    const got = achStore();
    const missing = ACH.filter(a => !got[a.id]).map(a => ({ id: a.id, name: (a.name && (a.name.no || a.name.nb || a.name.en)) || '' }));
    const nameOf = x => (x && (x.no || x.nb || x.en || (typeof x === 'string' ? x : ''))) || '';
    const saveOf = slot => {
      const d = store.get(slot, null);
      const Sx = d && d.S;
      if (!Sx) return null;
      return { day: Sx.day, rank: Sx.rankIdx, money: Math.round(Sx.money || 0), over: !!Sx.over, imp: !!Sx.imp, gf: !!Sx.godfather, nick: Sx.dyn && Sx.dyn.nick, fam: Sx.dyn && Sx.dyn.fam };
    };
    return {
      player: store.get('hsName', '') || store.get('player', ''),
      best: store.get('bestRank', 0),
      have: Object.keys(got).length,
      total: ACH.length,
      missing: missing.map(m => m.id + (nameOf(ACH.find(a => a.id === m.id).name) ? ' ' + nameOf(ACH.find(a => a.id === m.id).name) : '')),
      save: saveOf('save'),
      saveW: saveOf('saveW'),
      saveI: saveOf('saveI'),
    };
  });
}

function installKernel() {
  const tab = {
    evaluate: (fn, arg) => page.evaluate(fn, arg),
    select: (sel, value) => page.select(sel, value),
    fill: async (sel, text) => { await page.$eval(sel, (el, t) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }, text); },
    type: (sel, text) => page.type(sel, text, { delay: 15 }),
  };
  globalThis.browser = { tab: () => tab };
  globalThis.print = (...a) => console.log(...a);
  globalThis.tab = tab;
}

if (MODE === 'status') {
  const brief = await page.evaluate(() => ({
    player: store.get('hsName', '') || store.get('player', ''),
    best: store.get('bestRank', 0),
    card: !!store.get('cardCode', ''),
    have: Object.keys(achStore()).length,
    total: ACH.length,
    slip: (document.querySelector('#slip header')?.innerText || '').slice(0, 80),
    kOut: (document.querySelector('#kOut')?.innerText || '').slice(0, 160),
  }));
  console.log('BRIEF ' + JSON.stringify(brief));
  const ids = await page.evaluate(() => {
    const got = achStore();
    return {
      have: ACH.filter(a => got[a.id]).map(a => a.id).join(','),
      miss: ACH.filter(a => !got[a.id]).map(a => a.id).join(','),
    };
  });
  console.log('HAVE ' + ids.have);
  console.log('MISS ' + ids.miss);
  const saves = await page.evaluate(() => {
    const slot = s => {
      const d = store.get(s, null), Sx = d && d.S;
      if (!Sx) return null;
      return { day: Sx.day, rank: Sx.rankIdx, money: Math.round(Sx.money || 0), over: !!Sx.over, gf: !!Sx.godfather, nick: Sx.dyn && Sx.dyn.nick };
    };
    return { save: slot('save'), saveW: slot('saveW'), saveI: slot('saveI') };
  });
  console.log('SAVES ' + JSON.stringify(saves));
  await browser.close();
} else if (MODE === 'play') {
  await clickThrough(4);
  const fresh = process.argv.includes('fresh');
  const resumed = fresh ? { fresh: true } : await page.evaluate(() => {
    const title = document.querySelector('#title');
    const onTitle = !!(title && !title.hidden);
    const d = typeof loadSave === 'function' ? loadSave() : null;
    if (onTitle && d) {
      resumeGame();
      return { resumed: true, day: S.day, rank: S.rankIdx, nick: S.dyn && S.dyn.nick, money: Math.round(S.money) };
    }
    return { resumed: false, onTitle, hasSave: !!d, playing: !!(typeof S !== 'undefined' && S && !S.over) };
  });
  console.log('RESUME ' + JSON.stringify(resumed));
  if (!fresh && !resumed.resumed && !resumed.playing) throw new Error('No game to resume');
  installKernel();
  const minutes = Number(process.argv[3] || 25);
  for (const f of ['bot.js', 'bergen.js', 'ach.js', 'gap.js']) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    // The files expect to run as a classic script in the kernel, not as a module.
    (0, eval)(src);
  }
  globalThis.COAST = false;
  if (fresh) {
    const pick = await page.evaluate(() => {
      const d = dynStore();
      const bak = d.fams && d.fams.BAK;
      const used = bak ? Object.values(bak.b).map(b => b.f) : [];
      const nicks = bak ? Object.values(bak.b).map(b => String(b.n || '').toLowerCase()) : [];
      let free = 0;
      for (let i = 1; i <= 10; i++) if (!used.includes(i)) { free = i; break; }
      const rec = (store.get('kasFam', {}) || {}).bak || null;
      return { free, branches: used.length, nick: nicks.includes('ask') ? 'ASKE' : 'ASK', kasLvl: rec && rec.lvl || 0 };
    });
    console.log('FAM ' + JSON.stringify(pick));
    const started = await globalThis.startFig(pick.nick, pick.free || 1, pick.free ? 'BAK' : 'KOLL');
    console.log('STARTED ' + JSON.stringify(started));
    if (!started || !started.dyn || started.dyn.nick !== pick.nick) {
      await browser.close();
      throw new Error('new game did not start');
    }
  }
  const prog = () => page.evaluate(() => {
    const got = achStore();
    const miss = ACH.filter(a => !got[a.id]).map(a => a.id);
    const K = S && S.kas || {};
    return {
      day: S ? S.day : null, rank: S ? S.rankIdx : null, money: S ? Math.round(S.money) : null,
      gf: !!(S && S.godfather), nick: S && S.dyn && S.dyn.nick, fam: S && S.dyn && S.dyn.fam,
      ali: (S && S.ali && S.ali.done) || 0, tore: (S && S.tore && S.tore.done) || 0,
      express: !!(S && S.amfExpress), villa: typeof vgHas === 'function' && !!vgHas('villa'),
      tig: (typeof ct === 'function' && ct().tigSold) || 0,
      kas: S ? { lvl: K.lvl || 0, tot: K.tot || 0, empty: !!K.empty, kick: !!K.kick, raf: !!K.raf, back: !!K.back, fam: !!K.fam, kasse: K.kasse || 0, taken: K.taken || '' } : null,
      vif: S && S.vif ? { own: !!S.vif.own, streak: S.vif.streak || 0, boost: S.vif.boost || 0 } : null,
      have: ACH.length - miss.length, miss,
    };
  });
  console.log('PROG ' + JSON.stringify(await prog()));
  const ms = minutes * 60 * 1000;
  const stop = Date.now() + ms;
  let prevMiss = null;
  while (Date.now() < stop) {
    const left = stop - Date.now();
    const why = await globalThis.driver(Math.min(left, 8 * 60 * 1000));
    await page.evaluate(() => { try { if (typeof S !== 'undefined' && S && !S.over) store.set('save', { v: 1, t: Date.now(), lang: LANG, S }); } catch (e) {} });
    const snap = await prog();
    const unlocked = prevMiss ? prevMiss.filter(id => !snap.miss.includes(id)) : [];
    prevMiss = snap.miss;
    console.log('TICK ' + JSON.stringify({ why, day: snap.day, rank: snap.rank, money: snap.money, gf: snap.gf, ali: snap.ali, tore: snap.tore, express: snap.express, tig: snap.tig, have: snap.have, unlocked, miss: snap.miss, kas: snap.kas, vif: snap.vif, rep: (globalThis.REP || []).slice(-6) }));
    if (why === 'done' || why === 'decide' || why === 'stuck') break;
  }
  const r = await report();
  console.log('AFTER ' + r.have + '/' + r.total);
  console.log(r.missing.join('\n'));
  await browser.close();
} else {
  throw new Error('mode: status | play');
}
