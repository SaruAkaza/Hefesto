import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { evaluatePrinterHealth, withStaleness } from '../health-engine.js';

function dashboard(t) {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.write(readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'));
  window.eval(readFileSync(new URL('../../public/js/supply-semantics.js', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8');
  window.eval(source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'")) +
    '\nwindow.testState = AppState; window.testAPI = API;');
  const state = window.testState;
  state.userRole = 'admin';
  state.units = [{ id: 'u', name: 'Unidade de teste', region: 'RJ' }];
  state.printers = [{ id: 'p', name: 'Impressora de teste', location: 'Sala', ip: '127.0.0.10',
    unitId: 'u', unitName: 'Unidade de teste', region: 'RJ', macAddress: '00:11:22:33:44:55' }];
  window.testAPI.getRecharges = async () => [];
  t.after(async () => { await window.happyDOM.abort(); window.close(); });
  const status = { online: false, cachedAt: new Date().toISOString(), supplies: [{ name: 'Black', type: 'toner', percentage: 84 }],
    info: { pageCount: 1234, model: 'Test' }, pagesToday: 7, status: { printerCode: 3 }, trays: [] };
  function render(health, patch = {}) {
    state.healthData.clear();
    if (health) state.healthData.set('p', health);
    state.statusData.set('p', { ...status, ...patch });
    window.eval('renderOverviewTab(true)');
    const rows = window.document.querySelectorAll('#my-printers-list-body tr.printer-telemetry-row');
    return { rows, text: window.document.getElementById('my-printers-list-body').textContent,
      online: Number(window.document.getElementById('count-connected-banner').textContent),
      offline: Number(window.document.getElementById('count-offline').textContent),
      warning: Number(window.document.getElementById('count-warning').textContent) };
  }
  return { window, state, status, render };
}

test('missing or unsupported health never confirms online/offline or hides a cached printer', t => {
  const f = dashboard(t);
  for (const health of [null, { state: 'future_unsupported_state' }]) {
    for (const online of [false, true]) {
      const view = f.render(health, { online, status: { printerCode: 4 } });
      assert.equal(view.rows.length, 1);
      assert.equal(view.online, 0);
      assert.equal(view.offline, 0);
      assert.equal(view.warning, 1);
      assert.match(view.text, /Estado não confirmado/);
      assert.match(view.text, /Leitura armazenada/);
      assert.match(view.text, /84%/);
      assert.match(view.text.replace(/[^0-9]/g, ''), /1234/);
      assert.doesNotMatch(view.text, /Offline confirmado|Inacessível na rede|Achar IP|Imprimindo/);
    }
  }
});

test('dashboard follows real Health Engine failures and recovery without premature offline', t => {
  const f = dashboard(t);
  let health = evaluatePrinterHealth({ telemetry: { ...f.status, online: true } });
  for (let failures = 1; failures <= 3; failures++) {
    health = evaluatePrinterHealth({ telemetry: { online: false, error: 'SNMP Timeout' }, previousHealth: health });
    const view = f.render(health);
    assert.equal(view.rows.length, 1);
    if (failures < 3) {
      assert.equal(view.offline, 0);
      assert.match(view.text, /Conexão instável/);
      assert.match(view.text, new RegExp(`${failures}/3 falhas`));
      assert.match(view.text, /84%/);
      assert.match(view.text, /Última leitura válida/);
      assert.doesNotMatch(view.text, /Offline confirmado|Inacessível na rede|Achar IP/);
    } else {
      assert.equal(view.offline, 1);
      assert.match(view.text, /Offline confirmado/);
      assert.match(view.text, /Timeout SNMP/);
      assert.match(view.text, /Achar IP/);
    }
  }
  for (let successes = 1; successes <= 2; successes++) {
    health = evaluatePrinterHealth({ telemetry: { ...f.status, online: true }, previousHealth: health });
    const view = f.render(health, { online: true });
    assert.equal(view.offline, 0);
    assert.equal(view.online, 1);
    assert.doesNotMatch(view.text, /Offline confirmado|Achar IP/);
    if (successes === 1) assert.equal(health.reasonCode, 'recovering');
    else assert.match(view.text, /Operacional/);
  }
});

test('stale health stays visible as delayed telemetry and does not count as current connectivity', t => {
  const f = dashboard(t);
  const checkedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  for (const online of [false, true]) {
    const health = withStaleness(evaluatePrinterHealth({ telemetry: { online }, checkedAt }));
    const view = f.render(health, { online, cachedAt: checkedAt });
    assert.equal(view.rows.length, 1);
    assert.equal(view.online, 0);
    assert.equal(view.offline, 0);
    assert.equal(view.warning, 1);
    assert.match(view.text, /Telemetria atrasada/);
    assert.match(view.text, /Leitura armazenada/);
    assert.doesNotMatch(view.text, /Offline confirmado|Inacessível na rede|Achar IP/);
  }
});

test('Raio-X preserves stored readings and explicitly reports missing health instead of zero failures', async t => {
  const f = dashboard(t);
  f.render(null);
  await f.window.eval("openPrinterDetailDrawer('p')");
  const drawer = f.window.document.getElementById('detail-modal-body');
  assert.match(drawer.textContent, /Estado não confirmado/);
  assert.match(drawer.textContent, /Leitura armazenada/);
  assert.match(drawer.textContent, /84%/);
  assert.match(drawer.textContent, /Falhas Consecutivas\s*N\/D/);
  assert.doesNotMatch(drawer.textContent, /Offline confirmado|Buscar na Rede|falha de conectividade confirmada/);
});

test('missing IP remains unconfigured and USB collector availability keeps its separate meaning', t => {
  const f = dashboard(t);
  f.state.printers[0].ip = 'PENDENTE-p';
  const view = f.render(null);
  assert.equal(view.online, 0);
  assert.equal(view.offline, 0);
  assert.match(view.text, /Sem configuração/);
  assert.match(view.text, /Achar IP/);
  assert.equal(f.window.eval("getEffectiveHealthState({id:'usb',connectionType:'usb'},{collectorOnline:true})"), 'partial');
  assert.equal(f.window.eval("getHealthUiMeta({id:'usb',connectionType:'usb'},{collectorOnline:false}).label"), 'Coletor sem comunicação');
});

test('Raio-X offers network recovery only for confirmed failure or missing configuration', async t => {
  const f = dashboard(t);
  let health = null;
  for (let failures = 1; failures <= 3; failures++) {
    health = evaluatePrinterHealth({ telemetry: { online: false, error: 'SNMP Timeout' }, previousHealth: health });
    f.render(health);
    await f.window.eval("openPrinterDetailDrawer('p')");
    const text = f.window.document.getElementById('detail-modal-body').textContent;
    if (failures < 3) {
      assert.match(text, /Conexão instável/);
      assert.match(text, /84%/);
      assert.doesNotMatch(text, /Buscar na Rede|Offline confirmado/);
    } else {
      assert.match(text, /Buscar na Rede/);
      assert.match(text, /Offline confirmado/);
    }
  }
  const stale = withStaleness({ ...health, lastCheckAt: new Date(Date.now() - 11 * 60000).toISOString() });
  f.render(stale);
  await f.window.eval("openPrinterDetailDrawer('p')");
  assert.doesNotMatch(f.window.document.getElementById('detail-modal-body').textContent, /Buscar na Rede|Offline confirmado/);
});
