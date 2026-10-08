import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';
import * as identity from '../printer-identity.js';
import * as runtime from '../server.js';
import { triggerEdgeSync } from '../edge-sync-service.js';
import http from 'node:http';

test.beforeEach(() => { db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true }); });
test.after(() => db.closeDatabase());
const asset = (id, ip, location = 'A') => db.savePrinter({ id, ip, name: id, unitName: 'Unidade Exemplo', location, initialPageCount: 100 });
function replace(initialCounter = null) {
  asset('old', '198.18.9.10');
  return db.executePrinterReplacement({ replacedPrinterId: 'old', newPrinter: { id: 'new', name: 'new', ip: '198.18.9.10' },
    replacedBy: 'admin', reason: 'Troca', confirmed: true, initialCounter });
}
test('edição rejeitada por IP ou FK não altera alocações', () => {
  asset('a', '198.18.9.10'); asset('b', '198.18.9.20'); db.recordPageCount('a', 100);
  const before = db.getPrinterAllocations('a');
  assert.throws(() => db.savePrinter({ ...db.getPrinterById('a'), ip: '198.18.9.20', location: 'B' }));
  assert.deepEqual(db.getPrinterAllocations('a'), before);
  assert.throws(() => db.savePrinter({ ...db.getPrinterById('a'), unitId: 'missing', location: 'B' }));
  assert.deepEqual(db.getPrinterAllocations('a'), before);
});
test('serial aposentado não participa de reconciliação nem perde seu cache', () => {
  asset('old', '198.18.9.10');
  db.updateCachedStatus('old', { info: { serialNumber: 'OLD123', pageCount: 500 } });
  db.executePrinterReplacement({ replacedPrinterId: 'old', newPrinter: { id: 'new', name: 'new', ip: '198.18.9.10' }, replacedBy: 'admin', reason: 'Troca', confirmed: true });
  const before = db.getCachedStatus('old');
  assert.equal(db.getPrinterBySerial('OLD123'), null);
  assert.equal(db.reconcilePrinterIpBySerial('OLD123', '198.18.9.30').success, false);
  assert.deepEqual(db.getCachedStatus('old'), before);
  assert.equal(db.getPrinterById('old').ip, '198.18.9.10');
});
test('Hub já coletando reconcilia alocações sem perder evidência local, inclusive reenvio e mudança', () => {
  asset('p', '198.18.9.10'); db.recordPageCount('p', 120);
  const printers = db.getPrinters({ includeInactive: true });
  const bundle = db.getPrinterLifecycleBundle(['p']);
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  asset('p', '198.18.9.10'); db.recordPageCount('p', 115);
  const localId = db.getPrinterAllocations('p')[0].id;
  db.applyPrinterLifecycleSync({ printers, ...bundle });
  db.applyPrinterLifecycleSync({ printers, ...bundle });
  assert.ok(db.getPrinterAllocations('p').some(a => a.id === localId));
  assert.equal(db.getPrinterAllocations('p').filter(a => !a.ended_at).length, 1);
  const moved = { ...printers[0], location: 'B' };
  const start = new Date(Date.now() + 1000).toISOString();
  const prior = { ...bundle.allocations[0], ended_at: start, end_counter: 130 };
  const next = { ...prior, id: 'remote-next', location: 'B', started_at: start, ended_at: null, start_counter: 130, end_counter: null };
  db.applyPrinterLifecycleSync({ printers: [moved], replacements: [], allocations: [prior, next] });
  assert.equal(db.getPrinterById('p').location, 'B');
  assert.equal(db.getPrinterAllocations('p').filter(a => !a.ended_at)[0].id, 'remote-next');
});
test('payload Edge real preserva contador desconhecido', async () => {
  replace();
  let payload;
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', chunk => raw += chunk); req.on('end', () => { payload = JSON.parse(raw); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"success":true}'); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await triggerEdgeSync({ hubUrl: `http://127.0.0.1:${server.address().port}`, hubToken: 'test', edgeUnitName: 'Unidade Exemplo' });
    assert.equal(result.success, true);
    assert.equal(payload.printers.find(p => p.id === 'new').status.info.pageCount, null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('wrapper de coleta registra primeira leitura zero e produção posterior', async () => {
  replace();
  await runtime.recordDailyPageSnapshot('new', 0);
  await runtime.recordDailyPageSnapshot('new', 12);
  const row = db.getAllPageHistory().find(r => r.printerId === 'new');
  assert.equal(row.startPageCount, 0); assert.equal(row.endPageCount, 12);
});
test('produção por alocação inclui páginas desde instalação e não inventa baseline em outro dia', () => {
  replace(250); db.recordPageCount('new', 270);
  const allocation = db.getPrinterAllocations('new')[0];
  const row = db.getDb().prepare('SELECT * FROM printer_allocation_page_history WHERE allocation_id = ?').get(allocation.id);
  assert.equal(row.start_page_count, 250); assert.equal(row.end_page_count, 270);
});
test('confirmação tardia descarta ativo trocado antes e durante consulta', async () => {
  asset('p', '198.18.9.10');
  const snapshot = db.getPrinterById('p');
  let current = { ...snapshot, isActive: false }, calls = 0;
  const query = async () => { calls++; return { online: true, info: { serialNumber: 'SAME' } }; };
  const options = { snapshot, previousIdentity: { serialNumber: 'SAME' }, getCurrent: () => current, query };
  assert.equal(await identity.queryCurrentPrinterTelemetry(options), null); assert.equal(calls, 0);
  current = snapshot;
  let finish;
  const pending = identity.queryCurrentPrinterTelemetry({ ...options, query: () => new Promise(resolve => finish = resolve) });
  current = { ...snapshot, isActive: false }; finish({ online: true, info: { serialNumber: 'SAME' } });
  assert.equal(await pending, null);
  current = snapshot;
  assert.equal(await identity.queryCurrentPrinterTelemetry({ ...options, query: async () => ({ online: true, info: { serialNumber: 'OTHER' } }) }), null);
});
