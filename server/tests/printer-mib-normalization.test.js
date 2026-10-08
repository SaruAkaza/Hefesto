import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrinterMibSupply } from '../snmp-service.js';

test('consumed supply uses current/max as remaining percentage', () => {
  const s = normalizePrinterMibSupply({
    name: 'Transfer Module',
    classCode: 3,
    typeCode: 20,
    unitCode: 7,
    maxLevel: 150000,
    currentLevel: 10500
  });

  assert.equal(s.mibClass, 'supplyThatIsConsumed');
  assert.equal(s.semantics, 'remaining_supply');
  assert.equal(s.type, 'transfer');
  assert.equal(s.remainingPercentage, 7);
  assert.equal(s.status, 'critical');
});

test('filled receptacle uses Printer-MIB level as remaining receptacle space', () => {
  const s = normalizePrinterMibSupply({
    name: 'Waste Toner Bottle',
    classCode: 4,
    typeCode: 4,
    unitCode: 7,
    maxLevel: 90000,
    currentLevel: 24300
  });

  assert.equal(s.mibClass, 'receptacleThatIsFilled');
  assert.equal(s.semantics, 'remaining_receptacle_space');
  assert.equal(s.type, 'waste_toner');
  assert.equal(s.remainingPercentage, 27);
  assert.equal(s.status, 'warning');
});

test('unknown some-remaining Printer-MIB value is never forced to critical', () => {
  const s = normalizePrinterMibSupply({
    name: 'Waste Toner Container',
    classCode: 4,
    typeCode: 4,
    unitCode: 7,
    maxLevel: 50000,
    currentLevel: -3
  });

  assert.equal(s.remainingPercentage, null);
  assert.equal(s.percentage, -3);
  assert.equal(s.status, 'unknown');
});

test('OPC and fuser types come from standardized Printer-MIB type codes', () => {
  const drum = normalizePrinterMibSupply({
    name: 'Black Drum Cartridge',
    classCode: 3,
    typeCode: 9,
    unitCode: 7,
    maxLevel: 219000,
    currentLevel: 201480
  });
  const fuser = normalizePrinterMibSupply({
    name: 'Fuser Assembly',
    classCode: 3,
    typeCode: 15,
    unitCode: 7,
    maxLevel: 490000,
    currentLevel: 485100
  });

  assert.equal(drum.type, 'imaging_kit');
  assert.equal(drum.remainingPercentage, 92);
  assert.equal(drum.status, 'ok');
  assert.equal(fuser.type, 'fuser');
  assert.equal(fuser.remainingPercentage, 99);
  assert.equal(fuser.status, 'ok');
});

test('percent unit works when max capacity is not useful', () => {
  const s = normalizePrinterMibSupply({
    name: 'Toner',
    classCode: 3,
    typeCode: 3,
    unitCode: 19,
    maxLevel: -2,
    currentLevel: 25
  });

  assert.equal(s.remainingPercentage, 25);
  assert.equal(s.status, 'warning');
});
