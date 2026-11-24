// Gudfar extras for the main card (load after bot.js). Only the game's own buttons and dialogs.
// - Production: farm, lab and finca bought and upgraded to level 3 (rebuilt when destroyed).
// - Underbosses: both hired, bonus until loyalty 100.
// - Family meeting: Ali's recommended option.
// - Vålerenga: buy the club when cash allows; each match week fix the special and bet the max on it when
//   its odds are above EX_CFG.minOdds.
{
const X = (fn, arg) => tab.evaluate(fn, arg);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CFG = globalThis.EX_CFG = Object.assign({ minOdds: 20, vifBuyAt: 540e6, vifLastDay: 3560, bonusMin: 2e6, upMult: 3, cashKeep: 25e6, minStake: 1e6 }, globalThis.EX_CFG || {});
globalThis.EXLOG = [];
const log = s => { EXLOG.push(s); if (EXLOG.length > 300) EXLOG.shift(); if (globalThis.EX_SAY) EX_SAY('EX ' + s) };
const ST = globalThis.EXST = { lastFac: -99, lastBoss: -99, lastBet: -99 };
const veilOpen = () => X(() => { const v = document.querySelector('#veil'); return !!(v && !v.hidden) });
async function primaryClose(n = 8) {
  for (let k = 0; k < n; k++) {
    if (!(await veilOpen())) return;
    const c = await X(() => { const b = [...document.querySelectorAll('#slip footer button')].filter(b => !b.disabled); const p = b.find(b => b.classList.contains('primary')) || b.find(b => /LUKK|VIDERE|NESTE|TILBAKE|OK|SENERE/i.test(b.innerText)) || b[0]; if (p) { p.click(); return p.innerText.trim() } return null });
    if (!c) return; await sleep(700);
  }
}

// ---- production ----
async function facStep(s) {
  if (s.rank < 3 || s.day - ST.lastFac < 14) return null;
  ST.lastFac = s.day;
  const plan = await X((mult) => {
    const out = [];
    for (const [id, F] of Object.entries(FACILITIES)) {
      if (S.rankIdx < (F.rank || 0)) continue;
      const f = S.fac && S.fac[id];
      if (!f) { if (S.money > F.price * mult) out.push(['buyfac', id]); continue }
      if (f.dead) { if (S.money > F.price * .6 * mult) out.push(['rebuild', id]); continue }
      const lvl = f.lvl || 1, cost = F.up && F.up[lvl - 1];
      if (cost && S.money > cost * mult) out.push(['upfac', id]);
    }
    return out;
  }, CFG.upMult);
  if (!plan.length) return null;
  const done = [];
  for (const [kind, id] of plan) {
    await closeAll(); await X(() => { setTimeout(() => empireDialog('prod'), 10) }); await sleep(1500);
    const r = await X(([kind, id]) => { const b = document.querySelector(`#slip [data-${kind}="${id}"]`); if (b && !b.disabled && !b.classList.contains('no')) { b.click(); return 'ok' } return 'nobtn' }, [kind, id]);
    await sleep(1500); await primaryClose(); await closeAll();
    done.push(kind + ':' + id + ':' + r);
  }
  log('fac ' + done.join(','));
  return 'fac ' + done.join(',');
}

// ---- underbosses ----
async function bossStep(s) {
  if (s.rank < 5 || s.day - ST.lastBoss < 10) return null;
  ST.lastBoss = s.day;
  const b = await X(() => ({ dist: S.boss && S.boss.dist ? S.boss.dist.loy : null, prod: S.boss && S.boss.prod ? S.boss.prod.loy : null, m: S.money }));
  const need = ['dist', 'prod'].filter(k => b[k] == null || b[k] < 100);
  const vNeed = await X(() => !!(S.vif && S.vif.own && (!(S.vif.mort && !S.vif.sold) || (S.vif.loy | 0) < 100)));
  if ((!need.length && !vNeed) || b.m < CFG.bonusMin) return null;
  const done = [];
  for (const k of need) {
    for (let n = 0; n < 4; n++) {
      const cur = await X(k => S.boss && S.boss[k] ? S.boss[k].loy : null, k);
      if (cur != null && cur >= 100) break;
      if ((await X(() => S.money)) < CFG.bonusMin) break;
      await closeAll(); await X(() => { setTimeout(() => familyDialog(), 10) }); await sleep(1500);
      const sel = cur == null ? `[data-bhire="${k}"]` : `[data-bonus="${k}"]`;
      const r = await X(sel => { const b = document.querySelector('#slip ' + sel); if (b && !b.disabled) { b.click(); return 'ok' } return 'nobtn' }, sel);
      await sleep(1500); await primaryClose(); await closeAll();
      done.push(k + (cur == null ? ':hire' : ':bonus') + ':' + r);
      if (r !== 'ok') break;
    }
  }
  // «Mester» Morten, the club's head (heat rises 15 % slower in the season): hire, then bonus to 100
  for (let n = 0; n < 4; n++) {
    const v = await X(() => S.vif && S.vif.own ? { has: !!(S.vif.mort && !S.vif.sold), loy: S.vif.loy | 0, m: S.money } : null);
    if (!v || (v.has && v.loy >= 100) || v.m < CFG.bonusMin) break;
    await closeAll(); await X(() => { setTimeout(() => familyDialog(), 10) }); await sleep(1500);
    const sel = v.has ? '[data-vbonus="1"]' : '[data-vhire="1"]';
    const r = await X(sel => { const b = document.querySelector('#slip ' + sel); if (b && !b.disabled) { b.click(); return 'ok' } return 'nobtn' }, sel);
    await sleep(1800); await primaryClose(); await closeAll();
    done.push('morten' + (v.has ? ':bonus' : ':hire') + ':' + r);
    if (r !== 'ok') break;
  }
  const a = await X(() => ({ dist: S.boss && S.boss.dist ? S.boss.dist.loy : null, prod: S.boss && S.boss.prod ? S.boss.prod.loy : null, morten: S.vif && S.vif.mort && !S.vif.sold ? S.vif.loy : null }));
  log('boss ' + done.join(',') + ' -> ' + JSON.stringify(a));
  return done.length ? 'boss ' + done.join(',') : null;
}

// ---- Vålerenga ----
async function vifBuy(s) {
  if (s.rank < 5 || s.vif || s.money < CFG.vifBuyAt || s.day > CFG.vifLastDay) return null;
  await closeAll(); await X(() => { setTimeout(() => vifTap(), 10) }); await sleep(1500);
  const r = await X(() => { const b = [...document.querySelectorAll('#slip footer button')].find(b => /KJØP KLUBBEN/i.test(b.innerText)); if (b && !b.disabled) { b.click(); return 'ok' } return 'nobtn' });
  await sleep(2000);
  // newspaper → Neste; Morten (trainer) → Senere
  for (let k = 0; k < 8 && await veilOpen(); k++) {
    const c = await X(() => { const b = [...document.querySelectorAll('#slip footer button')].filter(b => !b.disabled); const x = b.find(b => /SENERE/i.test(b.innerText)) || b.find(b => /NESTE|VIDERE|LUKK|OK/i.test(b.innerText)) || b.find(b => b.classList.contains('primary')) || b[0]; if (x) { x.click(); return x.innerText.trim() } return null });
    if (!c) break; await sleep(900);
  }
  await closeAll();
  const own = await X(() => !!(S.vif && S.vif.own));
  log('vif buy ' + r + ' own=' + own);
  return 'vif-buy ' + r;
}
async function vifBet(s) {
  if (!s.vif || s.day - ST.lastBet < 1 || s.hasBet) return null;
  const m = new Date(s.date).getMonth(); if (m < 2 || m > 10) return null;
  ST.lastBet = s.day;
  // en gevinst koster ~+85 mistenkt uansett innsats, så bare full takst (5 mill) lønner seg: vent til sus < 40,
  // sitt ut 3-4 kampers avklinging i stedet for å fyre kvart-størrelser som låser suspicion høyere
  const sus = await X(() => typeof ulSus === 'function' ? ulSus() : 0);
  if (sus >= (CFG.susMax || 40)) { if (ST.lastSusLog !== s.day) { ST.lastSusLog = s.day; log(`bet skip: Glenn mistror oss (sus ${sus})`) } return null }
  // Glenn cuts his till after a big win (50 000 or 25 % of normal); only bet when he takes at least CFG.minStake
  const mx = await X(() => typeof ulMax === 'function' ? ulMax(true) : 0);
  if (mx < CFG.minStake) { if (ST.lastSkipMx !== s.day) { ST.lastSkipMx = s.day; log(`bet skip: Glenn tar maks kr ${mx}`) } return null }
  await closeAll(); await X(() => { setTimeout(() => ulokkaDialog(), 10) }); await sleep(1500);
  await X(() => document.querySelector('#slip [data-ut="v"]')?.click()); await sleep(1000);
  const spec = await X(() => { const b = document.querySelector('#slip .ulopts button.spec'); if (!b) return null; const o = (b.querySelector('small')?.innerText || '').replace(',', '.').match(/[\d.]+/); return { bt: b.dataset.bt, odds: o ? +o[0] : 0, txt: b.innerText.replace(/\s+/g, ' ').slice(0, 80) } });
  if (!spec || spec.odds < CFG.minOdds) { await closeAll(); if (spec) log(`bet skip ${spec.bt} odds ${spec.odds}`); return null }
  // fix the special first (raises Glenn's cap to 5 mill), then pick the special, the largest stake and place it
  const fix = await X(() => { const b = document.querySelector('#slip .ulfix [data-fx="spec"]'); if (b && !b.disabled) { b.click(); return b.innerText.trim() } return null });
  await sleep(1200);
  if (!(await X(() => !!document.querySelector('#slip .ulopts')))) { await primaryClose(2); await X(() => { setTimeout(() => ulokkaDialog(), 10) }); await sleep(1500); await X(() => document.querySelector('#slip [data-ut="v"]')?.click()); await sleep(1000) }
  const placed = await X(async () => {
    const sp = document.querySelector('#slip .ulopts button.spec'); if (!sp) return 'nospec'; sp.click(); await new Promise(r => setTimeout(r, 500));
    const coins = [...document.querySelectorAll('#slip button.ulcoin')].filter(b => !b.disabled); if (!coins.length) return 'nocoin';
    coins[coins.length - 1].click(); await new Promise(r => setTimeout(r, 500));
    const p = document.querySelector('#slip #ulPlace'); if (!p || p.disabled) return 'noplace';
    const t = p.innerText.trim(); p.click(); return t;
  });
  await sleep(1200); await primaryClose(3); await closeAll();
  const bet = await X(() => S.ulk && S.ulk.bet ? { ...S.ulk.bet } : null);
  log(`bet ${spec.bt} odds ${spec.odds} fix=${fix} -> ${placed} ${JSON.stringify(bet)}`);
  return 'bet ' + spec.bt + ' ' + placed;
}

// ---- helicopter (HQ · Folk): bought once, +40 firepower and a 50 % chance to fly away from a big raid ----
async function heliStep(s) {
  if (s.day - (ST.lastHeli ?? -99) < 15) return null;
  ST.lastHeli = s.day;
  const h = await X(() => typeof HELI === 'undefined' ? null : { own: !!S.heli, can: S.rankIdx >= HELI.rank, price: HELI.price, m: S.money });
  if (!h || h.own || !h.can || h.m < h.price * 3 + 2e6) return null;
  await closeAll(); await X(() => document.querySelector('#aProt')?.click()); await sleep(1200);
  let r = 'nobtn';
  for (const tabId of [null, 'u', 'v', 'k', 'f', 'w']) {
    if (tabId) { const ok = await X(t => { const b = document.querySelector(`#slip [data-tab="${t}"]`); if (b) { b.click(); return true } return false }, tabId); if (!ok) continue; await sleep(800) }
    r = await X(() => { const b = document.querySelector('#slip [data-heli="buy"]'); if (b && !b.disabled) { b.click(); return 'ok' } return 'nobtn' });
    if (r === 'ok') break;
  }
  await sleep(1000); await closeAll();
  const own = await X(() => !!S.heli);
  log(`heli ${r} own=${own} (kr ${h.price})`);
  return own ? 'heli bought' : null;
}

// ---- gear (HQ · Folk/Utstyr): mobile phone from 1993 (−40 % undercover police, −15 % customs risk);
//      a new prepaid card when the police tap it (from 1994) ----
async function hqClick(sel) {
  await closeAll(); await X(() => document.querySelector('#aProt')?.click()); await sleep(1200);
  let r = 'nobtn';
  for (const tabId of [null, 'u', 'v', 'k', 'f', 'w']) {
    if (tabId) { const ok = await X(t => { const b = document.querySelector(`#slip [data-tab="${t}"]`); if (b) { b.click(); return true } return false }, tabId); if (!ok) continue; await sleep(800) }
    r = await X(sel => { const b = document.querySelector('#slip ' + sel); if (b && !b.disabled && !b.classList.contains('no')) { b.click(); return 'ok' } return 'nobtn' }, sel);
    if (r === 'ok') break;
  }
  await sleep(1000); await closeAll();
  return r;
}
// ---- lawyer: Tor Engen Straff (best, kr 1 mill + 15 000 per case) as soon as cash allows ----
async function lawyerStep(s) {
  if (s.day - (ST.lastLaw ?? -99) < 10) return null;
  ST.lastLaw = s.day;
  const l = await X(() => ({ cur: S.lawyer == null ? -1 : S.lawyer, top: LAWYERS.length - 1, price: LAWYERS[LAWYERS.length - 1].price, m: S.money }));
  if (l.cur >= l.top || l.m < l.price * 3 + 500000) return null;
  await closeAll(); await X(() => document.querySelector('#aProt')?.click()); await sleep(900);
  await X(() => document.querySelector('#slip [data-syn="law"]')?.click()); await sleep(900);
  const r = await X(i => { const b = document.querySelector(`#slip [data-hire="${i}"]`); if (b && !b.disabled && !b.classList.contains('no')) { b.click(); return 'ok' } return 'nobtn' }, l.top);
  await sleep(1200); await primaryClose(3); await closeAll();
  const now = await X(() => S.lawyer);
  log(`lawyer ${r} -> ${now === l.top ? 'Tor Engen Straff' : now}`);
  return now === l.top ? 'lawyer Tor Engen Straff' : null;
}
async function phoneStep(s) {
  if (s.day - (ST.lastPhone ?? -99) < 10) return null;
  ST.lastPhone = s.day;
  const p = await X(() => typeof PHONE === 'undefined' ? null : { own: !!S.phone, tap: !!S.tap, can: typeof phoneAvail === 'function' && phoneAvail(), price: PHONE.price, m: S.money });
  if (!p) return null;
  if (p.own && p.tap && p.m > 50000) { const r = await hqClick('[data-sim]'); if (r !== 'ok') ST.lastPhone = s.day + 50; log(`phone new sim ${r} tap=${await X(() => !!S.tap)}`); return 'sim ' + r }
  const rd = await X(() => typeof RADIO === 'undefined' ? null : { own: !!S.radio, can: typeof radioAvail === 'function' && radioAvail(), price: RADIO.price, m: S.money });
  if (rd && !rd.own && rd.can && rd.m > rd.price * 3 + 100000) { const r = await hqClick('[data-radio]'); log(`radio buy ${r} own=${await X(() => !!S.radio)} (kr ${rd.price})`); return 'radio ' + r }
  if (!p.own && p.can && p.m > p.price * 3 + 100000) { const r = await hqClick('[data-phone]'); log(`phone buy ${r} own=${await X(() => !!S.phone)} (kr ${p.price})`); return 'phone ' + r }
  return null;
}

// ---- gang to 2000 makt (10 per firepower) and all six districts (500 each), as Gudfar ----
async function gangStep(s) {
  if (s.rank < 5 || s.day - (ST.lastGang ?? -99) < 20) return null;
  ST.lastGang = s.day;
  const g = await X(() => ({ slag: slag(), m: S.money, free: DISTRICTS.filter(d => !(S.dist || {})[d.id]).map(d => d.id) }));
  const out = [];
  if (g.slag < 200 && g.m > 3e6) {
    await closeAll(); await X(() => document.querySelector('#aProt')?.click()); await sleep(900);
    for (const sel of ['[data-cfill="f"]', '[data-cfill="t"]', '[data-cfill="g"]', '[data-cfill="r"]', '[data-cfill="s"]', '[data-hire="l"]']) {
      out.push(await hqBuy(sel));
      if (!(await X(() => !!document.querySelector('#slip [data-tab="k"]')))) { await closeAll(); await X(() => document.querySelector('#aProt')?.click()); await sleep(900) }
    }
    await X(() => document.querySelector('#slip [data-tab="v"]')?.click()); await sleep(700);
    out.push('w:' + await X(() => { const b = [...document.querySelectorAll('#slip [data-wfill="tg"]')].filter(b => !b.disabled).pop(); if (b) { b.click(); return b.dataset.n } return 0 }));
    await sleep(900); await closeAll();
  }
  for (const id of g.free.slice(0, 2)) if ((await X(() => S.money)) > 5e6) { await openRoom('gata', 'street'); out.push(id + ':' + await hqBuy(`[data-take="${id}"]`)); await closeAll() }
  if (!out.length) return null;
  const a = await X(() => ({ slag: slag(), dist: Object.keys(S.dist || {}).length, makt: makt() }));
  log('gang ' + out.join(',') + ' -> ' + JSON.stringify(a));
  return 'gang-push';
}

// ---- optional (CFG.vifGamble): one bold roulette run at Byens kasinoer to afford Vålerenga early ----
async function vifGambleStep(s) {
  if (!CFG.vifGamble || s.rank < 5 || s.vif || ST.vifGambled || s.day > (CFG.vifGambleBy || 2557)) return null;
  if (typeof BOT_SR_GAMBLE !== 'function') return null;
  const m = await X(() => S.money);
  if (m < (CFG.vifGambleMin || 100e6) || m >= CFG.vifBuyAt) return null;
  ST.vifGambled = true;
  const target = CFG.vifBuyAt + 20e6;
  log(`vif gamble from kr ${Math.round(m)} to ${target}`);
  const after = await BOT_SR_GAMBLE(target);
  log(`vif gamble result kr ${Math.round(after)}`);
  return 'vif-gamble ' + Math.round(after);
}

// ---- Swiss bank: open it, keep only working cash on hand, and pull it all out when Vålerenga is affordable ----
async function bankStep(s) {
  if (s.rank < 4 || s.day - (ST.lastBank ?? -99) < 7) return null;
  ST.lastBank = s.day;
  const b = await X(() => ({ open: !!S.swiss, bal: S.swiss ? S.swiss.bal || 0 : 0, pend: S.swiss ? (S.swiss.pend || []).reduce((a, p) => a + p.a, 0) : 0, m: S.money, own: !!(S.vif && S.vif.own), frozen: !!(S.swiss && (S.swiss.frozen || S.swiss.freeze)) }));
  const wantVif = !b.own && s.rank >= 5 && s.day <= CFG.vifLastDay - 14 && b.bal + b.pend + b.m >= CFG.vifBuyAt / .98;
  let act = null;
  const dep = CFG.deposit === 'afterVif' ? b.own : CFG.deposit !== false;
  if (!b.open) act = dep && b.m > BANKKEEP() + 300000 ? 'open' : null;
  else if (wantVif && b.bal > 0) act = 'out';
  else if (!wantVif && dep && b.m >= 2 * BANKKEEP()) act = 'in';
  if (!act) return null;
  await closeAll(); await X(() => { setTimeout(() => bankDialog(), 10) }); await sleep(1500);
  const r = await X(async ([act, keep]) => {
    const q = s => document.querySelector('#slip ' + s), w = ms => new Promise(r => setTimeout(r, ms));
    if (act === 'open') { const o = q('#bOpen'); if (!o || o.disabled) return 'noopen'; o.click(); await w(600) }
    if (act === 'out') { const o = q('[data-out="1"]'); if (!o || o.disabled) return 'noout'; o.click(); return 'out' }
    let n = 0;
    for (; n < 12; n++) { const f = S.money >= 2 * keep ? '0.5' : S.money >= keep / .75 ? '0.25' : null; if (!f) break; const x = q(`[data-in="${f}"]`); if (!x || x.disabled) break; x.click(); await w(300) }
    return act + ' x' + n;
  }, [act, BANKKEEP()]);
  await sleep(600); await closeAll();
  const a = await X(() => ({ m: Math.round(S.money), bal: S.swiss ? Math.round(S.swiss.bal || 0) : 0 }));
  log(`bank ${r} -> ${JSON.stringify(a)}`);
  return 'bank ' + r;
}
const BANKKEEP = () => CFG.cashKeep;

// ---- Skap 214: ny gjenstand hver dag kl. 18 (ekte tid). Åpne, legg i samlingen, bruk det som hjelper. ----
// Ikke brukt automatisk: pris (bare en prisliste), glenn (spilleautomat), trofeer og boblejakka.
const BX_SKIP = ['pris', 'glenn', 'boble'];
async function skapStep(s) {
  const k = await X(skip => { if (typeof bxReady !== 'function' || !S || !S.bx) return null; const K = S.bx;
    const use = BX_ITEMS.filter(x => (K.inv[x[0]] || 0) > 0 && x[2] !== 'trofe' && !skip.includes(x[0]) && !bxCan(x[0])).map(x => x[0]);
    return { ready: bxReady(), waitU: K.watch && K.watch.d === bxDrop() ? (K.watch.u || 0) : 0, use, n: K.n } }, BX_SKIP);
  if (!k) return null;
  const open = () => X(() => { const b = document.querySelector('#bxBtn') || document.querySelector('#bxBtn2'); if (!b) return false; b.click(); return true });
  if (k.ready && Date.now() >= k.waitU) { if (await open()) { log(`skap open (${k.n}/30)`); await wait(500); return 'skap open' } }
  if (k.use.length && ST.bxDay !== s.day) { ST.bxDay = s.day; if (await open()) { log('skap bruk ' + k.use.join(',')); await wait(500); return 'skap use' } }
  return null;
}
async function skapDialog(inf) {
  const r = await X(skip => { const s = document.querySelector('#slip'); if (!s) return null;
    const u = [...s.querySelectorAll('[data-bxu]')].find(b => !b.disabled && !skip.includes(b.dataset.bxu)); if (u) { u.click(); return 'skap use ' + u.dataset.bxu }
    const g = s.querySelector('.bxgo'); if (g) { g.click(); return 'skap go' } return null }, BX_SKIP);
  if (r) { log(r); await wait(400); return r }
  const en = inf.btns.filter(b => !b.dis);
  if (/bxcf/.test(inf.cls)) { // konfrontasjonen etter 30 leveranser: slåss bare når vi er sterke nok, ellers betal, ellers gi fra oss tingene
    const c = await X(() => { const r = Math.max(0, Math.min(5, S.rankIdx)); return { need: BX_NEED[r], p: Math.round(protection()), cost: BX_PAY[r], money: S.money } });
    const fight = en.find(b => b.primary), pay = en.find(b => !b.primary && /kr/i.test(b.t)), give = en.find(b => b !== fight && b !== pay);
    const b = c.p >= c.need ? fight : (pay || give || fight);
    if (b) { await clickIdx(b.i); log(`skap konfrontasjon ${b.t} (vern ${c.p}/${c.need})`); return 'skap cf' }
  }
  if (/To sivile/i.test(inf.title)) { const b = en.find(b => /time/i.test(b.t)); if (b) { await clickIdx(b.i); log('skap: sivile, kommer tilbake om en time'); return 'skap wait' } }
  const b = en.find(b => b.primary) || en[0];
  if (b) { await clickIdx(b.i); return 'skap ' + b.t.slice(0, 30) }
  return null;
}

// ---- Ring slekta (Hovedkvarteret → Slekta → Telefonen). Hver slektning én gang per figur. ----
// Gudfar-grener gir 25 % av formuen (maks 150 000), Imperiet-grener 35 % (maks 250 000), Mastermind 5 % (maks 20 000)
// og −10 søkelys, lavere rang bare −4 til −8 søkelys. Ring når utbetalingen er på maks, eller når vi er blakke
// (i stedet for Lånehaien), og de andre når søkelyset er høyt.
async function callStep(s) {
  if (ST.callDay === s.day) return null;
  ST.callDay = s.day;
  const want = await X(() => { if (!S || !S.dyn || S.wk || typeof dynCtx !== 'function' || typeof DYN_CALL === 'undefined') return null;
    const { f } = dynCtx(); if (!f || !f.b) return null; const calls = S.dyn.calls || {}; let nw = 0; try { nw = Math.max(0, netWorth()) } catch (_) {}
    const broke = S.money < 5000 && nw >= 300000, heat = S.heat || 0, out = []; // ring bare når utbetalingen er verdt det (Erfaringer: ring ved 600–700 k)
    const seen = new Set();
    for (const [k, b] of Object.entries(f.b)) { const sig = b.n + '|' + b.e + '|' + b.y; if (seen.has(sig)) continue; seen.add(sig); /* samme slektning to ganger (uhell) ringes bare én gang */
      if (calls[k]) continue; const c = DYN_CALL[b.e] || DYN_CALL.R0;
      const full = c.hi > 0 && nw * c.p >= c.hi;
      if ((c.hi > 0 && (full || broke)) || (c.h > 0 && heat >= 25)) out.push(k) }
    return out.length ? out : null });
  if (!want) return null;
  const n = await X(async ks => { slektaDialog(); await new Promise(r => setTimeout(r, 600)); let n = 0;
    for (const k of ks) { const b = document.querySelector(`#slip [data-call="${k}"]`); if (b && b.classList.contains('primary')) { b.click(); n++; await new Promise(r => setTimeout(r, 400)) } }
    return n }, want);
  await closeAll();
  if (n) { log(`ring slekta: ${n} samtaler`); return 'slekt ' + n }
  return null;
}

// ---- dialogs ----
const _h = globalThis.handle;
globalThis.handle = async inf => {
  if (/bxslip/.test(inf.cls)) { const r = await skapDialog(inf); if (r) return r }
  // «Hvilken gudfar blir du?» (ved Pusher, gjelder resten av spillet). Penger: +5 % salgspris og 5 % billigere innkjøp ute.
  if (/olchslip/.test(inf.cls)) {
    const r = await X(k => { const b = document.querySelector(`#slip .olch[data-k="${k}"]`) || document.querySelector('#slip .olch'); if (!b) return null; b.click(); return b.dataset.k }, CFG.olPath || 'money');
    if (r) { log('gudfar-valg ' + r); return 'olpath ' + r }
  }
  if (/fmslip/.test(inf.cls)) {
    const r = await X(() => { const s = document.querySelector('#slip'); const go = s.querySelector('#fmGo'); if (go && !go.disabled) { go.click(); return 'fm-next' }
      const c = [...s.querySelectorAll('.fmopts button.choice')].filter(b => !b.disabled); const b = c.find(b => b.classList.contains('primary')) || c[0]; if (b) { b.click(); return 'fm-pick ' + b.innerText.replace(/\s+/g, ' ').slice(0, 50) } return null });
    if (r) { log(r); return r }
  }
  return _h(inf);
};

const _ma = globalThis.mainAction;
globalThis.mainAction = async () => {
  const s = await X(() => S ? { day: S.day, date: dayDate(S.day).toISOString().slice(0, 10), rank: S.rankIdx, money: S.money, vif: !!(S.vif && S.vif.own), hasBet: !!(S.ulk && S.ulk.bet), imp: !!S.imp, wk: !!S.wk } : null);
  if (s && !s.wk) {
    try {
      const r = (await callStep(s)) || (await skapStep(s)) || (await facStep(s)) || (await bossStep(s)) || (await gangStep(s)) || (await vifGambleStep(s)) || (await lawyerStep(s)) || (await phoneStep(s)) || (await heliStep(s)) || (await vifBuy(s)) || (await vifBet(s)) || (await bankStep(s));
      if (r) return r;
    } catch (e) { log('ERR ' + String(e).slice(0, 120)); try { await closeAll() } catch (_) {} }
  }
  return _ma();
};
}
