import snmp from 'net-snmp';

export const ALERT_ENTRY_OID = '1.3.6.1.2.1.43.18.1.1';
export const ALERT_COUNTER_OID = '1.3.6.1.2.1.43.5.1.1.19.1';
const UPTIME_OID = '1.3.6.1.2.1.1.3.0';
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 4294967295;
const standardCodes = {
  3: 'cover_open', 8: 'paper_jam', 501: 'door_open',
  801: 'input_tray_missing', 807: 'paper_low', 808: 'paper_empty',
  903: 'output_tray_full'
};

export function parsePrinterMibAlerts(values, { deviceIndex = 1, complete = true, counter = null } = {}) {
  const rows = new Map();
  let malformed = false;
  for (const [oid, value] of Object.entries(values)) {
    const parts = oid.slice(ALERT_ENTRY_OID.length + 1).split('.').map(Number);
    if (!oid.startsWith(ALERT_ENTRY_OID + '.') || parts.length !== 3 || !parts.every(Number.isInteger)) { malformed = true; continue; }
    const [column, device, row] = parts;
    if (device !== deviceIndex) continue;
    if (column < 1 || column > 9 || row <= 0) { malformed = true; continue; }
    if (!rows.has(row)) rows.set(row, {});
    rows.get(row)[column] = value;
  }
  const alerts = [];
  for (const [rowIndex, row] of rows) {
    // Missing or invalid columns make the snapshot incomplete, not healthy.
    if (![1, 3, 4, 5].includes(row[2]) || !Number.isInteger(row[7]) || row[7] < 1 ||
        ![4, 5, 6].every(c => Number.isInteger(row[c])) || !uint32(row[9]) ||
        !(Buffer.isBuffer(row[8]) || typeof row[8] === 'string')) { malformed = true; continue; }
    const message = Buffer.isBuffer(row[8]) ? row[8].toString('utf8').replace(/\0/g, '').trim() : row[8];
    const code = standardCodes[row[7]] || 'unknown_alert';
    alerts.push({ source: 'prt_alert_table', code, rawCode: row[7], message,
      severity: row[2] === 3 ? 'critical' : row[2] === 1 ? 'info' : 'warning',
      rawSeverity: row[2], eventKind: row[2] === 4 ? 'unary' : 'binary',
      interpretationStatus: code === 'unknown_alert' ? 'not_catalogued' : 'standard',
      component: { group: row[4], index: row[5], location: row[6] },
      deviceIndex, rowIndex, deviceTimeTicks: row[9], trainingLevel: row[3] ?? null });
  }
  const supported = rows.size > 0 || uint32(counter);
  const available = supported && complete && !malformed;
  return { alerts, source: { available, complete: available, partial: alerts.length > 0 && !available,
    reason: !complete ? 'incomplete_walk' : malformed ? 'malformed_rows' : supported ? null : 'unsupported_or_empty_unknown' } };
}

// Optional work is bounded independently of supplies and connectivity.
export async function readPrinterMibAlerts(session, getOids) {
  const startedAt = Date.now();
  const [walk, scalar] = await Promise.all([
    new Promise(resolve => {
      const values = {};
      let complete = true, count = 0;
      try {
        session.subtree(ALERT_ENTRY_OID, varbinds => {
          for (const vb of varbinds) {
            if (++count > 900 || Date.now() - startedAt > 2500) { complete = false; return true; }
            if (snmp.isVarbindError(vb)) complete = false;
            else values[vb.oid] = vb.value;
          }
        }, error => resolve({ values, complete: complete && !error }));
      } catch { resolve({ values, complete: false }); }
    }),
    getOids(session, [ALERT_COUNTER_OID, UPTIME_OID]).catch(() => ({}))
  ]);
  // A changing event counter proves the table mutated while it was being read.
  // Keep positive rows but postpone clearing conditions until a stable snapshot.
  if (walk.complete && uint32(scalar[ALERT_COUNTER_OID])) {
    const after = await getOids(session, [ALERT_COUNTER_OID]).catch(() => ({}));
    if (after[ALERT_COUNTER_OID] !== scalar[ALERT_COUNTER_OID]) walk.complete = false;
  }
  const result = parsePrinterMibAlerts(walk.values, { complete: walk.complete, counter: scalar[ALERT_COUNTER_OID] });
  return { ...result, deviceUptime: uint32(scalar[UPTIME_OID]) ? scalar[UPTIME_OID] : null };
}
