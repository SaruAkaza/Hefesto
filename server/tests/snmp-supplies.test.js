import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeEpsonTankHttpSupplies,
  parseMaintenanceBoxRemainingStatus
} from '../snmp-service.js';

test('Epson maintenance box with high remaining life is OK', () => {
  assert.equal(parseMaintenanceBoxRemainingStatus(88), 'ok');
  assert.equal(parseMaintenanceBoxRemainingStatus(54), 'ok');
});

test('Epson maintenance box with 10-30% remaining life is warning', () => {
  assert.equal(parseMaintenanceBoxRemainingStatus(30), 'warning');
  assert.equal(parseMaintenanceBoxRemainingStatus(25), 'warning');
  assert.equal(parseMaintenanceBoxRemainingStatus(10), 'warning');
});

test('Epson maintenance box below 10% remaining life is critical', () => {
  assert.equal(parseMaintenanceBoxRemainingStatus(9), 'critical');
  assert.equal(parseMaintenanceBoxRemainingStatus(0), 'critical');
});


test('Epson M1180 SNMP tank is enriched with Web Config maintenance box', () => {
  const snmpResult = {
    supplies: [{
      name: 'Black Ink Bottle',
      type: 'toner',
      percentage: -2,
      status: 'unknown'
    }]
  };
  const httpResult = {
    online: true,
    supplies: [{
      name: 'Caixa de Manutenção (vida útil restante)',
      type: 'waste_toner',
      percentage: 42,
      remainingPercentage: 42,
      status: 'ok',
      semantics: 'remaining_maintenance_life',
      source: 'epson_web_config'
    }]
  };

  const merged = mergeEpsonTankHttpSupplies(snmpResult, httpResult);

  assert.equal(merged.supplies.length, 2);
  assert.equal(merged.supplies[1].remainingPercentage, 42);
  assert.equal(merged.supplies[1].status, 'ok');
  assert.deepEqual(merged.telemetrySources, ['snmp', 'epson_web_config']);
});

test('Epson maintenance box merge does not duplicate an existing box', () => {
  const snmpResult = {
    supplies: [
      { name: 'Black Ink Bottle', percentage: -2, type: 'toner' },
      { name: 'Maintenance Box', percentage: 50, type: 'waste_toner' }
    ]
  };
  const httpResult = {
    online: true,
    supplies: [
      { name: 'Caixa de Manutenção', percentage: 42, type: 'waste_toner' }
    ]
  };

  const merged = mergeEpsonTankHttpSupplies(snmpResult, httpResult);

  assert.equal(merged.supplies.length, 2);
});
