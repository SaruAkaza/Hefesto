import { createHash } from 'crypto';
import {
  CYCLE_STATES,
  createAwaitingCycle,
  openCycleFromEvent,
  closeCycleFromEvent,
  isOfficialConfidence
} from './consumable-lifecycle-engine.js';
import {
  findConsumableCycleByEvidence,
  getActiveConsumableCycle,
  saveConsumableCycle
} from './consumable-lifecycle-store.js';
import { recordConsumableRechargeObservation } from './consumable-lifecycle-observer.js';

function toNonNegativeCounter(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function stableCycleId(event) {
  const payload = [event.printerId, event.supplySlot, event.id].join('|');
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `ccyc-${digest}`;
}

function createOpenCycle(event, options = {}) {
  const cycle = openCycleFromEvent(event, null, options);
  const now = event.detectedAt || new Date().toISOString();
  return {
    ...cycle,
    id: stableCycleId(event),
    createdAt: now,
    updatedAt: now
  };
}

function createAwaitingCycleFromEvent(event) {
  const now = event.detectedAt || new Date().toISOString();
  return {
    ...createAwaitingCycle({
      printerId: event.printerId,
      supplySlot: event.supplySlot,
      supplyType: event.supplyType || 'unknown',
      sku: event.sku || null
    }),
    id: stableCycleId(event),
    confidence: event.confidence || null,
    startEvidenceId: event.id || null,
    createdAt: now,
    updatedAt: now
  };
}

function invalidateCycleAtEvent(cycle, event, reason) {
  const now = event.detectedAt || new Date().toISOString();
  return {
    ...cycle,
    status: CYCLE_STATES.INVALID,
    endPageCount: toNonNegativeCounter(event.pageCount),
    pagesProduced: null,
    yieldRatio: null,
    endedAt: now,
    endEvidenceId: event.id || null,
    invalidReason: reason,
    updatedAt: now
  };
}

export function advanceConsumableLifecycle(database, event = {}, options = {}) {
  if (!database) throw new TypeError('database is required');
  if (!event.id) throw new TypeError('event.id is required');
  if (!event.printerId) throw new TypeError('event.printerId is required');
  if (!event.supplySlot) throw new TypeError('event.supplySlot is required');

  const allowMedium = Boolean(options.allowMedium);

  if (!isOfficialConfidence(event.confidence, { allowMedium })) {
    return {
      action: 'evidence_only',
      official: false,
      previousCycle: null,
      activeCycle: getActiveConsumableCycle(database, event.printerId, event.supplySlot)
    };
  }

  const alreadyProcessed = findConsumableCycleByEvidence(database, event.id);
  if (alreadyProcessed) {
    return {
      action: 'already_processed',
      official: true,
      previousCycle: null,
      activeCycle: getActiveConsumableCycle(database, event.printerId, event.supplySlot),
      processedCycle: alreadyProcessed
    };
  }

  const active = getActiveConsumableCycle(database, event.printerId, event.supplySlot);
  // Historical evidence remains audit data, never a new operational cycle.
  const detectedAt = Date.parse(event.detectedAt), processedAt = Number(options.now ?? Date.now());
  const age = processedAt - detectedAt;
  const reason = !Number.isFinite(detectedAt) || !Number.isFinite(processedAt) ? 'invalid_evidence_time' :
    age < -30000 ? 'future_evidence' : age > 600000 ? 'historical_evidence' :
    active && detectedAt <= Date.parse(active.startedAt || active.createdAt) ? 'out_of_order_evidence' : null;
  if (reason) return { action: 'temporal_evidence_only', official: false, reason, previousCycle: null, activeCycle: active };
  const pageCount = toNonNegativeCounter(event.pageCount);
  const eventWithCounter = {
    ...event,
    pageCount
  };

  if (!active) {
    const next = pageCount === null
      ? createAwaitingCycleFromEvent(eventWithCounter)
      : createOpenCycle(eventWithCounter, { allowMedium });

    const saved = saveConsumableCycle(database, next);
    return {
      action: pageCount === null ? 'awaiting_baseline' : 'opened',
      official: true,
      previousCycle: null,
      activeCycle: saved
    };
  }

  if (active.status === CYCLE_STATES.OPEN) {
    if (pageCount === null) {
      const invalid = saveConsumableCycle(
        database,
        invalidateCycleAtEvent(active, eventWithCounter, 'missing_counter_at_recharge')
      );
      const awaiting = saveConsumableCycle(database, createAwaitingCycleFromEvent(eventWithCounter));
      return {
        action: 'invalidated_and_awaiting',
        official: true,
        previousCycle: invalid,
        activeCycle: awaiting
      };
    }

    const closedOrInvalid = saveConsumableCycle(
      database,
      closeCycleFromEvent(active, eventWithCounter, null, { allowMedium })
    );
    const next = saveConsumableCycle(
      database,
      createOpenCycle(eventWithCounter, { allowMedium })
    );

    return {
      action: closedOrInvalid.status === CYCLE_STATES.CLOSED
        ? 'closed_and_opened'
        : 'invalidated_and_opened',
      official: true,
      previousCycle: closedOrInvalid,
      activeCycle: next
    };
  }

  if (
    active.status === CYCLE_STATES.AWAITING_BASELINE ||
    active.status === CYCLE_STATES.UNOBSERVABLE
  ) {
    const reason = active.status === CYCLE_STATES.UNOBSERVABLE
      ? 'observability_restored_at_recharge'
      : 'baseline_unavailable_before_next_recharge';

    const invalid = saveConsumableCycle(
      database,
      invalidateCycleAtEvent(active, eventWithCounter, reason)
    );

    const next = pageCount === null
      ? createAwaitingCycleFromEvent(eventWithCounter)
      : createOpenCycle(eventWithCounter, { allowMedium });
    const savedNext = saveConsumableCycle(database, next);

    return {
      action: pageCount === null ? 'rotated_awaiting_baseline' : 'invalidated_and_opened',
      official: true,
      previousCycle: invalid,
      activeCycle: savedNext
    };
  }

  return {
    action: 'no_transition',
    official: true,
    previousCycle: active,
    activeCycle: null
  };
}

export function recordAndAdvanceConsumableLifecycle(database, input = {}, options = {}) {
  if (!database) throw new TypeError('database is required');

  database.exec('BEGIN IMMEDIATE');
  try {
    const observation = recordConsumableRechargeObservation(database, input);

    if (!observation.eligible || !observation.event) {
      database.exec('COMMIT');
      return {
        observation,
        lifecycle: {
          action: 'ignored',
          official: false,
          previousCycle: null,
          activeCycle: null
        }
      };
    }

    const lifecycle = advanceConsumableLifecycle(database, observation.event, options);
    database.exec('COMMIT');

    return {
      observation,
      lifecycle
    };
  } catch (err) {
    try {
      database.exec('ROLLBACK');
    } catch {}
    throw err;
  }
}
