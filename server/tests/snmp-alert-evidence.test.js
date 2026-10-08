import test from 'node:test';
import assert from 'node:assert/strict';
import { querySnmpWithVersion } from '../snmp-service.js';
import { DeviceAlertStore } from '../device-alerts.js';
const errorOid = '1.3.6.1.2.1.25.3.5.1.3.1';
function transport({ missing = false } = {}) {
  let optionalRequested = false, closed = false;
  const createSession = () => ({
    on() {}, close() { closed = true; },
    get(oids, done) {
      if (oids.includes(errorOid)) {
        optionalRequested = true; assert.equal(oids.length, 1);
        if (missing) return done(new Error('noSuchName'));
        return done(null, [{ oid: errorOid, value: Buffer.from([4]), type: 4 }]);
      }
      done(null, oids.map(oid => ({ oid, type: 4, value: oid.endsWith('.4.1.1') ? 0 : Buffer.from('HP Test') })));
    },
    subtree(oid, feed, done) { done(null); }
  });
  return { createSession, optionalRequested: () => optionalRequested, closed: () => closed };
}
test('SNMP driver queries optional hardware error OID and transports bytes into the alert engine', async () => {
  const session = transport();
  const telemetry = await querySnmpWithVersion('127.0.0.1', 'test', 1, session);
  assert.equal(session.optionalRequested(), true); assert.equal(session.closed(), true);
  assert.equal(telemetry.online, true); assert.deepEqual(telemetry.status.errorState, [4]);
  const result = new DeviceAlertStore().syncTelemetryAlerts({ printerId: 'p', telemetry });
  assert.equal(result.alertsAvailable, true); assert.equal(result.alerts[0].code, 'paper_jam');
});
test('absent optional OID leaves SNMP printer online with unknown hardware alerts', async () => {
  const session = transport({ missing: true });
  const telemetry = await querySnmpWithVersion('127.0.0.1', 'test', 0, session);
  assert.equal(telemetry.online, true); assert.equal(telemetry.status.errorState, null);
  assert.equal(new DeviceAlertStore().syncTelemetryAlerts({ printerId: 'p', telemetry }).alertsAvailable, false);
});
