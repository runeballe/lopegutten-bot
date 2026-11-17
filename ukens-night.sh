#!/bin/bash
# Ukens Oslo for alle kortene, 2 om gangen (429-sikring). Logg: ukens-natt.log
D=~/.local/share/lopegutten-bot
mkdir -p $D/logs
grep -v '^#' ~/.config/lopegutten-bot/cards.txt | awk 'NF{print $1}' | \
  xargs -P 2 -I{} sh -c 'LG_CARD={} node /home/rune/lopegutten-bot/ukens.mjs ${LG_UKE_DAYS:+$LG_UKE_DAYS} 2>&1 | tee -a '"$D"'/logs/ukens-natt.log | grep -E "FINAL|RUN.*over|UKE|ERR" | cut -c1-200'
echo "=== ukens done $(date +%T)"
