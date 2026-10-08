import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const checker = fileURLToPath(new URL('../../scripts/check-syntax.mjs', import.meta.url));
test('syntax checker validates every file without executing it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hefesto-syntax-'));
  try {
    writeFileSync(path.join(root, 'first.js'), 'throw new Error("must not execute")');
    writeFileSync(path.join(root, 'second.js'), 'const valid = 1;');
    assert.equal(spawnSync(process.execPath, [checker, root], { encoding: 'utf8' }).status, 0);
    writeFileSync(path.join(root, 'second.js'), 'const broken = ;');
    const result = spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /second\.js/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
