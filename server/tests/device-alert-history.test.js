import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DeviceAlertStore } from '../device-alerts.js';
import { ensureDeviceAlertSchema, recordDeviceAlertSnapshot, getPrinterAlertReport } from '../device-alert-store.js';
import { ALERT_ENTRY_OID as base, parsePrinterMibAlerts } from '../printer-mib-alerts.js';
import { querySnmpWithVersion } from '../snmp-service.js';

const at = n => `2026-10-07T10:${String(n).padStart(2, '0')}:00.000Z`;
const alert = (index = 1, source = 'prt_alert_table') => ({ source, code: 'paper_jam', rawCode: 8,
  severity: 'critical', component: { group: 13, index, location: -2 }, message: 'Jam 121.13A' });
const sample = (alerts = [alert()], complete = true) => ({ online: true, protocol: 'SNMP v2c',
  status: { errorState: null }, alerts, alertSources: { prt_alert_table: { available: complete, complete, partial: !complete } } });
function fixture(t) {
  const db = new DatabaseSync(':memory:'); ensureDeviceAlertSchema(db); t.after(() => db.close());
  return { db, sync: (telemetry, n) => recordDeviceAlertSnapshot(db, { printerId: 'p', telemetry, observedAt: at(n) }),
    report: () => getPrinterAlertReport(db, 'p') };
}

test('two components and two sources with the same code remain separate episodes', t => {
  const f = fixture(t);
  const data = sample([alert(1), alert(2)]); data.status.errorState = [4];
  f.sync(data, 0); assert.equal(f.report().alerts.length, 3);
  f.sync(sample([alert(2)]), 1);
  const r = f.report(); assert.equal(r.alerts.length, 2); // HR source is unavailable, not cleared.
  assert.equal(r.history.find(a => a.component?.index === 1).resolvedAt, at(1));
  assert.equal(r.diagnostic.state, 'unknown'); assert.equal(r.diagnostic.lastKnownState, 'error');
});
test('resolution and recurrence preserve distinct IDs and their original dates', t => {
  const f = fixture(t); f.sync(sample(), 0); const first = f.report().alerts[0];
  f.sync(sample(), 1); f.sync(sample([]), 2); f.sync(sample(), 3);
  const r = f.report(); assert.equal(r.total, 2); assert.notEqual(r.alerts[0].id, first.id);
  const old = r.history.find(a => a.id === first.id);
  assert.equal(old.firstSeenAt, at(0)); assert.equal(old.lastSeenAt, at(1)); assert.equal(old.resolvedAt, at(2));
  assert.equal(r.alerts[0].firstSeenAt, at(3));
});
test('offline, TCP, missing and incomplete snapshots never resolve a known alert', t => {
  const f = fixture(t); f.sync(sample(), 0);
  const first = f.report().alerts[0].id;
  for (const [n, data] of [{ online: false }, { online: true, protocol: 'TCP (Porta 80 HTTP)' },
    { online: true }, sample([], false)].entries()) {
    const result = f.sync(data, n + 1); assert.equal(result.alerts[0].id, first); assert.equal(result.alertsAvailable, false);
    assert.equal(f.report().history[0].resolvedAt, undefined);
  }
});
test('availability flags cannot clear HR errors without the underlying observed bytes', t => {
  const f = fixture(t); f.sync({ online: true, status: { errorState: [4] } }, 0);
  f.sync({ online: true, status: { errorState: null }, alertSources: {
    hr_printer_error_state: { available: true, complete: true } } }, 1);
  assert.equal(f.report().alerts.length, 1); assert.equal(f.report().alertsAvailable, false);
});
test('partial positive observations are recorded without clearing other components', t => {
  const f = fixture(t); f.sync(sample([alert(1)]), 0); f.sync(sample([alert(2)], false), 1);
  assert.equal(f.report().alerts.length, 2); assert.equal(f.report().diagnostic.current, false);
});
test('out-of-order snapshots cannot alter history or falsely resolve a newer condition', t => {
  const f = fixture(t); f.sync(sample(), 2); const before = f.report();
  assert.equal(f.sync(sample([]), 1).ignored, true); assert.deepEqual(f.report(), before);
});
test('a changing table row number does not fabricate a recurrence', t => {
  const f = fixture(t); const a = alert(); a.rowIndex = 1; f.sync(sample([a]), 0);
  a.rowIndex = 100; f.sync(sample([a]), 1); assert.equal(f.report().total, 1);
});
test('unary events are retained once, never treated as active faults, and reboot permits a new event', t => {
  const f = fixture(t); const a = { ...alert(), eventKind: 'unary', rowIndex: 1, deviceTimeTicks: 50 };
  const s = sample([a]); s.alertDeviceUptime = 1000; f.sync(s, 0);
  s.alertDeviceUptime = 1100; f.sync(s, 1);
  assert.equal(f.report().alerts.length, 0); assert.equal(f.report().total, 1);
  assert.equal(f.report().history[0].firstSeenAt, at(0));
  s.alertDeviceUptime = 60; f.sync(s, 2); assert.equal(f.report().total, 2);
});
test('SQLite history survives process restart without requiring a live in-memory alert store', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hefesto-alerts-')); let db = null;
  t.after(() => { if (db) db.close(); rmSync(dir, { recursive: true, force: true }); });
  const file = path.join(dir, 'isolated.db'); db = new DatabaseSync(file); ensureDeviceAlertSchema(db);
  recordDeviceAlertSnapshot(db, { printerId: 'p', telemetry: sample(), observedAt: at(0) }); db.close(); db = null;
  db = new DatabaseSync(file); ensureDeviceAlertSchema(db);
  const result = recordDeviceAlertSnapshot(db, { printerId: 'p', telemetry: { online: false }, observedAt: at(1) });
  assert.equal(result.alerts.length, 1); assert.equal(getPrinterAlertReport(db, 'p').total, 1);
});
test('a failed persistence transaction cannot save half a snapshot', t => {
  const f = fixture(t); f.sync(sample(), 0); const before = f.report();
  f.db.exec("CREATE TRIGGER reject_alert_state BEFORE UPDATE ON device_alert_state BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
  assert.throws(() => f.sync(sample([]), 1), /injected failure/); assert.deepEqual(f.report(), before);
});
test('memory and persistent adapters preserve the same recurrence behavior', t => {
  const f = fixture(t), memory = new DeviceAlertStore();
  for (const [n, data] of [sample(), sample([]), sample()].entries()) {
    f.sync(data, n); memory.syncTelemetryAlerts({ printerId: 'p', telemetry: data, observedAt: at(n) });
  }
  assert.equal(memory.getHistory('p').length, f.report().total);
  assert.deepEqual(memory.getHistory('p').map(a => [a.firstSeenAt, a.resolvedAt, a.active]),
    f.report().history.reverse().map(a => [a.firstSeenAt, a.resolvedAt, a.active]));
});

function rows(overrides = {}, rowIndex = 1, device = 1) {
  const row = { 1: rowIndex, 2: 3, 3: 5, 4: 13, 5: 1, 6: -2, 7: 8, 8: Buffer.from('121.13A Service Error'), 9: 900, ...overrides };
  return Object.fromEntries(Object.entries(row).map(([column, value]) => [`${base}.${column}.${device}.${rowIndex}`, value]));
}
test('Printer-MIB preserves raw codes, text, component, severity and uptime-relative ticks', () => {
  const r = parsePrinterMibAlerts(rows({ 7: 99999 })); const a = r.alerts[0];
  assert.equal(r.source.available, true); assert.equal(a.rawCode, 99999); assert.equal(a.message, '121.13A Service Error');
  assert.equal(a.interpretationStatus, 'not_catalogued'); assert.equal(a.deviceTimeTicks, 900);
  assert.deepEqual(a.component, { group: 13, index: 1, location: -2 });
  assert.equal(a.severity, 'critical'); assert.equal(a.eventKind, 'binary');
  assert.equal(parsePrinterMibAlerts(rows({ 2: 4 })).alerts[0].eventKind, 'unary');
  assert.equal(parsePrinterMibAlerts(rows({ 2: 5 })).alerts[0].eventKind, 'binary');
  assert.equal(parsePrinterMibAlerts(rows({ 7: 903 })).alerts[0].code, 'output_tray_full');
  assert.equal(parsePrinterMibAlerts(rows({ 7: 902 })).alerts[0].code, 'unknown_alert');
});
test('empty supported tables, malformed rows and other device instances have distinct evidence', () => {
  assert.equal(parsePrinterMibAlerts({}).source.available, false);
  assert.equal(parsePrinterMibAlerts({}, { counter: 0 }).source.available, true);
  assert.equal(parsePrinterMibAlerts({}, { counter: 0, complete: false }).source.available, false);
  assert.equal(parsePrinterMibAlerts(rows({ 2: 99 })).source.available, false);
  assert.equal(parsePrinterMibAlerts(rows({ 9: null })).source.available, false);
  const other = parsePrinterMibAlerts(rows({}, 1, 2)); assert.equal(other.alerts.length, 0); assert.equal(other.source.available, false);
});
test('actual SNMP driver collects Printer-MIB while optional failures leave connectivity online', async () => {
  let closeCount = 0;
  for (const broken of [false, true]) {
    const createSession = () => ({ on() {}, close() { closeCount++; },
      get(oids, done) { done(null, oids.map(oid => ({ oid, type: 2, value: oid.endsWith('.19.1') ? 1 : oid.endsWith('.3.0') ? 1000 : oid.includes('25.3.5.1.3') ? [0] : oid.endsWith('.5.1') ? 2 : 0 }))); },
      subtree(oid, feed, done) {
        if (oid === base) { feed(Object.entries(rows()).map(([oid, value]) => ({ oid, value, type: Buffer.isBuffer(value) ? 4 : 2 }))); return done(broken ? new Error('timeout') : null); }
        if (oid === '1.3.6.1.2.1.43.11.1.1') feed([
          { oid: oid + '.6.1.1', value: Buffer.from('Black Toner'), type: 4 },
          { oid: oid + '.8.1.1', value: 100, type: 2 }]); // No level column: never 0%.
        done(null);
      } });
    const data = await querySnmpWithVersion('127.0.0.1', 'test', 1, { createSession });
    assert.equal(data.online, true); assert.equal(data.alerts[0].rawCode, 8);
    assert.equal(data.alertSources.prt_alert_table.available, !broken);
    assert.equal(data.supplies[0].level, null); assert.equal(data.supplies[0].percentage, -1); assert.equal(data.supplies[0].status, 'unknown');
  }
  assert.equal(closeCount, 2);
});
test('unbounded optional alert walks stop at their row budget and are never considered complete', async () => {
  let stopped = false;
  const createSession = () => ({ on() {}, close() {},
    get(oids, done) { done(null, oids.map(oid => ({ oid, type: 2, value: 0 }))); },
    subtree(oid, feed, done) {
      if (oid === base) {
        for (let n = 1; n <= 200; n++) {
          if (feed(Object.entries(rows({}, n)).map(([oid, value]) => ({ oid, value, type: Buffer.isBuffer(value) ? 4 : 2 })))) { stopped = true; break; }
        }
      }
      done(null);
    } });
  const r = await querySnmpWithVersion('127.0.0.1', 'test', 1, { createSession });
  assert.equal(stopped, true); assert.equal(r.alertSources.prt_alert_table.available, false); assert.ok(r.alerts.length <= 100);
});
test('a counter change during the table walk keeps positive evidence but prevents resolution', async () => {
  let counter = 5;
  const createSession = () => ({ on() {}, close() {},
    get(oids, done) { done(null, oids.map(oid => ({ oid, type: 2, value: oid.endsWith('.19.1') ? counter++ : 0 }))); },
    subtree(oid, feed, done) {
      if (oid === base) feed(Object.entries(rows()).map(([oid, value]) => ({ oid, value, type: Buffer.isBuffer(value) ? 4 : 2 })));
      done(null);
    } });
  const result = await querySnmpWithVersion('127.0.0.1', 'test', 1, { createSession });
  assert.equal(result.online, true); assert.equal(result.alerts.length, 1);
  assert.equal(result.alertSources.prt_alert_table.available, false); assert.equal(result.alertSources.prt_alert_table.partial, true);
});
