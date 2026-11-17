# AGENTS.md — Løpegutten-bot

Kontekst for AI-agenter (Claude Code, Hermes, andre) som skal drifte eller endre denne botten.

## Hva dette er

Automatisering av nettspillet [Løpegutten](https://lopegutten.com/) med Puppeteer. Botten klikker
spillets egne knapper og dialoger. Den redigerer aldri spilltilstand direkte.

Spillmekanikk som gjelder oppgavene her:

- **Ukens Oslo**: ukeskonkurranse. Alle spiller samme Oslo 1990–1994 (dag 0–1825). Runden
  starter søndag kl. 21.00. **Beste forsøk teller** — et dårlig forsøk kan aldri senke scoren.
- **Ukens vri** skifter hver uke (f.eks. «Bombebølgen»: bomber selges fra dag én, søkelyset
  stiger dobbelt så fort).
- Rang stiger med formue/status: Taper → Løpegutt → … → Mastermind → Gudfar.
- **Olsen-skatten** trekkes med jevne mellomrom og kan tømme kassa.
- **Tollkontroll** ved ankomst Norge kan beslaglegge hele lasset pluss bot.
- **Heat** (søkelyset) over ~40 gir arrest; ligg lavt for å senke det.

## Kjøring

```bash
npm ci
node onkel.mjs                  # spiller Ukens Oslo
./run-onkel.sh                  # samme, med auto-restart (maks 20 forsøk)
penger.mjs                      # vanlig spill (ikke Ukens)
ukens.mjs                       # eldre Ukens-runner (bot.js-basert)
```

Miljøvariabler:

| Variabel | Standard | Betydning |
|---|---|---|
| `LG_PROFILE` | `$HOME/.local/share/lopegutten-bot/chrome` | Chromium-profil med innlogging |
| `LG_UKE_DAYS` | `2000` | Dag botten stopper på |
| `LG_CARD` | – | Kortkode, valgfri (brukes ikke av `onkel.mjs`) |

Logg: `$HOME/.local/share/lopegutten-bot/logs/onkel-play.log`.

## Strategi i `onkel.mjs`

- Kjøp i `se` (Sverige) når kassa er under 2 mill., ellers `de` (Tyskland).
- Kjøp maks 80 enheter per vare, budsjett 90 % av kassa, men behold minst 2 500 kr.
- Selg alt via `#sellAll` (den selger og lukker i ett klikk). Er knappen deaktivert, avbryt.
- Forhandling: velg «gatepris».
- Konfrontasjon: «Slåss» når vinnersjansen er ≥ 50 %, ellers «Stikk av».
- Arrest: kausjon hvis kassa dekker den, ellers soning.
- Heat > 30: ligg lavt.
- Blakk (< 2 500 kr): be om lån via `loanDialog()` hvis `S.loan` er tom.
- Ved `detached Frame`: `reattach()` åpner ny fane og går inn i Ukens igjen.

## Forbud (ikke bryt disse)

1. **Aldri** klikk «Gi opp» / give-up-knapper.
2. **Aldri** kasino, lotto, veddemål eller bestikkelser.
3. **Kun én maskin/en bot per spillerkort.** Sky-synken overskriver lagringer ellers.
4. Ikke rør Imperiet-lagringer eller andre kort uten å spørre eieren.
5. Ikke start flere instanser: bruk `run-onkel.sh` (én wrapper) og sjekk med
   `ps -eo cmd | grep "[n]ode onkel.mjs"`.

## Filkart

| Fil | Rolle |
|---|---|
| `onkel.mjs` | Ukens Oslo-driver, eksplisitte steg med logging |
| `run-onkel.sh` | Auto-restart-wrapper rundt `onkel.mjs` |
| `ukens.mjs` | Eldre Ukens-runner (bruker `bot.js`) |
| `penger.mjs` | Vanlig spill: kjøp/selg/oppgradering |
| `bot.js` | Regelverk for dialoger (regex-regler) |
| `speedrun.mjs` | Rask gjennomspilling |
| `sjefen.user.js` | Userscript v4.4.0: PENGER / VEDLIKEHOLD / ■ STOPP |
| `lopegutten-gjeng.user.js` | Userscript for gjeng-oppgaver |

## Konvensjoner

- Kode og kommentarer på norsk, korte og konkrete.
- Bruk `say(...)`-logg i `onkel.mjs` — hver handling skal kunne leses i loggen.
- Etter endring: `node --check onkel.mjs`, og en kort test med `LG_UKE_DAYS=5`.
- Hemmeligheter (kortkoder i `~/.config/lopegutten-bot/cards.txt`) skal aldri i git.
