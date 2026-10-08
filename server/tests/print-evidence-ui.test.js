import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import * as db from '../db.js';
import { app } from '../server.js';
import { createSession, clearAllSessions } from '../auth.js';

test('panel shows measured levels, unknown daily counts and opens stored physical readings', async t => {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  db.savePrinter({ id: 'p1', name: 'Printer', ip: '127.0.0.10', location: '<b>Posto</b>' });
  db.recordRecharge({ id: 'detected', printerId: 'p1', supplyName: 'Black', newLevel: 95,
    pageCount: 0, source: 'auto', verificationStatus: 'detected_level_jump' });
  db.recordRecharge({ id: 'manual', printerId: 'p1', supplyName: 'Magenta', newLevel: 100,
    pageCount: 1, source: 'manual' });
  db.recordRecharge({ id: 'legacy', printerId: 'p1', supplyName: 'Yellow', newLevel: 99,
    pageCount: 2, source: 'auto' });
  db.recordPageCount('p1', 0);
  const token = createSession({ username: 'UI-admin', role: 'admin' }).token;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const window = new Window({ url: base, settings: { enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true, disableCSSFileLoading: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  t.after(async () => { window.happyDOM.abort(); await new Promise(resolve => server.close(resolve)); clearAllSessions(); db.closeDatabase(); });
  window.document.write(readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'));
  window.setInterval = () => 0; window.requestAnimationFrame = () => 0; window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.fetch = (url, options) => {
    if (String(url).includes('/api/status/all')) return Promise.resolve(new Response('[]'));
    return fetch(new URL(url, base), options);
  };
  window.eval(readFileSync(new URL('../../public/js/supply-semantics.js', import.meta.url), 'utf8'));
  window.eval(readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8') + '\nwindow.AppState = AppState; window.DOM = DOM;');
  window.eval(`AppState.userRole = 'admin'; setAuthToken('${token}'); AppState.printers = ${JSON.stringify(db.getPrinters())}; AppState.activeAdminTab = 'printers';`);
  await window.eval('renderUnitRecentRecharges()');
  const list = window.document.getElementById('unit-recent-recharges-list');
  assert.match(list.textContent, /Troca registrada • 95%/);
  assert.doesNotMatch(list.textContent, /Nova 100%/);
  assert.equal(list.querySelectorAll('.unit-recharge-item').length, 3);
  assert.doesNotMatch(list.textContent, /Registro sem evidência|confirmar troca|Nível detectado/);
  const status = { online: true, info: { pageCount: 0 }, supplies: [], pagesToday: null, printEvidence: db.getDailyPrintEvidence('p1') };
  window.eval(`AppState.statusData.set('p1', ${JSON.stringify(status)});`);
  const row = window.eval("renderPrinterRowHtml(AppState.printers[0], true)");
  assert.match(row, /— hoje/);
  assert.doesNotMatch(row, /Aguardando leituras|observadas desde/);
  assert.match(row, /data-print-audit/);
  assert.doesNotMatch(row, /0 hoje/);
  db.recordPageCount('p1', 12);
  window.eval(`AppState.statusData.get('p1').pagesToday = 12; AppState.statusData.get('p1').printEvidence = ${JSON.stringify(db.getDailyPrintEvidence('p1'))};`);
  assert.match(window.eval("renderPrinterRowHtml(AppState.printers[0], true)"), /\+12 hoje/);
  await window.eval("openPrintAudit('p1')");
  const dialog = window.document.getElementById('print-audit-dialog');
  assert.equal(dialog.open, true);
  assert.match(dialog.textContent, /12 observadas desde/);
  assert.equal(dialog.querySelectorAll('tbody tr').length, 2);
  assert.match(dialog.textContent, /impressões anteriores à primeira leitura não estão incluídas/);
  // A filtered unit with no printers cannot display another unit's replacements.
  window.eval('AppState.printers = []');
  await window.eval('renderUnitRecentRecharges()');
  assert.doesNotMatch(list.textContent, /Troca registrada/);

  // Activity requires a fresh physical observation and does not suppress a supply warning.
  const printer = db.getPrinters()[0];
  window.AppState.healthData.set('p1', { state: 'critical', reasonCode: 'supply_critical', criticalSupply: { name: 'Black', percentage: 0 } });
  const printing = { online: true, cachedAt: new Date().toISOString(), info: { pageCount: 12 }, supplies: [], status: { printerCode: 4 }, pagesToday: 12 };
  window.AppState.statusData.set('p1', printing);
  const printingRow = window.eval(`renderPrinterRowHtml(${JSON.stringify(printer)}, true)`);
  assert.match(printingRow, /<span>Imprimindo<\/span>/);
  assert.match(printingRow, /Black · 0%|Preta · 0%/);
  for (const patch of [ { online: false }, { cachedAt: new Date(Date.now() - 360000).toISOString() }, { status: { printerCode: 3 } } ]) {
    window.AppState.statusData.set('p1', { ...printing, ...patch });
    assert.doesNotMatch(window.eval(`renderPrinterRowHtml(${JSON.stringify(printer)}, true)`), /<span>Imprimindo<\/span>/);
  }
  window.AppState.healthData.set('p1', { state: 'offline' });
  window.AppState.statusData.set('p1', printing);
  assert.doesNotMatch(window.eval(`renderPrinterRowHtml(${JSON.stringify(printer)}, true)`), /<span>Imprimindo<\/span>/);
});
