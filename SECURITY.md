# Security Policy

This repository is an unofficial bot that drives [Løpegutten](https://lopegutten.com/) through
the game's own buttons. This policy covers the bot's own code: the scripts, the browser
automation, and the local profile it uses.

## Supported Versions

There are no versioned releases. Only the latest commit on `main` is supported.

| Version        | Supported          |
| -------------- | ------------------ |
| `main` (HEAD)  | :white_check_mark: |
| Older commits  | :x:                |

## What Counts as a Security Issue Here

The bot holds two kinds of secrets:

1. **Player card codes.** A card code restores a player's progress. Anyone with the code can
   take over that player card. Codes must never appear in an issue, a commit, a log, or a
   screenshot.
2. **The Chromium profile.** `LG_PROFILE` (default
   `$HOME/.local/share/lopegutten-bot/chrome`) contains the logged-in session. Treat the whole
   directory as a credential.

In scope:

- A path in the code that leaks a card code, cookie, or profile contents (logs, error output,
  build artifacts, committed files).
- Automation that writes outside its own profile, or touches another player's card.
- Code execution triggered by game content (for example a nickname or dialog text that reaches
  `eval`, a shell command, or a filename).
- Credential or session handling bugs in the run scripts (`speedrun.mjs`, `gang.mjs`, `gang-all.mjs`).

Out of scope:

- **Vulnerabilities in Løpegutten itself.** Report those to the game operator. This project has
  no access to the game's servers.
- **Bans or lost progress from automation.** That is an acceptable-use question for the game,
  not a security bug.
- Vulnerabilities in `puppeteer-core` or other dependencies. Report upstream, and tell us too.
- Scanner output with no demonstrated impact.

## Reporting a Vulnerability

Do **not** open a public issue if the report contains a card code, a session cookie, or a
reproduction that would expose another player.

Report privately:

1. **GitHub private advisory** — the repo's "Security" tab, then "Report a vulnerability".
   Preferred.
2. **Email** — balstadrune@gmail.com. Redact any live card code before sending.

Include:

- Affected file(s) and commit hash
- Steps to reproduce, or a proof of concept
- Impact, and whether a card code or session could have been exposed
- Any suggested fix

If you suspect a card code has already leaked, say so in the first line. Rotation is faster than
investigation.

## What to Expect

| Stage                  | Target           |
| ---------------------- | ---------------- |
| Acknowledge report     | 3 business days  |
| Initial assessment     | 10 business days |
| Fix or mitigation plan | 30 days          |
| Public disclosure      | 90 days, or sooner by agreement |

We credit reporters in the advisory unless you ask otherwise.

## Safe Harbor

Research in good faith under this policy is welcome. Stay inside these limits:

- Use your own player card and your own browser profile.
- Do not attack, probe, or load-test `lopegutten.com`. Test the bot code locally.
- Do not access, guess, or use another player's card code or session.
- Do not publish any code, cookie, or profile data you obtain.
- Report within the disclosure window, and ask before doing anything ambiguous.

Under those limits we will not pursue legal action for your research.

## Contact

- GitHub private advisory (preferred)
- balstadrune@gmail.com
