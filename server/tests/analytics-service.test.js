import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  isRefillableTank,
  normalizeSupplyPercentage,
  getPrinterNominalMetrics,
  calculateConsumableForecast,
  calculateWorkload,
  calculateProductionDelta
} from '../analytics-service.js';
import {
  ensureConsumableLifecycleSchema,
  upsertConsumableProfile
} from '../consumable-lifecycle-store.js';

test('normalizeSupplyPercentage returns exact percentage for valid readings', () => {
  assert.equal(normalizeSupplyPercentage({ percentage: 75 }), 75);
  assert.equal(normalizeSupplyPercentage({ percentage: 0 }), 0);
  assert.equal(normalizeSupplyPercentage({ percentage: 100 }), 100);
  assert.equal(normalizeSupplyPercentage({ level: 50, maxLevel: 200 }), 25);
});

test('normalizeSupplyPercentage returns null for unknown, negative or estimated readings without inventing 85%', () => {
  assert.equal(normalizeSupplyPercentage(null), null);
  assert.equal(normalizeSupplyPercentage({ percentage: null }), null);
  assert.equal(normalizeSupplyPercentage({ percentage: undefined }), null);
  assert.equal(normalizeSupplyPercentage({ percentage: '' }), null);
  assert.equal(normalizeSupplyPercentage({ percentage: -2 }), null);
  assert.equal(normalizeSupplyPercentage({ percentage: -3 }), null);
  assert.equal(normalizeSupplyPercentage({ name: 'Tanque de Tinta Preto', percentage: -2 }), null);
  assert.equal(normalizeSupplyPercentage({ name: 'Ink Bottle K', estimated: true, percentage: 80 }), null);
});

test('getPrinterNominalMetrics returns null without a registered consumable profile', () => {
  const db = new DatabaseSync(':memory:');
  ensureConsumableLifecycleSchema(db);

  // Even for recognizable brand names like Epson, Xerox, Brother, without profile it does NOT guess
  const epsonMetrics = getPrinterNominalMetrics('Epson WorkForce Pro WF-C579R', 'Impressora Sala 1', db);
  assert.equal(epsonMetrics.blackYieldNominal, null);
  assert.equal(epsonMetrics.colorYieldNominal, null);
  assert.equal(epsonMetrics.source, null);

  const xeroxMetrics = getPrinterNominalMetrics('Xerox VersaLink B405', 'Recepção', db);
  assert.equal(xeroxMetrics.blackYieldNominal, null);
  assert.equal(xeroxMetrics.source, null);

  db.close();
});

test('getPrinterNominalMetrics retrieves verified nominal yield from consumable_profiles', () => {
  const db = new DatabaseSync(':memory:');
  ensureConsumableLifecycleSchema(db);

  upsertConsumableProfile(db, {
    id: 'prof-b405-black',
    modelPattern: 'VersaLink B405',
    supplySlot: 'black toner',
    supplyType: 'toner',
    sku: '106R03584',
    nominalYieldPages: 13900,
    nominalYieldSource: 'Xerox ISO/IEC 19752 Spec Sheet',
    counterSemantics: 'impressions',
    rechargeObservability: 'full',
    serialObservable: true,
    levelObservable: true,
    confidencePolicy: 'high_only'
  });

  const metrics = getPrinterNominalMetrics('Xerox VersaLink B405 Multifunction', 'Prédio A', db);
  assert.equal(metrics.blackYieldNominal, 13900);
  assert.equal(metrics.source, 'Xerox ISO/IEC 19752 Spec Sheet');
  assert.equal(metrics.sku, '106R03584');

  db.close();
});

test('calculateConsumableForecast reports unavailable when data is insufficient', () => {
  // 1. Missing supply
  const res1 = calculateConsumableForecast();
  assert.equal(res1.available, false);
  assert.equal(res1.reason, 'missing_supply');

  // 2. Estimated or unmeasurable supply
  const res2 = calculateConsumableForecast({
    supply: { name: 'Tanque de Tinta', percentage: 70, estimated: true },
    avgPagesPerDay: 50,
    nominalYield: 10000
  });
  assert.equal(res2.available, false);
  assert.equal(res2.reason, 'estimated_supply_unmeasurable');

  // 3. Unknown percentage
  const res3 = calculateConsumableForecast({
    supply: { name: 'Toner Preto', percentage: null },
    avgPagesPerDay: 50,
    nominalYield: 10000
  });
  assert.equal(res3.available, false);
  assert.equal(res3.reason, 'unknown_percentage');

  // 4. Missing nominal profile
  const res4 = calculateConsumableForecast({
    supply: { name: 'Toner Preto', percentage: 50 },
    avgPagesPerDay: 50,
    nominalYield: null
  });
  assert.equal(res4.available, false);
  assert.equal(res4.reason, 'missing_nominal_profile');

  // 5. No consumption history (0 pages/day)
  const res5 = calculateConsumableForecast({
    supply: { name: 'Toner Preto', percentage: 50 },
    avgPagesPerDay: 0,
    nominalYield: 10000
  });
  assert.equal(res5.available, false);
  assert.equal(res5.reason, 'no_consumption_history');
});

test('calculateConsumableForecast computes realistic forecast when data is verified', () => {
  const forecast = calculateConsumableForecast({
    supply: { name: 'Toner Preto', percentage: 40 },
    avgPagesPerDay: 100,
    nominalYield: 10000
  });

  assert.equal(forecast.available, true);
  assert.equal(forecast.pagesRemainingEstimated, 4000); // 40% of 10000
  assert.equal(forecast.daysRemainingEstimated, 40); // 4000 / 100
  assert.match(forecast.estimatedDepletionDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('calculateWorkload returns unknown if machine capacity is not calibrated', () => {
  const workload1 = calculateWorkload(1500, null);
  assert.equal(workload1.workloadStatus, 'unknown');
  assert.equal(workload1.capacityRatio, null);

  const workload2 = calculateWorkload(8000, 10000);
  assert.equal(workload2.workloadStatus, 'high');
  assert.equal(workload2.capacityRatio, 80);

  const workload3 = calculateWorkload(1000, 10000);
  assert.equal(workload3.workloadStatus, 'low');
  assert.equal(workload3.capacityRatio, 10);
});

test('calculateProductionDelta handles counter regression safely without negative numbers', () => {
  // Normal delta
  const normal = calculateProductionDelta(1000, 1250);
  assert.equal(normal.valid, true);
  assert.equal(normal.regression, false);
  assert.equal(normal.delta, 250);

  // Counter regression (e.g. board replaced or reset: 5000 -> 300)
  const regressed = calculateProductionDelta(5000, 300);
  assert.equal(regressed.valid, false);
  assert.equal(regressed.regression, true);
  assert.equal(regressed.delta, 0); // Never produces -4700!

  // Invalid / null counts
  const invalid = calculateProductionDelta(null, 1000);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.delta, 0);
});
