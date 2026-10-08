import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');

test('network scanner resumes telemetry for a registered printer found at its effective IP', () => {
  const start = source.indexOf("app.post('/api/network/scan-mac'");
  const end = source.indexOf("// Reconciliação explícita de IP via MAC", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = source.slice(start, end);

  assert.match(route, /const telemetryRefreshed = \[\]/);
  assert.match(route, /dev\.registeredPrinterId = matchedPrinter\.id/);
  assert.match(route, /const sameIpConfirmed = effectivePrinter\.ip === dev\.ip/);
  assert.match(route, /await processSinglePrinterTelemetry\(effectivePrinter\)/);
  assert.match(route, /dev\.telemetryRevalidated = Boolean\(telemetry\)/);
  assert.match(route, /telemetryRefreshed\.push\(/);
  assert.match(route, /telemetryRefreshed\s*\n\s*}\);/);
});

test('IP reconciliation is followed by telemetry against the updated printer record', () => {
  const start = source.indexOf("app.post('/api/network/scan-mac'");
  const end = source.indexOf("// Reconciliação explícita de IP via MAC", start);
  const route = source.slice(start, end);

  assert.match(route, /effectivePrinter = db\.getPrinterById\(matchedPrinter\.id\)/);
  assert.match(route, /ipReconciled = true/);
  assert.match(route, /currentIp: effectivePrinter\.ip/);
  assert.match(route, /ipChanged: matchedPrinter\.ip !== effectivePrinter\.ip/);
});
