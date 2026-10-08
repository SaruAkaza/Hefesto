export const CONSUMABLE_LIFECYCLE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS consumable_profiles (
    id TEXT PRIMARY KEY,
    model_pattern TEXT NOT NULL,
    supply_slot TEXT NOT NULL,
    supply_type TEXT NOT NULL DEFAULT 'unknown',
    sku TEXT,
    nominal_yield_pages INTEGER,
    nominal_yield_source TEXT,
    counter_semantics TEXT NOT NULL DEFAULT 'unknown',
    recharge_observability TEXT NOT NULL DEFAULT 'unknown',
    serial_observable INTEGER NOT NULL DEFAULT 0,
    level_observable INTEGER NOT NULL DEFAULT 0,
    confidence_policy TEXT NOT NULL DEFAULT 'high_only',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consumable_profiles_model_slot
    ON consumable_profiles(model_pattern, supply_slot);

  CREATE TABLE IF NOT EXISTS consumable_events (
    id TEXT PRIMARY KEY,
    printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    supply_slot TEXT NOT NULL,
    event_type TEXT NOT NULL,
    previous_level REAL,
    new_level REAL,
    previous_serial TEXT,
    new_serial TEXT,
    page_count INTEGER,
    sample_count INTEGER NOT NULL DEFAULT 1,
    confidence TEXT NOT NULL,
    evidence_json TEXT,
    detected_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consumable_events_printer_slot_time
    ON consumable_events(printer_id, supply_slot, detected_at);

  CREATE TABLE IF NOT EXISTS consumable_cycles (
    id TEXT PRIMARY KEY,
    printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    supply_slot TEXT NOT NULL,
    supply_type TEXT NOT NULL DEFAULT 'unknown',
    sku TEXT,
    status TEXT NOT NULL,
    confidence TEXT,
    start_page_count INTEGER,
    end_page_count INTEGER,
    pages_produced INTEGER,
    nominal_yield_pages INTEGER,
    yield_ratio REAL,
    started_at TEXT,
    ended_at TEXT,
    start_evidence_id TEXT,
    end_evidence_id TEXT,
    invalid_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consumable_cycles_printer_slot_time
    ON consumable_cycles(printer_id, supply_slot, started_at);
  CREATE INDEX IF NOT EXISTS idx_consumable_cycles_status
    ON consumable_cycles(status);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_consumable_cycles_active_slot
    ON consumable_cycles(printer_id, supply_slot)
    WHERE status IN ('awaiting_baseline', 'open', 'unobservable');
`;

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

function boolInt(value) {
  return value ? 1 : 0;
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function ensureConsumableLifecycleSchema(database) {
  required(database, 'database');
  database.exec(CONSUMABLE_LIFECYCLE_SCHEMA_SQL);
}

export function upsertConsumableProfile(database, profile = {}) {
  required(database, 'database');
  required(profile.id, 'profile.id');
  required(profile.modelPattern, 'profile.modelPattern');
  required(profile.supplySlot, 'profile.supplySlot');

  const now = profile.updatedAt || new Date().toISOString();
  const createdAt = profile.createdAt || now;

  database.prepare(`
    INSERT INTO consumable_profiles (
      id, model_pattern, supply_slot, supply_type, sku,
      nominal_yield_pages, nominal_yield_source, counter_semantics,
      recharge_observability, serial_observable, level_observable,
      confidence_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      model_pattern = excluded.model_pattern,
      supply_slot = excluded.supply_slot,
      supply_type = excluded.supply_type,
      sku = excluded.sku,
      nominal_yield_pages = excluded.nominal_yield_pages,
      nominal_yield_source = excluded.nominal_yield_source,
      counter_semantics = excluded.counter_semantics,
      recharge_observability = excluded.recharge_observability,
      serial_observable = excluded.serial_observable,
      level_observable = excluded.level_observable,
      confidence_policy = excluded.confidence_policy,
      updated_at = excluded.updated_at
  `).run(
    profile.id,
    profile.modelPattern,
    profile.supplySlot,
    profile.supplyType || 'unknown',
    profile.sku || null,
    profile.nominalYieldPages ?? null,
    profile.nominalYieldSource || null,
    profile.counterSemantics || 'unknown',
    profile.rechargeObservability || 'unknown',
    boolInt(profile.serialObservable),
    boolInt(profile.levelObservable),
    profile.confidencePolicy || 'high_only',
    createdAt,
    now
  );

  return getConsumableProfile(database, profile.id);
}

export function getConsumableProfile(database, id) {
  required(database, 'database');
  required(id, 'id');
  const row = database.prepare('SELECT * FROM consumable_profiles WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    modelPattern: row.model_pattern,
    supplySlot: row.supply_slot,
    supplyType: row.supply_type,
    sku: row.sku,
    nominalYieldPages: row.nominal_yield_pages,
    nominalYieldSource: row.nominal_yield_source,
    counterSemantics: row.counter_semantics,
    rechargeObservability: row.recharge_observability,
    serialObservable: Boolean(row.serial_observable),
    levelObservable: Boolean(row.level_observable),
    confidencePolicy: row.confidence_policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function recordConsumableEvent(database, event = {}) {
  required(database, 'database');
  required(event.id, 'event.id');
  required(event.printerId, 'event.printerId');
  required(event.supplySlot, 'event.supplySlot');
  required(event.eventType, 'event.eventType');
  required(event.confidence, 'event.confidence');

  const detectedAt = event.detectedAt || new Date().toISOString();
  const evidenceJson = event.evidence === undefined
    ? null
    : JSON.stringify(event.evidence);

  database.prepare(`
    INSERT INTO consumable_events (
      id, printer_id, supply_slot, event_type,
      previous_level, new_level, previous_serial, new_serial,
      page_count, sample_count, confidence, evidence_json, detected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.printerId,
    event.supplySlot,
    event.eventType,
    event.previousLevel ?? null,
    event.newLevel ?? null,
    event.previousSerial || null,
    event.newSerial || null,
    event.pageCount ?? null,
    event.sampleCount ?? 1,
    event.confidence,
    evidenceJson,
    detectedAt
  );

  return getConsumableEvent(database, event.id);
}

export function getConsumableEvent(database, id) {
  required(database, 'database');
  required(id, 'id');
  const row = database.prepare('SELECT * FROM consumable_events WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    printerId: row.printer_id,
    supplySlot: row.supply_slot,
    eventType: row.event_type,
    previousLevel: row.previous_level,
    newLevel: row.new_level,
    previousSerial: row.previous_serial,
    newSerial: row.new_serial,
    pageCount: row.page_count,
    sampleCount: row.sample_count,
    confidence: row.confidence,
    evidence: parseJson(row.evidence_json),
    detectedAt: row.detected_at
  };
}

export function saveConsumableCycle(database, cycle = {}) {
  required(database, 'database');
  required(cycle.id, 'cycle.id');
  required(cycle.printerId, 'cycle.printerId');
  required(cycle.supplySlot, 'cycle.supplySlot');
  required(cycle.status, 'cycle.status');

  const now = cycle.updatedAt || new Date().toISOString();
  const createdAt = cycle.createdAt || now;

  database.prepare(`
    INSERT INTO consumable_cycles (
      id, printer_id, supply_slot, supply_type, sku, status, confidence,
      start_page_count, end_page_count, pages_produced, nominal_yield_pages,
      yield_ratio, started_at, ended_at, start_evidence_id, end_evidence_id,
      invalid_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      supply_type = excluded.supply_type,
      sku = excluded.sku,
      status = excluded.status,
      confidence = excluded.confidence,
      start_page_count = excluded.start_page_count,
      end_page_count = excluded.end_page_count,
      pages_produced = excluded.pages_produced,
      nominal_yield_pages = excluded.nominal_yield_pages,
      yield_ratio = excluded.yield_ratio,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      start_evidence_id = excluded.start_evidence_id,
      end_evidence_id = excluded.end_evidence_id,
      invalid_reason = excluded.invalid_reason,
      updated_at = excluded.updated_at
  `).run(
    cycle.id,
    cycle.printerId,
    cycle.supplySlot,
    cycle.supplyType || 'unknown',
    cycle.sku || null,
    cycle.status,
    cycle.confidence || null,
    cycle.startPageCount ?? null,
    cycle.endPageCount ?? null,
    cycle.pagesProduced ?? null,
    cycle.nominalYieldPages ?? null,
    cycle.yieldRatio ?? null,
    cycle.startedAt || null,
    cycle.endedAt || null,
    cycle.startEvidenceId || null,
    cycle.endEvidenceId || null,
    cycle.invalidReason || null,
    createdAt,
    now
  );

  return getConsumableCycle(database, cycle.id);
}

export function getConsumableCycle(database, id) {
  required(database, 'database');
  required(id, 'id');
  const row = database.prepare('SELECT * FROM consumable_cycles WHERE id = ?').get(id);
  if (!row) return null;
  return mapCycle(row);
}

export function getActiveConsumableCycle(database, printerId, supplySlot) {
  required(database, 'database');
  required(printerId, 'printerId');
  required(supplySlot, 'supplySlot');
  const row = database.prepare(`
    SELECT * FROM consumable_cycles
    WHERE printer_id = ? AND supply_slot = ?
      AND status IN ('awaiting_baseline', 'open', 'unobservable')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(printerId, supplySlot);
  return row ? mapCycle(row) : null;
}

export function findConsumableCycleByEvidence(database, evidenceId) {
  required(database, 'database');
  required(evidenceId, 'evidenceId');
  const row = database.prepare(`
    SELECT * FROM consumable_cycles
    WHERE start_evidence_id = ? OR end_evidence_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).get(evidenceId, evidenceId);
  return row ? mapCycle(row) : null;
}

export function listConsumableCycles(database, printerId, supplySlot = null) {
  required(database, 'database');
  required(printerId, 'printerId');
  const rows = supplySlot
    ? database.prepare(`
        SELECT * FROM consumable_cycles
        WHERE printer_id = ? AND supply_slot = ?
        ORDER BY COALESCE(started_at, created_at) ASC
      `).all(printerId, supplySlot)
    : database.prepare(`
        SELECT * FROM consumable_cycles
        WHERE printer_id = ?
        ORDER BY COALESCE(started_at, created_at) ASC
      `).all(printerId);
  return rows.map(mapCycle);
}

function mapCycle(row) {
  return {
    id: row.id,
    printerId: row.printer_id,
    supplySlot: row.supply_slot,
    supplyType: row.supply_type,
    sku: row.sku,
    status: row.status,
    confidence: row.confidence,
    startPageCount: row.start_page_count,
    endPageCount: row.end_page_count,
    pagesProduced: row.pages_produced,
    nominalYieldPages: row.nominal_yield_pages,
    yieldRatio: row.yield_ratio,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    startEvidenceId: row.start_evidence_id,
    endEvidenceId: row.end_evidence_id,
    invalidReason: row.invalid_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
