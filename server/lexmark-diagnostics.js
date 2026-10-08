import { isIP } from 'node:net';

export const LEXMARK_ALERT_SOURCE = 'lexmark_ews';
const STATUS_PATH = '/webglue/isw/status';
const INFO_PATH = '/webglue/webui/nodedata/DeviceInformation/?depth=10&fromReport=true';
const MAX_ROWS = 250;
const text = value => typeof value === 'string' ? value.trim() : '';
const serial = value => text(value).replace(/[\s-]/g, '').toUpperCase();
const knownSerial = value => /^[A-Z0-9]{7,32}$/.test(serial(value)) && !/^(UNKNOWN|DESCONHECIDO|LEXMARKWEB)$/.test(serial(value));

export function parseLexmarkDeviceInformation(document) {
  const nodes = document?.nodes?.nodes, settings = document?.nodes?.settings;
  const value = name => {
    const node = nodes?.[name];
    return node?.reportValue ?? settings?.[node?.setting]?.val;
  };
  const serialNumber = text(value('SerialNumberLxk') ?? value('ProcessorSerialNumber') ?? value('SerialNumber'));
  const count = value('TotalPageCount');
  return { serialNumber: knownSerial(serialNumber) ? serialNumber : null,
    pageCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
    firmware: text(value('BaseRevision')) || null, firmwareDate: text(value('FirmwareDate')) || null };
}

// The EWS itself classifies "ir" as an alert and "warning" as a warning.
// Codes are copied only from the displayed message, never derived from an NPA triplet.
export function parseLexmarkStatus(document) {
  if (!Array.isArray(document) || !document.length) return { alerts: [], available: false, complete: false, reason: 'unrecognized_status' };
  const alerts = []; let complete = document.length <= MAX_ROWS, observed = false;
  for (const row of document.slice(0, MAX_ROWS)) {
    if (!row || !['status', 'ir', 'warning', 'action'].includes(row.type)) { complete = false; continue; }
    if (row.type === 'action') continue;
    if (typeof row.IrTitle !== 'string' || row.IrTitle.length > 2048) { complete = false; continue; }
    if (row.type === 'status') { observed ||= Boolean(text(row.IrTitle)); continue; }
    if (!text(row.IrTitle) || !Number.isSafeInteger(row.id) || row.id < 0 ||
        !Number.isSafeInteger(row.concurrency) || row.concurrency < 0) { complete = false; continue; }
    observed = true;
    const displayedCode = row.IrTitle.match(/\[([0-9]{1,3}\.[0-9A-Z]{1,3})\]/i)?.[1] ?? null;
    alerts.push({ source: LEXMARK_ALERT_SOURCE, code: `lexmark_isw_${row.id}_${row.concurrency}`,
      rawCode: displayedCode, message: text(row.IrTitle), severity: row.type === 'ir' ? 'critical' : 'warning',
      interpretationStatus: 'not_catalogued', manufacturerId: row.id, manufacturerConcurrency: row.concurrency,
      manufacturerType: row.type, npaTriplet: text(row.npaTriplet) || null });
  }
  return { alerts, available: observed, complete: observed && complete, partial: observed && !complete,
    reason: observed ? (complete ? null : 'incomplete_status') : 'unrecognized_status' };
}

async function readText(fetchImpl, url, signal) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal,
    headers: { Accept: 'application/json, text/html;q=0.5' } });
  if (!response.ok) throw new Error([401, 403].includes(response.status) ? 'authentication_required' : 'http_unavailable');
  if (Number(response.headers.get('content-length')) > 512 * 1024) throw new Error('response_too_large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_response');
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) throw new Error('response_too_large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

/** Read-only paths observed in the manufacturer's EWS. Not a public API contract.
 * A single deadline covers headers AND bodies. Failure never invalidates SNMP.
 * includePages reuses the same bounded requests for the legacy HTTP fallback.
 */
export async function readLexmarkEws(ip, { fetchImpl = fetch, timeoutMs = 2500, includePages = false } = {}) {
  const paths = [STATUS_PATH, INFO_PATH, ...(includePages ? ['/', '/webglue/content?c=%2FStatus'] : [])];
  if (isIP(ip) !== 4) return { documents: {}, reason: 'invalid_address' };
  const controller = new AbortController(); let timer;
  const documents = {};
  const deadline = new Promise(resolve => { timer = setTimeout(() => {
    controller.abort(); resolve({ documents, reason: 'timeout' });
  }, Math.min(10000, Math.max(1, timeoutMs))); });
  const requests = Promise.all(paths.map(async path => {
    try { documents[path] = { text: await readText(fetchImpl, `http://${ip}${path}`, controller.signal) }; }
    catch (error) { documents[path] = { reason: controller.signal.aborted ? 'timeout' : error.message }; }
  })).then(() => ({ documents, reason: null }));
  try { return await Promise.race([requests, deadline]); }
  finally { clearTimeout(timer); controller.abort(); }
}

export function lexmarkDiagnosticsFromDocuments({ documents, reason }, expectedSerial = null) {
  const decode = path => { try { return JSON.parse(documents[path]?.text); } catch { return null; } };
  const info = parseLexmarkDeviceInformation(decode(INFO_PATH));
  const source = { available: false, complete: false, adapter: 'webglue-isw-v1',
    observedAt: new Date().toISOString(), reason: reason || documents[INFO_PATH]?.reason || 'identity_not_observable' };
  if (!info.serialNumber) return { info: {}, alerts: [], alertSources: { [LEXMARK_ALERT_SOURCE]: source } };
  if (knownSerial(expectedSerial) && serial(expectedSerial) !== serial(info.serialNumber)) {
    source.reason = 'identity_mismatch';
    return { info: {}, alerts: [], alertSources: { [LEXMARK_ALERT_SOURCE]: source } };
  }
  Object.assign(source, { firmware: info.firmware, firmwareDate: info.firmwareDate, serialVerified: true });
  const parsed = parseLexmarkStatus(decode(STATUS_PATH));
  Object.assign(source, parsed, { reason: documents[STATUS_PATH]?.reason || parsed.reason });
  delete source.alerts;
  return { info, alerts: parsed.alerts, alertSources: { [LEXMARK_ALERT_SOURCE]: source } };
}

export async function enrichLexmarkDiagnostics(result, ip, options) {
  if (!/\blexmark\b/i.test(`${result?.info?.model || ''} ${result?.info?.description || ''}`)) return result;
  const diagnostic = lexmarkDiagnosticsFromDocuments(await readLexmarkEws(ip, options), result.info.serialNumber);
  return { ...result,
    info: { ...result.info, ...(diagnostic.info.firmware ? { firmware: diagnostic.info.firmware } : {}) },
    alerts: [...(result.alerts || []), ...diagnostic.alerts],
    alertSources: { ...result.alertSources, ...diagnostic.alertSources } };
}
