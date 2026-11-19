# lopegutten-bot

Bot og Tampermonkey-skript for nettspillet [Løpegutten](https://lopegutten.com/), Oslos underverden 1990–1999.

Botene spiller **bare med spillets egne knapper og dialoger**. De endrer aldri spilltilstanden direkte og
sender aldri oppdiktede tall til serveren.

Alt vi har lært om spillet (hva som gir makt, hvordan du tjener mest, gjengen, troféer og felle-situasjoner)
står i **[ERFARINGER.md](ERFARINGER.md)**.

---

## Innhold

### Spillogikken (lag som lastes oppå hverandre)

| Fil | Hva den gjør |
|---|---|
| `bot.js` | Grunnlaget. Handel (ruter, innkjøp, kurerer, salg), regler for dialogene, arrestasjoner, konfrontasjoner, investeringer og figurstart i en slekt (`startFig`). |
| `extra.js` | Alt rundt Gudfar og pengemaskinen. Se lista under. |
| `bergen.js` | Bergen etter Gudfar: varer med Bergensbanen hver uke, Sjø-Sveins jobber og oppgjøret med Hansa-Henrik. |
| `tromso.js` | Tromsø (bare Imperiet): jobbene i Havna, Storgata og Tromsdalen, fleinsopp og grillkampen mot Jølle. |
| `speedrun.js` | «Raskest til Gudfar»: rask handel og rulett-finale. Brukes bare når eieren har sagt ja til kasino. |
| `ordforer.js` | Ordføreren i Imperiet: valgkampen til Holm-Aasheim, nominasjonen og valgnatta. |

**`extra.js` tar seg av:**
- Produksjonen fullt utbygd: marihuanagård, amfetaminlab og finca.
- Underbossene på full lojalitet, også Morten fra Vålerenga.
- Gjengen, våpen og ledige bydeler.
- Utstyr fra Hovedkvarteret: mobil, nytt SIM-kort, politiradio og helikopter.
- Advokaten Tor Engen Straff.
- **Vålerenga og Vedde-Glenn.** Den kjøper klubben, og spiller bare spesialspill med odds over 20, med keeperfiks og maks innsats.
- Sveitsisk bank, men innskudd først etter at klubben er kjøpt.
- **Skap 214**: åpner skapet og bruker gjenstandene.
- **Ringer slekta** i stedet for å låne hos Lånehaien.
- Valget «Hvilken gudfar blir du?», der den velger Penger.
- Familiemøtene.

### Skript som kjører botene (Node + Chromium)

| Fil | Bruk |
|---|---|
| `speedrun.mjs` | `node speedrun.mjs [minutter] [fresh]`: forsøk på Raskest til Gudfar. Starter ny figur i slekta når et forsøk feiler. |
| `gang.mjs` | `LG_CARD=<kode> node gang.mjs [tribute,fight,job]`: dagens gjengoppdrag for ett kort (tributt til respekt-taket, dagens gatekamp, ukejobben). |
| `gang-all.mjs` | `node gang-all.mjs`: det samme for alle kortene i `cards.txt`, noen om gangen. |

**Miljøvariabler:**

| Variabel | Betydning |
|---|---|
| `LG_PROFILE` | Chromium-profilen for kortet (én profil per spillerkort) |
| `LG_CARD` | Kortkoden (bare i miljøet, aldri i filer) |
| `LG_FIGHT` | Hvor gjengen skal slåss. En prioritert liste som `toyen,gamle:20` betyr første bydel der vi leder med mindre enn 20. `duel` betyr ukas duell. Uten verdi velges beste forventede gevinst. |
| `LG_PREFER_IMP` | `1` betyr bruk Imperiet-spillet først når kortet har det |
| `LG_FAM`, `LG_PREFIX` | Slekt og navneprefiks for nye figurer i speedrun |

### Tampermonkey-skript (spill selv med boten i nettleseren)

| Bygg med | Gir | Hva |
|---|---|---|
| `node build-sjef-userscript.mjs` | `~/lopegutten-sjef.user.js` | **Onkel-boten**: panel med ▶ SPILL / ■ STOPP. Kan flyttes og minimeres. Kjører `bot.js`, `bergen.js`, `tromso.js` og `extra.js` på kortet du er logget inn med. |
| `node build-userscript.mjs` | `~/lopegutten-gjeng.user.js` | **Gjengen**: tributt, dagens kamp og gjengjobb for kortet som er logget inn. |
| `node build-ordforer-userscript.mjs` | `~/lopegutten-ordforer.user.js` | **Ordføreren** i Imperiet. |

Rediger malene (`*.user.tpl.js`) og spill-lagene, og bygg på nytt. Ikke rediger de ferdige filene.

---

## Komme i gang

```sh
npm ci                       # puppeteer-core
# Chromium må ligge i /usr/bin/chromium
```

1. Lag én Chromium-profil per spillerkort, og koble kortet i spillet («Har du spillerkort fra før?»).
2. Legg kortkodene i `~/.config/lopegutten-bot/cards.txt`, én `KODE kallenavn` per linje.
3. Kjør skriptene med `LG_PROFILE` (og `LG_CARD` for gjengoppdragene).

---

## Regler botene følger

- **Bare spillets egne knapper.** Ingen endring av spilltilstanden og ingen forfalskede data mot serveren.
- **Aldri «Gi opp».**
- **Kasino, rulett og veddemål** brukes bare der kortets eier har sagt ja: Glenn-spesialspill, og rulett i
  speedrun og makt-forsøk.
- **Én bot per spillerkort om gangen.** Skysynken overskriver lagringer ellers. Viser spillet
  «TO SPILL, ÉN SPILLER», stopper boten.
- **Imperiet-lagringer og andres kort** røres ikke uten at eieren har sagt ja.
- **Kortkoder hører aldri hjemme i git eller logger.** `cards.txt` og `userscript-cards.json` er i `.gitignore`.
  Kjør `gitleaks` før hver push.

---

## Visste du at … (fun facts)

Alle de 26 «Visste du at»-tekstene fra spillet, sitert ordrett, med skjermbilder og en forklaring av hva vitsen
går ut på: **[funfacts/FUNFACTS.md](funfacts/FUNFACTS.md)**.

> Cannabis Sativa kan bli opptil 1.8 meter høy. Da er den 'høy' da...

> Vigra kom til Norge i 1998. Via Vigra, selvfølgelig. På Vinderen kalte de det et medisinsk gjennombrudd.
