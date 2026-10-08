import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as db from '../db.js';
import { app, processSinglePrinterTelemetry } from '../server.js';
import { createSession, revokeSession } from '../auth.js';

function fixture(t) {
  db.initDatabase({ inMemory: true, skipSeeds: true }); t.after(() => db.closeDatabase());
  db.saveUnit({ id: 'diag-unit', name: 'Teste' });
  db.savePrinter({ id: 'diag-printer', name: 'Test', unitId: 'diag-unit', unitName: 'Teste', ip: '127.0.0.12' });
  return db.getPrinterById('diag-printer');
}
const telemetry = () => ({ online: true, protocol: 'SNMP v2c', info: { model: 'Test', pageCount: null },
  status: { errorState: [4], deviceCode: 2, printerCode: 3 }, supplies: [], trays: [] });
async function listen(t) {
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('real collection pipeline persists internal errors separately from connectivity and retains them on failure', async t => {
  const printer = fixture(t);
  const entry = await processSinglePrinterTelemetry(printer, { query: async () => telemetry() });
  assert.equal(entry.online, true); assert.equal(entry.health.state, 'ok'); assert.equal(entry.diagnostic.state, 'error');
  assert.equal(db.getPrinterAlertReport(printer.id).alerts.length, 1);
  const error = await processSinglePrinterTelemetry(printer, { query: async () => { throw new Error('timed out'); } });
  assert.equal(error.diagnostic.current, false); assert.equal(error.alerts[0].id, entry.alerts[0].id);
  assert.equal(db.getCachedStatus(printer.id).alerts[0].id, entry.alerts[0].id);
  assert.equal(db.getPrinterAlertReport(printer.id).history[0].resolvedAt, undefined);
});
test('authenticated alert API enforces unit scope, pagination and stale-observation semantics', async t => {
  const printer = fixture(t); await processSinglePrinterTelemetry(printer, { query: async () => telemetry() });
  const base = await listen(t), url = `${base}/api/printers/${printer.id}/alerts`;
  const admin = createSession({ username: 'test', role: 'admin' });
  const foreign = createSession({ username: 'foreign', role: 'operator', unitId: 'other' });
  const own = createSession({ username: 'own', role: 'operator', unitId: 'diag-unit' });
  t.after(() => [admin, foreign, own].forEach(s => revokeSession(s.token)));
  const request = (token, suffix = '') => fetch(url + suffix, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  assert.equal((await request()).status, 401); assert.equal((await request(foreign.token)).status, 403);
  const response = await request(own.token, '?limit=999&offset=-1'); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.limit, 200); assert.equal(body.offset, 0);
  assert.equal(body.history.length, 1); assert.equal(body.diagnostic.state, 'error');
  const old = JSON.parse(db.getDb().prepare('SELECT payload_json FROM device_alert_state WHERE printer_id=?').get(printer.id).payload_json);
  old.observedAt = '2020-01-01T00:00:00.000Z';
  db.getDb().prepare('UPDATE device_alert_state SET payload_json=? WHERE printer_id=?').run(JSON.stringify(old), printer.id);
  const stale = await (await request(admin.token)).json();
  assert.equal(stale.alertsAvailable, false); assert.equal(stale.diagnostic.state, 'unknown'); assert.equal(stale.alerts.length, 1);
});
test('inventory deletion preserves alert evidence without resurrecting the printer', t => {
  const printer = fixture(t); db.recordDeviceAlertSnapshot({ printerId: printer.id, telemetry: telemetry() });
  db.deletePrinter(printer.id); assert.equal(db.getPrinterById(printer.id), null);
  assert.equal(db.getPrinterAlertReport(printer.id).total, 1);
});
test('alert API projects documented guidance onto persisted observations without rewriting their evidence', async t => {
  const printer = fixture(t);
  const data = { ...telemetry(), info: { model: 'Lexmark XM3350', firmware: 'TEST.1' }, status: { errorState: [0] },
    alerts: [{ source: 'lexmark_ews', code: 'lexmark_isw_231_9', rawCode: '72.01', message: 'SMTP server not configured [72.01]',
      severity: 'critical', interpretationStatus: 'not_catalogued' }], alertSources: { lexmark_ews: { available: true, complete: true } } };
  await processSinglePrinterTelemetry(printer, { query: async () => data });
  const original = db.getPrinterAlertReport(printer.id), base = await listen(t);
  const session = createSession({ username: 'test', role: 'admin' }); t.after(() => revokeSession(session.token));
  const body = await (await fetch(`${base}/api/printers/${printer.id}/alerts`, { headers: { Authorization: `Bearer ${session.token}` } })).json();
  assert.equal(body.catalogVersion, '1.0.0'); assert.equal(body.alerts[0].knowledge.status, 'code_documented');
  assert.equal(body.history[0].knowledge.model, 'XM3350');
  assert.equal(body.alerts[0].id, original.alerts[0].id); assert.equal(body.alerts[0].severity, 'critical');
  assert.deepEqual(db.getPrinterAlertReport(printer.id), original);
});
