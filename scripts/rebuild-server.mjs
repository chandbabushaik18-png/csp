import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const parts = [];
for (let i = 0; i < 20; i++) {
  const p = path.join(root, `server_full_part_${i}.txt`);
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, 'utf8'));
}
if (parts.length === 0) {
  console.log('No server_full_part_*.txt found; using existing server.ts');
  process.exit(0);
}
const out = path.join(root, 'server.ts');
fs.writeFileSync(out, parts.join(''));
console.log(`Rebuilt server.ts from ${parts.length} parts (${fs.statSync(out).size} bytes)`);
