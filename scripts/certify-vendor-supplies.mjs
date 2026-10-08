import { createRequire } from 'node:module';
import fs from 'node:fs';
import { queryPrinterStatus } from '../server/snmp-service.js';

const require = createRequire(import.meta.url);
const snmp = require('../server/node_modules/net-snmp');

const [targetsPath, outputPath] = process.argv.slice(2);
if (!targetsPath || !outputPath) {
  console.error('Uso: node certify-vendor-supplies.mjs <targets.json> <output.json>');
  process.exit(2);
}

const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8').replace(/^\uFEFF/, ''));
const BROTHER_OID = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0';

function getOid(session, oid) {
  return new Promise((resolve, reject) => {
    session.get([oid], (err, varbinds) => {
      if (err) return reject(err);
      const vb = varbinds?.[0];
      if (!vb || snmp.isVarbindError(vb)) return reject(new Error(vb ? snmp.varbindError(vb) : 'sem resposta'));
      resolve(vb.value);
    });
  });
}

function parseBrotherTlv(buffer) {
  if (!Buffer.isBuffer(buffer)) return {};
  const map = {};
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset];
    if (tag === 0xFF || tag === undefined) break;
    const len = buffer[offset + 2];
    offset += 3;
    if (!Number.isInteger(len) || offset + len > buffer.length) break;
    let value = null;
    if (len === 1) value = buffer.readUInt8(offset);
    else if (len === 2) value = buffer.readUInt16BE(offset);
    else if (len === 4) value = buffer.readUInt32BE(offset);
    if (value !== null) map['0x' + tag.toString(16).toUpperCase().padStart(2, '0')] = value;
    offset += len;
  }
  return map;
}

function normalizeBrotherPct(raw) {
  if (!Number.isFinite(raw)) return null;
  return raw > 100 ? Math.round(raw / 100) : raw;
}

async function brotherEvidence(target) {
  const versions = [
    [snmp.Version2c, 'v2c'],
    [snmp.Version1, 'v1']
  ];
  for (const [version, versionName] of versions) {
    const session = snmp.createSession(target.ip, target.community || 'public', {
      port: 161,
      retries: 0,
      timeout: 1800,
      transport: 'udp4',
      version
    });
    session.on('error', () => {});
    try {
      const raw = await getOid(session, BROTHER_OID);
      const tags = parseBrotherTlv(raw);
      return {
        snmpVersion: versionName,
        tags,
        interpreted: {
          pfKit: normalizeBrotherPct(tags['0x6A']),
          laser: normalizeBrotherPct(tags['0x6B']),
          fuser: normalizeBrotherPct(tags['0x6C']),
          drum: normalizeBrotherPct(tags['0x6D']),
          toner: normalizeBrotherPct(tags['0x6F'] ?? tags['0x81'])
        }
      };
    } catch {
      // tenta a outra versao
    } finally {
      try { session.close(); } catch {}
    }
  }
  return { error: 'OID proprietaria Brother sem resposta v2c/v1' };
}

async function fetchText(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, text: '' };
    return { ok: true, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: e?.name || e?.message || 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

function extractEpsonEvidence(html) {
  if (!html) return {};
  const wasteHeightMatch = html.match(/Ink_Waste\.PNG['"]\s+height=['"](\d+)['"]/i);
  const percentMatches = [...html.matchAll(/(?:Maintenance\s*Box|Caixa\s+de\s+Manuten(?:ção|cao)|Ink[_\s-]*Waste)[\s\S]{0,180}?(\d{1,3})\s*%/gi)]
    .map(m => Number(m[1]))
    .filter(v => v >= 0 && v <= 100);
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
  return {
    title,
    hasInkWasteImage: /Ink_Waste/i.test(html),
    hasMaintenanceIcon: /Icn_Mb\.PNG/i.test(html),
    inkWasteHeight: wasteHeightMatch ? Number(wasteHeightMatch[1]) : null,
    nearbyPercentages: [...new Set(percentMatches)]
  };
}

async function epsonEvidence(target) {
  const base = 'http://' + target.ip;
  const pages = [
    ['printerInfo', '/PRESENTATION/HTML/TOP/PRTINFO.HTML'],
    ['maintenanceInfo', '/PRESENTATION/ADVANCED/INFO_MENTINFO/TOP'],
    ['root', '/']
  ];
  const result = {};
  for (const [name, path] of pages) {
    const r = await fetchText(base + path);
    result[name] = {
      ok: r.ok,
      status: r.status,
      error: r.error || null,
      evidence: extractEpsonEvidence(r.text)
    };
  }
  return result;
}

async function certify(target) {
  const started = Date.now();
  let hefesto = null;
  let hefestoError = null;
  try {
    hefesto = await queryPrinterStatus(target.ip, target.community || 'public');
  } catch (e) {
    hefestoError = e?.message || String(e);
  }

  const row = {
    vendor: target.vendor,
    family: target.family,
    name: target.name,
    ip: target.ip,
    elapsedMs: Date.now() - started,
    hefesto: hefesto ? {
      online: hefesto.online,
      protocol: hefesto.protocol || null,
      model: hefesto.info?.model || null,
      supplies: (hefesto.supplies || []).map(s => ({
        name: s.name,
        type: s.type,
        percentage: s.percentage,
        remainingPercentage: s.remainingPercentage ?? null,
        status: s.status,
        mibClass: s.mibClass || null,
        mibType: s.mibType || null,
        mibUnit: s.mibUnit || null,
        semantics: s.semantics || null
      }))
    } : null,
    hefestoError
  };

  if (target.vendor === 'Epson') row.epsonWeb = await epsonEvidence(target);
  if (target.vendor === 'Brother') row.brotherPrivate = await brotherEvidence(target);
  return row;
}

const output = [];
for (let i = 0; i < targets.length; i++) {
  const target = targets[i];
  const row = await certify(target);
  output.push(row);
  process.stderr.write(`[${i + 1}/${targets.length}] ${target.vendor} ${target.family} -> ${row.hefesto?.supplies?.length ?? 0} suprimento(s)\n`);
}

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
