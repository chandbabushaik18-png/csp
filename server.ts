import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const implPath = path.join(__dirname, 'server_impl.ts');
if (!existsSync(implPath)) {
  console.error('Missing server_impl.ts — pull latest from GitHub main');
  process.exit(1);
}
await import('./server_impl.ts');
