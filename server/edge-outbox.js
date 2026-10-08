import { createHash } from 'node:crypto';
import * as db from './db.js';

// Canonical payload hash makes a repeated ID immutable regardless of JSON key order.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function processEdgeOutbox({ edgeUnitId, edgeUnitName, events = [] }) {
  const database = db.getDb();
  const acknowledgedOutboxIds = [], rejectedOutbox = [];
  for (const event of events) {
    let savepoint = false;
    try {
      if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 200) throw new Error('invalid_event_id');
      const type = event.eventType;
      if (!['recharge', 'recharge_registered', 'replenishment', 'replenishment_created', 'replenishment_updated'].includes(type)) throw new Error('unsupported_event_type');
      const payload = event.payload;
      if (!payload || typeof payload.id !== 'string' || !payload.id || !payload.printerId || !payload.supplyName) throw new Error('invalid_payload');
      const printer = db.getPrinterById(payload.printerId);
      if (!printer || !edgeUnitId || printer.unitId !== edgeUnitId) throw new Error('printer_outside_unit');
      const hash = createHash('sha256').update(JSON.stringify(canonical({ type, payload }))).digest('hex');
      const receipt = database.prepare('SELECT payload_hash FROM edge_sync_receipts WHERE unit_id=? AND event_id=?').get(edgeUnitId, event.id);
      if (receipt) {
        if (receipt.payload_hash !== hash) throw new Error('event_id_conflict');
        acknowledgedOutboxIds.push(event.id); continue;
      }
      database.exec('SAVEPOINT receive_edge_event'); savepoint = true;
      if (type.startsWith('recharge')) {
        if (!Number.isFinite(payload.newLevel) || payload.newLevel < 0 || payload.newLevel > 100 || (payload.pageCount != null && (!Number.isSafeInteger(payload.pageCount) || payload.pageCount < 0))) throw new Error('invalid_recharge');
        const existing = database.prepare('SELECT * FROM recharges WHERE id=?').get(payload.id);
        if (existing) {
          if (existing.printer_id !== payload.printerId || existing.supply_name !== payload.supplyName || existing.page_count !== payload.pageCount || existing.new_level !== payload.newLevel || existing.previous_level !== (payload.previousLevel ?? null) || (payload.timestamp && existing.timestamp !== payload.timestamp)) throw new Error('entity_id_conflict');
        } else if (!db.recordRecharge({ ...payload, unitName: edgeUnitName }, { suppressSync: true })) {
          throw new Error('recharge_rejected_by_validation');
        }
      } else {
        const existing = db.getReplenishmentById(payload.id);
        if (existing && existing.printerId !== payload.printerId) throw new Error('entity_id_conflict');
        db.saveReplenishment(payload, { suppressSync: true });
      }
      database.prepare('INSERT INTO edge_sync_receipts (unit_id,event_id,payload_hash,received_at) VALUES (?,?,?,?)')
        .run(edgeUnitId, event.id, hash, new Date().toISOString());
      database.exec('RELEASE receive_edge_event'); savepoint = false;
      acknowledgedOutboxIds.push(event.id);
    } catch (error) {
      if (savepoint) { database.exec('ROLLBACK TO receive_edge_event'); database.exec('RELEASE receive_edge_event'); }
      rejectedOutbox.push({ id: event?.id ?? null, error: error.message });
    }
  }
  return { acknowledgedOutboxIds, rejectedOutbox };
}
