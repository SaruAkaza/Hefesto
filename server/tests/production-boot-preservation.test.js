import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../db.js';

test('production boot preserves suspicious recharge history unless cleanup is explicitly requested', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hefesto-boot-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'fixture.db');
  const fixture = new DatabaseSync(file);
  createSchema(fixture);
  for (const id of ['first', 'second']) fixture.prepare(`INSERT INTO recharges
    (id,printer_id,supply_name,new_level,page_count,timestamp) VALUES(?,?,?,?,?,?)`)
    .run(id, 'fixture-printer', 'Black', 100, 15200, '2026-09-30T14:00:00Z');
  fixture.close();
  const environment = { ...process.env, NODE_ENV: 'production' };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.HEFESTO_DB_PATH;
  const source = `import * as db from ${JSON.stringify(new URL('../db.js', import.meta.url).href)};
    db.initDatabase({dbPath:process.argv[1],skipSeeds:true});
    console.log('BOOT_ROWS='+db.getRecharges().length); db.closeDatabase();`;
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source, file], { env: environment, timeout: 10000 });
  assert.match(result.stdout, /BOOT_ROWS=2/);
});
