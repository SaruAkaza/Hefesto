import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDatabase,
  setDatabase,
  closeDatabase,
  savePrinter,
  setPendingRecharge,
  getPendingRecharge,
  getAllPendingRecharges,
  expireStalePendingRecharges,
  recordRecharge,
  getRecharges
} from '../db.js';

let testDb;

test.before(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
});

test.after(() => {
  closeDatabase();
});

test('Pending Recharges Lifecycle - expireStalePendingRecharges expunges old unconfirmed pendencies', () => {
  const printerId = 'p-stale-test';
  savePrinter({
    id: printerId,
    name: 'Brother Stale Test',
    ip: '198.18.5.90',
    community: 'public'
  });

  const now = Date.now();
  const oldDate = new Date(now - 30 * 3600000).toISOString(); // 30 hours ago
  const recentDate = new Date(now - 2 * 3600000).toISOString(); // 2 hours ago

  // Insert old pending recharge
  testDb.prepare(`
    INSERT INTO pending_recharges (id, printer_id, supply_name, supply_type, baseline_level, target_level, consecutive_cycles, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('pending_old', printerId, 'Toner Black', 'toner', 10, 100, 1, oldDate, oldDate);

  // Insert recent pending recharge
  testDb.prepare(`
    INSERT INTO pending_recharges (id, printer_id, supply_name, supply_type, baseline_level, target_level, consecutive_cycles, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('pending_recent', printerId, 'Drum Unit', 'imaging_kit', 5, 100, 1, recentDate, recentDate);

  assert.equal(getAllPendingRecharges().length, 2);

  // Expire pendencies older than 24 hours
  const expiredCount = expireStalePendingRecharges(24);
  assert.equal(expiredCount, 1);

  assert.equal(getPendingRecharge('pending_old'), null, 'Old pending recharge should have been expired');
  assert.ok(getPendingRecharge('pending_recent'), 'Recent pending recharge should be preserved');
});

test('Recharge Anti-Duplication - rejects duplicate recharge for same printer, slot and page count', () => {
  const printerId = 'p-dup-test';
  savePrinter({
    id: printerId,
    name: 'HP LaserJet M404',
    ip: '198.18.5.91',
    community: 'public'
  });

  const recharge1 = {
    printerId,
    printerName: 'HP LaserJet M404',
    ip: '198.18.5.91',
    supplyName: 'Black Cartridge HP 58A',
    supplyType: 'toner',
    previousLevel: 10,
    newLevel: 100,
    pageCount: 15000,
    isFullRecharge: true,
    timestamp: new Date().toISOString()
  };

  const recorded1 = recordRecharge(recharge1);
  assert.ok(recorded1, 'First recharge must be recorded');

  // Attempt to record the same event again (same printer, same slot, same pageCount)
  const recorded2 = recordRecharge(recharge1);
  assert.equal(recorded2, null, 'Duplicate recharge on same pageCount must be rejected');
});

test('Recharge Anti-Duplication - rejects same RFID/CRUM serial without relevant page delta (< 50 pages)', () => {
  const printerId = 'p-serial-dup-test';
  savePrinter({
    id: printerId,
    name: 'Xerox VersaLink B405',
    ip: '198.18.5.92',
    community: 'public'
  });

  const recharge1 = {
    printerId,
    printerName: 'Xerox VersaLink B405',
    ip: '198.18.5.92',
    supplyName: 'Black Toner;SNABC123456',
    supplyType: 'toner',
    previousLevel: 5,
    newLevel: 100,
    pageCount: 20000,
    isFullRecharge: true,
    timestamp: new Date(Date.now() - 3600000).toISOString()
  };

  const recorded1 = recordRecharge(recharge1);
  assert.ok(recorded1, 'First recharge with serial SNABC123456 must be recorded');

  // Attempt recharge with identical serial after only 10 pages
  const rechargeGlitch = {
    printerId,
    printerName: 'Xerox VersaLink B405',
    ip: '198.18.5.92',
    supplyName: 'Black Toner;SNABC123456',
    supplyType: 'toner',
    previousLevel: 10,
    newLevel: 100,
    pageCount: 20010, // only 10 pages later!
    isFullRecharge: true,
    timestamp: new Date().toISOString()
  };

  const recordedGlitch = recordRecharge(rechargeGlitch);
  assert.equal(recordedGlitch, null, 'Recharge with identical serial and delta < 50 pages must be rejected');

  // Legitimate recharge with different serial
  const rechargeLegit = {
    printerId,
    printerName: 'Xerox VersaLink B405',
    ip: '198.18.5.92',
    supplyName: 'Black Toner;SNXYZ987654',
    supplyType: 'toner',
    previousLevel: 10,
    newLevel: 100,
    pageCount: 20010,
    isFullRecharge: true,
    timestamp: new Date().toISOString()
  };

  const recordedLegit = recordRecharge(rechargeLegit);
  assert.ok(recordedLegit, 'Recharge with new serial must be accepted');
});
