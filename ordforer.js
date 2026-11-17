// Ordføreren (Imperiet): pay Holm-Aasheim when he calls from the phone box, give the biggest
// contribution at the nomination, print the journalist's photo, and keep the heat under 30 in the
// months before election night. Load after bot.js. Only clicks the game's own buttons.
{
  const E = (fn, arg) => tab.evaluate(fn, arg);
  const _h = globalThis.handle;
  globalThis.handle = async inf => {
    if (/impslip/.test(inf.cls)) {
      const r = await E(() => {
        const s = document.querySelector('#slip'), h = (s.querySelector('h2')?.innerText || '').trim();
        const bs = [...s.querySelectorAll('.icch .icb:not([disabled])')]; if (!bs.length) return null;
        let b = null;
        if (/^(Valgkampen|The election campaign)$/i.test(h)) b = bs.find(x => x.dataset.k === '0');
        else if (/^(Nominasjonen|The nomination)$/i.test(h)) b = bs[bs.length - 1];
        else if (/^(Motkandidaten|The rival)$/i.test(h)) b = bs.find(x => x.dataset.k === '0');
        if (!b) return null; b.click(); return h + ' -> ' + b.querySelector('b').innerText.trim();
      });
      if (r) { (globalThis.ORDLOG ??= []).push(r); return 'ord ' + r }
    }
    return _h(inf);
  };
  const _ma = globalThis.mainAction;
  globalThis.mainAction = async () => {
    // Heat under 30 on election night gives +10 points: lie low earlier in the last four months.
    const near = await E(() => { const o = S && S.imp && S.imp.ord; return !!(o && o.st === 'camp' && ordEday(o) - S.day < 120) });
    globalThis.LAYLOW_AT = near ? 22 : undefined;
    return _ma();
  };
  print('ordforer loaded');
}
