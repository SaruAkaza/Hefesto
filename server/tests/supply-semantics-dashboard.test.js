import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Window } from 'happy-dom';
import { evaluatePrinterHealth } from '../health-engine.js';

function dashboard(t, supply) {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.write(readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'));
  const shared = new URL('../../public/js/supply-semantics.js', import.meta.url);
  if (existsSync(shared)) window.eval(readFileSync(shared, 'utf8'));
  const app = readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8');
  window.eval(app.slice(0, app.indexOf("document.addEventListener('DOMContentLoaded'")) +
    '\nwindow.testState = AppState; window.testAPI = API;');
  const printer = { id: 'p', name: 'Test', location: 'Sala', ip: '127.0.0.10', unitId: 'u', region: 'RJ' };
  const status = { online: true, cachedAt: new Date().toISOString(), supplies: [supply],
    info: { model: 'Test', pageCount: 10 }, status: { printerCode: 3 }, trays: [] };
  const health = evaluatePrinterHealth({ telemetry: status });
  window.testState.userRole = 'admin';
  window.testState.printers = [printer];
  window.testState.units = [{ id: 'u', name: 'Teste', region: 'RJ' }];
  window.testState.statusData.set('p', status);
  window.testState.healthData.set('p', health);
  window.testAPI.getRecharges = async () => [];
  t.after(async () => { await window.happyDOM.abort(); window.close(); });
  return { window, health };
}

for (const [name, type, semantics, expected, healthState] of [
  ['Toner Preto', 'toner', 'remaining_supply', /Esgotado/, 'critical'],
  ['Unidade de imagem', 'imaging_kit', 'remaining_supply', /Fim de vida estimado/, 'attention'],
  ['Fusor', 'fuser', 'remaining_supply', /Manutenção necessária/, 'critical'],
  ['Caixa de Manutenção', 'waste_toner', 'remaining_maintenance_life', /Manutenção necessária/, 'critical'],
  ['Waste Toner Bottle', 'waste_toner', 'remaining_receptacle_space', /Sem capacidade restante/, 'critical'],
  ['Componente X', 'other', 'unknown', /Não determinado/, 'ok']
]) {
  test(`${name} at zero has component semantics in health, list and Raio-X`, async t => {
    const f = dashboard(t, { name, type, semantics, percentage: 0 });
    assert.equal(f.health.state, healthState);
    if (type !== 'toner') assert.doesNotMatch(f.health.reason, /esgotad/i);
    const row = f.window.eval('renderPrinterRowHtml(window.testState.printers[0], true)');
    assert.match(row, expected);
    await f.window.eval("openPrinterDetailDrawer('p')");
    const text = f.window.document.getElementById('detail-modal-body').textContent;
    assert.match(text, expected);
    if (type !== 'toner') assert.doesNotMatch(text, /Esgotado/);
    for (const bar of f.window.document.querySelectorAll('#detail-modal-body .progress-fill')) {
      assert.equal(bar.style.width, '0%');
    }
  });
}

test('missing levels and sensorless tanks are never shown as zero or 85 percent', async t => {
  for (const percentage of [null, undefined, '', -1, -2, -3, false, 'bad', 101]) {
    const f = dashboard(t, { name: 'Tanque de Tinta Preta', type: 'toner', percentage });
    assert.equal(f.health.state, 'ok');
    assert.doesNotMatch(f.window.eval('renderPrinterRowHtml(window.testState.printers[0], true)'), /85%|0% \(Esgotado\)|null%|undefined%/);
    await f.window.eval("openPrinterDetailDrawer('p')");
    assert.match(f.window.document.getElementById('detail-modal-body').textContent, /Nível não observável/);
  }
});

test('high remaining maintenance capacity is healthy and unknown orientation is not inverted', async t => {
  for (const [semantics, expected] of [['remaining_maintenance_life', /88%/], ['unknown', /Não determinado/]]) {
    const f = dashboard(t, { name: 'Maintenance Box', type: 'waste_toner', percentage: 88, semantics });
    assert.equal(f.health.state, 'ok');
    await f.window.eval("openPrinterDetailDrawer('p')");
    assert.match(f.window.document.getElementById('detail-modal-body').textContent, expected);
  }
});
