import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const a = path.join(dir, 'server_part_0.txt');
const b = path.join(dir, 'server_part_1.txt');
if (!existsSync(a) || !existsSync(b)) {
  console.error('Missing server_part_0.txt or server_part_1.txt');
  process.exit(1);
}
writeFileSync(path.join(dir, '_server_assembled.mts'), readFileSync(a, 'utf8') + readFileSync(b, 'utf8'));
await import('./_server_assembled.mts');
