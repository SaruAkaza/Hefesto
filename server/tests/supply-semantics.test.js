import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/js/supply-semantics.js';
import { evaluatePrinterHealth } from '../health-engine.js';
import { normalizePrinterMibSupply, queryEpsonHttpFallback } from '../snmp-service.js';
const { describe } = globalThis.HefestoSupplySemantics;

test('component life, depletion and receptacle capacity remain distinct despite generic driver status', () => {
  const imaging = { name: 'Drum', type: 'imaging_kit', percentage: 0, status: 'critical' };
  assert.equal(describe(imaging).condition, 'replacement_recommended');
  assert.equal(evaluatePrinterHealth({ telemetry: { online: true, supplies: [imaging] } }).state, 'attention');
  const empty = describe({ name: 'Toner', percentage: 0, status: 'ok' });
  assert.equal(empty.condition, 'depleted');
  assert.equal(empty.status, 'critical');
  const space = describe({ name: 'Waste Ink', percentage: 0, semantics: 'remaining_receptacle_space' });
  assert.equal(space.condition, 'maintenance_required');
  assert.doesNotMatch(space.label, /esgotad/i);
});

test('ambiguous reservoirs, unknown components and undocumented estimates do not become supply alarms', () => {
  for (const supply of [
    { name: 'Reservatório', type: 'other', percentage: 0 },
    { name: 'Waste Toner', type: 'waste_toner', percentage: 0 },
    { name: 'Waste Toner', type: 'waste_toner', percentage: 99, semantics: 'filled_percentage' },
    { name: 'Tanque de Tinta', type: 'toner', percentage: 85, semantics: 'estimated_remaining_supply', estimated: true }
  ]) {
    assert.equal(describe(supply).status, 'unknown');
    const health = evaluatePrinterHealth({ telemetry: { online: true, supplies: [supply] } });
    assert.equal(health.criticalSupply, null);
    assert.equal(health.warningSupply, null);
  }
  assert.equal(describe({ name: 'Tanque de Tinta', percentage: 85,
    semantics: 'estimated_remaining_supply', estimated: true }).reportedPercentage, null);
});

test('SNMP missing or invalid level never coerces to zero; raw quantities need a usable capacity or percent unit', () => {
  const base = { name: 'Toner', classCode: 3, typeCode: 3, unitCode: 7, maxLevel: 100 };
  for (const currentLevel of [null, undefined, '', false, 'bad', 101]) {
    assert.equal(normalizePrinterMibSupply({ ...base, currentLevel }).remainingPercentage, null);
  }
  assert.equal(normalizePrinterMibSupply({ ...base, maxLevel: -2, currentLevel: 25 }).remainingPercentage, null);
  assert.equal(normalizePrinterMibSupply({ ...base, maxLevel: -2, unitCode: 19, currentLevel: 25 }).remainingPercentage, 25);
});

test('Epson tank presence does not fabricate ink; missing maintenance height is unknown while a real zero stays zero', async () => {
  for (const [image, expected] of [["<img src='Icn_Mb.PNG'>", null], ["<img src='Ink_Waste.PNG' height='0'>", 0], ["<img src='Ink_Waste.PNG' height='42'>", 88], ["<img src='Ink_Waste.PNG' height='90'>", null]]) {
    const html = `<title>EPSON M1180</title><div class='clrname'>BK</div>${image}`;
    const data = await queryEpsonHttpFallback('127.0.0.10', { fetchImpl: async url => ({ ok: true,
      text: async () => url.includes('MENTINFO') ? '<div>Counter unavailable</div>' : html }) });
    assert.equal(data.supplies[0].percentage, null);
    assert.equal(data.supplies[0].status, 'unknown');
    assert.equal(data.supplies[1].percentage, expected);
    assert.equal(data.supplies[1].status, expected === null ? 'unknown' : expected === 0 ? 'critical' : 'ok');
    assert.equal(data.info.pageCount, null);
  }
});

test('Xerox reserve suppression applies only to K1/K2, not to a separate component with Black in its name', () => {
  const health = evaluatePrinterHealth({ telemetry: { online: true, supplies: [
    { name: 'Black K1', type: 'toner', percentage: 80 },
    { name: 'Black K2', type: 'toner', percentage: 0 },
    { name: 'Black Drum', type: 'imaging_kit', percentage: 0 }
  ] } });
  assert.equal(health.state, 'attention');
  assert.equal(health.warningSupply.name, 'Black Drum');
});
