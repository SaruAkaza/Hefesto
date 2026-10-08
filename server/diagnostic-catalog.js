import { diagnosticCatalogData } from './diagnostic-catalog-data.js';

const clean = value => typeof value === 'string' ? value.trim() : '';
const officialUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
    ['publications.lexmark.com', 'support.lexmark.com'].includes(u.hostname); } catch { return false; }
};

/** Compile once; refuse ambiguous/unsafe catalog changes instead of guessing. */
export function createDiagnosticCatalog(data) {
  const catalog = structuredClone(data), aliases = new Map(), ids = new Set();
  if (!/^\d+\.\d+\.\d+$/.test(catalog.version) || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.reviewedAt) || !Array.isArray(catalog.profiles)) throw new TypeError('Invalid catalog metadata');
  for (const p of catalog.profiles) {
    if (!clean(p.id) || ids.has(p.id) || p.manufacturer !== 'Lexmark' || p.source !== 'lexmark_ews' ||
        !Array.isArray(p.models) || !p.models.length || !Array.isArray(p.entries) || !p.entries.length || !clean(p.reference?.title) || !clean(p.reference?.revision) ||
        !officialUrl(p.reference?.url) || (p.reference.modelReference && !officialUrl(p.reference.modelReference))) throw new TypeError('Invalid catalog profile');
    ids.add(p.id); const codes = new Set(), entries = new Set();
    for (const model of p.models) {
      if (!/^[A-Z0-9]+$/.test(model) || aliases.has(model)) throw new TypeError('Ambiguous catalog model');
      aliases.set(model, p);
    }
    for (const e of p.entries) {
      if (!clean(e.id) || entries.has(e.id) || !clean(e.component) || !clean(e.meaning) || !Array.isArray(e.codes) || !e.codes.length ||
          !Array.isArray(e.actions) || !e.actions.length || e.actions.some(a => !clean(a)) ||
          ![undefined, 'code_documented', 'message_documented'].includes(e.evidence) ||
          (e.evidence === 'message_documented' && (!Array.isArray(e.messages) || !e.messages.length || e.messages.some(m => !clean(m)) || !clean(e.limitation)))) throw new TypeError('Invalid catalog entry');
      entries.add(e.id);
      for (const code of e.codes) {
        if (!/^\d{1,3}\.[0-9A-Z]{1,3}$/.test(code) || codes.has(code)) throw new TypeError('Ambiguous catalog code');
        codes.add(code);
      }
    }
  }
  function lookup(alert) {
    const unknown = reason => ({ status: 'not_catalogued', reason, catalogVersion: catalog.version });
    if (alert?.source !== 'lexmark_ews') return unknown('unsupported_source');
    // Context belongs to the observation, never to the printer's current inventory name.
    const model = clean(alert.deviceContext?.model).toUpperCase();
    if (!model) return unknown('model_not_observed');
    const tokens = new Set(model.match(/[A-Z0-9]+/g) || []);
    const matches = [...aliases].filter(([alias]) => tokens.has(alias));
    if (matches.length !== 1) return unknown(matches.length ? 'ambiguous_model' : 'model_not_catalogued');
    const [matchedModel, profile] = matches[0];
    const entry = profile.entries.find(e => e.codes.includes(clean(alert.rawCode).toUpperCase()));
    if (!entry) return unknown('code_not_catalogued');
    if (entry.evidence === 'message_documented') {
      const message = clean(alert.message).replace(/\[\d{1,3}\.[0-9A-Z]{1,3}\]/ig, '').trim().replace(/[.!]$/, '');
      if (!entry.messages.some(m => m.toLowerCase() === message.toLowerCase())) return unknown('message_not_documented');
    }
    return { status: entry.evidence || 'code_documented', entryId: `${profile.id}/${entry.id}`,
      catalogVersion: catalog.version, manufacturer: profile.manufacturer, model: matchedModel,
      observedFirmware: clean(alert.deviceContext?.firmware) || null,
      component: entry.component, meaning: entry.meaning, actions: [...entry.actions],
      limitation: entry.limitation || 'Correspondência documental por modelo e código; não certifica todos os firmwares nem comprova reparo.',
      reference: { ...profile.reference, reviewedAt: profile.reference.reviewedAt || catalog.reviewedAt } };
  }
  return { version: catalog.version, lookup };
}

export const diagnosticCatalog = createDiagnosticCatalog(diagnosticCatalogData);
export function enrichDiagnosticReport(report) {
  const decorate = alert => ({ ...alert, knowledge: diagnosticCatalog.lookup(alert) });
  return { ...report, catalogVersion: diagnosticCatalog.version,
    alerts: (report.alerts || []).map(decorate), history: (report.history || []).map(decorate) };
}
