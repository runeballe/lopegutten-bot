# lopegutten-bot

Bot for [Løpegutten](https://lopegutten.com/). It plays through the game's own buttons and dialogs and never edits game state directly. It takes a figure from Taper to Gudfar, then coasts to 31.12.1999 so the figure gets a frame on the family portrait wall.

Results so far (player card Onkel-Akan):
- Family **BAK**: 10/10 branches. LOKE, ODIN, TOR, FRØY, BALDER, HEIMDAL, TYR and BRAGE are Gudfar.
- Family **Kodesen**: VIDAR, VALE and ULL are Gudfar.
- Norgeslista «Gjennom tidene»: **Udødelig**, nr. 1.

## Requirements

`bot.js` runs in omp's JavaScript eval kernel (Bun). It expects the `browser` global and the `print` helper that omp provides. Porting it to plain Puppeteer means replacing `browser.tab(...)`, `tab.evaluate`, `tab.select`, `tab.fill` and `tab.type`.

## Usage (omp)

1. Open the game in a named tab, with reduced motion on so animations are short:
   ```js
   const t = await browser.open({ name: 'lg2', url: 'https://lopegutten.com/', persist: true, app: { relay: false, tern: false } });
   await t.run(async ({ page }) => { await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await page.reload({ waitUntil: 'load' }); });
   ```
2. On a new browser profile, load your player card. Use «Har du spillerkort fra før?» or:
   ```js
   await t.evaluate(() => { restoreDialog('XXXXXXXXXXXX'); }); // then click «Sjekk koden» / «Bli …»
   ```
3. Load the bot:
   ```js
   (0, eval)(await Bun.file('bot.js').text());
   ```
4. Start a figure and drive it:
   ```js
   await startFig('NAVN', 4, 'BAK');            // nickname, figure portrait 1–10, family
   globalThis.QUEUE = [['NESTE', 5, 'BAK']];    // figures to start after this one ends
   globalThis.TRIBUTE = false;                  // true = pay 100 % tribute to the gang on 30.12.1999
   await driver(1700 * 1000);                   // runs up to ~28 min per call; call again to continue
   ```
   Call `driver` repeatedly. Each call returns `'time'`, `'done'` (queue empty), or `'decide'` / `'stuck'` (a dialog the rules don't cover; check `REP` and `await info2()`).

Useful helpers: `st()` gives a status snapshot, `branches()` lists the BAK portrait wall, `LOG` holds fallback decisions, and `REP` holds driver events.

## Strategy (what the bot does)

- **Routes:** Sverige at Taper, Polen from Løpegutt to Pusher, Russland from Mastermind on. A country is skipped if Leif A. Lire is watching it.
- **Buying:**
  - Fills about 2.5 street sales per good, scaled by rank demand.
  - Spreads money across goods, because a bad batch throws out all of that good.
  - Skips low-margin goods from Pusher up.
- **Couriers:** For every load it tries all mixes of student, pensioner, pro courier and container, and picks the one with the lowest cost plus expected customs loss.
- **Selling:** Sells everything the street will take. Waits a day when demand is low.
- **Investing:**
  - Protection to 95.
  - Districts with 3 dealers each.
  - Farm, lab and finca.
  - Front businesses: car dealer (−15 % customs), video, solarium, club, car wash, pizzeria.
  - Police insider.
  - The three Gudfar items (Fornebu, councillor, villa).
  - Top lawyer once Gudfar.
- **Arrests:** Bribes with kr 100. If that fails, the fine is only kr 200, so it costs less than bail.
- **Fights:** Fights only at ≥60 % odds and when its protection is at least the opponent's.
- **Trial (Operasjon Tusenår):** Always takes the plea deal.
- **Kronprinsen:** Always buys him out.
- **Gudfar:** Coasts with 30-day Colombia trips without buying. From day 3610 it waits day by day. At the year-2000 window it picks «Til forsiden», so it **does not** enter Imperiet and the single Imperiet save slot is left alone.
- **Imperiet mode** (`S.imp`): trades normally, with no coasting and no tribute. It earns money, but no Norgeslista points.

## Known gaps

- Unknown dialogs fall through to `fallback()`. It prefers small payments (≤ 2 mill.) and «nei/ikke» options, and logs them in `LOG`.
- The gang's weekly job has a server-side cap of about kr 1.33 mill. per member per day, so a single run cannot finish it.
- Long eval cells sometimes kill the kernel. Reload `bot.js` and call `driver` again; the game state lives in the browser.

## Bergen (`bergen.js`)

Bergen belongs to each round and opens when that round passes the Gudfar scene. An Imperiet save that sits at rank 5 without the Gudfar flag can never open it.

To take Bergen, control must reach 70 % with Nygårdsparken done. Hansa-Henrik then invites you to the showdown, and the bot buys him out for max(kr 5 mill., 25 % of your money).

Control comes from:
- sales: 1 % per kr 150 000, max 2.5 % a week
- Sjø-Svein's jobs: 17. mai sprit, Brann ecstasy, Nygårdsparken 3 loads, +10 % each
- Ali's smokes: +5 %

Load it after `bot.js`: `(0, eval)(await Bun.file('bergen.js').text())`. From then on the bot does this automatically once a round is Gudfar:
- stocks up on sprit, ecstasy and tobacco in Polen and Nederland
- ships via Bergensbanen every week
- lies low a week at a time between shipments
- buys Henrik out at the showdown

## Gang respect («Din respekt i dag: x / 3 000»)

Only **tribute** fills daily respect; street sales count toward the weekly job, not toward respect. Each payment gives about 396 + 300 × log10(amount / kr 1 mill.) respect, so many small payments (about kr 1 mill. each) are far cheaper than one big one.
