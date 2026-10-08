import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { parseNetworkScanTarget, discoverPrinterAtIp, classifyScannedPrinter } from '../network-scan-target.js';
import * as db from '../db.js';
import { app } from '../server.js';
import { createSession, clearAllSessions } from '../auth.js';

test('IP search selects one address without requiring a subnet or corporate catalog', async () => {
  const target = parseNetworkScanTarget({ targetIdentifier: ' 198.18.3.25 ', isGlobal: true });
  assert.equal(target.ip, '198.18.3.25');
  assert.equal(target.serial, null);
  const calls = [];
  const devices = await discoverPrinterAtIp(target.ip, { community: 'custom',
    query: async (...args) => { calls.push(args); return { online: true, info: { model: 'Lexmark', serialNumber: 'NEW123' } }; },
    getMac: async () => { throw new Error('MAC unavailable across VLANs'); } });
  assert.deepEqual(calls, [['198.18.3.25', 'custom']]);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].ip, target.ip);
  assert.equal(devices[0].mac, null);
  assert.equal(devices[0].serial, 'NEW123');
  assert.equal(parseNetworkScanTarget({ targetMac: '02:00:00:00:00:01' }).mac, '02:00:00:00:00:01');
  assert.equal(parseNetworkScanTarget({ targetSerial: 'DEMO0002' }).serial, 'DEMO0002');
});

test('invalid IPs are rejected and stale ARP alone is not a printer response', async () => {
  for (const ip of ['198.18.3.999', '198.18.3.025', '', '198.18.3.25; whoami']) {
    assert.throws(() => parseNetworkScanTarget({ targetIp: ip }), /IPv4/);
  }
  const devices = await discoverPrinterAtIp('198.18.3.25', {
    query: async () => ({ online: false }), getMac: async () => '00:11:22:33:44:55' });
  assert.deepEqual(devices, []);
});

test('replacement at the same IP preserves persisted identity, counters and recharges', t => {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  t.after(() => db.closeDatabase());
  db.savePrinter({ id: 'old', name: 'Posto', ip: '198.18.3.25', macAddress: '00:11:22:33:44:55' });
  db.updateCachedStatus('old', { online: true, info: { serialNumber: 'OLD123', pageCount: 54321 }, supplies: [] });
  db.recordPageCount('old', 54321);
  db.recordRecharge({ id: 'prior-recharge', printerId: 'old', supplyName: 'Black', newLevel: 100, pageCount: 54321 });
  const before = JSON.stringify({ printer: db.getPrinterById('old'), status: db.getCachedStatus('old'),
    pages: db.getAllPageHistory(), recharges: db.getRecharges() });
  const result = classifyScannedPrinter({ ip: '198.18.3.25', serial: 'NEW456', mac: 'AA:BB:CC:DD:EE:FF' },
    db.getPrinters(), id => db.getCachedStatus(id));
  assert.equal(result.replacementRequired, true);
  assert.equal(result.replacementPrinterId, 'old');
  assert.equal(result.registeredPrinterId, undefined);
  assert.equal(result.previousIdentity.serialNumber, 'OLD123');
  assert.equal(JSON.stringify({ printer: db.getPrinterById('old'), status: db.getCachedStatus('old'),
    pages: db.getAllPageHistory(), recharges: db.getRecharges() }), before);
});

test('a shared IP or matching MAC cannot override conflicting physical serials', () => {
  const printers = [{ id: 'old', name: 'OLD123', ip: '198.18.3.25', macAddress: '00:11:22:33:44:55' }];
  const cached = () => ({ info: { serialNumber: 'OLD123' } });
  assert.equal(classifyScannedPrinter({ ip: printers[0].ip, serial: 'NEW456', mac: printers[0].macAddress }, printers, cached).replacementRequired, true);
  assert.equal(classifyScannedPrinter({ ip: printers[0].ip, serial: 'N/D' }, printers, cached).identityUnconfirmed, true);
  const same = classifyScannedPrinter({ ip: printers[0].ip, serial: 'OLD123' }, printers, cached);
  assert.equal(same.identityState, 'confirmed');
  assert.equal(same.registeredPrinterId, 'old');
  const moved = classifyScannedPrinter({ ip: '198.18.3.26', serial: 'OLD123' }, printers, cached);
  assert.equal(moved.registeredPrinterId, 'old');
  assert.equal(moved.replacementRequired, undefined);
  assert.equal(classifyScannedPrinter({ ip: printers[0].ip, serial: 'OLD123' },
    [{ ...printers[0], macAddress: null }], () => null).identityUnconfirmed, true);
});

test('moving a known reserve into an occupied address requires the replacement flow', () => {
  const printers = [{ id: 'old', ip: '198.18.3.25' }, { id: 'reserve', ip: '198.18.3.26' }];
  const result = classifyScannedPrinter({ ip: '198.18.3.25', serial: 'RESERVE' }, printers,
    id => ({ info: { serialNumber: id === 'old' ? 'OLD123' : 'RESERVE' } }));
  assert.equal(result.replacementPrinterId, 'old');
  assert.equal(result.registeredPrinterId, undefined);
});

test('IP scan endpoint keeps admin authorization and rejects malformed IPs before probing', async t => {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); clearAllSessions(); db.closeDatabase(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = token => fetch(`${base}/api/network/scan-mac`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ targetIp: '198.18.3.999' }) });
  assert.equal((await send()).status, 401);
  assert.equal((await send(createSession({ username: 'reader', role: 'user' }).token)).status, 403);
  const response = await send(createSession({ username: 'admin', role: 'admin' }).token);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /IPv4/);
});

test('scanner UI sends a direct IP and opens replacement without conflating identities', async t => {
  const window = new Window({ url: 'http://127.0.0.1', settings: { enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true, disableCSSFileLoading: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  t.after(() => window.happyDOM.abort());
  window.document.write(readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'));
  window.setInterval = () => 0; window.setTimeout = () => 0; window.requestAnimationFrame = () => 0;
  window.scrollTo = () => {}; window.HTMLCanvasElement.prototype.getContext = () => null;
  window.fetch = async () => new Response('{}');
  window.eval(readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8') + '\nwindow.AppState = AppState; window.DOM = DOM; window.ScannerAPI = API;');
  window.eval(`AppState.userRole = 'admin'; AppState.printers = [{id:'old',ip:'198.18.3.25',name:'Antiga',location:'Posto'}];
    ScannerAPI.scanSubnetForMac = async payload => { window.sentScan = payload; return window.scanResponse; };`);
  window.scanResponse = { success: true, devices: [{ ip: '198.18.3.25', model: '<b>Nova</b>', serial: 'NEW456',
    replacementRequired: true, replacementPrinterId: 'old', previousIdentity: { serialNumber: 'OLD123' } }] };
  const target = window.document.getElementById('mac-scan-target-mac');
  target.value = '198.18.3.25';
  window.eval('updateMacScanButtonText()');
  assert.match(window.document.getElementById('btn-submit-mac-scan').textContent, /Buscar por IP/);
  assert.equal(window.document.getElementById('mac-scan-subnet').disabled, true);
  await window.eval('handleMacScanSubmit({preventDefault(){}})');
  assert.equal(window.sentScan.targetIp, '198.18.3.25');
  assert.equal(window.sentScan.isGlobal, false);
  assert.equal(window.sentScan.targetSerial, undefined);
  const results = window.document.getElementById('mac-scanner-results');
  assert.match(results.textContent, /Substituição detectada/);
  assert.match(results.textContent, /OLD123/);
  assert.equal(results.querySelector('b'), null);
  assert.doesNotMatch(results.textContent, /Mesmo IP confirmado|Conexão Ativa/);
  let selected;
  window.PrinterReplacement = { open: (...args) => { selected = args; } };
  results.querySelector('[data-scanner-replace]').click();
  assert.deepEqual(selected, ['old', '198.18.3.25']);
  window.scanResponse = { success: true, devices: [] };
  await window.eval('handleMacScanSubmit({preventDefault(){}})');
  assert.match(results.textContent, /IP não encontrada/);
  assert.doesNotMatch(results.textContent, /nas faixas corporativas/);
  window.sentScan = undefined; target.value = '198.18.3.999';
  await window.eval('handleMacScanSubmit({preventDefault(){}})');
  assert.equal(window.sentScan, undefined);
  target.value = 'DEMO0002'; window.eval('updateMacScanButtonText()');
  assert.match(window.document.getElementById('btn-submit-mac-scan').textContent, /Serial/);
});
