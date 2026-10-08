import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../', import.meta.url));
const roots = process.argv.slice(2);
const excluded = new Set(['node_modules', '.git', 'data', 'backups']);
async function files(directory) {
  const found = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.name.endsWith('.min.js')) continue;
    const full = path.join(directory, item.name);
    if (item.isDirectory()) found.push(...await files(full));
    else if (item.isFile() && /\.(?:js|mjs|cjs)$/.test(item.name)) found.push(full);
  }
  return found.sort();
}
let checked = 0;
for (const root of roots.length ? roots : ['server', 'public/js', 'scripts'].map(p => path.join(repo, p))) {
  for (const file of await files(root)) {
    try {
      await run(process.execPath, ['--check', file], { timeout: 30000 });
      checked++;
    } catch (error) {
      console.error(`Sintaxe inválida: ${path.relative(repo, file)}\n${error.stderr || error.message}`);
      process.exitCode = 1;
    }
  }
}
console.log(`${checked} arquivos JavaScript verificados individualmente.`);
