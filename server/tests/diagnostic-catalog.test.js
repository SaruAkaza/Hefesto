import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticCatalog, createDiagnosticCatalog, enrichDiagnosticReport } from '../diagnostic-catalog.js';
import { diagnosticCatalogData } from '../diagnostic-catalog-data.js';
import { DeviceAlertStore } from '../device-alerts.js';
import { parseLexmarkStatus } from '../lexmark-diagnostics.js';

const alert = (model = 'Lexmark XM3350 SERIAL00001 MXTSN.240.049', rawCode = '72.01') => ({
  id: 'episode', source: 'lexmark_ews', code: 'lexmark_isw_231_9', rawCode, message: 'SMTP server not configured [72.01]',
  severity: 'critical', interpretationStatus: 'not_catalogued', deviceContext: { model, firmware: 'TEST.1' }, active: true
});
test('catalog matches exact observed model, source and displayed code without changing the evidence', () => {
  const a = alert(), report = { alerts: [a], history: [a], diagnostic: { state: 'error', current: true } };
  const before = structuredClone(report), result = enrichDiagnosticReport(report);
  assert.deepEqual(report, before); assert.deepEqual(result.diagnostic, report.diagnostic);
  assert.equal(result.alerts[0].knowledge.status, 'code_documented');
  assert.equal(result.alerts[0].knowledge.catalogVersion, '1.0.0');
  assert.equal(result.alerts[0].knowledge.observedFirmware, 'TEST.1');
  const { knowledge, ...original } = result.alerts[0]; assert.deepEqual(original, a);
  assert.equal(result.history[0].knowledge.entryId, knowledge.entryId);
});
test('unlisted, ambiguous and absent model/code/source never receive a meaning from another family', () => {
  for (const a of [alert('XM3250', '121.13A'), alert('XM3250', '84.31'), alert('XM33500'), alert('XM3350 CX532'),
    alert('CX532FAKE'), alert('XM3350', '72.1'), { ...alert(), source: 'prt_alert_table' },
    { ...alert(), source: 'vendor_custom' }, { ...alert(), deviceContext: null }, { ...alert(), rawCode: null }]) {
    const k = diagnosticCatalog.lookup(a); assert.equal(k.status, 'not_catalogued'); assert.equal(k.meaning, undefined);
  }
});
test('XM3250 guidance documents the message, never pretends the manual documents numeric 72.01', () => {
  const k = diagnosticCatalog.lookup(alert('XM3250')); assert.equal(k.status, 'message_documented');
  assert.match(k.limitation, /não associa numericamente 72.01/);
  assert.equal(diagnosticCatalog.lookup({ ...alert('XM3250'), message: 'SMTP server not configured. [72.01]' }).status, 'message_documented');
  assert.equal(diagnosticCatalog.lookup({ ...alert('XM3250'), message: 'E-mail servidor SMTP não configurado. Contate o administrador do sistema. [72.01]' }).status, 'message_documented');
  for (const message of ['Service Error [72.01]', 'SMTP authentication failed [72.01]', 'Some other SMTP error [72.01]']) {
    assert.equal(diagnosticCatalog.lookup({ ...alert('XM3250'), message }).status, 'not_catalogued');
  }
});
test('documented variant aliases and component life semantics remain model-specific', () => {
  assert.equal(diagnosticCatalog.lookup(alert('Lexmark CX532adwe', '84.31')).component, 'Kit de imagem');
  assert.match(diagnosticCatalog.lookup(alert('XM3350', '84.31')).meaning, /recomenda substituição/);
  assert.match(diagnosticCatalog.lookup(alert('XM3350', '84.41')).meaning, /retomar a impressão/);
  assert.equal(diagnosticCatalog.lookup(alert('CX735adse', '80.31')).component, 'Kit de manutenção do fusor');
  assert.equal(diagnosticCatalog.lookup(alert('CX532adwe', '80.31')).status, 'not_catalogued');
});
test('catalog rejects duplicates, wildcard codes and unsafe source links at compilation', () => {
  const edits = [d => d.version = 'dev', d => d.profiles.push(d.profiles[0]),
    d => d.profiles[1].models.push('XM3250'), d => d.profiles[1].entries.push(d.profiles[1].entries[0]),
    d => d.profiles[1].entries[0].codes.push('72.xx'), d => d.profiles[1].entries[0].codes.push('72.01'),
    d => d.profiles[0].reference.url = 'javascript:alert(1)',
    d => d.profiles[0].reference.url = 'https://publications.lexmark.com.evil.invalid/guide',
    d => d.profiles[0].reference.url = 'https://user:pass@publications.lexmark.com/guide',
    d => d.profiles[0].reference.modelReference = 'http://support.lexmark.com/guide',
    d => d.profiles[0].entries[0].messages = []];
  for (const edit of edits) { const data = structuredClone(diagnosticCatalogData); edit(data); assert.throws(() => createDiagnosticCatalog(data), TypeError); }
});
test('closed episodes retain their observed model even after the same asset gets different telemetry', () => {
  const store = new DeviceAlertStore(), first = '2026-10-08T10:00:00Z';
  const telemetry = model => ({ online: true, protocol: 'SNMP v2c', info: { model }, status: { errorState: [0] },
    alerts: [alert(model)], alertSources: { lexmark_ews: { available: true, complete: true } } });
  const old = store.syncTelemetryAlerts({ printerId: 'test', observedAt: first, telemetry: telemetry('XM3350') }).alerts[0];
  store.syncTelemetryAlerts({ printerId: 'test', observedAt: '2026-10-08T10:03:00Z', telemetry: { ...telemetry('CX532'), alerts: [] } });
  const historical = [...store.alertsByPrinter.get('test').values()][0];
  assert.equal(historical.id, old.id); assert.equal(historical.active, false); assert.equal(historical.deviceContext.model, 'XM3350');
  assert.equal(diagnosticCatalog.lookup(historical).model, 'XM3350');
});
test('Lexmark displayed codes include single digit sections without deriving an NPA code', () => {
  for (const code of ['8.01', '71.4', '72.01', '121.13A']) {
    const parsed = parseLexmarkStatus([{ type: 'ir', id: 1, concurrency: 1, IrTitle: `Message [${code}]` }]);
    assert.equal(parsed.alerts[0].rawCode, code);
  }
  assert.equal(parseLexmarkStatus([{ type: 'ir', id: 1, concurrency: 1, IrTitle: 'Message', npaTriplet: '08.01.04' }]).alerts[0].rawCode, null);
});
