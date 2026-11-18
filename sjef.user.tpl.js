// ==UserScript==
// @name         lopegutten
// @namespace    https://lopegutten.com/
// @version      1.2.5
// @description  Panel med ▶ SPILL / ■ STOPP. Kjører Onkel-boten på kortet du er logget inn med: handel, produksjon fullt utbygd, underbosser med full lojalitet, helikopter, mobil, politiradio, Tor Engen Straff, Bergen, Tromsø og Jølle, Vålerenga-spesialspill. Bare spillets egne knapper.
// @author       runeball
// @icon         https://lopegutten.com/favicon.svg
// @match        https://lopegutten.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
// Built by build-sjef-userscript.mjs from bot.js, bergen.js, tromso.js, extra.js and this template. Edit the sources, not the built file.
(function () {
  'use strict';
  // Fart: spillet leser «redusert bevegelse» én gang når det laster, og korter da alle ventetider til 0,15 s
  // og slår av CSS-animasjoner. Dette må inn før spillets egen kode, derfor document-start.
  // Med @grant none kjører dette i sidens egen kontekst, så matchMedia kan byttes direkte.
  const mm = window.matchMedia.bind(window);
  const rm = q => ({ matches: true, media: String(q), onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } });
  window.matchMedia = q => /prefers-reduced-motion:\s*reduce/.test(String(q)) ? rm(q) : mm(q);
  const SRC = /*SRC*/'';
  const inject = () => {
    // samme CSS som spillet selv bruker med redusert bevegelse
    const st = document.createElement('style'); st.textContent = '*{transition:none!important;animation:none!important}'; (document.head || document.documentElement).appendChild(st);
    const s = document.createElement('script');
    s.textContent = '(' + pageMain.toString() + ')(' + JSON.stringify(SRC) + ');';
    (document.head || document.documentElement).appendChild(s); s.remove();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true }); else inject();
})();

function pageMain(SRC) {
  'use strict';
  if (window.__lgSjef) return; window.__lgSjef = true;
  const BOT = window.__lgSjefBOT = {};
  const tab = {
    evaluate: async (fn, a) => fn(a),
    select: async (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })) },
    fill: async s => { const e = document.querySelector(s); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })) },
    type: async (s, t) => { const e = document.querySelector(s); e.value += t; e.dispatchEvent(new Event('input', { bubbles: true })) },
  };
  BOT.browser = { tab: () => tab }; BOT.tab = tab; BOT.print = () => {};
  const LOG = [];
  const say = t => { LOG.push(new Date().toTimeString().slice(0, 8) + ' ' + t); if (LOG.length > 60) LOG.shift(); draw() };
  BOT.EX_SAY = say;
  // bot.js needs sloppy mode (`with`); helpers live on BOT, not on window, so game globals stay untouched.
  new Function('BOT', 'with (BOT) {\n' + SRC + '\n}')(BOT);
  // botens egne pauser halveres (spillet er raskt nå); aldri under 120 ms så dialogene rekker å åpne
  BOT.wait = ms => new Promise(r => setTimeout(r, Math.max(120, ms * .5)));
  // innskudd i banken først når Vålerenga er kjøpt (til da står pengene på hånden)
  BOT.EX_CFG.deposit = 'afterVif';
  BOT.COAST = false; BOT.LATE_TRADE = true; BOT.TRIBUTE = false; BOT.BG_IMP = true; BOT.TR = true;
  // Year 2000: continue in Imperiet when that slot is empty (never overwrite an existing Imperiet game).
  const _h = BOT.handle;
  BOT.handle = async inf => {
    if (/y2kslip/.test(inf.cls) && !impSaved()) { const b = inf.btns.find(b => b.primary && !b.dis); if (b) { await BOT.clickIdx(b.i); say('År 2000 → Imperiet'); return 'y2k-imp' } }
    if (/^GUDFAR/i.test(inf.title.trim())) { const b = inf.btns.find(b => !b.dis && !/AVSLUTT/i.test(b.t)); if (b) { await BOT.clickIdx(b.i); return 'gudfar-continue' } }
    return _h(inf);
  };

  // ---- panel ----
  let on = false, box;
  const fmt = n => (n == null ? '–' : Math.round(n).toLocaleString('nb-NO'));
  function draw() {
    if (!box) return;
    const g = typeof S !== 'undefined' && S && !S.over ? S : null;
    box.querySelector('.st').textContent = g ? `dag ${g.day} · ${dayDate(g.day).toISOString().slice(0, 10)} · kr ${fmt(g.money)} · bank ${fmt(g.swiss && g.swiss.bal)} · makt ${fmt(makt())}${g.imp ? ' · Imperiet' : ''}` : 'ingen spill i gang';
    box.querySelector('.lg').textContent = LOG.slice(-20).join('\n');
    box.querySelector('.go').disabled = on; box.querySelector('.stop').disabled = !on; box.classList.toggle('run', on);
  }
  const PK = 'lgSjef.ui';
  const ui = (() => { try { return JSON.parse(localStorage.getItem(PK)) || {} } catch (_) { return {} } })();
  const saveUi = () => { try { localStorage.setItem(PK, JSON.stringify(ui)) } catch (_) {} };
  function place() {
    if (ui.x == null) { box.style.right = '10px'; box.style.bottom = '10px'; box.style.left = box.style.top = 'auto'; return }
    const w = box.offsetWidth, h = box.offsetHeight;
    const x = Math.min(Math.max(0, ui.x), innerWidth - w), y = Math.min(Math.max(0, ui.y), innerHeight - h);
    Object.assign(box.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  }
  function setMin(m) {
    ui.min = !!m; saveUi();
    box.classList.toggle('min', ui.min);
    box.querySelector('.mn').textContent = ui.min ? '▢' : '–';
    box.querySelector('.mn').title = ui.min ? 'Vis' : 'Minimer';
    place();
  }
  function mount() {
    box = document.createElement('div');
    box.id = 'lgSjef';
    box.innerHTML = `<style>#lgSjef{position:fixed;right:10px;bottom:10px;z-index:2147483647;width:300px;max-width:calc(100vw - 20px);background:#111;color:#e8e8e8;border:2px solid #ffe600;font:12px/1.35 'IBM Plex Mono',monospace;box-shadow:0 4px 18px #000a;touch-action:none}
      #lgSjef .hd{display:flex;align-items:center;gap:6px;padding:5px 8px;background:#1d1d1d;cursor:move;user-select:none}
      #lgSjef .hd b{flex:1;color:#ffe600}#lgSjef .hd .dot{width:8px;height:8px;border-radius:50%;background:#555}#lgSjef.run .hd .dot{background:#3f3;box-shadow:0 0 6px #3f3}
      #lgSjef .mn{cursor:pointer;color:#bbb;padding:0 4px;font-weight:700}#lgSjef .bd{padding:6px 8px 8px}
      #lgSjef.min{width:auto}#lgSjef.min .bd{display:none}#lgSjef.min .hd b{flex:none}
      #lgSjef .row{display:flex;gap:6px;margin:6px 0}#lgSjef button{flex:1;font:700 13px 'IBM Plex Mono',monospace;padding:8px;border:0;cursor:pointer}
      #lgSjef .go{background:#ffe600;color:#000}#lgSjef .stop{background:#ff4040;color:#000}#lgSjef button:disabled{opacity:.35;cursor:default}
      #lgSjef .lg{white-space:pre-wrap;color:#9aa3b5;max-height:110px;overflow:auto;font-size:11px}</style>
      <div class="hd"><span class="dot"></span><b>👑 ONKEL-BOTEN</b><span class="mn" title="Minimer">–</span></div>
      <div class="bd"><div class="st"></div><div class="row"><button class="go">▶ SPILL</button><button class="stop">■ STOPP</button></div><div class="lg"></div></div>`;
    document.body.appendChild(box);
    box.querySelector('.go').onclick = start;
    box.querySelector('.stop').onclick = () => { on = false; say('stopper etter dette steget…'); draw() };
    box.querySelector('.mn').onclick = e => { e.stopPropagation(); setMin(!ui.min) };
    // drag by the header (mouse and touch); a click without movement on a minimised box opens it
    const hd = box.querySelector('.hd');
    hd.addEventListener('pointerdown', e => {
      if (e.target.closest('.mn')) return;
      const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
      let moved = false; hd.setPointerCapture(e.pointerId);
      const mv = ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true; if (!moved) return; ui.x = ev.clientX - dx; ui.y = ev.clientY - dy; place() };
      const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); if (moved) saveUi(); else if (ui.min) setMin(false) };
      hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    });
    addEventListener('resize', place);
    setMin(ui.min); draw(); setInterval(draw, 3000);
  }
  async function start() {
    if (on) return;
    if (!(typeof S !== 'undefined' && S && !S.over && !$('#game').hidden)) { say('Start eller fortsett et spill først.'); return }
    on = true; say('starter'); draw();
    let stuck = 0;
    while (on) {
      try {
        if (!S || S.over) { await BOT.closeAll(); say('spillet er over'); break }
        const r = await BOT.run(40, async () => !on);
        const last = r.out && r.out.length ? String(r.out[r.out.length - 1]).slice(0, 70) : '';
        if (last) say(last);
        if (r.stop === 'cond') break;
        if (r.stop === 'decide' || r.stop === 'stuck') {
          const i = await BOT.info2();
          say('ukjent dialog: ' + (i ? i.title.slice(0, 40) : '?'));
          if (i) await BOT.fallback(i);
          if (++stuck > 15) { say('står fast – stopper. Svar på dialogen selv og trykk SPILL.'); break }
        } else stuck = 0;
        try { saveGame() } catch (_) {}
        for (const k of ['LOG', 'REP']) if (Array.isArray(BOT[k]) && BOT[k].length > 200) BOT[k].splice(0, BOT[k].length - 200);
      } catch (e) { say('feil: ' + String(e && e.message || e).slice(0, 80)); await new Promise(r => setTimeout(r, 1500)) }
    }
    on = false; draw();
  }
  const wait = () => { if (document.body && typeof S !== 'undefined') mount(); else setTimeout(wait, 500) };
  wait();
}
