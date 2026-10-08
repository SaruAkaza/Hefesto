import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import * as db from '../db.js';
import { app } from '../server.js';
import { createSession } from '../auth.js';

test('interface real: consulta, confirmação após resultado, troca e histórico preservado', async () => {
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  db.saveUnit({ id: 'unit-example', name: '109 - Unidade Exemplo', region: 'SP' });
  db.savePrinter({ id: 'old', name: 'Laboratório Epson', ip: '198.18.9.10', unitId: 'unit-example', unitName: '109 - Unidade Exemplo', location: 'Laboratório', initialPageCount: 100 });
  db.updateCachedStatus('old', { online: true, info: { model: 'Epson', serialNumber: 'OLD123', pageCount: 200 } });
  const token = createSession({ username: 'UI-admin', role: 'admin' }).token;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const window = new Window({ url: base, settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  const source = name => readFileSync(fileURLToPath(new URL(`../../public/${name}`, import.meta.url)), 'utf8');
  window.document.write(source('index.html'));
  window.setInterval = () => 0; window.requestAnimationFrame = () => 0; window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  let finishProbe;
  window.fetch = async (url, options) => {
    if (String(url).includes('/api/status/all')) return new Response(JSON.stringify(db.getPrinters().map(p => ({ id: p.id, ...db.getCachedStatus(p.id) }))));
    if (String(url).endsWith('/replacement-preview')) return new Promise(resolve => finishProbe = () => resolve(new Response(JSON.stringify({
      ip: '198.18.9.20', online: true, macAddress: '00:11:22:33:44:66', info: { model: 'Lexmark', serialNumber: 'NEW123', pageCount: 500 }, message: 'Consulta concluída'
    }))));
    return fetch(new URL(url, base), options);
  };
  try {
    // O eval do simulador não compartilha bindings const entre scripts como um navegador clássico.
    window.eval(readFileSync(new URL('../../public/js/supply-semantics.js', import.meta.url), 'utf8'));
    window.eval(source('js/app.js') + '\nwindow.AppState = AppState; window.DOM = DOM; Object.defineProperty(window, "currentDrawerPrinterId", {get: () => currentDrawerPrinterId});');
    window.eval(source('js/printer-replacement.js'));
    window.eval(`AppState.userRole = 'admin'; setAuthToken('${token}'); document.getElementById('login-overlay').classList.remove('active');`);
    await window.eval('loadDashboardData(false, false)');
    await window.eval("openPrinterDetailDrawer('old')");
    assert.equal(window.document.getElementById('btn-detail-replace').style.display, 'inline-flex');
    await window.eval("PrinterReplacement.open('old', '198.18.9.20')");
    const field = name => window.document.getElementById(`asset-${name}`);
    const probe = field('probe').onclick();
    field('confirm').checked = true; // Confirmação prematura durante a consulta.
    finishProbe(); await probe;
    assert.equal(field('confirm').checked, false, 'o resultado precisa ser revisado antes da confirmação');
    assert.equal(field('model').value, 'Lexmark');
    assert.equal(db.getPrinterReplacements().length, 0);
    field('reason').value = 'Troca para validação';
    const form = window.document.getElementById('asset-replacement-form');
    await form.onsubmit(new window.Event('submit', { cancelable: true }));
    assert.equal(db.getPrinterReplacements().length, 0);
    field('confirm').checked = true;
    await form.onsubmit(new window.Event('submit', { cancelable: true }));
    assert.equal(db.getPrinterReplacements().length, 1, field('error').textContent);
    assert.equal(field('error').textContent, '', 'uma troca gravada não pode ser apresentada como falha');
    assert.equal(window.document.querySelector('.asset-dialog').open, false);
    assert.match(window.document.getElementById('toast-container').textContent, /Substituição registrada/);
    assert.equal(db.getPrinterById('old').isActive, false);
    assert.equal(db.getPrinterReplacements()[0].replaced_by, 'UI-admin');
    await window.eval("PrinterReplacement.history('old')");
    const history = window.document.getElementById('asset-history-body').textContent;
    assert.match(history, /Desativado/); assert.match(history, /UI-admin/);
  } finally {
    await window.happyDOM.abort(); window.close();
    await new Promise(resolve => server.close(resolve)); db.closeDatabase();
  }
});

test('falha após commit não permite reenviar a substituição já registrada', async () => {
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  db.savePrinter({ id: 'old', name: 'Posto', ip: '198.18.21.2', unitName: 'Unidade Exemplo', location: '22º Andar' });
  db.recordPageCount('old', 49);
  db.recordRecharge({ id: 'preserved', printerId: 'old', supplyName: 'Toner', newLevel: 100, pageCount: 49 });
  const token = createSession({ username: 'UI-admin', role: 'admin' }).token;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const window = new Window({ url: base, settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  const source = name => readFileSync(fileURLToPath(new URL(`../../public/${name}`, import.meta.url)), 'utf8');
  window.document.write(source('index.html'));
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const messages = [];
  let saves = 0;
  const refreshes = [];
  window.AppState = { userRole: 'admin', printers: db.getPrinters(), units: [], statusData: new Map() };
  window.escapeHtml = value => String(value).replace(/[&<>"']/g, '');
  window.apiFetch = (url, options = {}) => {
    if (String(url).endsWith('/replace')) saves++;
    return fetch(new URL(url, base), { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  };
  window.closePrinterDetailDrawer = () => {};
  window.loadDashboardData = async (...args) => { refreshes.push(args); throw new Error('Falha na atualização do painel'); };
  window.showToast = (message, type) => messages.push({ message, type });
  try {
    window.eval(source('js/printer-replacement.js'));
    await window.PrinterReplacement.open('old');
    const field = name => window.document.getElementById(`asset-${name}`);
    field('reason').value = 'Troca física';
    field('serial').value = 'DEMO00000007';
    field('mac').value = '02:00:00:00:00:07';
    field('counter').value = '253';
    field('confirm').checked = true;
    const form = window.document.getElementById('asset-replacement-form');
    await form.onsubmit(new window.Event('submit', { cancelable: true }));
    assert.equal(db.getPrinterReplacements().length, 1);
    assert.equal(field('error').textContent, '', 'erro ao atualizar não é erro ao gravar');
    assert.equal(field('submit').disabled, true, 'uma operação gravada não pode habilitar reenvio');
    assert.ok(messages.some(item => item.type === 'success' && /Substituição registrada/.test(item.message)));
    assert.ok(messages.some(item => item.type === 'warning' && /já foi registrada/.test(item.message)));
    assert.deepEqual(refreshes, [[false, false]], 'salvar não força nova coleta de todo o parque');
    await form.onsubmit(new window.Event('submit', { cancelable: true }));
    assert.equal(saves, 1);
    assert.equal(db.getPrinterById('old').isActive, false);
    assert.equal(db.getAllPageHistory().find(row => row.printerId === 'old').endPageCount, 49);
    assert.ok(db.getRecharges().some(row => row.id === 'preserved' && row.printerId === 'old'));
  } finally {
    await window.happyDOM.abort(); window.close();
    await new Promise(resolve => server.close(resolve)); db.closeDatabase();
  }
});
