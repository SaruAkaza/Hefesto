import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMigrationUnitId } from '../db.js';

test('migration keeps a valid unit id', () => {
  const units = [{ id: 'unit-a', name: 'A' }];
  const printer = { unitId: 'unit-a', unitName: 'A' };
  assert.equal(resolveMigrationUnitId(printer, units), 'unit-a');
});

test('migration reconciles a legacy unit id by unit name', () => {
  const units = [{ id: 'unit-current', name: 'Unidade A' }];
  const printer = { unitId: 'unit-legacy', unitName: 'Unidade A' };
  assert.equal(resolveMigrationUnitId(printer, units), 'unit-current');
});

test('migration normalizes repeated whitespace in unit names', () => {
  const units = [{ id: 'unit-c', name: 'Unidade   Exemplo' }];
  const printer = { unitId: 'old-id', unitName: 'Unidade Exemplo' };
  assert.equal(resolveMigrationUnitId(printer, units), 'unit-c');
});

test('migration returns null when no valid parent unit exists', () => {
  const units = [{ id: 'unit-a', name: 'A' }];
  const printer = { unitId: 'missing-unit', unitName: 'Unidade inexistente' };
  assert.equal(resolveMigrationUnitId(printer, units), null);
});
