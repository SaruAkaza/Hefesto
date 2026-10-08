export const CYCLE_STATES = Object.freeze({
  AWAITING_BASELINE: 'awaiting_baseline',
  OPEN: 'open',
  CLOSED: 'closed',
  INVALID: 'invalid',
  UNOBSERVABLE: 'unobservable'
});

export const CONFIDENCE_LEVELS = Object.freeze({
  VERIFIED_AUTO_HIGH: 'verified_auto_high',
  VERIFIED_AUTO_MEDIUM: 'verified_auto_medium',
  ESTIMATED: 'estimated',
  UNOBSERVABLE: 'unobservable'
});

export const COUNTER_SEMANTICS = Object.freeze({
  IMPRESSIONS: 'impressions',
  SHEETS: 'sheets',
  UNKNOWN: 'unknown'
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSerial(value) {
  const s = String(value || '').trim();
  return s || null;
}

export function isOfficialConfidence(confidence, { allowMedium = false } = {}) {
  if (confidence === CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH) return true;
  return allowMedium && confidence === CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM;
}

export function classifyRechargeEvidence(input = {}) {
  const {
    observable = true,
    estimated = false,
    semantics = '',
    previousSerial,
    newSerial,
    previousLevel,
    newLevel,
    confirmationSamples = 1,
    counterBefore,
    counterAfter,
    rebootGlitch = false,
    minLevelJump = 15,
    highLevelThreshold = 90
  } = input;

  if (!observable) {
    return {
      eligible: false,
      confidence: CONFIDENCE_LEVELS.UNOBSERVABLE,
      reason: 'source_unobservable'
    };
  }

  if (estimated || semantics === 'estimated_remaining_supply') {
    return {
      eligible: false,
      confidence: CONFIDENCE_LEVELS.ESTIMATED,
      reason: 'estimated_telemetry'
    };
  }

  // Printer-MIB sentinels (-1/-2/-3) describe missing telemetry, not an empty supply.
  const levels = [previousLevel, newLevel].map(toFiniteNumber);
  if (levels.some(level => level !== null && (level < 0 || level > 100))) {
    return { eligible: false, confidence: CONFIDENCE_LEVELS.UNOBSERVABLE, reason: 'invalid_supply_level' };
  }

  if (rebootGlitch) {
    return {
      eligible: false,
      confidence: CONFIDENCE_LEVELS.ESTIMATED,
      reason: 'reboot_glitch'
    };
  }

  const beforeCounter = toFiniteNumber(counterBefore);
  const afterCounter = toFiniteNumber(counterAfter);
  if (beforeCounter !== null && afterCounter !== null && afterCounter < beforeCounter) {
    return {
      eligible: false,
      confidence: CONFIDENCE_LEVELS.ESTIMATED,
      reason: 'counter_regression'
    };
  }

  const oldSerial = normalizeSerial(previousSerial);
  const nextSerial = normalizeSerial(newSerial);
  const serialChanged = Boolean(oldSerial && nextSerial && oldSerial.toUpperCase() !== nextSerial.toUpperCase());

  const oldLevel = toFiniteNumber(previousLevel);
  const nextLevel = toFiniteNumber(newLevel);
  const levelJump = oldLevel !== null && nextLevel !== null ? nextLevel - oldLevel : null;
  const sustained = Number(confirmationSamples) >= 2;
  const coherentHighLevel = nextLevel !== null && nextLevel >= Number(highLevelThreshold);

  if (serialChanged && sustained && (coherentHighLevel || (levelJump !== null && levelJump > 0))) {
    return {
      eligible: true,
      confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_HIGH,
      reason: 'serial_change_confirmed',
      serialChanged,
      levelJump
    };
  }

  if (sustained && levelJump !== null && levelJump >= Number(minLevelJump)) {
    return {
      eligible: true,
      confidence: CONFIDENCE_LEVELS.VERIFIED_AUTO_MEDIUM,
      reason: 'sustained_level_jump',
      serialChanged,
      levelJump
    };
  }

  return {
    eligible: false,
    confidence: CONFIDENCE_LEVELS.ESTIMATED,
    reason: 'insufficient_evidence',
    serialChanged,
    levelJump
  };
}

export function createAwaitingCycle({ printerId, supplySlot, supplyType = 'unknown', sku = null } = {}) {
  if (!printerId) throw new TypeError('printerId is required');
  if (!supplySlot) throw new TypeError('supplySlot is required');

  return {
    printerId,
    supplySlot,
    supplyType,
    sku,
    status: CYCLE_STATES.AWAITING_BASELINE,
    confidence: null,
    startPageCount: null,
    endPageCount: null,
    pagesProduced: null,
    nominalYieldPages: null,
    yieldRatio: null,
    startedAt: null,
    endedAt: null,
    startEvidenceId: null,
    endEvidenceId: null,
    invalidReason: null
  };
}

export function openCycleFromEvent(event = {}, profile = null, options = {}) {
  const {
    allowMedium = false
  } = options;

  if (!event.printerId) throw new TypeError('event.printerId is required');
  if (!event.supplySlot) throw new TypeError('event.supplySlot is required');
  if (!isOfficialConfidence(event.confidence, { allowMedium })) {
    throw new RangeError('event confidence is not eligible to open an official cycle');
  }

  const pageCount = toFiniteNumber(event.pageCount);
  if (pageCount === null || pageCount < 0) {
    throw new RangeError('event.pageCount must be a non-negative number');
  }

  const nominalYield = toFiniteNumber(profile?.nominalYieldPages);

  return {
    printerId: event.printerId,
    supplySlot: event.supplySlot,
    supplyType: event.supplyType || profile?.supplyType || 'unknown',
    sku: event.sku || profile?.sku || null,
    status: CYCLE_STATES.OPEN,
    confidence: event.confidence,
    startPageCount: Math.trunc(pageCount),
    endPageCount: null,
    pagesProduced: null,
    nominalYieldPages: nominalYield !== null && nominalYield > 0 ? Math.trunc(nominalYield) : null,
    yieldRatio: null,
    startedAt: event.detectedAt || new Date().toISOString(),
    endedAt: null,
    startEvidenceId: event.id || null,
    endEvidenceId: null,
    invalidReason: null
  };
}

export function closeCycleFromEvent(openCycle = {}, event = {}, profile = null, options = {}) {
  const {
    allowMedium = false
  } = options;

  if (openCycle.status !== CYCLE_STATES.OPEN) {
    throw new RangeError('only an open cycle can be closed');
  }
  if (event.printerId !== openCycle.printerId || event.supplySlot !== openCycle.supplySlot) {
    throw new RangeError('closing event must match printer and supply slot');
  }
  if (!isOfficialConfidence(event.confidence, { allowMedium })) {
    throw new RangeError('event confidence is not eligible to close an official cycle');
  }

  const start = toFiniteNumber(openCycle.startPageCount);
  const end = toFiniteNumber(event.pageCount);
  if (start === null || end === null) {
    throw new RangeError('cycle counters must be numeric');
  }
  if (end < start) {
    return {
      ...openCycle,
      status: CYCLE_STATES.INVALID,
      endPageCount: Math.trunc(end),
      endedAt: event.detectedAt || new Date().toISOString(),
      endEvidenceId: event.id || null,
      invalidReason: 'counter_regression',
      pagesProduced: null,
      yieldRatio: null
    };
  }

  const pagesProduced = Math.trunc(end - start);
  const profileYield = toFiniteNumber(profile?.nominalYieldPages);
  const cycleYield = toFiniteNumber(openCycle.nominalYieldPages);
  const nominalYield = profileYield !== null && profileYield > 0
    ? Math.trunc(profileYield)
    : (cycleYield !== null && cycleYield > 0 ? Math.trunc(cycleYield) : null);

  return {
    ...openCycle,
    status: CYCLE_STATES.CLOSED,
    confidence: event.confidence,
    endPageCount: Math.trunc(end),
    pagesProduced,
    nominalYieldPages: nominalYield,
    yieldRatio: nominalYield ? pagesProduced / nominalYield : null,
    endedAt: event.detectedAt || new Date().toISOString(),
    endEvidenceId: event.id || null,
    invalidReason: null
  };
}
