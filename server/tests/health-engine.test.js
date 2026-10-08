import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_STATES,
  evaluatePrinterHealth,
  withStaleness
} from '../health-engine.js';

const at = '2026-09-25T12:00:00.000Z';

test('healthy SNMP telemetry is OK', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      supplies: [{ name: 'Toner Preto', percentage: 75, status: 'ok' }]
    },
    checkedAt: at,
    latencyMs: 120
  });

  assert.equal(health.state, HEALTH_STATES.OK);
  assert.equal(health.reasonCode, 'healthy');
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(health.latencyMs, 120);
});

test('warning supply produces attention state', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [{ name: 'Toner Preto', percentage: 25, status: 'warning' }]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.ATTENTION);
  assert.equal(health.reasonCode, 'supply_warning');
  assert.equal(health.warningSupply.percentage, 25);
});

test('critical supply produces critical state', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [{ name: 'Toner Preto', percentage: 8, status: 'critical' }]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.CRITICAL);
  assert.equal(health.reasonCode, 'supply_critical');
  assert.equal(health.criticalSupply.percentage, 8);
});

test('single timeout does not immediately declare printer offline', () => {
  const health = evaluatePrinterHealth({
    telemetry: { online: false, error: 'Request timed out' },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.ATTENTION);
  assert.equal(health.reasonCode, 'connectivity_degraded');
  assert.equal(health.consecutiveFailures, 1);
});

test('third timeout becomes confirmed SNMP timeout', () => {
  const previousHealth = {
    state: HEALTH_STATES.ATTENTION,
    consecutiveFailures: 2,
    consecutiveSuccesses: 0,
    lastSuccessAt: '2026-09-25T11:50:00.000Z'
  };

  const health = evaluatePrinterHealth({
    telemetry: { online: false, error: 'RequestTimedOutError: timed out' },
    previousHealth,
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.SNMP_TIMEOUT);
  assert.equal(health.reasonCode, 'snmp_timeout');
  assert.equal(health.consecutiveFailures, 3);
});

test('third non-timeout connectivity failure becomes offline', () => {
  const previousHealth = {
    state: HEALTH_STATES.ATTENTION,
    consecutiveFailures: 2,
    consecutiveSuccesses: 0
  };

  const health = evaluatePrinterHealth({
    telemetry: { online: false, error: 'Host unreachable' },
    previousHealth,
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.OFFLINE);
  assert.equal(health.reasonCode, 'offline_confirmed');
});

test('recovery from confirmed outage requires two successful readings', () => {
  const outage = {
    state: HEALTH_STATES.SNMP_TIMEOUT,
    consecutiveFailures: 3,
    consecutiveSuccesses: 0,
    lastTransitionAt: '2026-09-25T11:50:00.000Z'
  };

  const firstSuccess = evaluatePrinterHealth({
    telemetry: { online: true, protocol: 'SNMP v2c', supplies: [] },
    previousHealth: outage,
    checkedAt: '2026-09-25T12:00:00.000Z'
  });

  assert.equal(firstSuccess.state, HEALTH_STATES.ATTENTION);
  assert.equal(firstSuccess.reasonCode, 'recovering');
  assert.equal(firstSuccess.consecutiveSuccesses, 1);

  const secondSuccess = evaluatePrinterHealth({
    telemetry: { online: true, protocol: 'SNMP v2c', supplies: [] },
    previousHealth: firstSuccess,
    checkedAt: '2026-09-25T12:03:00.000Z'
  });

  assert.equal(secondSuccess.state, HEALTH_STATES.OK);
  assert.equal(secondSuccess.consecutiveSuccesses, 2);
});

test('TCP fallback is classified as partial telemetry', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      protocol: 'TCP (Porta 9100 RAW)',
      status: { deviceDescription: 'Operando (Sem SNMP)' },
      supplies: []
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.PARTIAL);
  assert.equal(health.reasonCode, 'telemetry_partial');
});

test('old health record becomes stale without changing persisted object', () => {
  const health = {
    state: HEALTH_STATES.OK,
    severity: 'ok',
    reasonCode: 'healthy',
    reason: 'ok',
    lastCheckAt: '2026-09-25T11:40:00.000Z'
  };

  const effective = withStaleness(
    health,
    new Date('2026-09-25T12:00:00.000Z'),
    { staleAfterMs: 10 * 60 * 1000 }
  );

  assert.equal(effective.state, HEALTH_STATES.STALE);
  assert.equal(effective.reasonCode, 'telemetry_stale');
  assert.equal(health.state, HEALTH_STATES.OK);
});

test('unconfigured printer is not counted as offline', () => {
  const health = evaluatePrinterHealth({
    telemetry: { online: false, error: 'IP pendente / impressora desconectada' },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.UNCONFIGURED);
  assert.equal(health.reasonCode, 'unconfigured');
  assert.equal(health.consecutiveFailures, 0);
});

test('maintenance box with high remaining life stays healthy', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [{
        name: 'Caixa de Manutenção (vida útil restante)',
        type: 'waste_toner',
        percentage: 88,
        status: 'ok'
      }]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.OK);
  assert.equal(health.reasonCode, 'healthy');
});

test('maintenance box with low remaining life produces attention', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [{
        name: 'Caixa de Manutenção (vida útil restante)',
        type: 'waste_toner',
        percentage: 25,
        status: 'warning'
      }]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.ATTENTION);
  assert.equal(health.reasonCode, 'supply_warning');
});


test('redundant Xerox black reserve at 0% does not make printer critical while K1 is healthy', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [
        { name: 'Toner Preto [K1]', type: 'toner', percentage: 100, status: 'ok' },
        { name: 'Toner Preto [K2]', type: 'toner', percentage: 0, status: 'critical' }
      ]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.OK);
  assert.equal(health.reasonCode, 'healthy');
});

test('redundant Xerox black toners still become critical when both are depleted', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      supplies: [
        { name: 'Toner Preto [K1]', type: 'toner', percentage: 5, status: 'critical' },
        { name: 'Toner Preto [K2]', type: 'toner', percentage: 0, status: 'critical' }
      ]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.CRITICAL);
  assert.equal(health.reasonCode, 'supply_critical');
});

test('null or undefined supply percentage does not coerce to 0% or trigger critical alarm', () => {
  const health = evaluatePrinterHealth({
    telemetry: {
      online: true,
      protocol: 'SNMP v2c',
      supplies: [
        { name: 'Tanque Estimado', percentage: null, status: null },
        { name: 'Sensor Sem Leitura', percentage: undefined, status: null }
      ]
    },
    checkedAt: at
  });

  assert.equal(health.state, HEALTH_STATES.OK);
  assert.equal(health.criticalSupply, null);
  assert.equal(health.warningSupply, null);
});
