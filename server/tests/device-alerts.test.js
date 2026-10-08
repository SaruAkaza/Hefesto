import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_CODES,
  ALERT_SEVERITIES,
  parseHrPrinterDetectedErrorState,
  createDeviceAlert,
  DeviceAlertStore
} from '../device-alerts.js';
import { evaluatePrinterHealth, HEALTH_STATES } from '../health-engine.js';

test('parseHrPrinterDetectedErrorState decodes hardware bits correctly', () => {
  // Bit 5 = Paper Jam (0x04 in byte 0: 00000100 -> bitIndex 5 in MSB is 1 << (7-5) = 1 << 2 = 0x04)
  const jamBuffer = Buffer.from([0x04, 0x00]);
  const jamAlerts = parseHrPrinterDetectedErrorState(jamBuffer);
  assert.equal(jamAlerts.length, 1);
  assert.equal(jamAlerts[0].code, ALERT_CODES.PAPER_JAM);
  assert.equal(jamAlerts[0].severity, ALERT_SEVERITIES.CRITICAL);

  // Bit 1 = Paper Empty (1 << (7-1) = 1 << 6 = 0x40)
  const emptyBuffer = Buffer.from([0x40, 0x00]);
  const emptyAlerts = parseHrPrinterDetectedErrorState(emptyBuffer);
  assert.equal(emptyAlerts.length, 1);
  assert.equal(emptyAlerts[0].code, ALERT_CODES.PAPER_EMPTY);
  assert.equal(emptyAlerts[0].severity, ALERT_SEVERITIES.CRITICAL);

  // Bit 4 = Door Open (1 << (7-4) = 1 << 3 = 0x08)
  const doorBuffer = Buffer.from([0x08, 0x00]);
  const doorAlerts = parseHrPrinterDetectedErrorState(doorBuffer);
  assert.equal(doorAlerts.length, 1);
  assert.equal(doorAlerts[0].code, ALERT_CODES.DOOR_OPEN);

  // Null or empty
  assert.deepEqual(parseHrPrinterDetectedErrorState(null), []);
  assert.deepEqual(parseHrPrinterDetectedErrorState(undefined), []);
  assert.deepEqual(parseHrPrinterDetectedErrorState(Buffer.from([0x00, 0x00])), []);
});

test('hardware alert does not turn an online printer into offline or snmp_timeout', () => {
  const store = new DeviceAlertStore();
  const at1 = '2026-09-30T10:00:00.000Z';

  // Printer online with Paper Jam bit set
  const syncResult = store.syncTelemetryAlerts({
    printerId: 'printer-hp-1',
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      status: {
        errorState: Buffer.from([0x04, 0x00]) // Jam
      },
      supplies: [{ name: 'Black Toner', percentage: 90, status: 'ok' }]
    },
    observedAt: at1
  });

  assert.equal(syncResult.alertsAvailable, true);
  assert.equal(syncResult.alerts.length, 1);
  assert.equal(syncResult.alerts[0].code, ALERT_CODES.PAPER_JAM);
  assert.equal(syncResult.alerts[0].active, true);

  // Evaluate health: health state should reflect device health without marking it OFFLINE
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      supplies: [{ name: 'Black Toner', percentage: 90, status: 'ok' }]
    },
    checkedAt: at1
  });

  assert.equal(health.state, HEALTH_STATES.OK);
  assert.notEqual(health.state, HEALTH_STATES.OFFLINE);
  assert.notEqual(health.state, HEALTH_STATES.SNMP_TIMEOUT);
});

test('DeviceAlertStore lifecycle: maintains firstSeenAt, updates lastSeenAt, and resolves when cleared', () => {
  const store = new DeviceAlertStore();
  const at1 = '2026-09-30T10:00:00.000Z';
  const at2 = '2026-09-30T10:05:00.000Z';
  const at3 = '2026-09-30T10:10:00.000Z';

  // 1. First occurrence of door open
  store.syncTelemetryAlerts({
    printerId: 'printer-xerox-1',
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      status: { errorState: Buffer.from([0x08, 0x00]) }
    },
    observedAt: at1
  });

  let active = store.getActiveAlerts('printer-xerox-1');
  assert.equal(active.length, 1);
  assert.equal(active[0].code, ALERT_CODES.DOOR_OPEN);
  assert.equal(active[0].firstSeenAt, at1);
  assert.equal(active[0].lastSeenAt, at1);
  assert.equal(active[0].active, true);

  // 2. Second reading 5 min later: door still open (deduplication & update lastSeenAt)
  store.syncTelemetryAlerts({
    printerId: 'printer-xerox-1',
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      status: { errorState: Buffer.from([0x08, 0x00]) }
    },
    observedAt: at2
  });

  active = store.getActiveAlerts('printer-xerox-1');
  assert.equal(active.length, 1);
  assert.equal(active[0].firstSeenAt, at1);
  assert.equal(active[0].lastSeenAt, at2);

  // 3. Third reading: operator closed the door (errorState cleared)
  store.syncTelemetryAlerts({
    printerId: 'printer-xerox-1',
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      status: { errorState: Buffer.from([0x00, 0x00]) }
    },
    observedAt: at3
  });

  active = store.getActiveAlerts('printer-xerox-1');
  assert.equal(active.length, 0); // No longer active!
});

test('telemetry via TCP fallback reports alertsAvailable as false instead of inventing clean state', () => {
  const store = new DeviceAlertStore();
  const res = store.syncTelemetryAlerts({
    printerId: 'printer-fallback-1',
    telemetry: {
      online: true,
      protocol: 'TCP (Porta 9100 RAW)',
      supplies: []
    }
  });

  assert.equal(res.alertsAvailable, false);
  assert.equal(res.reason, 'unsupported_alert_source');
});
