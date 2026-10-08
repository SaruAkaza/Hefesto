import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  ensureConsumableLifecycleSchema,
  upsertConsumableProfile,
  getConsumableProfile,
  recordConsumableEvent,
  getConsumableEvent,
  saveConsumableCycle,
  getActiveConsumableCycle,
  listConsumableCycles
} from '../consumable-lifecycle-store.js';

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE printers (id TEXT PRIMARY KEY)');
  ensureConsumableLifecycleSchema(db);
  return db;
}

test('lifecycle schema creates profiles, events and cycles tables', () => {
  const db = createDb();
  const names = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('consumable_profiles', 'consumable_events', 'consumable_cycles')
    ORDER BY name
  `).all().map(row => row.name);

  assert.deepEqual(names, [
    'consumable_cycles',
    'consumable_events',
    'consumable_profiles'
  ]);
  db.close();
});

test('profile upsert preserves model/slot policy and nominal source', () => {
  const db = createDb();

  upsertConsumableProfile(db, {
    id: 'epson-m1180-black',
    modelPattern: 'EPSON M1180',
    supplySlot: 'black',
    supplyType: 'ink',
    sku: 'T534',
    nominalYieldPages: 6000,
    nominalYieldSource: 'manufacturer',
    counterSemantics: 'impressions',
    rechargeObservability: 'unknown',
    serialObservable: false,
    levelObservable: false,
    confidencePolicy: 'high_only',
    createdAt: '2026-09-27T03:00:00.000Z',
    updatedAt: '2026-09-27T03:00:00.000Z'
  });

  const profile = getConsumableProfile(db, 'epson-m1180-black');
  assert.equal(profile.nominalYieldPages, 6000);
  assert.equal(profile.sku, 'T534');
  assert.equal(profile.counterSemantics, 'impressions');
  assert.equal(profile.serialObservable, false);
  db.close();
});

test('event store persists raw evidence for later audit', () => {
  const db = createDb();
  db.prepare('INSERT INTO printers (id) VALUES (?)').run('printer-1');

  recordConsumableEvent(db, {
    id: 'event-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    eventType: 'recharge_detected',
    previousLevel: 12,
    newLevel: 98,
    pageCount: 42000,
    sampleCount: 3,
    confidence: 'verified_auto_high',
    evidence: {
      serialChanged: true,
      source: 'snmp'
    },
    detectedAt: '2026-09-27T03:00:00.000Z'
  });

  const event = getConsumableEvent(db, 'event-1');
  assert.equal(event.pageCount, 42000);
  assert.equal(event.sampleCount, 3);
  assert.deepEqual(event.evidence, {
    serialChanged: true,
    source: 'snmp'
  });
  db.close();
});

test('awaiting baseline cycle persists without inventing counters', () => {
  const db = createDb();
  db.prepare('INSERT INTO printers (id) VALUES (?)').run('printer-1');

  saveConsumableCycle(db, {
    id: 'cycle-awaiting',
    printerId: 'printer-1',
    supplySlot: 'black',
    supplyType: 'ink',
    status: 'awaiting_baseline',
    createdAt: '2026-09-27T03:00:00.000Z',
    updatedAt: '2026-09-27T03:00:00.000Z'
  });

  const active = getActiveConsumableCycle(db, 'printer-1', 'black');
  assert.equal(active.status, 'awaiting_baseline');
  assert.equal(active.startPageCount, null);
  assert.equal(active.pagesProduced, null);
  db.close();
});

test('database prevents two simultaneous active cycles for the same printer and slot', () => {
  const db = createDb();
  db.prepare('INSERT INTO printers (id) VALUES (?)').run('printer-1');

  saveConsumableCycle(db, {
    id: 'cycle-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'awaiting_baseline',
    createdAt: '2026-09-27T03:00:00.000Z'
  });

  assert.throws(() => saveConsumableCycle(db, {
    id: 'cycle-2',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'open',
    startPageCount: 1000,
    startedAt: '2026-09-27T04:00:00.000Z'
  }));

  db.close();
});

test('closed cycle allows a new active cycle for the same slot', () => {
  const db = createDb();
  db.prepare('INSERT INTO printers (id) VALUES (?)').run('printer-1');

  saveConsumableCycle(db, {
    id: 'cycle-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'open',
    startPageCount: 1000,
    startedAt: '2026-09-01T03:00:00.000Z',
    createdAt: '2026-09-01T03:00:00.000Z'
  });

  saveConsumableCycle(db, {
    id: 'cycle-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'closed',
    startPageCount: 1000,
    endPageCount: 6500,
    pagesProduced: 5500,
    startedAt: '2026-09-01T03:00:00.000Z',
    endedAt: '2026-09-27T03:00:00.000Z',
    createdAt: '2026-09-01T03:00:00.000Z',
    updatedAt: '2026-09-27T03:00:00.000Z'
  });

  saveConsumableCycle(db, {
    id: 'cycle-2',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'open',
    startPageCount: 6500,
    startedAt: '2026-09-27T03:00:00.000Z',
    createdAt: '2026-09-27T03:00:00.000Z'
  });

  const cycles = listConsumableCycles(db, 'printer-1', 'black');
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].status, 'closed');
  assert.equal(cycles[1].status, 'open');
  db.close();
});

test('printer deletion cascades lifecycle events and cycles', () => {
  const db = createDb();
  db.prepare('INSERT INTO printers (id) VALUES (?)').run('printer-1');

  recordConsumableEvent(db, {
    id: 'event-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    eventType: 'recharge_detected',
    confidence: 'verified_auto_high'
  });

  saveConsumableCycle(db, {
    id: 'cycle-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    status: 'awaiting_baseline'
  });

  db.prepare('DELETE FROM printers WHERE id = ?').run('printer-1');

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_events').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM consumable_cycles').get().n, 0);
  db.close();
});
