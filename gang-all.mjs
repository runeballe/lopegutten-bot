// Runs gang.mjs for every card in LG_CARDS (default ~/.config/lopegutten-bot/cards.txt),
// a few at a time so the game server is not flooded. Card codes never live in the repo.
// Usage: node gang-all.mjs [steps] [chunk]   (steps default: tribute,fight,job)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.LG_CARDS || `${process.env.HOME}/.config/lopegutten-bot/cards.txt`;
const PAR = Number(process.env.LG_PAR || 3);
const args = process.argv.slice(2);
const cards = readFileSync(FILE, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/)[0]);

const one = code => new Promise(res => {
  const p = spawn('node', [join(ROOT, 'gang.mjs'), ...args], { cwd: ROOT, env: { ...process.env, LG_CARD: code }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.stdout.write(d));
  p.stderr.on('data', d => process.stdout.write(`[${code.slice(0, 4)}] ERR ${d}`));
  p.on('close', c => res(c));
});
const queue = [...cards];
const failed = [];
await Promise.all(Array.from({ length: Math.min(PAR, queue.length) }, async () => {
  for (let c; (c = queue.shift());) if (await one(c) !== 0) failed.push(c);
}));
console.log(`done ${new Date().toISOString()} · ${cards.length - failed.length}/${cards.length} ok${failed.length ? ' · failed: ' + failed.join(' ') : ''}`);
