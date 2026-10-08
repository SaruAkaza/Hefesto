import { createHash } from 'crypto';
import { classifyRechargeEvidence } from './consumable-lifecycle-engine.js';
import { getConsumableEvent, recordConsumableEvent } from './consumable-lifecycle-store.js';

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanString(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function stableEvidenceId(parts) {
  const payload = parts.map(v => String(v ?? '')).join('|');
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `cevt-${digest}`;
}

export function buildConsumableRechargeObservation(input = {}) {
  const {
    printerId,
    supplySlot,
    supplyType = 'unknown',
    previousLevel,
    newLevel,
    confirmedLevel,
    previousSerial,
    newSerial,
    confirmedSerial,
    previousSemantics = '',
    newSemantics = '',
    confirmedSemantics = '',
    previousEstimated = false,
    newEstimated = false,
    confirmedEstimated = false,
    counterBefore,
    counterAfter,
    rebootGlitch = false,
    detectedAt = new Date().toISOString(),
    telemetrySource = ''
  } = input;

  if (!printerId) throw new TypeError('printerId is required');
  if (!supplySlot) throw new TypeError('supplySlot is required');

  const normalizedPreviousLevel = toFiniteNumber(previousLevel);
  const normalizedNewLevel = toFiniteNumber(confirmedLevel) ?? toFiniteNumber(newLevel);
  const normalizedCounterBefore = toFiniteNumber(counterBefore);
  const normalizedCounterAfter = toFiniteNumber(counterAfter);

  const normalizedPreviousSerial = cleanString(previousSerial);
  const normalizedNewSerial = cleanString(confirmedSerial) || cleanString(newSerial);
  const semantics = cleanString(confirmedSemantics) || cleanString(newSemantics) || cleanString(previousSemantics) || '';
  const estimated = Boolean(previousEstimated || newEstimated || confirmedEstimated);
  const confirmationSamples = (confirmedLevel !== undefined && confirmedLevel !== null) || cleanString(confirmedSerial)
    ? 2
    : 1;

  const classification = classifyRechargeEvidence({
    observable: true,
    estimated,
    semantics,
    previousSerial: normalizedPreviousSerial,
    newSerial: normalizedNewSerial,
    previousLevel: normalizedPreviousLevel,
    newLevel: normalizedNewLevel,
    confirmationSamples,
    counterBefore: normalizedCounterBefore,
    counterAfter: normalizedCounterAfter,
    rebootGlitch
  });

  const detectedLevel = toFiniteNumber(newLevel);
  const confirmationLevel = toFiniteNumber(confirmedLevel);
  const serialMismatch = cleanString(newSerial) && cleanString(confirmedSerial) &&
    String(newSerial).trim().toUpperCase() !== String(confirmedSerial).trim().toUpperCase();
  if (classification.eligible && (serialMismatch || (detectedLevel !== null && confirmationLevel !== null && Math.abs(detectedLevel - confirmationLevel) > 5))) {
    return { eligible: false, recorded: false, classification: { eligible: false, confidence: 'unobservable', reason: 'unstable_confirmation' }, event: null };
  }

  if (!classification.eligible) {
    return {
      eligible: false,
      recorded: false,
      classification,
      event: null
    };
  }

  const pageCount = normalizedCounterAfter !== null ? Math.trunc(normalizedCounterAfter) : null;
  const event = {
    id: stableEvidenceId([
      printerId,
      supplySlot,
      normalizedPreviousSerial,
      normalizedNewSerial,
      normalizedPreviousLevel,
      normalizedNewLevel,
      pageCount,
      classification.reason
    ]),
    printerId,
    supplySlot,
    supplyType: supplyType || 'unknown',
    eventType: 'recharge_detected',
    previousLevel: normalizedPreviousLevel,
    newLevel: normalizedNewLevel,
    previousSerial: normalizedPreviousSerial,
    newSerial: normalizedNewSerial,
    pageCount,
    sampleCount: confirmationSamples,
    confidence: classification.confidence,
    evidence: {
      reason: classification.reason,
      serialChanged: Boolean(classification.serialChanged),
      levelJump: classification.levelJump ?? null,
      counterBefore: normalizedCounterBefore,
      counterAfter: normalizedCounterAfter,
      semantics,
      estimated,
      telemetrySource: cleanString(telemetrySource)
    },
    detectedAt
  };

  return {
    eligible: true,
    recorded: false,
    classification,
    event
  };
}

export function recordConsumableRechargeObservation(database, input = {}) {
  if (!database) throw new TypeError('database is required');

  const observation = buildConsumableRechargeObservation(input);
  if (!observation.eligible || !observation.event) {
    return observation;
  }

  const existing = getConsumableEvent(database, observation.event.id);
  if (existing) {
    return {
      ...observation,
      recorded: false,
      duplicate: true,
      event: existing
    };
  }

  const event = recordConsumableEvent(database, observation.event);
  return {
    ...observation,
    recorded: true,
    duplicate: false,
    event
  };
}
