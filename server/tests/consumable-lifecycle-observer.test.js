import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  buildConsumableRechargeObservation,
  recordConsumableRechargeObservation
} from '../consumable-lifecycle-observer.js';
import { ensureConsumableLifecycleSchema } from '../consumable-lifecycle-store.js';

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE printers (
      id TEXT PRIMARY KEY
    );
    INSERT INTO printers (id) VALUES ('printer-1');
  `);
  ensureConsumableLifecycleSchema(db);
  return db;
}

test('serial change confirmed by a second sample becomes high-confidence evidence', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'black toner',
    supplyType: 'toner',
    previousLevel: 8,
    newLevel: 96,
    confirmedLevel: 95,
    previousSerial: 'OLD123',
    newSerial: 'NEW456',
    confirmedSerial: 'NEW456',
    counterBefore: 1000,
    counterAfter: 1001,
    newSemantics: 'remaining_supply'
  });

  assert.equal(result.eligible, true);
  assert.equal(result.classification.confidence, 'verified_auto_high');
  assert.equal(result.classification.reason, 'serial_change_confirmed');
  assert.equal(result.event.sampleCount, 2);
  assert.equal(result.event.pageCount, 1001);
});

test('sustained level jump without serial becomes medium-confidence evidence', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'cyan toner',
    previousLevel: 12,
    newLevel: 88,
    confirmedLevel: 87,
    counterBefore: 2000,
    counterAfter: 2000,
    newSemantics: 'remaining_supply'
  });

  assert.equal(result.eligible, true);
  assert.equal(result.classification.confidence, 'verified_auto_medium');
  assert.equal(result.classification.reason, 'sustained_level_jump');
});

test('estimated Epson tank telemetry never becomes lifecycle evidence', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'black ink',
    previousLevel: -2,
    newLevel: 85,
    confirmedLevel: 85,
    newEstimated: true,
    confirmedEstimated: true,
    newSemantics: 'estimated_remaining_supply',
    counterBefore: 3000,
    counterAfter: 3000
  });

  assert.equal(result.eligible, false);
  assert.equal(result.classification.confidence, 'estimated');
  assert.equal(result.classification.reason, 'estimated_telemetry');
  assert.equal(result.event, null);
});

test('counter regression rejects otherwise plausible recharge evidence', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'black toner',
    previousLevel: 5,
    newLevel: 100,
    confirmedLevel: 100,
    previousSerial: 'A1',
    newSerial: 'B2',
    confirmedSerial: 'B2',
    counterBefore: 5000,
    counterAfter: 4900
  });

  assert.equal(result.eligible, false);
  assert.equal(result.classification.reason, 'counter_regression');
});

test('single unconfirmed level jump is not eligible', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'black toner',
    previousLevel: 10,
    newLevel: 98,
    counterBefore: 6000,
    counterAfter: 6000
  });

  assert.equal(result.eligible, false);
  assert.equal(result.classification.reason, 'insufficient_evidence');
});

test('stable evidence id deduplicates the same confirmed observation', () => {
  const input = {
    printerId: 'printer-1',
    supplySlot: 'black toner',
    previousLevel: 10,
    newLevel: 100,
    confirmedLevel: 100,
    previousSerial: 'OLD',
    newSerial: 'NEW',
    confirmedSerial: 'NEW',
    counterBefore: 7000,
    counterAfter: 7001,
    detectedAt: '2026-09-27T12:00:00.000Z'
  };

  const first = buildConsumableRechargeObservation(input);
  const second = buildConsumableRechargeObservation({
    ...input,
    detectedAt: '2026-09-27T12:05:00.000Z'
  });

  assert.equal(first.event.id, second.event.id);
});

test('recording is idempotent for duplicate confirmed evidence', () => {
  const db = createDb();
  const input = {
    printerId: 'printer-1',
    supplySlot: 'black toner',
    previousLevel: 4,
    newLevel: 99,
    confirmedLevel: 99,
    previousSerial: 'OLD',
    newSerial: 'NEW',
    confirmedSerial: 'NEW',
    counterBefore: 8000,
    counterAfter: 8002
  };

  const first = recordConsumableRechargeObservation(db, input);
  const second = recordConsumableRechargeObservation(db, input);

  assert.equal(first.recorded, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.recorded, false);
  assert.equal(second.duplicate, true);

  const count = db.prepare('SELECT COUNT(*) AS n FROM consumable_events').get().n;
  assert.equal(count, 1);
  db.close();
});


test('missing counters stay null instead of becoming an invented zero baseline', () => {
  const result = buildConsumableRechargeObservation({
    printerId: 'printer-1',
    supplySlot: 'black toner',
    previousLevel: 5,
    newLevel: 99,
    confirmedLevel: 99,
    previousSerial: 'OLD',
    newSerial: 'NEW',
    confirmedSerial: 'NEW'
  });

  assert.equal(result.eligible, true);
  assert.equal(result.event.pageCount, null);
  assert.equal(result.event.evidence.counterBefore, null);
  assert.equal(result.event.evidence.counterAfter, null);
});
