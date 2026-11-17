// Fills the holes ach.js does not cover. Load last. Plays only through buttons and dialogs.
const E = (fn, arg) => tab.evaluate(fn, arg);

const blobOf = (inf) => (inf.title || '') + '\n' + (inf.body || '') + '\n' + inf.btns.map(b => b.t).join('\n');
async function nameKas() {
  const ok = await E(() => {
    const i = document.querySelector('#kasNm');
    if (!i) return false;
    i.focus();
    i.value = 'Gullkalven';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#kasNmOk')?.click();
    return true;
  });
  if (!ok) return false;
  await wait(700);
  if (await E(() => !!document.querySelector('#kasNm'))) {
    await E(() => {
      const b = [...document.querySelectorAll('#slip footer button')].find(x => /SENERE/i.test(x.innerText) && !x.disabled);
      if (b) b.click();
    });
    return false;
  }
  return true;
}
const gfOffer = (inf) => /Don Rafael|Ta imot varen|løyven|Behzad/i.test(blobOf(inf));

const _handleG = globalThis.handle;
globalThis.handle = async (inf) => {
  const law = inf.btns.find(b => /BETAL ADVOKAT/i.test(b.t) && !b.dis);
  if (law) { await clickIdx(law.i); return 'lawyer ' + law.t; }

  if (inf.btns.some(b => /AVSLUTT OG SE/i.test(b.t))) {
    const stay = inf.btns.find(b => /FORTSETT/i.test(b.t) && !b.dis);
    if (stay) { await clickIdx(stay.i); return 'gf-stay'; }
  }

  if (gfOffer(inf)) {
    const yes = inf.btns.find(b => b.primary && !b.dis && !/^NEI/i.test(b.t));
    if (yes) { await clickIdx(yes.i); return 'gf-yes ' + yes.t; }
    return 'decide';
  }

  if (/GI FRA DEG KASINOET/i.test(blobOf(inf))) {
    const a = await ach();
    const give = inf.btns.find(b => /GI FRA DEG/i.test(b.t) && !b.dis);
    const hold = inf.btns.find(b => /FORSVAR/i.test(b.t) && !b.dis);
    const b = !a.kas_back && give ? give : hold;
    if (b) { await clickIdx(b.i); return (!a.kas_back ? 'kas-give ' : 'kas-hold ') + b.t; }
  }

  if (/Bryllupet er i et lokale|Hva tar du med/i.test(inf.body || '')) {
    const c = await E(() => {
      const cs = [...document.querySelectorAll('#slip .choice, #slip .body button, #slip .body .b')].filter(b => b.offsetParent && !b.disabled);
      const b = cs.find(x => /KONVOLUTT|FORD|HOLLAND/i.test(x.innerText)) || cs.find(x => !/KAN IKKE/i.test(x.innerText));
      if (!b) return null;
      b.click();
      return b.innerText.replace(/\s+/g, ' ').slice(0, 50);
    });
    if (c) return 'wedding ' + c;
  }

  if (await E(() => !!document.querySelector('#kasNm'))) {
    const ok = await nameKas();
    return ok ? 'kas-name' : 'kas-name-skip';
  }

  return _handleG(inf);
};

const _fbG = globalThis.fallback;
globalThis.fallback = async (inf) => {
  if (gfOffer(inf)) {
    const yes = inf.btns.find(b => b.primary && !b.dis && !/^NEI/i.test(b.t));
    if (yes) { await clickIdx(yes.i); return 'gf-yes ' + yes.t; }
    return null;
  }
  if (inf.btns.some(b => /AVSLUTT OG SE/i.test(b.t))) {
    const stay = inf.btns.find(b => /FORTSETT/i.test(b.t) && !b.dis);
    if (stay) { await clickIdx(stay.i); return 'gf-stay'; }
    return null;
  }
  return _fbG(inf);
};

const _sellG = globalThis.sellAct;
globalThis.sellAct = async () => {
  if (globalThis._RX && globalThis._RX.mode === 'express') {
    STATE.expressTried = await E(() => S.day);
    const row = await E(() => {
      const tr = [...document.querySelectorAll('#slip tbody tr')].find(t => t.querySelector('#n_amf'));
      if (!tr) return null;
      const n = tr.querySelector('#n_amf');
      const c = tr.querySelectorAll('td');
      return { have: +c[1].innerText.replace(/\D/g, ''), demand: +(c[2].innerText.match(/\d+/) || [0])[0], dis: n.disabled };
    });
    if (!row || row.dis || row.demand < 1) {
      STATE.noSellDay = await E(() => S.day);
      await E(() => {
        const b = [...document.querySelectorAll('#slip footer button')].filter(x => !x.disabled && x.id !== 'sellOk' && x.id !== 'sellWait' && x.id !== 'sellAll').pop();
        if (b) b.click();
      });
      return 'express-nodemand';
    }
    const sold = await E(() => {
      const max = document.querySelector('#slip [data-max="amf"]');
      if (!max || max.disabled) return 0;
      max.click();
      const ok = document.querySelector('#sellOk');
      if (!ok || ok.disabled) return 0;
      ok.click();
      return 1;
    });
    if (!sold) {
      await E(() => {
        const b = [...document.querySelectorAll('#slip footer button')].filter(x => !x.disabled && x.id !== 'sellOk' && x.id !== 'sellWait' && x.id !== 'sellAll').pop();
        if (b) b.click();
      });
      return 'express-noclick';
    }
    return 'express-sold';
  }
  return _sellG();
};

const _buyG = globalThis.buyDialogAct;
globalThis.buyDialogAct = async () => {
  if (STATE.needAmf) {
    const r = await E(() => {
      const n = document.querySelector('#slip #n_amf');
      if (!n) return 'no-row';
      const price = +(n.closest('tr').querySelectorAll('td')[1].innerText.replace(/\D/g, '') || 0);
      if (!price) return 'no-price';
      const q = Math.max(1, Math.min(40, Math.floor(S.money * 0.04 / price)));
      n.value = q;
      n.dispatchEvent(new Event('input', { bubbles: true }));
      const b = document.querySelector('#buyOk');
      if (b && !b.disabled) { b.click(); return 'ok ' + q; }
      return 'disabled';
    });
    STATE.needAmf = false;
    if (typeof r === 'string' && r.startsWith('ok')) return 'express-buy ' + r;
  }
  return _buyG();
};

async function kasTouch() {
  const st = await E(() => {
    if (!S || S.wk || S.rankIdx < 3) return null;
    const K = S.kas || { lvl: 0, kasse: 0 };
    const L = K.lvl && typeof KAS_LV !== 'undefined' ? KAS_LV[K.lvl] : null;
    const got = (typeof achStore === 'function') ? achStore() : {};
    const next = (K.lvl | 0) + 1;
    const NL = next >= 1 && next < KAS_LV.length ? KAS_LV[next] : null;
    return { lvl: K.lvl | 0, kasse: K.kasse | 0, taken: K.taken || '', min: L ? L.min : 0, money: S.money, rank: S.rankIdx,
      empty: !!got.kas_empty, raf: !!got.kas_raf,
      nextPrice: NL ? NL.price : 0, nextRank: NL ? NL.rank : 99 };
  });
  if (!st) return null;
  // Level 1 is the only till a high roller can empty. Stay there until that happens.
  const pin = st.lvl === 1 && !st.empty;
  const over = pin && st.kasse > 260000;
  const under = pin && st.kasse < 250000;
  const wantUp = !pin && st.empty && !st.raf && st.lvl >= 1 && st.lvl < 3 && st.rank >= st.nextRank && st.money > st.nextPrice + 1e6;
  if (st.lvl && st.kasse >= st.min && !st.taken && !wantUp && !over && !under) return null;
  await closeAll();
  await E(() => document.querySelector('#mmBtn')?.click());
  await wait(800);
  const menu = await E(() => { const b = document.querySelector('#slip [data-mm="kasino"]'); if (!b) return false; b.click(); return true; });
  if (!menu) { await closeAll(); return 'kas-nomenu'; }
  await wait(1400);
  let offer = null;
  if (!st.lvl) {
    offer = await E(() => {
      const b = [...document.querySelectorAll('#slip footer button')].find(x => x.classList.contains('primary') && !x.disabled && !/SENERE|LUKK/i.test(x.innerText));
      if (!b) return 'no-primary';
      b.click();
      return b.innerText.replace(/\s+/g, ' ').slice(0, 60);
    });
    await wait(1200);
  }
  if (await E(() => !!document.querySelector('#kasNm'))) {
    const named = await nameKas();
    if (!named) { await closeAll(); return 'kas-name-skip'; }
  }
  if (st.taken || await E(() => !!(S.kas && S.kas.taken))) {
    await E(() => document.querySelector('#slip [data-kt="v"]')?.click());
    await wait(400);
    await E(() => { const b = document.querySelector('#slip [data-kr="b"]:not([disabled])'); if (b) b.click(); });
    await wait(800);
  }
  if (wantUp && await E(() => document.querySelector('#slip [data-kt="u"]'))) {
    await E(() => document.querySelector('#slip [data-kt="u"]')?.click());
    await wait(400);
    await E((n) => { const b = document.querySelector(`#slip [data-ku="${n}"]:not([disabled])`); if (b) b.click(); }, st.lvl + 1);
    await wait(1500);
    for (let i = 0; i < 4; i++) { const j = await info2(); if (!j) break; if (j.btns.length === 1) { await clickIdx(0); await wait(500); break } await clickIdx((j.btns.find(b => !b.dis && !b.primary) || j.btns.find(b => !b.dis) || { i: 0 }).i); await wait(400); }
  }
  // A level-1 till above ~260k can never be emptied. Take it all out, then put exactly 250k back.
  if (pin) {
    await E(() => document.querySelector('#slip [data-kt="o"]')?.click());
    await wait(300);
    const kasse = await E(() => (S.kas && S.kas.kasse) | 0);
    const land = [125000, 250000, 1000000].find(a => kasse + a >= 250000 && kasse + a <= 260000);
    if (kasse > 260000 || (kasse > 0 && kasse < 250000 && !land)) {
      await E(() => document.querySelector('#slip [data-kout="1"]:not([disabled])')?.click());
      await wait(400);
    }
  }
  await E(() => {
    if (!S.kas || !S.kas.lvl) return;
    const L = KAS_LV[S.kas.lvl];
    if (!L) return;
    const got = achStore();
    const pinNow = S.kas.lvl === 1 && !got.kas_empty;
    const target = pinNow ? 250000 : L.min;
    if ((S.kas.kasse | 0) >= target && (S.kas.kasse | 0) >= L.min) return;
    document.querySelector('#slip [data-kt="o"]')?.click();
  });
  await wait(400);
  await E(() => {
    if (!S.kas || !S.kas.lvl) return;
    const L = KAS_LV[S.kas.lvl];
    const got = achStore();
    const pinNow = S.kas.lvl === 1 && !got.kas_empty;
    const target = pinNow ? 250000 : L.min;
    const have = S.kas.kasse | 0;
    if (have >= target && have >= L.min) return;
    if (pinNow && have > 260000) return;
    const need = target - have;
    if (need <= 0) return;
    const bs = [...document.querySelectorAll('#slip [data-kin]')].filter(b => !b.disabled).map(b => ({ b, a: +b.dataset.kin })).sort((p, q) => p.a - q.a);
    const pick = pinNow ? bs.find(x => have + x.a >= 250000 && have + x.a <= 260000) : (bs.find(x => x.a >= need) || bs[bs.length - 1]);
    if (pick) pick.b.click();
  });
  await wait(500);
  await closeAll();
  return 'kas ' + (offer || 'manage');
}

const _mainG = globalThis.mainAction;
globalThis.mainAction = async () => {
  // The cub sale waits until the screen is quiet. Opening another dialog first leaves it pending forever.
  if (await E(() => typeof ct === 'function' && !!(ct().tigPend))) { await wait(2000); return 'tig-wait' }
  const dr = await E(() => {
    if (typeof drOn !== 'function' || !drOn()) return null;
    return { heat: S.heat || 0, kok: S.inv.kok | 0, left: 70 - (S.day - S.dr.start) };
  });
  if (dr) {
    if (dr.heat >= 60 && dr.left > 12) {
      await closeAll();
      await E(() => document.querySelector('#layLowBtn')?.click());
      await wait(600);
      const ok = await E(() => { const b = document.querySelector('#slip [data-w="7"]'); if (b && !b.disabled) { b.click(); return true } return false });
      if (!ok) await closeAll();
      return 'dr-cool ' + Math.round(dr.heat);
    }
    if (dr.kok > 0) {
      globalThis._RX = Object.assign(globalThis._RX || {}, { mode: null, a: await ach() });
      await E(() => document.querySelector('#aSell')?.click());
      return 'dr-sell ' + dr.left;
    }
  }
  const a = await ach();
  const ex = await E(() => S ? { amf: S.inv.amf | 0, buy: S.amfBuyDay || 0, day: S.day, rank: S.rankIdx } : null);
  if (ex && !a.ekspress && ex.amf > 0 && ex.buy === ex.day && STATE.expressTried !== ex.day) {
    STATE.expressOpen = (STATE.expressOpenDay === ex.day ? (STATE.expressOpen || 0) : 0) + 1;
    STATE.expressOpenDay = ex.day;
    if (STATE.expressOpen > 3) STATE.expressTried = ex.day;
    else {
      globalThis._RX = Object.assign(globalThis._RX || {}, { mode: 'express', a });
      await E(() => document.querySelector('#aSell')?.click());
      await wait(400);
      return 'express-open';
    }
  }
  const job = await E(() => {
    const js = (S.jobs || []).filter(j => (j.ali || j.tore) && (j.prog | 0) < j.q && S.day <= j.until);
    if (!js.length) return null;
    js.sort((p, q) => p.until - q.until);
    const j = js[0];
    const cs = j.k === 'fetch' && j.c ? [j.c] : (typeof COUNTRIES !== 'undefined' ? COUNTRIES.filter(c => c.m[j.g] && (!c.minRank || S.rankIdx >= c.minRank)).sort((p, q) => p.days - q.days).map(c => c.id) : []);
    return { k: j.k, g: j.g, q: j.q, c: cs[0] || null, have: S.inv[j.g] | 0, who: j.ali ? 'ali' : 'tore', left: j.until - S.day };
  });
  if (job && job.k === 'sell' && job.have > 0) {
    globalThis._RX = Object.assign(globalThis._RX || {}, { mode: 'nowait', a });
    await E(() => document.querySelector('#aSell')?.click());
    return 'job-sell ' + job.who + ' ' + job.g;
  }
  if (job && job.c && job.left > 2 && (job.k === 'fetch' || job.have < job.q)) {
    STATE.forceRoute = job.c;
    await E(() => document.querySelector('#aBuy')?.click());
    return 'job-buy ' + job.who + ' ' + job.g + ' via ' + job.c;
  }
  const cub = await E(() => {
    if (typeof ct !== 'function' || typeof vgHas !== 'function' || !vgHas('villa') || S.rankIdx < 5) return null;
    if (typeof drOn === 'function' && drOn()) return null;
    const C = ct();
    if ((C.tigSold || 0) >= 5 || C.tigPend) return null;
    const mo = dayDate(S.day).getFullYear() * 12 + dayDate(S.day).getMonth();
    if (C.tigM === mo) return null;
    if ((S.money | 0) < 200000) return null;
    return { sold: C.tigSold || 0, day: S.day };
  });
  if (cub && STATE.cubDay !== cub.day) {
    STATE.cubDay = cub.day;
    STATE.needAmf = false;
    STATE.forceRoute = 'th';
    await E(() => document.querySelector('#aBuy')?.click());
    return 'cub-seek ' + cub.sold;
  }
  const pace = await E(() => ({
    heat: S.heat || 0,
    ali: (S.ali && S.ali.done) || 0,
    tore: (S.tore && S.tore.done) || 0,
    gf: !!S.godfather,
    rank: S.rankIdx,
    kasLow: !!(S.kas && S.kas.lvl && typeof KAS_LV !== 'undefined' && S.kas.kasse < KAS_LV[S.kas.lvl].min),
  }));
  if (pace.kasLow && STATE.kasDay !== (ex && ex.day)) {
    STATE.kasDay = ex && ex.day;
    const k = await kasTouch();
    if (k && k !== 'kas-nomenu') return k;
  }
  if (!a.ekspress && ex && pace.heat < 70 && !(ex.amf > 0 && ex.buy === ex.day) && STATE.expressArm !== ex.day) {
    const n = STATE.expressN || 0;
    if (n < 8 || ex.day % 40 === 0) {
      STATE.expressArm = ex.day;
      STATE.expressN = n + 1;
      STATE.needAmf = true;
      STATE.forceRoute = 'se';
      await E(() => document.querySelector('#aBuy')?.click());
      return 'express-seek ' + STATE.expressN;
    }
  }
  // Short Sweden trips roll Ali and Tore offers. Tore's offers stop at godfather, so finish those first.
  if (pace.heat < 65 && pace.rank < 5 && (pace.ali < 10 || (pace.tore < 5 && !pace.gf)) && ex && ex.day % 2 === 0 && STATE.farmDay !== ex.day) {
    STATE.farmDay = ex.day;
    STATE.needAmf = false;
    STATE.forceRoute = 'se';
    await E(() => document.querySelector('#aBuy')?.click());
    return 'job-farm ali ' + pace.ali + ' tore ' + pace.tore;
  }
  if (STATE.kasDay !== (ex && ex.day)) {
    STATE.kasDay = ex && ex.day;
    const k = await kasTouch();
    if (k && k !== 'kas-nomenu') return k;
  }
  return _mainG();
};

const _runG = globalThis.run;
globalThis.run = async (...args) => {
  const r = await _runG(...args);
  const tail = (r.out || []).filter(Boolean).slice(-8).join(' | ').slice(0, 500);
  if (tail) print('ACT ' + r.stop + ' ' + tail);
  try { await E(() => { if (S && !S.over) store.set('save', { v: 1, t: Date.now(), lang: LANG, S }); }); } catch (e) {}
  return r;
};

print('gap loaded');
