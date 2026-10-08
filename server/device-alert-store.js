import { reconcileDeviceAlerts, alertIdentity } from './device-alerts.js';

export function ensureDeviceAlertSchema(db) {
  // No cascade: deleting/replacing an inventory entry must not erase evidence.
  db.exec(`CREATE TABLE IF NOT EXISTS device_alert_episodes (
    id TEXT PRIMARY KEY, printer_id TEXT NOT NULL, alert_key TEXT NOT NULL,
    active INTEGER NOT NULL CHECK(active IN (0,1)), first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL, resolved_at TEXT, payload_json TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_device_alert_active
    ON device_alert_episodes(printer_id, alert_key) WHERE active=1;
  CREATE INDEX IF NOT EXISTS idx_device_alert_history
    ON device_alert_episodes(printer_id, first_seen_at DESC, id);
  CREATE TABLE IF NOT EXISTS device_alert_state (
    printer_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL
  );`);
}

function readState(db, printerId) {
  const row = db.prepare('SELECT payload_json FROM device_alert_state WHERE printer_id=?').get(printerId);
  return row ? JSON.parse(row.payload_json) : null;
}
function activeAlerts(db, printerId) {
  return db.prepare('SELECT payload_json FROM device_alert_episodes WHERE printer_id=? AND active=1 ORDER BY first_seen_at,id')
    .all(printerId).map(row => JSON.parse(row.payload_json));
}

export function recordDeviceAlertSnapshot(db, { printerId, previousAlerts = [], ...input }) {
  db.exec('SAVEPOINT device_alert_snapshot');
  try {
    const previousState = readState(db, printerId);
    const existing = activeAlerts(db, printerId);
    // Preserve genuine cached evidence on the first observation after upgrade.
    // This imports active observations only, never inventing past resolutions.
    const legacy = previousState ? [] : previousAlerts.filter(a => a?.active && a.printerId === printerId && a.code)
      .map(a => ({ ...a, alertKey: a.alertKey || alertIdentity(a), legacyObservation: true }));
    const result = reconcileDeviceAlerts({ printerId, ...input, previousState, previousAlerts: existing.length ? existing : legacy });
    if (!result.ignored) {
      const save = db.prepare(`INSERT INTO device_alert_episodes VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET active=excluded.active,last_seen_at=excluded.last_seen_at,
          resolved_at=excluded.resolved_at,payload_json=excluded.payload_json`);
      const changed = new Map([...legacy, ...result.changed].map(a => [a.id, a]));
      for (const a of changed.values()) {
        // An existing unary event retains its original first detection.
        const old = db.prepare('SELECT payload_json FROM device_alert_episodes WHERE id=?').get(a.id);
        const next = old && a.eventKind === 'unary' ? { ...a, firstSeenAt: JSON.parse(old.payload_json).firstSeenAt } : a;
        save.run(next.id, printerId, next.alertKey || JSON.stringify([next.source, next.code]), Number(next.active),
          next.firstSeenAt, next.lastSeenAt, next.resolvedAt || null, JSON.stringify(next));
      }
      const { changed: _, alerts: __, ...state } = result;
      db.prepare(`INSERT INTO device_alert_state VALUES (?,?)
        ON CONFLICT(printer_id) DO UPDATE SET payload_json=excluded.payload_json`).run(printerId, JSON.stringify(state));
    }
    db.exec('RELEASE device_alert_snapshot');
    const { changed: _, ...report } = result;
    return { ...report, alertsReason: result.reason || null };
  } catch (error) {
    db.exec('ROLLBACK TO device_alert_snapshot'); db.exec('RELEASE device_alert_snapshot'); throw error;
  }
}

export function getPrinterAlertReport(db, printerId, { limit = 50, offset = 0 } = {}) {
  limit = Math.min(200, Math.max(1, Number.isSafeInteger(Number(limit)) ? Number(limit) : 50));
  offset = Math.max(0, Number.isSafeInteger(Number(offset)) ? Number(offset) : 0);
  const state = readState(db, printerId) || { alertsAvailable: false, reason: 'missing_alert_evidence',
    diagnostic: { state: 'unknown', lastKnownState: 'unknown', current: false, coverage: 'partial' }, sources: {} };
  const history = db.prepare(`SELECT payload_json FROM device_alert_episodes WHERE printer_id=?
    ORDER BY first_seen_at DESC,id DESC LIMIT ? OFFSET ?`).all(printerId, limit, offset).map(row => JSON.parse(row.payload_json));
  const total = db.prepare('SELECT count(*) AS total FROM device_alert_episodes WHERE printer_id=?').get(printerId).total;
  return { ...state, alertsReason: state.reason || null, alerts: activeAlerts(db, printerId), history, total, limit, offset };
}
