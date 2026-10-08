import test from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, setDatabase, closeDatabase } from '../db.js';
import { isValidIpv4, isValidSubnetPrefix, getPrinterMacAddress, scanSubnetForMac } from '../snmp-service.js';
import { app } from '../server.js';
import { createSession } from '../auth.js';

let testDb;
let adminSessionToken;

test.before(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
  const session = createSession('admin');
  adminSessionToken = session.token;
});

test.after(() => {
  closeDatabase();
});

test('Network Diagnostics - IPv4 Validation (isValidIpv4)', () => {
  // Valid IPs
  assert.equal(isValidIpv4('198.18.5.50'), true);
  assert.equal(isValidIpv4('198.18.1.1'), true);
  assert.equal(isValidIpv4('127.0.0.1'), true);
  assert.equal(isValidIpv4('0.0.0.0'), true);
  assert.equal(isValidIpv4('255.255.255.255'), true);

  // Invalid IPs & Shell injection vectors
  assert.equal(isValidIpv4(''), false);
  assert.equal(isValidIpv4(null), false);
  assert.equal(isValidIpv4(undefined), false);
  assert.equal(isValidIpv4('198.18.5.256'), false);
  assert.equal(isValidIpv4('192.0.2.-1'), false);
  assert.equal(isValidIpv4('198.18.5'), false);
  assert.equal(isValidIpv4('192.0.2.1.1'), false);
  assert.equal(isValidIpv4('198.18.5.01'), false); // leading zeros
  assert.equal(isValidIpv4('198.18.5.50; whoami'), false);
  assert.equal(isValidIpv4('198.18.5.50 && dir'), false);
  assert.equal(isValidIpv4('198.18.5.50 | cat /etc/passwd'), false);
  assert.equal(isValidIpv4('`id`'), false);
  assert.equal(isValidIpv4('$(reboot)'), false);
});

test('Network Diagnostics - Subnet Prefix Validation (isValidSubnetPrefix)', () => {
  // Valid subnet prefixes
  assert.equal(isValidSubnetPrefix('198.18.5'), true);
  assert.equal(isValidSubnetPrefix('198.18.5.0'), true);
  assert.equal(isValidSubnetPrefix('198.18.5.0/24'), true);
  assert.equal(isValidSubnetPrefix('198.18.1'), true);

  // Invalid prefixes
  assert.equal(isValidSubnetPrefix(''), false);
  assert.equal(isValidSubnetPrefix(null), false);
  assert.equal(isValidSubnetPrefix('192.0'), false);
  assert.equal(isValidSubnetPrefix('192.0.300'), false);
  assert.equal(isValidSubnetPrefix('198.18.5; ls'), false);
  assert.equal(isValidSubnetPrefix('192.0.01'), false);
});

test('Network Diagnostics - getPrinterMacAddress with invalid inputs', async () => {
  // Invalid IPs must return null immediately without errors or executing commands
  assert.equal(await getPrinterMacAddress(''), null);
  assert.equal(await getPrinterMacAddress(null), null);
  assert.equal(await getPrinterMacAddress('pendente-123'), null);
  assert.equal(await getPrinterMacAddress('198.18.5.50; echo test'), null);
  assert.equal(await getPrinterMacAddress('invalid-ip'), null);
});

test('Network Diagnostics - scanSubnetForMac with invalid subnet', async () => {
  await assert.rejects(
    async () => {
      await scanSubnetForMac('invalid; subnet', []);
    },
    /Prefixo de sub-rede inválido/
  );
});

test('Network Diagnostics - HTTP API /api/network/detect-mac validation', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Missing IP
    const resNoIp = await fetch(`${baseUrl}/api/network/detect-mac`);
    assert.equal(resNoIp.status, 400);
    const bodyNoIp = await resNoIp.json();
    assert.match(bodyNoIp.error, /IPv4 válido/i);

    // 2. Malicious injection in IP parameter
    const resInjection = await fetch(`${baseUrl}/api/network/detect-mac?ip=${encodeURIComponent('198.18.5.50; whoami')}`);
    assert.equal(resInjection.status, 400);
    const bodyInjection = await resInjection.json();
    assert.match(bodyInjection.error, /IPv4 válido/i);

    // 3. Valid non-existent IP returns 404 (MAC not found via SNMP/ARP)
    const resValid = await fetch(`${baseUrl}/api/network/detect-mac?ip=192.0.2.1`);
    assert.equal(resValid.status, 404);
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.success, false);
  } finally {
    server.close();
  }
});

test('Network Diagnostics - HTTP API /api/system/debug-network validation and authorization', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthorized request
    const resNoAuth = await fetch(`${baseUrl}/api/system/debug-network?ip=127.0.0.1`);
    assert.equal(resNoAuth.status, 401);

    // 2. Authorized request with invalid IP
    const resInvalidIp = await fetch(`${baseUrl}/api/system/debug-network?ip=${encodeURIComponent('127.0.0.1; whoami')}`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` }
    });
    assert.equal(resInvalidIp.status, 400);

    // 3. Authorized request with valid loopback IP
    const resValid = await fetch(`${baseUrl}/api/system/debug-network?ip=127.0.0.1`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` }
    });
    assert.equal(resValid.status, 200);
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.targetIp, '127.0.0.1');
    assert.ok(bodyValid.interfaces);
  } finally {
    server.close();
  }
});
