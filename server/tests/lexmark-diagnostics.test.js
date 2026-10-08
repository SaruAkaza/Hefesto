import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parseLexmarkStatus, parseLexmarkDeviceInformation, readLexmarkEws,
  lexmarkDiagnosticsFromDocuments, enrichLexmarkDiagnostics } from '../lexmark-diagnostics.js';
import { queryLexmarkHttpFallback } from '../snmp-service.js';
import { ensureDeviceAlertSchema, recordDeviceAlertSnapshot, getPrinterAlertReport } from '../device-alert-store.js';

// Minimal, de-identified shape observed on an XM3250 EWS. No operational DB fixtures.
const info = () => ({ nodes: { nodes: {
  SerialNumberLxk: { setting: 346 }, TotalPageCount: { setting: 8193 },
  BaseRevision: { reportValue: 'MXTGM.240.229' }, FirmwareDate: { reportValue: '04-Apr-25 22:38' }
}, settings: { 346: { val: 'TEST000000001' }, 8193: { val: 12000 } } } });
const rows = () => [
  { id: '231', type: 'action', IrTitle: 'continue [72.01]', actionName: 'continue' },
  { id: 231, concurrency: 9, type: 'ir', IrTitle: 'E-mail servidor SMTP não configurado. [72.01] ', uniqueId: '3' },
  { id: 24, concurrency: 8, type: 'warning', IrTitle: 'Cartucho Baixo ', npaTriplet: '08.01.04' },
  { id: 68, concurrency: 8, type: 'status', IrTitle: 'Pronta ' }
];
const docs = (status = rows(), device = info()) => ({ documents: {
  '/webglue/isw/status': { text: JSON.stringify(status) },
  '/webglue/webui/nodedata/DeviceInformation/?depth=10&fromReport=true': { text: JSON.stringify(device) }
}, reason: null });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const fetcher = (calls, statuses = rows()) => async (url, options) => {
  calls.push({ url, ...options });
  if (url.endsWith('/isw/status')) return response(statuses);
  if (url.includes('DeviceInformation')) return response(info());
  if (url.endsWith('/')) return new Response('<title>Lexmark XM3250</title>');
  return new Response('<div id="Status"></div>');
};

test('observed Lexmark shape preserves messages and displayed codes without confusing actions or NPA codes', () => {
  const parsed = parseLexmarkStatus(rows());
  assert.equal(parsed.complete, true); assert.equal(parsed.alerts.length, 2);
  assert.equal(parsed.alerts[0].rawCode, '72.01'); assert.equal(parsed.alerts[0].severity, 'critical');
  assert.equal(parsed.alerts[1].rawCode, null); assert.equal(parsed.alerts[1].npaTriplet, '08.01.04');
  assert.equal(parsed.alerts[0].interpretationStatus, 'not_catalogued');
  // Synthetic service-error variant: capture is tested, not physically certified.
  const service = parseLexmarkStatus([{ id: 999, concurrency: 8, type: 'ir', IrTitle: '[121.13A] Service Error' }]);
  assert.equal(service.alerts[0].rawCode, '121.13A'); assert.equal(service.alerts[0].message, '[121.13A] Service Error');
});
test('named identity/firmware fields are used without guessing a serial from arbitrary settings', () => {
  assert.deepEqual(parseLexmarkDeviceInformation(info()), { serialNumber: 'TEST000000001', pageCount: 12000,
    firmware: 'MXTGM.240.229', firmwareDate: '04-Apr-25 22:38' });
  const document = info(); delete document.nodes.nodes.SerialNumberLxk;
  assert.equal(parseLexmarkDeviceInformation(document).serialNumber, null);
  document.nodes.settings[8193].val = -1; assert.equal(parseLexmarkDeviceInformation(document).pageCount, null);
});
test('unsupported, empty, action-only, malformed and oversized snapshots cannot confirm absence of alerts', () => {
  for (const data of [null, {}, [], [{ type: 'action' }], [{ type: 'status', IrTitle: '' }]]) {
    assert.equal(parseLexmarkStatus(data).complete, false);
  }
  const partial = parseLexmarkStatus([...rows(), { type: 'ir', id: 'wrong', IrTitle: 'Error' }]);
  assert.equal(partial.partial, true); assert.equal(partial.alerts.length, 2);
  assert.equal(parseLexmarkStatus([...rows(), ...Array(250).fill(rows()[3])]).complete, false);
});
test('identity mismatch or missing report suppresses vendor evidence, even when the status endpoint succeeds', () => {
  const mismatch = lexmarkDiagnosticsFromDocuments(docs(), 'TEST000000002');
  assert.equal(mismatch.alertSources.lexmark_ews.reason, 'identity_mismatch'); assert.deepEqual(mismatch.alerts, []);
  const unavailable = docs(); delete unavailable.documents['/webglue/webui/nodedata/DeviceInformation/?depth=10&fromReport=true'];
  assert.equal(lexmarkDiagnosticsFromDocuments(unavailable).alertSources.lexmark_ews.available, false);
});
test('SNMP is enriched with GET-only bounded EWS requests, without modifying connectivity, counts or supplies', async () => {
  const calls = [], snmp = { online: true, protocol: 'SNMP v2c', info: { model: 'Lexmark XM3250',
    serialNumber: 'TEST000000001', pageCount: 12345 }, status: { errorState: [0] }, supplies: [{ percentage: 12 }],
    alerts: [{ code: 'generic', source: 'prt_alert_table' }], alertSources: { prt_alert_table: { available: true, complete: true } } };
  const actual = await enrichLexmarkDiagnostics(snmp, '192.0.2.10', { fetchImpl: fetcher(calls) });
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.method === 'GET' && c.redirect === 'error'));
  assert.equal(actual.online, true); assert.equal(actual.info.pageCount, 12345); assert.equal(actual.supplies, snmp.supplies);
  assert.equal(actual.alerts.length, 3); assert.equal(actual.info.firmware, 'MXTGM.240.229');
  const other = { info: { model: 'Brother' } }; assert.equal(await enrichLexmarkDiagnostics(other, '192.0.2.10', { fetchImpl: fetcher(calls) }), other);
  assert.equal(calls.length, 2);
});
test('fallback reuses the same four requests and named report while exposing diagnostics', async () => {
  const calls = [], result = await queryLexmarkHttpFallback('192.0.2.10', { fetchImpl: fetcher(calls) });
  assert.equal(calls.length, 4); assert.equal(result.info.serialNumber, 'TEST000000001');
  assert.equal(result.info.pageCount, 12000); assert.equal(result.alerts[0].rawCode, '72.01');
  assert.equal(result.alertSources.lexmark_ews.complete, true);
  assert.deepEqual(result.trays, []); assert.equal(result.status.printerCode, 1);
});
test('authentication failure and malformed JSON remain unavailable without throwing away SNMP evidence', async () => {
  const reading = await readLexmarkEws('192.0.2.10', { fetchImpl: async url =>
    url.includes('DeviceInformation') ? response(info()) : response({}, 403) });
  const result = lexmarkDiagnosticsFromDocuments(reading);
  assert.equal(result.alertSources.lexmark_ews.reason, 'authentication_required');
  assert.equal(result.alertSources.lexmark_ews.firmware, 'MXTGM.240.229');
  const bad = docs(); bad.documents['/webglue/isw/status'].text = '<html>login</html>';
  assert.equal(lexmarkDiagnosticsFromDocuments(bad).alertSources.lexmark_ews.complete, false);
});
test('deadline covers stalled headers and stalled bodies; response size and invalid addresses are bounded', async () => {
  const started = Date.now();
  const stalled = await readLexmarkEws('192.0.2.10', { timeoutMs: 30, fetchImpl: async () => new Promise(() => {}) });
  assert.equal(stalled.reason, 'timeout'); assert.ok(Date.now() - started < 1000);
  const body = await readLexmarkEws('192.0.2.10', { timeoutMs: 30, fetchImpl: async () =>
    new Response(new ReadableStream({ start() {} })) });
  assert.equal(body.reason, 'timeout');
  const large = await readLexmarkEws('192.0.2.10', { fetchImpl: async () => new Response('x'.repeat(512 * 1024 + 1)) });
  assert.equal(large.documents['/webglue/isw/status'].reason, 'response_too_large');
  const invalid = await readLexmarkEws('127.0.0.1@outside.test', { fetchImpl: () => assert.fail('invalid address must not be fetched') });
  assert.equal(invalid.reason, 'invalid_address');
});
test('persistent vendor episodes survive incomplete reads, deduplicate rotating handles, and resolve only in a complete snapshot', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); ensureDeviceAlertSchema(db);
  const save = (status, minute) => recordDeviceAlertSnapshot(db, { printerId: 'lexmark-test',
    observedAt: `2026-10-08T10:${minute}:00.000Z`, telemetry: { online: true, protocol: 'SNMP v2c', status: { errorState: [0] },
      ...lexmarkDiagnosticsFromDocuments(docs(status)) } });
  const first = save(rows(), '00'); assert.equal(first.diagnostic.state, 'error');
  const rotated = rows(); rotated[1].uniqueId = '999'; rotated[1].handleId = 445;
  assert.equal(save(rotated, '01').alerts.find(a => a.rawCode === '72.01').id, first.alerts.find(a => a.rawCode === '72.01').id);
  const partial = save([...rows().slice(2), { type: 'unknown' }], '02');
  assert.equal(partial.diagnostic.state, 'unknown'); assert.equal(partial.alerts.length, 2);
  const resolved = save([rows()[3]], '03'); assert.equal(resolved.alerts.length, 0);
  const history = getPrinterAlertReport(db, 'lexmark-test'); assert.equal(history.total, 2);
  assert.ok(history.history.every(a => a.resolvedAt === '2026-10-08T10:03:00.000Z'));
});
