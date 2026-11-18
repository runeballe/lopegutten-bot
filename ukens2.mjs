// Ukens Oslo, maks-makt-driver: handel som onkel.mjs + bydeler, anlegg, bedrifter, gjeng/slagkraft.
// Bruk:  LG_CARD=<kode> node ukens2.mjs      (uten LG_CARD: første kode i ~/.config/lopegutten-bot/cards.txt)
// Profil: ~/.local/share/lopegutten-bot/card-<KODE> (headless chromium). Logg: logs/ukens2-<siste 4>.log
// Makt = m (log10 formue) + d (bydeler 500 hver) + g (slagkraft*10, maks 2000) + s (status*10) + r (rang*200) + b.
// Rører aldri spilltilstand direkte: kun spillets egne knapper/funksjoner. Aldri «Gi opp», kasino, lotto, bestikkelse.
import puppeteer from 'puppeteer-core';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';

const HOME = process.env.HOME;
let CODE = (process.env.LG_CARD || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!CODE) {
  const l = readFileSync(`${HOME}/.config/lopegutten-bot/cards.txt`, 'utf8').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('#'))[0];
  CODE = (l || '').split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
}
if (!CODE) throw new Error('ingen kortkode');
const TAG = CODE.slice(-4);
const PROFILE = process.env.LG_PROFILE || `${HOME}/.local/share/lopegutten-bot/card-${CODE}`;
const TARGET = Number(process.env.LG_UKE_DAYS || 1830);
const TRIPGAP = Number(process.env.LG_TRIPGAP || 6);
const LOGDIR = `${HOME}/.local/share/lopegutten-bot/logs`;
mkdirSync(LOGDIR, { recursive: true });
const LOGF = `${LOGDIR}/ukens2-${TAG}.log`;
const say = (...a) => {
  const line = `${new Date().toISOString().slice(11, 19)} [${TAG}] ` + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  process.stdout.write(line + '\n'); try { appendFileSync(LOGF, line + '\n') } catch (_) {}
};
console.log = say;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 240000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
let page = (await browser.pages())[0] || await browser.newPage();
async function boot() {
  page.setDefaultTimeout(60000);
  try { await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]) } catch (_) {}
  await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined', { timeout: 120000 });
  if (await page.evaluate(() => store.get('cardCode', '')) !== CODE) {
    await page.evaluate(code => { restoreDialog(code); return 0 }, CODE);
    await page.waitForSelector('#kIn');
    for (let i = 0; i < 10 && await page.evaluate(() => store.get('cardCode', '')) !== CODE; i++) {
      await page.evaluate(() => { const go = document.querySelector('#kGo'); if (go && !go.disabled) go.click() });
      await sleep(1500);
    }
    if (await page.evaluate(() => store.get('cardCode', '')) !== CODE) throw new Error('kort ikke koblet');
  }
  await sleep(1500);
  await page.evaluate(() => { const t = document.querySelector('#tUke'); if (t) t.click() });
  await sleep(2500);
  for (let k = 0; k < 12; k++) {
    const b = await page.evaluate(() => { const s = document.querySelector('#slip'); if (!s || document.querySelector('#veil').hidden) return null;
      const na = [...s.querySelectorAll('footer button')].find(x => /SPILL NÅ|FORTSETT/i.test(x.innerText) && !x.disabled); if (na) { na.click(); return na.innerText.trim() }
      return null });
    if (!b) break; say('inngang: ' + b); await sleep(1500);
  }
}
async function reattach() {
  try { const old = page; page = await browser.newPage(); try { await old.close() } catch (_) {} } catch (_) { page = await browser.newPage() }
  await boot(); say('re-attach ferdig');
}
await boot();
say('start', { profil: 'card-…' + TAG, mål: TARGET });

// ---------- tilstand ----------
const readSt = () => page.evaluate(() => (typeof S !== 'undefined' && S) ? {
  day: S.day, money: Math.round(S.money), rank: S.rankIdx, over: S.over, heat: Math.round(S.heat || 0), wk: !!S.wk,
  inv: Object.fromEntries(Object.entries(S.inv).filter(([k, v]) => v)) } : null);
const maktLine = async () => page.evaluate(() => { try {
  const p = maktParts(), nw = Math.round(netWorth());
  return { day: S.day, makt: p.m + p.d + p.g + p.s + p.r + p.b, m: p.m, d: p.d, g: p.g, s: p.s, r: p.r, b: p.b, nw, st: Math.round((S.status || 0) * 10) / 10,
    dist: Object.keys(S.dist || {}).length, fac: Object.entries(S.fac || {}).map(([k, f]) => k + f.lvl + (f.dead ? 'x' : '')).join(','),
    fr: Object.keys(S.fronts || {}).length, slag: Math.round(slag()), heat: Math.round(S.heat || 0), stash: Math.round(stashValue()) } } catch (e) { return { err: String(e).slice(0, 80) } } });

// ---------- empire-plan (kjøres i siden, leser bare tilstand) ----------
const PLAN = () => {
  if (!S || S.over) return null;
  const m = S.money, r = S.rankIdx, day = S.day;
  const fac = S.fac || {}, dist = S.dist || {}, fr = S.fronts || {};
  const nd = Object.values(dist).reduce((a, d) => a + d.dealers, 0);
  const mcost = nd * DEALER_WAGE + (S.chemist && fac.lab ? FACILITIES.lab.chem : 0) + (S.insider ? INSIDER_COST : 0) + (S.roid || 0) * ROID.bill;
  const reserve = (r < 3 ? Math.min(40000, m * 0.2) : 100000) + 2.5 * mcost;
  const av = m - reserve;
  const own = k => fac[k] && !fac[k].dead;
  const prodOn = own('farm') || own('lab') || own('finca');
  const nDist = Object.keys(dist).length;
  const sl = slag(), ppl = people(), wc = weaponCount();
  // 1) gjenoppbygg
  for (const k of ['finca', 'lab', 'farm']) if (fac[k] && fac[k].dead) { const c = Math.round(FACILITIES[k].price * .6); if (av >= c) return { tab: 'prod', sel: `[data-rebuild="${k}"]`, why: 'gjenoppbygg ' + k, cost: c } }
  // 2) gårder/produksjon med best avkastning
  if (r >= 3 && !fac.farm && av >= FACILITIES.farm.price) return { tab: 'prod', sel: '[data-buyfac="farm"]', why: 'kjøp farm', cost: FACILITIES.farm.price };
  // 4) gjeng / slagkraft (g maks ved slagkraft 200)
  if (sl < 205 && r >= 3) {
    const need = (k, n, mx, price, thr) => (n < mx && av > thr && av > price * (mx - n) * 1.2) ? k : null;
    const pick = need('f', S.friends, FRIEND.max, FRIEND.price, 120000) || need('g', S.tryg || 0, TRYG.max, TRYG.price, 250000) || need('t', S.torps, TORPEDO.max, TORPEDO.price, 500000)
      || need('r', S.roid || 0, ROID.max, ROID.price, 1200000) || (r >= 3 ? need('l', S.leg || 0, LEGION.max, LEGION.price, 2000000) : null);
    if (pick) return { tab: 'crew:k', sel: `[data-cfill="${pick}"]`, why: 'gjeng ' + pick, cost: 0 };
    if (wc < ppl && av > 3000000) return { tab: 'crew:v', sel: '[data-wbuy="ak"]', why: 'våpen ak', cost: 60000 };
  }
  // bydeler (trenger litt gjeng for å holde dem)
  if (r >= 3 && sl >= 40) for (const id of ['tveita', 'gron', 'toyen', 'lokka', 'plata', 'frogner']) {
    const D = DISTRICTS.find(x => x.id === id); if (dist[id] || !distStOk(id)) continue;
    if (av >= D.price + 20000) return { tab: 'street', sel: `[data-take="${id}"]`, why: 'bydel ' + id, cost: D.price };
  }
  if (r >= 3 && own('farm') && !fac.lab && av >= FACILITIES.lab.price + 20000) return { tab: 'prod', sel: '[data-buyfac="lab"]', why: 'kjøp lab', cost: FACILITIES.lab.price };
  if (own('lab') && S.chemist !== 'pro' && av >= PROCHEM * 2) return { tab: 'prod', sel: '[data-prochem]', why: 'proff-kjemiker', cost: PROCHEM };
  if (r >= 4 && !fac.finca && av >= FACILITIES.finca.price + 200000) return { tab: 'prod', sel: '[data-buyfac="finca"]', why: 'kjøp finca', cost: FACILITIES.finca.price };
  // 3) selgere: flere når det er varer å selge
  if (prodOn && nDist) {
    const prodEst = ['farm', 'lab', 'finca'].filter(k => own(k) && (k !== 'lab' || S.chemist)).reduce((a, k) => a + facOut(k, fac[k].lvl) * G[FACILITIES[k].good].price, 0);
    const cap = Object.keys(dist).reduce((a, id) => a + DISTRICTS.find(x => x.id === id).cap * dist[id].dealers * LVL_MULT[distLvl(dist[id])], 0);
    if (cap < prodEst * 1.15 && av > 60000) { const c = Object.keys(dist).filter(id => dist[id].dealers < distMax(id)).sort((a, b) => DISTRICTS.find(x => x.id === b).cap - DISTRICTS.find(x => x.id === a).cap)[0];
      if (c) return { tab: 'street', sel: `[data-dd="${c}"][data-n="1"]`, why: 'selger ' + c, cost: DEALER_WAGE } }
  }
  // 5) bedrifter (faste inntekter, club gir status) etter at produksjon og bydeler er på plass
  if (r >= 3 && (prodOn || av > 8000000)) {
    const list = FRONTS.filter(F => !fr[F.id] && F.rank <= r && !F.casino && !F.bg).sort((a, b) => (b.inc / b.price) - (a.inc / a.price) + (b.status ? .03 : 0) - (a.status ? .03 : 0));
    for (const F of list) if (av >= F.price * 1.4) return { tab: 'fronts', sel: `[data-front="${F.id}"]`, why: 'bedrift ' + F.id, cost: F.price };
  }
  // 6) oppgraderinger og innsider når vi har råd
  for (const k of ['farm', 'lab', 'finca']) if (own(k) && fac[k].lvl < 3) { const c = FACILITIES[k].up[fac[k].lvl - 1]; if (av > c * 8) return { tab: 'prod', sel: `[data-upfac="${k}"]`, why: 'oppgrader ' + k, cost: c } }
  if (!S.insider && av > 5000000) return { tab: 'prod', sel: '[data-ins="1"]', why: 'innsider', cost: INSIDER_COST };
  return null;
};

// ---------- ulike hjelpere ----------
async function closeTop() {
  await page.evaluate(() => { const s = document.querySelector('#slip'); if (!s) return;
    const b = [...s.querySelectorAll('footer button')].find(x => /lukk|close|ok/i.test(x.innerText) && !x.disabled) || s.querySelector('footer button'); if (b) b.click() });
  await sleep(500);
  if (await page.evaluate(() => !document.querySelector('#veil').hidden && !document.querySelector('.countrylist li>button'))) { try { await page.keyboard.press('Escape') } catch (_) {} await sleep(400) }
}
let EMP_LOGGED = 0;
async function manage() {
  let acted = 0;
  for (let round = 0; round < 8; round++) {
    const plan = await page.evaluate(PLAN).catch(e => ({ err: String(e).slice(0, 100) }));
    if (!plan) break;
    if (plan.err) { say('PLANFEIL', plan.err); break }
    const [tab, sub] = plan.tab.split(':');
    const open = tab === 'crew' ? `protDialog('${sub}')` : `empireDialog('${tab}')`;
    await page.evaluate(o => { new Function(o)() }, open);
    await sleep(900);
    if (!EMP_LOGGED) { EMP_LOGGED = 1; say('EMPDLG', await page.evaluate(() => [...document.querySelectorAll('#slip [data-tab]')].map(b => b.dataset.tab).join(','))) }
    const done = await page.evaluate(sel => { const b = document.querySelector('#slip ' + sel); if (!b || b.disabled || b.classList.contains('no')) return 'ingen'; b.click(); return 'ok' }, plan.sel);
    say('EMPIRE ' + plan.why + ' → ' + done);
    await sleep(900);
    if (done !== 'ok') { await closeTop(); break }
    acted++;
    // tillat kjøpsscener å spille ut; hoved-løkka tar dem. Lukk dialogen hvis den ligger igjen.
    for (let k = 0; k < 6; k++) {
      const st = await page.evaluate(() => { const s = document.querySelector('#slip'); if (document.querySelector('#veil').hidden) return 'free';
        return (s && s.classList.contains('empslip')) || (s && s.classList.contains('crewslip')) ? 'dlg' : 'scene' });
      if (st === 'free') break;
      if (st === 'dlg') { await closeTop(); continue }
      return acted; // en scene: la hovedløkka håndtere
    }
  }
  return acted;
}

// ---------- hovedløkke (som onkel.mjs + manage + vakthund) ----------
const clickModal = async (st) => {
  const cl = await page.evaluate(() => [...document.querySelectorAll('.countrylist li>button')].map(b => b.dataset.id));
  if (cl.length) {
    const cid = st.money < 2e6 ? 'se' : 'de';
    await page.evaluate(c => { const b = document.querySelector('.countrylist li>button[data-id=' + "'" + c + "']"); if (b) b.click() }, cid);
    say('→ land valgt: ' + cid); await sleep(600);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#slip button')].find(x => /reis hit/i.test(x.innerText)); b && b.click() });
    await sleep(900);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#slip a,#slip button')].find(x => /hopp over/i.test(x.innerText || '')); b && b.click() });
    await sleep(1200); return true;
  }
  const info = await page.evaluate(() => { const s = document.querySelector('#slip');
    return { t: (s.querySelector('h3')?.textContent || '').trim(), body: s.querySelector('.body').innerText.replace(/\s+/g, ' ').slice(0, 110),
      fbs: [...s.querySelectorAll('footer button')].map(b => ({ t: b.innerText.trim().slice(0, 24), dis: b.disabled })) } });
  say('MODAL "' + info.t + '" | dag ' + st.day + ' kr ' + st.money + ' rang ' + st.rank + ' | ' + info.fbs.map(b => b.t).join('/') + ' | ' + info.body.slice(0, 70));
  // Gudfar-valget: «Fortsett», aldri «Avslutt»
  const keep = await page.evaluate(() => { const b = [...document.querySelectorAll('#slip footer button')].find(x => /^fortsett$|^keep playing$/i.test(x.innerText.trim()) && !x.disabled); if (b) { b.click(); return true } return false });
  if (keep) { say('→ fortsetter spillet'); await sleep(1200); return true }
  const scn = await page.evaluate(() => { const s = document.querySelector('#slip');
    const out = s.querySelector('.scnout'); if (out && !out.hidden && out.querySelector('.sbtn')) { out.querySelector('.sbtn').click(); return 'out' }
    const it = s.querySelector('.scnitem.on .sbtn'); if (it) { it.click(); return 'item' }
    const nb = [...s.querySelectorAll('.body button')].find(b => b.offsetParent && !b.disabled && /^(VIDERE|OK|NESTE)$/i.test(b.innerText.trim())); if (nb) { nb.click(); return 'next' }
    const ch = s.querySelector('.scnchoices.on [data-c]'); if (ch) { ch.click(); return 'choice' }
    return null });
  if (scn) { say('→ scn: ' + scn); await sleep(1000); return true }
  const kf = await page.evaluate(() => { const s = document.querySelector('#slip'); const C = s.querySelector('#fChoices'); if (!C || C.hidden) return null;
    const odds = (s.querySelector('.odds')?.innerText || '').replace(/\s+/g, ' ');
    const pc = +(odds.match(/(\d+)\s*%/) || [])[1];
    const bs = [...C.querySelectorAll('.choice')];
    const f = bs.find(b => b.dataset.c === 'fight');
    const y = bs.find(b => /yield|flee/i.test(b.dataset.c)) || bs.find(b => b !== f);
    const want = f && (isNaN(pc) ? true : pc >= 50) ? f : y;
    if (!want) return { odds, act: 'ingen' };
    want.click();
    return { odds, act: (want.dataset.c || '?') + (isNaN(pc) ? '' : ' @' + pc + '%') } });
  if (kf) { say('→ konfrontasjon: ' + kf.act + ' | ' + kf.odds.slice(0, 40)); await sleep(1200); return true }
  const fh = await page.evaluate(() => { const b = [...document.querySelectorAll('#slip footer button,#slip .body button')].find(x => /gatepris/i.test(x.innerText) && !x.disabled); if (b) { b.click(); return true } return false });
  if (fh) { say('→ forhandling: gatepris'); await sleep(1200); return true }
  const buy = await page.evaluate(() => !!document.querySelector('#buyOk'));
  if (buy) {
    const did = await page.evaluate(() => { const num = t => +String(t).replace(/[^0-9]/g, '') || 0;
      const rows = [...document.querySelectorAll('#slip tbody tr')];
      let budget = Math.min(S.money * 0.9, S.money - 2500); if (budget < 1000) return 'tom';
      let put = false;
      for (const r of rows) { const inp = r.querySelector('input[type=number]'); if (!inp) continue;
        const price = num(r.querySelectorAll('td')[1].textContent);
        const mx = Math.min(+inp.max || 1e9, 80);
        if (!price) continue;
        const q = Math.min(mx, Math.floor(budget / price), 80);
        if (q > 0 && budget >= q * price) { inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); budget -= q * price; put = true } }
      return put ? 'satt' : 'tom' });
    say('→ kjøp satt: ' + did); await sleep(400);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#slip footer button')].find(x => /kjøp/i.test(x.innerText) && !x.disabled); b && b.click() });
    await sleep(1200); return true;
  }
  const sold = await page.evaluate(() => { if (!document.querySelector('#sellOk')) return false;
    const all = document.querySelector('#sellAll');
    if (all && !all.disabled) { all.click(); return true }
    const ok = document.querySelector('#sellOk');
    if (ok && !ok.disabled) { ok.click(); return true }
    const canc = [...document.querySelectorAll('#slip footer button')].find(b => /avbryt/i.test(b.innerText) && !b.disabled);
    if (canc) { canc.click(); return 'avbrutt' }
    return false });
  if (sold) { say('→ salg satt'); await sleep(1100); return true }
  const arr = await page.evaluate(() => { const ast = document.querySelector('#acStage'); if (!ast) return null;
    const opts = [...ast.querySelectorAll('.opt:not([disabled])')];
    const bail = opts.find(x => x.dataset.o === 'bail');
    if (bail) { const num = (bail.querySelector('.num') || {}).textContent || '0'; if (S.money >= +num.replace(/[^0-9]/g, '')) { bail.click(); return 'kausjon' } }
    const jail = opts.find(x => x.dataset.o === 'jail'); if (jail) { jail.click(); return 'sone' } return null });
  if (arr) { say('→ arrest: ' + arr); await sleep(1200); return true }
  const fb = await page.evaluate(() => { const s = document.querySelector('#slip');
    const vis = [...s.querySelectorAll('button,a,[data-c],.sbtn')].filter(b => b.offsetParent && !b.disabled && !/gi opp|avslutt|hi-score|bestikk|sats|kasino|lotto/i.test(b.innerText || ''));
    const p = vis.find(b => b.closest('footer') && b.className.includes('primary')) || vis.find(b => b.closest('footer')) || vis[vis.length - 1];
    if (p) { p.click(); return 'klikk: ' + (p.innerText || p.className).trim().slice(0, 30) }
    return 'INGEN knapp: ' + s.innerHTML.replace(/\s+/g, ' ').slice(0, 300) });
  say('→ ' + fb);
  if (fb.startsWith('INGEN')) { await page.keyboard.press('Escape'); await page.mouse.click(5, 5) }
  await sleep(1000); return true;
};

let lastBuy = -99, lastManage = -99, lastLog = -1, lastDay = -1, lastProg = Date.now(), tick = 0, waitN = 0;
while (true) { try {
  let st = null;
  try { st = await readSt() } catch (e) { say('lesefeil — re-attach'); try { await reattach() } catch (e2) { say('re-attach feil: ' + String(e2.message).slice(0, 60)) } await sleep(3000); continue }
  if (!st) { say('S borte — ukens slutt?'); break }
  if (st.over) { say('OVER dag ' + st.day); break }
  if (st.day >= TARGET) { say('MÅL nådd dag ' + st.day); break }
  // vakthund
  if (st.day !== lastDay) { lastDay = st.day; lastProg = Date.now() }
  const idle = (Date.now() - lastProg) / 1000;
  if (idle > 240) { say('VAKTHUND: ingen dagfremgang på ' + Math.round(idle) + ' s — re-attach'); lastProg = Date.now(); try { await reattach() } catch (e2) { say('re-attach feil: ' + String(e2.message).slice(0, 60)) } continue }
  if (idle > 90 && idle < 100) { say('VAKTHUND: stille, trykker Escape'); try { await page.keyboard.press('Escape') } catch (_) {} }
  if (Math.floor(st.day / 100) !== lastLog) { lastLog = Math.floor(st.day / 100); say('MAKT', await maktLine(), { min: Math.round((Date.now() - T0) / 60000) }) }
  if (++tick % 15 === 0) say('STATUS dag ' + st.day + ' kr ' + st.money + ' rang ' + st.rank + ' heat ' + st.heat);
  const veil = await page.evaluate(() => !document.querySelector('#veil').hidden);
  if (veil) { await clickModal(st); continue }
  if (st.heat > 30) { await page.evaluate(() => { layLow() }); say('→ ligger lavt (heat ' + st.heat + ')'); await sleep(1200); continue }
  const nInv = Object.values(st.inv).reduce((a, b) => a + b, 0);
  if (nInv > 0) { await page.evaluate(() => { doSell() }); say('→ selger ' + nInv + ' enheter'); await sleep(1200); continue }
  if (st.day - lastManage >= 4 && st.rank >= 1 && st.money > 20000) { lastManage = st.day; const n = await manage(); if (n) continue }
  if (st.money < 9000) {
    if (st.money < 2500) { const ln = await page.evaluate(() => { try { if (typeof S !== 'undefined' && !S.loan && typeof loanDialog === 'function') { loanDialog(); return 'lån' } } catch (_) {} return null }); if (ln) { say('→ blakk: ber om lån'); await sleep(2000); continue } }
    await page.evaluate(() => { waitDay() }); if (++waitN % 25 === 0) say('→ venter (kr ' + st.money + ' dag ' + st.day + ')'); await sleep(st.money < 5000 ? 400 : 1000); continue }
  if (st.day - lastBuy < TRIPGAP) { await page.evaluate(() => { waitDay() }); await sleep(900); continue }
  lastBuy = st.day;
  const cid = st.money < 2e6 ? 'se' : 'de';
  await page.evaluate(c => { window._planCountry = c }, cid);
  await page.evaluate(() => { doBuy() }); say('→ kjøper tur (' + cid + ') kr ' + st.money);
  await sleep(1500);
  } catch (e) { say('ramme-feil: ' + String(e.message).slice(0, 80) + ' — reloader');
    try { await reattach() } catch (e2) { say('re-attach feil: ' + String(e2.message).slice(0, 60)) }
    await sleep(2000); continue
  } }
say('SLUTT', await maktLine().catch(() => null), { min: Math.round((Date.now() - T0) / 60000) });
await sleep(3000);
await browser.close();
