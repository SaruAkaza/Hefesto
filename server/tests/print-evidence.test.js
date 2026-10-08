import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';
import { buildConsumableRechargeObservation } from '../consumable-lifecycle-observer.js';
import { app } from '../server.js';
import { createSession, clearAllSessions } from '../auth.js';

function fixture(t) {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  db.savePrinter({ id: 'p1', name: 'Printer', ip: '127.0.0.10' });
  t.after(() => { db.closeDatabase(); clearAllSessions(); });
}
const observation = (changes = {}) => buildConsumableRechargeObservation({
  printerId: 'p1', supplySlot: 'black', previousLevel: 5, newLevel: 95,
  confirmedLevel: 95, counterBefore: 0, counterAfter: 12, ...changes
});
test('unknown supply sentinels and an unstable confirmation cannot become a replacement', () => {
  assert.equal(observation({ previousLevel: -2 }).eligible, false);
  assert.equal(observation({ confirmedLevel: 105 }).eligible, false);
  assert.equal(observation({ newLevel: 50, confirmedLevel: 100 }).eligible, false);
  assert.equal(observation({ previousSerial: 'A', newSerial: 'B', confirmedSerial: 'C' }).eligible, false);
  assert.equal(observation().classification.confidence, 'verified_auto_medium');
  assert.equal(observation({ previousSerial: 'A', newSerial: 'B', confirmedSerial: 'B' }).classification.confidence, 'verified_auto_high');
});
test('recharges persist evidence and preserve unknown counters through queries and summaries', t => {
  fixture(t);
  const event = db.recordRecharge({ id: 'r1', printerId: 'p1', supplyName: 'Black', newLevel: 95,
    pageCount: null, source: 'auto', verificationStatus: 'detected_level_jump', evidence: observation().event });
  assert.equal(event.pageCount, null);
  assert.equal(db.getRecharges()[0].verificationStatus, 'detected_level_jump');
  assert.equal(db.getRechargesSummary().p1.lastRecharge.evidence.confidence, 'verified_auto_medium');
  assert.equal(db.getRecentRechargeEvents()[0].newLevel, 95);
  db.recordRecharge({ id: 'manual', printerId: 'p1', supplyName: 'Yellow', newLevel: 100, pageCount: 0, source: 'manual' });
  assert.equal(db.getRecharges().find(x => x.id === 'manual').verificationStatus, 'reported_manual');
});
test('daily pages require two physical readings, accept zero, and expose their measurement window', t => {
  fixture(t);
  db.recordPageCount('p1', 0, [], { observedAt: '2026-09-30T12:00:00Z' });
  assert.equal(db.getDailyPrintEvidence('p1', '2026-09-30').pages, null);
  db.recordPageCount('p1', 12, [], { observedAt: '2026-09-30T12:01:00Z' });
  const evidence = db.getDailyPrintEvidence('p1', '2026-09-30');
  assert.equal(evidence.pages, 12);
  assert.equal(evidence.startCounter, 0);
  assert.equal(evidence.quality, 'observed');
  assert.equal(evidence.firstReadingAt, '2026-09-30T12:00:00.000Z');
  assert.equal(evidence.readingCount, 2);
});
test('counter regression remains visible after recovery and late readings cannot overwrite the day', t => {
  fixture(t);
  for (const [count, minute] of [[100, 0], [110, 1], [2, 2], [120, 3], [105, 0]]) {
    db.recordPageCount('p1', count, [], { observedAt: `2026-09-30T12:0${minute}:30Z` });
  }
  const audit = db.getPrinterPrintAudit('p1', '2026-09-30');
  assert.equal(audit.summary.quality, 'counter_regression');
  assert.equal(audit.summary.pages, null);
  assert.equal(audit.summary.endCounter, 120);
  assert.ok(audit.readings.some(x => x.status === 'counter_regression' && x.pageCount === 2));
  assert.ok(audit.readings.some(x => x.status === 'out_of_order'));
});
test('legacy totals remain stored without being retroactively labelled verified', t => {
  fixture(t);
  db.getDb().prepare('INSERT INTO page_history(printer_id,date,start_page_count,end_page_count) VALUES(?,?,?,?)').run('p1', '2026-09-30', 100, 140);
  assert.equal(db.getDailyPrintEvidence('p1', '2026-09-30').quality, 'legacy_unverified');
  assert.equal(db.getAllPageHistory()[0].endPageCount, 140);
  db.getDb().prepare("INSERT INTO recharges(id,printer_id,supply_name,new_level,timestamp) VALUES('old','p1','Black',100,'2026-09-30')").run();
  assert.equal(db.getRecharges()[0].verificationStatus, 'legacy_unverified');
});
test('print audit endpoint requires admin and returns real stored readings without probing hardware', async t => {
  fixture(t);
  db.recordPageCount('p1', 0);
  db.recordPageCount('p1', 12);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/printers/p1/print-audit`;
  assert.equal((await fetch(url)).status, 401);
  const operator = createSession({ username: 'op', role: 'operator' });
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${operator.token}` } })).status, 403);
  const admin = createSession({ username: 'admin', role: 'admin' });
  const response = await fetch(url, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(response.status, 200);
  const audit = await response.json();
  assert.equal(audit.summary.pages, 12);
  assert.equal(audit.readings.length, 2);
});
test('Hub audits original Edge measurement times and replay does not manufacture extra readings', async t => {
  fixture(t);
  db.saveUnit({ id: 'u1', name: 'Filial' });
  db.savePrinter({ ...db.getPrinterById('p1'), unitId: 'u1', unitName: 'Filial' });
  const oldSecret = process.env.HUB_SYNC_SECRET;
  process.env.HUB_SYNC_SECRET = 'evidence-test';
  t.after(() => { if (oldSecret === undefined) delete process.env.HUB_SYNC_SECRET; else process.env.HUB_SYNC_SECRET = oldSecret; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (pageCount, observedAt) => fetch(`http://127.0.0.1:${server.address().port}/api/edge/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-edge-token': 'evidence-test' },
    body: JSON.stringify({ edgeUnitId: 'u1', edgeUnitName: 'Filial', printers: [{ ...db.getPrinterById('p1'),
      status: { online: true, info: { pageCount }, observedAt } }], padding: 'x'.repeat(120000) })
  });
  assert.equal((await send(0, '2026-09-30T12:00:00Z')).status, 200);
  assert.equal((await send(12, '2026-09-30T12:05:00Z')).status, 200);
  assert.equal((await send(12, '2026-09-30T12:05:00Z')).status, 200);
  const audit = db.getPrinterPrintAudit('p1', '2026-09-30');
  assert.equal(audit.summary.pages, 12);
  assert.equal(audit.readings.length, 2);
  assert.equal(audit.readings[0].source, 'edge_sync');
  assert.equal(audit.summary.lastReadingAt, '2026-09-30T12:05:00.000Z');
});
test('manual report is labelled as reported and cannot replace the physical sensor reading', async t => {
  fixture(t);
  db.updateCachedStatus('p1', { online: true, info: { pageCount: 0 }, supplies: [{ name: 'Black', type: 'toner', percentage: 20 }] });
  const token = createSession({ username: 'tech', role: 'admin' }).token;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/recharges`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ printerId: 'p1', supplyName: 'Black', newLevel: 95, pageCount: null })
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).verificationStatus, 'reported_manual');
  assert.equal(db.getCachedStatus('p1').supplies[0].percentage, 20);
});
