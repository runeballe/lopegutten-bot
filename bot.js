// Løpegutten bot – drives the game only through its UI (buttons, dialogs).
globalThis.tab = browser.tab('lg2');
globalThis.wait = (ms) => new Promise(r => setTimeout(r, ms));
const E = (fn, arg) => tab.evaluate(fn, arg);

globalThis.info2 = () => E(() => {
  const veil = document.querySelector('#veil'); if (!veil || veil.hidden) return null;
  const s = document.querySelector('#slip'); const vis = e => e && !e.hidden && e.offsetParent !== null;
  const r = { title: (s.querySelector('header')?.innerText || '').replace(/\n/g, ' / '), body: (s.querySelector('.body')?.innerText || '').slice(0, 3000), cls: s.className,
    btns: [...s.querySelectorAll('footer button')].map((b, i) => ({ i, t: b.innerText.trim(), dis: b.disabled, primary: b.classList.contains('primary'), danger: b.classList.contains('danger'), id: b.id })) };
  r.scn = !!s.querySelector('.scn');
  if (r.scn) { const ch = s.querySelector('.scnchoices'); r.choicesOn = !!(ch && ch.classList.contains('on')); r.choices = ch ? [...ch.querySelectorAll('[data-c]')].map(b => ({ c: b.dataset.c, t: b.innerText.trim() })) : []; }
  r.bodyBtns = [...s.querySelectorAll('.body button')].filter(vis).map(b => b.innerText.trim().replace(/\n/g, ' – ').slice(0, 80)).filter(x => x).slice(0, 30);
  return r;
});
globalThis.clickIdx = (i) => E((i) => { const b = document.querySelectorAll('#slip footer button')[i]; if (b && !b.disabled) { b.click(); return b.innerText.trim() } return null }, i);
globalThis.scnStep = () => E(() => { const s = document.querySelector('#slip');
  const out = s.querySelector('.scnout'); if (out && !out.hidden && out.querySelector('.sbtn')) { out.querySelector('.sbtn').click(); return 'out' }
  const it = s.querySelector('.scnitem.on .sbtn'); if (it) { it.click(); return 'item' }
  const nb = [...s.querySelectorAll('.body button')].find(b => b.offsetParent && !b.disabled && /^(VIDERE|OK|NESTE)$/i.test(b.innerText.trim())); if (nb) { nb.click(); return 'next' }
  const ch = s.querySelector('.scnchoices.on [data-c]'); if (ch) { ch.click(); return 'choice' }
  s.querySelector('.scn')?.click(); return 'step' });
globalThis.st = () => E(() => ({ money: Math.round(S.money), day: S.day, date: dayDate(S.day).toISOString().slice(0, 10), rank: S.rankIdx, status: S.status, heat: Math.round(S.heat || 0), prot: protection(), over: S.over, dyn: S.dyn && S.dyn.nick, inv: Object.fromEntries(Object.entries(S.inv).filter(([k, v]) => v)) }));
globalThis.gameInfo = () => E(() => ({ rank: S.rankIdx, nBuy: S.nBuy || 0, money: S.money, inv: { ...S.inv }, gp: Object.fromEntries(GOODS.map(g => [g.id, g.price])), heat: S.heat || 0, flire: S.flire ? S.flire.where : null, day: S.day, loan: S.loan ? loanRepay() : 0, dcap: S.dist ? dealerCap() : 0, stashVal: S.stash ? dlStashVal() : 0, own: !!(S.dist && Object.keys(S.dist).length), waitCost: waitCost(), jobs: (S.jobs || []).map(j => ({ k: j.k, g: j.g, q: j.q, c: j.c })), wages: Object.values(S.dist || {}).reduce((a, d) => a + (d.dealers || 0) * 8000, 0), imp: !!S.imp }));
globalThis.invValue = gi => Object.entries(gi.inv).reduce((a, [k, v]) => a + v * gi.gp[k], 0);
globalThis.STATE = { waits: 0, lastBuyVal: 0, gaveAt: -99, invDay: -99, mv: {} };
globalThis.LOG = [];
const DMs = [1, 2, 3, 5, 10, 20], DMULT = { pis: .15, bom: .28, via: .4 }, BADB = new Set(['mar', 'her', 'spr', 'lsd', 'amf', 'kok']);
const COSTS = { se: 100, gb: 1400, nl: 1200, de: 1000, pl: 900, pt: 1800, it: 1600, tr: 2400, ru: 3000, co: 15000 };

globalThis.route = (gi) => { if (gi.rank >= 5 && !gi.imp) return 'co'; if (gi.rank >= 5) return gi.flire === 'ru' ? 'pl' : 'ru'; const pref = { 0: ['se'], 1: ['pl', 'de', 'se'], 2: ['pl', 'de', 'se'], 3: ['ru', 'pl', 'de'], 4: ['ru', 'pl', 'de'], 5: ['ru', 'pl', 'de'] }[gi.rank]; return pref.find(c => c !== gi.flire) || pref[0]; };
const reserveOf = gi => Math.max(2000, gi.money * (gi.rank >= 1 ? 0.12 : 0.03)) + gi.wages + (gi.rank >= 4 ? 200000 : 0);

async function buyDialogAct() {
  const gi = await gameInfo();
  if (gi.rank >= 5 && !gi.imp) { await E(() => document.querySelector('#slip footer button').click()); return 'coast-nobuy'; }
  const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, price: +c[1].innerText.replace(/\D/g, '') } }).filter(Boolean));
  const title = (await info2()).title;
  const mult = /RUSSLAND/i.test(title) ? 450 : 250, DM = DMs[gi.rank];
  let budget = Math.max(0, gi.money - reserveOf(gi)); if (budget < 500) budget = Math.max(0, gi.money - 300);
  const B0 = budget, ids = rows.map(r => r.id);
  const items = rows.map(r => ({ ...r, margin: (gi.gp[r.id] - r.price) / r.price, target: Math.max(0, Math.round(mult * DM * (DMULT[r.id] || 1) * (r.id === 'her' && gi.rank >= 4 ? 1.3 : 1)) - gi.inv[r.id]) }))
    .filter(r => r.margin > (gi.rank >= 2 ? 0.9 : 0.4)).sort((a, b) => b.margin * gi.gp[b.id] - a.margin * gi.gp[a.id]);
  const q = {};
  for (const j of gi.jobs) if (j.k === 'fetch' && ids.includes(j.g)) { const r = rows.find(r => r.id === j.g); const n = Math.min(j.q, Math.floor(budget / r.price)); if (n > 0) { q[j.g] = n; budget -= n * r.price } }
  for (const pass of [0, 1]) for (const it of items) { const have = q[it.id] || 0; const capVal = pass === 0 ? (BADB.has(it.id) ? .4 : .6) * B0 : (BADB.has(it.id) ? .5 : .8) * B0; const room = Math.floor((capVal - have * it.price) / it.price); const n = Math.max(0, Math.min(it.target - have, room, Math.floor(budget / it.price))); if (n > 0) { q[it.id] = have + n; budget -= n * it.price } }
  await E((q) => { for (const [id, v] of Object.entries(q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, q);
  STATE.lastBuyVal = Object.entries(q).reduce((a, [k, n]) => a + n * gi.gp[k], 0) + invValue(gi);
  const ok = await E(() => { const b = document.querySelector('#buyOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button').click(); return false });
  return 'buy ' + JSON.stringify(q) + (ok ? '' : ' (none)');
}

async function muleAct() {
  const d = await E(() => ({ money: S.money, rank: S.rankIdx, everCaught: !!S.everCaught, nb: S.nBuy || 0 }));
  await E(() => { for (const id of ['stu', 'pen', 'pro', 'con']) for (let k = 0; k < 6; k++) document.querySelector(`#slip [data-m="${id}"][data-d="-1"]`)?.click() });
  const t0 = await E(() => document.querySelector('#mSum').innerText);
  const V = +((t0.match(/Du bærer selv:\s*kr\s?([\d\s]+)/) || [])[1] || '0').replace(/\D/g, '');
  const step = Math.max(1000, Math.round(V / 400)); const vals = []; for (let v = 0; v <= V + step; v += step) vals.push(v);
  const P = await E((vals) => vals.map(v => baseCustomsP(v)), vals);
  const p = v => Math.min(.95, P[Math.min(P.length - 1, Math.round(v / step))]);
  const types = [{ id: 'stu', cost: 2000, cap: 20000, risk: 1.4 }, { id: 'pen', cost: 5000, cap: 15000, risk: .7 }, { id: 'pro', cost: 20000, cap: 150000, risk: .3 }, { id: 'con', cost: 150000, cap: 1e13, risk: .25 }];
  let best = null;
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) for (let e = 0; e <= (d.rank >= 4 ? 1 : 0); e++) {
    if (d.rank < 2 && c > 0) continue;
    const n = { stu: a, pen: b, pro: c, con: e }; let rem = V, cost = 0, loss = 0, bad = false;
    for (const ty of types) for (let i = 0; i < n[ty.id]; i++) { if (rem <= 0) { bad = true; break } const l = Math.min(ty.cap, rem); rem -= l; cost += ty.cost; loss += p(l) * ty.risk * l * 2.5 }
    if (bad || cost > d.money) continue;
    if (rem > 0) { let ps = p(rem); if (!d.everCaught && d.nb >= 6 && d.nb <= 11) ps = Math.max(ps, .2); loss += ps * rem * 2.5 }
    if (!best || cost + loss < best.obj) best = { n, obj: cost + loss, cost };
  }
  for (const id of ['stu', 'pen', 'pro', 'con']) for (let k = 0; k < best.n[id]; k++) await E((id) => document.querySelector(`#slip [data-m="${id}"][data-d="1"]`)?.click(), id);
  const go = await E(() => { const g = document.querySelector('#mGo'); if (g && !g.disabled) { g.click(); return true } return false });
  if (!go) await clickIdx(0);
  return 'mules ' + JSON.stringify(best.n) + ' V=' + V;
}

async function sellAct() {
  const gi = await gameInfo(); const DM = DMs[gi.rank];
  const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n || n.disabled) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, have: +c[1].innerText.replace(/\D/g, ''), demand: +(c[2].innerText.match(/\d+/) || [0])[0], price: +c[3].innerText.split(/[▲▼]/)[0].replace(/\D/g, '') } }).filter(Boolean));
  let sellable = 0, potential = 0;
  for (const r of rows) { sellable += Math.min(r.have, r.demand) * r.price; potential += Math.min(r.have, 100 * DM * (DMULT[r.id] || 1)) * gi.gp[r.id] }
  if (sellable < .45 * potential && STATE.waits < 2 && gi.money > 5000 + gi.waitCost) { STATE.waits++; await E(() => document.querySelector('#sellWait').click()); return 'wait' }
  STATE.waits = 0;
  if (sellable <= 0) { STATE.noSell = (STATE.noSell||0)+1; if (STATE.noSell <= 3 && gi.money > gi.waitCost*2) { await E(() => document.querySelector('#sellWait').click()); return 'wait-nodemand' } STATE.noSellDay = gi.day; STATE.noSell = 0; await E(() => document.querySelector('#slip footer button').click()); return 'cancel-sell' }
  STATE.noSell = 0;
  await E(() => document.querySelector('#sellAll').click()); await wait(200);
  await E(() => document.querySelector('#sellOk').click());
  return 'sold ' + Math.round(sellable);
}

// ---- HQ helpers ----
globalThis.closeAll = async () => { for (let n = 0; n < 8; n++) { const j = await info2(); if (!j) return; const en = j.btns.filter(b => !b.dis); if (!en.length) return; await clickIdx(en[en.length - 1].i); await wait(400) } };
globalThis.hqBuy = async (sel) => {
  const ok = await E((sel) => { const b = document.querySelector('#slip ' + sel); if (!b || b.disabled) return false; b.click(); return true }, sel);
  if (!ok) return sel + ':n/a'; await wait(900);
  for (let k = 0; k < 12; k++) { const i = await info2(); if (!i) return sel + ':closed'; if (/HOVEDKVARTERET/.test(i.title)) return sel + ':ok';
    if (i.scn) await scnStep(); else { const c = await E(() => { const b = [...document.querySelectorAll('#slip button')].find(b => b.offsetParent && !b.disabled && /TILBAKE|VIDERE|OK|LUKK|FORTSETT/i.test(b.innerText.trim())); if (b) { b.click(); return 1 } return 0 }); if (!c) await E(() => document.querySelector('#slip')?.click()) }
    await wait(600) }
  return sel + ':?';
};
globalThis.openRoom = async (room, syn) => { await closeAll(); await E(() => document.querySelector('#aEmp').click()); await wait(900); await E(() => document.querySelector('#slip [data-hqhome]')?.click()); await wait(700); await E((r) => document.querySelector(`#slip [data-room="${r}"]`)?.click(), room); await wait(800); if (syn) { await E((s) => document.querySelector(`#slip [data-syn="${s}"]`)?.click(), syn); await wait(800) } };
globalThis.protBuy = async (steps) => { await closeAll(); await E(() => document.querySelector('#aProt').click()); await wait(900); const out = [];
  for (const s of steps) { if (s === 'weap') { await E(() => document.querySelector('#slip [data-tab="v"]')?.click()); await wait(700); out.push('kp:' + await E(() => { const b = document.querySelector('#slip [data-wfill="kp"]'); if (b && !b.disabled) { b.click(); return 1 } return 0 })); await wait(900); continue }
    out.push(await hqBuy(s)); if (!(await E(() => !!document.querySelector('#slip [data-tab="k"]')))) { await closeAll(); await E(() => document.querySelector('#aProt').click()); await wait(900) } }
  await closeAll(); return out.join(',') };
globalThis.stashMove = async (id, to) => { await openRoom('gata', 'stash'); const ok = await E(([id, to]) => { const b = document.querySelector(`#slip [data-mv="${id}"][data-to="${to}"]`); if (b && !b.disabled) { b.click(); return true } return false }, [id, to]); await wait(400); await closeAll(); return `mv ${id}->${to} ${ok}` };
globalThis.giveGoods = async (gi) => {
  const need = gi.dcap * 1.2 - gi.stashVal; if (need < 20000) return null; const DM = DMs[gi.rank]; const plan = {}; let left = need;
  const cands = Object.entries(gi.inv).filter(([k, v]) => v > 0).map(([k, v]) => ({ k, spare: v - Math.round(150 * DM * (DMULT[k] || 1)), unit: gi.gp[k] * .9 })).filter(c => c.spare > 0).sort((a, b) => b.unit * b.spare - a.unit * a.spare);
  for (const c of cands) { const n = Math.min(c.spare, Math.ceil(left / c.unit)); if (n > 0) { plan[c.k] = n; left -= n * c.unit } if (left <= 0) break }
  if (!Object.keys(plan).length) return null;
  await E(() => document.querySelector('#aSell').click()); await wait(700);
  if (!(await E(() => { const g = document.querySelector('#slip [data-give]'); if (g) { g.click(); return true } return false }))) { await closeAll(); return null }
  await wait(700);
  await E((plan) => { for (const [id, v] of Object.entries(plan)) { const n = document.querySelector('#slip #gn_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, plan); await wait(200);
  const ok = await E(() => { const b = document.querySelector('#giveOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button')?.click(); return false });
  return ok ? 'give ' + JSON.stringify(plan) : null;
};
globalThis.vgBuy = async (id) => {
  await closeAll(); await E(() => { setTimeout(() => vgDialog(), 10) }); await wait(2000); let res = 'n/a';
  for (let k = 0; k < 30; k++) { const i = await info2(); if (!i) { await wait(500); continue }
    if (/VEIEN TIL GUDFAR$/.test(i.title.trim())) { if (await E((id) => S.vg && S.vg[id], id)) break; res = await E((id) => { const b = document.querySelector(`#slip [data-vg="${id}"]`); if (b && !b.disabled) { b.click(); return 'clicked' } return 'nobtn' }, id); if (res === 'nobtn') break; await wait(1500); continue }
    if (i.scn) await scnStep(); else { const en = i.btns.filter(b => !b.dis); if (en.length) await clickIdx((en.find(b => b.primary) || en[0]).i); else await E(() => { const b = [...document.querySelectorAll('#slip .body button')].find(b => b.offsetParent && !b.disabled); if (b) b.click(); else document.querySelector('#slip .body')?.click() }) }
    await wait(800) }
  await closeAll(); return 'vg ' + id + ':' + (await E((id) => !!(S.vg && S.vg[id]), id));
};
async function autoInvest() {
  const s = await E(() => ({ r: S.rankIdx, m: S.money, prot: protection(), st: S.status, day: S.day, dist: Object.fromEntries(Object.entries(S.dist || {}).map(([k, v]) => [k, v.dealers])), fac: Object.fromEntries(Object.entries(S.fac || {}).map(([k, v]) => [k, v.dead ? 0 : v.lvl])), fronts: Object.keys(S.fronts || {}), ins: !!S.insider, vg: S.vg || {}, people: people(), weap: weaponCount(), lawyer: S.lawyer }));
  if (s.r >= 4) { const want = (!s.vg.forn && s.m > 25e6) ? 'forn' : (!s.vg.by && s.m > 20e6) ? 'by' : (!s.vg.villa && s.m > 30e6) ? 'villa' : null; if (want) return await vgBuy(want) }
  if (s.day - STATE.invDay < 20) return null; STATE.invDay = s.day;
  const acts = []; let m = s.m;
  const take = async (d, dealers) => { await openRoom('gata', 'street'); if (!s.dist[d]) { acts.push(await hqBuy(`[data-take="${d}"]`)); await openRoom('gata', 'street') } for (let k = (s.dist[d] || 1); k < dealers; k++) { await E((d) => document.querySelector(`#slip [data-dd="${d}"][data-n="1"]`)?.click(), d); await wait(350) } await closeAll() };
  const front = async (f) => { await openRoom('biz', 'fronts'); acts.push(await hqBuy(`[data-front="${f}"]`)); await closeAll() };
  const fac = async (sel) => { await openRoom('biz', 'prod'); acts.push(await hqBuy(sel)); await closeAll() };
  if (s.r >= 2 && s.prot < 45 && m > 150000) acts.push(await protBuy(['[data-cfill="t"]', '[data-cfill="g"]', 'weap']));
  if (s.r >= 3 && s.prot < 88 && m > 800000) acts.push(await protBuy(['[data-hire="l"]', '[data-cfill="r"]', '[data-cfill="t"]', '[data-cfill="g"]', 'weap']));
  else if (s.r >= 2 && s.weap < s.people && m > 100000) acts.push(await protBuy(['weap']));
  if (s.r >= 2 && m > 350000 && !s.dist.gron) { await take('gron', 1); await take('toyen', 1); m -= 110000 }
  if (s.r >= 3 && m > 1000000 && s.fac.farm === undefined) { await fac('[data-buyfac="farm"]'); m -= 250000 }
  if (s.r >= 3 && m > 3000000) {
    if (s.fac.lab === undefined) { await fac('[data-buyfac="lab"]'); m -= 600000 }
    if (s.fac.farm === 1) { await fac('[data-upfac="farm"]'); m -= 150000 }
    if (!s.fronts.includes('bil')) { await front('bil'); m -= 300000 }
    if (!s.dist.lokka) { for (const d of ['lokka', 'tveita', 'gron', 'toyen']) await take(d, 2); m -= 200000 }
  }
  if (s.r >= 4 && m > 5500000) {
    if (s.fac.finca === undefined) { await fac('[data-buyfac="finca"]'); m -= 3000000 }
    if (!s.ins) { await openRoom('biz', 'fronts'); await E(() => document.querySelector('#slip [data-ins="1"]')?.click()); await wait(500); await closeAll(); acts.push('insider') }
    for (const f of ['video', 'sol']) if (!s.fronts.includes(f)) { await front(f); m -= 200000 }
    for (const d of ['gron', 'toyen', 'lokka', 'tveita']) if ((s.dist[d] || 0) < 3) await take(d, 3);
  }
  if (s.r >= 4 && m > 9000000) { if (s.fac.finca === 1) { await fac('[data-upfac="finca"]'); m -= 3000000 } for (const f of ['club', 'wash', 'pizza']) if (!s.fronts.includes(f)) { await front(f); m -= 1000000 } }
  if (s.r >= 4 && s.st >= 35 && m > 3000000 && (s.dist.plata || 0) < 3) await take('plata', 3);
  if (s.r >= 5 && s.lawyer < 5 && m > 2000000) { await closeAll(); await E(() => document.querySelector('#aProt').click()); await wait(900); await E(() => document.querySelector('#slip [data-syn="law"]')?.click()); await wait(800); acts.push(await hqBuy('[data-hire="5"]')); await closeAll() }
  return acts.length ? 'invest: ' + acts.join(' | ') : null;
}
async function mainAction() {
  const gi = await gameInfo();
  if (gi.loan && gi.money > gi.loan * 2.5 + 20000) { await E(() => document.querySelector('#aLoan').click()); await wait(600); const i = await info2(); const b = i && i.btns.find(b => /BETAL TILBAKE/i.test(b.t) && !b.dis); if (b) { await clickIdx(b.i); return 'repaid' } await closeAll(); }
  const inv = await autoInvest(); if (inv) return inv;
  if (gi.rank >= 5 && !gi.imp) {
    const g = Object.entries(gi.inv).find(([k, v]) => v > 0);
    if (g && !STATE.mv[g[0]]) { STATE.mv[g[0]] = 1; return await stashMove(g[0], 'stash') }
    await E(() => document.querySelector('#aBuy').click()); return 'coast';
  }
  if (gi.heat >= 50 && gi.money > gi.waitCost * 7 * 6) { await E(() => document.querySelector('#layLowBtn').click()); await wait(600); await E(() => document.querySelector('#slip [data-w="7"]')?.click()); return 'laylow' }
  const s2 = await E(() => ({ sv: S.stash ? dlStashVal() : 0, dcap: S.dist ? dealerCap() : 0, stash: { ...(S.stash || {}) } }));
  if (gi.own && s2.sv > 1.5 * s2.dcap) { const c = Object.entries(s2.stash).filter(([k, v]) => v > 0).sort((a, b) => b[1] * gi.gp[b[0]] - a[1] * gi.gp[a[0]])[0]; if (c && c[1] * gi.gp[c[0]] > .3 * s2.dcap) return await stashMove(c[0], 'case') }
  if (gi.own && gi.day - STATE.gaveAt > 3) { STATE.gaveAt = gi.day; const r = await giveGoods(gi); if (r) return r }
  const v = invValue(gi), cid = route(gi);
  const canBuy = gi.money - reserveOf(gi) >= Math.max(1500, 4 * COSTS[cid]);
  if ((v > Math.max(3000, .3 * STATE.lastBuyVal) || (!canBuy && v > 0)) && STATE.noSellDay !== gi.day) { await E(() => document.querySelector('#aSell').click()); return 'sell' }
  if (!canBuy && gi.money < COSTS[cid] + 200) return 'STUCK';
  await E(() => document.querySelector('#aBuy').click()); return 'buy';
}

// ---- modal decisions ----
globalThis.FIG = [ // [regex on title+body, choice text regex]
  [/JERMUND KAPPELEM/i, /BETAL JERMUND|^Betal/i], [/KAPPELEM KOMMER/i, /SELG TIL HAM/i], [/RØMLINGEN/i, /GI HAM KR/i], [/KUNSTTYVEN/i, /SI NEI/i],
  [/MC-KRIGEN/i, /HOLD DEG UNNA/i], [/TOMATER FRA SPANIA/i, /IKKE DENNE/i], [/HAN SA INGENTING/i, /BETAL FOR DEN BESTE/i], [/KNESKÅLEN/i, /ETTERGI/i],
];
globalThis.BTN = [ // [regex, button text regex or fn]
  [/TOLLKONTROLL|SALG FULLFØRT|NY RANG|GRATULERER/i, null, 'primary'],
  [/NORGESLISTA!|SPILLERKORT/i, /SENERE/i], [/NYTT I HOVEDKVARTERET/i, /SENERE/i], [/SALGET DENNE MÅNEDEN/i, /LA SELGERNE/i],
  [/TO SPILL, ÉN SPILLER/i, /BEHOLD DETTE/i], [/NOKDA/i, /KJØP DEN/i], [/SPANER SVENDSEN/i, /VIS HAM VEIEN/i], [/GULLMEDALJEN/i, /LUKTER JUKS/i],
  [/VIDEOSJAPPA TIL ARVID/i, /KJØP SJAPPA|NEI/i], [/SPESIALOPPDRAG/i, /NEI TAKK|DET VAR FISK/i], [/BERGEN-BLANDING/i, /KJØR, ALI/i], [/HUSLEIA TIL ALI/i, /BETAL DEN DOBLE/i],
  [/NØKKELEN ER DIN|VILLAEN/i, /SENERE/i], [/Helikopteret står på taket/i, /Bli og ta/i], [/sharkslip|NOTATBOKA/i, /TA LÅNET/i], [/LÅNEHAIEN \/ PERSONSØKEREN/i, /GÅ TIL LÅNEHAIEN/i],
  [/TEKST-TV/i, /^Videre$/i],
];
async function handle(inf) {
  const text = inf.title + ' || ' + inf.body;
  // year 2000 window: go home (keep the Imperiet slot untouched)
  if (/y2kslip/.test(inf.cls)) { const b = inf.btns.find(b => !b.primary && !b.dis) ; await clickIdx(b ? b.i : 0); return 'y2k-home ' + (b && b.t) }
  // special interactive slips
  const sp = await E(() => { const s = document.querySelector('#slip');
    for (const id of ['#acNext', '#fNext', '#kpNext']) { const b = s.querySelector(id); if (b) { b.click(); return 'next' + id } }
    const plea = s.querySelector('.choice[data-v="plea"]:not([disabled])'); if (plea) { plea.click(); return 'trial-plea' }
    if (/gfrival/.test(s.className)) { const b = s.querySelector('.choice[data-v="buy"]:not([disabled])'); if (b) { b.click(); return 'swe-buy' } }
    return null });
  if (sp) return sp;
  if (/copslip/.test(inf.cls) && await E(() => !!document.querySelector('#slip .opt[data-o]'))) {
    const can = await E(() => { const b = document.querySelector('#slip .opt[data-o="bribe"]'); if (b && !b.disabled) { b.click(); return true } return false });
    if (can) { await wait(300); await E(() => { const N = document.querySelector('#brN'); N.value = 100; N.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#brGo').click() }) }
    else { const law = await E(() => { const b = document.querySelector('#slip .opt[data-o="law"]'); if (b && !b.disabled) { b.click(); return true } return false }); if (!law) await E(() => document.querySelector('#slip .opt[data-o="jail"]').click()) }
    return 'arrest';
  }
  if (/bmslip/.test(inf.cls) && await E(() => !!document.querySelector('#slip .body button[data-v="pay"]'))) {
    const gi = await gameInfo(); const amt = +((inf.body.match(/De krever\s*KR\s*([\d\s]+)/i) || [])[1] || '0').replace(/\D/g, '');
    const illegal = Object.entries(gi.inv).filter(([k, v]) => v > 0 && !['spr', 'tob'].includes(k)).reduce((a, [k, v]) => a + v * gi.gp[k], 0);
    const exp = /Bocco/i.test(inf.body) ? .65 * (invValue(gi) + 5000) : /Loco/i.test(inf.body) ? .65 * invValue(gi) * .5 : .65 * (illegal + 7500);
    const c = (exp < amt || gi.money < amt) ? 'ignore' : 'pay'; await E((c) => document.querySelector(`#slip .body button[data-v="${c}"]`).click(), c); return 'blackmail ' + c;
  }
  if (/fightslip/.test(inf.cls) && await E(() => !!document.querySelector('#slip .choice[data-c]:not([disabled])'))) {
    const d = await E(() => { const t = document.querySelector('#slip .body').innerText; const m = t.match(/SJANSE FOR Å VINNE\s*(\d+)\s*%/i); const sl = t.match(/Dere\s*(\d+)\s*mot\s*De\s*(\d+)/i); return { p: m ? +m[1] / 100 : null, mine: sl ? +sl[1] : null, opp: sl ? +sl[2] : null } });
    const fight = d.p != null && d.p >= .6 && d.mine >= d.opp; await E((c) => document.querySelector(`#slip .choice[data-c="${c}"]`).click(), fight ? 'fight' : 'yield'); return 'fight ' + (fight ? 'yes' : 'no');
  }
  if (/ANGRIPER/i.test(inf.title) && inf.btns.some(b => !b.dis)) { const m = inf.body.match(/Din slagkraft\s*(\d+)\s*VS\s*[^\n]*\n\s*(\d+)/); const mine = m ? +m[1] : 0, opp = m ? +m[2] : 999; const b = inf.btns.find(b => (mine >= opp ? /FORSVAR/ : /GI FRA/).test(b.t) && !b.dis); if (b) { await clickIdx(b.i); return 'turf' } }
  if (/fmslip/.test(inf.cls)) { const c = await E(() => { const cs = [...document.querySelectorAll('#slip .body .choice:not([disabled])')]; if (!cs.length) return null; const a = cs.find(c => /ALIS RÅD/i.test(c.innerText)) || cs.find(c => c.classList.contains('primary')) || cs[0]; a.click(); return 'fm' }); if (c) return c }
  // figure choices by rule
  for (const [re, ch] of FIG) if (re.test(text)) { const c = await E((src) => { const re = new RegExp(src, 'i'); const cs = [...document.querySelectorAll('#slip .body .choice:not([disabled]), #slip .scnchoices.on [data-c], #slip .body button')].filter(b => b.offsetParent); const c = cs.find(c => re.test(c.innerText.trim())); if (c) { c.click(); return c.innerText.split('\n')[0] } return null }, ch.source); if (c) return 'fig ' + c }
  if (inf.scn) { if (!inf.choicesOn) return 'scn ' + await scnStep(); }
  const en = inf.btns.filter(b => !b.dis);
  for (const [re, bre, mode] of BTN) if (re.test(text)) { const b = mode === 'primary' ? en.find(b => b.primary) : en.find(b => bre.test(b.t)); if (b) { await clickIdx(b.i); return 'btn ' + b.t } }
  { const b = en.find(b => /TA OPPDRAGET/i.test(b.t)); if (b) { await clickIdx(b.i); return 'job' } }
  { const b = en.find(b => /^LÅN HAM KR 20/i.test(b.t)); if (b) { await clickIdx(b.i); return 'tore' } }
  if (/TAXI-TORE/.test(inf.title)) { const bet = en.filter(b => /^SPILL PÅ/i.test(b.t)); if (bet.length) { await clickIdx(bet[bet.length - 1].i); return 'bet' } }
  if (en.length === 1 && !en[0].danger) { await clickIdx(en[0].i); return null }
  if (!en.length) {
    const c = await E(() => { const b = [...document.querySelectorAll('#slip .body button')].find(b => b.offsetParent && !b.disabled && /^(VIDERE|OK|NESTE|LUKK|FORTSETT|JEG ER KLAR)$/i.test(b.innerText.trim())); if (b) { b.click(); return b.innerText.trim() } return null });
    if (c) return null;
    if (inf.bodyBtns.some(t => /^HOPP OVER$/i.test(t))) { await E(() => [...document.querySelectorAll('#slip .body button')].find(b => /^HOPP OVER$/i.test(b.innerText.trim()))?.click()); return null }
    if (await E(() => !!document.querySelector('#cNext'))) { await E(() => { document.querySelector('#cSkip')?.click(); const b = document.querySelector('#cNext'); if (!b.disabled) b.click() }); return null }
  }
  return 'decide';
}
async function fallback(inf) {
  const en = inf.btns.filter(b => !b.dis && !b.danger);
  const amt = t => { const m = t.match(/KR\s*([\d\s]+)/i); return m ? +m[1].replace(/\D/g, '') : 0 };
  if (en.length) { const pay = en.find(b => /^(BETAL|LÅN HAM|KJØP|SPONS|HJELP)/i.test(b.t) && amt(b.t) <= 2000000); const b = pay || en.find(b => !b.primary) || en[0]; await clickIdx(b.i); return 'fb ' + b.t }
  const c = await E(() => { const cs = [...document.querySelectorAll('#slip .body .choice:not([disabled]), #slip .scnchoices.on [data-c]')].filter(b => b.offsetParent); const bs = cs.length ? cs : [...document.querySelectorAll('#slip .body button')].filter(b => b.offsetParent && !b.disabled && b.innerText.trim().length > 3); if (!bs.length) return null;
    const s = bs.find(c => /IKKE|NEI|LA (HAM|ALI|DEM)|HOLD DEG|AVSLÅ|AVVIS|ETTERGI/i.test(c.innerText)) || bs.find(c => c.classList.contains('primary')) || bs[bs.length - 1]; s.click(); return s.innerText.trim().replace(/\n/g, ' ').slice(0, 50) });
  return c ? 'fb-body ' + c : null;
}
globalThis.run = async (maxSteps, stop) => {
  const out = []; let same = { t: null, n: 0 };
  for (let k = 0; k < maxSteps; k++) {
    try {
      if (await E(() => !S || S.over)) return { stop: 'over', out };
      if (stop && await stop()) return { stop: 'cond', out };
      const inf = await info2();
      if (!inf) { const a = await mainAction(); out.push(a); if (a === 'STUCK') return { stop: 'stuck', out }; await wait(300); continue }
      const key = inf.title + inf.body.slice(0, 80); if (same.t === key) same.n++; else same = { t: key, n: 0 };
      if (/HVOR VIL DU KJØPE/i.test(inf.title)) { const gi = await gameInfo(); const cid = route(gi);
        await E((cid) => { document.querySelector('#mapTipOk')?.click(); document.querySelector(`#slip .countrylist button[data-id="${cid}"]`)?.click() }, cid); await wait(300);
        await E(() => [...document.querySelectorAll('#slip button')].find(b => /REIS HIT/i.test(b.innerText))?.click()); out.push('go ' + cid); await wait(400); continue }
      if (/KJØP I /i.test(inf.title) && await E(() => !!document.querySelector('#buyOk'))) { out.push(await buyDialogAct()); await wait(400); continue }
      if (/HVEM BÆRER/i.test(inf.title)) { out.push(await muleAct()); await wait(300); continue }
      if (/SELG I NORGE/i.test(inf.title) && await E(() => !!document.querySelector('#sellOk'))) { out.push(await sellAct()); await wait(400); continue }
      let h = await handle(inf);
      if (h === 'decide') { if (same.n < 15 && inf.btns.length && inf.btns.every(b => b.dis)) { await wait(800); continue } h = await fallback(inf); if (!h) { if (same.n > 40) return { stop: 'decide', inf, out }; await wait(500); continue } LOG.push([inf.title.slice(0, 60), h]) }
      if (h) out.push(h);
      await wait(150);
    } catch (e) { out.push('ERR ' + String(e.message).slice(0, 60)); await wait(1500) }
  }
  return { stop: 'steps', out };
};
globalThis.startFig = async (name, fig, fam = 'BAK') => {
  let i = await info2();
  if (!(i && /SLEKTEN/.test(i.title))) {
    await closeAll();
    if (!(await E(() => !document.querySelector('#title').hidden))) { await E(() => document.querySelector('#newBtn')?.click()); await wait(900); i = await info2(); if (i && i.btns.length === 2) await clickIdx(1); await wait(1200) }
    await E(() => document.querySelector('#tStart').click()); await wait(1500);
    i = await info2(); if (i && i.btns.length === 2 && /NYTT/.test(i.title)) { await clickIdx(1); await wait(1500) }
  }
  await tab.select('#dyFam', fam); await wait(800);
  await E((f) => document.querySelector(`#dyGrid [data-f="${f}"]`)?.click(), fig); await wait(400);
  await E(() => document.querySelector('#slip [data-a="blessing"]')?.click()); await wait(300);
  await tab.fill('#dyNick', ''); await tab.type('#dyNick', name); await wait(500);
  const pre = await E(() => document.querySelector('#slip .body').innerText.match(/GREN NR\.[^\n]*\n[^\n]*/)?.[0]);
  await E(() => document.querySelector('#dyOk').click());
  for (let k = 0; k < 15; k++) { await wait(1000); if (await E(() => !!(S && S.dyn && document.querySelector('#title').hidden && S.money >= 25000))) break }
  Object.assign(STATE, { waits: 0, lastBuyVal: 0, gaveAt: -99, invDay: -99, mv: {} });
  return { pre, dyn: await E(() => S.dyn && S.dyn.nick) };
};
globalThis.branches = () => E(() => { const f = dynStore().fams.BAK; return Object.values(f.b).map(b => b.n + ':' + b.e) });
print('bot loaded');

globalThis.payTribute = async () => {
  await closeAll(); await E(() => document.querySelector('#aGjeng').click()); await wait(2500);
  await E(() => document.querySelector('#slip [data-tab="k"]')?.click()); await wait(2500);
  if (!(await E(() => !!document.querySelector('#slip #gTGo')))) { await closeAll(); return 'tribute: no form' }
  await E(() => document.querySelector('#slip [data-tp="100"]').click()); await wait(300);
  const amt = await E(() => document.querySelector('#gTA').value);
  await E(() => document.querySelector('#gTGo').click());
  let msg = ''; for (let k = 0; k < 20; k++) { await wait(700); msg = await E(() => document.querySelector('#gTM')?.innerText || ''); if (!/^Du har kr/.test(msg)) break }
  await closeAll(); STATE.tribDone = true; return 'tribute ' + amt + ': ' + msg;
};
const _mainA = mainAction;
globalThis.mainAction = async () => {
  const s = await E(() => ({ r: S.rankIdx, day: S.day, m: S.money, imp: !!S.imp }));
  if (s.r >= 5 && s.day >= 3610 && !s.imp) {
    if (s.day >= 3649 && globalThis.TRIBUTE === true && !STATE.tribDone) return await payTribute();
    await E(() => document.querySelector('#layLowBtn').click()); await wait(600);
    const ok = await E(() => { const b = document.querySelector('#slip [data-w="1"]'); if (b && !b.disabled) { b.click(); return true } return false });
    if (!ok) await closeAll();
    return 'wait1';
  }
  return await _mainA();
};
const _startF = startFig; globalThis.startFig = async (...a) => { const r = await _startF(...a); STATE.tribDone = false; return r };
globalThis.REP = globalThis.REP || [];
globalThis.driver = async (ms) => {
  const t0 = Date.now();
  while (Date.now()-t0 < ms) {
    const over = await tab.evaluate(()=>!S || S.over);
    if (over) {
      for (let k=0;k<25;k++){ const i=await info2(); if(!i){ await wait(800); if(!(await info2())) break; continue;} const h=await handle(i); if(h==='decide'){ const f=await fallback(i); if(!f) break; } await wait(700); }
      REP.push('branches '+JSON.stringify(await branches()));
      const nx = (globalThis.QUEUE||[]).shift(); if (!nx) { REP.push('queue empty'); return 'done'; }
      REP.push('start '+JSON.stringify(await startFig(nx[0], nx[1], nx[2]||'BAK')));
      REP.push('fame '+(await tab.evaluate(async()=>(await fameTop(true)).mine)));
    }
    const r = await run(300, null);
    if (r.stop==='decide' || r.stop==='stuck') { REP.push(r.stop+' '+(r.inf?r.inf.title:'')); return r.stop; }
  }
  return 'time';
};
