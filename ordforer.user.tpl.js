// ==UserScript==
// @name         Løpegutten – ordføreren (Imperiet)
// @namespace    https://lopegutten.com/
// @version      1.0
// @description  Spiller Imperiet for deg til ordførervalget er avgjort: betaler Holm-Aasheim, gir størst bidrag, trykker bildet og holder søkelyset lavt før valgnatta.
// @match        https://lopegutten.com/*
// @grant        none
// @sandbox      raw
// @run-at       document-idle
// ==/UserScript==
// Built by build-ordforer-userscript.mjs from bot.js + ordforer.js + this template. Edit those, not the built file.
(function () {
  'use strict';
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  const BOT = {};
  BOT.browser = { tab: () => ({
    evaluate: async (fn, a) => fn(a),
    select: async (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })) },
    fill: async s => { const e = document.querySelector(s); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })) },
    type: async (s, t) => { const e = document.querySelector(s); e.value += t; e.dispatchEvent(new Event('input', { bubbles: true })) },
  }) };
  BOT.print = () => {};
  const BOTSRC = /*BOTJS*/'';
  const ORDSRC = /*ORDJS*/'';
  // bot.js needs sloppy mode for `with`; new Function code is sloppy even inside this strict IIFE.
  // `BOT.handle = handle` exposes bot.js's handle() so ordforer.js can wrap it; ui() is re-evaluated
  // inside the `with`, so it sees the bot helpers (run, info2, closeAll …) as bare names.
  new Function('BOT', 'with (BOT) {\n' + BOTSRC + '\n;BOT.handle = handle;\n' + ORDSRC + '\n;(' + ui.toString() + ')()\n}')(BOT);
  function ui() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    BOT.COAST = false; BOT.LATE_TRADE = true;
    let busy = false, stopReq = false;
    const css = document.createElement('style');
    css.textContent = `
    #lgOrd{position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#111;color:#eee;font:12px/1.35 system-ui,sans-serif;
      border:1px solid #444;border-radius:10px;padding:8px;width:230px;box-shadow:0 6px 24px #0008}
    #lgOrd.min .body{display:none}
    #lgOrd header{display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:6px;cursor:move;user-select:none}
    #lgOrd header button{background:none;border:0;color:#aaa;cursor:pointer;font-size:14px}
    #lgOrd .row{display:flex;gap:4px;margin:4px 0}
    #lgOrd .row button{flex:1;padding:6px 4px;border-radius:6px;border:1px solid #555;background:#222;color:#eee;cursor:pointer;font-size:12px}
    #lgOrd .row button:hover{background:#333}
    #lgOrd .row button:disabled{opacity:.4;cursor:default}
    #lgOrd .st{white-space:pre-wrap;color:#bbb;margin-top:6px;font-size:11px;max-height:140px;overflow:auto}`;
    document.head.appendChild(css);
    const panel = document.createElement('div');
    panel.id = 'lgOrd';
    panel.innerHTML = `<header><span>🏛 Ordføreren</span><button data-a="min" title="Minimer">▁</button></header>
     <div class="body">
      <div class="row"><button data-a="start">▶ Start</button><button data-a="stop" disabled>■ Stopp</button></div>
      <div class="st">Åpne Imperiet-spillet og trykk Start.</div>
     </div>`;
    document.body.appendChild(panel);
    const $p = s => panel.querySelector(s), stEl = $p('.st');
    const lines = [];
    const log = s => { lines.push(new Date().toTimeString().slice(0, 5) + ' ' + s); if (lines.length > 30) lines.shift(); draw() };
    const ordTxt = () => {
      if (typeof S === 'undefined' || !S || !S.imp) return 'Ikke i Imperiet.';
      const o = S.imp.ord, d = dayDate(S.day).toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' });
      const p = o && o.st === 'camp' ? ' · sjanse ' + Math.round(ordChance() * 100) + ' %' : '';
      const st = !o ? 'venter på telefonen fra Holm-Aasheim' : o.st === 'nom' ? 'venter på nominasjonen (valg ' + o.y + ')' : o.st === 'camp' ? 'valgkamp ' + o.y + p : o.st === 'won' ? 'VALGET ER VUNNET' : o.st === 'lost' ? 'valget ble tapt' : o.st;
      return d + ' · søkelys ' + Math.round(S.heat || 0) + '\n' + st;
    };
    const draw = () => { stEl.textContent = ordTxt() + '\n' + lines.slice(-6).join('\n'); stEl.scrollTop = stEl.scrollHeight };
    setInterval(() => { if (!panel.classList.contains('min')) draw() }, 3000);
    const setBusy = on => { busy = on; $p('[data-a=start]').disabled = on; $p('[data-a=stop]').disabled = !on };
    async function go() {
      if (busy) return;
      if (typeof S === 'undefined' || !S || S.over || !S.imp || document.querySelector('#game').hidden) return log('Åpne Imperiet-spillet først.');
      setBusy(true); stopReq = false; log('Starter.');
      let last = null;
      try {
        while (!stopReq) {
          const o = S && S.imp && S.imp.ord;
          if (!S || S.over || !S.imp) { log('Spillet er ikke lenger i Imperiet. Stopper.'); break }
          if (o && (o.st === 'won' || o.st === 'lost')) { log(o.st === 'won' ? 'Valget er vunnet. Ferdig.' : 'Valget ble tapt. Stopper.'); break }
          const st = o ? o.st : 'venter'; if (st !== last) { last = st; log('Status: ' + st) }
          const r = await run(40, async () => stopReq);
          try { saveGame() } catch (e) {}
          if (r.stop === 'decide' || r.stop === 'stuck') { const i = await info2(); if (i) await fallback(i); else await sleep(800) }
        }
      } catch (e) { log('Feil: ' + String(e && e.message || e).slice(0, 80)) }
      try { saveGame() } catch (e) {}
      if (stopReq) log('Stoppet.');
      setBusy(false);
    }
    panel.addEventListener('click', e => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'min') { panel.classList.toggle('min'); save() }
      if (a === 'start') go();
      if (a === 'stop') { stopReq = true; log('Stopper etter dette trekket …') }
    });
    // drag by the header; position and minimised state are remembered
    const KEY = 'lgOrd.ui';
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ l: panel.style.left, t: panel.style.top, min: panel.classList.contains('min') })) } catch (e) {} };
    try { const u = JSON.parse(localStorage.getItem(KEY) || 'null'); if (u) { if (u.l) { panel.style.left = u.l; panel.style.top = u.t; panel.style.right = 'auto'; panel.style.bottom = 'auto' } if (u.min) panel.classList.add('min') } } catch (e) {}
    const hd = $p('header'); let drag = null;
    hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = panel.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top }; hd.setPointerCapture(e.pointerId) });
    hd.addEventListener('pointermove', e => { if (!drag) return; panel.style.left = Math.max(0, Math.min(innerWidth - 60, e.clientX - drag.x)) + 'px'; panel.style.top = Math.max(0, Math.min(innerHeight - 30, e.clientY - drag.y)) + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto' });
    hd.addEventListener('pointerup', () => { if (drag) { drag = null; save() } });
    draw();
  }
})();
