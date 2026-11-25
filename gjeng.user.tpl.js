// ==UserScript==
// @name         Løpegutten – gjengen (respekt, kamp, gjengjobb)
// @namespace    https://lopegutten.com/
// @version      1.4
// @description  Daglige gjengoppgaver: tributt til respekt-taket, dagens gatekamp og dagens andel av ukas gjengjobb. Kjør for hvert spillerkort i en privat fane.
// @match        https://lopegutten.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==
// Built by build-userscript.mjs from bot.js + this template. Edit the template, not the built file.
//
// Two halves. This outer part runs in Tampermonkey's sandbox: it keeps the card list (GM storage, never
// in the page's localStorage) and opens private tabs. The game code must run in the page itself, so it is
// injected as a <script>. The halves talk through data attributes on <html> plus DOM events, because
// CustomEvent.detail does not cross from the page into the sandbox in every browser.
(function () {
  'use strict';
  const BOTSRC = /*BOTJS*/'';
  // Built-in cards come from ~/.config/lopegutten-bot/userscript-cards.json at build time; cards added in the editor are kept on top.
  const BUILTIN = /*CARDS*/[];
  const root = document.documentElement;
  const allCards = () => { const m = new Map(); for (const c of [...BUILTIN, ...GM_getValue('cards', [])]) if (c && c.c) m.set(c.c, c); return [...m.values()] };
  const publish = () => { root.dataset.lggCards = JSON.stringify(allCards()); root.dataset.lggIncog = (GM_info && GM_info.isIncognito) ? '1' : '0' };
  publish();
  document.addEventListener('lggang-save', () => {
    try { const list = JSON.parse(root.dataset.lggSave || '[]'); if (Array.isArray(list)) GM_setValue('cards', list) } catch (_) {}
    delete root.dataset.lggSave; publish();
  });
  document.addEventListener('lggang-open', () => {
    const code = String(root.dataset.lggOpen || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); delete root.dataset.lggOpen;
    if (!/^[A-Z0-9]{12}$/.test(code)) return;
    // incognito: each card gets storage that is separate from the normal profile, so the main card stays linked there.
    GM_openInTab('https://lopegutten.com/#lgauto=' + code, { active: true, incognito: true });
  });
  const s = document.createElement('script');
  s.textContent = '(' + pageMain.toString() + ')(' + JSON.stringify(BOTSRC) + ');';
  root.appendChild(s); s.remove();
})();

function pageMain(BOTSRC) {
  'use strict';
  const BOT = {};
  BOT.browser = { tab: () => ({
    evaluate: async (fn, a) => fn(a),
    select: async (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })) },
    fill: async s => { const e = document.querySelector(s); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })) },
    type: async (s, t) => { const e = document.querySelector(s); e.value += t; e.dispatchEvent(new Event('input', { bubbles: true })) },
  }) };
  BOT.print = () => {};
  // bot.js needs sloppy mode for `with`; new Function code is sloppy even inside this strict IIFE.
  // gang() is re-evaluated inside the `with`, so it sees bot.js helpers (run, handle, closeAll …) as bare names.
  new Function('BOT', 'with (BOT) {\n' + BOTSRC + '\n;(' + gang.toString() + ')()\n}')(BOT);
  function gang() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    BOT.COAST = false;
    // Year 2000: continue in Imperiet when the Imperiet slot is empty, so there is still a game to pay and sell from.
    const _h = handle;
    handle = async inf => {
      if (/y2kslip/.test(inf.cls) && !impSaved()) { const b = inf.btns.find(b => b.primary && !b.dis); if (b) { await clickIdx(b.i); return 'y2k-imp' } }
      return _h(inf);
    };
    // Short trips near the end of 1999.
    const _r = route;
    route = gi => (!gi.imp && gi.day >= 3560 ? (gi.flire === 'se' ? 'pl' : 'se') : _r(gi));

    let busy = false, stopReq = false;
    // Same look as the Løpegutten-bot panel: dark card, draggable header, minimise button.
    const css = document.createElement('style');
    css.textContent = `
    #lgGjeng{position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#111;color:#eee;font:12px/1.35 system-ui,sans-serif;
      border:1px solid #444;border-radius:10px;padding:8px;width:220px;box-shadow:0 6px 24px #0008}
    #lgGjeng.min .body{display:none}
    #lgGjeng header{display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:6px;cursor:move;user-select:none}
    #lgGjeng header button{background:none;border:0;color:#aaa;cursor:pointer;font-size:14px}
    #lgGjeng .row{display:flex;gap:4px;margin:4px 0}
    #lgGjeng .row button{flex:1;padding:6px 4px;border-radius:6px;border:1px solid #555;background:#222;color:#eee;cursor:pointer;font-size:12px}
    #lgGjeng .row button:hover{background:#333}
    #lgGjeng .row button.on{background:#e6ff00;color:#111;border-color:#e6ff00}
    #lgGjeng .row button:disabled{opacity:.4;cursor:default}
    #lgGjeng .st{white-space:pre-wrap;color:#bbb;margin-top:6px;font-size:11px;max-height:120px;overflow:auto}`;
    document.head.appendChild(css);
    const panel = document.createElement('div');
    panel.id = 'lgGjeng';
    panel.innerHTML = `<header><span>🤝 ØBB-gjengen</span><button data-a="min" title="Minimer">▁</button></header>
     <div class="body">
      <div class="row"><button data-g="alt">⭐ Alt</button></div>
      <div class="row"><input data-a="mal" placeholder="Kampmål, f.eks. gamle,duel,stha:30" title="Bydeler i prioritert rekkefølge (gamle, stha, toyen, frogner, maj, plata, lokka, gron, tveita, grorud). «duel» = ukas duell. :30 = bytt videre når vi leder med 30. Tomt = beste odds." style="flex:1;min-width:0;background:#222;color:#eee;border:1px solid #555;padding:4px;font:inherit"></div>
      <div class="row"><button data-g="trib">💰 Respekt</button><button data-g="kamp">🥊 Kamp</button></div>
      <div class="row"><button data-g="jobb">📦 Gjengjobb</button></div>
      <div class="row"><button data-g="stopp" disabled>⏹ Stopp</button></div>
      <div class="st" id="lgGLog"><div>Klar.</div></div></div>`;
    document.body.appendChild(panel);
    // Position and minimised state survive reloads.
    const PKEY = 'lgGjeng.ui';
    let ui = {}; try { ui = JSON.parse(localStorage.getItem(PKEY) || '{}') } catch (_) {}
    const saveUi = () => { try { localStorage.setItem(PKEY, JSON.stringify(ui)) } catch (_) {} };
    const place = () => {
      if (ui.x == null) return;
      const x = Math.min(Math.max(0, ui.x), innerWidth - panel.offsetWidth), y = Math.min(Math.max(0, ui.y), innerHeight - panel.offsetHeight);
      Object.assign(panel.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    };
    if (ui.min) panel.classList.add('min');
    place(); addEventListener('resize', place);
    { const f = panel.querySelector('[data-a=mal]'); if (ui.fight == null) { ui.fight = 'gamle,duel,stha:30'; saveUi() } f.value = ui.fight; f.onchange = () => { ui.fight = f.value.trim(); saveUi(); log('Kampmål: ' + (ui.fight || 'beste odds')) } }
    panel.querySelector('[data-a=min]').onclick = () => { ui.min = panel.classList.toggle('min'); saveUi(); place() };
    { const h = panel.querySelector('header'); let dx, dy, drag = false;
      h.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON') return; drag = true; const r = panel.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; h.setPointerCapture(e.pointerId); e.preventDefault() });
      h.addEventListener('pointermove', e => { if (!drag) return; ui.x = e.clientX - dx; ui.y = e.clientY - dy; place() });
      h.addEventListener('pointerup', () => { if (drag) { drag = false; saveUi() } }); }
    const setBusy = (on, k) => panel.querySelectorAll('[data-g]').forEach(b => {
      if (b.dataset.g === 'stopp') b.disabled = !on; else { b.disabled = on; b.classList.toggle('on', on && b.dataset.g === k) }
    });
    const log = t => { const d = document.createElement('div'); d.textContent = new Date().toTimeString().slice(0, 5) + ' ' + t; const L = panel.querySelector('#lgGLog'); L.prepend(d); while (L.children.length > 40) L.lastChild.remove() };

    const inGame = () => !!(typeof S !== 'undefined' && S && !S.over && !S.wk && !$('#game').hidden);
    async function settle(max = 40) {
      for (let k = 0; k < max; k++) {
        const i = await info2(); if (!i) return true;
        if (/gjslip|kgslip/.test(i.cls)) { await closeAll(); continue }
        let h = await handle(i); if (h === 'decide') await fallback(i);
        await sleep(500);
      }
      return !(await info2());
    }
    async function me() {
      for (let k = 0; k < 6; k++) { const d = await gPost('me'); if (d && d.ok) { GJ = d; GJt = Date.now(); return d } await sleep(1500 * (k + 1)) }
      return null;
    }

    // Respect per payment is best near kr 130 000 (166 respect); the last payment is sized to land on the cap.
    async function tribute() {
      const d = await me(); if (!d || !d.gang) return log('Ikke i en gjeng / ingen kontakt');
      let left = d.respCap - d.respToday;
      if (left <= 0) return log(`Respekt allerede full (${d.respToday}/${d.respCap})`);
      await closeAll(); gjengDialog('k');
      for (let k = 0; k < 40 && !document.querySelector('#slip #gTGo'); k++) await sleep(500);
      if (!document.querySelector('#slip #gTGo')) { await closeAll(); return log('Fant ikke tributt-skjemaet (er du i et vanlig spill?)') }
      let paid = 0, n = 0;
      while (left > 0 && n < 80 && !stopReq) {
        const money = Math.floor(S.money);
        const fill = Math.ceil(1e6 * 10 ** ((left - 396) / 300) * 1.02);
        const amt = Math.max(1000, Math.min(left <= 140 ? fill : 130000, money - 100000));
        if (money - amt < 100000) { log('For lite penger igjen'); break }
        const ta = document.querySelector('#gTA'), go = document.querySelector('#gTGo'), m = document.querySelector('#gTM');
        if (!ta || !go) break;
        const before = m.textContent; ta.value = String(amt); go.click();
        for (let k = 0; k < 60; k++) { await sleep(250); if (!go.disabled && m.textContent !== before) break }
        n++;
        const got = /fikk\s+([\d\s\u00a0]+)\s+respekt/i.exec(m.textContent);
        if (!got) { log('Stopp: ' + m.textContent); break }
        const r = +got[1].replace(/\D/g, ''); paid += amt; left -= r;
        if (r <= 0) break;
      }
      await closeAll();
      const d2 = await me();
      log(`Respekt ${d2 ? d2.respToday : '?'}/${d2 ? d2.respCap : '?'} · betalt kr ${kr(paid)} i ${n} innbetalinger`);
    }

    // Daily street fight where chance × control gain is highest (arch-enemy districts give double).
    async function fight() {
      const m = await kgLoad(true); if (!m || !m.me) return log('Fikk ikke kartet');
      if (!(m.left > 0)) return log('Dagens kamp er allerede tatt');
      const str = kgStr(), rows = [];
      for (const d of m.dists) {
        let P = null;
        for (let k = 0; k < 4 && !(P && P.ok); k++) { P = await kgPost('pre', { d: d.id, str }); if (!(P && P.ok)) await sleep(1500 * (k + 1)) }
        const mine = (d.pts.find(p => p.gid === m.me.gid) || {}).pts || 0, oth = Math.max(0, ...d.pts.filter(p => p.gid !== m.me.gid).map(p => p.pts));
        if (P && P.ok) rows.push({ id: d.id, name: d.name, chance: P.chance, gain: P.gain || m.win, duel: !!P.duel, lead: mine - oth });
        await sleep(300);
      }
      rows.sort((a, b) => b.chance * b.gain - a.chance * a.gain);
      if (!rows.length) return log('Fikk ingen odds');
      // Mål fra panelet, f.eks. «gamle,duel,stha:30»: første bydel der vi leder med mindre enn marginen;
      // «duel» = bydelen i en akseptert duell (alltid, når den finnes). Tomt felt = beste forventede gevinst.
      const [list, mg] = String(ui.fight || '').trim().split(':'), want = (list || '').split(',').map(x => x.trim()).filter(Boolean), margin = +mg || 20;
      const rowOf = id => id === 'duel' ? rows.find(r => r.duel) : rows.find(r => r.id === id);
      const hit = want.map(id => ({ id, r: rowOf(id) })).find(x => x.r && (x.id === 'duel' || x.r.lead < margin));
      const best = (hit && hit.r) || (want.length && rowOf(want[want.length - 1])) || rows[0];
      log(`Kamp: ${best.name} (${best.chance} %, +${best.gain})`);
      await closeAll(); kgFight(best.id);
      let res = null;
      for (let k = 0; k < 40 && !res; k++) {
        await sleep(500);
        const s = document.querySelector('#slip'); if (!s || $('#veil').hidden) continue;
        if (!/kgslip/.test(s.className)) { res = s.innerText.replace(/\s+/g, ' ').slice(0, 120); break }
        const r = s.querySelector('.kgres'); if (r) { res = r.textContent.trim() + ' · ' + (s.querySelector('.kgresx')?.textContent || ''); break }
        const go = [...s.querySelectorAll('footer button.primary')].find(b => /SLÅSS/i.test(b.innerText));
        if (go && s.querySelector('.kgchance')) { if (go.disabled) { res = 'Kampknappen er av'; break } go.click() }
      }
      log(res || 'Ingen resultat');
      await closeAll();
    }

    // Trade with the bot until today's share of the weekly sales job is sold, then flush it.
    async function job() {
      const d = await me(); const j = d && d.job;
      if (!j) return log('Ingen gjengjobb');
      if (j.done) return log('Ukas gjengjobb er fullført');
      if (j.myToday >= j.perDay) return log(`Dagens andel er full (kr ${kr(j.myToday)})`);
      const need = j.perDay - j.myToday, key = j.kind === 'fight' ? 'fight' : 'sale';
      log(`Gjengjobb: selger for kr ${kr(need)} …`);
      let sold = 0;
      const stopAt = Date.now() + 20 * 60000;
      while (Date.now() < stopAt && !stopReq) {
        const r = await run(40, async () => stopReq || GQ[key] + sold >= need);
        if (GQ[key] > 0) { const q = GQ[key]; await gFlush(); sold += q }
        if (sold >= need) break;
        if (r.stop === 'over') { await settle(); if (inGame()) continue }
        if (r.stop === 'over' || r.stop === 'stuck' || r.stop === 'decide') { log('Stoppet: ' + r.stop); break }
      }
      await gFlush();
      const d2 = await me();
      log(`Gjengjobb ${d2 ? 'kr ' + kr(d2.job.prog) + ' / ' + kr(d2.job.target) + ' · i dag kr ' + kr(d2.job.myToday) : '?'}`);
      try { saveGame() } catch (_) {}
    }

    async function go(k) {
      if (k === 'stopp') { stopReq = true; return log('Stopper …') }
      if (busy) return log('Holder på allerede');
      if (!inGame()) return log('Start eller fortsett et vanlig spill først (ikke Ukens Oslo)');
      busy = true; stopReq = false; setBusy(true, k);
      try {
        await settle();
        if (k === 'alt' || k === 'trib') await tribute();
        if ((k === 'alt' || k === 'kamp') && !stopReq) await fight();
        if ((k === 'alt' || k === 'jobb') && !stopReq) await job();
        await settle();
        try { saveGame() } catch (_) {}
        log('Ferdig');
      } catch (e) { log('Feil: ' + e.message) } finally { busy = false; setBusy(false) }
    }
    panel.querySelectorAll('[data-g]').forEach(b => b.onclick = () => go(b.dataset.g));

    // ---- Card picker: run the chores for one player card in a new private tab ----
    const root = document.documentElement;
    const cards = () => { try { return JSON.parse(root.dataset.lggCards || '[]') } catch (_) { return [] } };
    const cardsRow = document.createElement('div');
    cardsRow.innerHTML = `<div class="row"><button data-a="pick">▶ Kjør gjengoppgaver for kort ▾</button></div>
      <div class="dd" hidden></div>
      <div class="ed" hidden><textarea rows="8" placeholder="Én linje per kort: KODE navn"></textarea>
        <div class="row"><button data-a="save">💾 Lagre kort</button><button data-a="cancel">Avbryt</button></div></div>`;
    panel.querySelector('.body').insertBefore(cardsRow, panel.querySelector('#lgGLog'));
    css.textContent += `
    #lgGjeng .dd{max-height:260px;overflow:auto;border:1px solid #444;border-radius:6px;margin:4px 0}
    #lgGjeng .dd button{display:block;width:100%;text-align:left;padding:6px 8px;background:#1a1a1a;color:#eee;border:0;border-bottom:1px solid #2a2a2a;cursor:pointer;font-size:12px}
    #lgGjeng .dd button:hover{background:#333}
    #lgGjeng .dd small{color:#888;margin-left:6px}
    #lgGjeng .ed textarea{width:100%;box-sizing:border-box;background:#1a1a1a;color:#eee;border:1px solid #555;border-radius:6px;font:11px monospace}`;
    const dd = cardsRow.querySelector('.dd'), ed = cardsRow.querySelector('.ed'), ta = ed.querySelector('textarea');
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const drawList = () => {
      const L = cards();
      dd.innerHTML = L.map(c => `<button data-code="${esc(c.c)}">${esc(c.n || c.c.slice(0, 4))}<small>${esc(c.c.slice(0, 4))}…</small></button>`).join('')
        + `<button data-a="edit">⚙ ${L.length ? 'Rediger kortlista' : 'Legg inn kortene dine'}</button>`;
    };
    cardsRow.querySelector('[data-a=pick]').onclick = () => { ed.hidden = true; drawList(); dd.hidden = !dd.hidden };
    dd.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'edit') { dd.hidden = true; ta.value = cards().map(c => c.c + ' ' + (c.n || '')).join('\n'); ed.hidden = false; return }
      root.dataset.lggOpen = b.dataset.code; document.dispatchEvent(new Event('lggang-open'));
      dd.hidden = true; log('Åpner privat fane for ' + b.textContent);
    };
    ed.querySelector('[data-a=cancel]').onclick = () => { ed.hidden = true };
    ed.querySelector('[data-a=save]').onclick = () => {
      // Accepts the cards.txt format: "CODE nickname", '#' comments, codes with or without dashes.
      const list = [];
      for (const line of ta.value.split('\n')) {
        const t = line.trim(); if (!t || t.startsWith('#')) continue;
        const [first, ...rest] = t.split(/\s+/); const c = first.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (/^[A-Z0-9]{12}$/.test(c) && !list.some(x => x.c === c)) list.push({ c, n: rest.join(' ') });
      }
      root.dataset.lggSave = JSON.stringify(list); document.dispatchEvent(new Event('lggang-save'));
      ed.hidden = true; log(`Lagret ${list.length} kort`);
    };

    // ---- Auto mode: a tab opened as #lgauto=CODE links that card, resumes its game and runs everything ----
    const m = /lgauto=([A-Z0-9]{12})/.exec(location.hash);
    if (m) { history.replaceState(null, '', location.pathname + location.search); auto(m[1]) }
    async function auto(code) {
      const tag = code.slice(0, 4);
      document.title = '⏳ ' + tag + ' – gjengen';
      log('Kort ' + tag + ': kobler til …');
      for (let k = 0; k < 120 && !(typeof restoreDialog === 'function' && typeof gPost === 'function' && typeof skyPull === 'function'); k++) await sleep(500);
      if (store.get('cardCode', '') !== code) {
        // A normal (non-private) tab holds the user's own card; switching it here would unlink that card.
        if (store.get('cardCode', '') && root.dataset.lggIncog !== '1' && !confirm(`Denne fanen er koblet til et annet spillerkort.\nBytte til ${tag} her? Gjør det bare i et privat vindu.`)) return log('Avbrutt');
        restoreDialog(code);
        for (let k = 0; k < 40 && !document.querySelector('#kIn'); k++) await sleep(250);
        for (let k = 0; k < 12 && store.get('cardCode', '') !== code; k++) { const g = document.querySelector('#kGo'); if (g && !g.disabled) g.click(); await sleep(1500) }
        if (store.get('cardCode', '') !== code) { document.title = '❌ ' + tag; return log('Fikk ikke koblet kortet') }
        await sleep(3000);
      }
      // Prefer Imperiet: it usually has the strongest figure and the most money for tribute and the sales job.
      for (let k = 0; k < 20 && !inGame(); k++) {
        await settle(10);
        if (!store.get('save', null) && !store.get('saveI', null)) { await skyPull('card'); await sleep(2000); continue }
        if ($('#title').hidden) { await sleep(1500); continue }
        if (impSaved()) impResume(); else if (loadSave()) resumeGame(); else break;
        await sleep(1500);
      }
      if (!inGame()) { document.title = '❌ ' + tag; return log('Fant ikke noe spill på kortet') }
      await go('alt');
      try { saveGame() } catch (_) {}
      try { await skyPush(S && S.imp ? 'saveI' : 'save'); await skyPush('prof') } catch (_) {}
      document.title = '✅ ' + tag + ' – ferdig';
      log('Ferdig – du kan lukke fanen');
    }
  }
}
