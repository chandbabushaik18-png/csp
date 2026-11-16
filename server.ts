import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const parts = [0,1,2,3].map(i => path.join(dir, `server_part_${i}.txt`));
for (const p of parts) {
  if (!existsSync(p)) { console.error('Missing', p); process.exit(1); }
}
writeFileSync(path.join(dir, '_server_assembled.mts'), parts.map(p => readFileSync(p, 'utf8')).join(''));
await import('./_server_assembled.mts');
