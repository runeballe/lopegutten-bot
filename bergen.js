// Bergen mode: after Gudfar, before 2000. Stock up on sprit/ecstasy/tobacco, ship to Bergen every week,
// do Sjø-Svein's jobs, buy Hansa-Henrik out at the showdown.
const E = (fn, arg) => tab.evaluate(fn, arg);
globalThis.bgInfo = () => tab.evaluate(() => { if (!S || !S.bg || !S.bg.on) return null; const b = S.bg, M = b.m || {};
  const ms = k => M[k] ? { st: M[k].st, n: M[k].n | 0, dl: M[k].dl } : null;
  return { ctl: Math.round(b.ctl * 10) / 10, taken: !!b.taken, ships: b.ships.length, sentWk: b.sentWk, wk: Math.floor(S.day / 7), oInv: !!b.ev.oInv, retry: b.retry || 0, day: S.day,
    f: ms('f'), b: ms('b'), n: ms('n'), r: ms('r'), inv: { spr: S.inv.spr | 0, ecs: S.inv.ecs | 0, tob: S.inv.tob | 0, kok: S.inv.kok | 0 }, money: S.money } });
globalThis.BGLOG = [];
const need = (bi) => {
  const q = { spr: 2500, ecs: 0, tob: 0 };
  if (!bi.b || bi.b.st === 'on') q.ecs = 1100 - (bi.b ? bi.b.n : 0);
  if (!bi.r || bi.r.st === 'on') q.tob = 350 - (bi.r ? bi.r.n : 0);
  return q;
};
async function bgOpen() { await closeAll(); const ok = await E(() => { const c = document.querySelector('#bgCard'); if (c) { c.click(); return true } return false }); await wait(1200); return ok && !!(await E(() => document.querySelector('#slip.bgslip, #slip .bg'))) }
async function bgSendUI(g, q, r) {
  const has = await E(() => !!document.querySelector('#bgG')); if (!has) return 'no-form';
  const opts = await E(() => [...document.querySelectorAll('#bgG option')].map(o => o.value)); if (!opts.includes(g)) return 'no-' + g;
  await tab.select('#bgG', g); await wait(200);
  await E((r) => document.querySelector(`#slip .rt[data-r="${r}"]`)?.click(), r); await wait(200);
  await E((q) => { const i = document.querySelector('#bgQ'); i.value = String(q); i.dispatchEvent(new Event('input', { bubbles: true })) }, q); await wait(200);
  const ok = await E(() => { const b = document.querySelector('#bgGo'); if (b && !b.disabled) { b.click(); return true } return false }); await wait(1200);
  return ok ? `sent ${q} ${g} via ${r}` : 'send-disabled';
}
globalThis.bergenAct = async (bi) => {
  // showdown
  if (bi.oInv && !bi.taken && !(bi.retry > bi.day)) {
    if (!(await bgOpen())) return null;
    await E(() => document.querySelector('#bgOppg')?.click()); await wait(1200);
    const c = await E(() => { const b = document.querySelector('#slip [data-c="buy"]:not([disabled])') || document.querySelector('#slip [data-c="trick"]:not([disabled])'); if (b) { b.click(); return b.dataset.c } return null });
    BGLOG.push('showdown ' + c); return 'bg-showdown ' + c;
  }
  if (bi.sentWk !== bi.wk && bi.ships < 3) {
    const plan = [];
    if (bi.b && bi.b.st === 'on' && bi.inv.ecs > 0) plan.push(['ecs', Math.min(bi.inv.ecs, 1000 - bi.b.n + 50, 1500)]);
    if (bi.r && bi.r.st === 'on' && bi.inv.tob > 0) plan.push(['tob', Math.min(bi.inv.tob, 300 - bi.r.n + 20)]);
    if (bi.inv.spr > 0) plan.push(['spr', Math.min(bi.inv.spr, 2000)]);
    if (bi.inv.kok > 0) plan.push(['kok', Math.min(bi.inv.kok, 800)]);
    if (!plan.length) return null;
    if (!(await bgOpen())) return null;
    const res = [];
    for (const [g, q] of plan.slice(0, 3 - bi.ships)) { if (q <= 0) continue; res.push(await bgSendUI(g, q, 'bane')); }
    await closeAll(); BGLOG.push(bi.day + ' ctl ' + bi.ctl + ' ' + res.join(', ')); return 'bg ' + res.join(', ');
  }
  return null;
};
// stock check + override of rank-5 coasting
const _mainB = globalThis.mainAction;
globalThis.mainAction = async () => {
  const gi = await gameInfo();
  const bi = gi.rank >= 5 && !gi.imp ? await bgInfo() : null;
  if (bi && !bi.taken) {
    const a = await bergenAct(bi); if (a) return a;
    const nd = need(bi);
    const short = (bi.inv.spr < 2000 && 'spr') || (nd.ecs > 0 && bi.inv.ecs < nd.ecs && 'ecs') || (nd.tob > 0 && bi.inv.tob < nd.tob && 'tob');
    if (short) { STATE.bgTrip = short === 'ecs' ? 'nl' : 'pl'; await E(() => document.querySelector('#aBuy').click()); return 'bg-trip ' + STATE.bgTrip + ' for ' + short; }
    // wait a week (lay low) until next shipment
    await E(() => document.querySelector('#layLowBtn').click()); await wait(600);
    const ok = await E(() => { const b = document.querySelector('#slip [data-w="7"]:not([disabled])') || document.querySelector('#slip [data-w="1"]:not([disabled])'); if (b) { b.click(); return b.dataset.w } return null });
    if (!ok) await closeAll(); return 'bg-wait ' + ok;
  }
  return _mainB();
};
const _routeB = globalThis.route;
globalThis.route = (gi) => (gi.rank >= 5 && !gi.imp && STATE.bgTrip) ? STATE.bgTrip : _routeB(gi);
// buy dialog in Bergen mode: explicit stock targets
globalThis.bgBuyOverride = async () => {
  const gi = await gameInfo(); if (!(gi.rank >= 5 && !gi.imp && STATE.bgTrip)) return null;
  const bi = await bgInfo(); if (!bi || bi.taken) return null;
  const tgt = { spr: 30000, tob: 600, ecs: 2500 };
  const q = {};
  const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => tr.querySelector('input[type=number]')?.dataset.id).filter(Boolean));
  for (const g of Object.keys(tgt)) if (rows.includes(g)) q[g] = Math.max(0, tgt[g] - (gi.inv[g] | 0));
  await E((q) => { for (const [id, v] of Object.entries(q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, q);
  STATE.bgTrip = null;
  const ok = await E(() => { const b = document.querySelector('#buyOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button').click(); return false });
  return 'bg-buy ' + JSON.stringify(q) + (ok ? '' : ' (none)');
};
const _buyB = globalThis.buyDialogAct;
globalThis.buyDialogAct = async () => (await bgBuyOverride()) || _buyB();
print('bergen loaded');
