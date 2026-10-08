import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as db from '../db.js';
import { app } from '../server.js';
import { triggerEdgeSync } from '../edge-sync-service.js';
import { DeviceAlertStore } from '../device-alerts.js';

function fixture(t) {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  db.saveUnit({ id: 'u1', name: 'Filial' });
  db.saveUnit({ id: 'u2', name: 'Outra' });
  db.savePrinter({ id: 'p1', name: 'Impressora', ip: '127.0.0.10', unitId: 'u1', unitName: 'Filial' });
  db.savePrinter({ id: 'p2', name: 'Outra', ip: '127.0.0.11', unitId: 'u2', unitName: 'Outra' });
  const oldSecret = process.env.HUB_SYNC_SECRET;
  process.env.HUB_SYNC_SECRET = 'test-hub-secret';
  t.after(() => { db.closeDatabase(); if (oldSecret === undefined) delete process.env.HUB_SYNC_SECRET; else process.env.HUB_SYNC_SECRET = oldSecret; });
}
async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const event = (id, printerId = 'p1') => ({ id: `out-${id}`, eventType: 'recharge', payload: {
  id, printerId, printerName: 'Impressora', supplyName: 'Black Toner', previousLevel: 5, newLevel: 100, pageCount: 500, timestamp: '2026-10-01T00:00:00Z'
} });
async function post(base, body) {
  const response = await fetch(`${base}/api/edge/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-edge-token': 'test-hub-secret' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
test('Hub persists historical outbox events omitted by the recent snapshot and acknowledges exact IDs', async t => {
  fixture(t); const base = await listen(t, app);
  const body = { edgeUnitId: 'u1', edgeUnitName: 'Filial', outbox: [event('old-recharge')] };
  const first = await post(base, body);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.acknowledgedOutboxIds, ['out-old-recharge']);
  assert.equal(db.getRecharges().length, 1);
  const duplicate = await post(base, body);
  assert.deepEqual(duplicate.body.acknowledgedOutboxIds, ['out-old-recharge']);
  assert.equal(db.getRecharges().length, 1);
  body.outbox[0].payload.pageCount = 800;
  const conflicting = await post(base, body);
  assert.deepEqual(conflicting.body.acknowledgedOutboxIds, []);
  assert.equal(db.getRecharges()[0].pageCount, 500);
});
test('Hub rejects foreign-unit and unknown outbox events without persisting or acknowledging them', async t => {
  fixture(t); const base = await listen(t, app);
  const result = await post(base, { edgeUnitId: 'u1', edgeUnitName: 'Filial', outbox: [event('foreign', 'p2'), { ...event('unsupported'), eventType: 'unknown' }] });
  assert.deepEqual(result.body.acknowledgedOutboxIds, []);
  assert.equal(result.body.rejectedOutbox.length, 2);
  assert.equal(db.getRecharges().length, 0);
});
test('Edge retains unacknowledged events even on HTTP 200 and scopes the batch to its unit', async t => {
  fixture(t);
  const own = db.addToSyncOutbox('recharge', event('one').payload);
  const other = db.addToSyncOutbox('recharge', event('two', 'p2').payload);
  let received;
  const base = await listen(t, (req, res) => { let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => { received = JSON.parse(raw); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true })); }); });
  const result = await triggerEdgeSync({ hubUrl: base, hubToken: 'test', edgeUnitId: 'u1', edgeUnitName: 'Filial' });
  assert.equal(result.success, false);
  assert.deepEqual(received.outbox.map(x => x.id), [own]);
  assert.equal(db.getPendingSyncOutbox().length, 2);
  assert.equal(db.getPendingSyncOutbox().find(x => x.id === other).attempts, 0);
});
test('Edge completes only acknowledged IDs; retries never make pending data disappear', async t => {
  fixture(t);
  const first = db.addToSyncOutbox('recharge', event('one').payload);
  const second = db.addToSyncOutbox('recharge', event('two').payload);
  const base = await listen(t, (req, res) => { req.resume(); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, acknowledgedOutboxIds: [first] })); }); });
  const result = await triggerEdgeSync({ hubUrl: base, hubToken: 'test', edgeUnitId: 'u1', edgeUnitName: 'Filial' });
  assert.equal(result.success, false);
  assert.deepEqual(db.getPendingSyncOutbox().map(x => x.id), [second]);
  for (let i = 0; i < 12; i++) db.recordSyncOutboxError(second, 'Hub unavailable');
  assert.deepEqual(db.getPendingSyncOutbox().map(x => x.id), [second]);
});
test('missing hardware error data cannot resolve an existing jam or claim clean telemetry', () => {
  const store = new DeviceAlertStore();
  store.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true, status: { errorState: Buffer.from([4]) } } });
  const missing = store.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true, protocol: 'SNMP v2c' } });
  assert.equal(missing.alertsAvailable, false);
  assert.equal(missing.alerts[0].code, 'paper_jam');
  const cleared = store.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true, status: { errorState: [0] } } });
  assert.equal(cleared.alertsAvailable, true); assert.equal(cleared.alerts.length, 0);
});
test('hardware error bytes survive JSON transport and alert recurrence clears stale resolution', () => {
  const store = new DeviceAlertStore();
  const telemetry = JSON.parse(JSON.stringify({ online: true, status: { errorState: Buffer.from([4]) } }));
  const detected = store.syncTelemetryAlerts({ printerId: 'p', telemetry, observedAt: '2026-10-01T00:00:00Z' });
  assert.equal(detected.alerts[0]?.code, 'paper_jam');
  store.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true, status: { errorState: [0] } } });
  const recurring = store.syncTelemetryAlerts({ printerId: 'p', telemetry });
  assert.equal(recurring.alerts[0].resolvedAt, undefined);
});

test('event and receipt roll back together if the receipt write fails', async t => {
  fixture(t); const base = await listen(t, app);
  db.getDb().exec("CREATE TRIGGER refuse_receipt BEFORE INSERT ON edge_sync_receipts BEGIN SELECT RAISE(ABORT, 'receipt unavailable'); END;");
  const result = await post(base, { edgeUnitId: 'u1', edgeUnitName: 'Filial', outbox: [event('receipt-failure')] });
  assert.deepEqual(result.body.acknowledgedOutboxIds, []);
  assert.equal(db.getRecharges().length, 0);
});
test('Edge recording a recharge or replenishment is atomic with its outbox entry', t => {
  fixture(t); const oldMode = process.env.APP_MODE; process.env.APP_MODE = 'edge';
  t.after(() => { if (oldMode === undefined) delete process.env.APP_MODE; else process.env.APP_MODE = oldMode; });
  db.getDb().exec("CREATE TRIGGER refuse_outbox BEFORE INSERT ON edge_sync_outbox BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;");
  assert.throws(() => db.recordRecharge(event('atomic').payload), /outbox unavailable/);
  assert.equal(db.getRecharges().length, 0);
  assert.throws(() => db.saveReplenishment({ id: 'rep', printerId: 'p1', supplyName: 'Toner' }), /outbox unavailable/);
  assert.equal(db.getReplenishments().length, 0);
});
test('120 historical Edge recharges drain through acknowledged batches without the recent-100 limit', async t => {
  fixture(t); const oldMode = process.env.APP_MODE; process.env.APP_MODE = 'edge';
  t.after(() => { if (oldMode === undefined) delete process.env.APP_MODE; else process.env.APP_MODE = oldMode; });
  for (let i = 1; i <= 120; i++) db.recordRecharge({ ...event(`r-${i}`).payload, pageCount: i * 100, timestamp: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() });
  assert.equal(db.getPendingSyncOutbox(200).length, 120);
  const delivered = new Set(); let largestSnapshot = 0;
  const base = await listen(t, (req, res) => { let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => {
    const payload = JSON.parse(raw); payload.outbox.forEach(x => delivered.add(x.payload.id)); largestSnapshot = Math.max(largestSnapshot, payload.recharges.length);
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, acknowledgedOutboxIds: payload.outbox.map(x => x.id) }));
  }); });
  for (let i = 0; i < 3; i++) assert.equal((await triggerEdgeSync({ hubUrl: base, hubToken: 'test', edgeUnitId: 'u1', edgeUnitName: 'Filial' })).success, true);
  assert.equal(largestSnapshot, 100); assert.equal(delivered.size, 120); assert.equal(db.getPendingSyncOutbox().length, 0);
});
test('foreign acknowledgement cannot complete a local event', async t => {
  fixture(t); const id = db.addToSyncOutbox('recharge', event('ack-mismatch').payload);
  const base = await listen(t, (req, res) => { req.resume(); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, acknowledgedOutboxIds: ['foreign-id'] })); }); });
  assert.equal((await triggerEdgeSync({ hubUrl: base, hubToken: 'test', edgeUnitId: 'u1', edgeUnitName: 'Filial' })).success, false);
  assert.deepEqual(db.getPendingSyncOutbox().map(x => x.id), [id]);
});
test('cache round-trip preserves SNMP alert evidence and protocol across a reboot', t => {
  fixture(t);
  const data = { online: true, protocol: 'SNMP v2c', status: { printerCode: 3, errorState: [4] }, alertsAvailable: true, alerts: [{ code: 'paper_jam' }], info: { pageCount: 0 }, supplies: [] };
  db.updateCachedStatus('p1', data);
  const cached = db.getAllCachedStatuses().get('p1');
  assert.deepEqual(cached.status.errorState, [4]); assert.equal(cached.protocol, 'SNMP v2c'); assert.equal(cached.alertsAvailable, true);
  assert.equal(cached.info.pageCount, 0);
  const store = new DeviceAlertStore();
  assert.equal(store.syncTelemetryAlerts({ printerId: 'p1', telemetry: cached }).alerts[0].code, 'paper_jam');
  db.updateCachedStatus('p1', { ...data, online: false });
  assert.equal(db.getCachedStatus('p1').alertsAvailable, false);
});
test('rejected events wait for retry while newer valid data can leave the outbox', async t => {
  fixture(t);
  for (let i = 0; i < 50; i++) {
    const id = db.addToSyncOutbox('unknown', event(`bad-${i}`).payload);
    db.getDb().prepare('UPDATE edge_sync_outbox SET created_at=? WHERE id=?').run('2026-01-01T00:00:00Z', id);
  }
  const valid = db.addToSyncOutbox('recharge', event('valid').payload);
  const sent = [];
  const base = await listen(t, (req, res) => { let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => {
    const payload = JSON.parse(raw); sent.push(payload.outbox.map(x => x.id));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, acknowledgedOutboxIds: payload.outbox.filter(x => x.eventType === 'recharge').map(x => x.id) }));
  }); });
  const params = { hubUrl: base, hubToken: 'test', edgeUnitId: 'u1', edgeUnitName: 'Filial' };
  assert.equal((await triggerEdgeSync(params)).success, false);
  assert.equal((await triggerEdgeSync(params)).success, true);
  assert.deepEqual(sent[1], [valid]); assert.equal(db.getPendingSyncOutbox().length, 50);
});
test('restored hardware alerts remain visible when the first poll after reboot has no evidence', () => {
  const first = new DeviceAlertStore();
  const result = first.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true, status: { errorState: [4] } } });
  const restarted = new DeviceAlertStore(); restarted.restorePrinterAlerts('p', JSON.parse(JSON.stringify(result.alerts)));
  const unknown = restarted.syncTelemetryAlerts({ printerId: 'p', telemetry: { online: true } });
  assert.equal(unknown.alertsAvailable, false); assert.equal(unknown.alerts[0].code, 'paper_jam');
});
