import { normalizePrinterErrorState } from './device-alerts.js';
import { readPrinterMibAlerts } from './printer-mib-alerts.js';
import { enrichLexmarkDiagnostics, readLexmarkEws, lexmarkDiagnosticsFromDocuments } from './lexmark-diagnostics.js';
import snmp from 'net-snmp';
import net from 'net';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Garante que requisições HTTP internas para impressoras não sejam desviadas para proxy corporativo
if (!process.env.NO_PROXY && !process.env.no_proxy) {
  process.env.NO_PROXY = 'localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16';
}

/**
 * Valida estritamente se uma string é um endereço IPv4 válido (4 octetos de 0 a 255).
 */
export function isValidIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  const match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  for (let i = 1; i <= 4; i++) {
    const num = Number(match[i]);
    if (num < 0 || num > 255) return false;
    if (match[i].length > 1 && match[i].startsWith('0')) return false;
  }
  return true;
}

/**
 * Valida estritamente se um prefixo de sub-rede (/24) possui 3 octetos válidos (0 a 255).
 */
export function isValidSubnetPrefix(prefix) {
  if (typeof prefix !== 'string') return false;
  let clean = prefix.trim().replace(/\/24$/, '').replace(/\.0$/, '');
  const match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  for (let i = 1; i <= 3; i++) {
    const num = Number(match[i]);
    if (num < 0 || num > 255) return false;
    if (match[i].length > 1 && match[i].startsWith('0')) return false;
  }
  return true;
}

// OIDs padrão da Printer MIB (RFC 3805) e Host Resources MIB
const OIDs = {
  sysName:        '1.3.6.1.2.1.1.5.0',
  sysDescr:       '1.3.6.1.2.1.1.1.0',
  hrDeviceDescr:  '1.3.6.1.2.1.25.3.2.1.3.1',
  serialNumber:   '1.3.6.1.2.1.43.5.1.1.17.1',
  hrDeviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
  hrPrinterStatus:'1.3.6.1.2.1.25.3.5.1.2.1',
  hrPrinterDetectedErrorState: '1.3.6.1.2.1.25.3.5.1.3.1',
  pageCount:      '1.3.6.1.2.1.43.10.2.1.4.1.1',
  suppliesClass:  '1.3.6.1.2.1.43.11.1.1.4',
  suppliesType:   '1.3.6.1.2.1.43.11.1.1.5',
  suppliesDesc:   '1.3.6.1.2.1.43.11.1.1.6',
  suppliesUnit:   '1.3.6.1.2.1.43.11.1.1.7',
  suppliesMax:    '1.3.6.1.2.1.43.11.1.1.8',
  suppliesLevel:  '1.3.6.1.2.1.43.11.1.1.9',
  trayName:       '1.3.6.1.2.1.43.8.2.1.13',
  trayMax:        '1.3.6.1.2.1.43.8.2.1.9',
  trayLevel:      '1.3.6.1.2.1.43.8.2.1.10'
};

// Mapeamento de status do dispositivo (hrDeviceStatus)
const DEVICE_STATUS_MAP = {
  1: 'Desconhecido',
  2: 'Operando',
  3: 'Atenção',
  4: 'Testando',
  5: 'Desligado'
};

// Mapeamento de status da impressora (hrPrinterStatus)
const PRINTER_STATUS_MAP = {
  1: 'Outro',
  2: 'Desconhecido',
  3: 'Ociosa',
  4: 'Imprimindo',
  5: 'Aquecendo'
};

// Ícones por tipo de suprimento
const SUPPLY_ICONS = {
  toner: '🎨',
  maintenance_kit: '🔧',
  imaging_kit: '📷',
  waste_toner: '🗑️',
  fuser: '🔥',
  transfer: '↔️',
  other: '📦'
};

/**
 * Formata um MAC Address binário ou texto no padrão XX:XX:XX:XX:XX:XX
 */
export function formatMacAddress(raw) {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) {
    if (raw.length === 6) {
      return Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
    }
    const hex = raw.toString('hex');
    if (hex.length === 12) {
      return hex.match(/../g).join(':').toUpperCase();
    }
  }
  if (typeof raw === 'string') {
    const clean = raw.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (clean.length === 12) {
      return clean.match(/../g).join(':');
    }
  }
  return null;
}

// OID Proprietária Brother para Suprimentos (Toner, Cilindro, Fusor, Laser, Kit PF)
const BROTHER_OID_SUPPLIES = '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0';

/**
 * Decodifica o buffer binário TLV (Type-Length-Value) da MIB Brother
 */
function parseBrotherTlv(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const map = new Map();
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset];
    if (tag === 0xFF || tag === undefined) break;
    const type = buffer[offset + 1];
    const len = buffer[offset + 2];
    offset += 3;
    if (offset + len > buffer.length) break;
    if (len === 1) {
      map.set(tag, buffer.readUInt8(offset));
    } else if (len === 2) {
      map.set(tag, buffer.readUInt16BE(offset));
    } else if (len === 4) {
      map.set(tag, buffer.readUInt32BE(offset));
    }
    offset += len;
  }
  return map;
}

/**
 * Extrai os suprimentos mapeados da MIB Brother
 */
function extractBrotherSupplies(tlvMap) {
  if (!tlvMap) return [];
  const supplies = [];

  // Toner Preto: Tag 0x6F (escala 0-10000) ou Tag 0x81 (escala 0-100)
  let tonerPct = -1;
  if (tlvMap.has(0x6F)) {
    const raw = tlvMap.get(0x6F);
    tonerPct = raw > 100 ? Math.round(raw / 100) : raw;
  } else if (tlvMap.has(0x81)) {
    tonerPct = tlvMap.get(0x81);
  }

  if (tonerPct >= 0) {
    supplies.push({
      name: 'Toner Preto (Black)',
      level: tonerPct,
      maxLevel: 100,
      percentage: tonerPct,
      type: 'toner',
      status: parseSupplyStatus(tonerPct),
      remainingPercentage: tonerPct,
      semantics: 'remaining_supply',
      source: 'brother_private',
      icon: '⬛'
    });
  }

  // Cilindro / Unidade de Imagem (Drum Unit): Tag 0x6D (escala 0-10000)
  if (tlvMap.has(0x6D)) {
    const raw = tlvMap.get(0x6D);
    const drumPct = raw > 100 ? Math.round(raw / 100) : raw;
    supplies.push({
      name: 'Unidade de Cilindro (Drum)',
      level: drumPct,
      maxLevel: 100,
      percentage: drumPct,
      type: 'imaging_kit',
      status: parseSupplyStatus(drumPct),
      remainingPercentage: drumPct,
      semantics: 'remaining_supply',
      source: 'brother_private',
      icon: '🔄'
    });
  }

  // Fusor: Tag 0x6C
  if (tlvMap.has(0x6C)) {
    const raw = tlvMap.get(0x6C);
    const fuserPct = raw > 100 ? Math.round(raw / 100) : raw;
    supplies.push({
      name: 'Unidade Fusora (Fuser)',
      level: fuserPct,
      maxLevel: 100,
      percentage: fuserPct,
      type: 'fuser',
      status: parseSupplyStatus(fuserPct),
      remainingPercentage: fuserPct,
      semantics: 'remaining_supply',
      source: 'brother_private',
      icon: '🔥'
    });
  }

  // Unidade Laser: Tag 0x6B
  if (tlvMap.has(0x6B)) {
    const raw = tlvMap.get(0x6B);
    const laserPct = raw > 100 ? Math.round(raw / 100) : raw;
    supplies.push({
      name: 'Unidade Laser',
      level: laserPct,
      maxLevel: 100,
      percentage: laserPct,
      type: 'other',
      status: parseSupplyStatus(laserPct),
      remainingPercentage: laserPct,
      semantics: 'remaining_supply',
      source: 'brother_private',
      icon: '⚡'
    });
  }

  // Kit de Alimentação de Papel (PF Kit): Tag 0x6A
  if (tlvMap.has(0x6A)) {
    const raw = tlvMap.get(0x6A);
    const pfPct = raw > 100 ? Math.round(raw / 100) : raw;
    supplies.push({
      name: 'Kit de Alimentação de Papel (PF Kit)',
      level: pfPct,
      maxLevel: 100,
      percentage: pfPct,
      type: 'maintenance_kit',
      status: parseSupplyStatus(pfPct),
      remainingPercentage: pfPct,
      semantics: 'remaining_supply',
      source: 'brother_private',
      icon: '📦'
    });
  }

  return supplies;
}

export function checkTcpPort(ip, port, timeout = 1200) {
  return new Promise(resolve => {
    if (!ip || ip.startsWith('pendente-') || ip === '-') return resolve(false);
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, ip);
  });
}

const getSessionOptions = (version = snmp.Version2c) => ({
  port: 161,
  retries: 0,
  timeout: 1800,
  transport: "udp4",
  version: version,
});

// Promisify sessão get com recuperação individual de OIDs para SNMPv1 (apenas se não for timeout de rede)
const getOids = (session, oidsList) => {
  return new Promise((resolve, reject) => {
    session.get(oidsList, async (error, varbinds) => {
      if (error) {
        const isTimeout = error.name === 'RequestTimedOutError' || (error.message && error.message.includes('timed out'));
        // Se falhar e NÃO for timeout (ex: agente SNMPv1 retornou noSuchName para uma OID da lista),
        // consulta as OIDs individualmente para salvar as que existem
        if (!isTimeout && oidsList.length > 1) {
          const results = {};
          let anySuccess = false;
          for (const singleOid of oidsList) {
            try {
              const singleVal = await new Promise((res, rej) => {
                session.get([singleOid], (err, vbs) => {
                  if (err || !vbs || !vbs[0] || snmp.isVarbindError(vbs[0])) return rej(err || new Error('varbind error'));
                  res(vbs[0].value);
                });
              });
              results[singleOid] = singleVal;
              anySuccess = true;
            } catch (e) {
              // Silencia OID ausente no agente
            }
          }
          if (anySuccess) return resolve(results);
        }
        return reject(error);
      }
      const results = {};
      for (let i = 0; i < varbinds.length; i++) {
        if (!snmp.isVarbindError(varbinds[i])) {
          results[oidsList[i]] = varbinds[i].value;
        }
      }
      resolve(results);
    });
  });
};

// Promisify sessão subtree
const getSubtree = (session, oid) => {
  return new Promise((resolve, reject) => {
    const results = {};
    session.subtree(oid, (varbinds) => {
      for (let i = 0; i < varbinds.length; i++) {
        if (!snmp.isVarbindError(varbinds[i])) {
          results[varbinds[i].oid] = varbinds[i].value;
        }
      }
    }, (error) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
};

// Converte Buffer para string legível
const parseBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value.toString('utf-8').replace(/\0/g, '').trim();
  if (typeof value === 'number') return value;
  return String(value).trim();
};

// Classifica o tipo de suprimento baseado no nome retornado pelo SNMP
const parseSupplyType = (name) => {
  const n = name.toLowerCase();
  if (n.includes('waste') || n.includes('resíduo') || n.includes('residuo') || n.includes('coletor') || n.includes('maintenance box')) return 'waste_toner';
  if (n.includes('maintenance') || n.includes('manutenção') || n.includes('manutencao')) return 'maintenance_kit';
  if (n.includes('imaging') || n.includes('imagem') || n.includes('drum') || n.includes('cilindro') || n.includes('photo') || n.includes('conductor')) return 'imaging_kit';
  if (n.includes('fuser') || n.includes('fusor')) return 'fuser';
  if (n.includes('transfer') || n.includes('transferência') || n.includes('transferencia') || n.includes('belt')) return 'transfer';
  if (n.includes('toner') || n.includes('cartucho') || n.includes('ink') || n.includes('tinta')) return 'toner';
  return 'other';
};

const MIB_SUPPLY_CLASS = {
  1: 'other',
  3: 'supplyThatIsConsumed',
  4: 'receptacleThatIsFilled'
};

const MIB_SUPPLY_TYPE = {
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
  18: 'cleanerUnit',
  19: 'fuserCleaningPad',
  20: 'transferUnit',
  21: 'tonerCartridge'
};

const MIB_SUPPLY_UNIT = {
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

const mapMibTypeToInternal = (typeCode, name = '') => {
  switch (Number(typeCode)) {
    case 3:
    case 5:
    case 6:
    case 21:
      return 'toner';
    case 4:
    case 8:
    case 14:
    case 24:
      return 'waste_toner';
    case 9:
      return 'imaging_kit';
    case 15:
      return 'fuser';
    case 18:
    case 19:
      return 'maintenance_kit';
    case 20:
      return 'transfer';
    default:
      return parseSupplyType(name);
  }
};

export function normalizePrinterMibSupply({
  name,
  classCode,
  typeCode,
  unitCode,
  maxLevel,
  currentLevel
}) {
  const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
  const max = numeric(maxLevel);
  const level = numeric(currentLevel);
  const mibClass = MIB_SUPPLY_CLASS[Number(classCode)] || 'unknown';
  const mibType = MIB_SUPPLY_TYPE[Number(typeCode)] || 'unknown';
  const mibUnit = MIB_SUPPLY_UNIT[Number(unitCode)] || 'unknown';

  let percentage = -1;
  if (level === -1) percentage = -1;
  else if (level === -2) percentage = -2;
  else if (level === -3) percentage = -3;
  else if (max > 0 && level !== null && level >= 0 && level <= max) {
    percentage = Math.round((level / max) * 100);
  } else if (Number(unitCode) === 19 && level !== null && level >= 0 && level <= 100 && !(max > 0)) {
    percentage = Math.round(level);
  } else if (level === 0) {
    percentage = 0;
  }

  const semantics = mibClass === 'receptacleThatIsFilled'
    ? 'remaining_receptacle_space'
    : mibClass === 'supplyThatIsConsumed'
      ? 'remaining_supply'
      : 'unknown';

  return {
    name,
    level,
    maxLevel: max,
    percentage,
    remainingPercentage: percentage >= 0 ? percentage : null,
    type: mapMibTypeToInternal(typeCode, name),
    status: parseSupplyStatus(percentage),
    mibClass,
    mibType,
    mibUnit,
    semantics
  };
}

// Classifica o status de suprimentos cujo percentual representa VIDA ÚTIL / CAPACIDADE RESTANTE.
// Ex.: toner, tinta e a caixa de manutenção Epson reportada pelo Web Config.
const parseSupplyStatus = (percentage) => {
  if (percentage === null || percentage === undefined || percentage === '' || !Number.isFinite(Number(percentage)) || percentage < 0 || percentage > 100) return 'unknown';
  if (percentage < 10) return 'critical';
  if (percentage <= 30) return 'warning';
  return 'ok';
};

// Exportado para teste: a Epson descreve a caixa de manutenção como vida útil/capacidade restante.
// Logo, percentual alto = saudável; percentual baixo = próximo da substituição.
export const parseMaintenanceBoxRemainingStatus = (remainingPercentage) =>
  parseSupplyStatus(remainingPercentage);

// Extrai o índice final de uma OID (ex: '1.3.6.1.2.1.43.11.1.1.6.1.1' → '1.1')
const extractIndex = (oid, baseOid) => {
  return oid.substring(baseOid.length + 1);
};

/**
 * Consulta interna de OIDs para uma versão específica do SNMP.
 */
export async function querySnmpWithVersion(ip, community, version, { createSession = snmp.createSession } = {}) {
  const session = createSession(ip, community, getSessionOptions(version));
  session.on('error', (err) => {
    // Previne crash do processo em caso de pacotes ASN1 corrompidos ou malformados na rede
  });
  try {
    // 1. Consultar OIDs escalares principais
    const infoOids = [
      OIDs.sysName, OIDs.sysDescr, OIDs.hrDeviceDescr,
      OIDs.serialNumber, OIDs.hrDeviceStatus,
      OIDs.hrPrinterStatus, OIDs.pageCount
    ];
    const infoData = await getOids(session, infoOids);

    // 2. Consultar tabelas de suprimentos, bandejas e interfaces físicas (MAC) de forma consolidada e atômica
    const [suppliesTable, traysTable, ifPhysTable, errorData, alertData] = await Promise.all([
      getSubtree(session, '1.3.6.1.2.1.43.11.1.1').catch(() => ({})),
      getSubtree(session, '1.3.6.1.2.1.43.8.2.1').catch(() => ({})),
      getSubtree(session, '1.3.6.1.2.1.2.2.1.6').catch(() => ({})),
      // Optional OID is isolated so absent hardware alerts cannot make SNMPv1 fail.
      getOids(session, [OIDs.hrPrinterDetectedErrorState]).catch(() => ({})),
      readPrinterMibAlerts(session, getOids)
    ]);

    // Extrair MAC Address físico da impressora
    let snmpMacAddress = null;
    for (const [oid, val] of Object.entries(ifPhysTable)) {
      if (Buffer.isBuffer(val) && val.length === 6) {
        const formatted = formatMacAddress(val);
        if (formatted && formatted !== '00:00:00:00:00:00' && formatted !== 'FF:FF:FF:FF:FF:FF') {
          snmpMacAddress = formatted;
          break;
        }
      }
    }

    // 3. Processar suprimentos da tabela prtMarkerSuppliesEntry
    const supplies = [];
    const descBase = OIDs.suppliesDesc; // '1.3.6.1.2.1.43.11.1.1.6'
    const indices = new Set();
    for (const oid of Object.keys(suppliesTable)) {
      if (oid.startsWith(descBase + '.')) {
        indices.add(oid.substring(descBase.length + 1));
      }
    }

    for (const idx of indices) {
      const name = parseBuffer(suppliesTable[`${descBase}.${idx}`]);
      if (!name) continue;

      const maxLevel = suppliesTable[`1.3.6.1.2.1.43.11.1.1.8.${idx}`] ?? null;
      let currentLevel = suppliesTable[`1.3.6.1.2.1.43.11.1.1.9.${idx}`] ?? null;

      const classCode = suppliesTable[`${OIDs.suppliesClass}.${idx}`] ?? null;
      const typeCode = suppliesTable[`${OIDs.suppliesType}.${idx}`] ?? null;
      const unitCode = suppliesTable[`${OIDs.suppliesUnit}.${idx}`] ?? null;

      const normalizedSupply = normalizePrinterMibSupply({
        name,
        classCode,
        typeCode,
        unitCode,
        maxLevel,
        currentLevel
      });

      supplies.push({
        ...normalizedSupply,
        icon: SUPPLY_ICONS[normalizedSupply.type] || '📦'
      });
    }

    // Prioridade Brother: Em impressoras Brother (ex: HL-L5212DW, HL-L6202DW, MFCs),
    // a MIB proprietária (BROTHER_OID_SUPPLIES) fornece a calibração real e precisa
    // (Toner Preto, Cilindro, Fusor, Laser, Kit PF).
    // A tabela genérica RFC 3805 retorna apenas descrições brutas com nível -3 (someRemaining).
    const sysDescrStr = String(infoData[OIDs.sysDescr] || '').toLowerCase();
    const hrDevDescrStr = String(infoData[OIDs.hrDeviceDescr] || '').toLowerCase();
    const sysNameStr = String(infoData[OIDs.sysName] || '').toLowerCase();
    const serialStr = String(infoData[OIDs.serialNumber] || '');
    const isBrother = sysDescrStr.includes('brother') ||
                      hrDevDescrStr.includes('brother') ||
                      sysNameStr.includes('brother') ||
                      serialStr.startsWith('U670');

    if (isBrother || supplies.length === 0) {
      try {
        const brotherData = await getOids(session, [BROTHER_OID_SUPPLIES]).catch(() => null);
        const brotherBuf = brotherData ? brotherData[BROTHER_OID_SUPPLIES] : null;
        if (brotherBuf) {
          const tlvMap = parseBrotherTlv(brotherBuf);
          const bSupplies = extractBrotherSupplies(tlvMap);
          if (bSupplies.length > 0) {
            supplies.length = 0;
            supplies.push(...bSupplies);
          }
        }
      } catch (e) {
        // Silencioso se não for Brother
      }
    }

    // 4. Processar bandejas de papel da tabela prtInputEntry
    const trays = [];
    const trayNameBase = OIDs.trayName; // '1.3.6.1.2.1.43.8.2.1.13'
    const trayIndices = new Set();
    for (const oid of Object.keys(traysTable)) {
      if (oid.startsWith(trayNameBase + '.')) {
        trayIndices.add(oid.substring(trayNameBase.length + 1));
      } else if (oid.startsWith('1.3.6.1.2.1.43.8.2.1.2.')) {
        trayIndices.add(oid.substring('1.3.6.1.2.1.43.8.2.1.2.'.length));
      }
    }

    for (const idx of trayIndices) {
      const name = parseBuffer(traysTable[`${trayNameBase}.${idx}`] || traysTable[`1.3.6.1.2.1.43.8.2.1.2.${idx}`] || `Bandeja ${idx}`);
      if (!name) continue;

      const maxLevel = traysTable[`1.3.6.1.2.1.43.8.2.1.9.${idx}`] ?? 0;
      const currentLevel = traysTable[`1.3.6.1.2.1.43.8.2.1.10.${idx}`] ?? 0;

      let percentage;
      if (currentLevel === -1) {
        percentage = -1;
      } else if (currentLevel === -2) {
        percentage = -2;
      } else if (currentLevel === -3) {
        percentage = 50;
      } else if (maxLevel > 0 && currentLevel >= 0) {
        percentage = Math.max(0, Math.min(100, Math.round((currentLevel / maxLevel) * 100)));
      } else {
        percentage = currentLevel >= 0 ? 0 : -1;
      }

      trays.push({ name, currentLevel, maxLevel, percentage });
    }

    // 5. Montar resposta
    const deviceStatusCode = infoData[OIDs.hrDeviceStatus] ?? 1;
    const printerStatusCode = infoData[OIDs.hrPrinterStatus] ?? 1;
    const rawModel = parseBuffer(infoData[OIDs.hrDeviceDescr] ?? 'Desconhecido');
    const cleanModel = typeof rawModel === 'string' ? (rawModel.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || 'Desconhecido') : rawModel;

    return {
      online: true,
      info: {
        model: cleanModel,
        serialNumber: parseBuffer(infoData[OIDs.serialNumber] ?? 'N/D'),
        macAddress: snmpMacAddress,
        name: parseBuffer(infoData[OIDs.sysName] ?? 'Desconhecido'),
        description: parseBuffer(infoData[OIDs.sysDescr] ?? ''),
        location: '',
        pageCount: infoData[OIDs.pageCount] ?? null
      },
      status: {
        errorState: normalizePrinterErrorState(errorData[OIDs.hrPrinterDetectedErrorState]),
        deviceCode: deviceStatusCode,
        deviceDescription: DEVICE_STATUS_MAP[deviceStatusCode] || 'Desconhecido',
        printerCode: printerStatusCode,
        printerDescription: PRINTER_STATUS_MAP[printerStatusCode] || 'Desconhecido'
      },
      supplies,
      trays,
      alerts: alertData.alerts,
      alertDeviceUptime: alertData.deviceUptime,
      alertSources: {
        prt_alert_table: alertData.source,
        hr_device_status: {
          available: Number.isInteger(deviceStatusCode) && deviceStatusCode >= 2 && deviceStatusCode <= 5,
          complete: Number.isInteger(deviceStatusCode) && deviceStatusCode >= 2 && deviceStatusCode <= 5
        }
      }
    };
  } finally {
    try { session.close(); } catch (e) {}
  }
}

export function mergeEpsonTankHttpSupplies(result, httpData) {
  const isEpsonTank = result?.supplies?.some(s =>
    s.name?.toLowerCase().includes('ink bottle') && s.percentage === -2
  );
  if (!isEpsonTank || !httpData?.online) return result;

  const hasMaintenanceBox = result.supplies.some(s => {
    const name = String(s.name || '').toLowerCase();
    return s.type === 'waste_toner' || name.includes('waste') || name.includes('maintenance box');
  });

  if (!hasMaintenanceBox) {
    const maintenanceBox = httpData.supplies?.find(s => s.type === 'waste_toner');
    if (maintenanceBox) result.supplies.push(maintenanceBox);
  }

  result.telemetrySources = [...new Set([...(result.telemetrySources || []), 'snmp', 'epson_web_config'])];
  return result;
}

async function enrichEpsonTankWithHttp(result, ip) {
  const isEpsonTank = result?.supplies?.some(s =>
    s.name?.toLowerCase().includes('ink bottle') && s.percentage === -2
  );
  if (!isEpsonTank) return result;

  try {
    const httpData = await queryEpsonHttpFallback(ip);
    return mergeEpsonTankHttpSupplies(result, httpData);
  } catch {
    // Falha HTTP não invalida uma leitura SNMP válida.
    return result;
  }
}

/**
 * Consulta completa do status de uma impressora via SNMP (com suporte a v2c, v1 e HTTP Fallback).
 * Para impressoras Epson M1180 (tanque recarregável), complementa SNMP v2c OU v1 com Web Config
 * para obter o nível real da caixa de manutenção (não disponível na Printer-MIB genérica).
 */
export const queryPrinterStatus = async (ip, community = 'public') => {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp || normalizedIp === '-' || normalizedIp === 'N/D' || normalizedIp.startsWith('pendente-')) {
    return {
      online: false,
      error: 'IP pendente / impressora desconectada',
      supplies: [],
      trays: [],
      info: { location: '', pageCount: null },
      status: { deviceCode: 5, deviceDescription: 'Offline (IP Pendente)', printerCode: 1, printerDescription: 'Desconectada' }
    };
  }

  // 1. Tentar SNMP v2c
  try {
    const resultV2 = await querySnmpWithVersion(ip, community, snmp.Version2c);
    resultV2.protocol = 'SNMP v2c';
    return await enrichLexmarkDiagnostics(await enrichEpsonTankWithHttp(resultV2, ip), ip);
  } catch (errV2) {
    // 2. Se falhar, tentar SNMP v1 (ex: Epson WorkForce Pro)
    try {
      const resultV1 = await querySnmpWithVersion(ip, community, snmp.Version1);
      resultV1.protocol = 'SNMP v1';
      return await enrichLexmarkDiagnostics(await enrichEpsonTankWithHttp(resultV1, ip), ip);
    } catch (errV1) {
      // 3. Fallback via HTTP Lexmark (WebGlue Scraper)
      const lexmarkFallback = await queryLexmarkHttpFallback(ip);
      if (lexmarkFallback && lexmarkFallback.online) {
        return lexmarkFallback;
      }

      // 4. Fallback via HTTP Epson (Web Config Scraper)
      const epsonFallback = await queryEpsonHttpFallback(ip);
      if (epsonFallback && epsonFallback.online) {
        return epsonFallback;
      }

      // 5. Fallback de Conectividade TCP (Porta 9100 RAW Print ou Porta 80 HTTP)
      // Se a porta 9100 ou 80 estiver aberta, a impressora física está LIGADA e operando!
      const [port9100, port80] = await Promise.all([
        checkTcpPort(ip, 9100, 1500),
        checkTcpPort(ip, 80, 1500)
      ]);

      if (port9100 || port80) {
        return {
          online: true,
          protocol: port9100 ? 'TCP (Porta 9100 RAW)' : 'TCP (Porta 80 HTTP)',
          info: {
            model: 'Impressora de Rede (Ativa)',
            serialNumber: 'N/D',
            macAddress: null,
            name: 'Impressora de Rede',
            description: `Dispositivo online na rede (Porta ${port9100 ? '9100' : '80'} ativa)`,
            location: '',
            pageCount: null
          },
          status: {
            deviceCode: 2,
            deviceDescription: 'Operando (Sem SNMP)',
            printerCode: 3,
            printerDescription: 'Ociosa / Conectada'
          },
          supplies: [],
          trays: []
        };
      }

      return { online: false, error: errV1.message || errV2.message };
    }
  }
};

/**
 * Fallback via HTTP para impressoras Lexmark quando o SNMP UDP 161 está desabilitado/bloqueado.
 * Extrai modelo, serial, contador de páginas vitalício, status de suprimentos e bandejas via WebGlue.
 */
export async function queryLexmarkHttpFallback(ip, options = {}) {
  try {
    const reading = await readLexmarkEws(ip, { ...options, includePages: true });
    const rootHtml = reading.documents['/']?.text || '';
    if (!/\blexmark\b/i.test(rootHtml)) return null;
    const statusHtml = reading.documents['/webglue/content?c=%2FStatus']?.text || '';
    const diagnostics = lexmarkDiagnosticsFromDocuments(reading);

    // 1. Modelo
    let model = 'Lexmark Printer';
    const pNameMatch = rootHtml.match(/<div class="printername"[^>]*>([^<]+)<\/div>/i);
    const titleMatch = rootHtml.match(/<title>([^<]+)<\/title>/i);
    if (pNameMatch) {
      model = pNameMatch[1].trim();
    } else if (titleMatch) {
      model = titleMatch[1].trim();
    }

    // Identificação somente pelos campos nomeados do relatório; sem serial inventado.
    const serialNumber = diagnostics.info.serialNumber || 'N/D';
    const pageCount = diagnostics.info.pageCount ?? null;

    // 3. Suprimentos
    const supplies = [];
    if (statusHtml) {
      const containerRegex = /<div class="supplyStatusContainer"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
      const containers = statusHtml.match(containerRegex) || [];

      for (const container of containers) {
        const nameMatch = container.match(/<div class="contentHeader"[^>]*>([\s\S]*?)<\/div>/i);
        let name = 'Suprimento';
        if (nameMatch) {
          name = nameMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }

        const pctMatch = container.match(/title="(\d+)%"/i) || container.match(/<span class="dataText">(\d+)<\/span>/i);
        if (pctMatch) {
          const pct = parseInt(pctMatch[1], 10);
          let type = 'other';
          const n = name.toLowerCase();
          if (n.includes('cartridge') || n.includes('toner')) type = 'toner';
          else if (n.includes('imaging') || n.includes('drum')) type = 'imaging_kit';
          else if (n.includes('maintenance')) type = 'maintenance_kit';
          else if (n.includes('waste')) type = 'waste_toner';
          else if (n.includes('fuser')) type = 'fuser';

          supplies.push({
            name,
            level: pct,
            maxLevel: 100,
            percentage: pct,
            type,
            status: pct < 10 ? 'critical' : (pct <= 30 ? 'warning' : 'ok'),
            icon: SUPPLY_ICONS[type] || '📦'
          });
        }
      }
    }

    // 4. Bandejas de Papel
    const trays = [];
    if (statusHtml) {
      const trayRegex = /<div class="trayInfoTitle contentHeader"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="contentBody trayStatus[^"]*"[\s\S]*?Capacity[\s\S]*?<div class="contentBody"[^>]*>([\s\S]*?)<\/div>/gi;
      let tm;
      while ((tm = trayRegex.exec(statusHtml)) !== null) {
        const trayName = tm[1].replace(/<[^>]+>/g, '').trim();
        const cap = parseInt(tm[2].replace(/<[^>]+>/g, '').trim(), 10);
        trays.push({
          name: trayName,
          currentLevel: null,
          maxLevel: Number.isSafeInteger(cap) && cap > 0 ? cap : null,
          percentage: -2
        });
      }
    }

    return {
      online: true,
      protocol: 'HTTP (Lexmark WebGlue)',
      info: {
        model,
        firmware: diagnostics.info.firmware || null,
        serialNumber,
        macAddress: null,
        name: model,
        description: `${model} via Lexmark Embedded Web Server`,
        location: '',
        pageCount
      },
      status: {
        deviceCode: 1,
        deviceDescription: 'Não observável por HTTP',
        printerCode: 1,
        printerDescription: 'Não observável por HTTP'
      },
      alerts: diagnostics.alerts,
      alertSources: diagnostics.alertSources,
      supplies,
      trays
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fallback via HTTP para impressoras Epson quando o SNMP UDP 161 está bloqueado por firewall entre VLANs.
 */
export async function queryEpsonHttpFallback(ip, { fetchImpl = fetch } = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Tenta caminho clássico de status da M1180 / WorkForce, com fallback para raiz
    let response = await fetchImpl(`http://${ip}/PRESENTATION/HTML/TOP/PRTINFO.HTML`, {
      signal: controller.signal
    }).catch(() => null);

    if (!response || !response.ok) {
      response = await fetchImpl(`http://${ip}/`, { signal: controller.signal }).catch(() => null);
    }
    clearTimeout(timeoutId);

    if (!response || !response.ok) return null;
    const html = await response.text();
    if (!html.includes('EPSON') && !html.includes('Epson') && !html.includes('PRTINFO')) {
      return null;
    }

    // Extrair Modelo
    const modelMatch = html.match(/<span class="header">([^<]+)<\/span>/i) || html.match(/<title>([^<]+)<\/title>/i);
    const model = modelMatch ? modelMatch[1].trim() : 'Epson Series';

    // Extrair Nome do Dispositivo
    const nameMatch = html.match(/Device Name<\/bdi>&nbsp;:\s*<\/td>\s*<td class="item-value">([^<]+)<\/td>/i);
    const name = nameMatch ? nameMatch[1].trim() : model;

    // Extrair MAC Address (pode ser usado como identificador)
    const macMatch = html.match(/MAC Address<\/bdi>&nbsp;:\s*<\/td>\s*<td class="item-value">([^<]+)<\/td>/i);
    const mac = macMatch ? macMatch[1].trim() : '';

    // Extrair Status
    let statusDesc = 'Ociosa / Disponível';
    if (html.includes('Available.')) {
      statusDesc = 'Ociosa';
    } else if (html.includes('Printing')) {
      statusDesc = 'Imprimindo';
    }

    // Suprimentos
    const supplies = [];
    if (html.includes('clrname\'>BK') || html.includes('BK</div>')) {
      supplies.push({
        name: 'Tanque de Tinta Preta (Black)',
        level: null,
        maxLevel: null,
        percentage: null,
        remainingPercentage: null,
        type: 'toner',
        status: 'unknown',
        semantics: 'unknown',
        source: 'epson_web_config',
        unobservableReason: 'tank_level_not_measured',
        icon: '🎨'
      });
    }

    // Caixa de Manutenção (Maintenance Box) — o indicador da Epson representa
    // vida útil/capacidade RESTANTE, não percentual de resíduo acumulado.
    // Portanto: valor alto = saudável; valor baixo = próximo da substituição.
    if (html.includes('Ink_Waste') || html.includes('Icn_Mb.PNG')) {
      const MAX_MAINTENANCE_HEIGHT = 48;
      let remainingPercentage = null;

      const wasteMatch = html.match(/Ink_Waste\.PNG['"]\s+height=['"](\d+)['"]/i);
      if (wasteMatch) {
        const remainingHeight = parseInt(wasteMatch[1], 10);
        if (remainingHeight <= MAX_MAINTENANCE_HEIGHT) {
          remainingPercentage = Math.round((remainingHeight / MAX_MAINTENANCE_HEIGHT) * 100);
        }
      }

      supplies.push({
        name: 'Caixa de Manutenção (vida útil restante)',
        level: remainingPercentage,
        maxLevel: 100,
        percentage: remainingPercentage,
        remainingPercentage,
        type: 'waste_toner',
        status: parseMaintenanceBoxRemainingStatus(remainingPercentage),
        semantics: 'remaining_maintenance_life',
        source: 'epson_web_config',
        icon: '🗑️'
      });
    }

    // Extrair Total de Páginas da página de manutenção
    let pageCount = null;
    try {
      const pageController = new AbortController();
      const pageTimeout = setTimeout(() => pageController.abort(), 3000);
      const mentRes = await fetchImpl(`http://${ip}/PRESENTATION/ADVANCED/INFO_MENTINFO/TOP`, {
        signal: pageController.signal
      });
      clearTimeout(pageTimeout);

      if (mentRes && mentRes.ok) {
        const mentHtml = await mentRes.text();
        const pageMatch = mentHtml.match(/Total Number of Pages&nbsp;:\s*<\/span><\/dt><dd[^>]*><div[^>]*>(\d+)<\/div>/i) ||
                          mentHtml.match(/Total Number of Pages[^0-9]*(\d+)/i);
        if (pageMatch) {
          pageCount = parseInt(pageMatch[1], 10);
        }
      }
    } catch (e) {
      // Caso a página de contadores não responda, mantém desconhecido.
    }

    return {
      online: true,
      protocol: 'HTTP (Web Config)',
      info: {
        model,
        serialNumber: mac ? `MAC: ${mac}` : 'N/D',
        macAddress: formatMacAddress(mac),
        name,
        description: 'Coletado via interface Web Config Epson',
        location: '',
        pageCount
      },
      status: {
        deviceCode: 2,
        deviceDescription: 'Operando',
        printerDescription: statusDesc,
        printerCode: statusDesc === 'Imprimindo' ? 4 : 3
      },
      supplies,
      trays: [
        {
          name: 'Bandeja Principal 1',
          currentLevel: 100,
          maxLevel: 100,
          percentage: 100
        }
      ]
    };
  } catch (err) {
    return null;
  }
}

/**
 * Testa a conexão SNMP com tentativas em múltiplas versões e fallback HTTP / TCP.
 */
export const testConnection = async (ip, community = 'public') => {
  const versions = [
    { v: snmp.Version2c, name: "v2c" },
    { v: snmp.Version1, name: "v1" }
  ];

  for (const { v, name } of versions) {
    const session = snmp.createSession(ip, community, getSessionOptions(v));
    session.on('error', () => {});
    try {
      await getOids(session, [OIDs.sysName]);
      session.close();
      return { success: true, version: name, message: `Conexão SNMP bem sucedida (SNMP${name})` };
    } catch (error) {
      session.close();
    }
  }

  // 1. Fallback via HTTP Lexmark
  const lexmarkTest = await queryLexmarkHttpFallback(ip);
  if (lexmarkTest && lexmarkTest.online) {
    return {
      success: true,
      version: 'HTTP (Lexmark)',
      message: `Comunicação ativa via Web Server (${lexmarkTest.info.model}). Nota: SNMP UDP 161 bloqueado, dados sincronizados via HTTP.`
    };
  }

  // 2. Fallback via HTTP Epson
  const epsonTest = await queryEpsonHttpFallback(ip);
  if (epsonTest && epsonTest.online) {
    return {
      success: true,
      version: 'HTTP (Epson)',
      message: `Comunicação ativa via Web Config (${epsonTest.info.model}). Nota: SNMP UDP 161 bloqueado, dados sincronizados via HTTP.`
    };
  }

  // 3. Fallback via Porta de Impressão TCP (9100 JetDirect ou 80 HTTP)
  const [p9100, p80] = await Promise.all([
    checkTcpPort(ip, 9100, 1500),
    checkTcpPort(ip, 80, 1500)
  ]);
  if (p9100 || p80) {
    return {
      success: true,
      version: p9100 ? 'TCP (Porta 9100 RAW)' : 'TCP (Porta 80)',
      message: `Impressora online e respondendo na porta ${p9100 ? '9100 (RAW Print)' : '80 (HTTP)'}. (Sem resposta SNMP UDP 161)`
    };
  }

  return {
    success: false,
    message: 'Nenhuma resposta da impressora (portas SNMP UDP 161, HTTP 80 e RAW 9100 inacessíveis).'
  };
};

/**
 * Consulta o MAC Address de uma impressora específica através de SNMP e contingência ARP.
 */
export async function getPrinterMacAddress(ip, community = 'public', timeout = 1000) {
  if (!ip || typeof ip !== 'string' || !isValidIpv4(ip) || ip.includes('pendente')) return null;

  // 1. Tenta SNMP (v1 e v2c)
  for (const v of [snmp.Version1, snmp.Version2c]) {
    try {
      const session = snmp.createSession(ip, community, {
        version: v,
        timeout,
        retries: 0
      });
      session.on('error', () => {});
      const table = await getSubtree(session, '1.3.6.1.2.1.2.2.1.6').catch(() => ({}));
      try { session.close(); } catch {}

      for (const [oid, val] of Object.entries(table)) {
        if (Buffer.isBuffer(val) && val.length === 6) {
          const formatted = formatMacAddress(val);
          if (formatted && formatted !== '00:00:00:00:00:00' && formatted !== 'FF:FF:FF:FF:FF:FF') {
            return formatted;
          }
        }
      }
    } catch {}
  }

  // 2. Fallback: Consulta tabela ARP do Windows de forma segura (sem shell interpolado)
  try {
    const { stdout } = await execFileAsync('arp', ['-a', ip], { timeout: 1000 });
    const match = stdout.match(/([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/);
    if (match) {
      return formatMacAddress(match[0]);
    }
  } catch {}

  return null;
}

/**
 * Varre uma sub-rede (/24) procurando impressoras e descobrindo seus MAC Addresses.
 * Realiza sondagem concorrente ultrarrápida (lotes paralelos de 30 IPs com timeout de 800ms).
 */
export async function scanSubnetForMac(subnetPrefix, targetMacs = [], options = {}) {
  let basePrefix = String(subnetPrefix || '').trim().replace(/\/24$/, '').replace(/\.0$/, '');
  if (!isValidSubnetPrefix(basePrefix)) {
    throw new Error(`Prefixo de sub-rede inválido: "${subnetPrefix}". Exemplo esperado: "192.0.2"`);
  }
  const parts = basePrefix.split('.');
  basePrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const normalizedTargets = (Array.isArray(targetMacs) ? targetMacs : [targetMacs])
    .map(m => formatMacAddress(m))
    .filter(Boolean);

  const rawSerials = options.targetSerials || options.targetSerial || [];
  const targetSerials = (Array.isArray(rawSerials) ? rawSerials : [rawSerials])
    .filter(Boolean)
    .map(s => String(s).trim().toUpperCase().replace(/[\s-]/g, ''));

  const startHost = options.startHost || 1;
  const endHost = options.endHost || 254;
  const timeout = options.timeout || 800;
  const concurrency = options.concurrency || 30;

  const foundDevices = [];
  const ips = [];
  for (let i = startHost; i <= endHost; i++) {
    ips.push(`${basePrefix}.${i}`);
  }

  const hasSpecificTargets = normalizedTargets.length > 0 || targetSerials.length > 0;

  // 1. Processamento em lotes paralelos controlados
  for (let i = 0; i < ips.length; i += concurrency) {
    const batch = ips.slice(i, i + concurrency);
    const promises = batch.map(async (ip) => {
      try {
        let mac = null;
        let name = `Impressora ${ip}`;
        let model = 'Dispositivo de Rede';
        let serial = null;

        // Busca por S/N não pode depender de descobrir o MAC primeiro.
        // Algumas impressoras (ex.: Epson M1180 em outras VLANs) respondem ao
        // Printer-MIB com serial, mas a tabela ifPhysAddress/ARP pode não expor MAC.
        if (targetSerials.length > 0) {
          for (const version of [snmp.Version2c, snmp.Version1]) {
            let session = null;
            try {
              session = snmp.createSession(ip, 'public', { version, timeout, retries: 0 });
              session.on('error', () => {});
              const oids = await getOids(session, [OIDs.sysName, OIDs.hrDeviceDescr, OIDs.serialNumber]).catch(() => ({}));
              if (oids[OIDs.sysName]) name = parseBuffer(oids[OIDs.sysName]);
              if (oids[OIDs.hrDeviceDescr]) model = parseBuffer(oids[OIDs.hrDeviceDescr]);
              if (oids[OIDs.serialNumber]) {
                const s = parseBuffer(oids[OIDs.serialNumber]);
                if (s && s !== 'Desconhecido' && s !== 'N/D') serial = s;
              }
            } catch {
              // Tenta a próxima versão.
            } finally {
              try { session?.close(); } catch {}
            }

            const cleanSerial = serial ? String(serial).trim().toUpperCase().replace(/[\s-]/g, '') : '';
            if (cleanSerial && targetSerials.includes(cleanSerial)) break;
          }

          const cleanSerial = serial ? String(serial).trim().toUpperCase().replace(/[\s-]/g, '') : '';
          const serialMatch = cleanSerial && targetSerials.includes(cleanSerial);
          if (!serialMatch) return;

          // MAC é enriquecimento opcional depois de o serial já ter identificado o alvo.
          mac = await getPrinterMacAddress(ip, 'public', timeout);
          foundDevices.push({
            ip,
            mac,
            name,
            model,
            serial,
            matched: true,
            method: 'SNMP'
          });
          return;
        }

        // Varredura geral / busca por MAC mantém o comportamento anterior.
        mac = await getPrinterMacAddress(ip, 'public', timeout);
        if (!mac) return;

        try {
          const session = snmp.createSession(ip, 'public', { version: snmp.Version1, timeout: 600, retries: 0 });
          session.on('error', () => {});
          const oids = await getOids(session, [OIDs.sysName, OIDs.hrDeviceDescr, OIDs.serialNumber]).catch(() => ({}));
          try { session.close(); } catch {}
          if (oids[OIDs.sysName]) name = parseBuffer(oids[OIDs.sysName]);
          if (oids[OIDs.hrDeviceDescr]) model = parseBuffer(oids[OIDs.hrDeviceDescr]);
          if (oids[OIDs.serialNumber]) {
            const s = parseBuffer(oids[OIDs.serialNumber]);
            if (s && s !== 'Desconhecido' && s !== 'N/D') serial = s;
          }
        } catch {}

        const macMatch = normalizedTargets.length > 0 && normalizedTargets.includes(mac);
        const isTarget = !hasSpecificTargets || macMatch;

        if (isTarget) {
          foundDevices.push({
            ip,
            mac,
            name,
            model,
            serial,
            matched: true,
            method: 'SNMP'
          });
        }
      } catch {}
    });
    await Promise.all(promises);

    // Se estiver buscando um alvo específico e já o localizou, encerra imediatamente a varredura
    if (hasSpecificTargets && foundDevices.length > 0) {
      const foundTarget = foundDevices.some(d => {
        const macMatch = normalizedTargets.length > 0 && normalizedTargets.includes(d.mac);
        const cleanSerial = d.serial ? String(d.serial).trim().toUpperCase().replace(/[\s-]/g, '') : '';
        const serialMatch = targetSerials.length > 0 && cleanSerial && targetSerials.includes(cleanSerial);
        return macMatch || serialMatch;
      });
      if (foundTarget) {
        break;
      }
    }
  }

  // 2. Consulta tabela ARP do Windows como contingência (sem shell)
  try {
    const { stdout: arpOut } = await execFileAsync('arp', ['-a'], { timeout: 1500 });
    const lines = arpOut.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([0-9.]+)\s+([0-9a-fA-F-]{17})/);
      if (match) {
        const ip = match[1];
        const mac = formatMacAddress(match[2]);
        if (isValidIpv4(ip) && ip.startsWith(basePrefix + '.') && mac && !foundDevices.some(d => d.ip === ip)) {
          const macMatch = normalizedTargets.length > 0 && normalizedTargets.includes(mac);
          const isTarget = !hasSpecificTargets || macMatch;
          if (isTarget) {
            foundDevices.push({
              ip,
              mac,
              name: `Dispositivo (${ip})`,
              model: 'Detectado via Cache ARP',
              serial: null,
              matched: true,
              method: 'ARP'
            });
          }
        }
      }
    }
  } catch {}

  if (!hasSpecificTargets) return foundDevices;
  return foundDevices.filter(d => {
    const macMatch = normalizedTargets.length > 0 && normalizedTargets.includes(d.mac);
    const cleanSerial = d.serial ? String(d.serial).trim().toUpperCase().replace(/[\s-]/g, '') : '';
    const serialMatch = targetSerials.length > 0 && cleanSerial && targetSerials.includes(cleanSerial);
    return macMatch || serialMatch;
  });
}
