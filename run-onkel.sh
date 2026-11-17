#!/bin/zsh
# Holder onkel-botten i gang: starter på nytt hvis den dør (maks 20 forsøk)
cd /home/rune/lopegutten-bot
LOG=/home/rune/.local/share/lopegutten-bot/logs/onkel-play.log
for i in {1..20}; do
  rm -f /home/rune/.local/share/lopegutten-bot/chrome/Singleton*
  echo "[WRAP] forsøk $i $(date +%H:%M)" >> "$LOG"
  node onkel.mjs >> "$LOG" 2>&1
  echo "[WRAP] slutt kode $? — venter 20s" >> "$LOG"
  sleep 20
done
