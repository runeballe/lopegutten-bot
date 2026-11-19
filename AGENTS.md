# AGENTS.md – lopegutten-bot

For AI-agenter som skal drifte eller endre botene. Les også [README.md](README.md) (filene og bruken) og
[ERFARINGER.md](ERFARINGER.md) (spillmekanikk og lærdommer).

## Forbud (ikke bryt disse)

1. **Bare spillets egne knapper og dialoger.** Ikke skriv til `S` eller andre spillvariabler, og send aldri
   oppdiktede tall til serveren (penger, spilldager, kassa).
2. **Aldri** klikk «Gi opp».
3. **Kasino, rulett, lotto og veddemål** bare der kortets eier uttrykkelig har sagt ja for akkurat den
   kjøringen (i dag: Glenn-spesialspill, og rulett i speedrun og makt-forsøk).
4. **Én bot per spillerkort.** Sjekk med `pgrep -af "<skript>.mj[s]"` før du starter noe. Viser spillet
   «TO SPILL, ÉN SPILLER», skal boten stoppe, ikke velge.
5. **Ikke rør Imperiet-lagringer eller andres kort** uten å spørre eieren.
6. **Gjengkortene skal aldri ta 1. plass** på noen liste. Bare eierens slekt skal det.
7. **Kortkoder hører aldri hjemme i git, logger eller filer som deles.** Kjør `gitleaks detect` før hver push.

## Hvordan lagene henger sammen

- Spill-lagene (`bot.js`, `extra.js`, `bergen.js`, `tromso.js`, `speedrun.js`, `ordforer.js`) lastes med
  `(0, eval)(...)` i Node, med et `tab`-objekt der `tab.evaluate` er `page.evaluate`.
- Hjelpefunksjoner ligger på `globalThis`. Senere lag overstyrer `handle`, `mainAction`, `route` og så videre.
- Rekkefølgen er `bot.js` først, så `bergen.js` / `tromso.js`, og `extra.js` sist.
- Userscriptene bygges av de samme lagene. Byggeskriptet flytter `globalThis.` over på et privat `BOT`-objekt.
  Endre lagene eller malene, og bygg på nytt.

## Kjente feller

- **Figurer får gatenavn underveis** (for eksempel «Tjukken»). Kjenn igjen en figur på `S.dyn.t` eller Gudfar-dagen,
  ikke på navnet.
- **En slektsgren lages først når figuren når år 2000.** En gammel lagring som lastes og spilles til 2000 på nytt,
  gir en dobbel gren.
- **I Tromsø må du aldri lukke alle dialoger blindt** (`closeAll`). Den siste knappen er «Kjøp av Boris».
- **Botens standardregler** sier nei til spesialoppdrag og velger «hold deg utenfor». Det må overstyres når et
  trofé eller oppdrag skal tas.
- **`pgrep -f` treffer sitt eget skall.** Bruk mønstre som `kasse-card.mj[s]`.

## Konvensjoner

- Kode og kommentarer kort og konkret, gjerne på norsk.
- Hver handling skal kunne leses i loggen (`say(...)` / `log(...)`).
- Etter endring: `node --check <fil>`, og en kort testkjøring før langkjøring.
