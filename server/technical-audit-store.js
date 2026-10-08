import { randomUUID } from 'node:crypto';
import { TECHNICAL_ACTIONS } from './technical-diagnostics.js';

export function ensureTechnicalAuditSchema(db) {
  // No foreign-key cascade: asset removal must not erase its technical history.
  db.exec(`CREATE TABLE IF NOT EXISTS technical_interventions (
    id TEXT PRIMARY KEY, printer_id TEXT NOT NULL, actor TEXT NOT NULL, request_id TEXT NOT NULL,
    started_at TEXT NOT NULL, payload_json TEXT NOT NULL, UNIQUE(printer_id,actor,request_id)
  );
  CREATE INDEX IF NOT EXISTS idx_technical_printer ON technical_interventions(printer_id,started_at DESC);
  CREATE TABLE IF NOT EXISTS technical_intervention_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, intervention_id TEXT NOT NULL, printer_id TEXT NOT NULL,
    actor TEXT NOT NULL, request_id TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL,
    payload_json TEXT NOT NULL, UNIQUE(intervention_id,actor,request_id)
  );
  CREATE INDEX IF NOT EXISTS idx_technical_events ON technical_intervention_events(printer_id,intervention_id,seq);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_technical_outcome ON technical_intervention_events(intervention_id) WHERE kind='outcome';
  CREATE TRIGGER IF NOT EXISTS technical_interventions_no_update BEFORE UPDATE ON technical_interventions BEGIN SELECT RAISE(ABORT,'Technical audit is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS technical_interventions_no_delete BEFORE DELETE ON technical_interventions BEGIN SELECT RAISE(ABORT,'Technical audit is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS technical_events_no_update BEFORE UPDATE ON technical_intervention_events BEGIN SELECT RAISE(ABORT,'Technical audit is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS technical_events_no_delete BEFORE DELETE ON technical_intervention_events BEGIN SELECT RAISE(ABORT,'Technical audit is append-only'); END;`);
}
function field(value, name, max, required = false) {
  if (value != null && typeof value !== 'string') throw new TypeError(`${name}: texto inválido.`);
  const s = (value || '').trim(); if (s.length > max || (required && !s)) throw new TypeError(`${name}: preenchimento inválido.`);
  return s || null;
}
function requestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) throw new TypeError('Identificador da solicitação inválido.');
  return value;
}
export function getTechnicalIntervention(db, id) {
  const row = db.prepare('SELECT payload_json FROM technical_interventions WHERE id=?').get(id);
  if (!row) return null;
  const events = db.prepare('SELECT payload_json FROM technical_intervention_events WHERE intervention_id=? ORDER BY seq').all(id).map(r => JSON.parse(r.payload_json));
  return project(JSON.parse(row.payload_json), events);
}
function project(record, events) {
  return { ...record, events, outcome: [...events].reverse().find(e => e.kind === 'outcome') || null,
    verification: [...events].reverse().find(e => e.kind === 'verification') || null };
}
export function startTechnicalIntervention(db, { printer, snapshot, input, actor, now = Date.now() }) {
  if (!Object.hasOwn(TECHNICAL_ACTIONS, input.action)) throw new TypeError('Ação técnica inválida.');
  const reason = field(input.reason, 'Motivo', 500, true), ticket = field(input.ticket, 'Chamado', 80);
  const key = requestId(input.requestId), username = field(actor, 'Usuário', 100, true);
  const existing = db.prepare('SELECT id,payload_json FROM technical_interventions WHERE printer_id=? AND actor=? AND request_id=?').get(printer.id, username, key);
  if (existing) {
    const previous = JSON.parse(existing.payload_json);
    if (previous.action !== input.action || previous.reason !== reason || previous.ticket !== ticket) throw Object.assign(new Error('Solicitação já usada para outra intervenção.'), { status: 409 });
    return { record: getTechnicalIntervention(db, existing.id), duplicate: true };
  }
  const record = { id: randomUUID(), printerId: printer.id, printerName: printer.name,
    serialNumber: snapshot.identity.serialNumber, unitId: printer.unitId || null, unitName: printer.unitName || null,
    actor: username, action: input.action, actionLabel: TECHNICAL_ACTIONS[input.action], reason, ticket,
    startedAt: new Date(now).toISOString(), origin: 'hefesto_manual_record', before: snapshot,
    equipmentCommandExecuted: false };
  db.prepare('INSERT INTO technical_interventions VALUES (?,?,?,?,?,?)').run(record.id, printer.id, username, key, record.startedAt, JSON.stringify(record));
  return { record: project(record, []), duplicate: false };
}
export function appendTechnicalEvent(db, { record, actor, request, kind, snapshot, comparison, now = Date.now() }) {
  const key = requestId(request.requestId), username = field(actor, 'Usuário', 100, true);
  const previous = db.prepare('SELECT payload_json FROM technical_intervention_events WHERE intervention_id=? AND actor=? AND request_id=?').get(record.id, username, key);
  const outcome = kind === 'outcome' ? request.result : null, note = field(request.note, 'Observação', 1000);
  if (!['outcome', 'verification'].includes(kind) || (kind === 'outcome' && !['performed', 'failed', 'cancelled'].includes(outcome))) throw new TypeError('Resultado técnico inválido.');
  if (previous) {
    const e = JSON.parse(previous.payload_json);
    if (e.kind !== kind || e.result !== outcome || e.note !== note) throw Object.assign(new Error('Solicitação já registrada com outro resultado.'), { status: 409 });
    return { record: getTechnicalIntervention(db, record.id), duplicate: true };
  }
  // Exactly one declared outcome; retries and concurrent submissions cannot contradict it.
  if (kind === 'outcome' && record.outcome) throw Object.assign(new Error('Intervenção já possui resultado declarado.'), { status: 409 });
  if (kind === 'verification' && getTechnicalIntervention(db, record.id)?.outcome?.result !== 'performed') throw Object.assign(new Error('Declare a intervenção realizada antes de verificar a telemetria.'), { status: 409 });
  const event = { id: randomUUID(), kind, actor: username, at: new Date(now).toISOString(), origin: 'hefesto_manual_record',
    result: outcome, note, after: snapshot, comparison, equipmentCommandExecuted: false };
  db.prepare('INSERT INTO technical_intervention_events (intervention_id,printer_id,actor,request_id,kind,created_at,payload_json) VALUES (?,?,?,?,?,?,?)')
    .run(record.id, record.printerId, username, key, kind, event.at, JSON.stringify(event));
  return { record: getTechnicalIntervention(db, record.id), duplicate: false };
}
export function replayTechnicalEvent(db, { record, actor, request, kind }) {
  requestId(request.requestId); field(request.note, 'Observação', 1000);
  const previous = db.prepare('SELECT payload_json FROM technical_intervention_events WHERE intervention_id=? AND actor=? AND request_id=?').get(record.id, actor, request.requestId);
  if (!previous) return null;
  const event = JSON.parse(previous.payload_json);
  if (event.kind !== kind || event.note !== field(request.note, 'Observação', 1000) || event.result !== (kind === 'outcome' ? request.result : null)) {
    throw Object.assign(new Error('Solicitação já registrada com outro resultado.'), { status: 409 });
  }
  return { record: getTechnicalIntervention(db, record.id), duplicate: true };
}
export function listTechnicalInterventions(db, printerId, { limit = 30, offset = 0 } = {}) {
  limit = Math.min(100, Math.max(1, Number.isSafeInteger(Number(limit)) ? Number(limit) : 30));
  offset = Math.max(0, Number.isSafeInteger(Number(offset)) ? Number(offset) : 0);
  const rows = db.prepare('SELECT id,payload_json FROM technical_interventions WHERE printer_id=? ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?').all(printerId, limit, offset);
  const events = rows.length ? db.prepare(`SELECT intervention_id,payload_json FROM technical_intervention_events WHERE intervention_id IN (${rows.map(() => '?').join(',')}) ORDER BY seq`).all(...rows.map(r => r.id)) : [];
  const grouped = new Map(); for (const e of events) { if (!grouped.has(e.intervention_id)) grouped.set(e.intervention_id, []); grouped.get(e.intervention_id).push(JSON.parse(e.payload_json)); }
  return { limit, offset, total: db.prepare('SELECT COUNT(*) AS total FROM technical_interventions WHERE printer_id=?').get(printerId).total,
    records: rows.map(r => project(JSON.parse(r.payload_json), grouped.get(r.id) || [])) };
}
