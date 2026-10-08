import { isIP } from 'node:net';
import { alertIdentity } from './device-alerts.js';
import { physicalSerialKey, hasPrinterIdentityConflict } from './printer-identity.js';
import { DEFAULT_HEALTH_POLICY, withStaleness } from './health-engine.js';

export const TECHNICAL_ACTIONS = Object.freeze({
  replace_fuser: 'Troca do fusor / kit de manutenção', replace_imaging: 'Troca da unidade de imagem',
  clear_jam: 'Remoção de atolamento', configure_smtp: 'Configuração de e-mail SMTP',
  maintenance_counter_reset: 'Reset do contador de manutenção', inspection: 'Inspeção técnica', other: 'Outra intervenção'
});
const text = (value, max = 1024) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const mac = value => /^[A-F0-9]{12}$/.test(text(value).replace(/[^a-f0-9]/gi, '').toUpperCase()) ?
  text(value).replace(/[^a-f0-9]/gi, '').toUpperCase() : null;
const serial = value => { const s = physicalSerialKey(value); return s && !['DESCONHECIDO', 'LEXMARKWEB'].includes(s) ? s : null; };
const validLevel = value => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

export function captureTechnicalSnapshot({ printer, cached = {}, report = {}, health, now = Date.now() }) {
  const age = now - Date.parse(cached.cachedAt);
  const fresh = cached.online === true && Number.isFinite(age) && age >= 0 && age <= DEFAULT_HEALTH_POLICY.staleAfterMs;
  const info = cached.info || {};
  return { capturedAt: new Date(now).toISOString(), observedAt: cached.cachedAt || null, fresh, online: cached.online ?? null,
    printerId: printer.id, ip: printer.ip, unitId: printer.unitId || null,
    identity: { serialNumber: serial(info.serialNumber), macAddress: mac(info.macAddress || printer.macAddress), model: text(info.model), firmware: text(info.firmware) || null },
    health: health ? withStaleness(health, new Date(now)) : null,
    diagnostic: { ...report.diagnostic, current: fresh && report.diagnostic?.current === true },
    sources: Object.fromEntries(Object.entries(report.sources || {}).map(([key, s]) => [key, {
      available: fresh && s.available === true, complete: fresh && s.complete === true
    }])),
    alerts: (report.alerts || []).slice(0, 250).map(a => ({ id: a.id, key: a.alertKey || alertIdentity(a), source: a.source,
      code: a.code, rawCode: a.rawCode ?? null, message: text(a.message), severity: a.severity, lastSeenAt: a.lastSeenAt })),
    supplies: (cached.supplies || []).slice(0, 100).map(s => ({ key: JSON.stringify([s.index ?? null, text(s.name), s.type || null]),
      name: text(s.name), type: s.type || null, level: validLevel(s.percentage), serialNumber: serial(s.serialNumber || s.serial),
      observable: fresh && !s.estimated && s.semantics !== 'estimated_remaining_supply' })) };
}

/** Compares observations only. A declared intervention is never proof of repair. */
export function compareTechnicalSnapshots(before, after, startedAt) {
  const result = (status, reason, changes = []) => ({ status, reason, changes,
    beforeObservedAt: before?.observedAt || null, afterObservedAt: after?.observedAt || null,
    provesRepair: false });
  if (!before?.fresh || !after?.fresh) return result('not_observable', 'missing_fresh_observation');
  if (![before.observedAt, after.observedAt, startedAt].every(v => Number.isFinite(Date.parse(v)))) return result('not_observable', 'invalid_observation_time');
  if (Date.parse(after.observedAt) <= Math.max(Date.parse(before.observedAt), Date.parse(startedAt))) {
    return result('waiting_for_reading', 'no_reading_after_start');
  }
  if (before.printerId !== after.printerId || hasPrinterIdentityConflict(before.identity, after.identity)) {
    return result('identity_mismatch', 'equipment_identity_changed');
  }
  const sameSerial = before.identity.serialNumber && before.identity.serialNumber === after.identity.serialNumber;
  const sameMac = before.identity.macAddress && before.identity.macAddress === after.identity.macAddress;
  if (!sameSerial && !sameMac) return result('not_observable', 'identity_not_comparable');
  const changes = [], current = new Set(after.alerts.map(a => a.key));
  for (const alert of before.alerts) {
    if (!current.has(alert.key) && after.sources[alert.source]?.available && after.sources[alert.source]?.complete) {
      changes.push({ type: 'alert_not_present', message: alert.message, code: alert.rawCode, source: alert.source });
    }
  }
  for (const previous of before.supplies) {
    const next = after.supplies.find(s => s.key === previous.key);
    if (!previous.observable || !next?.observable) continue;
    if (previous.serialNumber && next.serialNumber && previous.serialNumber !== next.serialNumber) {
      changes.push({ type: 'supply_identity_changed', component: previous.name, before: previous.serialNumber, after: next.serialNumber });
    }
    // Consumption is normal operation; only a rise is pertinent to maintenance evidence.
    if (previous.level !== null && next.level !== null && next.level > previous.level) {
      changes.push({ type: 'supply_level_increased', component: previous.name, before: previous.level, after: next.level });
    }
  }
  if (changes.length) return result('changed', 'technical_change_observed', changes);
  const complete = before.diagnostic.current && after.diagnostic.current &&
    Object.keys(before.sources).length && Object.keys(before.sources).every(s => before.sources[s].complete && after.sources[s]?.complete);
  return result(complete ? 'unchanged' : 'not_observable', complete ? 'no_observed_change' : 'incomplete_sources');
}

export function remotePanelSupport(printer, snapshot) {
  const xm3250 = /(?:^|[^A-Z0-9])XM3250(?:$|[^A-Z0-9])/i.test(snapshot.identity.model);
  return { url: isIP(printer.ip) === 4 && snapshot.fresh ? `http://${printer.ip}/` : null,
    available: isIP(printer.ip) === 4 && snapshot.fresh, automaticActions: false,
    operatorPanel: xm3250 ? 'documented_not_validated' : 'not_certified',
    reference: xm3250 ? { title: 'Lexmark XM3250 — Device / Remote Operator Panel',
      url: 'https://publications.lexmark.com/publications/lexmark_hardware/MB2650_MX622_XM3250/UG/html/en/preferences-topic.html',
      section: 'Remote Operator Panel; guia setembro/2023, pp. 75 e 81' } : null,
    message: 'O acesso abre o painel web do equipamento na sua rede. Autenticação e permissões pertencem à impressora; reset remoto automático não foi habilitado.' };
}

export function summarizeRecurrence(database, printerId, { now = Date.now(), days = 90 } = {}) {
  const since = new Date(now - days * 86400000).toISOString();
  const rows = database.prepare(`SELECT payload_json,first_seen_at,resolved_at,active FROM device_alert_episodes
    WHERE printer_id=? AND (first_seen_at>=? OR active=1) ORDER BY first_seen_at,id LIMIT 5001`).all(printerId, since);
  const groups = new Map();
  const interventionRows = database.prepare(`SELECT i.payload_json AS intervention,e.payload_json AS outcome
    FROM technical_interventions i JOIN technical_intervention_events e ON e.intervention_id=i.id AND e.kind='outcome'
    WHERE i.printer_id=? AND e.created_at>=? ORDER BY e.created_at DESC LIMIT 1001`).all(printerId, since);
  const relatedByKey = new Map();
  for (const r of interventionRows.slice(0, 1000)) {
    const record = JSON.parse(r.intervention), outcome = JSON.parse(r.outcome);
    if (outcome.result !== 'performed') continue;
    for (const key of new Set((record.before?.alerts || []).map(a => a.key))) {
      if (!relatedByKey.has(key)) relatedByKey.set(key, []);
      relatedByKey.get(key).push({ record, outcome });
    }
  }
  for (const row of rows.slice(0, 5000)) {
    const a = JSON.parse(row.payload_json); if (a.eventKind === 'unary') continue;
    const key = a.alertKey || alertIdentity(a);
    if (!groups.has(key)) groups.set(key, { key, source: a.source, code: a.rawCode ?? a.code, message: a.message,
      occurrences: 0, active: 0, lastSeenAt: a.lastSeenAt, firstInPeriod: null, lastInPeriod: null, lastResolution: null, returnIntervalsMs: [], relatedInterventions: new Set(), latestReturnAfterInterventionMs: null });
    const g = groups.get(key); g.active += Number(row.active); g.message = a.message; g.lastSeenAt = a.lastSeenAt;
    if (row.first_seen_at >= since) {
      g.occurrences++; g.firstInPeriod ||= row.first_seen_at; g.lastInPeriod = row.first_seen_at;
      const relevant = relatedByKey.get(key) || [];
      for (const i of relevant) g.relatedInterventions.add(i.record.id);
      const previousIntervention = relevant.find(i => Date.parse(i.outcome.at) < Date.parse(row.first_seen_at));
      if (previousIntervention) g.latestReturnAfterInterventionMs = Date.parse(row.first_seen_at) - Date.parse(previousIntervention.outcome.at);
      if (g.lastResolution && Date.parse(row.first_seen_at) >= Date.parse(g.lastResolution)) {
        g.returnIntervalsMs.push(Date.parse(row.first_seen_at) - Date.parse(g.lastResolution));
      }
    }
    if (row.resolved_at) g.lastResolution = row.resolved_at;
  }
  return { days, since, truncated: rows.length > 5000 || interventionRows.length > 1000, groups: [...groups.values()].map(({ lastResolution, returnIntervalsMs, relatedInterventions, ...g }) => ({
    ...g, relatedInterventions: relatedInterventions.size, shortestReturnMs: returnIntervalsMs.length ? Math.min(...returnIntervalsMs) : null
  })).sort((a, b) => b.occurrences - a.occurrences) };
}
