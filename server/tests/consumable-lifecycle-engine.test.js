import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_STATES,
  CONFIDENCE_LEVELS,
  classifyRechargeEvidence,
  createAwaitingCycle,
  openCycleFromEvent,
  closeCycleFromEvent,
  isOfficialConfidence
} from '../consumable-lifecycle-engine.js';

test('estimated telemetry never qualifies as an official recharge event', () => {
  const result = classifyRechargeEvidence({
    observable: true,
    estimated: true,
    previousLevel: 20,
    newLevel: 85,
    confirmationSamples: 3
  });

  assert.equal(result.eligible, false);
  assert.equal(result.confidence, CONFIDENCE_LEVELS.ESTIMATED);
  assert.equal(result.reason, 'estimated_telemetry');
});

test('M1180 estimated_remaining_supply semantics are blocked from lifecycle events', () => {
  const result = classifyRechargeEvidence({
    observable: true,
    semantics: 'estimated_remaining_supply',
    previousLevel: 10,
    newLevel: 85,
    confirmationSamples: 3
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'estimated_telemetry');
});

test('serial change plus confirmation and coherent level is high confidence', () => {
  const result = classifyRechargeEvidence({
    previousSerial: 'OLD123',
    newSerial: 'NEW456',
    previousLevel: 8,
    newLevel: 98,
    confirmationSamples: 2,
    counterBefore: 1000,
    counterAfter: 1000
  });

  assert.equal(result.eligible, true);
  assert.equal(result.confidence, CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH);
});

test('sustained level jump without serial is medium confidence', () => {
  const result = classifyRechargeEvidence({
    previousLevel: 20,
    newLevel: 92,
    confirmationSamples: 2,
    counterBefore: 1000,
    counterAfter: 1002,
    minLevelJump: 15
  });

  assert.equal(result.eligible, true);
  assert.equal(result.confidence, CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM);
});

test('single reading is insufficient even with a large level jump', () => {
  const result = classifyRechargeEvidence({
    previousLevel: 10,
    newLevel: 100,
    confirmationSamples: 1
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'insufficient_evidence');
});

test('reboot glitch is rejected', () => {
  const result = classifyRechargeEvidence({
    previousLevel: 10,
    newLevel: 100,
    confirmationSamples: 3,
    rebootGlitch: true
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'reboot_glitch');
});

test('counter regression is rejected as evidence', () => {
  const result = classifyRechargeEvidence({
    previousLevel: 10,
    newLevel: 100,
    confirmationSamples: 3,
    counterBefore: 5000,
    counterAfter: 4900
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'counter_regression');
});

test('unobservable source is explicit instead of estimated as valid', () => {
  const result = classifyRechargeEvidence({ observable: false });

  assert.equal(result.eligible, false);
  assert.equal(result.confidence, CONFIDENCE_LEVELS.UNOBSERVABLE);
  assert.equal(result.reason, 'source_unobservable');
});

test('awaiting cycle has no invented baseline', () => {
  const cycle = createAwaitingCycle({
    printerId: 'printer-1',
    supplySlot: 'black',
    supplyType: 'ink'
  });

  assert.equal(cycle.status, CYCLE_STATES.AWAITING_BASELINE);
  assert.equal(cycle.startPageCount, null);
  assert.equal(cycle.pagesProduced, null);
});

test('high-confidence event opens a cycle at the observed page counter', () => {
  const cycle = openCycleFromEvent({
    id: 'event-1',
    printerId: 'printer-1',
    supplySlot: 'black',
    supplyType: 'toner',
    pageCount: 10000,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH,
    detectedAt: '2026-09-27T03:00:00.000Z'
  }, {
    nominalYieldPages: 6000
  });

  assert.equal(cycle.status, CYCLE_STATES.OPEN);
  assert.equal(cycle.startPageCount, 10000);
  assert.equal(cycle.nominalYieldPages, 6000);
  assert.equal(cycle.startEvidenceId, 'event-1');
});

test('medium confidence is not official unless policy explicitly allows it', () => {
  assert.equal(isOfficialConfidence(CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM), false);
  assert.equal(isOfficialConfidence(CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM, { allowMedium: true }), true);

  assert.throws(() => openCycleFromEvent({
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 10000,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM
  }), RangeError);
});

test('closing a cycle calculates produced pages and nominal yield ratio', () => {
  const open = openCycleFromEvent({
    id: 'event-start',
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 10000,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH,
    detectedAt: '2026-09-01T03:00:00.000Z'
  }, {
    nominalYieldPages: 6000
  });

  const closed = closeCycleFromEvent(open, {
    id: 'event-end',
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 15750,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH,
    detectedAt: '2026-09-27T03:00:00.000Z'
  });

  assert.equal(closed.status, CYCLE_STATES.CLOSED);
  assert.equal(closed.pagesProduced, 5750);
  assert.equal(closed.yieldRatio, 5750 / 6000);
  assert.equal(closed.endEvidenceId, 'event-end');
});

test('closing event must match the same printer and slot', () => {
  const open = openCycleFromEvent({
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 100,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  });

  assert.throws(() => closeCycleFromEvent(open, {
    printerId: 'printer-1',
    supplySlot: 'cyan',
    pageCount: 200,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  }), RangeError);
});

test('counter regression invalidates an open cycle instead of producing a negative yield', () => {
  const open = openCycleFromEvent({
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 5000,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  });

  const result = closeCycleFromEvent(open, {
    id: 'event-regression',
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 4900,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  });

  assert.equal(result.status, CYCLE_STATES.INVALID);
  assert.equal(result.invalidReason, 'counter_regression');
  assert.equal(result.pagesProduced, null);
  assert.equal(result.yieldRatio, null);
});

test('cycle can close without nominal yield and preserve measured pages', () => {
  const open = openCycleFromEvent({
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 1000,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  });

  const closed = closeCycleFromEvent(open, {
    printerId: 'printer-1',
    supplySlot: 'black',
    pageCount: 1500,
    confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH
  });

  assert.equal(closed.pagesProduced, 500);
  assert.equal(closed.nominalYieldPages, null);
  assert.equal(closed.yieldRatio, null);
});
