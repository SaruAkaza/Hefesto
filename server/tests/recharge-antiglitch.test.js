import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDatabase,
  setDatabase,
  closeDatabase,
  isRebootGlitch,
  setPendingRecharge,
  getPendingRecharge,
  deletePendingRecharge,
  recordTelemetrySnapshot,
  savePrinter
} from '../db.js';

let testDb;

test.before(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
});

test.after(() => {
  closeDatabase();
});

test('Recharge Anti-Glitch - isRebootGlitch detects transient dip and return to previous level', () => {
  const printerId = 'p-test-glitch-1';

  // 1. Record snapshot T0: Toner at 50%
  recordTelemetrySnapshot({
    printerId,
    ip: '198.18.5.50',
    name: 'Brother HL-L6402DW',
    unitName: 'Filial Teste',
    pageCount: 10000,
    supplies: [{ name: 'Toner Cartridge', type: 'toner', percentage: 50 }]
  });

  // 2. Record snapshot T1 (reboot glitch / transient communication glitch): Toner reports 0% or -2%
  recordTelemetrySnapshot({
    printerId,
    ip: '198.18.5.50',
    name: 'Brother HL-L6402DW',
    unitName: 'Filial Teste',
    pageCount: 10000,
    supplies: [{ name: 'Toner Cartridge', type: 'toner', percentage: 0 }]
  });

  // 3. At T2: Printer reports 51% (recovery from reboot glitch, not a 50% -> 100% replacement)
  const isGlitch = isRebootGlitch(printerId, 'Toner Cartridge', 51, 3);
  assert.equal(isGlitch, true, 'Should detect that 51% is a reboot glitch recovery because previous snapshot had 50%');

  // 4. If printer reports 100% (genuine new toner cartridge), isRebootGlitch should return false
  const isGenuineNewToner = isRebootGlitch(printerId, 'Toner Cartridge', 100, 3);
  assert.equal(isGlitch && isGenuineNewToner === false, true, '100% jump is not a reboot glitch');
});

test('Recharge Anti-Glitch - isRebootGlitch with insufficient snapshots or invalid params', () => {
  assert.equal(isRebootGlitch(null, 'Toner', 50), false);
  assert.equal(isRebootGlitch('nonexistent-printer', 'Toner', 50), false);
  assert.equal(isRebootGlitch('p-test-glitch-1', '', 50), false);
  assert.equal(isRebootGlitch('p-test-glitch-1', 'Toner', 'invalid'), false);
});

test('Pending Recharges - Contract & CRUD operations (save, get, delete)', () => {
  const printerId = 'p-test-1';
  savePrinter({
    id: printerId,
    name: 'Impressora Teste 1',
    ip: '198.18.5.60',
    community: 'public'
  });

  const confKey = `${printerId}_Toner Cartridge`;
  const pendingData = {
    printerId,
    supplyName: 'Toner Cartridge',
    levelBefore: 10,
    levelAfter: 100,
    supplyType: 'toner',
    timestamp: Date.now()
  };

  // 1. Save pending recharge
  setPendingRecharge(confKey, pendingData);

  // 2. Retrieve pending recharge
  const saved = getPendingRecharge(confKey);
  assert.ok(saved, 'Pending recharge should exist in DB');
  assert.equal(saved.id, confKey);
  assert.equal(saved.printerId, printerId);
  assert.equal(saved.supplyName, 'Toner Cartridge');
  assert.equal(saved.baselineLevel, 10);
  assert.equal(saved.targetLevel, 100);

  // 3. Delete pending recharge
  deletePendingRecharge(confKey);
  const afterDelete = getPendingRecharge(confKey);
  assert.equal(afterDelete, null, 'Pending recharge should be deleted');
});
