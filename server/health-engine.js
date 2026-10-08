import '../public/js/supply-semantics.js';
const supplySemantics = globalThis.HefestoSupplySemantics;

export const HEALTH_STATES = Object.freeze({
  OK: 'ok',
  ATTENTION: 'attention',
  CRITICAL: 'critical',
  OFFLINE: 'offline',
  SNMP_TIMEOUT: 'snmp_timeout',
  PARTIAL: 'partial',
  STALE: 'stale',
  UNCONFIGURED: 'unconfigured'
});

export const DEFAULT_HEALTH_POLICY = Object.freeze({
  failureThreshold: 3,
  recoveryThreshold: 2,
  staleAfterMs: 10 * 60 * 1000,
  criticalSupplyPct: 10,
  warningSupplyPct: 30
});

function mergePolicy(policy = {}) {
  return { ...DEFAULT_HEALTH_POLICY, ...policy };
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function isTimeoutError(error) {
  const text = String(error || '').toLowerCase();
  return text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('requesttimedouterror') ||
    text.includes('tempo limite');
}

function isUnconfiguredError(error) {
  const text = String(error || '').toLowerCase();
  return text.includes('ip pendente') ||
    text.includes('ip não configurado') ||
    text.includes('ip nao configurado');
}

function normalizedSupply(supply, policy) {
  if (!supply || typeof supply !== 'object') return null;
  const assessment = supplySemantics.describe(supply, policy);
  if (assessment.status === 'unknown') return null;
  return {
    ...supply,
    name: supply.name || 'Suprimento',
    type: supply.type || 'other',
    percentage: assessment.percentage,
    status: assessment.status,
    condition: assessment.condition,
    label: assessment.label,
    valueLabel: assessment.valueLabel
  };
}

function isDualBlackToner(supply) {
  if (!supply) return false;
  const name = String(supply.name || '').toLowerCase();
  return supplySemantics.component(supply) === 'consumable' &&
    /(?:^|[^a-z0-9])k[12](?:[^a-z0-9]|$)/i.test(name);
}

function suppressRedundantBlackReserve(normalized = [], policy = DEFAULT_HEALTH_POLICY) {
  const dualBlack = normalized.filter(isDualBlackToner);
  if (dualBlack.length < 2) return normalized;

  // Algumas Xerox C60/C70 possuem K1 ativo + K2 reserva. Um K2 vazio não deve
  // tornar a impressora crítica enquanto outro toner preto redundante estiver
  // operacional. Mantemos o comportamento histórico correto do painel antigo.
  const hasOperationalBlack = dualBlack.some(s => s.percentage > policy.criticalSupplyPct);
  if (!hasOperationalBlack) return normalized;
  return normalized.filter(s => !isDualBlackToner(s) || s.percentage > policy.criticalSupplyPct);
}

function classifySupplies(supplies = [], policy = DEFAULT_HEALTH_POLICY) {
  const normalized = suppressRedundantBlackReserve(
    supplies.map(s => normalizedSupply(s, policy)).filter(Boolean),
    policy
  );

  // A mesma regra de componente/medida é usada na lista e no Raio-X.
  // Status genérico do driver não transforma fim de vida em toner esgotado.
  const critical = normalized
    .filter(s => s.status === 'critical')
    .sort((a, b) => a.percentage - b.percentage)[0] || null;

  const warning = normalized
    .filter(s => s.status === 'warning')
    .sort((a, b) => a.percentage - b.percentage)[0] || null;

  return { critical, warning };
}

function isPartialTelemetry(telemetry = {}) {
  if (!telemetry.online) return false;

  const protocol = String(telemetry.protocol || '').toLowerCase();
  const description = String(
    telemetry?.status?.deviceDescription ||
    telemetry?.status?.printerDescription ||
    ''
  ).toLowerCase();

  return protocol.startsWith('tcp ') ||
    protocol.includes('sem snmp') ||
    description.includes('sem snmp');
}

function telemetrySource(telemetry = {}) {
  if (telemetry.protocol) return telemetry.protocol;
  if (telemetry.online) return 'SNMP';
  return 'indisponível';
}

function isDegradedState(state) {
  return [
    HEALTH_STATES.OFFLINE,
    HEALTH_STATES.SNMP_TIMEOUT,
    HEALTH_STATES.STALE
  ].includes(state);
}

export function evaluatePrinterHealth({
  telemetry = {},
  previousHealth = null,
  checkedAt = new Date().toISOString(),
  latencyMs = null,
  policy = {}
} = {}) {
  const cfg = mergePolicy(policy);
  const nowIso = toIso(checkedAt);
  const prev = previousHealth || {};
  const online = Boolean(telemetry.online);
  const lastState = prev.state || null;
  const { critical, warning } = classifySupplies(telemetry.supplies || [], cfg);

  let state;
  let severity;
  let reasonCode;
  let reason;
  let consecutiveFailures = Number(prev.consecutiveFailures) || 0;
  let consecutiveSuccesses = Number(prev.consecutiveSuccesses) || 0;
  let lastSuccessAt = prev.lastSuccessAt || null;
  let lastFailureAt = prev.lastFailureAt || null;
  let lastError = prev.lastError || null;

  if (!online && isUnconfiguredError(telemetry.error)) {
    state = HEALTH_STATES.UNCONFIGURED;
    severity = 'info';
    reasonCode = 'unconfigured';
    reason = 'Impressora cadastrada sem endereço IP operacional.';
    consecutiveFailures = 0;
    consecutiveSuccesses = 0;
    lastError = telemetry.error || null;
  } else if (!online) {
    consecutiveFailures += 1;
    consecutiveSuccesses = 0;
    lastFailureAt = nowIso;
    lastError = telemetry.error || 'Falha de comunicação com a impressora';

    if (consecutiveFailures >= cfg.failureThreshold) {
      if (isTimeoutError(lastError)) {
        state = HEALTH_STATES.SNMP_TIMEOUT;
        reasonCode = 'snmp_timeout';
        reason = `Timeout de comunicação confirmado após ${consecutiveFailures} falhas consecutivas.`;
      } else {
        state = HEALTH_STATES.OFFLINE;
        reasonCode = 'offline_confirmed';
        reason = `Impressora indisponível após ${consecutiveFailures} falhas consecutivas.`;
      }
      severity = 'critical';
    } else {
      state = HEALTH_STATES.ATTENTION;
      severity = 'warning';
      reasonCode = 'connectivity_degraded';
      reason = `Falha de comunicação ${consecutiveFailures}/${cfg.failureThreshold}; aguardando confirmação antes de declarar offline.`;
    }
  } else {
    consecutiveFailures = 0;
    consecutiveSuccesses += 1;
    lastSuccessAt = nowIso;
    lastError = null;

    if (isDegradedState(lastState) && consecutiveSuccesses < cfg.recoveryThreshold) {
      state = HEALTH_STATES.ATTENTION;
      severity = 'warning';
      reasonCode = 'recovering';
      reason = `Comunicação restabelecida; aguardando ${cfg.recoveryThreshold} leituras válidas consecutivas para confirmar recuperação.`;
    } else if (isPartialTelemetry(telemetry)) {
      state = HEALTH_STATES.PARTIAL;
      severity = 'warning';
      reasonCode = 'telemetry_partial';
      reason = 'Equipamento acessível, porém sem telemetria SNMP completa.';
    } else if (critical) {
      state = HEALTH_STATES.CRITICAL;
      severity = 'critical';
      reasonCode = 'supply_critical';
      reason = `${critical.name}: ${critical.label} (${critical.valueLabel}).`;
    } else if (warning) {
      state = HEALTH_STATES.ATTENTION;
      severity = 'warning';
      reasonCode = 'supply_warning';
      reason = `${warning.name}: ${warning.label} (${warning.valueLabel}).`;
    } else {
      state = HEALTH_STATES.OK;
      severity = 'ok';
      reasonCode = 'healthy';
      reason = 'Comunicação e telemetria dentro dos parâmetros esperados.';
    }
  }

  const previousTransition = prev.lastTransitionAt || nowIso;
  const lastTransitionAt = lastState && lastState === state ? previousTransition : nowIso;

  return {
    state,
    severity,
    reasonCode,
    reason,
    consecutiveFailures,
    consecutiveSuccesses,
    lastCheckAt: nowIso,
    lastSuccessAt,
    lastFailureAt,
    lastTransitionAt,
    latencyMs: Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null,
    lastError,
    criticalSupply: critical,
    warningSupply: warning,
    telemetrySource: telemetrySource(telemetry)
  };
}

export function withStaleness(health, now = new Date(), policy = {}) {
  if (!health) return null;
  const cfg = mergePolicy(policy);
  const lastCheckMs = health.lastCheckAt ? new Date(health.lastCheckAt).getTime() : NaN;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (!Number.isFinite(lastCheckMs) || !Number.isFinite(nowMs)) return health;
  const ageMs = Math.max(0, nowMs - lastCheckMs);
  if (ageMs <= cfg.staleAfterMs) {
    return { ...health, stale: false, ageMs };
  }

  return {
    ...health,
    state: HEALTH_STATES.STALE,
    severity: 'warning',
    reasonCode: 'telemetry_stale',
    reason: `Telemetria sem atualização há ${Math.floor(ageMs / 60000)} minuto(s).`,
    stale: true,
    ageMs
  };
}
