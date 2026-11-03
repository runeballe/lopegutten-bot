// Achievement hunt layer. Load after bot.js and bergen.js.
const E = (fn, arg) => tab.evaluate(fn, arg);
globalThis.GOAL = globalThis.GOAL || { trial: 'free' };
globalThis.COAST = false;
let ACHC = null, ACHT = 0;
globalThis.ach = async (force) => { if (force || !ACHC || Date.now() - ACHT > 15000) { ACHC = await E(() => { const g = achStore(); return Object.fromEntries(ACH.map(a => [a.id, !!g[a.id]])) }); ACHT = Date.now() } return ACHC };
globalThis.X = () => E(() => {
  const d = dayDate(S.day), ev = evNow(), C = (typeof ct === 'function' ? ct() : {}) || {};
  return { day: S.day, y: d.getFullYear(), m: d.getMonth(), dd: d.getDate(), rank: S.rankIdx, gf: !!S.godfather, imp: !!S.imp, money: S.money, heat: S.heat || 0, status: S.status,
    inv: { ...S.inv }, stash: { ...(S.stash || {}) }, ev: ev ? { id: ev.id, to: ev.to } : null,
    trHer: S.trHer || 0, hansen: typeof hansenOn === 'function' && !!hansenOn(), phone: !!S.phone, fwLow: !!S.fwLow,
    dist: Object.fromEntries(Object.entries(S.dist || {}).map(([k, v]) => [k, v.dealers])), distSold: S.distSold || {}, vg: S.vg || {},
    cs: S.case ? { on: !!S.case.on, pg: S.case.pg, done: S.case.done || null } : null, lawyer: S.lawyer,
    vif: S.vif ? { own: !!S.vif.own, streak: S.vif.streak || 0 } : null, ulBet: !!(S.ulk && S.ulk.bet), via: (S.soldQ && S.soldQ.via) || 0, viaOn: viaOn(), heli: !!S.heli,
    dr: S.dr ? { on: drOn(), done: !!S.dr.done } : null, tl: S.tl ? { done: !!S.tl.done } : null,
    jobs: (S.jobs || []).map(j => ({ k: j.k, g: j.g, q: j.q, prog: j.prog || 0, c: j.c, until: j.until })) } });
const CMIN = { tr: 2, ru: 3, co: 5, th: 5 };
const need = {
  streak: a => !a.apotek || !a.nattev,
  ostvest: a => !a.ostvest,
};
// ---------- route ----------
const _route0 = globalThis.route;
globalThis.route = (gi) => {
  const R = globalThis._RX; if (!R || STATE.bgTrip) return (STATE.lastRoute = _route0(gi));
  if (STATE.forceRoute) { const r = STATE.forceRoute; STATE.forceRoute = null; return (STATE.lastRoute = r) }
  const a = R.a, x = R.x;
  const fj = x.jobs.filter(j => j.k === 'fetch' && j.c && j.prog < j.q && x.rank >= (CMIN[j.c] || 0) && j.until - x.day > 12).sort((p, q) => p.until - q.until);
  if (fj.length) return (STATE.lastRoute = fj[0].c);
  if (x.rank >= 2 && (!a.orient || !a.handel) && x.trHer < 1100) return (STATE.lastRoute = 'tr');
  if (x.rank >= 4 && !a.ostvest && ((x.inv.lsd | 0) + (x.stash.lsd | 0) < 300 || (x.inv.ecs | 0) + (x.stash.ecs | 0) < 300)) return (STATE.lastRoute = 'nl');
  if (x.rank >= 5 && !x.imp) {
    if (x.viaOn && !a.s_via && (x.inv.via | 0) < 1100) return (STATE.lastRoute = 'th');
    if (x.dr && x.dr.on) return (STATE.lastRoute = gi.flire === 'ru' ? 'pl' : 'ru');
    return (STATE.lastRoute = 'co');
  }
  return (STATE.lastRoute = _route0(gi));
};
// ---------- buy ----------
const _buy0 = globalThis.buyDialogAct;
globalThis.buyDialogAct = async () => {
  if (STATE.bgTrip) return _buy0();
  const R = globalThis._RX; const x = R ? R.x : await X(); const a = await ach();
  const title = (await info2()).title;
  const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, price: +c[1].innerText.replace(/\D/g, '') } }).filter(Boolean));
  const ids = rows.map(r => r.id), pr = Object.fromEntries(rows.map(r => [r.id, r.price]));
  const gp = await E(() => Object.fromEntries(GOODS.map(g => [g.id, g.price])));
  const DM = [1, 2, 3, 5, 10, 20][x.rank];
  const wages = Object.values(x.dist).reduce((s, d) => s + d * 8000, 0);
  let budget = Math.max(0, x.money - Math.max(3000, x.money * (x.rank >= 1 ? .12 : .03)) - wages - (x.rank >= 4 ? 300000 : 0));
  if (budget < 500) budget = Math.max(0, x.money - 300);
  const want = {}; const add = (g, q) => { if (ids.includes(g) && q > 0) want[g] = Math.max(want[g] || 0, Math.round(q)) };
  // jobs
  for (const j of x.jobs) { const left = j.q - j.prog; if (left <= 0) continue; if (j.k === 'fetch' && j.c === STATE.lastRoute) add(j.g, left + 5); if (j.k === 'sell') add(j.g, left - (x.inv[j.g] | 0) + 10) }
  if (/TYRKIA/.test(title) && (!a.orient || !a.handel)) add('her', Math.max(1100 - x.trHer, 600));
  if (!a.sykkel && x.rank >= 1) add('lsd', 80 - (x.inv.lsd | 0));
  if (need.streak(a) && x.rank >= 2) { add('her', 400 - (x.inv.her | 0)); add('amf', 400 - (x.inv.amf | 0)) }
  if (need.ostvest(a) && x.rank >= 4) for (const g of ['mar', 'her', 'amf', 'lsd', 'kok', 'ecs']) add(g, 400 - (x.inv[g] | 0) - (x.stash[g] | 0));
  if (/THAILAND/.test(title) && !a.s_via) add('via', 1300 - (x.inv.via | 0));
  if (x.rank >= 5 && !(x.tl && x.tl.done)) { add('spr', 2600 - (x.inv.spr | 0)); add('kok', 1300 - (x.inv.kok | 0)); add('mar', 3600 - (x.inv.mar | 0)) }
  if (x.dr && x.dr.on) delete want.kok;
  const q = {};
  for (const [g, n] of Object.entries(want)) { const k = Math.min(n, Math.floor(budget * .6 / pr[g])); if (k > 0) { q[g] = k; budget -= k * pr[g] } }
  // profit fill
  const mult = /RUSSLAND/.test(title) ? 450 : /COLOMBIA/.test(title) ? 900 : 250;
  const items = rows.map(r => ({ ...r, margin: (gp[r.id] - r.price) / r.price, target: Math.round(mult * DM * ({ pis: .15, bom: .28, via: .4 }[r.id] || 1)) - (x.inv[r.id] | 0) - (q[r.id] || 0) }))
    .filter(r => r.margin > (x.rank >= 2 ? .9 : .4) && !(x.dr && x.dr.on && r.id === 'kok')).sort((p, z) => z.margin * gp[z.id] - p.margin * gp[p.id]);
  const B0 = budget;
  for (const it of items) { const n = Math.max(0, Math.min(it.target, Math.floor(Math.min(budget, .6 * B0) / it.price))); if (n > 0) { q[it.id] = (q[it.id] || 0) + n; budget -= n * it.price } }
  await E((q) => { for (const [id, v] of Object.entries(q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, q);
  // tiger cub in Colombia
  if (!a.ct_zoo) await E(() => { const b = document.querySelector('#slip #ctTigB'); if (b && !b.disabled) b.click() });
  STATE.lastBuyVal = Object.entries(q).reduce((s, [k, n]) => s + n * gp[k], 0);
  const ok = await E(() => { const b = document.querySelector('#buyOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button').click(); return false });
  return 'buy ' + JSON.stringify(q) + (ok ? '' : ' (none)');
};
// ---------- sell ----------
const _sell0 = globalThis.sellAct;
globalThis.sellAct = async () => {
  const R = globalThis._RX;
  if (R && R.mode === 'streak') {
    const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n || n.disabled) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, have: +c[1].innerText.replace(/\D/g, ''), demand: +(c[2].innerText.match(/\d+/) || [0])[0] } }).filter(Boolean));
    const q = {};
    for (const r of rows) if (r.id === 'her' || r.id === 'amf' || r.id === 'lsd') q[r.id] = Math.max(0, Math.min(r.have, r.demand, Math.max(1, Math.floor(r.have / 9))));
    if (!Object.values(q).some(v => v > 0)) { await E(() => document.querySelector('#slip footer button').click()); return 'streak-nodemand' }
    await E((q) => { for (const [id, v] of Object.entries(q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, q);
    await wait(150); const ok = await E(() => { const b = document.querySelector('#sellOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button').click(); return false });
    return 'streak-sell ' + JSON.stringify(q) + (ok ? '' : ' x');
  }
  if (R && R.mode === 'nowait') { STATE.waits = 99 }
  return _sell0();
};
// ---------- helpers ----------
const waitDays = async (n) => { await closeAll(); await E(() => document.querySelector('#layLowBtn').click()); await wait(600);
  const ok = await E((n) => { const b = document.querySelector(`#slip [data-w="${n}"]:not([disabled])`) || document.querySelector('#slip [data-w="1"]:not([disabled])'); if (b) { b.click(); return b.dataset.w } return null }, n); if (!ok) await closeAll(); return 'wait' + ok };
const openSell = async () => { await E(() => document.querySelector('#aSell').click()); return 'sell' };
async function vifAct(x) {
  if (!x.ulBet) {
    await closeAll(); await E(() => { setTimeout(() => ulokkaDialog('v'), 10) }); await wait(1500);
    if (!(await E(() => !!document.querySelector('#slip [data-bs]')))) { await closeAll(); return waitDays(1) }
    await E(() => document.querySelector('#slip [data-fx="coach"]:not([disabled])')?.click()); await wait(700);
    await E(() => document.querySelector('#slip [data-bt="l"]')?.click()); await wait(200);
    await E(() => document.querySelector('#slip [data-bs="10000"]')?.click()); await wait(200);
    await E(() => document.querySelector('#slip #ulPlace:not([disabled])')?.click()); await wait(700);
    await closeAll(); return 'vif-bet streak=' + x.vif.streak;
  }
  return waitDays(7);
}
async function caseAct(x) {
  await closeAll(); await E(() => { setTimeout(() => caseDialog(), 10) }); await wait(1500);
  const did = [];
  for (const k of ['fav', 'law', 'wit']) { const ok = await E((k) => { const b = document.querySelector(`#slip [data-act="${k}"]`); if (b && !b.disabled) { b.click(); return true } return false }, k); if (ok) { did.push(k); await wait(1500); for (let i = 0; i < 6; i++) { const j = await info2(); if (!j || /OPERASJON|MAPPEN|SAKEN/i.test(j.title) && await E(() => !!document.querySelector('#slip [data-act]'))) break; await clickIdx((j.btns.find(b => b.primary && !b.dis) || j.btns.find(b => !b.dis) || { i: 0 }).i); await wait(600) } break } }
  await closeAll(); STATE.caseM = x.y * 12 + x.m; return 'case ' + did.join(',');
}
// ---------- main ----------
const _main0 = globalThis.mainAction;
globalThis.mainAction = async () => {
  const x = await X(), a = await ach(); globalThis._RX = { x, a, mode: null };
  globalThis.NOPROT = !x.fwLow && x.day < 700;
  globalThis.LAYLOW_AT = (x.rank >= 3 && x.hansen && x.phone && !a.mobring) ? 101 : 50;
  // VIF
  if (x.vif && x.vif.own && !a.vif_tap && x.m >= 2 && x.m <= 10) return vifAct(x);
  // case management (frifunn): keep folder 30..50 at 1 Sept 1999
  if (GOAL.trial === 'free' && x.cs && x.cs.on && !x.cs.done && x.y >= 1998 && STATE.caseM !== x.y * 12 + x.m) {
    const ml = Math.max(0, (1999 - x.y) * 12 + 8 - x.m), proj = x.cs.pg + 2.2 * ml;
    if (proj > 46) return caseAct(x);
    if (proj < 34) globalThis.LAYLOW_AT = 101;
  }
  if (GOAL.trial === 'flee' && x.cs && x.cs.on && !(x.dr && x.dr.on)) globalThis.LAYLOW_AT = 101;
  if (x.dr && x.dr.on) globalThis.LAYLOW_AT = 55;
  // streak during long events
  if (need.streak(a) && x.rank >= 2 && x.ev && (x.inv.her | 0) > 0 && (x.inv.amf | 0) > 0) { globalThis._RX.mode = 'streak'; return openSell() }
  // sykkel: sell LSD on 19 April
  if (!a.sykkel && x.rank >= 1 && x.m === 3 && x.dd <= 18) {
    if ((x.inv.lsd | 0) > 0) { const T = (x.y === 1992) ? 18 : 14; if (x.dd < T) return waitDays(1); if (x.dd === T) { globalThis._RX.mode = 'nowait'; return openSell() } }
    else if (x.dd <= 6) { STATE.forceRoute = 'se' }
  }
  if (!a.sykkel && x.rank >= 1 && x.m === 2 && x.dd >= 22 && (x.inv.lsd | 0) > 0) return waitDays(7);
  // streak prep: be home before xmas
  if (need.streak(a) && x.rank >= 2 && x.m === 11 && x.dd >= 8 && x.dd < 18 && (x.inv.her | 0) >= 60 && (x.inv.amf | 0) >= 60) return waitDays(1);
  // ostvest: Frogner + all drugs with dealers
  if (need.ostvest(a) && x.rank >= 4) {
    if (!x.dist.frogner && x.status >= 60 && x.money > 1e6) { await openRoom('gata', 'street'); const r = await hqBuy('[data-take="frogner"]'); await closeAll(); return 'take frogner ' + r }
    if (!x.dist.tveita && x.money > 1e6) { await openRoom('gata', 'street'); const r = await hqBuy('[data-take="tveita"]'); await closeAll(); return 'take tveita ' + r }
    if (x.dist.frogner && x.dist.tveita && STATE.ostDay !== x.day) { STATE.ostDay = x.day;
      for (const g of ['mar', 'her', 'amf', 'lsd', 'kok', 'ecs']) if ((x.stash[g] | 0) < 100 && (x.inv[g] | 0) > 0 && !(g === 'kok' && x.dr && x.dr.on)) return await stashMove(g, 'stash') }
  }
  // buy Vålerenga
  if (x.rank >= 5 && !x.imp && !a.vif_tap && !(x.vif && x.vif.own) && x.money > 520e6 && x.m >= 0 && x.m <= 7) {
    await openRoom('biz', 'fronts'); const ok = await E(() => { const b = document.querySelector('#slip [data-vif]'); if (b) { b.click(); return true } return false }); await wait(1500);
    for (let i = 0; i < 12; i++) { const j = await info2(); if (!j) break; const b = j.btns.find(b => /KJØP KLUBBEN/i.test(b.t) && !b.dis); if (b) { await clickIdx(b.i); await wait(1200); continue } if (j.scn) await scnStep(); else { const en = j.btns.filter(b => !b.dis); if (!en.length) break; await clickIdx((en.find(b => b.primary) || en[0]).i) } await wait(700) }
    await closeAll(); return 'vif-buy ' + ok;
  }
  // Bergen achievements after taken: yearly kebab, fly until Flesland, e16 in winter
  if (x.rank >= 5 && !x.imp && STATE.bgDay !== x.day) {
    const bp = await E(() => S.bg && S.bg.on && S.bg.taken ? { r: bgRoutes(), used: S.bg.used, fl: !!S.bg.flesland, late: !!S.bg.ev.lateSeen, ships: S.bg.ships.length, wk: Math.floor(S.day / 7), sentWk: S.bg.sentWk } : null);
    if (bp && bp.ships < 3 && (x.inv.spr | 0) + (x.inv.tob | 0) + (x.inv.amf | 0) > 0) {
      const g = (x.inv.spr | 0) > 0 ? 'spr' : (x.inv.amf | 0) > 0 ? 'amf' : 'tob';
      let rt = null;
      if (!a.bg_kebab || !a.bg_lawyer) rt = bp.r.includes('kebab') ? 'kebab' : null;
      if (!rt && !a.bg_18k && bp.r.includes('tore')) rt = 'tore';
      if (!rt && !a.bg_flesland && bp.sentWk !== bp.wk) rt = 'fly';
      if (!rt && !a.bg_haukeli && [10, 11, 0, 1, 2, 3].includes(x.m) && bp.sentWk !== bp.wk) rt = 'e16';
      if (rt) { STATE.bgDay = x.day; if (await bgOpenX()) { const r = await bgSendX(g, rt === 'fly' ? 300 : rt === 'kebab' ? 500 : 1500, rt); await closeAll(); return 'bg-ach ' + r } }
    }
  }
  return _main0();
};
// Bergen send helpers (UI)
globalThis.bgOpenX = async () => { await closeAll(); const ok = await E(() => { const c = document.querySelector('#bgCard'); if (c) { c.click(); return true } return false }); await wait(1200); return ok && !!(await E(() => document.querySelector('#bgG'))) };
globalThis.bgSendX = async (g, q, r) => {
  const opts = await E(() => [...document.querySelectorAll('#bgG option')].map(o => o.value)); if (!opts.includes(g)) g = opts[0]; if (!g) return 'no-goods';
  await tab.select('#bgG', g); await wait(200);
  const has = await E((r) => { const b = document.querySelector(`#slip .rt[data-r="${r}"]`); if (b) { b.click(); return true } return false }, r); if (!has) return 'no-route ' + r; await wait(200);
  await E((q) => { const i = document.querySelector('#bgQ'); i.value = String(q); i.dispatchEvent(new Event('input', { bubbles: true })) }, q); await wait(200);
  const ok = await E(() => { const b = document.querySelector('#bgGo'); if (b && !b.disabled) { b.click(); return true } return false }); await wait(1200);
  return ok ? `sent ${q} ${g} via ${r}` : 'send-disabled ' + r;
};
// Bergen (not yet taken) weekly act with achievement routes and trick-only showdown
globalThis.bergenAct = async (bi) => {
  const a = await ach();
  if (bi.oInv && !bi.taken && !(bi.retry > bi.day)) {
    const tr = await E(() => !!(S.bg.m.tr && S.bg.m.tr.st === 'done'));
    const late = bi.day > 3450;
    if (tr || late) { if (!(await bgOpenX()) && !(await E(() => !!document.querySelector('#bgOppg')))) return null;
      await E(() => document.querySelector('#bgOppg')?.click()); await wait(1200);
      const c = await E((tr) => { const b = (tr && document.querySelector('#slip [data-c="trick"]:not([disabled])')) || document.querySelector('#slip [data-c="buy"]:not([disabled])'); if (b) { b.click(); return b.dataset.c } return null }, tr);
      return 'bg-showdown ' + c }
  }
  if (bi.sentWk !== bi.wk && bi.ships < 3) {
    const routes = await E(() => bgRoutes()), used = await E(() => ({ ...S.bg.used, fl: !!S.bg.flesland, late: !!S.bg.ev.lateSeen }));
    const winter = [10, 11, 0, 1, 2, 3].includes(new Date(0).getMonth()) && false;
    const m = await E(() => dayDate(S.day).getMonth()), wint = [10, 11, 0, 1, 2, 3].includes(m);
    const plan = [];
    if (bi.b && bi.b.st === 'on' && bi.inv.ecs > 0) plan.push(['ecs', Math.min(bi.inv.ecs, 1000 - bi.b.n + 50, 1500), 'bane']);
    if (bi.r && bi.r.st === 'on' && bi.inv.tob > 0) plan.push(['tob', Math.min(bi.inv.tob, 300 - bi.r.n + 20), 'bane']);
    if (bi.inv.spr > 0) plan.push(['spr', Math.min(bi.inv.spr, 2000), (!used.e16 || (wint && !used.late)) ? 'e16' : 'bane']);
    if (routes.includes('kebab')) plan.push([bi.inv.spr > 0 ? 'spr' : 'tob', 500, 'kebab']);
    if (routes.includes('tore')) plan.push([bi.inv.spr > 0 ? 'spr' : 'tob', 1500, 'tore']);
    if (!used.fl) plan.push(['spr', 300, 'fly']);
    if (bi.inv.kok > 0) plan.push(['kok', Math.min(bi.inv.kok, 800), 'bane']);
    if (!plan.length) return null;
    if (!(await bgOpenX())) return null;
    const res = [];
    for (const [g, q, r] of plan.slice(0, 3 - bi.ships)) { if (q <= 0) continue; res.push(await bgSendX(g, q, r)); if (!(await E(() => !!document.querySelector('#bgG')))) break }
    await closeAll(); BGLOG.push(bi.day + ' ctl ' + bi.ctl + ' ' + res.join(', ')); return 'bg ' + res.join(', ');
  }
  return null;
};
// ---------- modal decisions ----------
FIG.unshift([/JERMUND KAPPELEM/i, /INFORMER/i]);
FIG.push([/SUPERSPANEREN|ERIK HANSEN/i, /SAMARBEID|^JA/i]);
BTN.unshift([/Don Rafael|DON RAFAEL/i, null, 'primary'], [/løyven|LØYVEN/i, null, 'primary'], [/Kneskålen|kspage|KNESKÅL/i, null, 'primary'],
  [/Sikker Sak|hest/i, /Betal kr 250/i], [/Fiskemannen din kjenner noen med båt|1 kilo kokain/i, /Kjør, Tore/i], [/kusin min er tatt/i, /Betal advokat/i]);
{ const i = BTN.findIndex(r => String(r[0]).includes('Helikopteret')); if (i >= 0) BTN.splice(i, 1) }
const _handle0 = globalThis.handle;
globalThis.handle = async (inf) => {
  const a = await ach();
  // trial
  if (/gftrial/.test(inf.cls) && await E(() => !!document.querySelector('#slip .choice[data-v="go"]'))) {
    const risk = +((inf.body.match(/(\d+)\s*%\s*sjanse for dom/i) || [])[1] || 99);
    const go = GOAL.trial === 'flee' || risk <= 20;
    await E((go) => { const b = document.querySelector(`#slip .choice[data-v="${go ? 'go' : 'plea'}"]:not([disabled])`) || document.querySelector('#slip .choice[data-v="go"]'); b.click() }, go); return 'trial ' + (go ? 'go' : 'plea') + ' risk ' + risk;
  }
  if (/Helikopteret står på taket|toalettet/i.test(inf.title + inf.body)) { const b = inf.btns.find(b => (GOAL.trial === 'flee' ? /FLYKT/i : /BLI/i).test(b.t)); if (b) { await clickIdx(b.i); return 'heli ' + b.t } }
  if (/ksslip/.test(inf.cls) && await E(() => !!document.querySelector('#slip [data-ks="knee"]'))) { await E(() => document.querySelector('#slip [data-ks="knee"]').click()); return 'ks knee' }
  if (/fightslip/.test(inf.cls) && await E(() => !!document.querySelector('#slip .choice[data-c]:not([disabled])'))) {
    const d = await E(() => { const t = document.querySelector('#slip .body').innerText; const m = t.match(/SJANSE FOR Å VINNE\s*(\d+)\s*%/i); const sl = t.match(/Dere\s*(\d+)\s*mot\s*De\s*(\d+)/i); return { p: m ? +m[1] / 100 : null, mine: sl ? +sl[1] : null, opp: sl ? +sl[2] : null, alb: /ctalb/.test(document.querySelector('#slip').className) } });
    let fight = d.p != null && d.p >= .6 && d.mine >= d.opp;
    if (d.alb && !a.ct_alb) fight = true;
    if (!a.david && d.p != null && d.p < .25 && d.p >= .1) fight = true;
    await E((c) => document.querySelector(`#slip .choice[data-c="${c}"]`).click(), fight ? 'fight' : (await E(() => !!document.querySelector('#slip .choice[data-c="yield"]'))) ? 'yield' : 'flee');
    return 'fight ' + JSON.stringify(d) + ' ' + fight;
  }
  if (/jobslip/.test(inf.cls) && /TAXI-TORE|ALI FRA|ALI$/i.test(inf.title)) { const en = inf.btns.filter(b => !b.dis); const p = en.find(b => b.primary); const amt = t => { const m = t.match(/KR\s*([\d\s]+)/i); return m ? +m[1].replace(/\D/g, '') : 0 }; if (en.length === 2 && p && amt(p.t) <= 3e6 && !/SPILL PÅ/.test(p.t)) { await clickIdx(p.i); return 'job-accept ' + p.t } }
  return _handle0(inf);
};
print('ach loaded');
// ---------- patch 2: DR selling, TL orders, heli, stocks ----------
{ const _sellP = globalThis.sellAct;
  globalThis.sellAct = async () => {
    const x = globalThis._RX && globalThis._RX.x;
    if (x && x.dr && x.dr.on && !(globalThis._RX.mode === 'streak')) {
      const kd = await E(() => { const tr = [...document.querySelectorAll('#slip tbody tr')].find(t => t.querySelector('#n_kok')); if (!tr) return -1; return +(tr.querySelectorAll('td')[2].innerText.match(/\d+/) || [0])[0] });
      if (kd >= 0 && kd < 2600 && (STATE.drW || 0) < 4) { STATE.drW = (STATE.drW || 0) + 1; await E(() => document.querySelector('#sellWait').click()); return 'dr-wait kok=' + kd }
      STATE.drW = 0; STATE.waits = 99;
    }
    return _sellP();
  } }
{ const _mainP = globalThis.mainAction;
  globalThis.mainAction = async () => {
    const x = await X(), a = await ach();
    globalThis._RX = { x, a, mode: null };
    // helicopter for the escape game
    if (GOAL.trial === 'flee' && !x.heli && x.rank >= 4 && x.money > 8e6 && STATE.heliDay !== x.day) { STATE.heliDay = x.day; await closeAll(); await E(() => document.querySelector('#aProt').click()); await wait(900); await E(() => document.querySelector('#slip [data-tab="v"]')?.click()); await wait(800); const r = await hqBuy('[data-heli="buy"]'); await closeAll(); return 'heli ' + r }
    // DR: no trips, sell kok at home
    if (x.dr && x.dr.on) { if ((x.inv.kok | 0) > 0) return openSell(); }
    // TL orders active: keep stock for sell orders, go fetch
    const tlOn = await E(() => !!(S.tl && S.tl.start != null && !S.tl.done));
    if (tlOn) {
      const fj = x.jobs.filter(j => j.k === 'fetch' && j.prog < j.q);
      if (fj.length) { STATE.forceRoute = fj[0].c; await E(() => document.querySelector('#aBuy').click()); return 'tl-fetch ' + fj[0].c }
      const sj = x.jobs.filter(j => j.k === 'sell' && j.prog < j.q && (x.inv[j.g] | 0) > 0);
      if (sj.length) return openSell();
    }
    return _mainP();
  } }
{ const _buyP = globalThis.buyDialogAct;
  globalThis.buyDialogAct = async () => {
    // pre-stock for TL orders (Gudfar, before/while TL)
    return _buyP();
  } }
print('ach patch2 loaded');
