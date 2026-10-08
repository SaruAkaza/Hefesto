import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { queryPrinterStatus, testConnection, formatMacAddress, getPrinterMacAddress, scanSubnetForMac, isValidIpv4, isValidSubnetPrefix } from './snmp-service.js';
import * as db from './db.js';
import * as autoUpdater from './auto-updater.js';
import * as edgeSync from './edge-sync-service.js';
import { processEdgeOutbox } from './edge-outbox.js';
import { HEALTH_STATES, DEFAULT_HEALTH_POLICY, evaluatePrinterHealth, withStaleness } from './health-engine.js';
import { getBusinessDateKey, getRollingPeriodStartDateKey, getInclusiveDateSpanDays } from './date-utils.js';
import { recordAndAdvanceConsumableLifecycle } from './consumable-lifecycle-coordinator.js';
import { resolveRechargeBaseline } from './recharge-detection.js';
import { hasPrinterIdentityConflict, isCurrentPrinterSnapshot, queryCurrentPrinterTelemetry } from './printer-identity.js';
import { createPrinterReplacementRouter } from './printer-replacement-routes.js';
import { parseNetworkScanTarget, discoverPrinterAtIp, classifyScannedPrinter } from './network-scan-target.js';
import { authMiddleware, requireAdmin, requireAuth, createSession, getSession, revokeSession, checkLoginRateLimit, recordLoginAttempt } from './auth.js';
import {
  isRefillableTank,
  normalizeSupplyPercentage,
  getPrinterNominalMetrics,
  calculateConsumableForecast,
  calculateWorkload,
  calculateProductionDelta
} from './analytics-service.js';
import { createPrintingCostRouter } from './printing-cost-routes.js';
import { createWorkstationRouter, usbPrinterViews } from './workstations.js';
import { createDashboardSnapshot } from './dashboard-snapshot.js';
import { enrichDiagnosticReport } from './diagnostic-catalog.js';
import { createTechnicalOperationsRouter } from './technical-operations-routes.js';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import snmp from 'net-snmp';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregamento de variáveis de ambiente nativo (.env)
try {
  if (typeof process.loadEnvFile === 'function') {
    const rootEnv = path.resolve(__dirname, '..', '.env');
    const serverEnv = path.resolve(__dirname, '.env');
    if (fsSync.existsSync(rootEnv)) {
      process.loadEnvFile(rootEnv);
    } else if (fsSync.existsSync(serverEnv)) {
      process.loadEnvFile(serverEnv);
    }
  }
} catch (e) {
  // .env é opcional
}

const isMainModule = Boolean(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)));

if (isMainModule) {
  // Inicializa banco de dados relacional SQLite e migração automática dos JSONs existentes
  db.initDatabase();

  // Backup diário rotativo e rotina de expurgo de retenção de dados (> 30 dias)
  db.runDailyBackup();
  db.pruneOldTelemetrySnapshots(30);
  setInterval(() => {
    db.runDailyBackup();
    db.pruneOldTelemetrySnapshots(30);
  }, 24 * 60 * 60 * 1000);

  // Auto-Updater: monitoramento periódico silencioso de novidades no GitHub (a cada 30 min)
  autoUpdater.startAutoUpdateWatcher(30);

  // Inicializa serviço de sincronização Edge (filial) caso esteja em modo edge
  edgeSync.initEdgeSyncService().catch(err => {
    console.warn('[EdgeSync] Aviso ao inicializar sincronizador:', err.message);
  });
}

// Prevenção de crashes globais em background por erros assíncronos ou pacotes SNMP corrompidos
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]', reason);
});

const DATA_FILE = path.join(__dirname, 'data', 'printers.json');
const BRANDING_FILE = path.join(__dirname, 'data', 'branding.json');

const DEFAULT_BRANDING = {
  brandName: 'HEFESTO',
  companyName: 'Hefesto',
  subTitle: 'Monitor de Impressoras e Gestão de Suprimentos',
  systemTag: 'Gestão de Tecnologia & Telemetria',
  logoText: 'HEFESTO',
  showLogoImg: false,
  logoImgSrc: ''
};

async function loadBranding() {
  try {
    const data = await fs.readFile(BRANDING_FILE, 'utf-8');
    const cleanData = data.replace(/^\uFEFF/, '').trim();
    return { ...DEFAULT_BRANDING, ...JSON.parse(cleanData) };
  } catch (error) {
    console.warn('[Branding] Erro ao carregar branding.json, usando padrão:', error.message);
    return DEFAULT_BRANDING;
  }
}

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());
app.use('/api/edge/sync', express.json({ limit: '5mb' }));
app.use('/api/workstations', express.json({ limit: '512kb' }));
app.use('/api/workstations', (error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Lote de coleta muito grande.' });
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'JSON inválido.' });
  next(error);
});
app.use(express.json());
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/admin/printing-costs', createPrintingCostRouter(() => db.getDb()));
app.use('/api/workstations', createWorkstationRouter(() => db.getDb()));
app.use('/api/printers', createTechnicalOperationsRouter({ db,
  getCachedStatus: id => STATUS_CACHE.get(id), refreshPrinter: printer => processSinglePrinterTelemetry(printer) }));

// Rota de configuração de identidade visual / White-Label
app.get('/api/config/branding', async (req, res) => {
  const branding = await loadBranding();
  res.json(branding);
});

// Cache em memória inicializado com o último estado persistido no SQLite
const STATUS_CACHE = db.getAllCachedStatuses();
let lastCacheUpdate = null;

// Helpers de dados conectados ao SQLite (alta performance e integridade ACID)
async function loadPrinters() {
  return db.getPrinters();
}

async function savePrinters(printers) {
  for (const p of printers) {
    db.savePrinter(p);
  }
}

async function loadReplenishments() {
  return db.getReplenishments();
}

async function saveReplenishments(items) {
  if (Array.isArray(items)) {
    for (const item of items) {
      db.saveReplenishment(item);
    }
  }
}

async function loadRecharges() {
  return db.getRecharges();
}

async function saveRecharges(recharges) {
  // Operações atômicas utilizam db.recordRecharge()
}

async function loadPageHistory() {
  return db.getAllPageHistory();
}

async function savePageHistory(history) {
  // Operações utilizam db.recordPageCount()
}

// Grava / atualiza o snapshot diário de contadores de páginas no SQLite
export async function recordDailyPageSnapshot(printerId, pageCount, supplies = [], observation = {}) {
  if (!printerId || !Number.isSafeInteger(pageCount) || pageCount < 0) return;
  db.recordPageCount(printerId, pageCount, supplies, observation);
}

function isWasteSupply(supply) {
  if (!supply) return false;
  if (supply.type === 'waste_toner') return true;
  const n = (supply.name || '').toLowerCase();
  return (
    n.includes('waste') ||
    n.includes('resíduo') ||
    n.includes('residuo') ||
    n.includes('coletor') ||
    n.includes('manutenção') ||
    n.includes('manutencao') ||
    n.includes('maintenance box') ||
    n.includes('maintenance kit') ||
    n.includes('caixa de')
  );
}

function formatCleanModel(modelStr) {
  if (!modelStr || modelStr === 'Desconhecido' || modelStr === 'N/D') return '';
  return String(modelStr).split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
}

// Localizador Inteligente de Suprimento (Isola slots físicos e previne contaminação cruzada)
function findMatchingSupply(targetSup, candidateList) {
  if (!targetSup || !Array.isArray(candidateList) || candidateList.length === 0) return null;

  // 1. Match por nome exato (incluindo eventual serial idêntico)
  let found = candidateList.find(s => s && s.name && s.name.trim().toLowerCase() === targetSup.name?.trim().toLowerCase());
  if (found) return found;

  // 2. Match por slot físico normalizado (remove sufixos como ';SN...')
  const targetSlot = db.normalizeSupplySlot(targetSup.name);
  if (targetSlot) {
    found = candidateList.find(s => s && db.normalizeSupplySlot(s.name) === targetSlot);
    if (found) return found;
  }

  // 3. FALLBACK POR TIPO: Permitido ESTRITAMENTE quando existe apenas 1 suprimento desse tipo na impressora!
  // Se a impressora possui 4 toners (C, M, Y, K) ou 4 tambores, NUNCA faz fallback por tipo
  // para impedir contaminação cruzada (ex: Ciano ser comparado contra o Amarelo).
  if (targetSup.type) {
    const sameTypeCandidates = candidateList.filter(s => s && s.type === targetSup.type);
    if (sameTypeCandidates.length === 1) {
      return sameTypeCandidates[0];
    }
  }

  return null;
}

// Motor de Registro de Recargas (Projeto Hefesto)
async function registerRechargeEvent({
  printerId,
  printerName,
  ip,
  unitName,
  location,
  supplyName,
  supplyType,
  previousLevel,
  newLevel,
  pageCount,
  source = 'auto',
  isFull = null,
  technician = '',
  notes = '',
  timestamp = null,
  verificationStatus = null,
  evidence = null
}) {
  try {
    const isFullRecharge = isFull !== null ? Boolean(isFull) : (Number(newLevel) >= 95);
    const event = db.recordRecharge({
      id: evidence?.id ? `rec-${evidence.id}` : undefined,
      verificationStatus,
      evidence,
      printerId,
      printerName: printerName || 'Impressora',
      ip: ip || '',
      unitName: unitName || 'Sem Unidade',
      location: location || '',
      supplyName: supplyName || 'Toner/Tinta',
      supplyType: supplyType || 'toner',
      previousLevel: previousLevel ?? null,
      newLevel: Number(newLevel),
      pageCount: Number.isSafeInteger(pageCount) && pageCount >= 0 ? pageCount : null,
      source,
      statusTag: source === 'auto' ? 'Troca detectada automaticamente' : isFullRecharge
        ? 'Reposição com nível alto'
        : ((supplyType === 'waste_toner' || supplyType === 'maintenance_kit') ? 'Substituição' : 'Troca Provisória / Parcial'),
      technician: technician || (source === 'auto' ? 'Sensor Automático SNMP' : 'Técnico'),
      notes: notes || (isFullRecharge
        ? `Troca de ${supplyName} detectada com nível de ${newLevel}%`
        : ((supplyType === 'waste_toner' || supplyType === 'maintenance_kit')
            ? `${supplyName} substituído(a) com ${newLevel}%`
            : `Inserido(a) ${supplyName} provisório(a) com ${newLevel}%`)),
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    });

    if (!event) {
      // Rejeitado pelo motor autônomo de regras do SQLite
      return null;
    }

    console.log('\x1b[32m%s\x1b[0m', `[Hefesto Recharges] ⚡ Nova recarga registrada para ${printerName} (${supplyName}): ${previousLevel}% -> ${newLevel}% | Páginas no ciclo: ${event.pagesSinceLastRecharge}`);
    return event;
  } catch (err) {
    console.error('[Hefesto Recharges] Erro ao registrar recarga:', err);
    return null;
  }
}

async function loadUnits() {
  return db.getUnits();
}

async function saveUnits(units) {
  for (const u of units) {
    db.saveUnit(u);
  }
}

// ------------------------------------
// ROTAS DA API - UNIDADES / PASTAS
// ------------------------------------

app.get('/api/units', async (req, res) => {
  try {
    const units = await loadUnits();
    res.json(units);
  } catch (err) {
    console.error('[API Units GET Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/units', requireAdmin, async (req, res) => {
  try {
    const { name, description, region } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome da unidade é obrigatório.' });

    const newUnit = {
      id: 'unit-' + uuidv4().substring(0, 8),
      name: name.trim(),
      description: description ? description.trim() : '',
      region: (region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
      createdAt: new Date().toISOString()
    };

    db.saveUnit(newUnit);
    res.status(201).json(newUnit);
  } catch (err) {
    console.error('[API Units POST Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/units/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, region } = req.body;
    const unit = db.getUnitById(id);

    if (!unit) return res.status(404).json({ error: 'Unidade não encontrada.' });

    const oldName = unit.name;
    const updatedUnit = {
      ...unit,
      name: name ? name.trim() : unit.name,
      description: description !== undefined ? description.trim() : unit.description,
      region: region !== undefined ? ((region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ') : (unit.region || 'RJ')
    };

    db.saveUnit(updatedUnit);

    // Atualizar nome da unidade nas impressoras associadas de forma atômica
    db.updateUnitNameInPrinters(id, oldName, updatedUnit.name);

    res.json(updatedUnit);
  } catch (err) {
    console.error('[API Units PUT Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/units/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const unit = db.getUnitById(id);
    db.deleteUnit(id);

    // Desassociar impressoras vinculadas de forma atômica
    db.disassociatePrintersFromUnit(id, unit ? unit.name : null);

    res.json({ success: true, id });
  } catch (err) {
    console.error('[API Units DELETE Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------
// ROTAS DA API - IMPRESSORAS
// ------------------------------------

app.get('/api/printers', async (req, res) => {
  const printers = await loadPrinters();
  res.json([...printers,...usbPrinterViews(db.getDb()).map(entry=>entry.printer)]);
});

app.post('/api/printers', requireAdmin, async (req, res) => {
  const { name, ip, location, unitId, unitName, community, initialPageCount, hefestoActivatedAt, installedAt, macAddress, serialNumber, createdAt } = req.body;

  if (!name || !ip) {
    return res.status(400).json({ error: 'Nome e IP são obrigatórios.' });
  }

  const cleanIp = ip.trim();
  const cleanName = name.trim();
  const cleanMac = macAddress ? formatMacAddress(macAddress) : null;
  const cleanSerial = serialNumber ? String(serialNumber).trim() : null;

  // Busca se já existe uma impressora correspondente por MAC, Serial, Nome ou Local na unidade
  const existing = db.findExistingPrinterMatch({
    ip: cleanIp,
    name: cleanName,
    macAddress: cleanMac,
    serialNumber: cleanSerial,
    unitId,
    unitName,
    location
  });

  if (existing) {
    // Se a impressora já existe, NÃO duplica! Apenas atualiza o IP e dados nela!
    const previousIp = existing.ip;
    console.log(`[API Printers] 🔄 Impressora já cadastrada encontrada (${existing.name} - ${existing.id}). Atualizando IP de ${previousIp} para ${cleanIp} sem duplicar.`);

    // Trata colisão caso o cleanIp já estivesse temporariamente atribuído a outro registro
    if (cleanIp && !cleanIp.startsWith('pendente') && cleanIp !== previousIp) {
      try {
        const collision = db.getDb().prepare('SELECT id, name FROM printers WHERE ip = ? AND id != ?').get(cleanIp, existing.id);
        if (collision) {
          const displacedTag = `pendente-deslocada-${Date.now().toString().slice(-4)}`;
          db.getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?').run(displacedTag, new Date().toISOString(), collision.id);
          console.log(`[API Printers] ⚠️ Colisão resolvida: IP ${cleanIp} transferido da impressora ${collision.name} para ${existing.name}`);
        }
      } catch (colErr) {
        console.warn('[API Printers Collision Warning]', colErr.message);
      }
    }

    const updatedPrinter = {
      ...existing,
      name: cleanName,
      ip: cleanIp,
      location: location !== undefined ? (location || '').trim() : existing.location,
      unitId: unitId !== undefined ? unitId : existing.unitId,
      unitName: unitName !== undefined ? unitName : existing.unitName,
      community: community ? community.trim() : existing.community,
      macAddress: cleanMac || existing.macAddress,
      serialNumber: cleanSerial || existing.serialNumber,
      updatedAt: new Date().toISOString()
    };

    db.savePrinter(updatedPrinter);
    STATUS_CACHE.delete(existing.id);

    // Consulta imediata do novo IP
    queryPrinterStatus(cleanIp, updatedPrinter.community).then(st => {
      if (st) STATUS_CACHE.set(existing.id, st);
    }).catch(() => {});

    return res.status(200).json({
      ...updatedPrinter,
      _reconciled: true,
      message: `Impressora já cadastrada detectada. IP atualizado de ${previousIp} para ${cleanIp} sem duplicidade!`
    });
  }

  // Se não existir, cadastra como nova impressora
  const newPrinter = {
    id: uuidv4(),
    name: cleanName,
    ip: cleanIp,
    location: (location || '').trim(),
    unitId: unitId || null,
    unitName: unitName || 'Sem Unidade',
    community: (community || 'public').trim(),
    initialPageCount: typeof initialPageCount === 'number' ? initialPageCount : (Number(initialPageCount) || 0),
    hefestoActivatedAt: hefestoActivatedAt || createdAt || new Date().toISOString(),
    installedAt: installedAt || '',
    macAddress: cleanMac,
    createdAt: createdAt || new Date().toISOString()
  };

  db.savePrinter(newPrinter);
  if ((process.env.APP_MODE || '').toLowerCase() === 'edge') {
    edgeSync.triggerEdgeSync().catch(() => {});
  }
  res.status(201).json(newPrinter);
});

// Importação em Lote (CSV / Excel)
app.post('/api/printers/batch', requireAdmin, async (req, res) => {
  console.log('\x1b[36m%s\x1b[0m', 'POST /api/printers/batch - Importação em lote');
  const { items, defaultUnitId, defaultUnitName, defaultRegion } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Nenhum item válido para importação.' });
  }

  let units = await loadUnits();
  let importedCount = 0;
  let updatedCount = 0;

  for (const row of items) {
    const ip = (row.ip || '').trim();
    const name = (row.name || row.serial || row.serialNumber || `Impressora ${ip}`).trim();
    const location = (row.location || row.setor || '').trim();
    let rowUnitName = (row.unitName || row.unit || row.unidade || defaultUnitName || 'Sem Unidade').trim();

    if (!ip) continue;

    // Detectar região da linha ou padrão
    const rawReg = (row.region || row.regiao || row.estado || row.uf || '').trim();
    let rowRegion = /sp|s[aã]o\s*paulo/i.test(rawReg) ? 'SP' : (/rj|rio/i.test(rawReg) ? 'RJ' : '');

    // Verificar ou criar a Unidade/Pasta se necessário
    let unitObj = units.find(u => u.name.toLowerCase() === rowUnitName.toLowerCase());
    if (!rowRegion) {
      rowRegion = unitObj?.region || ((defaultRegion || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ');
    }

    if (!unitObj && rowUnitName && rowUnitName !== 'Sem Unidade') {
      unitObj = {
        id: 'unit-' + uuidv4().substring(0, 8),
        name: rowUnitName,
        description: 'Criada automaticamente via importação de planilha',
        region: rowRegion,
        createdAt: new Date().toISOString()
      };
      db.saveUnit(unitObj);
      units.push(unitObj);
    }

    const unitId = unitObj ? unitObj.id : (defaultUnitId || '');
    const finalUnitName = unitObj ? unitObj.name : rowUnitName;

    const model = (row.model || row.modelo || '').trim();
    const serial = (row.serial || row.serialNumber || row.numeroDeSerie || '').trim();

    // Reconciliação anti-duplicação inteligente (por ID, MAC, Serial, Nome, Unidade, Local)
    let existing = db.findExistingPrinterMatch({
      id: row.existingId,
      ip: ip,
      name: name,
      macAddress: row.macAddress || row.mac,
      serialNumber: serial,
      location: location,
      unitId: unitId,
      unitName: finalUnitName
    });

    // Se outro registro usava este mesmo IP cleanIp mas é diferente do existing, limpa/ajusta colisão
    if (existing && ip && ip !== existing.ip && !ip.startsWith('pendente-')) {
      const colliding = db.getPrinterByIp(ip);
      if (colliding && colliding.id !== existing.id) {
        console.warn(`[Anti-Duplicação Batch] IP ${ip} pertencia à impressora "${colliding.name}" (${colliding.id}). Desvinculando colisão.`);
        db.savePrinter({
          ...colliding,
          ip: `pendente-${colliding.id.substring(0, 8)}`,
          updatedAt: new Date().toISOString()
        });
        STATUS_CACHE.delete(colliding.id);
      }
    }

    const printerId = existing ? existing.id : uuidv4();

    if (existing) {
      const previousIp = existing.ip;
      if (previousIp !== ip) {
        console.log(`[Anti-Duplicação Batch] Impressora "${existing.name}" (${existing.id}) teve IP alterado de "${previousIp}" para "${ip}" sem duplicar.`);
      }
      db.savePrinter({
        ...existing,
        ip: ip || existing.ip,
        name: name || existing.name,
        location: location || existing.location,
        unitId: unitId || existing.unitId,
        unitName: finalUnitName || existing.unitName,
        macAddress: formatMacAddress(row.macAddress || row.mac) || existing.macAddress,
        updatedAt: new Date().toISOString()
      });
      updatedCount++;
    } else {
      db.savePrinter({
        id: printerId,
        name,
        ip,
        location,
        unitId,
        unitName: finalUnitName,
        macAddress: formatMacAddress(row.macAddress || row.mac) || null,
        community: 'public',
        createdAt: new Date().toISOString()
      });
      importedCount++;
    }

    if (model || (serial && serial !== '-')) {
      const curCache = db.getCachedStatus(printerId);
      if (!curCache) {
        db.updateCachedStatus(printerId, {
          online: !ip.startsWith('pendente-'),
          status: { code: 0, description: ip.startsWith('pendente-') ? 'Pendente de IP fixo' : 'Aguardando telemetria' },
          info: { model, serialNumber: serial !== '-' ? serial : '', name, location },
          supplies: [],
          trays: []
        });
      } else {
        const curModel = curCache.info?.model;
        const curSerial = curCache.info?.serialNumber;
        if ((!curModel && model) || (!curSerial && serial && serial !== '-')) {
          curCache.info = curCache.info || {};
          if (model && !curModel) curCache.info.model = model;
          if (serial && serial !== '-' && !curSerial) curCache.info.serialNumber = serial;
          db.updateCachedStatus(printerId, curCache);
        }
      }
    }
  }

  // Pré-carregar o cache de status em background
  updateAllPrintersCache().catch(() => {});

  if ((process.env.APP_MODE || '').toLowerCase() === 'edge') {
    edgeSync.triggerEdgeSync().catch(() => {});
  }

  res.json({
    success: true,
    imported: importedCount,
    updated: updatedCount,
    total: importedCount + updatedCount
  });
});

// Atualizar impressora
app.put('/api/printers/:id', requireAdmin, async (req, res) => {
  console.log('\x1b[36m%s\x1b[0m', `PUT /api/printers/${req.params.id} - Atualizando impressora`);
  const { id } = req.params;
  const { name, ip, location, unitId, unitName, community, initialPageCount, createdAt, hefestoActivatedAt, installedAt, macAddress } = req.body;

  const printers = await loadPrinters();
  const idx = printers.findIndex(p => p.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Impressora não encontrada.' });
  }

  if (ip && ip !== printers[idx].ip && isValidIpv4(ip)) {
    const prior = db.getCachedStatus(id)?.info || {};
    const detected = await queryPrinterStatus(ip, community || printers[idx].community).catch(() => null);
    if (hasPrinterIdentityConflict({ ...prior, macAddress: printers[idx].macAddress }, detected?.info)) {
      return res.status(409).json({ code: 'REPLACEMENT_REQUIRED', error: 'Outro equipamento foi detectado. Confirme uma substituição para manter o histórico anterior.' });
    }
    const current = db.getPrinterById(id);
    if (!isCurrentPrinterSnapshot(printers[idx], current)) return res.status(409).json({ error: 'Cadastro alterado durante a consulta. Atualize a tela.' });
  }

  const cachedStatus = STATUS_CACHE.get(id);
  const liveCount = cachedStatus?.info?.pageCount;
  const parsedInitial = initialPageCount !== undefined ? (Number(initialPageCount) || 0) : (printers[idx].initialPageCount ?? null);

  if (typeof liveCount === 'number' && liveCount > 0 && parsedInitial > liveCount) {
    return res.status(400).json({
      error: `O marco inicial (${parsedInitial.toLocaleString('pt-BR')} pág.) não pode ser maior que o contador físico atual do hardware (${liveCount.toLocaleString('pt-BR')} pág.).`
    });
  }

  printers[idx] = {
    ...printers[idx],
    name: name || printers[idx].name,
    ip: ip || printers[idx].ip,
    location: location !== undefined ? location : printers[idx].location,
    unitId: unitId !== undefined ? unitId : printers[idx].unitId,
    unitName: unitName !== undefined ? unitName : printers[idx].unitName,
    community: community || printers[idx].community,
    initialPageCount: parsedInitial,
    hefestoActivatedAt: hefestoActivatedAt || printers[idx].hefestoActivatedAt || printers[idx].createdAt || new Date().toISOString(),
    installedAt: installedAt !== undefined ? installedAt : (printers[idx].installedAt || ''),
    macAddress: macAddress !== undefined ? (formatMacAddress(macAddress) || null) : printers[idx].macAddress,
    createdAt: createdAt || printers[idx].createdAt || new Date().toISOString()
  };
  await savePrinters(printers);
  if ((process.env.APP_MODE || '').toLowerCase() === 'edge') {
    edgeSync.triggerEdgeSync().catch(() => {});
  }
  res.json(printers[idx]);
});

// Remover impressora
app.delete('/api/printers/:id', requireAdmin, async (req, res) => {
  console.log('\x1b[36m%s\x1b[0m', `DELETE /api/printers/${req.params.id} - Removendo impressora`);
  const { id } = req.params;
  const existing = db.getPrinterById(id);

  if (!existing) {
    return res.status(404).json({ error: 'Impressora não encontrada.' });
  }

  try { db.deletePrinter(id); } catch (error) { return res.status(409).json({ error: error.message }); }
  STATUS_CACHE.delete(id);

  // Sincroniza a exclusão no printers.json em disco para consistência completa
  try {
    const DATA_FILE = path.join(__dirname, 'data', 'printers.json');
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const list = JSON.parse(raw);
      const filtered = list.filter(p => p.id !== id && (!existing.ip || p.ip !== existing.ip));
      if (filtered.length !== list.length) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf8');
        console.log(`[Storage] Impressora ${existing.name} (${existing.ip}) removida de printers.json em disco.`);
      }
    }
  } catch (err) {
    console.warn('[Storage] Aviso ao remover de printers.json:', err.message);
  }

  if ((process.env.APP_MODE || '').toLowerCase() === 'edge') {
    edgeSync.triggerEdgeSync().catch(() => {});
  }

  res.status(204).send();
});

// Router compartilhado com os testes HTTP: sessão real, leitura prévia e histórico.
app.use('/api', createPrinterReplacementRouter({
  db, queryPrinterStatus, getPrinterMacAddress,
  onReplaced(result) {
    STATUS_CACHE.delete(result.replacedPrinter.id);
    STATUS_CACHE.delete(result.newPrinter.id);
    if ((process.env.APP_MODE || '').toLowerCase() === 'edge') edgeSync.triggerEdgeSync().catch(() => {});
  }
}));

// Calibrar Marco Zero (Contador de Ativação no Hefesto)
app.post('/api/printers/calibrate-initial-counts', requireAdmin, async (req, res) => {
  const { unitId, forceAll } = req.body || {};
  console.log('\x1b[36m%s\x1b[0m', `POST /api/printers/calibrate-initial-counts - Calibrando marco zero (unit: ${unitId || 'todas'})`);
  const printers = await loadPrinters();
  let calibratedCount = 0;

  for (const p of printers) {
    if (unitId && p.unitId !== unitId) continue;
    if (!forceAll && p.initialPageCount > 0) continue;

    const cached = STATUS_CACHE.get(p.id) || db.getCachedStatus(p.id);
    const liveCount = Number(cached?.info?.pageCount) || 0;
    if (liveCount > 0) {
      const todaySnap = db.getTodayPageSnapshot(p.id);
      const marcoZero = (todaySnap && todaySnap.start_page_count >= 0)
        ? todaySnap.start_page_count
        : liveCount;

      db.updatePrinterInitialPageCount(p.id, marcoZero);
      p.initialPageCount = marcoZero;
      calibratedCount++;
    }
  }

  res.json({
    success: true,
    message: `Marco zero calibrado com sucesso para ${calibratedCount} impressora(s).`,
    calibratedCount
  });
});

// Consultar status de uma impressora em tempo real (SNMP / HTTP / TCP) com cache enriquecido
app.get('/api/printers/:id/status', async (req, res) => {
  console.log('\x1b[36m%s\x1b[0m', `GET /api/printers/${req.params.id}/status - Reconsultando telemetria em tempo real`);
  const { id } = req.params;
  const printers = await loadPrinters();
  const printer = printers.find(p => p.id === id);

  if (!printer) {
    return res.status(404).json({ error: 'Impressora não encontrada no cadastro.' });
  }

  const entry = await processSinglePrinterTelemetry(printer);
  res.json({ printer, data: entry });
});

// Testar conexão SNMP por ID
app.get('/api/printers/:id/test', async (req, res) => {
  console.log('\x1b[36m%s\x1b[0m', `GET /api/printers/${req.params.id}/test - Testando conexão SNMP`);
  const { id } = req.params;
  const printers = await loadPrinters();
  const printer = printers.find(p => p.id === id);

  if (!printer) {
    return res.status(404).json({ error: 'Impressora não encontrada.' });
  }

  const testResult = await testConnection(printer.ip, printer.community);
  res.json(testResult);
});

// Testar conexão SNMP para qualquer IP avulso (não cadastrado)
app.get('/api/test-ip', async (req, res) => {
  const ip = req.query.ip ? req.query.ip.trim() : '';
  const community = req.query.community ? req.query.community.trim() : 'public';

  if (!ip) {
    return res.status(400).json({ error: 'Endereço IP é obrigatório.' });
  }

  console.log('\x1b[36m%s\x1b[0m', `GET /api/test-ip?ip=${ip} - Testando IP avulso na rede`);
  const testResult = await testConnection(ip, community);

  let details = null;
  if (testResult.success) {
    try {
      details = await queryPrinterStatus(ip, community);
    } catch (e) {
      details = null;
    }
  }

  res.json({
    ...testResult,
    ip,
    details
  });
});

// Detecta o MAC Address de um IP avulso na rede
app.get('/api/network/detect-mac', async (req, res) => {
  try {
    const ip = req.query.ip ? req.query.ip.trim() : '';
    if (!ip || !isValidIpv4(ip)) {
      return res.status(400).json({ error: 'Endereço IPv4 válido é obrigatório (ex: 198.18.5.50).' });
    }

    const mac = await getPrinterMacAddress(ip);
    if (!mac) {
      return res.status(404).json({ success: false, message: 'MAC Address não detectado via SNMP ou ARP.' });
    }

    const printer = db.getPrinterByIp(ip);
    if (printer && !printer.macAddress) {
      db.savePrinter({ ...printer, macAddress: mac });
    }

    res.json({ success: true, ip, macAddress: mac });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catálogo de Sub-redes Corporativas (Varredura Global por MAC)
app.get('/api/network/subnets', (req, res) => {
  try {
    const subnets = db.getCorporateSubnets();
    res.json(subnets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/network/subnets', requireAdmin, (req, res) => {
  try {
    const { subnet, description } = req.body;
    if (!subnet) return res.status(400).json({ error: 'Sub-rede é obrigatória (ex: 198.18.2)' });
    const created = db.addCorporateSubnet(subnet, description || '');
    res.json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/network/subnets/:id', requireAdmin, (req, res) => {
  try {
    db.deleteCorporateSubnet(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consulta direta por IP ou varredura por identidade, preservando trocas físicas.
app.post('/api/network/scan-mac', requireAdmin, async (req, res) => {
  try {
    let { subnet, unitId, isGlobal, autoReconcile = true } = req.body;
    let target;
    try { target = parseNetworkScanTarget(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const allPrinters = await loadPrinters();

    const rawTarget = target.raw;
    const specificTargetIp = target.ip;
    const specificTargetMac = target.mac;
    const specificTargetSerial = target.serial;

    let targetMacList = specificTargetMac ? [specificTargetMac] : [];
    let targetSerialList = specificTargetSerial ? [specificTargetSerial] : [];

    const isGlobalScan = !specificTargetIp && (isGlobal || subnet === 'global' || subnet === 'todas' || unitId === 'global' || (!subnet && !unitId));
    let subnetsToScan = [];

    if (specificTargetIp) {
      subnet = specificTargetIp.split('.').slice(0, 3).join('.');
    } else if (isGlobalScan) {
      const corporateSubnets = db.getCorporateSubnets();
      if (!corporateSubnets || corporateSubnets.length === 0) {
        return res.status(400).json({ error: 'Nenhuma sub-rede corporativa cadastrada no catálogo da empresa.' });
      }
      subnetsToScan = corporateSubnets.map(s => ({ subnet: s.subnet, name: s.description || s.subnet }));
      console.log('\x1b[36m%s\x1b[0m', `[Hardware Scanner] 🌐 Iniciando VARREDURA GLOBAL em ${subnetsToScan.length} sub-redes corporativas...`);
    } else {
      // Se nenhuma sub-rede informada, tenta derivar dos IPs cadastrados na unidade
      if (!subnet && unitId) {
        const unitPrinters = allPrinters.filter(p => p.unitId === unitId && p.ip && !p.ip.includes('pendente') && p.ip !== '-');
        if (unitPrinters.length > 0) {
          const parts = unitPrinters[0].ip.split('.');
          if (parts.length >= 3) {
            subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
          }
        }
      }

      if (!subnet) {
        return res.status(400).json({ error: 'Faixa de sub-rede não informada. Exemplo: 198.18.5 ou selecione Varredura Global.' });
      }
      subnetsToScan = [{ subnet, name: 'Filial Selecionada' }];
    }

    const foundDevices = specificTargetIp ? await discoverPrinterAtIp(specificTargetIp, {
      community: allPrinters.find(p => p.ip === specificTargetIp)?.community || 'public',
      query: queryPrinterStatus, getMac: getPrinterMacAddress
    }) : [];
    let totalScannedIps = specificTargetIp ? 1 : 0;

    for (const item of subnetsToScan) {
      if (specificTargetMac) {
        console.log('\x1b[36m%s\x1b[0m', `[Hardware Scanner] 🔍 Buscando MAC ${specificTargetMac} na sub-rede ${item.subnet}.0/24 (${item.name})...`);
      } else if (specificTargetSerial) {
        console.log('\x1b[36m%s\x1b[0m', `[Hardware Scanner] 🔍 Buscando Serial ${specificTargetSerial} na sub-rede ${item.subnet}.0/24 (${item.name})...`);
      } else {
        console.log('\x1b[36m%s\x1b[0m', `[Hardware Scanner] 🔍 Varrendo sub-rede ${item.subnet}.0/24 (${item.name})...`);
      }

      const scanOpts = {
        timeout: 800,
        concurrency: 30,
        targetSerials: targetSerialList
      };

      const batchDevices = await scanSubnetForMac(item.subnet, targetMacList, scanOpts);
      totalScannedIps += 254;

      for (const d of batchDevices) {
        d.foundInSubnet = item.subnet;
        d.subnetDescription = item.name;
        foundDevices.push(d);
      }

      // Se estiver buscando um alvo específico e já o localizou, encerra imediatamente a varredura global
      const hasMacMatch = specificTargetMac && foundDevices.some(d => formatMacAddress(d.mac) === specificTargetMac);
      const hasSerialMatch = specificTargetSerial && foundDevices.some(d => d.serial && d.serial.toUpperCase().replace(/[\s-]/g, '') === specificTargetSerial);

      if (hasMacMatch || hasSerialMatch) {
        const targetDesc = specificTargetMac || specificTargetSerial;
        console.log('\x1b[32m%s\x1b[0m', `[Hardware Scanner] 🎯 Alvo ${targetDesc} localizado na sub-rede ${item.subnet}.0/24! Interrompendo varredura.`);
        break;
      }
    }

    let finalDevices = foundDevices;
    if (specificTargetMac) {
      finalDevices = finalDevices.filter(d => formatMacAddress(d.mac) === specificTargetMac);
    } else if (specificTargetSerial) {
      finalDevices = finalDevices.filter(d => d.serial && d.serial.toUpperCase().replace(/[\s-]/g, '') === specificTargetSerial);
    }

    console.log('\x1b[32m%s\x1b[0m', `[Hardware Scanner] ✅ Varredura concluída. ${finalDevices.length} dispositivo(s) correspondente(s).`);

    const reconciled = [];
    const telemetryRefreshed = [];
    for (const dev of finalDevices) {
      const devMac = dev.mac ? formatMacAddress(dev.mac) : null;
      const devSerial = dev.serial ? dev.serial.toUpperCase().replace(/[\s-]/g, '') : null;
      Object.assign(dev, classifyScannedPrinter(dev, allPrinters, id => db.getCachedStatus(id)));
      if (dev.replacementRequired || dev.identityUnconfirmed) continue;
      const matchedPrinter = allPrinters.find(p => p.id === dev.registeredPrinterId);

      if (matchedPrinter) {
        dev.registeredPrinterId = matchedPrinter.id;
        dev.registeredName = matchedPrinter.name;
        dev.registeredLocation = matchedPrinter.location;
        dev.previousIp = matchedPrinter.ip;
        dev.registeredUnit = matchedPrinter.unitName;
        dev.registeredUnitId = matchedPrinter.unitId;

        let effectivePrinter = matchedPrinter;
        let ipReconciled = false;

        if (autoReconcile && matchedPrinter.ip !== dev.ip) {
          let recResult = null;
          if (devMac) {
            recResult = db.reconcilePrinterIpByMac(devMac, dev.ip);
          }
          if ((!recResult || !recResult.success) && devSerial) {
            recResult = db.reconcilePrinterIpBySerial(devSerial, dev.ip);
          }

          if (recResult && recResult.success && recResult.updated) {
            ipReconciled = true;
            reconciled.push({
              printerId: matchedPrinter.id,
              name: matchedPrinter.name,
              location: matchedPrinter.location,
              macAddress: dev.mac,
              serialNumber: dev.serial,
              previousIp: matchedPrinter.ip,
              newIp: dev.ip
            });
            effectivePrinter = db.getPrinterById(matchedPrinter.id) || { ...matchedPrinter, ip: dev.ip };
          }
        }

        const sameIpConfirmed = effectivePrinter.ip === dev.ip;
        dev.sameIpConfirmed = sameIpConfirmed && !ipReconciled;
        dev.ipReconciled = ipReconciled;

        // MON-001.3C — localizar o hardware não encerra o fluxo no scanner:
        // quando a identidade cadastrada foi confirmada no mesmo IP (ou reconciliada
        // para um novo IP), reconsulta imediatamente a telemetria completa para que
        // o cache, o Health Engine e a UI retomem o acompanhamento daquele equipamento.
        if (sameIpConfirmed) {
          try {
            const telemetry = await processSinglePrinterTelemetry(effectivePrinter);
            const refreshedHealth = telemetry?.health || db.getPrinterHealth(effectivePrinter.id);
            dev.telemetryRevalidated = Boolean(telemetry);
            dev.telemetryOnline = Boolean(telemetry?.online);
            dev.healthState = refreshedHealth?.state || null;
            dev.healthReasonCode = refreshedHealth?.reasonCode || null;

            telemetryRefreshed.push({
              printerId: effectivePrinter.id,
              previousIp: matchedPrinter.ip,
              currentIp: effectivePrinter.ip,
              ipChanged: matchedPrinter.ip !== effectivePrinter.ip,
              online: Boolean(telemetry?.online),
              healthState: refreshedHealth?.state || null,
              healthReasonCode: refreshedHealth?.reasonCode || null
            });
          } catch (refreshErr) {
            dev.telemetryRevalidated = false;
            dev.telemetryRefreshError = refreshErr.message;
            console.warn(`[Hardware Scanner] Equipamento ${matchedPrinter.id} localizado em ${dev.ip}, mas a revalidação de telemetria falhou: ${refreshErr.message}`);
          }
        }
      }
    }

    res.json({
      success: true,
      subnet: isGlobalScan ? 'global' : subnet,
      isGlobal: isGlobalScan,
      subnetsScanned: subnetsToScan.map(s => s.subnet),
      targetIdentifier: rawTarget || undefined,
      targetIp: specificTargetIp || undefined,
      targetMac: specificTargetMac || undefined,
      targetSerial: specificTargetSerial || undefined,
      totalScanned: totalScannedIps,
      totalFound: finalDevices.length,
      devices: finalDevices,
      reconciled,
      telemetryRefreshed
    });
  } catch (err) {
    console.error('[API Scan MAC Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Reconciliação explícita de IP via MAC
app.post('/api/network/reconcile-ip', requireAdmin, (req, res) => {
  const { macAddress, newIp } = req.body;
  if (!macAddress || !newIp) {
    return res.status(400).json({ error: 'macAddress e newIp são obrigatórios.' });
  }
  const result = db.reconcilePrinterIpByMac(macAddress, newIp);
  if (!result.success) {
    return res.status(400).json(result);
  }
  updateAllPrintersCache().catch(() => {});
  res.json(result);
});

// Atribuição explícita de IP a uma impressora existente
app.post('/api/network/assign-ip', requireAdmin, async (req, res) => {
  try {
    const { printerId, newIp, macAddress, serialNumber } = req.body;
    if (!printerId || !newIp) {
      return res.status(400).json({ error: 'ID da impressora e novo endereço IP são obrigatórios.' });
    }

    const printer = db.getPrinterById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Impressora não encontrada no cadastro.' });
    }

    const previousIp = printer.ip;
    const cleanMac = macAddress ? formatMacAddress(macAddress) : (printer.macAddress || null);
    const cleanSerial = serialNumber ? String(serialNumber).trim() : (printer.serialNumber || null);

    // Tratamento de colisão de IP caso o novo IP já estivesse atribuído a outro registro
    try {
      const collision = db.getDb().prepare('SELECT id, name, location FROM printers WHERE ip = ? AND id != ?').get(newIp, printerId);
      if (collision) {
        const backupTag = `pendente-deslocada-${Date.now().toString().slice(-4)}`;
        db.getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?').run(backupTag, new Date().toISOString(), collision.id);
        console.log(`[Assign IP] ⚠️ Colisão resolvida: IP ${newIp} transferido da impressora ${collision.name || collision.location} para ${printer.name || printer.location}`);
      }
    } catch (colErr) {
      console.warn('[Assign IP Collision Warning]', colErr.message);
    }

    // Salva a impressora atualizada no SQLite
    db.savePrinter({
      ...printer,
      ip: newIp,
      macAddress: cleanMac,
      serialNumber: cleanSerial
    });

    // Sincroniza printers.json
    try {
      const all = db.getPrinters();
      await savePrinters(all);
    } catch {}

    // Invalida cache de status anterior e consulta o novo IP imediatamente
    STATUS_CACHE.delete(printerId);
    queryPrinterStatus(newIp, printer.community || 'public').then(st => {
      if (st) STATUS_CACHE.set(printerId, st);
    }).catch(() => {});

    updateAllPrintersCache().catch(() => {});

    const updated = db.getPrinterById(printerId);
    res.json({
      success: true,
      message: `IP ${newIp} atribuído com sucesso a ${printer.location || printer.name}!`,
      printer: updated,
      previousIp,
      newIp,
      macAddress: cleanMac,
      serialNumber: cleanSerial
    });
  } catch (err) {
    console.error('[API Assign IP Error]', err);
    res.status(500).json({ error: err.message || 'Erro ao atribuir IP à impressora.' });
  }
});

// ------------------------------------
// ROTAS DE REPOSIÇÃO & COMPRAS
// ------------------------------------

// Listar itens de reposição
app.get('/api/replenishments', async (req, res) => {
  try {
    const items = db.getReplenishments();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar ou atualizar item na fila de reposição
app.post('/api/replenishments', requireAdmin, async (req, res) => {
  try {
    const { id, printerId, printerName, location, supplyName, supplyType, percentage, orderStatus, notes, modelPart } = req.body;
    if (!printerId || !supplyName) {
      return res.status(400).json({ error: 'printerId e supplyName são obrigatórios.' });
    }

    const all = db.getReplenishments();
    const existing = all.find(i => (id && i.id === id) || (i.printerId === printerId && i.supplyName === supplyName));

    const now = new Date().toISOString();
    if (existing) {
      const updated = db.saveReplenishment({
        ...existing,
        printerName: printerName || existing.printerName,
        location: location !== undefined ? location : existing.location,
        percentage: percentage !== undefined ? percentage : existing.percentage,
        orderStatus: orderStatus || existing.orderStatus,
        notes: notes !== undefined ? notes : existing.notes,
        modelPart: modelPart !== undefined ? modelPart : existing.modelPart,
        updatedAt: now
      });
      return res.json(updated);
    }

    const newItem = {
      id: id || uuidv4(),
      printerId,
      printerName: printerName || 'Impressora',
      location: location || '',
      supplyName,
      supplyType: supplyType || 'other',
      percentage: percentage || 0,
      orderStatus: orderStatus || 'pending',
      modelPart: modelPart || '',
      notes: notes || '',
      createdAt: now,
      updatedAt: now
    };

    const saved = db.saveReplenishment(newItem);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar status de um item de reposição
app.put('/api/replenishments/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, notes, modelPart, percentage, printerName, location } = req.body;

    const existing = db.getReplenishmentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Item de reposição não encontrado.' });
    }

    const updated = db.saveReplenishment({
      ...existing,
      printerName: printerName || existing.printerName,
      location: location !== undefined ? location : existing.location,
      orderStatus: orderStatus || existing.orderStatus,
      notes: notes !== undefined ? notes : existing.notes,
      modelPart: modelPart !== undefined ? modelPart : existing.modelPart,
      percentage: percentage !== undefined ? percentage : existing.percentage,
      updatedAt: new Date().toISOString()
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover ou concluir item de reposição
app.delete('/api/replenishments/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteReplenishment(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------
// ROTAS DO PROJETO HEFESTO - HISTÓRICO DE RECARGAS
// ------------------------------------

// Listar todas as recargas (com suporte a filtros por printerId, unitName ou apenas oficiais)
app.get('/api/recharges', async (req, res) => {
  const { printerId, unitName, fullOnly } = req.query;
  let recharges = await loadRecharges();

  if (printerId) {
    recharges = recharges.filter(r => r.printerId === printerId);
  }
  if (unitName) {
    recharges = recharges.filter(r => r.unitName.toLowerCase() === unitName.toLowerCase());
  }
  if (fullOnly === 'true') {
    recharges = recharges.filter(r => r.isFullRecharge === true);
  }

  // Ordena das mais recentes para as mais antigas
  recharges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(recharges);
});

// Resumo rápido da última recarga por impressora (enriquece cards e tabela instantaneamente)
app.get('/api/recharges/summary', async (req, res) => {
  res.json(db.getRechargesSummary());
});

// Endpoint de eventos recentes de recarga (usado pelo frontend para alertas Toast em tempo real)
app.get('/api/recharges/recent-events', async (req, res) => {
  try {
    const events = db.getRecentRechargeEvents(10);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar eventos recentes de recarga.' });
  }
});

// Endpoint de Saneamento e Auditoria Autônoma de Recargas (Hefesto Antifalhas)
app.post('/api/recharges/clean', requireAdmin, (req, res) => {
  try {
    const result = db.cleanSpuriousRecharges();
    res.json({
      success: true,
      message: `Auditoria concluída: ${result.deletedCount} registros espúrios/duplicados removidos.`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao executar auditoria de recargas: ' + err.message });
  }
});

// Registro manual de recarga (lançado pelo técnico de campo)
app.post('/api/recharges', requireAdmin, async (req, res) => {
  const { printerId, printerName, ip, unitName, location, supplyName, supplyType, previousLevel, newLevel, pageCount, isFull, technician, notes, timestamp, updateInitialPageCount, initialPageCount } = req.body;

  if (!printerId || !supplyName || newLevel == null || !Number.isFinite(Number(newLevel)) || Number(newLevel) < 0 || Number(newLevel) > 100 || (pageCount != null && (!Number.isSafeInteger(Number(pageCount)) || Number(pageCount) < 0))) {
    return res.status(400).json({ error: 'printerId, supplyName e newLevel são obrigatórios.' });
  }

  const result = await registerRechargeEvent({
    printerId,
    printerName,
    ip,
    unitName,
    location,
    supplyName,
    supplyType: supplyType || 'toner',
    previousLevel: previousLevel != null ? Number(previousLevel) : null,
    newLevel: Number(newLevel),
    pageCount: pageCount != null ? Number(pageCount) : null,
    source: 'manual',
    isFull: isFull !== undefined ? Boolean(isFull) : (Number(newLevel) >= 95),
    technician: technician ? technician.trim() : 'Técnico de Campo',
    notes: notes ? notes.trim() : 'Lançamento manual de reposição de suprimento',
    timestamp: timestamp || new Date().toISOString()
  });

  if (!result) {
    return res.status(500).json({ error: 'Falha ao gravar registro de recarga.' });
  }

  // Atualização unificada do Marco Inicial sob Gestão junto à carga
  if (updateInitialPageCount || initialPageCount !== undefined) {
    const targetInitial = Number(initialPageCount !== undefined ? initialPageCount : pageCount) || 0;
    const printer = db.getPrinterById(printerId);
    if (printer) {
      db.savePrinter({
        ...printer,
        initialPageCount: targetInitial,
        hefestoActivatedAt: timestamp || printer.hefestoActivatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`[Recharge] Marco de ativação da impressora "${printer.name}" atualizado para ${targetInitial} pág.`);
    }
  }

  // O registro do técnico não substitui a leitura física do sensor.
  if ((process.env.APP_MODE || '').toLowerCase() === 'edge') {
    edgeSync.triggerEdgeSync().catch(() => {});
  }

  res.status(201).json(result);
});

// Remover registro de recarga
app.delete('/api/recharges/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = db.deleteRecharge(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Registro de recarga não encontrado.' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('[Hefesto Recharges] Erro ao deletar recarga:', err);
    res.status(500).json({ error: 'Erro ao remover registro de recarga.' });
  }
});

// ==========================================================================
// MOTOR ANALÍTICO: VOLUME DE PÁGINAS (DIA/SEMANA/MÊS) E PREVISIBILIDADE
// ==========================================================================
app.get('/api/analytics/volume-forecast', async (req, res) => {
  try {
    const printers = await loadPrinters();
    const pageHistory = await loadPageHistory();
    const now = new Date();
    const todayStr = getBusinessDateKey(now);
    const date7DaysAgo = getRollingPeriodStartDateKey(7, now);
    const date30DaysAgo = getRollingPeriodStartDateKey(30, now);

    const results = printers.map(p => {
      const cached = STATUS_CACHE.get(p.id) || {};
      const info = cached.info || {};
      const supplies = cached.supplies || [];
      const currentTotalPages = Number.isSafeInteger(info.pageCount) && info.pageCount >= 0 ? info.pageCount : null;
      const cleanModel = formatCleanModel(info.model || p.name);
      const nominal = getPrinterNominalMetrics(info.model, p.name, db.getDb());

      // Snapshots históricos desta impressora
      const pSnapshots = pageHistory.filter(h => h.printerId === p.id).sort((a, b) => a.date.localeCompare(b.date));
      const todaySnap = pSnapshots.find(h => h.date === todayStr);
      const snap7Days = pSnapshots.filter(h => h.date >= date7DaysAgo);
      const snap30Days = pSnapshots.filter(h => h.date >= date30DaysAgo);
      const observedDays7 = new Set(snap7Days.map(h => h.date)).size;
      const observedDays30 = new Set(snap30Days.map(h => h.date)).size;
      const has7DayBaseline = pSnapshots.some(h => h.date === date7DaysAgo);
      const has30DayBaseline = pSnapshots.some(h => h.date === date30DaysAgo);
      const historyStartDate = pSnapshots.length > 0 ? pSnapshots[0].date : null;

      // Recupera o contador físico efetivo (se online usa o live, se offline usa o último snapshot gravado)
      const effectivePageCount = currentTotalPages ?? todaySnap?.endPageCount ?? null;

      const printEvidence = db.getDailyPrintEvidence(p.id);
      const pagesToday = printEvidence.pages;

      // 2. Páginas Semana (7 dias acumulados reais)
      const oldest7 = snap7Days[0] || null;
      let pagesThisWeek = pagesToday;
      if (oldest7 && typeof oldest7.startPageCount === 'number' && oldest7.startPageCount >= 0) {
        const delta7 = calculateProductionDelta(oldest7.startPageCount, effectivePageCount);
        if (delta7.valid) {
          pagesThisWeek = Math.max(pagesToday ?? 0, delta7.delta);
        }
      }

      // 3. Páginas Mês (30 dias acumulados reais)
      const oldest30 = snap30Days[0] || null;
      let pagesThisMonth = pagesThisWeek;
      if (oldest30 && typeof oldest30.startPageCount === 'number' && oldest30.startPageCount >= 0) {
        const delta30 = calculateProductionDelta(oldest30.startPageCount, effectivePageCount);
        if (delta30.valid) {
          pagesThisMonth = Math.max(pagesThisWeek ?? 0, delta30.delta);
        }
      }

      if (snap7Days.some(h => h.hasCounterRegression)) pagesThisWeek = null;
      if (snap30Days.some(h => h.hasCounterRegression)) pagesThisMonth = null;

      // Média diária operacional: usa dias-calendário cobertos pela janela,
      // não a quantidade de linhas/snapshots existentes no banco.
      let avgPagesPeriod = '7d';
      let avgPagesPeriodDays = oldest7?.date
        ? getInclusiveDateSpanDays(oldest7.date, todayStr, 7)
        : 1;
      let avgPagesPerDay = pagesThisWeek > 0 ? Math.round(pagesThisWeek / avgPagesPeriodDays) : 0;

      // Fallback de 30d apenas quando a janela recente ainda não possui produção útil.
      if (avgPagesPerDay < 1 && pagesThisMonth > 0 && oldest30?.date) {
        avgPagesPeriod = '30d_fallback';
        avgPagesPeriodDays = getInclusiveDateSpanDays(oldest30.date, todayStr, 30);
        avgPagesPerDay = Math.max(1, Math.round(pagesThisMonth / avgPagesPeriodDays));
      }
      if (avgPagesPerDay < 1 && pagesToday > 0) {
        avgPagesPerDay = pagesToday;
      }

      // Status de Carga / Capacidade da Impressora
      const projectedMonthly = avgPagesPerDay > 0 ? avgPagesPerDay * 30 : 0;
      const workload = calculateWorkload(projectedMonthly, nominal.monthlyMaxNominal);
      const capacityRatio = workload.capacityRatio;
      const workloadStatus = workload.workloadStatus;
      const workloadLabel = workload.workloadLabel;

      // Previsão para cada suprimento
      const validSupplies = supplies.filter(s => !isWasteSupply(s));
      const suppliesForecast = validSupplies.map(s => {
        const isColor = /cyan|magenta|yellow|ciano|amarelo/i.test(s.name || '');
        const nominalYield = isColor ? nominal.colorYieldNominal : nominal.blackYieldNominal;
        const isRefillable = isRefillableTank(s);
        const percentage = normalizeSupplyPercentage(s);
        const forecast = calculateConsumableForecast({
          supply: s,
          avgPagesPerDay: avgPagesPerDay > 0 ? avgPagesPerDay : null,
          nominalYield,
          isEstimated: isRefillable || Boolean(s.estimated)
        });

        return {
          name: s.name,
          type: s.type || 'toner',
          percentage: percentage ?? s.percentage,
          isRefillable,
          nominalYield: nominalYield || null,
          pagesRemainingEstimated: forecast.pagesRemainingEstimated,
          daysRemainingEstimated: forecast.daysRemainingEstimated,
          estimatedDepletionDate: forecast.estimatedDepletionDate,
          forecastAvailable: forecast.available,
          forecastUnavailableReason: forecast.reason
        };
      });

      // Suporte a impressoras com múltiplos toners da mesma cor (ex: Xerox C60/C70 com compartimento duplo K1 e K2)
      // Se houver múltiplos toners pretos e pelo menos um estiver com boa carga (>10%),
      // o cartucho reserva vazio (0%) não derruba a previsão da máquina para "0 páginas restantes".
      const blackToners = suppliesForecast.filter(s => (s.type === 'toner' || !s.type) && /black|preto|k1|k2/i.test(s.name || ''));
      const hasDualBlack = blackToners.length > 1;
      const maxBlackPct = hasDualBlack ? Math.max(...blackToners.map(b => Number(b.percentage) || 0)) : 0;

      // Suprimento mais crítico (que de fato dita a parada operacional do equipamento)
      let mostCritical = null;
      const availableForecasts = suppliesForecast.filter(s => s.forecastAvailable && s.daysRemainingEstimated !== null);
      if (availableForecasts.length > 0) {
        const evaluatableSupplies = availableForecasts.filter(s => {
          if (hasDualBlack && maxBlackPct > 10 && /black|preto|k1|k2/i.test(s.name || '')) {
            if ((Number(s.percentage) || 0) <= 10) return false;
          }
          return true;
        });

        const listToEvaluate = evaluatableSupplies.length > 0 ? evaluatableSupplies : availableForecasts;
        mostCritical = listToEvaluate.reduce((min, curr) => curr.daysRemainingEstimated < min.daysRemainingEstimated ? curr : min, listToEvaluate[0]);
      }

      return {
        printerId: p.id,
        printerName: p.name,
        ip: p.ip,
        macAddress: p.macAddress || info.macAddress || '',
        serialNumber: p.serialNumber || info.serialNumber || '',
        unitId: p.unitId || '',
        unitName: p.unitName || 'Sem Unidade',
        location: p.location || 'Sem Local',
        model: cleanModel || p.name,
        pageCount: currentTotalPages,
        online: cached.online !== false,
        pagesToday,
        printEvidence,
        pagesThisWeek,
        pagesThisMonth,
        observedDays7,
        observedDays30,
        has7DayBaseline,
        has30DayBaseline,
        periodStart7: date7DaysAgo,
        periodStart30: date30DaysAgo,
        historyStartDate,
        avgPagesPerDay,
        avgPagesPeriod,
        avgPagesPeriodDays,
        capacityMonthlyNominal: nominal.monthlyMaxNominal,
        projectedMonthlyVolume: projectedMonthly,
        capacityRatio,
        workloadStatus,
        workloadLabel,
        suppliesForecast,
        criticalSupply: mostCritical ? {
          name: mostCritical.name,
          percentage: mostCritical.percentage,
          isRefillable: mostCritical.isRefillable,
          daysRemaining: mostCritical.daysRemainingEstimated,
          depletionDate: mostCritical.estimatedDepletionDate,
          pagesRemaining: mostCritical.pagesRemainingEstimated
        } : null
      };
    });

    res.json(results);
  } catch (err) {
    console.error('[Analytics] Erro ao gerar volume e previsão:', err);
    res.status(500).json({ error: 'Erro ao calcular volume e previsibilidade.' });
  }
});

// Relatório de Auditoria de Integração e Início na Rede
app.get('/api/reports/initial-integration', async (req, res) => {
  try {
    const printers = await loadPrinters();
    const pageHistory = await loadPageHistory();

    const report = printers.map(p => {
      const cached = STATUS_CACHE.get(p.id);
      const info = cached?.info || {};
      const isOnline = cached ? cached.online : false;
      const model = formatCleanModel(info.model || p.name);
      const serial = (info.serialNumber && info.serialNumber !== 'N/D') ? info.serialNumber : (p.name || 'N/D');
      const curCount = Number.isSafeInteger(info.pageCount) ? info.pageCount : null;
      const initCount = Number.isSafeInteger(p.initialPageCount) ? p.initialPageCount : null;
      const delta = curCount !== null && initCount !== null && curCount >= initCount ? curCount - initCount : null;

      let statusDesc = 'Sem conexão';
      if (isOnline) {
        const supplies = cached?.supplies || [];
        const criticalSupply = supplies.find(s => s.percentage >= 0 && s.percentage < 10);
        const warningSupply = supplies.find(s => s.percentage >= 0 && s.percentage <= 30);
        if (criticalSupply) statusDesc = 'Nível Crítico';
        else if (warningSupply) statusDesc = 'Nível Atenção';
        else statusDesc = 'Operacional';
      }

      return {
        printerId: p.id,
        name: p.name,
        ip: p.ip,
        location: p.location || '',
        unitId: p.unitId || '',
        unitName: p.unitName || 'Sem Unidade',
        model,
        serialNumber: serial,
        installedAt: p.installedAt || '',
        hefestoActivatedAt: p.hefestoActivatedAt || p.createdAt || '2026-08-19T08:00:00.000Z',
        createdAt: p.createdAt || '2026-08-19T08:00:00.000Z',
        initialPageCount: initCount,
        currentPageCount: curCount,
        pagesProducedSinceIntegration: delta,
        online: isOnline,
        status: statusDesc
      };
    });

    res.json(report);
  } catch (err) {
    console.error('[IntegrationReport] Erro ao gerar relatório de integração:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de integração inicial.' });
  }
});

// Processa telemetria completa de uma única impressora com enriquecimento, persistência e auditoria de recargas
export async function processSinglePrinterTelemetry(p, { query = queryPrinterStatus } = {}) {
  const healthCheckStartedAt = Date.now();
  try {
    const data = await query(p.ip, p.community);
    const currentAsset = db.getPrinterById(p.id);
    if (!isCurrentPrinterSnapshot(p, currentAsset)) return null;
    const previousEntry = STATUS_CACHE.get(p.id);
    const cachedDb = db.getCachedStatus(p.id);
    const isNowOnline = Boolean(data && data.online);
    if (hasPrinterIdentityConflict({ ...cachedDb?.info, macAddress: p.macAddress }, data?.info)) {
      throw new Error('Outro equipamento foi detectado neste IP. Use Substituir equipamento para preservar o histórico.');
    }

    // Preserva suprimentos válidos anteriores caso uma leitura pontual da rede venha vazia
    let suppliesToUse = Array.isArray(data?.supplies) && data.supplies.length > 0
      ? data.supplies
      : (previousEntry?.supplies && previousEntry.supplies.length > 0
          ? previousEntry.supplies
          : (cachedDb?.supplies && cachedDb.supplies.length > 0 ? cachedDb.supplies : []));

    // Obtém o estado anterior de suprimentos ANTES de atualizar o cache no DB
    const prevSupplies = (previousEntry && Array.isArray(previousEntry.supplies) && previousEntry.supplies.length > 0)
      ? previousEntry.supplies
      : (cachedDb?.supplies || []);

    // Auto-calibra o marco inicial (initial_page_count) se ainda estiver zerado e o hardware reportar contador
    const livePageCount = Number.isSafeInteger(data?.info?.pageCount) && data.info.pageCount >= 0 ? data.info.pageCount : null;
    if (p.initialPageCount === null && Number.isSafeInteger(data?.info?.pageCount) && data.info.pageCount >= 0) {
      const todaySnap = db.getTodayPageSnapshot(p.id);
      const startCount = (todaySnap && todaySnap.start_page_count >= 0) ? todaySnap.start_page_count : livePageCount;
      db.updatePrinterInitialPageCount(p.id, startCount);
      p.initialPageCount = startCount;
    }

    const printEvidence = db.getDailyPrintEvidence(p.id);
    const pagesToday = printEvidence.pages;

    const entry = {
      id: p.id,
      ip: p.ip,
      name: p.name,
      location: p.location,
      unitId: p.unitId || '',
      unitName: p.unitName || 'Sem Unidade',
      region: p.region || 'RJ',
      ...data,
      supplies: suppliesToUse,
      printEvidence,
      pagesToday,
      cachedAt: new Date().toISOString()
    };

    // MON-001: interpreta a leitura bruta e aplica histerese para evitar falso offline.
    const previousHealth = db.getPrinterHealth(p.id);
    const health = evaluatePrinterHealth({
      telemetry: { ...data, supplies: suppliesToUse },
      previousHealth,
      checkedAt: entry.cachedAt,
      latencyMs: Date.now() - healthCheckStartedAt
    });
    entry.health = health;

    // Persiste o cache de status e o estado operacional no SQLite.
    db.updateCachedStatus(p.id, entry);
    db.savePrinterHealth(p.id, health);

    // =====================================================================
    // MOTOR AUTÔNOMO DE DETECÇÃO & AUDITORIA DE RECARGAS (Projeto Hefesto)
    // =====================================================================
    if (isNowOnline && Array.isArray(entry.supplies)) {
      try {
        for (const newSup of entry.supplies) {
          const confKey = `${p.id}_${newSup.name}`;
          const baseline = resolveRechargeBaseline(findMatchingSupply(newSup, prevSupplies), newSup, db.getPendingRecharge(confKey));
          const oldSup = baseline.supply;

          if (oldSup && Number.isFinite(oldSup.percentage) && oldSup.percentage >= 0 && oldSup.percentage <= 100 &&
              Number.isFinite(newSup.percentage) && newSup.percentage >= 0 && newSup.percentage <= 100) {
            // Telemetria estimada nunca pode gerar evento oficial de recarga/troca.
            // Ex.: Epson M1180 via Web Config usa um valor sintético (~85%).
            const isEstimatedSupply = Boolean(
              oldSup.estimated ||
              newSup.estimated ||
              oldSup.semantics === 'estimated_remaining_supply' ||
              newSup.semantics === 'estimated_remaining_supply'
            );
            if (isEstimatedSupply) {
              db.deletePendingRecharge(confKey);
              continue;
            }

            const diff = newSup.percentage - oldSup.percentage;
            const newSerial = db.extractSupplySerial(newSup.name);
            const oldSerial = db.extractSupplySerial(oldSup.name);

            const isMaintenanceSupply = newSup.type === 'waste_toner' ||
                                       newSup.type === 'maintenance_kit' ||
                                       newSup.name?.toLowerCase().includes('waste') ||
                                       newSup.name?.toLowerCase().includes('manutenção') ||
                                       newSup.name?.toLowerCase().includes('manutencao');

            const diffThreshold = isMaintenanceSupply ? 40 : 15;
            const isSignificantJump = diff >= diffThreshold;
            const isNewHardware = Boolean(newSerial && oldSerial && newSerial !== oldSerial);

            if (isSignificantJump || isNewHardware) {
              if (isMaintenanceSupply && newSup.percentage < 90) {
                console.log(`[Recharge Anti-Glitch] Salto em caixa de resíduos ignorado para ${p.name}: atingiu ${newSup.percentage}% (exige >= 90% para peça nova)`);
                continue;
              }

              const isGlitch = !baseline.resumed && db.isRebootGlitch(p.id, newSup.name, newSup.percentage, 3);
              if (isGlitch) {
                console.log('\x1b[33m%s\x1b[0m', `[Hefesto Anti-Glitch] 🛡️ Descartado salto espúrio em ${p.name} (${newSup.name}): nível retornou para ${newSup.percentage}% (mesmo patamar anterior à oscilação transitória para -2%).`);
                continue;
              }

              db.setPendingRecharge(confKey, {
                printerId: p.id,
                supplyName: newSup.name,
                levelBefore: oldSup.percentage,
                levelAfter: newSup.percentage,
                supplyType: newSup.type,
                timestamp: Date.now()
              });

              setTimeout(async () => {
                try {
                  const fresh = await queryCurrentPrinterTelemetry({
                    snapshot: p, previousIdentity: { ...data?.info, macAddress: p.macAddress },
                    getCurrent: db.getPrinterById, query: queryPrinterStatus
                  });
                  if (!fresh) { db.deletePendingRecharge(confKey); return; }
                  if (fresh && fresh.online && Array.isArray(fresh.supplies)) {
                    const checkSup = findMatchingSupply(newSup, fresh.supplies);
                    if (checkSup && Number.isFinite(checkSup.percentage) && checkSup.percentage >= 0 && checkSup.percentage <= 100 &&
                        Math.abs(checkSup.percentage - newSup.percentage) <= 5) {
                      const confirmedEstimated = Boolean(
                        checkSup.estimated ||
                        checkSup.semantics === 'estimated_remaining_supply'
                      );

                      if (confirmedEstimated) {
                        db.deletePendingRecharge(confKey);
                        return;
                      }

                      const isFull = checkSup.percentage >= 95;
                      const freshPageCount = Number.isSafeInteger(fresh?.info?.pageCount) && fresh.info.pageCount >= 0 ? fresh.info.pageCount : null;
                      const previousPageCount = Number.isSafeInteger(previousEntry?.info?.pageCount) && previousEntry.info.pageCount >= 0 ? previousEntry.info.pageCount : null;
                      const confirmedSerial = db.extractSupplySerial(checkSup.name);

                      // MON-001.4C: registra a evidência e avança o ciclo de forma atômica.
                      // Apenas confiança oficial abre/fecha ciclos; medium permanece auditável como evidência.
                      const lifecycleResult = recordAndAdvanceConsumableLifecycle(db.getDb(), {
                        printerId: p.id,
                        supplySlot: db.normalizeSupplySlot(newSup.name),
                        supplyType: newSup.type || 'unknown',
                        previousLevel: oldSup.percentage,
                        newLevel: newSup.percentage,
                        confirmedLevel: checkSup.percentage,
                        previousSerial: oldSerial,
                        newSerial,
                        confirmedSerial,
                        previousSemantics: oldSup.semantics || '',
                        newSemantics: newSup.semantics || '',
                        confirmedSemantics: checkSup.semantics || '',
                        previousEstimated: Boolean(oldSup.estimated),
                        newEstimated: Boolean(newSup.estimated),
                        confirmedEstimated: Boolean(checkSup.estimated),
                        counterBefore: previousPageCount,
                        counterAfter: freshPageCount,
                        rebootGlitch: false,
                        telemetrySource: [newSup.source, checkSup.source].filter(Boolean).join('+'),
                        detectedAt: new Date().toISOString()
                      });

                      const lifecycleObservation = lifecycleResult.observation;
                      if (lifecycleObservation.recorded) {
                        console.log(`[Lifecycle Evidence] Evidência ${lifecycleObservation.event.confidence} registrada para ${p.name} (${newSup.name}) no contador ${freshPageCount}.`);
                      }

                      if (
                        lifecycleResult.lifecycle?.official &&
                        !['evidence_only', 'already_processed', 'no_transition'].includes(lifecycleResult.lifecycle.action)
                      ) {
                        console.log(`[Lifecycle Cycle] ${p.name} (${newSup.name}): ${lifecycleResult.lifecycle.action}.`);
                      }

                      if (!lifecycleObservation.eligible) { db.deletePendingRecharge(confKey); return; }
                      // Aumento de nível é uma detecção; apenas serial confirmado oferece evidência alta.
                      await registerRechargeEvent({
                        verificationStatus: lifecycleObservation.event.confidence === 'verified_auto_high' ? 'verified_auto_high' : 'detected_level_jump',
                        evidence: lifecycleObservation.event,
                        printerId: p.id,
                        printerName: p.name,
                        ip: p.ip,
                        unitName: p.unitName,
                        location: p.location,
                        supplyName: newSup.name,
                        supplyType: newSup.type,
                        previousLevel: oldSup.percentage,
                        newLevel: checkSup.percentage,
                        pageCount: freshPageCount,
                        source: 'auto',
                        isFull
                      });

                      db.deletePendingRecharge(confKey);
                    }
                  }
                } catch (err) {
                  console.warn(`[Recharge Verification] Falha na checagem rápida de ${p.ip}:`, err.message);
                }
              }, 10000);
            } else if (newSup.percentage <= oldSup.percentage) {
              db.deletePendingRecharge(confKey);
            }
          }
        }
      } catch (auditErr) {
        console.warn(`[Recharge Audit] Erro não fatal no processamento de recargas para ${p.name} (${p.id}):`, auditErr.message);
      }
    }

    try {
      const alertResult = db.recordDeviceAlertSnapshot({
        printerId: p.id,
        telemetry: data,
        previousAlerts: previousEntry?.alerts || cachedDb?.alerts || [],
        observedAt: entry.cachedAt
      });
      entry.alerts = alertResult.alerts;
      entry.alertsAvailable = alertResult.alertsAvailable;
      entry.alertsReason = alertResult.reason || null;
      entry.diagnostic = alertResult.diagnostic;
      entry.alertSources = alertResult.sources;
      db.updateCachedStatus(p.id, entry);
    } catch (alertErr) {
      console.warn(`[Device Alert] Erro ao sincronizar alertas de ${p.name}:`, alertErr.message);
    }

    STATUS_CACHE.set(p.id, entry);
    return entry;
  } catch (err) {
    const currentAsset = db.getPrinterById(p.id);
    if (!isCurrentPrinterSnapshot(p, currentAsset)) return null;
    const previousEntry = STATUS_CACHE.get(p.id) || db.getCachedStatus(p.id);
    const printEvidence = db.getDailyPrintEvidence(p.id);
    const pagesToday = printEvidence.pages;
    const errorEntry = {
      id: p.id,
      ip: p.ip,
      name: p.name,
      location: p.location,
      unitId: p.unitId || '',
      unitName: p.unitName || 'Sem Unidade',
      region: p.region || 'RJ',
      online: false,
      error: err.message,
      supplies: previousEntry?.supplies || [],
      info: previousEntry?.info || {},
      printEvidence,
      pagesToday,
      cachedAt: new Date().toISOString()
    };
    const health = evaluatePrinterHealth({
      telemetry: { online: false, error: err.message },
      previousHealth: db.getPrinterHealth(p.id),
      checkedAt: errorEntry.cachedAt,
      latencyMs: Date.now() - healthCheckStartedAt
    });
    errorEntry.health = health;
    const alerts = db.recordDeviceAlertSnapshot({ printerId: p.id, telemetry: errorEntry,
      previousAlerts: previousEntry?.alerts || [], observedAt: errorEntry.cachedAt });
    errorEntry.alerts = alerts.alerts;
    errorEntry.alertsAvailable = false;
    errorEntry.alertsReason = alerts.reason;
    errorEntry.diagnostic = alerts.diagnostic;
    db.updateCachedStatus(p.id, errorEntry);
    db.savePrinterHealth(p.id, health);
    STATUS_CACHE.set(p.id, errorEntry);
    return errorEntry;
  }
}

// Trava de concorrência para garantir loop único de coleta (F09)
let activeCollectionPromise = null;

// Função para atualizar o status de todas as impressoras em lotes controlados (sem sobrecarga de rede UDP)
async function updateAllPrintersCache() {
  if (activeCollectionPromise) {
    return activeCollectionPromise;
  }

  activeCollectionPromise = (async () => {
    try {
      const printers = await loadPrinters();
      if (printers.length === 0) return [];

      const BATCH_SIZE = 15;
      const results = [];
      for (let i = 0; i < printers.length; i += BATCH_SIZE) {
        const batch = printers.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(p => processSinglePrinterTelemetry(p)));
        results.push(...batchResults.filter(Boolean));
      }

      lastCacheUpdate = new Date();

      // Registra snapshot diário de contadores para o módulo analítico
      for (const item of results) {
        if (item && item.online && Number.isSafeInteger(item.info?.pageCount) && item.info.pageCount >= 0) {
          recordDailyPageSnapshot(item.id, item.info.pageCount, item.supplies, { observedAt: item.cachedAt }).catch(() => {});
        }
      }

      return results;
    } finally {
      activeCollectionPromise = null;
    }
  })();

  return activeCollectionPromise;
}

async function loadTelemetryHistory() {
  return db.getTelemetryHistory();
}

async function recordTelemetrySnapshot(results) {
  try {
    results.forEach(entry => {
      if (entry && entry.online) {
        db.recordTelemetrySnapshot({
          printerId: entry.id,
          ip: entry.ip,
          name: entry.name,
          unitName: entry.unitName,
          pageCount: entry.info?.pageCount ?? null,
          supplies: (entry.supplies || []).map(s => ({
            name: s.name,
            type: s.type,
            percentage: s.percentage
          }))
        });
      }
    });
  } catch (err) {
    console.error('[Telemetry History] Erro ao gravar histórico no SQLite:', err.message);
  }
}

// Background Worker: atualiza o cache silenciosamente a cada 3 minutos
if (isMainModule) {
  setInterval(async () => {
    try {
      const results = await updateAllPrintersCache();
      await recordTelemetrySnapshot(results);
    } catch (err) {
      console.error('[Cache Worker] Erro:', err.message);
    }
  }, 180000);
}

// ==========================================================================
// SELF-HEALING FLEET: MOTOR DE AUTO-CURA CONTÍNUA DE IMPRESSORAS EM BACKGROUND
// ==========================================================================
let isSelfHealingRunning = false;

export async function runSelfHealingCycle() {
  if (isSelfHealingRunning) {
    return { skipped: true, reason: 'Ciclo de auto-cura já em andamento' };
  }
  isSelfHealingRunning = true;

  try {
    const allPrinters = db.getPrinters();
    if (!allPrinters || allPrinters.length === 0) {
      return { checked: 0, healed: 0, devices: [] };
    }

    const rawHealthList = db.getAllPrinterHealth();
    const healthMap = new Map(rawHealthList.map(h => [h.printerId, h]));

    // Localiza impressoras que estão offline, em timeout ou sem IP e que possuem identificadores (MAC ou Serial)
    const candidatePrinters = allPrinters.filter(p => {
      const hasIdentity = Boolean((p.macAddress && p.macAddress.trim()) || (p.serialNumber && p.serialNumber.trim()));
      if (!hasIdentity) return false;

      const health = healthMap.get(p.id);
      const isUnconfigured = !p.ip || p.ip.startsWith('pendente-');
      const isFailedHealth = health && (
        health.state === 'offline' ||
        health.state === 'snmp_timeout' ||
        (Number(health.consecutiveFailures) >= 2)
      );

      return isUnconfigured || isFailedHealth;
    });

    if (candidatePrinters.length === 0) {
      return { checked: 0, healed: 0, devices: [] };
    }

    console.log('\x1b[36m%s\x1b[0m', `[Self-Healing Fleet] 🔍 Iniciando auto-recuperação para ${candidatePrinters.length} impressora(s) instável/offline...`);

    const healedList = [];
    const corporateSubnets = typeof db.getCorporateSubnets === 'function' ? db.getCorporateSubnets() : [];

    for (const printer of candidatePrinters) {
      try {
        const cleanMac = printer.macAddress ? formatMacAddress(printer.macAddress) : null;
        const cleanSerial = printer.serialNumber ? printer.serialNumber.toUpperCase().replace(/[\s-]/g, '') : null;

        // Determina a sub-rede a pesquisar
        const subnetsToProbe = new Set();
        if (printer.ip && !printer.ip.startsWith('pendente-') && /^(\d{1,3}\.){2}\d{1,3}/.test(printer.ip)) {
          const parts = printer.ip.split('.');
          subnetsToProbe.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }

        // Adiciona faixas da unidade associada à impressora
        if (printer.unitId && corporateSubnets.length > 0) {
          const unitSubnets = corporateSubnets.filter(s => s.unitId === printer.unitId || s.unit_id === printer.unitId);
          unitSubnets.forEach(s => subnetsToProbe.add(s.subnet));
        }

        if (subnetsToProbe.size === 0) continue;

        let foundDev = null;
        for (const subnet of subnetsToProbe) {
          const targetMacList = cleanMac ? [cleanMac] : [];
          const targetSerialList = cleanSerial ? [cleanSerial] : [];
          const scanOpts = {
            timeoutMs: 1200,
            concurrency: 30,
            targetSerials: targetSerialList,
            stopOnFirstMatch: true
          };

          if (!isCurrentPrinterSnapshot(printer, db.getPrinterById(printer.id))) break;
          const batchDevices = await scanSubnetForMac(subnet, targetMacList, scanOpts);
          if (!isCurrentPrinterSnapshot(printer, db.getPrinterById(printer.id))) break;
          if (batchDevices && batchDevices.length > 0) {
            foundDev = batchDevices.find(d => {
              const dMac = d.mac ? formatMacAddress(d.mac) : null;
              const dSerial = d.serial ? d.serial.toUpperCase().replace(/[\s-]/g, '') : null;
              return (cleanMac && dMac === cleanMac) || (cleanSerial && dSerial === cleanSerial);
            }) || batchDevices[0];
            if (foundDev) break;
          }
        }

        if (!foundDev || !isCurrentPrinterSnapshot(printer, db.getPrinterById(printer.id))) continue;

        // Equipamento localizado na rede! Reconcilia e atualiza
        let effectivePrinter = printer;
        let ipChanged = false;
        const previousIp = printer.ip;

        if (printer.ip !== foundDev.ip) {
          ipChanged = true;
          let recResult = null;
          if (cleanMac) {
            recResult = db.reconcilePrinterIpByMac(cleanMac, foundDev.ip);
          } else if (cleanSerial) {
            recResult = db.reconcilePrinterIpBySerial(cleanSerial, foundDev.ip);
          }

          if (recResult && recResult.success) {
            effectivePrinter = db.getPrinterById(printer.id) || { ...printer, ip: foundDev.ip };
            try {
              const all = db.getPrinters();
              await savePrinters(all);
            } catch {}
          }
        }

        // Revalida telemetria completa
        const telemetry = await processSinglePrinterTelemetry(effectivePrinter);
        const online = Boolean(telemetry?.online);

        healedList.push({
          printerId: printer.id,
          name: printer.name || printer.location,
          previousIp,
          currentIp: effectivePrinter.ip,
          ipChanged,
          online
        });

        if (ipChanged) {
          console.log('\x1b[32m%s\x1b[0m', `[Self-Healing Fleet] 🟢 Impressora "${printer.name || printer.location}" teve o IP migrado automaticamente de ${previousIp} para ${effectivePrinter.ip} e voltou a responder!`);
        } else {
          console.log('\x1b[32m%s\x1b[0m', `[Self-Healing Fleet] 🔄 Impressora "${printer.name || printer.location}" revalidada com sucesso no IP ${effectivePrinter.ip} (Online: ${online})!`);
        }
      } catch (err) {
        console.warn(`[Self-Healing Fleet] Erro ao recuperar ${printer.name || printer.id}: ${err.message}`);
      }
    }

    if (healedList.length > 0) {
      console.log('\x1b[32m%s\x1b[0m', `[Self-Healing Fleet] ✨ Ciclo concluído: ${healedList.length} impressora(s) recuperada(s) automaticamente.`);
    }

    return {
      checked: candidatePrinters.length,
      healed: healedList.length,
      devices: healedList
    };
  } catch (err) {
    console.error('[Self-Healing Fleet] Erro geral no ciclo:', err.message);
    return { checked: 0, healed: 0, error: err.message };
  } finally {
    isSelfHealingRunning = false;
  }
}

// Background Worker: executa o ciclo de auto-cura a cada 5 minutos
if (isMainModule) {
  setInterval(async () => {
    try {
      await runSelfHealingCycle();
    } catch (err) {
      console.error('[Self-Healing Worker] Erro:', err.message);
    }
  }, 300000);
}

// Endpoint para disparar auto-cura sob demanda
app.post('/api/system/self-heal', requireAdmin, async (req, res) => {
  try {
    const result = await runSelfHealingCycle();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para consulta do histórico de telemetria
app.get('/api/telemetry/history', async (req, res) => {
  const history = await loadTelemetryHistory();
  res.json(history);
});


function buildHealthOverview() {
  const printers = db.getPrinters();
  const rawById = new Map(db.getAllPrinterHealth().map(h => [h.printerId, h]));
  const printersHealth = printers.map(printer => {
    const raw = rawById.get(printer.id);
    const health = raw
      ? withStaleness(raw)
      : {
          state: HEALTH_STATES.STALE,
          severity: 'warning',
          reasonCode: 'never_checked',
          reason: 'Impressora ainda não possui uma leitura de saúde registrada.',
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          lastCheckAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastTransitionAt: null,
          latencyMs: null,
          lastError: null,
          criticalSupply: null,
          warningSupply: null,
          telemetrySource: null,
          stale: true
        };

    return {
      printerId: printer.id,
      name: printer.name,
      ip: printer.ip,
      location: printer.location || '',
      unitId: printer.unitId || '',
      unitName: printer.unitName || 'Sem Unidade',
      health
    };
  });

  const counts = Object.values(HEALTH_STATES).reduce((acc, state) => {
    acc[state] = 0;
    return acc;
  }, {});
  for (const item of printersHealth) {
    counts[item.health.state] = (counts[item.health.state] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    lastCacheUpdate: lastCacheUpdate ? lastCacheUpdate.toISOString() : null,
    totalPrinters: printersHealth.length,
    counts,
    printers: printersHealth
  };
}

// MON-001: visão operacional de saúde do parque.
app.get('/api/health', (req, res) => {
  res.json(buildHealthOverview());
});

app.get('/api/printers/:id/health', (req, res) => {
  const printer = db.getPrinterById(req.params.id);
  if (!printer) {
    return res.status(404).json({ error: 'Impressora não encontrada.' });
  }

  const raw = db.getPrinterHealth(printer.id);
  if (!raw) {
    return res.status(404).json({
      error: 'Saúde ainda não calculada para esta impressora.',
      printerId: printer.id
    });
  }

  res.json({
    printerId: printer.id,
    name: printer.name,
    ip: printer.ip,
    unitName: printer.unitName || 'Sem Unidade',
    health: withStaleness(raw)
  });
});

app.get('/api/printers/:id/alerts', requireAuth(), (req, res) => {
  const printer = db.getPrinterById(req.params.id);
  if (!printer) {
    return res.status(404).json({ error: 'Impressora não encontrada.' });
  }

  if (req.user.role !== 'admin' && req.user.unitId && req.user.unitId !== printer.unitId) {
    return res.status(403).json({ error: 'Impressora fora da sua unidade.' });
  }
  res.set('Cache-Control', 'no-store');
  const report = db.getPrinterAlertReport(printer.id, { limit: req.query.limit, offset: req.query.offset });
  const cached = STATUS_CACHE.get(printer.id) || db.getCachedStatus(printer.id);
  // A persisted last observation is evidence, never a promise of current reachability.
  const age = Date.now() - Date.parse(report.observedAt || cached?.cachedAt);
  const stale = !cached?.online || !Number.isFinite(age) || age < 0 || age > DEFAULT_HEALTH_POLICY.staleAfterMs;
  if (stale) {
    report.alertsAvailable = false;
    report.alertsReason = 'stale_or_offline';
    report.diagnostic = { ...report.diagnostic, current: false, state: 'unknown' };
  }
  res.json({
    printerId: printer.id,
    name: printer.name,
    ...enrichDiagnosticReport(report)
  });
});

// A versão publicada e suas notas vêm do manifesto do projeto.
const appRelease = JSON.parse(fsSync.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
app.get('/api/system/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const [major, minor, patch] = appRelease.version.split('.').map(Number);
  res.json({
    version: appRelease.version,
    semver: appRelease.version,
    major,
    minor,
    patch,
    releaseDate: appRelease.hefestoRelease.date,
    name: 'Hefesto Print Monitor',
    releaseTag: appRelease.hefestoRelease.summary,
    releaseNotes: appRelease.hefestoRelease.changes,
    architecture: {
      db: 'SQLite 3 (WAL mode)',
      antiDuplication: 'Multi-vector (MAC, Serial, Location, IP Reassignment)',
      lexmarkHttpScraper: 'Embedded & Fallback',
      tombstoneProtection: true,
      distributedModel: 'Hub & Edge Hybrid Architecture'
    }
  });
});

// ============================================================================
// HEFESTO EDGE & HUB: ARQUITETURA DISTRIBUÍDA PARA FILIAIS
// ============================================================================

// Identificação do Modo de Operação (Hub vs Edge)
app.get('/api/system/mode', (req, res) => {
  const isEdge = (process.env.APP_MODE || '').toLowerCase() === 'edge';
  res.json({
    appMode: isEdge ? 'edge' : 'hub',
    isEdge,
    edgeUnitName: process.env.EDGE_UNIT_NAME || '',
    edgeUnitId: process.env.EDGE_UNIT_ID || '',
    hubUrl: process.env.HUB_URL || '',
    syncStatus: edgeSync.getSyncStatus()
  });
});

// Autenticação de Administrador Local ou Global
app.post('/api/auth/verify-admin', (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const rateLimit = checkLoginRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(rateLimit.remainingMs / 1000)} segundos.`
    });
  }

  const { username, password } = req.body || {};
  const isEdge = (process.env.APP_MODE || '').toLowerCase() === 'edge';
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || (isEdge ? process.env.EDGE_LOCAL_ADMIN_PASS : '');

  if (!adminPass) {
    console.error('[Security] ADMIN_PASSWORD não configurada. Autenticação administrativa bloqueada.');
    return res.status(503).json({
      success: false,
      error: 'Autenticação administrativa não configurada no servidor.'
    });
  }

  const isValid = username === adminUser && password === adminPass;
  if (isValid) {
    recordLoginAttempt(clientIp, true);
    const session = createSession({ username: adminUser, role: 'admin' });
    res.setHeader('Set-Cookie', `hefesto_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return res.json({
      success: true,
      token: session.token,
      role: 'admin',
      isEdge,
      edgeUnitName: process.env.EDGE_UNIT_NAME || ''
    });
  }

  recordLoginAttempt(clientIp, false);
  return res.status(401).json({ success: false, error: 'Credenciais de administrador inválidas.' });
});

// Consulta de Sessão Ativa
app.get('/api/auth/session', (req, res) => {
  const isEdge = (process.env.APP_MODE || '').toLowerCase() === 'edge';
  if (req.user) {
    return res.json({
      authenticated: true,
      role: req.user.role,
      username: req.user.username,
      isEdge,
      edgeUnitName: process.env.EDGE_UNIT_NAME || ''
    });
  }
  return res.json({
    authenticated: false,
    role: null,
    isEdge,
    edgeUnitName: process.env.EDGE_UNIT_NAME || ''
  });
});

// Encerramento de Sessão (Logout)
app.post('/api/auth/logout', (req, res) => {
  if (req.sessionToken) {
    revokeSession(req.sessionToken);
  }
  res.setHeader('Set-Cookie', 'hefesto_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// Endpoint Receptor do Hub (Recebe sincronização das filiais)
app.post('/api/edge/sync', async (req, res) => {
  const token = req.headers['x-edge-token'] || req.headers['authorization'];
  const expectedToken = process.env.HUB_SYNC_SECRET;
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '') : '';

  if (!expectedToken) {
    console.error('[Security] HUB_SYNC_SECRET não configurado. Endpoint de sincronização bloqueado.');
    return res.status(503).json({ error: 'Sincronização não configurada no servidor.' });
  }

  if (cleanToken !== expectedToken) {
    return res.status(401).json({ error: 'Token de sincronização inválido ou ausente.' });
  }

  const { edgeUnitName, edgeUnitId, printers = [], recharges = [], replenishments = [], outbox = [], printerLifecycle } = req.body || {};
  if (![printers, recharges, replenishments, outbox].every(Array.isArray)) return res.status(400).json({ error: 'Coleções inválidas no pacote Edge.' });
  if (outbox.length > 100) return res.status(400).json({ error: 'Lote outbox excede 100 eventos.' });
  console.log('\x1b[35m%s\x1b[0m', `[Hub Sync] 📥 Recebido pacote da filial "${edgeUnitName || 'Desconhecida'}": ${printers.length} impressora(s), ${recharges.length} recarga(s), ${replenishments.length} reposição(ões), ${outbox.length} item(ns) outbox.`);

  // Garante que a unidade exista no catálogo do Hub
  let unitId = edgeUnitId;
  if (edgeUnitName) {
    try {
      const existingUnits = db.getUnits();
      const match = existingUnits.find(u => u.name.toLowerCase() === edgeUnitName.toLowerCase());
      if (!match) {
        const newUnitId = edgeUnitId || `unit-${uuidv4().slice(0, 8)}`;
        db.saveUnit({ id: newUnitId, name: edgeUnitName, description: 'Unidade sincronizada via Hefesto Edge' });
        unitId = newUnitId;
      } else {
        unitId = match.id;
      }
    } catch (e) {
      console.warn('[Hub Sync] Aviso ao registrar unidade:', e.message);
    }
  }

  let updatedPrinters = 0;
  if (printerLifecycle) {
    try {
      const normalized = printers.map(p => ({ ...p, unitId: unitId || p.unitId, unitName: edgeUnitName || p.unitName }));
      db.applyPrinterLifecycleSync({ ...printerLifecycle, printers: normalized });
      updatedPrinters = printers.length;
      for (const p of normalized) {
        if (p.isActive === false) STATUS_CACHE.delete(p.id);
        else if (p.status) STATUS_CACHE.set(p.id, p.status);
      }
    } catch (error) { return res.status(409).json({ error: `Falha ao sincronizar histórico de ativos: ${error.message}` }); }
  }
  for (const p of printerLifecycle ? [] : printers) {
    try {
      const cleanP = {
        id: p.id || uuidv4(),
        name: p.name,
        ip: p.ip,
        location: p.location,
        unitId: unitId || p.unitId,
        unitName: edgeUnitName || p.unitName,
        community: p.community || 'public',
        initialPageCount: p.initialPageCount ?? null,
        hefestoActivatedAt: p.hefestoActivatedAt,
        installedAt: p.installedAt,
        macAddress: p.macAddress,
        createdAt: p.createdAt
      };
      db.savePrinter(cleanP);

      if (p.status) {
        STATUS_CACHE.set(cleanP.id, p.status);
        db.savePrinterStatusCache(cleanP.id, p.status);
      }
      updatedPrinters++;
    } catch (err) {
      console.warn(`[Hub Sync] Erro ao sincronizar impressora ${p.ip}:`, err.message);
    }
  }

  // Apenas amostras com horário original podem contribuir para a auditoria da matriz.
  for (const p of printers) {
    const current = db.getPrinterById(p.id);
    const sample = p.status;
    if (!current?.isActive || current.unitId !== unitId || !sample?.online ||
        !Number.isSafeInteger(sample.info?.pageCount) || sample.info.pageCount < 0 ||
        typeof sample.observedAt !== 'string' || !Number.isFinite(Date.parse(sample.observedAt))) continue;
    db.recordPageCount(p.id, sample.info.pageCount, sample.supplies, { observedAt: sample.observedAt, source: 'edge_sync' });
  }

  const delivery = processEdgeOutbox({ edgeUnitId: unitId, edgeUnitName, events: outbox });
  let updatedRecharges = 0;
  for (const r of recharges) {
    try {
      const recorded = db.recordRecharge({
        ...r,
        unitName: edgeUnitName || r.unitName
      }, { suppressSync: true });
      if (recorded) updatedRecharges++;
    } catch (err) {
      // Ignora duplicata descartada pelo motor anti-duplicação
    }
  }

  let updatedReplenishments = 0;
  if (Array.isArray(replenishments)) {
    for (const rep of replenishments) {
      try {
        db.saveReplenishment({
          ...rep,
          unitName: edgeUnitName || rep.unitName
        }, { suppressSync: true });
        updatedReplenishments++;
      } catch (err) {
        // Ignora erro individual de reposição
      }
    }
  }

  res.json({
    success: true,
    message: `Sincronização processada com sucesso: ${updatedPrinters} impressoras, ${updatedRecharges} recargas novas, ${updatedReplenishments} reposições gravadas.`,
    receivedPrinters: printers.length,
    receivedRecharges: recharges.length,
    receivedReplenishments: replenishments.length,
    receivedOutbox: outbox.length,
    ...delivery,
    processedAt: new Date().toISOString()
  });
});

// Endpoint de Bootstrap do Hub (Baixa catálogo da filial na primeira instalação)
app.get('/api/edge/bootstrap', async (req, res) => {
  const token = req.headers['x-edge-token'] || req.headers['authorization'];
  const expectedToken = process.env.HUB_SYNC_SECRET;
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '') : '';

  if (!expectedToken) {
    console.error('[Security] HUB_SYNC_SECRET não configurado. Endpoint de bootstrap bloqueado.');
    return res.status(503).json({ error: 'Sincronização não configurada no servidor.' });
  }

  if (cleanToken !== expectedToken) {
    return res.status(401).json({ error: 'Token de autorização inválido.' });
  }

  const { unitName, unitId } = req.query;
  if (!unitName && !unitId) {
    return res.status(400).json({ error: 'Informe unitName ou unitId para o bootstrap.' });
  }

  const allPrinters = db.getPrinters({ includeInactive: true });
  const targetPrinters = allPrinters.filter(p => {
    if (unitId && p.unitId === unitId) return true;
    if (unitName && (p.unitName || '').toLowerCase() === unitName.toLowerCase()) return true;
    return false;
  });

  const allRecharges = db.getRecharges();
  const targetRecharges = allRecharges.filter(r => {
    if (unitName && (r.unitName || '').toLowerCase() === unitName.toLowerCase()) return true;
    return false;
  });

  res.json({
    success: true,
    unitName: unitName || '',
    unitId: unitId || '',
    printersCount: targetPrinters.length,
    printers: targetPrinters,
    printerLifecycle: db.getPrinterLifecycleBundle(targetPrinters.map(p => p.id)),
    rechargesCount: targetRecharges.length,
    recharges: targetRecharges
  });
});

// Endpoint do Edge para disparo de sincronização sob demanda
app.post('/api/edge/trigger-sync', requireAdmin, async (req, res) => {
  const result = await edgeSync.triggerEdgeSync();
  res.json(result);
});

// Endpoints de Manutenção, Diagnóstico de Armazenamento e Expurgo
app.get('/api/system/stats', (req, res) => {
  const stats = db.getDatabaseStats();
  res.json(stats);
});

app.post('/api/maintenance/prune', requireAdmin, (req, res) => {
  const days = req.body?.days ? parseInt(req.body.days, 10) : 30;
  const result = db.pruneOldTelemetrySnapshots(days);
  const currentStats = db.getDatabaseStats();
  res.json({
    success: true,
    message: `Rotina de expurgo executada com sucesso para registros com mais de ${days} dias.`,
    pruned: result,
    stats: currentStats
  });
});

// Endpoints de Auto-Update e Sincronização com o GitHub
app.get('/api/system/update-status', (req, res) => {
  res.json(autoUpdater.getUpdateStatus());
});

app.post('/api/system/check-update', requireAdmin, async (req, res) => {
  const status = await autoUpdater.checkForUpdates();
  res.json(status);
});

// Diagnóstico avançado de conectividade e rede para impressoras
app.get('/api/system/debug-network', requireAdmin, async (req, res) => {
  const rawIp = req.query.ip ? req.query.ip.trim() : '198.18.6.124';
  if (!isValidIpv4(rawIp)) {
    return res.status(400).json({ error: 'Endereço IP inválido para diagnóstico.' });
  }
  const targetIp = rawIp;
  const out = { targetIp };

  out.user = process.env.USERNAME || process.env.USER || 'N/D';
  out.envProxy = {
    HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || null,
    HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || null,
    NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || null
  };

  // Interfaces locais do servidor
  try {
    const os = await import('os');
    out.interfaces = os.networkInterfaces();
  } catch (e) {
    out.interfaces = e.message;
  }

  // 1. Ping (execFile seguro sem interpolação de shell)
  try {
    const { stdout: pingOut } = await execFileAsync('ping', ['-n', '2', targetIp], { timeout: 6000 });
    out.ping = pingOut.trim();
  } catch (e) {
    out.ping = { error: e.message };
  }

  // 2. ARP Table (execFile seguro sem interpolação de shell)
  try {
    const { stdout: arpOut } = await execFileAsync('arp', ['-a', targetIp], { timeout: 4000 });
    out.arp = arpOut.trim();
  } catch (e) {
    out.arp = { error: e.message };
  }

  // Helper TCP socket test
  const testTcp = (ip, port, timeout = 2500) => new Promise(resolve => {
    const s = new net.Socket();
    s.setTimeout(timeout);
    s.once('connect', () => { s.destroy(); resolve({ connected: true }); });
    s.once('timeout', () => { s.destroy(); resolve({ timeout: true }); });
    s.once('error', (err) => { s.destroy(); resolve({ error: err.code || err.message }); });
    s.connect(port, ip);
  });

  out.tcp80 = await testTcp(targetIp, 80);
  out.tcp443 = await testTcp(targetIp, 443);
  out.tcp9100 = await testTcp(targetIp, 9100);

  // 4. Fetch HTTP & HTTPS
  try {
    const fetchRes = await fetch(`http://${targetIp}/`, { signal: AbortSignal.timeout(3000) });
    out.fetchHttp = { status: fetchRes.status, ok: fetchRes.ok };
  } catch (e) {
    out.fetchHttp = { error: e.name + ': ' + e.message };
  }

  try {
    const httpsRes = await fetch(`https://${targetIp}/`, { signal: AbortSignal.timeout(3000) });
    out.fetchHttps = { status: httpsRes.status, ok: httpsRes.ok };
  } catch (e) {
    out.fetchHttps = { error: e.name + ': ' + e.message };
  }

  // 5. SNMP v1
  out.snmpV1 = await new Promise(resolve => {
    const session = snmp.createSession(targetIp, 'public', { version: snmp.Version1, timeout: 2500, retries: 0 });
    session.get(['1.3.6.1.2.1.1.5.0'], (err, vbs) => {
      session.close();
      if (err) resolve({ error: err.message });
      else resolve({ val: vbs[0]?.value?.toString() });
    });
  });

  // 6. Teste de outros IPs da rede para comparação
  const testIps = ['198.18.6.10', '198.18.6.6', '198.18.5.18'];
  out.comparison = {};
  for (const cip of testIps) {
    out.comparison[cip] = {
      tcp9100: await testTcp(cip, 9100, 1500),
      tcp80: await testTcp(cip, 80, 1500)
    };
  }

  res.json(out);
});

app.post('/api/system/apply-update', requireAdmin, async (req, res) => {
  const result = await autoUpdater.applyUpdate();
  res.json(result);
});

// Consulta otimizada com Cache e suporte a ?force=true
app.get('/api/printers/:id/print-audit', requireAdmin, (req, res) => {
  if (!db.getPrinterById(req.params.id)) return res.status(404).json({ error: 'Impressora não encontrada.' });
  const date = req.query.date || getBusinessDateKey();
  try { getInclusiveDateSpanDays(date, date); } catch { return res.status(400).json({ error: 'Data inválida; use AAAA-MM-DD.' }); }
  res.json(db.getPrinterPrintAudit(req.params.id, date));
});

// Read-only updates never initiate SNMP collection, including when a cache is missing.
app.get('/api/dashboard/snapshot', createDashboardSnapshot(() => {
  const printers = db.getPrinters(), usb = usbPrinterViews(db.getDb());
  const overview = buildHealthOverview();
  const statuses = printers.map(p => {
    const cached = STATUS_CACHE.get(p.id);
    const printEvidence = db.getDailyPrintEvidence(p.id);
    return { ...(cached || { id: p.id, ip: p.ip, name: p.name, online: null, cachedAt: null, info: {}, supplies: [] }),
      unitId: p.unitId || '', unitName: p.unitName || 'Sem Unidade', region: p.region || 'RJ', pagesToday: printEvidence.pages, printEvidence };
  }).concat(usb.map(entry => entry.status));
  const collected = statuses.map(s => Date.parse(s.cachedAt)).filter(Number.isFinite);
  return {
    units: db.getUnits(), printers: printers.concat(usb.map(entry => entry.printer)), statuses,
    health: overview.printers.map(item => { const { ageMs, ...health } = item.health; return { printerId: item.printerId, health }; }),
    healthOverview: { lastCacheUpdate: overview.lastCacheUpdate, totalPrinters: overview.totalPrinters, counts: overview.counts },
    rechargesSummary: db.getRechargesSummary(), collectionAt: collected.length ? new Date(Math.max(...collected)).toISOString() : null
  };
}));

app.get('/api/status/all', async (req, res) => {
  const forceRefresh = req.query.force === 'true';
  const printers = await loadPrinters();

  // Responde com o cache e com a evidência diária persistida.
  if (!forceRefresh && printers.every(p => STATUS_CACHE.has(p.id))) {
    const cachedData = printers.map(p => {
      const cached = STATUS_CACHE.get(p.id) || { id: p.id, ip: p.ip, name: p.name, online: false };
      const printEvidence = db.getDailyPrintEvidence(p.id);
      return {
        ...cached,
        unitId: p.unitId || cached.unitId || '',
        unitName: p.unitName || cached.unitName || 'Sem Unidade',
        region: p.region || cached.region || 'RJ',
        pagesToday: printEvidence.pages,
        printEvidence
      };
    });
    return res.json([...cachedData,...usbPrinterViews(db.getDb()).map(entry=>entry.status)]);
  }

  // Caso contrário, busca direto das impressoras de forma paralela e rápida.
  // O mapa diário precisa ser lido DEPOIS da coleta, pois updateAllPrintersCache()
  // grava o novo end_page_count de cada impressora no page_history.
  console.log('\x1b[36m%s\x1b[0m', 'GET /api/status/all - Sincronização em tempo real das impressoras');
  const freshData = await updateAllPrintersCache();
  recordTelemetrySnapshot(freshData).catch(() => {});
  const enrichedData = freshData.filter(Boolean).map(entry => {
    const p = printers.find(x => x.id === entry.id);
    const printEvidence = db.getDailyPrintEvidence(entry.id);
    return {
      ...entry,
      unitId: p?.unitId || entry.unitId || '',
      unitName: p?.unitName || entry.unitName || 'Sem Unidade',
      region: p?.region || entry.region || 'RJ',
      pagesToday: printEvidence.pages,
      printEvidence
    };
  });
  res.json([...enrichedData,...usbPrinterViews(db.getDb()).map(entry=>entry.status)]);
});

// Inicialização ouvindo em todas as interfaces de rede (0.0.0.0) se for o executável principal
if (isMainModule) {
  app.listen(PORT, '0.0.0.0', () => {
    const portStr = PORT == 80 ? '' : `:${PORT}`;
    console.log('\x1b[32m%s\x1b[0m', `====================================================`);
    console.log('\x1b[32m%s\x1b[0m', ` PAINEL DE IMPRESSORAS INICIADO COM SUCESSO!`);
    console.log('\x1b[36m%s\x1b[0m', ` -> Acesso nesta máquina:     http://localhost${portStr}/`);
    console.log('\x1b[32m%s\x1b[0m', `====================================================`);

    // Popula o cache inicial assim que o servidor liga
    updateAllPrintersCache().then(results => {
      recordTelemetrySnapshot(results).catch(() => {});
      console.log('\x1b[32m%s\x1b[0m', '[Cache] Dados iniciais das impressoras pré-carregados na memória!');
    }).catch(() => {});
  });
}

// Tratamento gracioso de encerramento (Windows Service / SIGINT / SIGTERM)
function gracefulShutdown(signal) {
  console.log(`\n[Server] Recebido sinal de parada (${signal}). Encerrando graciosamente...`);
  try {
    db.closeDatabase();
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

export { app };
