import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = fs.readFileSync(path.resolve(__dirname, '../snmp-service.js'), 'utf8');

test('serial scan is not gated by MAC discovery', () => {
  const start = source.indexOf('export async function scanSubnetForMac');
  assert.notEqual(start, -1);
  const scan = source.slice(start);

  const serialBranch = scan.indexOf('if (targetSerials.length > 0)');
  const macLookup = scan.indexOf("mac = await getPrinterMacAddress(ip, 'public', timeout);", serialBranch);
  const serialPush = scan.indexOf('foundDevices.push({', serialBranch);

  assert.notEqual(serialBranch, -1);
  assert.notEqual(macLookup, -1);
  assert.notEqual(serialPush, -1);
  assert.ok(serialPush > serialBranch);
  assert.ok(macLookup > serialBranch);
  assert.match(scan, /if \(!serialMatch\) return;/);
  assert.match(scan, /MAC é enriquecimento opcional depois de o serial já ter identificado o alvo/);
});

test('serial scan probes Printer-MIB serial using v2c and v1 before optional MAC enrichment', () => {
  const start = source.indexOf('export async function scanSubnetForMac');
  const scan = source.slice(start);
  assert.match(scan, /for \(const version of \[snmp\.Version2c, snmp\.Version1\]\)/);
  assert.match(scan, /OIDs\.serialNumber/);
  assert.match(scan, /targetSerials\.includes\(cleanSerial\)/);
});
