// Gudfar speedrun layer. Load after bot.js; it replaces the trading and investing rules
// for a run aimed at «Færrest spilldager til Gudfar» and drives the game only through its UI.
// Plan A: trade fast (Fri/Sat sales, 1-day trips and sales around Easter and 17 May, family calls,
// few investments). Plan B: on the last usable game day, bold-play roulette at Byens kasinoer to
// reach kr 140 mill, buy fronts and the three Gudfar items, and trigger the rank check the same day.
{
const X = (fn, arg) => tab.evaluate(fn, arg);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CFG = Object.assign({
  lastDay: 253,       // Gudfar must be granted on this game day or earlier
  sellBy: 246,        // last day a street sale (4–7 days) surely ends by lastDay
  gudfarNW: 80e6,     // net worth needed after the Gudfar purchases
  vgCost: 60e6,       // villa 25 + Fornebu 20 + bystyre 15
  betUnit: 100000,    // DP grid for the casino bets
  layLowAt: 101,      // never: from Mastermind, Haukli resets heat 95 → 70 for free in 1990 (nothing to seize)
  // Rank 3, day ≤ midBy, thin inventory: one casino to Gangster (5 mill) while ~90 days of rank-4 trips remain.
  // Before day 145 the stake must be 1.8 mill (p≈0.35). After that, 1.2 mill is enough (the window is closing).
  mid: { 3: [1200000, 5000000] },
  midBy: 160,
  verbose: false,
}, globalThis.SR_CFG || {});
globalThis.SR = { cfg: CFG, events: [], fullRev: 0, waits: 0, inv: {}, finale: null, route: null, K: 3, lastTick: 0 };
const ev = (...a) => { const s = a.join(' '); SR.events.push(s); if (SR.events.length > 400) SR.events.shift(); if (globalThis.SR_LOG) SR_LOG(s); };

// ---- helpers that run inside the page (read-only views of the game's own formulas) ----
globalThis.srInject = () => X(() => {
  if (window.SRH && window.SRH.v === 9) return 'ok';
  const H = window.SRH = { v: 9 };
  H.DM = () => [1, 2, 3, 5, 10, 20][S.rankIdx] || 1;
  H.mktF = g => Math.max(.6, 1 - .04 * H.DM() * demMult(g));
  H.nextEv = () => { const st = evState(); return keyEvents().find(k => k.from > S.day && !st.shown[k.id]) || null };
  // expected street-sale revenue k days from now (norm: weekday factors = 1)
  H.exp = (k, inv, norm) => {
    inv = inv || S.inv; const day = S.day + k, w = dayDate(day).getDay(), DM = H.DM(); let R = 0;
    for (const g of GOODS) {
      const h = inv[g.id] | 0; if (!h || !unlocked(g)) continue;
      const sf = seasonFx(g.id, day);
      const dd = norm ? 1 : DOW_DEM[w], ds = norm ? 1 : DOW_SELL[w];
      const M = Math.max(1, Math.min(500 * DM, 200 * DM * dd * (norm ? 1 : sf.dem) * demMult(g.id)));
      const eu = h >= M ? M / 2 : h - h * h / (2 * M);
      let mk = mktIdx(g.id); for (let i = 0; i < k; i++) mk += (1 - mk) * .04;
      R += eu * g.price * 1.025 * (1 + SELL_BONUS[S.rankIdx]) * ds * (norm ? 1 : sf.sell) * statusPriceMult() * mk;
    }
    return Math.round(R);
  };
  H.sellUnit = id => G[id].price * 1.025 * (1 + SELL_BONUS[S.rankIdx]) * statusPriceMult() * H.mktF(id) * 1.04;
  H.perSale = id => 100 * H.DM() * demMult(id) * 1.15;
  // greedy fill of K sales of stock with the best sell/buy ratios
  H.fill = (prices, K, budget, minRatio) => {
    const items = Object.entries(prices).map(([id, price]) => {
      const sell = H.sellUnit(id), target = Math.max(0, Math.round(K * H.perSale(id) - (S.inv[id] | 0)));
      return { id, price, sell, ratio: sell / price, target, cap: ['mar', 'her', 'spr', 'lsd', 'amf', 'kok'].includes(id) ? .5 : .65 };
    }).filter(x => x.ratio >= minRatio && x.target > 0).sort((a, b) => b.ratio - a.ratio);
    const q = {}; let left = budget, profit = 0;
    for (const pass of [0, 1]) for (const it of items) {
      const have = q[it.id] || 0, cap = (pass ? 1 : it.cap) * budget;
      const n = Math.max(0, Math.min(it.target - have, Math.floor((cap - have * it.price) / it.price), Math.floor(left / it.price)));
      if (n > 0) { q[it.id] = have + n; left -= n * it.price; profit += n * (it.sell - it.price) }
    }
    let perSaleRev = 0; for (const it of items) if (q[it.id]) perSaleRev += Math.min(q[it.id] / K, H.perSale(it.id) / 1.15) * it.sell;
    return { q, spent: budget - left, profit, perSaleRev };
  };
  // keep cash to bail out one sale if Leif A. Lire is in Oslo when we come home (30 % of weeks; then bribes are off)
  H.reserve = () => Math.max(1500, 3 * waitCost()) + (S.rankIdx >= 1 ? .25 * S.money : 0) + (S.rankIdx >= 3 ? 30000 : 0) + (S.rankIdx >= 4 ? 150000 : 0);
  // choose the next country and the number of sales to stock for
  H.plan = (o = {}) => {
    const r = S.rankIdx, fl = S.flire && S.flire.where, nx = H.nextEv();
    const invRev = H.exp(0, null, true);      // what the stock on hand already brings to each sale
    let best = null;
    for (const c of COUNTRIES) {
      if (!['se', 'gb', 'nl', 'de', 'pl', 'pt', 'it', 'tr', 'ru'].includes(c.id)) continue;
      if ((c.minRank && r < c.minRank) || c.id === fl || S.money < c.cost + 500) continue;
      let days = c.days, evK = 0;
      if (nx && nx.from <= S.day + days) { days = Math.max(1, nx.from - S.day); evK = /easter/.test(nx.id) ? 5.5 : /may17/.test(nx.id) ? 9.5 : 3 }
      if (o.evOnly && !evK) continue;
      const maxK = Math.floor(((o.sellBy || 999) - S.day - days) / 5.8) + 1;
      if (maxK < 1) continue;
      const prices = {}; for (const g of GOODS) { const m = c.m[g.id]; if (m && unlocked(g)) prices[g.id] = g.price * m }
      const budget0 = Math.max(0, S.money - c.cost - H.reserve());
      const mule = (S.nBuy || 0) < 5 || r < 1 ? 0 : .07;
      // rank 4 turkey (her+kok+bom) costs ~1.4 mill per sale; K=6 leaves cash idle above ~8 mill
      for (const K of (evK ? [evK] : (r >= 4 ? [2, 3, 4, 6, 8, 10, 12, 16, 20] : [2, 3, 4])).filter(k => k <= maxK)) {
        const f = H.fill(prices, K, budget0 / (1 + mule), 1.25);
        const profit = f.profit - c.cost - f.spent * mule;
        // sales sell every good on hand, so a trip is charged only its share of the sale days
        const share = f.perSaleRev > 0 ? f.perSaleRev / (f.perSaleRev + invRev) : 1;
        const rate = profit / (days + (evK ? 9 : K * 5.8) * share);
        if (!best || rate > best.rate) best = { c: c.id, K, days, rate: Math.round(rate), profit: Math.round(profit), spent: Math.round(f.spent), share: +share.toFixed(2), psr: Math.round(f.perSaleRev), ev: !!evK };
      }
    }
    return best;
  };
  H.info = () => {
    const d = dayDate(S.day), now = evNow(), nx = H.nextEv();
    const inv = {}; let invV = 0; for (const g of GOODS) if ((S.inv[g.id] | 0) > 0) { inv[g.id] = S.inv[g.id]; invV += S.inv[g.id] * g.price }
    return { day: S.day, dow: d.getDay(), date: isFinite(d) ? d.toISOString().slice(0, 10) : 'ugyldig', rank: S.rankIdx, m: Math.round(S.money), nw: Math.round(netWorth()), heat: Math.round(S.heat || 0),
      inv, invV: Math.round(invV), nBuy: S.nBuy || 0, flire: S.flire ? S.flire.where : null, loan: S.loan ? loanRepay() : 0,
      ev: now ? { id: now.id, to: now.to } : null, nx: nx ? { id: nx.id, from: nx.from } : null, wc: waitCost(),
      fronts: Object.keys(S.fronts || {}), lawyer: S.lawyer == null ? -1 : S.lawyer, ins: !!S.insider, radio: !!S.radio, prot: protection(),
      calls: Object.keys((S.dyn && S.dyn.calls) || {}).length, gfDay: S.gfDay, over: !!S.over, vg: { ...(S.vg || {}) }, emp: empireCount(),
      status: S.status | 0, felles: isFellesferie(S.day), monthLeft: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1,
      e0: H.exp(0, null, true), nick: S.dyn && S.dyn.nick };
  };
  return 'injected';
});

// ---- dialog helpers ----
const modalOpen = () => X(() => { const v = document.querySelector('#veil'); return !!(v && !v.hidden) });
globalThis.srSettle = async (max = 40) => {
  for (let k = 0; k < max; k++) {
    const inf = await info2(); if (!inf) { await sleep(300); if (!(await info2())) return true; continue }
    let h = await handle(inf);
    if (h === 'decide') { if (inf.btns.length && inf.btns.every(b => b.dis)) { await sleep(700); continue } h = await fallback(inf); if (h) LOG.push([inf.title.slice(0, 60), h]) }
    await sleep(350);
  }
  return false;
};

// ---- trading overrides ----
globalThis.route = () => SR.route ? SR.route.c : 'pl';

globalThis.buyDialogAct = async () => {
  const rows = await X(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, price: +c[1].innerText.replace(/\D/g, '') } }).filter(Boolean));
  const K = SR.route ? SR.route.K : 3;
  const res = await X(([rows, K]) => {
    const prices = Object.fromEntries(rows.map(r => [r.id, r.price]));
    const mule = (S.nBuy || 0) < 5 || S.rankIdx < 1 ? 0 : .07;
    const budget = Math.max(0, S.money - SRH.reserve()) / (1 + mule);
    const f = SRH.fill(prices, K, budget, 1.2);
    for (const [id, v] of Object.entries(f.q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) }
    return f;
  }, [rows, K]);
  await sleep(150);
  const ok = await X(() => { const b = document.querySelector('#buyOk'); if (b && !b.disabled) { b.click(); return true } document.querySelector('#slip footer button').click(); return false });
  SR.boughtAt = SR.route; SR.fullRev = 0;
  return 'buy K=' + K + ' ' + JSON.stringify(res.q) + ' kr ' + Math.round(res.spent) + (ok ? '' : ' (none)');
};

globalThis.muleAct = async () => {
  const d = await X(() => ({ money: S.money, rank: S.rankIdx, everCaught: !!S.everCaught, nb: S.nBuy || 0, free: (S.freePass || 0) > 0 }));
  await X(() => { for (const id of ['stu', 'pen', 'pro', 'con']) for (let k = 0; k < 6; k++) document.querySelector(`#slip [data-m="${id}"][data-d="-1"]`)?.click() });
  // S.nBuy is already counted for this trip: trips 1–5 are risk-free, 6–10 half risk
  const ease = d.nb <= 5 ? 0 : d.nb <= 10 ? .5 : 1;
  let best = { n: { stu: 0, pen: 0, pro: 0, con: 0 } }, V = 0;
  if (ease > 0 && !d.free) {
    const t0 = await X(() => document.querySelector('#mSum').innerText);
    V = +((t0.match(/Du bærer selv:\s*kr\s?([\d\s]+)/) || [])[1] || '0').replace(/\D/g, '');
    const step = Math.max(1000, Math.round(V / 400)); const vals = []; for (let v = 0; v <= V + step; v += step) vals.push(v);
    const P = await X((vals) => vals.map(v => baseCustomsP(v)), vals);
    const p = v => Math.min(.95, P[Math.min(P.length - 1, Math.round(v / step))]) * ease;
    const types = [{ id: 'stu', cost: 2000, cap: 20000, risk: 1.4 }, { id: 'pen', cost: 5000, cap: 15000, risk: .7 }, { id: 'pro', cost: 20000, cap: 150000, risk: .3 }, { id: 'con', cost: 150000, cap: 1e13, risk: .25 }];
    best = null;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) for (let e = 0; e <= (d.rank >= 4 ? 1 : 0); e++) {
      if (d.rank < 2 && c > 0) continue;
      const n = { stu: a, pen: b, pro: c, con: e }; let rem = V, cost = 0, loss = 0, bad = false;
      for (const ty of types) for (let i = 0; i < n[ty.id]; i++) { if (rem <= 0) { bad = true; break } const l = Math.min(ty.cap, rem); rem -= l; cost += ty.cost; loss += p(l) * ty.risk * l * 2.3 }
      if (bad || cost > d.money) continue;
      if (rem > 0) { let ps = p(rem); if (!d.everCaught && d.nb >= 6 && d.nb <= 11) ps = Math.max(ps, .4 * ease); loss += ps * rem * 2.3 }
      if (!best || cost + loss < best.obj) best = { n, obj: cost + loss, cost };
    }
  }
  for (const id of ['stu', 'pen', 'pro', 'con']) for (let k = 0; k < best.n[id]; k++) await X((id) => document.querySelector(`#slip [data-m="${id}"][data-d="1"]`)?.click(), id);
  const go = await X(() => { const g = document.querySelector('#mGo'); if (g && !g.disabled) { g.click(); return true } return false });
  if (!go) await clickIdx(0);
  return 'mules ' + JSON.stringify(best.n) + ' V=' + V + ' ease=' + ease;
};

globalThis.sellAct = async () => {
  const s = await X(() => {
    const rows = [...document.querySelectorAll('#slip tbody tr')].map(tr => { const n = tr.querySelector('input[type=number]'); if (!n || n.disabled) return null; const c = tr.querySelectorAll('td'); return { id: n.dataset.id, have: +c[1].innerText.replace(/\D/g, ''), demand: +(c[2].innerText.match(/\d+/) || [0])[0], price: +c[3].innerText.split(/[▲▼]/)[0].replace(/\D/g, '') } }).filter(Boolean);
    const now = rows.reduce((a, r) => a + Math.min(r.have, r.demand) * r.price, 0);
    const L = S.lawyer >= 0 ? LAWYERS[S.lawyer] : null;
    return { now, rows, e: [1, 2, 3, 4].map(k => SRH.exp(k)), norm: SRH.exp(0, null, true), day: S.day, ev: !!evNow(), money: S.money, wc: waitCost(), nx: SRH.nextEv(), fl: flireStreet(), fee: L ? L.fee : 0,
      lire: S.rankIdx >= 1 && !flireVacation() ? { until: S.flire.until || 0, tail: flireTailing() } : null };
  });
  const dayVal = .1 * s.norm;
  let wait = false, why = '';
  if (!s.ev && SR.waits < 5 && s.money > 3 * s.wc) {
    for (let k = 1; k <= 4; k++) {
      if (s.day + k > CFG.sellBy) break;
      if (s.nx && s.day + k >= s.nx.from) break;          // the event start makes the next sale short anyway
      if (s.e[k - 1] - k * dayVal > s.now * 1.02) { wait = true; why = `k${k} ${s.e[k - 1]}>${s.now}`; break }
    }
  }
  if (s.now <= 0 && SR.waits < 4 && s.money > 2 * s.wc && s.day + 1 <= CFG.sellBy) wait = true;
  if (wait) { SR.waits++; await X(() => document.querySelector('#sellWait').click()); return 'wait ' + why }
  SR.waits = 0;
  if (s.now <= 0) { SR.noSellDay = s.day; await X(() => document.querySelector('#slip footer button').click()); return 'cancel-sell' }
  // Leif A. Lire: if he is in Oslo (or tailing us) when the sale ends, an arrest cannot be bribed, and without
  // bail money (40 % of the sale + kr 3000) it is 30 days in jail. He picks a new place (30 % Oslo) when his week ends,
  // so a sale is risky when he is here now or his week ends inside the 4–7 sale days. Then sell only what we can bail out.
  const win = s.ev ? 1 : 7;
  const risky = s.lire && (s.fl > 1 || s.lire.tail || s.lire.until <= s.day + win);
  const maxRev = Math.max(0, (s.money - 3000 - s.fee) / .4);
  if (risky && maxRev < s.now) {
    if (maxRev < .25 * s.now) {
      if ((SR.lireWaits || 0) < 6 && s.money > s.wc && s.day + 1 <= CFG.sellBy) { SR.lireWaits = (SR.lireWaits || 0) + 1; await X(() => document.querySelector('#sellWait').click()); return `lire-wait maxRev ${Math.round(maxRev)} of ${Math.round(s.now)} fl=${s.fl}` }
    } else {
      const f = maxRev / s.now;
      await X(([rows, f]) => { for (const r of rows) { const n = document.querySelector('#slip #n_' + r.id) || document.querySelector(`#slip input[type=number][data-id="${r.id}"]`); if (!n) continue; n.value = Math.floor(Math.min(r.have, r.demand) * f); n.dispatchEvent(new Event('input', { bubbles: true })) } }, [s.rows, f]);
      await sleep(200); await X(() => document.querySelector('#sellOk').click());
      SR.lireWaits = 0;
      return `sold-partial ${Math.round(maxRev)} of ${Math.round(s.now)} (Lire risk fl=${s.fl})`;
    }
  }
  SR.lireWaits = 0;
  // «Selg alt» selger nå med ett trykk (klikker #sellOk selv); klikk Selg bare hvis dialogen fortsatt står
  await X(() => document.querySelector('#sellAll').click()); await sleep(200);
  await X(() => { const ok = document.querySelector('#sellOk'); if (ok && !ok.disabled) ok.click() });
  return 'sold ~' + Math.round(s.now) + (risky ? ' (Lire risk, cash ok)' : '');
};

// ---- HQ actions ----
const openProt = async (tabId) => { await closeAll(); await X(() => document.querySelector('#aProt').click()); await sleep(900); if (tabId) { await X((t) => document.querySelector(`#slip [data-tab="${t}"]`)?.click(), tabId); await sleep(700) } };
globalThis.srTrigger = async () => { await openProt(); await closeAll(); await srSettle(60); };
globalThis.srCalls = async (kinds) => {
  await openRoom('slk'); await sleep(500);
  const got = await X(() => !!document.querySelector('#slip [data-call]'));
  if (!got) { await closeAll(); return 'calls: no room' }
  const out = await X((kinds) => {
    const f = dynCtx().f, res = [];
    for (const b of document.querySelectorAll('#slip [data-call]')) {
      const br = f && f.b[b.dataset.call]; if (!br || b.disabled) continue;
      if (!kinds.includes(br.e === 'GF' || br.e === 'IM' ? 'money' : 'heat')) continue;
      b.click(); res.push(br.e);
    }
    return res;
  }, kinds);
  await sleep(500); await closeAll();
  return 'calls ' + out.join(',');
};
const front = async (f) => { await openRoom('biz', 'fronts'); const r = await hqBuy(`[data-front="${f}"]`); await closeAll(); return r };
const hireLawyer = async (i) => { await openProt(); await X(() => document.querySelector('#slip [data-syn="law"]')?.click()); await sleep(800); const r = await hqBuy(`[data-hire="${i}"]`); await closeAll(); return r };

async function srInvest(i) {
  SR.inv ??= {};
  const once = (k) => { if (SR.inv[k + i.nick]) return false; SR.inv[k + i.nick] = 1; return true };
  // family: kr 150 000 per GF/IM relative once net worth is 600k; R-relatives cut heat
  if (i.rank >= 2 && i.nw >= 600000 && once('callM')) return await srCalls(['money']);
  if (i.rank >= 2 && i.heat >= 55 && once('callH')) return await srCalls(['heat']);
  if (i.rank >= 1 && !i.fronts.includes('kiosk') && i.m > 250000 && once('kiosk')) return 'kiosk ' + await front('kiosk');
  if (i.rank >= 1 && i.prot < 15 && i.m > 120000 && once('prot0')) return 'prot ' + await protBuy(['[data-cfill="t"]']);
  if (i.rank >= 2 && i.prot < 50 && i.m > 400000 && once('prot1')) return 'prot ' + await protBuy(['[data-cfill="t"]', '[data-cfill="f"]', '[data-cfill="g"]', 'weap']);
  // prot2, lawyer 4 and the radio front eat the rank-3 casino stake or the first Gangster trips. Buy them only after the bank can fill a long turkey run.
  if (i.rank >= 4 && i.prot < 85 && i.m > 15000000 && once('prot2')) return 'prot ' + await protBuy(['[data-hire="l"]', '[data-cfill="l"]', '[data-cfill="r"]', '[data-cfill="t"]', '[data-cfill="f"]', '[data-cfill="g"]', 'weap']);
  if (i.rank >= 1 && !i.radio && i.m > 150000 && once('radio')) { await openProt('u'); await X(() => document.querySelector('#slip [data-radio]')?.click()); await sleep(500); await closeAll(); await srSettle(); return 'police radio' }
  if (i.rank >= 2 && i.lawyer < 3 && i.m > 800000 && once('law3')) return 'lawyer3 ' + await hireLawyer(3);
  if (i.rank >= 4 && i.lawyer < 4 && i.m > 8000000 && once('law4')) return 'lawyer4 ' + await hireLawyer(4);
  if (i.rank >= 4 && !i.ins && i.m > 8000000 && once('ins')) { await openRoom('biz', 'fronts'); await X(() => document.querySelector('#slip [data-ins="1"]')?.click()); await sleep(500); await closeAll(); return 'insider' }
  if (i.rank >= 4 && i.lawyer < 5 && i.status >= 40 && i.m > 20000000 && once('law5')) { const r = await hireLawyer(5); return 'lawyer5 ' + r }
  return null;
}

// ---- Plan B: casino bold play ----
// Value iteration for P(reach target) at roulette. Bets: k numbers with s units each (k·s ≤ 50 units = kr 5 mill).
// Among near-optimal bets (within 0.03 % of the best value) it takes the largest stake, so fewer spins are needed.
globalThis.srBetPlan = (Wu, Tu, maxU = 50, tol = 3e-4) => {
  const ks = [1, 2, 3, 4, 6, 9, 12, 18];
  const V = new Float64Array(Tu + 1); V[Tu] = 1; const A = new Array(Tu + 1);
  const val = w => w >= Tu ? 1 : w <= 0 ? 0 : V[w];
  const each = (w, f) => { for (const k of ks) for (let s = 1; k * s <= Math.min(maxU, w); s++) { const up = w + (36 - k) * s; f(k, s, (k / 37) * val(up) + (1 - k / 37) * val(w - k * s)); if (up >= Tu) break } };
  for (let it = 0; it < 400; it++) {
    let delta = 0;
    for (let w = Tu - 1; w >= 1; w--) {
      let bv = 0; each(w, (k, s, v) => { if (v > bv) bv = v });
      if (Math.abs(bv - V[w]) > delta) delta = Math.abs(bv - V[w]);
      V[w] = bv;
    }
    if (delta < 1e-9) break;
  }
  for (let w = 1; w < Tu; w++) { let bs = -1; each(w, (k, s, v) => { if (v >= V[w] * (1 - tol) && k * s > bs) { bs = k * s; A[w] = [k, s] } }) }
  return { V, A, p: Wu >= Tu ? 1 : V[Math.max(0, Wu)] };
};
const chipSplit = (amt) => { const out = []; for (const c of [5000000, 1000000, 250000, 50000, 10000, 1000, 100]) while (amt >= c) { out.push(c); amt -= c } return out };

async function kbOpenList() {
  await closeAll(); await X(() => { setTimeout(() => kbList(), 10) }); await sleep(3500);
  return X(() => [...document.querySelectorAll('#slip .kbrow')].map(r => { const b = r.querySelector('[data-kin]'); const t = r.innerText.replace(/\s+/g, ' '); const mx = +((t.match(/maks kr ([\d ]+)/) || [])[1] || '0').replace(/\D/g, ''); const ks = +((t.match(/kassa kr ([\d ]+)/) || [])[1] || '0').replace(/\D/g, ''); return { id: b ? b.dataset.kin : null, t: t.slice(0, 60), max: mx, kasse: ks } }).filter(c => c.id));
}
async function kbSpin(bets) {
  // bets: [[cell, amount]]; chips stack on a cell by clicking it repeatedly
  const before = await X(() => ({ out: S.acc.otherOut || 0, inn: S.acc.otherIn || 0, m: S.money }));
  for (const [cell, amt] of bets) for (const c of chipSplit(amt)) {
    await X((c) => document.querySelector(`#slip [data-kb="${c}"]`)?.click(), c);
    await X((cell) => document.querySelector(`#slip .rc[data-c="${cell}"]`)?.click(), cell);
  }
  const tot = await X(() => document.querySelector('#kbTot')?.innerText || '');
  await X(() => document.querySelector('#kbGo')?.click());
  for (let k = 0; k < 60; k++) {
    await sleep(500);
    const r = await X((b) => ({ moved: (S.acc.otherOut || 0) !== b.out, res: document.querySelector('#kbRes')?.innerText || '', bad: document.querySelector('#kbRes')?.classList.contains('bad'), m: S.money, busy: !!document.querySelector('#kbGo')?.disabled }), before);
    if (r.moved && !r.busy) { await sleep(3200); const n = await X(() => ({ m: S.money, res: document.querySelector('#kbRes')?.innerText || '', num: document.querySelector('#kbNum')?.innerText })); return { ok: true, tot, ...n, d: n.m - before.m } }
    if (!r.moved && r.bad && r.res) return { ok: false, err: r.res };
  }
  return { ok: false, err: 'timeout' };
}
globalThis.srGamble = async (target) => {
  const list = (await kbOpenList()).filter(c => c.max >= 5000000).sort((a, b) => b.kasse - a.kasse);
  ev('casinos', JSON.stringify(list.slice(0, 5)));
  for (const c of list) {
    const m0 = await X(() => S.money); if (m0 >= target || m0 < CFG.betUnit) break;
    await closeAll(); await X(() => { setTimeout(() => kbList(), 10) }); await sleep(3500);
    await X((id) => document.querySelector(`#slip [data-kin="${id}"]`)?.click(), c.id); await sleep(3500);
    const inGame = await X(() => !!document.querySelector('#slip [data-kg="rou"]'));
    if (!inGame) { ev('casino enter failed', c.t, (await info2())?.body?.slice(0, 120)); continue }
    await X(() => document.querySelector('#slip [data-kg="rou"]').click()); await sleep(600);
    let fails = 0;
    for (let n = 0; n < 400; n++) {
      const m = await X(() => S.money);
      if (m >= target) break;
      const U = Math.max(10000, Math.round(target / 1000 / 10000) * 10000), Wu = Math.floor(m / U), Tu = Math.ceil(target / U);
      if (Wu < 1) break;
      if (!SR.betCache || SR.betCache.Tu !== Tu || SR.betCache.U !== U) SR.betCache = { Tu, U, plan: srBetPlan(Wu, Tu, Math.floor(5000000 / U)) };
      const plan = SR.betCache.plan; plan.p = plan.V[Wu];
      const a = plan.A[Wu]; if (!a) break;
      const [k, s] = a, amt = s * U;
      const cells = k === 18 ? [['red', 18 * amt]] : k === 12 ? [['d2', 12 * amt]] : Array.from({ length: k }, (_, i) => ['n' + (17 + i), amt]);
      const r = await kbSpin(cells);
      ev(`spin day bank=${m} k=${k} s=${amt} p=${plan.p.toFixed(3)} ->`, JSON.stringify(r));
      if (!r.ok) { if (++fails >= 3) break; continue }
    }
    await closeAll();
  }
  return X(() => S.money);
};

async function srFinale(i) {
  SR.finale = SR.finale || { day: i.day, startMoney: i.m };
  if (i.loan) { await X(() => document.querySelector('#aLoan').click()); await sleep(600); const inf = await info2(); const b = inf && inf.btns.find(b => /BETAL TILBAKE/i.test(b.t) && !b.dis); if (b) await clickIdx(b.i); await closeAll() }
  const fr = await X(() => { const have = Object.keys(S.fronts || {}); const need = Math.max(0, 3 - empireCount()); const cand = FRONTS.filter(f => !have.includes(f.id) && f.rank <= Math.max(4, S.rankIdx) && !f.status).sort((a, b) => a.price - b.price).slice(0, need); return { need, cost: cand.reduce((a, f) => a + f.price, 0), ids: cand.map(f => f.id) } });
  const vgLeft = await X(() => VG_ITEMS.filter(x => !vgHas(x.id)).reduce((a, x) => a + x.price, 0));
  const target = CFG.gudfarNW + vgLeft + fr.cost + 50000;
  ev(`FINALE day ${i.day} money ${i.m} target ${target} fronts ${JSON.stringify(fr)} p≈${(srBetPlan(Math.floor(i.m / CFG.betUnit), Math.ceil(target / CFG.betUnit)).p).toFixed(3)}`);
  if (i.m < target) await srGamble(target);
  const m = await X(() => S.money);
  if (m < target) { SR.abort = `gamble lost: kr ${m} < ${target}`; ev(SR.abort); return 'ABORT' }
  ev('WON the gamble, money', m);
  await srTrigger();                                   // net worth ≥ 5 mill → Gangster now
  for (const f of fr.ids) ev('front', f, await front(f));
  for (const id of ['villa', 'forn', 'by']) { ev(await vgBuy(id)); await srSettle() }
  const chk = await X(() => ({ nw: netWorth(), emp: empireCount(), vg: vgOk(), r: S.rankIdx }));
  ev('pre-check', JSON.stringify(chk));
  await srTrigger();
  const g = await X(() => ({ gfDay: S.gfDay, r: S.rankIdx, day: S.day, over: !!S.over }));
  ev('GUDFAR?', JSON.stringify(g));
  SR.done = g;
  return 'FINALE ' + JSON.stringify(g);
}

// ---- main decision ----
async function srMain() {
  await srInject();
  const i = await X(() => SRH.info());
  SR.last = i;
  SR.rankDays ??= {};
  if (SR.rankDays.nick !== i.nick) SR.rankDays = { nick: i.nick };
  if (SR.rankDays[i.rank] == null) { SR.rankDays[i.rank] = i.day; ev(`RANK ${i.rank} day ${i.day} money ${i.m} nw ${i.nw}`) }
  if (i.gfDay != null) { SR.done = { gfDay: i.gfDay, day: i.day }; return 'STUCK' }
  if (SR.abort) return 'STUCK';
  // CFG.clean: finish without the casino as soon as cash covers the Gudfar purchases plus the net-worth floor
  if (CFG.clean) {
    const t = await X((nw) => { const have = Object.keys(S.fronts || {}); const need = Math.max(0, 3 - empireCount()); const fc = FRONTS.filter(f => !have.includes(f.id) && f.rank <= Math.max(4, S.rankIdx) && !f.status).sort((a, b) => a.price - b.price).slice(0, need).reduce((a, f) => a + f.price, 0); return nw + fc + 50000 + VG_ITEMS.filter(x => !vgHas(x.id)).reduce((a, x) => a + x.price, 0) }, CFG.gudfarNW);
    if (i.m - (i.loan || 0) >= t + 200000) { ev(`CLEAN finish day ${i.day} money ${i.m} target ${t}`); const r = await srFinale(i); return r === 'ABORT' ? 'STUCK' : r }
  }
  // Plan B: the last game day where nothing else fits
  const tripFits = i.day + 1 + 4 <= CFG.sellBy;
  const canSell = i.invV > 0 && i.day <= CFG.sellBy;
  if (i.day > CFG.lastDay) { SR.abort = 'past lastDay ' + i.day; return 'STUCK' }
  if (!canSell && (!tripFits || i.day >= CFG.sellBy - 6)) { const r = await srFinale(i); return r === 'ABORT' ? 'STUCK' : r }
  // loan shark: the loan only costs its 20 % fee in net worth, so hold the largest loan the rank allows while capital is short
  const L = await X(() => ({ has: !!S.loan, amt: S.loan ? S.loan.amt : 0, due: S.loan ? S.loan.due : 0, rp: S.loan ? loanRepay() : 0, can: LOAN_BY_RANK[S.rankIdx] || 0 }));
  const loanBtn = async (re) => { await X(() => document.querySelector('#aLoan').click()); await sleep(600); const inf = await info2(); const b = inf && inf.btns.find(b => re.test(b.t) && !b.dis); if (b) { await clickIdx(b.i); await sleep(400); await srSettle(); return true } await closeAll(); return false };
  // 20 % is on the loan, not on net worth. Due is day+180. Repay near due, or to swap up to a larger loan. Do not repay just because rank is 4.
  // Do not take or roll a loan while the rank-3 casino is still ahead: the debt is added to the cash target.
  const midPending = i.rank === 3 && i.day <= (CFG.midBy || 160) && !(SR.midDone && SR.midDone[3]) && i.m >= 900000;
  if (!midPending && L.has && i.m >= L.rp + 500 && (i.day >= L.due - 12 || (L.can > L.amt && i.m >= L.rp + 100000))) { if (await loanBtn(/BETAL TILBAKE/i)) return 'loan repaid ' + L.rp }
  if (!midPending && !L.has && i.rank <= 4 && i.m < 12000000 && i.day + 40 < CFG.sellBy) { if (await loanBtn(/TA LÅNET|LÅN KR|TAKE/i)) return 'loan taken ' + L.can }
  const inv = await srInvest(i); if (inv) return inv;
  // optional mid-game bold play to the next rank threshold: SR_CFG.mid = { rank: [minMoney, targetNetWorth] }
  const mid = CFG.mid && CFG.mid[i.rank];
  const midMin = mid ? (i.day <= 145 ? Math.max(mid[0], 1800000) : mid[0]) : 0;
  if (mid && i.day <= (CFG.midBy || 160) && !(SR.midDone && SR.midDone[i.rank]) && i.rank >= 2 && i.invV < .1 * i.m && i.m >= midMin && !i.ev) {
    SR.midDone = { ...(SR.midDone || {}), [i.rank]: 1 };
    const target = mid[1] + (i.m - i.nw) + 20000;
    ev(`MID gamble rank ${i.rank} day ${i.day} money ${i.m} -> ${target}`);
    const m = await srGamble(target);
    ev(`MID result ${m}`);
    if (m < target) { if (m < mid[0] / 4) { SR.abort = `mid gamble lost day ${i.day}: ${m}`; return 'STUCK' } return 'mid-lost ' + m }
    await srTrigger();
    return 'mid-won ' + m;
  }
  // heat: monthly ØKOKRIM above 80, raids from 60, Haukli at 95
  const monthSoon = i.monthLeft <= 7;
  if (!i.ev && i.day < CFG.sellBy - 10 && i.heat >= CFG.layLowAt && i.m > i.wc * 7 * 3) {
    await X(() => document.querySelector('#layLowBtn').click()); await sleep(600); await X(() => document.querySelector('#slip [data-w="7"]')?.click()); return 'laylow h' + i.heat;
  }
  const r = i.nx ? i.nx.from - i.day : 999;
  const evPlan = !i.ev && r <= 7 && r >= 1 ? await X((sb) => SRH.plan({ evOnly: true, sellBy: sb }), CFG.sellBy) : null;
  const plan = evPlan || await X((sb) => SRH.plan({ sellBy: sb }), CFG.sellBy);
  // sell when stock supports a decent sale; go buy when it does not
  const full = Math.max(SR.fullRev || 0, 1);
  if (!SR.fullRev && i.e0 > 0) SR.fullRev = i.e0;
  const eventTrip = !!(evPlan && evPlan.profit > 0);
  // sell while the stock alone gives at least half of what a sale would bring after a fresh trip
  const sellWorthy = i.invV > 0 && (i.ev || !plan || plan.profit <= 0 || i.e0 >= .5 * (i.e0 + plan.psr) || i.day + plan.days > CFG.sellBy - 5);
  if (!eventTrip && sellWorthy && SR.noSellDay !== i.day && i.day <= CFG.sellBy) { await X(() => document.querySelector('#aSell').click()); return 'sell e0=' + i.e0 + ' full=' + Math.round(full) }
  if (!plan || plan.profit <= 0 || i.day + plan.days + 4 > CFG.sellBy) {
    if (i.invV > 0 && i.day <= CFG.sellBy && SR.noSellDay !== i.day) { await X(() => document.querySelector('#aSell').click()); return 'sell-left' }
    if (i.invV > 0 && i.day + 1 <= CFG.sellBy) { await X(() => document.querySelector('#layLowBtn').click()); await sleep(600); await X(() => document.querySelector('#slip [data-w="1"]')?.click()); return 'wait1' }
    if (i.day < 120 && (!plan || plan.profit <= 0)) { SR.abort = 'no profitable trip day ' + i.day + ' money ' + i.m; return 'STUCK' }
    const r2 = await srFinale(i); return r2 === 'ABORT' ? 'STUCK' : r2;
  }
  SR.route = plan; SR.fullRev = 0;
  await X(() => document.querySelector('#aBuy').click());
  return 'buy ' + JSON.stringify(plan);
};
globalThis.mainAction = async () => {
  const r = await srMain(), l = SR.last;
  return r === 'STUCK' || !l ? r : `[d${l.day} ${'TLPMGF'[l.rank]} m${l.m} nw${l.nw} h${l.heat}] ${r}`;
};

// ---- dialogs ----
const _handle = handle;
globalThis.handle = async (inf) => {
  const text = inf.title + ' || ' + inf.body;
  const en = inf.btns.filter(b => !b.dis);
  if (CFG.keepPlaying && /^GUDFAR/i.test(inf.title.trim()) && en.some(b => !/AVSLUTT/i.test(b.t))) { const b = en.find(b => !/AVSLUTT/i.test(b.t)); await clickIdx(b.i); return 'gudfar-continue ' + b.t }
  if (/^GUDFAR/i.test(inf.title.trim()) && en.some(b => /AVSLUTT/i.test(b.t))) { const b = en.find(b => /AVSLUTT/i.test(b.t)); await clickIdx(b.i); return 'gudfar-quit' }
  if (/Razzia i morgen|Raid tomorrow/i.test(inf.title)) { const b = en.find(b => /Flytt varene|Move the goods/i.test(b.t)); if (b) { await clickIdx(b.i); return 'raid-move' } }
  if (/sharkslip|NOTATBOKA|LÅNEHAI|NESTEN BLAKK/i.test(text)) { const b = en.find(b => !/TA LÅNET|GÅ TIL LÅNEHAIEN/i.test(b.t)); if (b) { await clickIdx(b.i); return 'no-loan' } }
  if (/copslip/.test(inf.cls) && await X(() => !!document.querySelector('#slip .opt[data-o]'))) {
    // lawyer (acquittal keeps the money) when we have a good one; bail rather than jail when bribes are off (Leif A. Lire)
    const how = await X(() => {
      const q = s => document.querySelector(`#slip .opt[data-o="${s}"]`), ok = b => b && !b.disabled;
      const bail = +((q('bail')?.querySelector('.num')?.innerText || '').replace(/\D/g, '') || 1e15);
      if (ok(q('law')) && S.lawyer >= 3 && S.money >= LAWYERS[S.lawyer].fee && !document.querySelector('#slip .notice.bad')) { q('law').click(); return 'law' }
      if (!ok(q('bribe')) && S.money >= bail) { q('bail').click(); return 'bail' }
      return null;
    });
    if (how) return 'arrest-' + how;
  }
  if (/fightslip/.test(inf.cls) && await X(() => !!document.querySelector('#slip .choice[data-c]:not([disabled])'))) {
    const d = await X(() => { const t = document.querySelector('#slip .body').innerText; const m = t.match(/SJANSE FOR Å VINNE\s*(\d+)\s*%/i); const sl = t.match(/Dere\s*(\d+)\s*mot\s*De\s*(\d+)/i); return { p: m ? +m[1] / 100 : null, mine: sl ? +sl[1] : null, opp: sl ? +sl[2] : null, give: !!document.querySelector('#slip .wantrow') } });
    // giving the goods away is a sure loss, so always fight for them (a lost attempt only costs wall time); flee events: run unless clearly stronger
    const fight = d.p != null && (d.give ? true : (d.p >= .9 && d.mine >= d.opp));
    await X((c) => document.querySelector(`#slip .choice[data-c="${c}"]`).click(), fight ? 'fight' : 'yield'); return 'fight ' + (fight ? 'yes' : 'no') + ' ' + JSON.stringify(d);
  }
  return _handle(inf);
};

// ---- driver ----
globalThis.srDriver = async (ms) => {
  const t0 = Date.now();
  const W = { day: null, t: Date.now(), err: 0 };
  await srInject();
  while (Date.now() - t0 < ms) {
    const st0 = await X(() => ({ over: !S || S.over, gf: S && S.gfDay }));
    if (st0.gf != null) { SR.done = SR.done || { gfDay: st0.gf }; await srSettle(); return 'gudfar' }
    if (st0.over) { await srSettle(); return 'over' }
    if (SR.abort) return 'abort';
    const r = await run(40, null);
    // vaktbikkje: samme feil om og om igjen, eller dagen står stille i 90 s (NaN teller som stille)
    const nErr = r.out.filter(a => /^ERR/.test(String(a))).length;
    W.err = nErr ? W.err + nErr : 0;
    if (W.err > 20) { SR.abort = 'watchdog: feil gjentas ' + W.err + 'x: ' + String(r.out.find(a => /^ERR/.test(String(a)))).slice(0, 60); return 'abort' }
    const dNow = await X(() => (S && Number.isFinite(S.day)) ? S.day : -1).catch(() => -1);
    if (dNow !== W.day || SR.finale) { W.day = dNow; W.t = Date.now() }
    else if (Date.now() - W.t > 90000) { SR.abort = 'watchdog: dag ' + dNow + ' uendret i 90 s'; return 'abort' }
    for (const a of r.out) if (a && !/^(scn|btn|next|null)/.test(a)) ev(a);
    // the same non-main action 40 times in a row: a dialog we keep re-clicking
    if (r.out.length >= 40 && r.out.every(a => a === r.out[0]) && !/^\[d/.test(String(r.out[0]))) { SR.abort = 'loop: ' + String(r.out[0]).slice(0, 80); return 'abort' }
    if (SR.done && SR.done.gfDay != null) return 'gudfar';
    const l = SR.last;
    // behind schedule: [day, minimum rank, minimum net worth]
    if (l && !SR.abort && !SR.finale) for (const [d, rk, nw] of (globalThis.SR_MILESTONES || [])) if (l.day >= d && (l.rank < rk || l.nw < nw)) { SR.abort = `behind schedule: day ${l.day} rank ${l.rank} nw ${l.nw} (need rank ${rk}, nw ${nw} by day ${d})`; break }
    if (SR.abort) return 'abort';
    if (r.stop === 'decide') return 'decide';
    if (r.stop === 'over') continue;
  }
  return 'time';
};
print('speedrun loaded');
}
