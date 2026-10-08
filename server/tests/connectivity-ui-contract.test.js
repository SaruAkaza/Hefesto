import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = path.resolve(__dirname, '../../public/js/app.js');
const source = fs.readFileSync(appPath, 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('overview connectivity counters and online filter follow Health Engine state', () => {
  assert.match(source, /function isHealthConnectivityAvailable\(printer, status = null\)/);
  assert.match(source, /if \(isHealthConnectivityAvailable\(p, st\)\) countAccessible\+\+;/);
  assert.match(source, /if \(AppState\.overviewFilter === 'online'\) \{\s*return isHealthConnectivityAvailable\(printer, status\);/);
  const groupHeader = section('function renderGroupHeaderHtml', 'function renderPrinterRowHtml');
  assert.match(groupHeader, /if \(isHealthConnectivityAvailable\(p, st\)\) online\+\+;/);
});

test('printer list without floor groups is split into connected / offline / unconfigured sections', () => {
  const list = section('function renderMyPrinters', 'function renderGroupHeaderHtml');
  assert.match(list, /key: 'Conectadas'/);
  assert.match(list, /key: 'Fora da conexão'/);
  assert.match(list, /key: 'Sem configuração'/);
  assert.match(list, /renderGroupHeaderHtml\(key, groupPrinters\)/);
});

test('confirmed SNMP timeout is operationally shown as offline while keeping the technical cause secondary', () => {
  const healthUi = section('function getHealthUiMeta', 'function renderOverviewTab');
  assert.match(healthUi, /snmp_timeout: \{ className: 'timeout', label: 'Offline confirmado'/);
  assert.match(healthUi, /if \(health\.reasonCode === 'snmp_timeout'\) return `Timeout SNMP • \$\{formatHealthOfflineDuration\(health\)\}`;/);
});

test('printer row only declares network inaccessible after confirmed Health Engine failure', () => {
  const row = section('function renderPrinterRowHtml', 'async function refreshSinglePrinter');
  assert.match(row, /else if \(hasConfirmedConnectivityFailure\) \{\s*supplyCellHTML/);
  assert.match(row, /else if \(hasConfirmedConnectivityFailure\) \{\s*if \(curPageCount !== null\)/);
  assert.match(row, /hasConfirmedConnectivityFailure \|\| isUnconfigured/);
  assert.doesNotMatch(row, /connectivityConfirmationPending \|\| hasConfirmedConnectivityFailure/);
  assert.match(row, /Última leitura válida • (conectividade em confirmação|Verificando conexão)/);
});

test('scanner uses server-side identity/revalidation and does not ask to re-add the same IP', () => {
  const scanner = section('async function handleMacScanSubmit', 'function handleQuickAddDiscovered');
  assert.match(scanner, /const telemetryRefreshed = res\.telemetryRefreshed \|\| \[\]/);
  assert.match(scanner, /dev\.registeredPrinterId/);
  assert.match(scanner, /const telemetryRevalidated = Boolean\(dev\.telemetryOnline \|\| telemetryInfo\?\.online\)/);
  assert.match(scanner, /Mesmo IP confirmado • Telemetria revalidada/);
  assert.match(scanner, /Mesmo IP confirmado • Telemetria pendente/);
  assert.match(scanner, /hardware respondeu ao scanner, mas a telemetria completa ainda está pendente/);
  assert.match(scanner, /Usar IP Encontrado/);
  assert.match(scanner, /await loadDashboardData\(false, true\)/);
});

test('Raio-X uses confirmed connectivity failure rather than raw online bit', () => {
  const drawer = section('async function openPrinterDetailDrawer', 'function closePrinterDetailDrawer');
  assert.match(drawer, /const hasConfirmedConnectivityFailure = isHealthFailureState\(healthMeta\.state\)/);
  assert.match(drawer, /if \(!hasConfirmedConnectivityFailure && supplies\.length > 0\)/);
  assert.match(drawer, /else if \(hasConfirmedConnectivityFailure\)/);
  assert.match(drawer, /falha de conectividade confirmada/);
});

test('scanner provides immediate reconnect action and drawer link for confirmed IP', () => {
  const scanner = section('async function handleMacScanSubmit', 'function handleQuickAddDiscovered');
  assert.match(scanner, /handleScannerReconnect/);
  assert.match(scanner, /Reconectar \/ Atualizar Agora/);
  assert.match(source, /async function handleScannerReconnect\(printerId, ip, btnElement\)/);
  assert.match(source, /window\.handleScannerReconnect = handleScannerReconnect/);
});
