// Direkte Onkel-Akan ukens-driver (ingen bot.js): eksplicitte steg med full logg.
import puppeteer from 'puppeteer-core';
const PROFILE = process.env.LG_PROFILE || `${process.env.HOME}/.local/share/lopegutten-bot/chrome`;
const TARGET = Number(process.env.LG_UKE_DAYS || 2000);
const say = (...a) => process.stdout.write(`[ONKEL] ` + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
console.log = say;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 240000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
let page = (await browser.pages())[0] || await browser.newPage();
// Re-attach: ny fane når gammel frame er detached, gå inn i ukens igjen (fortsetter lagret forsøk)
async function reattach() {
  try { const old = page; page = await browser.newPage(); try { await old.close() } catch (_) {} } catch (_) { page = await browser.newPage() }
  page.setDefaultTimeout(60000);
  try { await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]) } catch (_) {}
  await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined', { timeout: 120000 });
  await sleep(1500);
  await page.evaluate(() => { const t = document.querySelector('#tUke'); if (t) t.click() });
  await sleep(2500);
  for (let k = 0; k < 6; k++) {
    const b = await page.evaluate(() => { const s = document.querySelector('#slip'); if (!s || document.querySelector('#veil').hidden) return null;
      const na = [...s.querySelectorAll('footer button')].find(x => /SPILL NÅ|FORTSETT/i.test(x.innerText) && !x.disabled); if (na) { na.click(); return na.innerText.trim() } return null });
    if (!b) break; say('re-inngang: ' + b); await sleep(1500);
  }
  say('re-attach ferdig');
}
page.setDefaultTimeout(60000);
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined', { timeout: 120000 });
say('lastet');
// ingenting i veien: tittelskjerm → ukens
await page.evaluate(() => { const t = document.querySelector('#tUke'); if (t) t.click() });
await sleep(2500);
for (let k = 0; k < 12; k++) {
  const b = await page.evaluate(() => { const s = document.querySelector('#slip'); if (!s || document.querySelector('#veil').hidden) return null;
    const na = [...s.querySelectorAll('footer button')].find(x => /SPILL NÅ/i.test(x.innerText)); if (na) { na.click(); return 'SPILL NÅ' }
    const tU = s.querySelector('#tUke') || document.querySelector('#tUke'); if (tU) { tU.click(); return 'tUke' }
    const x = [...s.querySelectorAll('footer button')].find(x => !x.disabled); if (x) { x.click(); return 'prim:' + x.innerText.trim().slice(0, 20) } return null });
  if (!b) break; say('inngang: ' + b); await sleep(1200);
}
say('inntre'); let lastBuy = -99, noModalN = 0;
while (true) { try {
  let st = null;
  try { st = await page.evaluate(() => (typeof S !== 'undefined' && S) ? { day: S.day, money: Math.round(S.money), rank: S.rankIdx, over: S.over, heat: Math.round(S.heat || 0), inv: Object.fromEntries(Object.entries(S.inv).filter(([k, v]) => v)) } : null) } catch (e) { say('lesefeil — re-attach'); try { await reattach() } catch (e2) { say('re-attach feil: ' + String(e2.message).slice(0, 60)) } await sleep(3000); continue }
  if (!st) { say('S borte — ukens slutt?'); break }
  if (st.over) { say('OVER dag ' + st.day); break }
  if (st.day >= TARGET) { say('MÅL nådd dag ' + st.day); break }
  const cid = st.money < 2e6 ? 'se' : 'de';
  if (!globalThis._tick) globalThis._tick = 0;
  if (++globalThis._tick % 10 === 0) { const loc = await page.evaluate(() => typeof S !== 'undefined' ? ({ loc: S.loc || '?', u: Object.values(S.inv).reduce((a, b) => a + (+b || 0), 0) }) : ({ loc: '?' })); say('STATUS dag ' + st.day + ' kr ' + st.money + ' rank ' + st.rank + ' heat ' + st.heat + ' land ' + loc.loc + ' lager ' + (loc.u || 0)); }
  const veil = await page.evaluate(() => !document.querySelector('#veil').hidden);
  if (veil) {
    const cl = await page.evaluate(() => [...document.querySelectorAll('.countrylist li>button')].map(b => b.dataset.id));
    if (cl.length) {
      await page.evaluate(c => { const b = document.querySelector('.countrylist li>button[data-id=' + "'" + c + "']"); if (b) b.click() }, cid);
      say('→ land valgt: ' + cid); await sleep(700);
      await page.evaluate(() => { const b = [...document.querySelectorAll('#slip button')].find(x => /reis hit/i.test(x.innerText)); b && b.click() });
      await sleep(1000);
      await page.evaluate(() => { const b = [...document.querySelectorAll('#slip a,#slip button')].find(x => /hopp over/i.test(x.innerText || '')); b && b.click() });
      await sleep(1500); continue;
    }
    const info = await page.evaluate(() => { const s = document.querySelector('#slip');
      return { t: (s.querySelector('h3')?.textContent || '').trim(), body: s.querySelector('.body').innerText.replace(/\s+/g, ' ').slice(0, 110),
        fbs: [...s.querySelectorAll('footer button')].map(b => ({ t: b.innerText.trim().slice(0, 24), dis: b.disabled, pr: b.className.includes('primary') })),
        nbs: [...s.querySelectorAll('.body button:not([disabled])')].map(b => b.innerText.trim().slice(0, 24)).slice(0, 6) } });
    say('MODAL "' + info.t + '" | dag ' + st.day + ' kr ' + st.money + ' rank ' + st.rank + ' heat ' + st.heat + ' | ' + info.fbs.map(b => b.t).join('/'));
    const scn = await page.evaluate(() => { const s = document.querySelector('#slip');
      const out = s.querySelector('.scnout'); if (out && !out.hidden && out.querySelector('.sbtn')) { out.querySelector('.sbtn').click(); return 'out' }
      const it = s.querySelector('.scnitem.on .sbtn'); if (it) { it.click(); return 'item' }
      const nb = [...s.querySelectorAll('.body button')].find(b => b.offsetParent && !b.disabled && /^(VIDERE|OK|NESTE)$/i.test(b.innerText.trim())); if (nb) { nb.click(); return 'next' }
      const ch = s.querySelector('.scnchoices.on [data-c]'); if (ch) { ch.click(); return 'choice' }
      return null });
    if (scn) { say('→ scn: ' + scn); await sleep(1300); continue }
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
    if (kf) { say('→ konfrontasjon: ' + kf.act + ' | ' + kf.odds.slice(0, 40)); await sleep(1500); continue }
    const fh = await page.evaluate(() => { const b = [...document.querySelectorAll('#slip footer button,#slip .body button')].find(x => /gatepris/i.test(x.innerText) && !x.disabled); if (b) { b.click(); return true } return false });
    if (fh) { say('→ forhandling: selger til gatepris'); await sleep(1500); continue }
    const buy = await page.evaluate(() => !!document.querySelector('#buyOk'));
    if (buy) {
      const did = await page.evaluate(() => { const num = t => +String(t).replace(/[^0-9]/g, '') || 0;
        const rows = [...document.querySelectorAll('#slip tbody tr')];
        let budget = Math.min(S.money * 0.9, S.money - 2500); if (budget < 1000) return 'tom';
        let put = false;
        for (const r of rows) { const inp = r.querySelector('input[type=number]'); if (!inp) continue;
          const id = inp.dataset.id; const price = num(r.querySelectorAll('td')[1].textContent);
          const mx = Math.min(+inp.max || 1e9, 80);
          if (!price) continue;
          const q = Math.min(mx, Math.floor(budget / price), 80);
          if (q > 0 && budget >= q * price) { inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); budget -= q * price; put = true } }
        return put ? 'satt' : 'tom'});
      say('→ kjøp satt: ' + did); await sleep(500);
      await page.evaluate(() => { const b = [...document.querySelectorAll('#slip footer button')].find(x => /kjøp/i.test(x.innerText) && !x.disabled); b && b.click() });
      await sleep(1500); continue;
    }
    const sold = await page.evaluate(() => { if (!document.querySelector('#sellOk')) return false;
      const all = document.querySelector('#sellAll');
      if (all && !all.disabled) { all.click(); return true }
      const ok = document.querySelector('#sellOk');
      if (ok && !ok.disabled) { ok.click(); return true }
      const x = document.querySelector('#slip .x,#slip [data-x],#slip footer button');
      const canc = [...document.querySelectorAll('#slip footer button')].find(b => /avbryt/i.test(b.innerText) && !b.disabled);
      if (canc) { canc.click(); return 'avbrutt' }
      if (x) { x.click(); return 'avbrutt' }
      return false });
    if (sold) { say('→ salg satt'); await sleep(1400); continue }
    const arr = await page.evaluate(() => { const ast = document.querySelector('#acStage'); if (!ast) return null;
      const opts = [...ast.querySelectorAll('.opt:not([disabled])')];
      const bail = opts.find(x => x.dataset.o === 'bail');
      if (bail) { const num = (bail.querySelector('.num') || {}).textContent || '0'; if (S.money >= +num.replace(/[^0-9]/g, '')) { bail.click(); return 'kausjon' } }
      const jail = opts.find(x => x.dataset.o === 'jail'); if (jail) { jail.click(); return 'sone' } return null });
    if (arr) { say('→ arrest: ' + arr); await sleep(1400); continue }
    const fb = await page.evaluate(() => { const s = document.querySelector('#slip');
      const vis = [...s.querySelectorAll('button,a,[data-c],.sbtn')].filter(b => b.offsetParent && !b.disabled && !/gi opp|bestikk|sats|kasino|lotto/i.test(b.innerText || ''));
      const p = vis.find(b => b.closest('footer') && b.className.includes('primary')) || vis.find(b => b.closest('footer')) || vis[vis.length - 1];
      if (p) { p.click(); return 'klikk: ' + (p.innerText || p.className).trim().slice(0, 30) }
      return 'INGEN knapp: ' + s.innerHTML.replace(/\s+/g, ' ').slice(0, 600) });
    say('→ ' + fb);
    if (fb.startsWith('INGEN')) { await page.keyboard.press('Escape'); await page.mouse.click(5, 5) }
    await sleep(1300); continue;
  }
  if (st.heat > 30) { await page.evaluate(() => { layLow() }); say('→ ligger lavt (heat ' + st.heat + ')'); await sleep(1500); continue }
  const nInv = Object.values(st.inv).reduce((a, b) => a + b, 0);
  if (nInv > 0) { await page.evaluate(() => { doSell() }); say('→ selger ' + nInv + ' enheter'); await sleep(1500); continue }
  if (st.money < 9000) {
    if (st.money < 2500) { const ln = await page.evaluate(() => { try { if (typeof S !== 'undefined' && !S.loan && typeof loanDialog === 'function') { loanDialog(); return 'lån' } } catch (_) {} return null }); if (ln) { say('→ blakk: ber om lån'); await sleep(2500); continue } }
    await page.evaluate(() => { waitDay() }); if (!globalThis._w) globalThis._w = 0; if (++globalThis._w % 25 === 0) say('→ venter (kr ' + st.money + ' dag ' + st.day + ')'); await sleep(st.money < 5000 ? 400 : 1500); continue }
  if (st.day - lastBuy < 12) { await page.evaluate(() => { waitDay() }); say('→ venter frakt (dag ' + st.day + ')'); await sleep(1500); continue }
  lastBuy = st.day;
  await page.evaluate(c => { window._planCountry = c }, cid);
  await page.evaluate(() => { doBuy() }); say('→ kjøper tur (' + cid + ') kr ' + st.money);
  await sleep(1800);
  } catch (e) { say('ramme-feil: ' + String(e.message).slice(0, 60) + ' — reloader');
    try { await reattach() } catch (e2) { say('re-attach feil: ' + String(e2.message).slice(0, 60)) }
    await sleep(2000); continue
  } }

  await browser.close();
