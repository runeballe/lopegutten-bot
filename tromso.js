// Tromsø mode (Imperiet only): carry the goods the place jobs ask for, fly north, do the jobs in
// Havna, Storgata and Tromsdalen (and hire Kasse-Roger's lads), go home when nothing is left to do,
// and fight Jølle at the grill once all three places are secured and the polar night has come.
// Load after bot.js. Everything goes through the game's own buttons.
{
  const E = (fn, arg) => tab.evaluate(fn, arg);
  // goods the place jobs ask for (NORD_JOBS), with a margin
  const NEED = { kok: 60, ecs: 250, mar: 350, spr: 350, pis: 15, amf: 150, tob: 450 };
  globalThis.TRLOG = [];
  const log = s => { TRLOG.push(s); if (TRLOG.length > 200) TRLOG.shift() };
  globalThis.trInfo = () => E(() => {
    if (!S || !S.imp || S.over || typeof nordS !== 'function') return null;
    const N = nordS(), d = dayDate(S.day);
    return { here: !!N.here, king: !!N.king, sec: { ...N.sec }, c: { ...N.c }, trips: N.trips | 0, dark: nordSeason() === 'dark',
      month: d.getMonth(), date: d.getDate(), money: S.money, fs: N.fs | 0, cap: N.here ? ({ fly: 3000, boat: 9000 })[N.here.via] || 3000 : 3000, soppOn: typeof nordSoppOn === 'function' && !!nordSoppOn(), soppDone: (N.fsY | 0) >= (N.king ? 40000 : 12000), inv: { ...S.inv }, free: nordFree(), fight: nordHasFight(),
      jobNeed: Object.fromEntries(NORD_PL.filter(p => !N.sec[p]).map(p => { const j = N.jobs[p] && NORD_JOBS.find(j => j.id === N.jobs[p]); return [p, j && j.need && j.need.g ? [j.need.g, j.need.q] : null] })) };
  });
  const click = sel => E(s => { const b = document.querySelector(s); if (b && !b.disabled) { b.click(); return true } return false }, sel);
  const primary = () => E(() => { const b = [...document.querySelectorAll('#slip footer button.primary')].find(b => !b.disabled); if (b) { b.click(); return b.innerText.trim() } return null });
  // Close a Tromsø slip with its own back/close button. Never closeAll here: on a place slip the last
  // button is «Kjøp av Boris», so closeAll walks Havna → Boris → buy dialog (the old loop).
  const closeNord = async () => {
    for (let k = 0; k < 4; k++) {
      const r = await E(() => { const v = document.querySelector('#veil'); if (!v || v.hidden) return null; const s = document.querySelector('#slip');
        const x = s.querySelector('.slipx') || [...s.querySelectorAll('footer button')].find(b => /^(TILBAKE|LUKK|BACK|CLOSE|IKKE I KVELD|BLI LITT TIL)/i.test(b.innerText.trim())) || s.querySelector('footer button[data-i="0"]');
        if (x) { x.click(); return 'x' } return 'none' });
      if (!r) return; if (r === 'none') { await closeAll(); return } await wait(500);
    }
  };
  // Do one thing in Tromsø. Returns a log string, or null when nothing is left to do here.
  async function northStep(t) {
    if (t.fight) {
      await closeNord();
      await E(() => document.querySelector('#nordCard [data-fight]')?.click()); await wait(1200);
      const eat = await E(() => { const b = [...document.querySelectorAll('#slip footer button')].find(b => /PØLSA|SAUSAGE/i.test(b.innerText) && !b.disabled); if (b) { b.click(); return true } return false });
      if (eat) await wait(900);
      const r = await primary(); await wait(1500); log('fight ' + (eat ? '(pølse) ' : '') + r); return 'tr-fight ' + r;
    }
    // autumn: pick fleinsopp on Kvaløya until the bag is full
    if (t.soppOn && t.fs < t.cap - 900) {
      await closeNord();
      if (await click('.actions .nat-td')) {
        await wait(900);
        const g = await E(() => { const b = document.querySelector('#slip [data-x="sopp"]'); if (b && !b.disabled) { b.click(); return true } return false });
        await wait(1500);
        if (g) { await closeNord(); log('sopp ' + t.fs); return 'tr-sopp ' + t.fs }
        await closeNord();
      }
    }
    for (const p of ['hv', 'st', 'td']) {
      if (t.sec[p]) continue;
      if (!(await click('.actions .nat-' + p))) continue;
      await wait(900);
      const job = await E(() => { const b = [...document.querySelectorAll('#slip footer button')].find(b => /^(GJØR DET|DO IT)/i.test(b.innerText.trim())); if (b && !b.disabled) { b.click(); return b.innerText.trim() } return null });
      if (job) { await wait(1500); log(p + ' ' + job); return 'tr-job ' + p + ' ' + job }
      if (p === 'td' && t.money > 5e6) {
        const g = await E(() => { const b = document.querySelector('#slip [data-x="guys"]'); if (b && !b.disabled) { b.click(); return true } return false });
        if (g) { await wait(1500); log('td guys'); return 'tr-guys' }
      }
      await closeNord();
    }
    return null;
  }
  async function goHome() {
    await closeNord();
    await E(() => { setTimeout(() => nordHomeAsk(), 10) }); await wait(1200);
    const r = await E(() => { const s = document.querySelector('#slip'); const b = s && [...s.querySelectorAll('footer button')].find(b => /REIS HJEM|GO HOME/i.test(b.innerText) && !b.disabled); if (b) { b.click(); return b.innerText.trim() } return null });
    await wait(1800); await settleNord();
    const still = await E(() => !!nordS().here);
    log('home ' + r + (still ? ' (fortsatt nord)' : '')); return 'tr-home ' + r;
  }
  const settleNord = async () => { for (let k = 0; k < 6; k++) { const i = await info2(); if (!i) return; const h = await handle(i); if (h === 'decide') await fallback(i); await wait(500) } };
  async function goNorth() {
    await closeAll();
    await E(() => document.querySelector('#impCard .r[data-i="nord"]')?.click()); await wait(1000);
    if (!(await primary())) { await closeAll(); return null }
    await wait(900);
    const ok = await click('#slip .ngo[data-v="fly"]'); await wait(1500);
    log('north ' + ok); return ok ? 'tr-north' : null;
  }
  // sell fleinsopp in Oslo (as much as today's demand takes)
  async function sellSopp() {
    await closeAll();
    if (!(await click('#goods .nordfs'))) return null;
    await wait(900);
    const r = await E(() => { const R = document.querySelector('#slip #nfsR'); if (R) { R.value = R.max; R.dispatchEvent(new Event('input', { bubbles: true })) } const b = document.querySelector('#slip #nfsOk'); if (b && !b.disabled) { b.click(); return R ? R.max : '?' } return null });
    await wait(1500); await settleNord(); await closeAll();
    log('sopp sold ' + r); return r ? 'tr-sopp-sell ' + r : null;
  }
  // goods an unsecured place's current job is waiting for
  const missing = t => Object.values(t.jobNeed || {}).filter(x => x && (t.inv[x[0]] | 0) < x[1]).map(x => x[0]);
  STATE.trBuy = null;
  const _ma = globalThis.mainAction;
  globalThis.mainAction = async () => {
    const t = await trInfo();
    if (t) {
      const allSec = ['hv', 'st', 'td'].every(p => t.sec[p]);
      if (t.here) {
        const r = await northStep(t); if (r) return r;
        return await goHome();
      }
      if (t.fs > 0) { const r = await sellSopp(); if (r) return r }
      if (!t.king) {
        // fly north when it is dark (the flight takes 2 days, so from 19 Nov) or to keep taking places
        const fightTime = allSec && (t.dark || (t.month === 10 && t.date >= 19));
        const miss = missing(t);
        if (fightTime || (!allSec && miss.length === 0)) { const r = await goNorth(); if (r) return r }
        STATE.trBuy = !allSec && miss.length ? miss : null;
      }
      // autumn: a fleinsopp trip when there is room in the season
      if (t.soppOn && t.money > 1e6 && !t.soppDone) { const r = await goNorth(); if (r) return r }
    }
    return _ma();
  };
  // When goods are missing, buy them on the normal trips (top up to NEED).
  const _buy = globalThis.buyDialogAct;
  globalThis.buyDialogAct = async () => {
    if (STATE.trBuy && STATE.trBuy.length) {
      const gi = await gameInfo();
      const q = {};
      const rows = await E(() => [...document.querySelectorAll('#slip tbody tr')].map(tr => tr.querySelector('input[type=number]')?.dataset.id).filter(Boolean));
      for (const g of STATE.trBuy) if (rows.includes(g)) q[g] = Math.max(0, Math.round(NEED[g] * 1.2) - (gi.inv[g] | 0));
      if (Object.keys(q).length) {
        await E((q) => { for (const [id, v] of Object.entries(q)) { const n = document.querySelector('#slip #n_' + id); if (!n) continue; n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })) } }, q);
        const ok = await E(() => { const b = document.querySelector('#buyOk'); if (b && !b.disabled) { b.click(); return true } return false });
        if (ok) { log('buy ' + JSON.stringify(q)); return 'tr-buy ' + JSON.stringify(q) }
      }
    }
    return _buy();
  };
  print('tromso loaded');
}
