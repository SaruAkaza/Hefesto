import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');

test('self-healing engine defines continuous background auto-recovery worker', () => {
  assert.match(source, /export async function runSelfHealingCycle\(\)/);
  assert.match(source, /setInterval\(async \(\) => \{\s*try \{\s*await runSelfHealingCycle\(\);/);
  assert.match(source, /300000\);/);
  assert.match(source, /app\.post\('\/api\/system\/self-heal'/);
});

test('self-healing filters printers with communication failure and probes their subnets', () => {
  const start = source.indexOf('export async function runSelfHealingCycle()');
  const end = source.indexOf("app.post('/api/system/self-heal'", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const engineCode = source.slice(start, end);

  assert.match(engineCode, /p\.macAddress/);
  assert.match(engineCode, /p\.serialNumber/);
  assert.match(engineCode, /health\.state === 'offline'/);
  assert.match(engineCode, /health\.state === 'snmp_timeout'/);
  assert.match(engineCode, /scanSubnetForMac\(subnet, targetMacList, scanOpts\)/);
  assert.match(engineCode, /db\.reconcilePrinterIpByMac/);
  assert.match(engineCode, /await processSinglePrinterTelemetry\(effectivePrinter\)/);
  assert.match(engineCode, /\[Self-Healing Fleet\]/);
});
