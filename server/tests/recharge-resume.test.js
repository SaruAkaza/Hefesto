import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as db from '../db.js';
import { resolveRechargeBaseline } from '../recharge-detection.js';
import { buildConsumableRechargeObservation } from '../consumable-lifecycle-observer.js';

test('persisted pending confirmation is retried when the cache already contains the new level', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hefesto-recharge-resume-'));
  const dbPath = path.join(directory, 'isolated.db');
  db.initDatabase({ dbPath, skipSeeds: true });
  t.after(() => { db.closeDatabase(); rmSync(directory, { recursive: true, force: true }); });
  db.savePrinter({ id: 'p1', name: 'RPA', ip: '127.0.0.10' });
  const now = Date.now();
  db.setPendingRecharge('p1_Magenta', { printerId: 'p1', supplyName: 'Magenta', levelBefore: 0, levelAfter: 100, timestamp: now });
  db.closeDatabase();
  db.initDatabase({ dbPath, skipSeeds: true });
  const current = { name: 'Magenta', percentage: 100 };
  const baseline = resolveRechargeBaseline(current, current, db.getPendingRecharge('p1_Magenta'), now);
  assert.equal(baseline.resumed, true);
  assert.equal(baseline.supply.percentage, 0);
  const confirmed = buildConsumableRechargeObservation({ printerId: 'p1', supplySlot: 'magenta', previousLevel: baseline.supply.percentage,
    newLevel: 100, confirmedLevel: 100, counterBefore: 40556, counterAfter: 40556 });
  assert.equal(confirmed.eligible, true);
  assert.equal(confirmed.event.confidence, 'verified_auto_medium');
});

test('pending recovery rejects expired, estimated, unknown and unstable supply observations', () => {
  const now = Date.now();
  const current = { name: 'Magenta', percentage: 100 };
  const pending = { baselineLevel: 0, targetLevel: 100, firstSeen: new Date(now - 60000).toISOString() };
  for (const patch of [ { firstSeen: new Date(now - 86400001).toISOString() }, { firstSeen: new Date(now + 1).toISOString() },
    { baselineLevel: -2 }, { targetLevel: -3 } ]) {
    assert.equal(resolveRechargeBaseline(current, current, { ...pending, ...patch }, now).resumed, false);
  }
  for (const patch of [ { percentage: 50 }, { percentage: -2 }, { estimated: true }, { semantics: 'estimated_remaining_supply' } ]) {
    assert.equal(resolveRechargeBaseline(current, { ...current, ...patch }, pending, now).resumed, false);
  }
});
