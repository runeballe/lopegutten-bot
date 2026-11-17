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
      month: d.getMonth(), date: d.getDate(), money: S.money, inv: { ...S.inv }, free: nordFree(), fight: nordHasFight(),
      jobNeed: Object.fromEntries(NORD_PL.filter(p => !N.sec[p]).map(p => { const j = N.jobs[p] && NORD_JOBS.find(j => j.id === N.jobs[p]); return [p, j && j.need && j.need.g ? [j.need.g, j.need.q] : null] })) };
  });
  const click = sel => E(s => { const b = document.querySelector(s); if (b && !b.disabled) { b.click(); return true } return false }, sel);
  const primary = () => E(() => { const b = [...document.querySelectorAll('#slip footer button.primary')].find(b => !b.disabled); if (b) { b.click(); return b.innerText.trim() } return null });
  // Do one thing in Tromsø. Returns a log string, or null when nothing is left to do here.
  async function northStep(t) {
    if (t.fight) {
      await E(() => document.querySelector('#nordCard [data-fight]')?.click()); await wait(1200);
      const r = await primary(); log('fight ' + r); return 'tr-fight ' + r;
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
      await closeAll();
    }
    return null;
  }
  async function goHome() {
    await closeAll();
    await E(() => { const b = document.querySelector('#layLowBtn'); if (b) b.click(); else nordHomeAsk() }); await wait(1000);
    const r = await E(() => { const s = document.querySelector('#slip'); const b = s && [...s.querySelectorAll('footer button')].find(b => /REIS HJEM|GO HOME/i.test(b.innerText) && !b.disabled); if (b) { b.click(); return b.innerText.trim() } return (s && s.querySelector('header')?.innerText || '').slice(0, 60) });
    await wait(1500); log('home ' + r); return 'tr-home ' + r;
  }
  async function goNorth() {
    await closeAll();
    await E(() => document.querySelector('#impCard .r[data-i="nord"]')?.click()); await wait(1000);
    if (!(await primary())) { await closeAll(); return null }
    await wait(900);
    const ok = await click('#slip .ngo[data-v="fly"]'); await wait(1500);
    log('north ' + ok); return ok ? 'tr-north' : null;
  }
  // goods an unsecured place's current job is waiting for
  const missing = t => Object.values(t.jobNeed || {}).filter(x => x && (t.inv[x[0]] | 0) < x[1]).map(x => x[0]);
  STATE.trBuy = null;
  const _ma = globalThis.mainAction;
  globalThis.mainAction = async () => {
    const t = await trInfo();
    if (t && !t.king) {
      const allSec = ['hv', 'st', 'td'].every(p => t.sec[p]);
      if (t.here) {
        const r = await northStep(t); if (r) return r;
        return await goHome();
      }
      // In Oslo: fly north when all places are secured and it is dark, or to keep taking places.
      const fightTime = allSec && (t.dark || (t.month === 10 && t.date >= 19));
      const miss = missing(t);
      if (fightTime || (!allSec && miss.length === 0)) { const r = await goNorth(); if (r) return r }
      if (!allSec && miss.length) STATE.trBuy = miss; else STATE.trBuy = null;
      if (allSec && !fightTime) {
        // wait for the polar night (21 November) a week at a time
        await click('#layLowBtn'); await wait(600);
        const w = await E(() => { const b = document.querySelector('#slip [data-w="7"]:not([disabled])'); if (b) { b.click(); return 7 } return null });
        if (!w) await closeAll(); return 'tr-wait-dark';
      }
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
