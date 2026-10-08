import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const snmp = require('../server/node_modules/net-snmp');

const [targetsPath, outputPath] = process.argv.slice(2);
if (!targetsPath || !outputPath) {
  console.error('Uso: node audit-printer-mib.mjs <targets.json> <output.json>');
  process.exit(2);
}

const rawTargets = fs.readFileSync(targetsPath, 'utf8').replace(/^\uFEFF/, '');
const targets = JSON.parse(rawTargets);

const CLASS = {
  1: 'other',
  3: 'supplyThatIsConsumed',
  4: 'receptacleThatIsFilled'
};

const TYPE = {
  1: 'other',
  2: 'unknown',
  3: 'toner',
  4: 'wasteToner',
  5: 'ink',
  6: 'inkCartridge',
  7: 'inkRibbon',
  8: 'wasteInk',
  9: 'opc',
  10: 'developer',
  11: 'fuserOil',
  12: 'solidWax',
  13: 'ribbonWax',
  14: 'wasteWax',
  15: 'fuser',
  16: 'coronaWire',
  17: 'fuserOilWick',
  18: 'cleanerUnit',
  19: 'fuserCleaningPad',
  20: 'transferUnit',
  21: 'tonerCartridge',
  22: 'fuserOiler',
  23: 'water',
  24: 'wasteWater',
  25: 'glueWaterAdditive',
  26: 'wastePaper',
  27: 'bindingSupply',
  28: 'bandingSupply',
  29: 'stitchingWire',
  30: 'shrinkWrap',
  31: 'paperWrap',
  32: 'staples',
  33: 'inserts',
  34: 'covers'
};

const UNIT = {
  1: 'other',
  2: 'unknown',
  3: 'tenThousandthsOfInches',
  4: 'micrometers',
  7: 'impressions',
  8: 'sheets',
  11: 'hours',
  12: 'thousandthsOfOunces',
  13: 'tenthsOfGrams',
  14: 'hundredthsOfFluidOunces',
  15: 'tenthsOfMilliliters',
  16: 'feet',
  17: 'meters',
  18: 'items',
  19: 'percent'
};

const BASE = '1.3.6.1.2.1.43.11.1.1';
const OIDS = {
  class: BASE + '.4',
  type: BASE + '.5',
  description: BASE + '.6',
  unit: BASE + '.7',
  max: BASE + '.8',
  level: BASE + '.9'
};
const SYS_DESCR = '1.3.6.1.2.1.1.1.0';
const SYS_NAME = '1.3.6.1.2.1.1.5.0';
const BROTHER_SUPPLIES = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0';

function parseValue(v) {
  if (Buffer.isBuffer(v)) return v.toString('utf8').replace(/\0/g, '').trim();
  return v;
}

function getOne(session, oid) {
  return new Promise((resolve, reject) => {
    session.get([oid], (err, varbinds) => {
      if (err) return reject(err);
      const vb = varbinds?.[0];
      if (!vb || snmp.isVarbindError(vb)) return reject(new Error(vb ? snmp.varbindError(vb) : 'sem resposta'));
      resolve(vb.value);
    });
  });
}

function subtree(session, oid) {
  return new Promise((resolve, reject) => {
    const values = {};
    session.subtree(oid, varbinds => {
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) values[vb.oid] = vb.value;
      }
    }, err => err ? reject(err) : resolve(values));
  });
}

async function auditWithVersion(target, version, versionName) {
  const session = snmp.createSession(target.ip, target.community || 'public', {
    port: 161,
    retries: 0,
    timeout: 1800,
    transport: 'udp4',
    version
  });
  session.on('error', () => {});
  try {
    const [table, sysDescrRaw, sysNameRaw] = await Promise.all([
      subtree(session, BASE),
      getOne(session, SYS_DESCR).catch(() => null),
      getOne(session, SYS_NAME).catch(() => null)
    ]);

    const indexes = new Set();
    for (const oid of Object.keys(table)) {
      const m = oid.match(/^1\.3\.6\.1\.2\.1\.43\.11\.1\.1\.[4-9]\.(.+)$/);
      if (m) indexes.add(m[1]);
    }

    let brotherRawHex = null;
    if (target.vendor === 'Brother') {
      const raw = await getOne(session, BROTHER_SUPPLIES).catch(() => null);
      if (Buffer.isBuffer(raw)) brotherRawHex = raw.toString('hex').toUpperCase();
    }

    const rows = [];
    for (const idx of [...indexes].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}))) {
      const classCode = Number(parseValue(table[OIDS.class + '.' + idx]));
      const typeCode = Number(parseValue(table[OIDS.type + '.' + idx]));
      const unitCode = Number(parseValue(table[OIDS.unit + '.' + idx]));
      const max = Number(parseValue(table[OIDS.max + '.' + idx]));
      const level = Number(parseValue(table[OIDS.level + '.' + idx]));
      const description = String(parseValue(table[OIDS.description + '.' + idx]) ?? '');

      let remainingPercent = null;
      if (Number.isFinite(max) && max > 0 && Number.isFinite(level) && level >= 0) {
        remainingPercent = Math.max(0, Math.min(100, Math.round((level / max) * 100)));
      } else if (unitCode === 19 && Number.isFinite(level) && level >= 0 && level <= 100) {
        remainingPercent = Math.round(level);
      }

      let semantics = 'unknown';
      if (classCode === 3) semantics = 'remaining_supply';
      if (classCode === 4) semantics = 'remaining_receptacle_space';

      rows.push({
        id: target.id,
        vendor: target.vendor,
        family: target.family,
        name: target.name,
        ip: target.ip,
        snmpVersion: versionName,
        sysName: String(parseValue(sysNameRaw) ?? ''),
        sysDescr: String(parseValue(sysDescrRaw) ?? ''),
        index: idx,
        classCode: Number.isFinite(classCode) ? classCode : null,
        className: CLASS[classCode] || 'unknown',
        typeCode: Number.isFinite(typeCode) ? typeCode : null,
        typeName: TYPE[typeCode] || 'unknown',
        unitCode: Number.isFinite(unitCode) ? unitCode : null,
        unitName: UNIT[unitCode] || 'unknown',
        description,
        maxCapacity: Number.isFinite(max) ? max : null,
        rawLevel: Number.isFinite(level) ? level : null,
        remainingPercent,
        semantics,
        brotherRawHex
      });
    }
    return rows;
  } finally {
    try { session.close(); } catch {}
  }
}

async function auditTarget(target) {
  if (!target.ip || target.ip === '-' || /^pendente-/i.test(target.ip)) {
    return [{...target, error: 'IP nao configurado'}];
  }
  try {
    return await auditWithVersion(target, snmp.Version2c, 'v2c');
  } catch (e2) {
    try {
      return await auditWithVersion(target, snmp.Version1, 'v1');
    } catch (e1) {
      return [{...target, error: 'SNMP sem resposta v2c/v1: ' + (e1?.message || e2?.message || 'erro')}];
    }
  }
}

const results = [];
const concurrency = 4;
let cursor = 0;

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= targets.length) return;
    const target = targets[i];
    const rows = await auditTarget(target);
    results.push(...rows);
    process.stderr.write(`[${i+1}/${targets.length}] ${target.vendor} ${target.family} ${target.ip} -> ${rows.length} linha(s)\n`);
  }
}
await Promise.all(Array.from({length: Math.min(concurrency, targets.length || 1)}, () => worker()));
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
