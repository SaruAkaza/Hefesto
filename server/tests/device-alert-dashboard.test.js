import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

function browser(t, withApp = false) {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.write(withApp ? readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8') : '<section id="target"></section>');
  window.eval(readFileSync(new URL('../../public/js/device-alerts-ui.js', import.meta.url), 'utf8'));
  t.after(async () => { await window.happyDOM.abort(); window.close(); });
  return window;
}
const alert = () => ({ id: 'a', severity: 'critical', source: 'prt_alert_table', message: '121.13A Service Error',
  rawCode: 99999, component: { group: 10, index: 1, location: -2 }, interpretationStatus: 'not_catalogued',
  firstSeenAt: '2026-10-07T10:00:00.000Z', lastSeenAt: '2026-10-07T10:05:00.000Z', active: true });
const report = () => ({ diagnostic: { state: 'error', lastKnownState: 'error', current: true, coverage: 'partial' },
  alerts: [alert()], history: [alert()], total: 1, offset: 0 });

test('documented guidance stays collapsed and source links cannot execute untrusted content', t => {
  const w = browser(t), target = w.document.getElementById('target'), data = report(); data.history = [];
  data.alerts[0].knowledge = { status: 'code_documented', model: 'XM3350', component: 'E-mail', meaning: '<img src=x onerror=alert(1)>',
    actions: ['Conferir configuração'], limitation: 'Correspondência documental', catalogVersion: '1.0.0',
    reference: { url: 'https://publications.lexmark.com/guide', title: 'Guia do fabricante', revision: 'April 2026', reviewedAt: '2026-10-08' } };
  w.DeviceAlertsUI.render(target, data);
  assert.equal(target.querySelector('.device-alert-item details').open, false);
  assert.match(target.textContent, /Orientação documentada/); assert.equal(target.querySelector('img'), null);
  assert.equal(target.querySelector('a').rel, 'noopener noreferrer'); assert.match(target.textContent, /Catálogo 1.0.0/);
  for (const url of ['javascript:alert(1)', 'https://publications.lexmark.com.evil.invalid/guide', 'http://support.lexmark.com/guide', 'https://x:y@support.lexmark.com/guide']) {
    data.alerts[0].knowledge.reference.url = url; w.DeviceAlertsUI.render(target, data); assert.equal(target.querySelector('a'), null);
  }
  data.alerts[0].knowledge.status = 'message_documented'; w.DeviceAlertsUI.render(target, data);
  assert.match(target.textContent, /Orientação pelo texto do aviso/); assert.match(target.textContent, /Interpretação numérica do código não certificada/);
});

test('Raio-X shows independent internal state, evidence, codes, source, component and history', t => {
  const w = browser(t), target = w.document.getElementById('target'); w.DeviceAlertsUI.render(target, report());
  assert.match(target.textContent, /Erro interno/); assert.match(target.textContent, /121.13A Service Error/);
  assert.match(target.textContent, /Código: 99999/); assert.match(target.textContent, /Interpretação do código não cadastrada/);
  assert.match(target.textContent, /Mecanismo de impressão/); assert.match(target.textContent, /Leitura parcial/);
  assert.match(target.querySelector('summary').textContent, /Histórico de alertas \(1\)/);
  const stale = report(); stale.diagnostic.current = false; stale.diagnostic.state = 'unknown';
  w.DeviceAlertsUI.render(target, stale); assert.match(target.textContent, /Último estado observado: Erro interno/);
});
test('manufacturer messages and raw fields are displayed as text without executing HTML', t => {
  const w = browser(t), data = report(), payload = '<img src=x onerror="window.injected=true">';
  data.alerts[0].message = payload; data.alerts[0].rawCode = '<script>window.injected=true</script>';
  const target = w.document.getElementById('target'); w.DeviceAlertsUI.render(target, data);
  assert.match(target.textContent, /<img/); assert.equal(target.querySelector('img'), null); assert.equal(target.querySelector('script'), null);
  assert.equal(w.injected, undefined);
});
test('Lexmark evidence shows firmware and unavailable access without claiming a confirmed full reading', t => {
  const w = browser(t), target = w.document.getElementById('target'), data = report();
  data.alerts[0].source = 'lexmark_ews'; data.alerts[0].rawCode = '72.01';
  data.sources = { lexmark_ews: { available: true, complete: true, firmware: 'MXTGM.240.229', observedAt: '2026-10-08T10:00:00Z' } };
  w.DeviceAlertsUI.render(target, data);
  assert.match(target.textContent, /Lexmark: painel web/); assert.match(target.textContent, /Código: 72.01/);
  assert.match(target.textContent, /Firmware Lexmark: MXTGM.240.229/);
  data.diagnostic.current = false;
  w.DeviceAlertsUI.render(target, data); assert.match(target.textContent, /Última leitura disponível do painel web Lexmark/);
  data.sources.lexmark_ews.available = false; data.sources.lexmark_ews.reason = 'authentication_required';
  w.DeviceAlertsUI.render(target, data); assert.match(target.textContent, /acesso exige autenticação/);
  assert.doesNotMatch(target.textContent, /Painel web Lexmark consultado\./);
});
test('late or detached requests cannot replace the details of another printer', async t => {
  const w = browser(t), target = w.document.getElementById('target'); let finish;
  const first = w.DeviceAlertsUI.load(target, 'p1', () => new Promise(resolve => { finish = resolve; }));
  await w.DeviceAlertsUI.load(target, 'p2', async () => ({ ...report(), alerts: [{ ...alert(), message: 'Printer Two' }] }));
  finish(report()); await first; assert.match(target.textContent, /Printer Two/);
  target.remove(); await w.DeviceAlertsUI.load(target, 'p3', async () => report()); assert.match(target.textContent, /Printer Two/);
});
test('history pagination appends records and reports a retry after a failed read', async t => {
  const w = browser(t), target = w.document.getElementById('target'); let fail = true;
  await w.DeviceAlertsUI.load(target, 'p', async (id, offset) => {
    if (!offset) return { ...report(), total: 2 };
    if (fail) { fail = false; throw new Error('transient'); }
    return { ...report(), total: 2, offset: 1, history: [{ ...alert(), message: 'Earlier incident', active: false, resolvedAt: '2026-10-07T10:06:00.000Z' }] };
  });
  const button = target.querySelector('button'); button.click(); await w.happyDOM.whenAsyncComplete();
  assert.match(button.textContent, /Tentar novamente/); assert.equal(button.disabled, false);
  button.click(); await w.happyDOM.whenAsyncComplete();
  assert.match(target.textContent, /Earlier incident/); assert.match(target.textContent, /Encerrado na fonte/); assert.equal(target.querySelector('button'), null);
});
test('real dashboard loads alert reports in Raio-X while connectivity remains visible', async t => {
  const w = browser(t, true);
  w.eval(readFileSync(new URL('../../public/js/supply-semantics.js', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../../public/js/app.js', import.meta.url), 'utf8');
  w.eval(source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'")) + '\nwindow.state = AppState; window.api = API;');
  w.state.userRole = 'admin'; w.state.printers = [{ id: 'p', name: 'Test', ip: '127.0.0.1', location: 'Room' }];
  w.state.statusData.set('p', { online: true, cachedAt: new Date().toISOString(), info: {}, supplies: [],
    status: { printerCode: 3 }, diagnostic: report().diagnostic });
  w.state.healthData.set('p', { state: 'ok', lastCheckAt: new Date().toISOString() });
  w.api.getRecharges = async () => []; let requested;
  w.api.getPrinterAlerts = async id => { requested = id; return report(); };
  await w.eval("openPrinterDetailDrawer('p')"); await w.happyDOM.whenAsyncComplete();
  assert.equal(requested, 'p'); assert.match(w.document.getElementById('device-alert-details').textContent, /Erro interno/);
  assert.match(w.document.getElementById('detail-modal-body').textContent, /Saúde Operacional/);
  assert.match(w.eval('renderPrinterRowHtml(window.state.printers[0], true)'), /Erro interno · Ver detalhes/);
});
