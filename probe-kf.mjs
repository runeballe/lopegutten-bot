import puppeteer from 'puppeteer-core';
const PROFILE = '/home/rune/.local/share/lopegutten-bot/chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, userDataDir: PROFILE, protocolTimeout: 240000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(60000);
await page.goto('https://lopegutten.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof restoreDialog === 'function' && typeof store !== 'undefined', { timeout: 120000 });
await sleep(1500);
await page.evaluate(() => { const t = document.querySelector('#tUke'); if (t) t.click() });
await sleep(2500);
await page.evaluate(() => { const s = document.querySelector('#slip'); const b = s && [...s.querySelectorAll('footer button')].find(x => /SPILL NÅ|FORTSETT/i.test(x.innerText) && !x.disabled); b && b.click() });
await sleep(2500);
for (let i = 0; i < 40; i++) {
  const r = await page.evaluate(() => {
    const s = document.querySelector('#slip'); if (!s) return { v: 0 };
    if (document.querySelector('#veil').hidden) return { v: 0, day: typeof S !== 'undefined' ? S.day : null };
    const t = (s.querySelector('h3')?.textContent || '').trim();
    if (!/Konfrontasjon/i.test(t)) return { v: 0, t };
    const fc = s.querySelector('#fChoices');
    const btns = [...(fc ? fc.querySelectorAll('button') : [])].map(b => ({ c: b.dataset.c, txt: b.innerText.replace(/\s+/g, ' ').slice(0, 25), off: !!b.offsetParent, dis: b.disabled, cls: b.className }));
    return { v: 1, t, has: !!fc, fch: fc ? fc.className : null, fchHTML: fc ? fc.innerHTML.replace(/\s+/g, ' ').slice(0, 500) : null, btns, foot: [...s.querySelectorAll('footer button')].map(b => b.innerText.trim().slice(0, 20)), bodyText: s.querySelector('.body').innerText.replace(/\s+/g, ' ').slice(0, 120) };
  });
  if (r.v) { process.stdout.write(JSON.stringify(r, null, 1) + '\n'); break }
  await page.evaluate(() => { const s = document.querySelector('#slip'); const b = s && [...s.querySelectorAll('#slip footer button,#slip .body button')].find(x => /gatepris|videre|neste|ok/i.test(x.innerText) && !x.disabled); b && b.click() });
  await sleep(1500);
}
await browser.close();
