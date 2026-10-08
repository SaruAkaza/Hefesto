import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  advanceConsumableLifecycle as rawAdvance,
  recordAndAdvanceConsumableLifecycle as rawRecord
} from '../consumable-lifecycle-coordinator.js';
import {
  ensureConsumableLifecycleSchema,
  listConsumableCycles
} from '../consumable-lifecycle-store.js';

// Existing scenarios simulate processing at the fixture observation time.
const advanceConsumableLifecycle = (db, event, options = {}) => rawAdvance(db, event, { now: Date.parse(event.detectedAt), ...options });
const recordAndAdvanceConsumableLifecycle = (db, input, options = {}) => rawRecord(db, input, { now: Date.parse(input.detectedAt), ...options });

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

function highInput({
  previousSerial = 'OLD',
  newSerial = 'NEW',
  previousLevel = 5,
  newLevel = 100,
  counterBefore = 1000,
  counterAfter = 1000,
  detectedAt = '2026-09-28T03:00:00.000Z'
} = {}) {
  return {
    printerId: 'printer-1',
    supplySlot: 'black toner',
    supplyType: 'toner',
    previousLevel,
    newLevel,
    confirmedLevel: newLevel,
    previousSerial,
    newSerial,
    confirmedSerial: newSerial,
    counterBefore,
    counterAfter,
    newSemantics: 'remaining_supply',
    confirmedSemantics: 'remaining_supply',
    detectedAt
  };
}

test('first official high-confidence recharge opens a measurable cycle', () => {
  const db = createDb();
  const result = recordAndAdvanceConsumableLifecycle(db, highInput());

  assert.equal(result.observation.recorded, true);
  assert.equal(result.observation.event.confidence, 'verified_auto_high');
  assert.equal(result.lifecycle.action, 'opened');
  assert.equal(result.lifecycle.activeCycle.status, 'open');
  assert.equal(result.lifecycle.activeCycle.startPageCount, 1000);
  assert.equal(result.lifecycle.activeCycle.startEvidenceId, result.observation.event.id);

  const cycles = listConsumableCycles(db, 'printer-1', 'black toner');
  assert.equal(cycles.length, 1);
  db.close();
});

test('second official recharge closes the previous cycle and opens the next one', () => {
  const db = createDb();

  const first = recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'A',
    newSerial: 'B',
    counterBefore: 1000,
    counterAfter: 1000,
    detectedAt: '2026-09-01T03:00:00.000Z'
  }));

  const second = recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'B',
    newSerial: 'C',
    previousLevel: 4,
    newLevel: 99,
    counterBefore: 1600,
    counterAfter: 1600,
    detectedAt: '2026-09-28T03:00:00.000Z'
  }));

  assert.equal(first.lifecycle.action, 'opened');
  assert.equal(second.lifecycle.action, 'closed_and_opened');

  const cycles = listConsumableCycles(db, 'printer-1', 'black toner');
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].status, 'closed');
  assert.equal(cycles[0].pagesProduced, 600);
  assert.equal(cycles[0].endPageCount, 1600);
  assert.equal(cycles[0].endEvidenceId, second.observation.event.id);
  assert.equal(cycles[1].status, 'open');
  assert.equal(cycles[1].startPageCount, 1600);
  assert.equal(cycles[1].startEvidenceId, second.observation.event.id);
  db.close();
});

test('medium-confidence evidence is persisted but never opens an official cycle by default', () => {
  const db = createDb();

  const result = recordAndAdvanceConsumableLifecycle(db, {
    printerId: 'printer-1',
    supplySlot: 'cyan toner',
    supplyType: 'toner',
    previousLevel: 10,
    newLevel: 90,
    confirmedLevel: 89,
    counterBefore: 2000,
    counterAfter: 2000,
    newSemantics: 'remaining_supply',
    detectedAt: '2026-09-28T04:00:00.000Z'
  });

  assert.equal(result.observation.recorded, true);
  assert.equal(result.observation.event.confidence, 'verified_auto_medium');
  assert.equal(result.lifecycle.action, 'evidence_only');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_events').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_cycles').get().n, 0);
  db.close();
});

test('high-confidence evidence without a counter creates awaiting_baseline instead of inventing zero', () => {
  const db = createDb();

  const result = recordAndAdvanceConsumableLifecycle(db, highInput({
    counterBefore: null,
    counterAfter: null
  }));

  assert.equal(result.lifecycle.action, 'awaiting_baseline');
  assert.equal(result.lifecycle.activeCycle.status, 'awaiting_baseline');
  assert.equal(result.lifecycle.activeCycle.startPageCount, null);
  assert.equal(result.lifecycle.activeCycle.pagesProduced, null);
  db.close();
});

test('next official recharge invalidates an unmeasurable awaiting cycle and opens a clean baseline', () => {
  const db = createDb();

  recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'A',
    newSerial: 'B',
    counterBefore: null,
    counterAfter: null,
    detectedAt: '2026-09-01T03:00:00.000Z'
  }));

  const next = recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'B',
    newSerial: 'C',
    counterBefore: 4200,
    counterAfter: 4200,
    detectedAt: '2026-09-28T03:00:00.000Z'
  }));

  assert.equal(next.lifecycle.action, 'invalidated_and_opened');

  const cycles = listConsumableCycles(db, 'printer-1', 'black toner');
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].status, 'invalid');
  assert.equal(cycles[0].invalidReason, 'baseline_unavailable_before_next_recharge');
  assert.equal(cycles[0].pagesProduced, null);
  assert.equal(cycles[1].status, 'open');
  assert.equal(cycles[1].startPageCount, 4200);
  db.close();
});

test('duplicate telemetry is idempotent for both evidence and cycle state', () => {
  const db = createDb();
  const input = highInput();

  const first = recordAndAdvanceConsumableLifecycle(db, input);
  const duplicate = recordAndAdvanceConsumableLifecycle(db, input);

  assert.equal(first.lifecycle.action, 'opened');
  assert.equal(duplicate.observation.duplicate, true);
  assert.equal(duplicate.lifecycle.action, 'already_processed');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_events').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_cycles').get().n, 1);
  db.close();
});

test('missing counter at a later recharge invalidates the open cycle and waits for a new baseline', () => {
  const db = createDb();

  recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'A',
    newSerial: 'B',
    counterBefore: 5000,
    counterAfter: 5000,
    detectedAt: '2026-09-01T03:00:00.000Z'
  }));

  const next = recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'B',
    newSerial: 'C',
    counterBefore: null,
    counterAfter: null,
    detectedAt: '2026-09-28T03:00:00.000Z'
  }));

  assert.equal(next.lifecycle.action, 'invalidated_and_awaiting');

  const cycles = listConsumableCycles(db, 'printer-1', 'black toner');
  assert.equal(cycles[0].status, 'invalid');
  assert.equal(cycles[0].invalidReason, 'missing_counter_at_recharge');
  assert.equal(cycles[1].status, 'awaiting_baseline');
  db.close();
});

test('counter regression across a cycle invalidates the old cycle but allows a fresh new baseline', () => {
  const db = createDb();

  recordAndAdvanceConsumableLifecycle(db, highInput({
    previousSerial: 'A',
    newSerial: 'B',
    counterBefore: 5000,
    counterAfter: 5000,
    detectedAt: '2026-09-01T03:00:00.000Z'
  }));

  const secondEvent = {
    id: 'event-after-device-counter-reset',
    printerId: 'printer-1',
    supplySlot: 'black toner',
    supplyType: 'toner',
    eventType: 'recharge_detected',
    pageCount: 1000,
    confidence: 'verified_auto_high',
    detectedAt: '2026-09-28T03:00:00.000Z'
  };

  const result = advanceConsumableLifecycle(db, secondEvent);
  assert.equal(result.action, 'invalidated_and_opened');

  const cycles = listConsumableCycles(db, 'printer-1', 'black toner');
  assert.equal(cycles[0].status, 'invalid');
  assert.equal(cycles[0].invalidReason, 'counter_regression');
  assert.equal(cycles[1].status, 'open');
  assert.equal(cycles[1].startPageCount, 1000);
  db.close();
});


test('historical and future evidence is retained without opening retroactive cycles', () => {
  const db = createDb();
  const now = Date.parse('2026-10-08T12:00:00Z');
  for (const [time, reason] of [['2020-01-01T00:00:00Z', 'historical_evidence'], ['2026-10-08T13:00:00Z', 'future_evidence']]) {
    const result = rawRecord(db, highInput({ detectedAt: time, newSerial: reason }), { now });
    assert.equal(result.observation.recorded, true);
    assert.equal(result.lifecycle.action, 'temporal_evidence_only');
    assert.equal(result.lifecycle.reason, reason);
    assert.equal(listConsumableCycles(db, 'printer-1', 'black toner').length, 0);
  }
  db.close();
});
test('an older unseen event cannot close a current cycle or change its baseline', () => {
  const db = createDb(), now = Date.parse('2026-10-08T12:00:00Z');
  const first = rawRecord(db, highInput({ detectedAt: new Date(now).toISOString() }), { now });
  const late = rawRecord(db, highInput({ detectedAt: new Date(now - 60000).toISOString(), newSerial: 'LATE', counterAfter: 1500 }), { now });
  assert.equal(late.lifecycle.reason, 'out_of_order_evidence');
  assert.equal(late.lifecycle.activeCycle.id, first.lifecycle.activeCycle.id);
  assert.equal(late.lifecycle.activeCycle.startPageCount, 1000);
  const retry = rawRecord(db, highInput({ detectedAt: new Date(now).toISOString() }), { now: now + 86400000 });
  assert.equal(retry.lifecycle.action, 'already_processed');
  assert.equal(listConsumableCycles(db, 'printer-1', 'black toner').length, 1);
  db.close();
});
