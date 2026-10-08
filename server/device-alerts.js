import { randomUUID, createHash } from 'node:crypto';
/**
 * Device Alert Engine (Projeto Hefesto)
 *
 * Gerencia alertas internos de hardware (atolamento de papel, tampa aberta, bandeja vazia/cheia, etc.)
 * de forma desacoplada da conectividade de rede e do nível de suprimentos.
 *
 * Invariantes:
 * - Um alerta interno nunca transforma falsamente uma impressora conectada em 'offline'.
 * - Textos originais do fabricante são preservados quando disponíveis.
 * - Fontes sem suporte a alertas reportam 'alertsAvailable: false' em vez de inventar estado normal.
 * - Histerese e deduplicação garantem rastreabilidade de início e resolução.
 */

export const ALERT_SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
});

export const ALERT_SOURCES = Object.freeze({
  PRT_ALERT_TABLE: 'prt_alert_table',
  HR_PRINTER_ERROR_STATE: 'hr_printer_error_state',
  HR_DEVICE_STATUS: 'hr_device_status',
  VENDOR_CUSTOM: 'vendor_custom',
  LEXMARK_EWS: 'lexmark_ews'
});

export const ALERT_CODES = Object.freeze({
  PAPER_JAM: 'paper_jam',
  PAPER_EMPTY: 'paper_empty',
  PAPER_LOW: 'paper_low',
  DOOR_OPEN: 'door_open',
  COVER_OPEN: 'cover_open',
  OUTPUT_TRAY_FULL: 'output_tray_full',
  INPUT_TRAY_MISSING: 'input_tray_missing',
  SERVICE_REQUESTED: 'service_requested',
  MAINTENANCE_REQUIRED: 'maintenance_required',
  UNKNOWN_ALERT: 'unknown_alert'
});

const DEFAULT_ALERT_LABELS = {
  [ALERT_CODES.PAPER_JAM]: 'Atolamento de papel',
  [ALERT_CODES.PAPER_EMPTY]: 'Bandeja de papel vazia',
  [ALERT_CODES.PAPER_LOW]: 'Pouco papel na bandeja',
  [ALERT_CODES.DOOR_OPEN]: 'Porta do equipamento aberta',
  [ALERT_CODES.COVER_OPEN]: 'Tampa superior aberta',
  [ALERT_CODES.OUTPUT_TRAY_FULL]: 'Bandeja de saída cheia',
  [ALERT_CODES.INPUT_TRAY_MISSING]: 'Bandeja de alimentação não inserida',
  [ALERT_CODES.SERVICE_REQUESTED]: 'Chamado técnico solicitado pelo equipamento',
  [ALERT_CODES.MAINTENANCE_REQUIRED]: 'Manutenção periódica recomendada',
  [ALERT_CODES.UNKNOWN_ALERT]: 'Aviso interno do dispositivo'
};

/**
 * Decodifica o campo binário hrPrinterDetectedErrorState (RFC 2790 / RFC 3805)
 * Bit 0: lowPaper
 * Bit 1: noPaper
 * Bit 2: lowToner
 * Bit 3: noToner
 * Bit 4: doorOpen
 * Bit 5: jammed
 * Bit 6: offline
 * Bit 7: serviceRequested
 * Bit 8: inputTrayMissing
 * Bit 9: outputTrayMissing
 * Bit 10: markerSupplyMissing
 * Bit 11: outputNearFull
 * Bit 12: outputFull
 * Bit 13: inputTrayEmpty
 * Bit 14: overduePreventMaint
 */
export function normalizePrinterErrorState(rawState) {
  let bytes = null;
  if (Buffer.isBuffer(rawState) || Array.isArray(rawState)) bytes = Array.from(rawState);
  else if (rawState?.type === 'Buffer' && Array.isArray(rawState.data)) bytes = rawState.data;
  else if (Number.isInteger(rawState) && rawState >= 0 && rawState <= 65535) bytes = [rawState & 255, rawState >> 8];
  else if (typeof rawState === 'string' && rawState.length) bytes = Array.from(rawState, c => c.charCodeAt(0));
  if (!bytes?.length || bytes.length > 32 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) return null;
  return bytes;
}

export function parseHrPrinterDetectedErrorState(rawState) {
  const bytes = normalizePrinterErrorState(rawState);
  if (!bytes) return [];
  const byte0 = bytes[0], byte1 = bytes[1] || 0;

  const alerts = [];

  // Bit 0: lowPaper (0x80 se MSB-first ou 0x01 dependendo do encoding; tratamos padrão SNMP bit 0 = 0x80)
  // No padrão SNMP RFC 2579 BITS: bit 0 é o mais significativo (0x80 do primeiro byte)
  const isBitSet = (b, bitIndex) => Boolean(b & (1 << (7 - bitIndex)));

  if (isBitSet(byte0, 0)) {
    alerts.push({ code: ALERT_CODES.PAPER_LOW, severity: ALERT_SEVERITIES.WARNING });
  }
  if (isBitSet(byte0, 1)) {
    alerts.push({ code: ALERT_CODES.PAPER_EMPTY, severity: ALERT_SEVERITIES.CRITICAL });
  }
  // Bit 2 e 3 (lowToner e noToner) são geridos pelo domínio de suprimentos, não duplicamos aqui
  if (isBitSet(byte0, 4)) {
    alerts.push({ code: ALERT_CODES.DOOR_OPEN, severity: ALERT_SEVERITIES.CRITICAL });
  }
  if (isBitSet(byte0, 5)) {
    alerts.push({ code: ALERT_CODES.PAPER_JAM, severity: ALERT_SEVERITIES.CRITICAL });
  }
  if (isBitSet(byte0, 7)) {
    alerts.push({ code: ALERT_CODES.SERVICE_REQUESTED, severity: ALERT_SEVERITIES.CRITICAL });
  }

  // Byte 1
  if (isBitSet(byte1, 0)) { // Bit 8
    alerts.push({ code: ALERT_CODES.INPUT_TRAY_MISSING, severity: ALERT_SEVERITIES.CRITICAL });
  }
  if (isBitSet(byte1, 4)) { // Bit 12
    alerts.push({ code: ALERT_CODES.OUTPUT_TRAY_FULL, severity: ALERT_SEVERITIES.WARNING });
  }
  if (isBitSet(byte1, 6)) { // Bit 14
    alerts.push({ code: ALERT_CODES.MAINTENANCE_REQUIRED, severity: ALERT_SEVERITIES.INFO });
  }

  return alerts;
}

// A row number can change when the device rotates its table; it is metadata,
// not the identity of a continuing binary condition.
export function alertIdentity(alert) {
  return JSON.stringify([alert.source, alert.code, alert.rawCode ?? null,
    alert.deviceIndex ?? null, alert.component?.group ?? null,
    alert.component?.index ?? null, alert.component?.location ?? null]);
}

export function createDeviceAlert({ printerId, code, detectedAt = new Date().toISOString(), ...data } = {}) {
  if (!printerId || !code) throw new TypeError('printerId and code are required');
  const alert = { source: ALERT_SOURCES.HR_PRINTER_ERROR_STATE, severity: 'warning',
    rawCode: null, ...data, printerId, code };
  const label = DEFAULT_ALERT_LABELS[code] || DEFAULT_ALERT_LABELS.unknown_alert;
  return { ...alert, id: randomUUID(), alertKey: alertIdentity(alert), label,
    message: data.message || label, firstSeenAt: detectedAt, lastSeenAt: detectedAt, active: true };
}

function collectEvidence(telemetry) {
  const sources = {};
  const detected = [];
  if (!telemetry.online || String(telemetry.protocol || '').startsWith('TCP (')) {
    return { sources, detected, reason: 'unsupported_alert_source' };
  }
  const bytes = normalizePrinterErrorState(telemetry.status?.errorState ?? telemetry.errorState);
  sources[ALERT_SOURCES.HR_PRINTER_ERROR_STATE] = { available: bytes !== null, complete: bytes !== null };
  for (const a of parseHrPrinterDetectedErrorState(bytes)) detected.push({ ...a, source: ALERT_SOURCES.HR_PRINTER_ERROR_STATE });
  // Only an explicit SNMP observation counts; synthetic HTTP/TCP status must not
  // turn an unavailable diagnostic source into a healthy one.
  const statusEvidence = telemetry.alertSources?.[ALERT_SOURCES.HR_DEVICE_STATUS];
  sources[ALERT_SOURCES.HR_DEVICE_STATUS] = statusEvidence || { available: false, complete: false };
  if (statusEvidence?.available && [3, 5].includes(telemetry.status?.deviceCode)) {
    detected.push({ source: ALERT_SOURCES.HR_DEVICE_STATUS, rawCode: telemetry.status.deviceCode,
      code: 'device_attention', severity: telemetry.status.deviceCode === 5 ? 'critical' : 'warning',
      message: telemetry.status.deviceDescription || 'Estado interno informado pelo equipamento' });
  }
  Object.assign(sources, telemetry.alertSources || {});
  // Availability metadata cannot replace the actual bytes of an HR observation.
  sources[ALERT_SOURCES.HR_PRINTER_ERROR_STATE] = { available: bytes !== null, complete: bytes !== null };
  const explicit = telemetry.alertSources != null;
  if (Array.isArray(telemetry.alerts) && (explicit || telemetry.alertsAvailable !== false)) {
    if (!explicit) sources[ALERT_SOURCES.VENDOR_CUSTOM] = { available: true, complete: true };
    for (const a of telemetry.alerts) {
      if (!a?.code) continue;
      const source = a.source || ALERT_SOURCES.VENDOR_CUSTOM;
      if (!explicit) sources[source] = { available: true, complete: true };
      // A partial walk may positively report a row, but cannot clear absent rows.
      if (!explicit || sources[source]?.available || sources[source]?.partial) detected.push({ ...a, source });
    }
  }
  return { sources, detected, reason: 'missing_alert_evidence' };
}

// Pure reconciliation is shared by SQLite persistence and the memory adapter.
export function reconcileDeviceAlerts({ printerId, telemetry = {}, observedAt = new Date().toISOString(),
  previousAlerts = [], previousState = null }) {
  if (!printerId || !Number.isFinite(Date.parse(observedAt))) throw new TypeError('Invalid alert observation');
  observedAt = new Date(observedAt).toISOString();
  if (previousState?.observedAt && observedAt < previousState.observedAt) {
    return { ...previousState, alerts: previousAlerts.filter(a => a.active), changed: [], ignored: true };
  }
  const { sources, detected, reason } = collectEvidence(telemetry);
  const deviceContext = typeof telemetry.info?.model === 'string' && telemetry.info.model.trim() ?
    { model: telemetry.info.model.trim().slice(0, 1024), firmware: telemetry.info.firmware || null } : null;
  const deviceUptime = Number.isInteger(telemetry.alertDeviceUptime) ? telemetry.alertDeviceUptime : previousState?.deviceUptime ?? null;
  const bootGeneration = (previousState?.bootGeneration || 0) +
    Number(deviceUptime !== null && previousState?.deviceUptime != null && deviceUptime < previousState.deviceUptime);
  const active = new Map(previousAlerts.filter(a => a.active).map(a => [a.alertKey || alertIdentity(a), { ...a }]));
  const changed = [];
  const seen = new Set();
  for (const observation of detected) {
    const data = { ...observation, deviceContext };
    const key = alertIdentity(data);
    if (data.eventKind === 'unary') {
      const event = createDeviceAlert({ ...data, printerId, detectedAt: observedAt });
      // Unary events are observations, not enduring fault conditions.
      event.id = createHash('sha256').update(JSON.stringify([printerId, key, data.rowIndex, data.deviceTimeTicks, bootGeneration])).digest('hex');
      event.active = false;
      changed.push(event);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = active.get(key);
    const next = existing ? { ...existing, ...data, lastSeenAt: observedAt } : createDeviceAlert({ ...data, printerId, detectedAt: observedAt });
    active.set(key, next); changed.push(next);
  }
  for (const [key, a] of active) {
    if (!seen.has(key) && sources[a.source]?.available && sources[a.source]?.complete) {
      changed.push({ ...a, active: false, resolvedAt: observedAt, resolutionReason: 'not_present_in_complete_snapshot' });
      active.delete(key);
    }
  }
  const alerts = [...active.values()];
  const alertsAvailable = Object.values(sources).some(s => s.available && s.complete);
  const current = alertsAvailable && alerts.every(a => seen.has(a.alertKey || alertIdentity(a)));
  const lastKnownState = alerts.some(a => a.severity === 'critical') ? 'error' : alerts.length ? 'attention' :
    (alertsAvailable ? 'normal' : previousState?.diagnostic?.lastKnownState || 'unknown');
  const diagnostic = { state: current ? lastKnownState : 'unknown', lastKnownState, current,
    coverage: [ALERT_SOURCES.HR_PRINTER_ERROR_STATE, ALERT_SOURCES.PRT_ALERT_TABLE, ALERT_SOURCES.HR_DEVICE_STATUS]
      .every(s => sources[s]?.complete && sources[s]?.available) &&
      Object.values(sources).every(s => s.complete && s.available) ? 'complete' : 'partial', observedAt };
  return { alerts, alertsAvailable, reason: alertsAvailable ? null : reason, sources, diagnostic, observedAt, deviceUptime, bootGeneration, changed };
}

export class DeviceAlertStore {
  constructor() { this.alertsByPrinter = new Map(); this.states = new Map(); }
  syncTelemetryAlerts({ printerId, ...input }) {
    if (!printerId) return { alertsAvailable: false, alerts: [] };
    const records = this.alertsByPrinter.get(printerId) || new Map();
    const result = reconcileDeviceAlerts({ printerId, ...input, previousAlerts: [...records.values()], previousState: this.states.get(printerId) });
    for (const a of result.changed) records.set(a.id, a);
    this.alertsByPrinter.set(printerId, records); this.states.set(printerId, result);
    return result;
  }
  restorePrinterAlerts(printerId, alerts) {
    if (this.alertsByPrinter.has(printerId) || !Array.isArray(alerts)) return;
    this.alertsByPrinter.set(printerId, new Map(alerts.filter(a => a?.active && a.code && a.printerId === printerId).map(a => [a.id, { ...a }])));
  }
  getActiveAlerts(printerId) { return [...(this.alertsByPrinter.get(printerId)?.values() || [])].filter(a => a.active); }
  getHistory(printerId) { return [...(this.alertsByPrinter.get(printerId)?.values() || [])]; }
  clearPrinterAlerts(printerId) { this.alertsByPrinter.delete(printerId); this.states.delete(printerId); }
}
export const deviceAlertStore = new DeviceAlertStore();
