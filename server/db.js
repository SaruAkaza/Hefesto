import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBusinessDateKey } from './date-utils.js';
import { ensureConsumableLifecycleSchema } from './consumable-lifecycle-store.js';
import { ensureDeviceAlertSchema, recordDeviceAlertSnapshot as recordAlerts, getPrinterAlertReport as readAlerts } from './device-alert-store.js';
import { ensureTechnicalAuditSchema } from './technical-audit-store.js';
import { replacePrinter } from './printer-replacement-store.js';
import { hasPrinterIdentityConflict } from './printer-identity.js';
import { ensurePrinterAllocationSchema, openAllocation, closeAllocation, recordAllocationCount } from './printer-allocation-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'hefesto.db');

let db = null;

// Garante que os diretórios existam
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

export function initDatabase(options = {}) {
  if (db) return db;

  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  const dbPath = options.dbPath || process.env.HEFESTO_DB_PATH || (options.inMemory || isTest ? ':memory:' : DB_PATH);
  const skipSeeds = options.skipSeeds !== undefined ? options.skipSeeds : isTest;
  // Preserve audit records on ordinary startup; destructive cleanup must be explicit.
  const skipCleanups = options.skipCleanups !== undefined ? options.skipCleanups : true;

  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');

  createSchema(db);
  if (!skipSeeds) {
    migrateFromJsonIfNeeded();
    try {
      syncSeedData();
    } catch (err) {
      console.warn('[SQLite] Erro na sincronização de dados seed:', err.message);
    }
  }
  if (!skipCleanups) {
    try {
      cleanSpuriousRecharges(db);
    } catch (err) {
      console.warn('[SQLite] Erro ao executar limpeza inicial:', err.message);
    }
    try {
      sanitizeRechargeEncodings(db);
    } catch (err) {
      console.warn('[SQLite] Erro ao sanitizar encodings de recargas:', err.message);
    }
  }
  return db;
}

export function setDatabase(customDb) {
  db = customDb;
  return db;
}

export function getDb() {
  if (!db) return initDatabase();
  return db;
}

export function createSchema(targetDb = db) {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      region TEXT NOT NULL DEFAULT 'RJ',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip TEXT NOT NULL UNIQUE,
      location TEXT,
      unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
      unit_name TEXT,
      community TEXT DEFAULT 'public',
      initial_page_count INTEGER DEFAULT 0,
      hefesto_activated_at TEXT,
      installed_at TEXT,
      mac_address TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_printers_unit ON printers(unit_id);
    CREATE INDEX IF NOT EXISTS idx_printers_ip ON printers(ip);

    CREATE TABLE IF NOT EXISTS deleted_printers (
      id TEXT PRIMARY KEY,
      ip TEXT,
      name TEXT,
      unit_name TEXT,
      deleted_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deleted_printers_ip ON deleted_printers(ip);

    CREATE TABLE IF NOT EXISTS printer_status_cache (
      printer_id TEXT PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
      online INTEGER DEFAULT 0,
      status_code INTEGER DEFAULT 0,
      status_description TEXT,
      page_count INTEGER DEFAULT 0,
      model TEXT,
      serial_number TEXT,
      supplies_json TEXT,
      trays_json TEXT,
      cached_at TEXT
    );

    CREATE TABLE IF NOT EXISTS printer_health (
      printer_id TEXT PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'stale',
      severity TEXT NOT NULL DEFAULT 'warning',
      reason_code TEXT,
      reason TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      consecutive_successes INTEGER DEFAULT 0,
      last_check_at TEXT,
      last_success_at TEXT,
      last_failure_at TEXT,
      last_transition_at TEXT,
      latency_ms INTEGER,
      last_error TEXT,
      critical_supply_json TEXT,
      warning_supply_json TEXT,
      telemetry_source TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_printer_health_state ON printer_health(state);

    CREATE TABLE IF NOT EXISTS pending_recharges (
      id TEXT PRIMARY KEY,
      printer_id TEXT REFERENCES printers(id) ON DELETE CASCADE,
      supply_name TEXT NOT NULL,
      supply_type TEXT,
      baseline_level REAL NOT NULL,
      target_level REAL NOT NULL,
      consecutive_cycles INTEGER DEFAULT 1,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_recharges_printer ON pending_recharges(printer_id);

    CREATE TABLE IF NOT EXISTS replenishments (
      id TEXT PRIMARY KEY,
      printer_id TEXT REFERENCES printers(id) ON DELETE CASCADE,
      printer_name TEXT NOT NULL,
      location TEXT,
      supply_name TEXT NOT NULL,
      supply_type TEXT,
      percentage REAL DEFAULT 0,
      order_status TEXT DEFAULT 'pending',
      model_part TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_replenishments_printer ON replenishments(printer_id);
    CREATE INDEX IF NOT EXISTS idx_replenishments_status ON replenishments(order_status);

    CREATE TABLE IF NOT EXISTS recharges (
      id TEXT PRIMARY KEY,
      printer_id TEXT,
      printer_name TEXT,
      ip TEXT,
      unit_name TEXT,
      location TEXT,
      supply_name TEXT NOT NULL,
      supply_type TEXT,
      previous_level REAL,
      new_level REAL,
      page_count INTEGER,
      pages_since_last_recharge INTEGER DEFAULT 0,
      source TEXT DEFAULT 'auto',
      is_full_recharge INTEGER DEFAULT 1,
      status_tag TEXT,
      technician TEXT,
      notes TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recharges_printer ON recharges(printer_id);
    CREATE INDEX IF NOT EXISTS idx_recharges_timestamp ON recharges(timestamp);

    CREATE TABLE IF NOT EXISTS page_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_page_count INTEGER,
      end_page_count INTEGER,
      supplies_json TEXT,
      last_updated_at TEXT,
      UNIQUE(printer_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_page_history_printer_date ON page_history(printer_id, date);

    CREATE TABLE IF NOT EXISTS printer_counter_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      observed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_counter_observations_day ON printer_counter_observations(printer_id, date, observed_at);
    CREATE INDEX IF NOT EXISTS idx_counter_observations_last ON printer_counter_observations(printer_id, observed_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_counter_regressions ON printer_counter_observations(printer_id, date) WHERE status='counter_regression';

    CREATE TABLE IF NOT EXISTS telemetry_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id TEXT NOT NULL,
      ip TEXT,
      name TEXT,
      unit_name TEXT,
      page_count INTEGER,
      supplies_json TEXT,
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_printer_rec ON telemetry_snapshots(printer_id, recorded_at);

    CREATE TABLE IF NOT EXISTS edge_sync_outbox (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_attempt TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_edge_outbox_type ON edge_sync_outbox(entity_type);
    CREATE INDEX IF NOT EXISTS idx_edge_outbox_created ON edge_sync_outbox(created_at);

    CREATE TABLE IF NOT EXISTS edge_sync_receipts (
      unit_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      received_at TEXT NOT NULL,
      PRIMARY KEY (unit_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS printer_replacements (
      id TEXT PRIMARY KEY,
      replaced_printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
      new_printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
      replaced_model TEXT,
      replaced_serial TEXT,
      replaced_mac TEXT,
      new_model TEXT,
      new_serial TEXT,
      new_mac TEXT,
      target_unit_id TEXT,
      target_unit_name TEXT,
      target_location TEXT,
      replacement_mode TEXT DEFAULT 'manual',
      replaced_at TEXT NOT NULL,
      replaced_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      initial_counter INTEGER DEFAULT 0,
      notes TEXT,
      confirmed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_printer_replacements_replaced ON printer_replacements(replaced_printer_id);
    CREATE INDEX IF NOT EXISTS idx_printer_replacements_new ON printer_replacements(new_printer_id);

    -- Vistas (Views) com rótulos amigáveis em português para navegação visual no DB Browser:
    DROP VIEW IF EXISTS Vista_Impressoras_e_Contadores;
    CREATE VIEW Vista_Impressoras_e_Contadores AS
    SELECT
      p.name AS "Nome da Impressora",
      p.ip AS "Endereço IP",
      p.unit_name AS "Unidade / Filial",
      p.location AS "Setor / Consultório",
      p.initial_page_count AS "Páginas Iniciais (Marco Zero Hefesto)",
      COALESCE(c.page_count, p.initial_page_count) AS "Contador Vitalício Atual",
      (COALESCE(c.page_count, p.initial_page_count) - p.initial_page_count) AS "Páginas Rodadas Sob Gestão",
      CASE WHEN c.online = 1 THEN '🟢 ONLINE' ELSE '🔴 OFFLINE' END AS "Status de Conexão",
      p.hefesto_activated_at AS "Data Início no Hefesto",
      p.installed_at AS "Data Instalação Física"
    FROM printers p
    LEFT JOIN printer_status_cache c ON p.id = c.printer_id
    ORDER BY p.unit_name, p.name;

    DROP VIEW IF EXISTS Vista_Historico_Recargas;
    CREATE VIEW Vista_Historico_Recargas AS
    SELECT
      r.printer_name AS "Impressora",
      r.unit_name AS "Unidade / Filial",
      r.location AS "Setor / Sala",
      r.supply_name AS "Suprimento Trocado",
      r.previous_level || '%' AS "Nível Antes",
      r.new_level || '%' AS "Nível Depois",
      (r.new_level - r.previous_level) || '%' AS "Salto de Nível",
      r.pages_since_last_recharge AS "Páginas Rodadas no Ciclo",
      r.status_tag AS "Tipo de Recarga (Oficial vs Provisória)",
      r.technician AS "Origem / Técnico",
      r.timestamp AS "Data e Hora da Troca"
    FROM recharges r
    ORDER BY r.timestamp DESC;

    DROP VIEW IF EXISTS Vista_Contadores_Diarios;
    DROP VIEW IF EXISTS Vista_Historico_Diario_Por_Data;
    CREATE VIEW Vista_Historico_Diario_Por_Data AS
    SELECT
      strftime('%d/%m/%Y', h.date) AS "📅 Data do Registro (Dia a Dia)",
      p.name AS "Nome da Impressora",
      p.unit_name AS "Unidade / Filial",
      p.location AS "Setor / Consultório",
      CASE
        WHEN h.end_page_count >= h.start_page_count THEN (h.end_page_count - h.start_page_count)
        ELSE 0
      END AS "Páginas Impressas Nesta Data",
      h.start_page_count AS "Contador Início do Dia",
      h.end_page_count AS "Contador Fim do Dia"
    FROM page_history h
    JOIN printers p ON h.printer_id = p.id
    ORDER BY h.date DESC, p.unit_name, p.name;
  `);

  ensureDeviceAlertSchema(targetDb);
  ensureTechnicalAuditSchema(targetDb);

  // Fundação MON-001.4: tabelas de perfis, evidências e ciclos de consumíveis.
  // Criação idempotente e sem retropreenchimento: impressoras existentes não ganham ciclos inventados.
  try {
    ensureConsumableLifecycleSchema(targetDb);
  } catch (err) {
    console.warn('[SQLite] Erro ao criar schema de lifecycle de consumíveis:', err.message);
  }

  const cacheColumns = targetDb.prepare('PRAGMA table_info(printer_status_cache)').all();
  if (!cacheColumns.some(c => c.name === 'telemetry_json')) targetDb.exec('ALTER TABLE printer_status_cache ADD COLUMN telemetry_json TEXT');

  // Migração não-destrutiva de region caso a tabela units já exista
  try {
    const unitsInfo = targetDb.prepare('PRAGMA table_info(units)').all();
    const hasRegion = unitsInfo.some(col => col.name === 'region');
    if (!hasRegion) {
      targetDb.exec("ALTER TABLE units ADD COLUMN region TEXT NOT NULL DEFAULT 'RJ'");
      console.log('[SQLite] Coluna region adicionada à tabela units com sucesso.');
    }
  } catch (err) {
    console.warn('[SQLite] Aviso na migração de region em units:', err.message);
  }

  // Migração não-destrutiva de mac_address caso a tabela printers já exista
  try {
    const tableInfo = targetDb.prepare('PRAGMA table_info(printers)').all();
    const hasMac = tableInfo.some(col => col.name === 'mac_address');
    if (!hasMac) {
      targetDb.exec('ALTER TABLE printers ADD COLUMN mac_address TEXT');
      console.log('[SQLite] Coluna mac_address adicionada à tabela printers.');
    }
    targetDb.exec('CREATE INDEX IF NOT EXISTS idx_printers_mac ON printers(mac_address)');
  } catch (err) {
    console.warn('[SQLite] Aviso na migração de mac_address:', err.message);
  }

  // Tabela para catálogo de sub-redes corporativas (Varredura Global por MAC)
  try {
    targetDb.exec(`
      CREATE TABLE IF NOT EXISTS corporate_subnets (
        id TEXT PRIMARY KEY,
        subnet TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_corporate_subnets ON corporate_subnets(subnet);
    `);
  } catch (err) {
    console.warn('[SQLite] Erro ao criar tabela corporate_subnets:', err.message);
  }

  // Migração não-destrutiva de is_active e decommissioned_at em printers
  try {
    const tableInfo = targetDb.prepare('PRAGMA table_info(printers)').all();
    const hasActive = tableInfo.some(col => col.name === 'is_active');
    if (!hasActive) {
      targetDb.exec('ALTER TABLE printers ADD COLUMN is_active INTEGER DEFAULT 1');
      targetDb.exec('ALTER TABLE printers ADD COLUMN decommissioned_at TEXT');
    }
  } catch (err) {
    console.warn('[SQLite] Aviso na migração de is_active em printers:', err.message);
  }

  const printerColumns = new Set(targetDb.prepare('PRAGMA table_info(printers)').all().map(c => c.name));
  if (!printerColumns.has('decommissioned_at')) targetDb.exec('ALTER TABLE printers ADD COLUMN decommissioned_at TEXT');
  if (!printerColumns.has('archived_ip')) targetDb.exec('ALTER TABLE printers ADD COLUMN archived_ip TEXT');
  targetDb.exec("UPDATE printers SET archived_ip = substr(ip, 1, instr(ip, '#replaced_') - 1) WHERE is_active = 0 AND archived_ip IS NULL AND instr(ip, '#replaced_') > 0");
  ensurePrinterAllocationSchema(targetDb);

  const rechargeColumns = new Set(targetDb.prepare('PRAGMA table_info(recharges)').all().map(c => c.name));
  if (!rechargeColumns.has('verification_status')) targetDb.exec('ALTER TABLE recharges ADD COLUMN verification_status TEXT');
  if (!rechargeColumns.has('evidence_json')) targetDb.exec('ALTER TABLE recharges ADD COLUMN evidence_json TEXT');

  // Migração não-destrutiva de colunas auxiliares em printer_replacements
  try {
    const repTableInfo = targetDb.prepare('PRAGMA table_info(printer_replacements)').all();
    const cols = new Set(repTableInfo.map(c => c.name));
    if (!cols.has('replaced_model')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN replaced_model TEXT');
    if (!cols.has('replaced_serial')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN replaced_serial TEXT');
    if (!cols.has('replaced_mac')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN replaced_mac TEXT');
    if (!cols.has('new_model')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN new_model TEXT');
    if (!cols.has('new_serial')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN new_serial TEXT');
    if (!cols.has('new_mac')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN new_mac TEXT');
    if (!cols.has('target_unit_id')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN target_unit_id TEXT');
    if (!cols.has('target_unit_name')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN target_unit_name TEXT');
    if (!cols.has('target_location')) targetDb.exec('ALTER TABLE printer_replacements ADD COLUMN target_location TEXT');
    if (!cols.has('replacement_mode')) targetDb.exec("ALTER TABLE printer_replacements ADD COLUMN replacement_mode TEXT DEFAULT 'manual'");
  } catch (err) {
    console.warn('[SQLite] Aviso na migração de printer_replacements:', err.message);
  }
}



function normalizeUnitName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function resolveMigrationUnitId(printer, units = []) {
  const requestedId = printer?.unitId || printer?.unit_id || null;
  const requestedName = printer?.unitName || printer?.unit_name || '';

  if (requestedId) {
    const byId = units.find(unit => unit.id === requestedId);
    if (byId) return byId.id;
  }

  const normalizedName = normalizeUnitName(requestedName);
  if (normalizedName) {
    const byName = units.find(unit => normalizeUnitName(unit.name) === normalizedName);
    if (byName) return byName.id;
  }

  return null;
}

function migrateFromJsonIfNeeded() {
  const countRow = db.prepare('SELECT COUNT(*) AS total FROM printers').get();
  if (countRow && countRow.total > 0) {
    return; // Já existem dados no SQLite
  }

  const printersJsonPath = path.join(DATA_DIR, 'printers.json');
  if (!fs.existsSync(printersJsonPath)) {
    return;
  }

  console.log('\x1b[36m%s\x1b[0m', '[SQLite] Nova base detectada. Iniciando migração automática de dados JSON -> SQLite...');

  try {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubdir = path.join(BACKUPS_DIR, `json_pre_sqlite_${timestampStr}`);
    fs.mkdirSync(backupSubdir, { recursive: true });

    db.exec('BEGIN TRANSACTION');

    // Catálogo usado para reconciliar IDs legados de unidade durante a migração.
    let migrationUnits = [];

    // 1. Unidades
    const unitsPath = path.join(DATA_DIR, 'units.json');
    if (fs.existsSync(unitsPath)) {
      fs.copyFileSync(unitsPath, path.join(backupSubdir, 'units.json'));
      const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
      migrationUnits = Array.isArray(units) ? units : [];
      const insertUnit = db.prepare('INSERT INTO units (id, name, description, created_at) VALUES (?, ?, ?, ?)');
      for (const u of migrationUnits) {
        insertUnit.run(u.id, u.name, u.description || '', u.createdAt || new Date().toISOString());
      }
      console.log(`[SQLite] Migradas ${migrationUnits.length} unidades.`);
    }

    // 2. Impressoras
    fs.copyFileSync(printersJsonPath, path.join(backupSubdir, 'printers.json'));
    const printers = JSON.parse(fs.readFileSync(printersJsonPath, 'utf8'));
    const insertPrinter = db.prepare(`
      INSERT INTO printers (id, name, ip, location, unit_id, unit_name, community, initial_page_count, hefesto_activated_at, installed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of printers) {
      const resolvedUnitId = resolveMigrationUnitId(p, migrationUnits);
      if ((p.unitId || p.unit_id) && !resolvedUnitId) {
        console.warn(`[SQLite] Unidade legada não encontrada para "${p.unitName || p.unit_name || p.name}". Impressora será migrada sem vínculo FK e manterá o nome da unidade.`);
      } else if ((p.unitId || p.unit_id) && resolvedUnitId !== (p.unitId || p.unit_id)) {
        console.warn(`[SQLite] ID legado de unidade reconciliado para "${p.unitName || p.unit_name || p.name}": ${p.unitId || p.unit_id} -> ${resolvedUnitId}.`);
      }

      insertPrinter.run(
        p.id,
        p.name,
        p.ip,
        p.location || '',
        resolvedUnitId,
        p.unitName || p.unit_name || 'Sem Unidade',
        p.community || 'public',
        p.initialPageCount || 0,
        p.hefestoActivatedAt || p.createdAt || new Date().toISOString(),
        p.installedAt || null,
        p.createdAt || new Date().toISOString(),
        new Date().toISOString()
      );
    }
    console.log(`[SQLite] Migradas ${printers.length} impressoras.`);

    // 3. Recargas
    const rechargesPath = path.join(DATA_DIR, 'recharges.json');
    if (fs.existsSync(rechargesPath)) {
      fs.copyFileSync(rechargesPath, path.join(backupSubdir, 'recharges.json'));
      try {
        const recharges = JSON.parse(fs.readFileSync(rechargesPath, 'utf8'));
        const insertRecharge = db.prepare(`
          INSERT INTO recharges (id, printer_id, printer_name, ip, unit_name, location, supply_name, supply_type, previous_level, new_level, page_count, pages_since_last_recharge, source, is_full_recharge, status_tag, technician, notes, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of recharges) {
          insertRecharge.run(
            r.id,
            r.printerId || null,
            r.printerName || '',
            r.ip || '',
            r.unitName || '',
            r.location || '',
            r.supplyName || 'Toner',
            r.supplyType || 'toner',
            r.previousLevel || 0,
            r.newLevel || 0,
            r.pageCount || 0,
            r.pagesSinceLastRecharge || 0,
            r.source || 'auto',
            r.isFullRecharge ? 1 : 0,
            r.statusTag || '',
            r.technician || '',
            r.notes || '',
            r.timestamp || new Date().toISOString()
          );
        }
        console.log(`[SQLite] Migradas ${recharges.length} recargas históricas.`);
      } catch (e) {
        console.warn('[SQLite] Aviso ao migrar recharges.json:', e.message);
      }
    }

    // 4. Histórico diário de páginas
    const pageHistoryPath = path.join(DATA_DIR, 'page_history.json');
    if (fs.existsSync(pageHistoryPath)) {
      fs.copyFileSync(pageHistoryPath, path.join(backupSubdir, 'page_history.json'));
      try {
        const pageHistory = JSON.parse(fs.readFileSync(pageHistoryPath, 'utf8'));
        const insertPage = db.prepare(`
          INSERT OR IGNORE INTO page_history (printer_id, date, start_page_count, end_page_count, supplies_json, last_updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const ph of pageHistory) {
          insertPage.run(
            ph.printerId,
            ph.date,
            ph.startPageCount || 0,
            ph.endPageCount || ph.startPageCount || 0,
            JSON.stringify(ph.supplies || []),
            ph.lastUpdatedAt || new Date().toISOString()
          );
        }
        console.log(`[SQLite] Migrados ${pageHistory.length} registros diários de contadores.`);
      } catch (e) {
        console.warn('[SQLite] Aviso ao migrar page_history.json:', e.message);
      }
    }

    // 5. Histórico de telemetria
    const telemetryPath = path.join(DATA_DIR, 'telemetry_history.json');
    if (fs.existsSync(telemetryPath)) {
      fs.copyFileSync(telemetryPath, path.join(backupSubdir, 'telemetry_history.json'));
      try {
        const telemetry = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
        const insertTelem = db.prepare(`
          INSERT INTO telemetry_snapshots (printer_id, ip, name, unit_name, page_count, supplies_json, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of telemetry) {
          insertTelem.run(
            t.printerId,
            t.ip || '',
            t.name || '',
            t.unitName || '',
            t.pageCount || 0,
            JSON.stringify(t.supplies || []),
            t.recordedAt || new Date().toISOString()
          );
        }
        console.log(`[SQLite] Migrados ${telemetry.length} snapshots de telemetria.`);
      } catch (e) {
        console.warn('[SQLite] Aviso ao migrar telemetry_history.json:', e.message);
      }
    }

    db.exec('COMMIT');
    console.log('\x1b[32m%s\x1b[0m', `[SQLite] ✅ Migração concluída com sucesso! Backup dos JSONs salvo em: ${backupSubdir}`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('\x1b[31m%s\x1b[0m', '[SQLite] Falha crítica na migração JSON -> SQLite:', err);
    throw err;
  }
}

// Sincroniza dados novos ou atualizados de units.json e printers.json para o SQLite
export function syncSeedData() {
  const database = getDb();
  const unitsPath = path.join(DATA_DIR, 'units.json');
  const printersJsonPath = path.join(DATA_DIR, 'printers.json');

  if (fs.existsSync(unitsPath)) {
    try {
      const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
      const findUnit = database.prepare('SELECT id, region FROM units WHERE id = ? OR name = ?');
      const insertUnit = database.prepare('INSERT INTO units (id, name, description, region, created_at) VALUES (?, ?, ?, ?, ?)');
      const updateUnitRegion = database.prepare('UPDATE units SET region = ? WHERE id = ?');
      for (const u of units) {
        const uRegion = (u.region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ';
        const existing = findUnit.get(u.id, u.name);
        if (!existing) {
          insertUnit.run(u.id, u.name, u.description || '', uRegion, u.createdAt || new Date().toISOString());
        } else if (u.region && existing.region !== uRegion) {
          updateUnitRegion.run(uRegion, existing.id);
        }
      }
    } catch (e) {
      console.warn('[SQLite] Aviso ao sincronizar units.json:', e.message);
    }
  }

  if (fs.existsSync(printersJsonPath)) {
    try {
      const printers = JSON.parse(fs.readFileSync(printersJsonPath, 'utf8'));
      const findPrinter = database.prepare('SELECT id, ip, name, location, unit_name, unit_id, mac_address FROM printers WHERE ip = ? OR id = ?');
      const insertPrinter = database.prepare(`
        INSERT INTO printers (id, name, ip, location, unit_id, unit_name, community, initial_page_count, hefesto_activated_at, installed_at, mac_address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updatePrinter = database.prepare(`
        UPDATE printers SET name = ?, location = ?, unit_id = ?, unit_name = ?, mac_address = COALESCE(?, mac_address), updated_at = ?
        WHERE id = ?
      `);

      let added = 0;
      let updated = 0;

      database.exec('BEGIN IMMEDIATE TRANSACTION');
      for (const p of printers) {
        const pId = p.id;
        const pIp = p.ip;
        const pName = p.name;
        const pLoc = p.location || '';
        const pUnitId = p.unit_id || p.unitId || null;
        const pUnitName = p.unit_name || p.unitName || 'Sem Unidade';
        const pComm = p.community || 'public';
        const pInitPages = p.initial_page_count || p.initialPageCount || 0;
        const pActAt = p.hefesto_activated_at || p.hefestoActivatedAt || p.created_at || new Date().toISOString();
        const pInstAt = p.installed_at || p.installedAt || null;
        const pMac = formatMacAddress(p.mac_address || p.mac || p.macAddress);
        const pCreatedAt = p.created_at || p.createdAt || new Date().toISOString();

        let targetUnitId = pUnitId;
        if (pUnitName && pUnitName !== 'Sem Unidade') {
          const unitExists = database.prepare('SELECT id FROM units WHERE name = ? OR id = ?').get(pUnitName, pUnitId);
          if (unitExists) {
            targetUnitId = unitExists.id;
          } else if (pUnitId) {
            try {
              database.prepare('INSERT INTO units (id, name, description, region, created_at) VALUES (?, ?, ?, ?, ?)').run(
                pUnitId, pUnitName, `Unidade ${pUnitName}`, p.region || 'RJ', new Date().toISOString()
              );
              targetUnitId = pUnitId;
            } catch {
              targetUnitId = null;
            }
          }
        }

        // Valida se targetUnitId de fato existe na tabela units para evitar violação de integridade referencial
        if (targetUnitId) {
          const valid = database.prepare('SELECT id FROM units WHERE id = ?').get(targetUnitId);
          if (!valid) targetUnitId = null;
        }

        // Se a impressora já foi excluída explicitamente por um administrador, NUNCA ressuscitar!
        const isDeleted = database.prepare('SELECT 1 FROM deleted_printers WHERE id = ? OR (ip IS NOT NULL AND ip != \'\' AND ip = ?)').get(pId, pIp);
        if (isDeleted) {
          continue;
        }

        const existing = findPrinter.get(pIp, pId);
        if (!existing) {
          insertPrinter.run(
            pId, pName, pIp, pLoc, targetUnitId, pUnitName, pComm, pInitPages, pActAt, pInstAt, pMac, pCreatedAt, new Date().toISOString()
          );
          added++;
        } else {
          // Preservação estrita da SSOT (SQLite): nunca sobrescreve edições do usuário (nome, local, filial)
          // Apenas enriquece mac_address se estava nulo/ausente no banco de dados.
          if (pMac && !existing.mac_address) {
            database.prepare('UPDATE printers SET mac_address = ?, updated_at = ? WHERE id = ?')
              .run(pMac, new Date().toISOString(), existing.id);
            updated++;
          }
        }
      }
      database.exec('COMMIT');

      if (added > 0 || updated > 0) {
        console.log(`[SQLite] Sincronização não-destrutiva de catálogo: ${added} impressora(s) nova(s) cadastrada(s), ${updated} enriquecida(s) com MAC.`);
      }
    } catch (e) {
      try { database.exec('ROLLBACK'); } catch {}
      console.warn('[SQLite] Aviso ao sincronizar printers.json:', e.message);
    }
  }


}

// ============================================================================
// OPERAÇÕES: SUB-REDES CORPORATIVAS (VARREDURA GLOBAL POR MAC)
// ============================================================================
export function getCorporateSubnets() {
  const database = getDb();

  // 1. Sub-redes cadastradas manualmente
  const manualRows = database.prepare('SELECT id, subnet, description, created_at FROM corporate_subnets ORDER BY subnet ASC').all() || [];

  // 2. Sub-redes derivadas dinamicamente das impressoras cadastradas
  const printerRows = database.prepare(`
    SELECT ip, unit_name, unit_id FROM printers WHERE ip NOT LIKE 'pendente-%' AND ip != '-'
  `).all() || [];

  const subnetsMap = new Map();

  // Insere primeiro as manuais
  for (const row of manualRows) {
    subnetsMap.set(row.subnet, {
      id: row.id,
      subnet: row.subnet,
      description: row.description || '',
      printerCount: 0,
      isDynamic: false,
      createdAt: row.created_at
    });
  }

  // Analisa as impressoras e conta
  for (const p of printerRows) {
    if (!p.ip) continue;
    const parts = p.ip.split('.');
    if (parts.length >= 3) {
      const sub = `${parts[0]}.${parts[1]}.${parts[2]}`;
      if (!subnetsMap.has(sub)) {
        subnetsMap.set(sub, {
          id: `dyn-${sub.replace(/\./g, '-')}`,
          subnet: sub,
          description: p.unit_name || 'Filial Dinâmica',
          printerCount: 1,
          isDynamic: true,
          createdAt: new Date().toISOString()
        });
      } else {
        const item = subnetsMap.get(sub);
        item.printerCount++;
        if (!item.description && p.unit_name) item.description = p.unit_name;
      }
    }
  }

  return Array.from(subnetsMap.values()).sort((a, b) => a.subnet.localeCompare(b.subnet, undefined, { numeric: true }));
}

export function addCorporateSubnet(subnet, description = '') {
  const database = getDb();
  let cleanSub = String(subnet || '').trim().replace(/\/24$/, '').replace(/\.0$/, '');
  const parts = cleanSub.split('.');
  if (parts.length < 3) {
    throw new Error('Formato de sub-rede inválido. Esperado X.X.X (ex: 198.18.2)');
  }
  cleanSub = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const id = `sub-${cleanSub.replace(/\./g, '-')}`;
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO corporate_subnets (id, subnet, description, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(subnet) DO UPDATE SET description = excluded.description
  `).run(id, cleanSub, description.trim(), now);

  return { id, subnet: cleanSub, description: description.trim(), created_at: now };
}

export function deleteCorporateSubnet(idOrSubnet) {
  const database = getDb();
  return database.prepare('DELETE FROM corporate_subnets WHERE id = ? OR subnet = ?').run(idOrSubnet, idOrSubnet);
}

// ============================================================================
// OPERAÇÕES: UNIDADES
// ============================================================================
export function getUnits() {
  const rows = getDb().prepare('SELECT * FROM units ORDER BY name ASC').all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    region: (r.region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    createdAt: r.created_at
  }));
}

export function getUnitById(id) {
  if (!id) return null;
  const r = getDb().prepare('SELECT * FROM units WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    region: (r.region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    createdAt: r.created_at
  };
}

export function saveUnit(unit) {
  const cleanName = (unit.name || '').trim().replace(/\s+/g, ' ');
  const region = (unit.region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ';
  const id = unit.id || ('unit-' + Math.random().toString(36).substring(2, 10));
  const existing = unit.id ? getUnitById(unit.id) : null;
  if (existing) {
    getDb().prepare('UPDATE units SET name = ?, description = ?, region = ? WHERE id = ?')
      .run(cleanName, unit.description || '', region, existing.id);
  } else {
    getDb().prepare('INSERT INTO units (id, name, description, region, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, cleanName, unit.description || '', region, unit.createdAt || new Date().toISOString());
  }
  return getUnitById(id);
}

export function deleteUnit(id) {
  getDb().prepare('DELETE FROM units WHERE id = ?').run(id);
}

export function updateUnitNameInPrinters(unitId, oldUnitName, newUnitName) {
  const now = new Date().toISOString();
  if (unitId && oldUnitName) {
    getDb().prepare(`
      UPDATE printers
      SET unit_name = ?, unit_id = COALESCE(unit_id, ?), updated_at = ?
      WHERE unit_id = ? OR unit_name = ?
    `).run(newUnitName, unitId, now, unitId, oldUnitName);
  } else if (unitId) {
    getDb().prepare(`
      UPDATE printers
      SET unit_name = ?, updated_at = ?
      WHERE unit_id = ?
    `).run(newUnitName, now, unitId);
  }
}

export function disassociatePrintersFromUnit(unitId, unitName) {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE printers
    SET unit_id = NULL, unit_name = 'Sem Unidade', updated_at = ?
    WHERE unit_id = ? OR unit_name = ?
  `).run(now, unitId, unitName || '');
}

// ============================================================================
// OPERAÇÕES: IMPRESSORAS
// ============================================================================
/**
 * Formata um MAC Address no padrão XX:XX:XX:XX:XX:XX
 */
function formatMacAddress(raw) {
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

export function getPrinters({ includeInactive = false } = {}) {
  const rows = getDb().prepare(`
    SELECT p.*, u.region AS unit_region
    FROM printers p
    LEFT JOIN units u ON p.unit_id = u.id
    ${includeInactive ? '' : 'WHERE COALESCE(p.is_active, 1) = 1'}
    ORDER BY p.location ASC, p.name ASC
  `).all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    ip: r.is_active === 0 ? (r.archived_ip || r.ip.split('#replaced_')[0]) : r.ip,
    isActive: r.is_active !== 0,
    registryIp: r.ip,
    decommissionedAt: r.decommissioned_at || null,
    location: r.location,
    unitId: r.unit_id,
    unitName: r.unit_name,
    region: (r.unit_region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    community: r.community,
    initialPageCount: r.initial_page_count,
    hefestoActivatedAt: r.hefesto_activated_at,
    installedAt: r.installed_at,
    macAddress: r.mac_address || null,
    createdAt: r.created_at
  }));
}

export function getPrinterById(id) {
  const r = getDb().prepare(`
    SELECT p.*, u.region AS unit_region
    FROM printers p
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.id = ?
  `).get(id);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    ip: r.is_active === 0 ? (r.archived_ip || r.ip.split('#replaced_')[0]) : r.ip,
    isActive: r.is_active !== 0,
    registryIp: r.ip,
    decommissionedAt: r.decommissioned_at || null,
    location: r.location,
    unitId: r.unit_id,
    unitName: r.unit_name,
    region: (r.unit_region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    community: r.community,
    initialPageCount: r.initial_page_count,
    hefestoActivatedAt: r.hefesto_activated_at,
    installedAt: r.installed_at,
    macAddress: r.mac_address || null,
    createdAt: r.created_at
  };
}

export function getPrinterByIp(ip) {
  const r = getDb().prepare(`
    SELECT p.*, u.region AS unit_region
    FROM printers p
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.ip = ? AND COALESCE(p.is_active, 1) = 1
  `).get(ip);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    ip: r.is_active === 0 ? (r.archived_ip || r.ip.split('#replaced_')[0]) : r.ip,
    isActive: r.is_active !== 0,
    registryIp: r.ip,
    decommissionedAt: r.decommissioned_at || null,
    location: r.location,
    unitId: r.unit_id,
    unitName: r.unit_name,
    region: (r.unit_region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    community: r.community,
    initialPageCount: r.initial_page_count,
    hefestoActivatedAt: r.hefesto_activated_at,
    installedAt: r.installed_at,
    macAddress: r.mac_address || null,
    createdAt: r.created_at
  };
}

export function getPrinterByMac(mac) {
  const formatted = formatMacAddress(mac);
  if (!formatted) return null;
  const r = getDb().prepare(`
    SELECT p.*, u.region AS unit_region
    FROM printers p
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.mac_address = ? COLLATE NOCASE AND COALESCE(p.is_active, 1) = 1
  `).get(formatted);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    ip: r.is_active === 0 ? (r.archived_ip || r.ip.split('#replaced_')[0]) : r.ip,
    isActive: r.is_active !== 0,
    registryIp: r.ip,
    decommissionedAt: r.decommissioned_at || null,
    location: r.location,
    unitId: r.unit_id,
    unitName: r.unit_name,
    region: (r.unit_region || 'RJ').trim().toUpperCase() === 'SP' ? 'SP' : 'RJ',
    community: r.community,
    initialPageCount: r.initial_page_count,
    hefestoActivatedAt: r.hefesto_activated_at,
    installedAt: r.installed_at,
    macAddress: r.mac_address || null,
    createdAt: r.created_at
  };
}

export function savePrinter(printer, options = {}) {
  const database = getDb();
  const savepoint = `printer_write_${crypto.randomBytes(6).toString('hex')}`;
  database.exec(`SAVEPOINT ${savepoint}`);
  try {
    const result = savePrinterRecord(printer, options);
    database.exec(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    database.exec(`RELEASE SAVEPOINT ${savepoint}`);
    throw error;
  }
}

function savePrinterRecord(printer, options) {
  // Remove de deleted_printers caso esteja sendo re-cadastrada propositalmente
  try {
    getDb().prepare('DELETE FROM deleted_printers WHERE id = ? OR (ip IS NOT NULL AND ip != \'\' AND ip = ?)').run(printer.id, printer.ip || '');
  } catch {}

  const existing = getPrinterById(printer.id);
  const now = new Date().toISOString();
  const formattedMac = formatMacAddress(printer.macAddress || printer.mac_address || (existing ? existing.macAddress : null));
  const cleanUnitName = printer.unitName !== undefined
    ? (printer.unitName || '').trim().replace(/\s+/g, ' ')
    : (existing ? existing.unitName : 'Sem Unidade');

  if (existing) {
    if (!options.skipAllocations && ((printer.unitId !== undefined && printer.unitId !== existing.unitId) ||
        (printer.unitName !== undefined && cleanUnitName !== existing.unitName) ||
        (printer.location !== undefined && printer.location !== existing.location))) {
      const counter = getCachedStatus(existing.id)?.info?.pageCount ?? null;
      closeAllocation(getDb(), existing, counter, now);
      openAllocation(getDb(), { ...existing, ...printer, unitName: cleanUnitName }, counter, 'relocation', now);
    }
    getDb().prepare(`
      UPDATE printers SET
        name = ?,
        ip = ?,
        location = ?,
        unit_id = ?,
        unit_name = ?,
        community = ?,
        initial_page_count = ?,
        installed_at = ?,
        mac_address = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      printer.name,
      printer.ip,
      printer.location !== undefined ? printer.location : existing.location,
      printer.unitId !== undefined ? printer.unitId : existing.unitId,
      cleanUnitName,
      printer.community !== undefined ? printer.community : existing.community,
      printer.initialPageCount !== undefined ? printer.initialPageCount : existing.initialPageCount,
      printer.installedAt !== undefined ? printer.installedAt : existing.installedAt,
      formattedMac,
      now,
      printer.id
    );
  } else {
    getDb().prepare(`
      INSERT INTO printers (id, name, ip, location, unit_id, unit_name, community, initial_page_count, hefesto_activated_at, installed_at, mac_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      printer.id,
      printer.name,
      printer.ip,
      printer.location || '',
      printer.unitId || null,
      cleanUnitName || 'Sem Unidade',
      printer.community || 'public',
      printer.initialPageCount !== undefined ? printer.initialPageCount : 0,
      printer.hefestoActivatedAt || now,
      printer.installedAt || null,
      formattedMac,
      printer.createdAt || now,
      now
    );
  }
  return getPrinterById(printer.id);
}

export function reconcilePrinterIpByMac(macAddress, newIp) {
  if (!macAddress || !newIp) return { success: false, error: 'MAC Address e novo IP são obrigatórios.' };
  const formattedMac = formatMacAddress(macAddress);
  if (!formattedMac) return { success: false, error: 'Formato de MAC Address inválido.' };

  const printer = getPrinterByMac(formattedMac);
  if (!printer) {
    return { success: false, error: `Nenhuma impressora encontrada com o MAC ${formattedMac}.` };
  }

  const previousIp = printer.ip;
  if (previousIp === newIp) {
    return { success: true, updated: false, printer, previousIp, newIp, message: 'O IP da impressora já coincide com o detectado.' };
  }

  const now = new Date().toISOString();

  // Tratamento não-destrutivo de colisão de IP caso o novo IP estivesse atribuído a outro registro
  const ipCollision = getDb().prepare('SELECT id, name FROM printers WHERE ip = ? AND id != ?').get(newIp, printer.id);
  if (ipCollision) {
    getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?')
      .run(`pendente-${newIp}-${Date.now().toString().slice(-4)}`, now, ipCollision.id);
  }

  // Atualiza para o novo IP
  getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?').run(newIp, now, printer.id);

  // Invalida cache de status anterior
  try {
    getDb().prepare('DELETE FROM printer_status_cache WHERE printer_id = ?').run(printer.id);
  } catch {}

  const updatedPrinter = getPrinterById(printer.id);
  return {
    success: true,
    updated: true,
    printer: updatedPrinter,
    previousIp,
    newIp,
    macAddress: formattedMac,
    displacedPrinterId: ipCollision ? ipCollision.id : null
  };
}

export function getPrinterBySerial(serial) {
  if (!serial) return null;
  const cleanSerial = String(serial).trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleanSerial) return null;

  // 1. Procura no cache de status por serial_number
  try {
    const cached = getDb().prepare(`
      SELECT c.printer_id FROM printer_status_cache c JOIN printers p ON p.id = c.printer_id
      WHERE COALESCE(p.is_active, 1) = 1 AND UPPER(REPLACE(REPLACE(c.serial_number, ' ', ''), '-', '')) = ?
    `).get(cleanSerial);

    if (cached && cached.printer_id) {
      const printer = getPrinterById(cached.printer_id);
      if (printer?.isActive) return printer;
    }
  } catch {}

  // 2. Procura na tabela printers (por name, location ou serial)
  const all = getPrinters();
  const matched = all.find(p => {
    const cleanName = (p.name || '').toUpperCase().replace(/[\s-]/g, '');
    const cleanPLoc = (p.location || '').toUpperCase().replace(/[\s-]/g, '');
    const cleanPSer = (p.serialNumber || p.serial || '').toUpperCase().replace(/[\s-]/g, '');
    return cleanName === cleanSerial || cleanPLoc === cleanSerial || cleanPSer === cleanSerial;
  });

  return matched || null;
}

export function reconcilePrinterIpBySerial(serial, newIp) {
  if (!serial || !newIp) return { success: false, error: 'Número de série e novo IP são obrigatórios.' };
  const printer = getPrinterBySerial(serial);
  if (!printer) {
    return { success: false, error: `Nenhuma impressora encontrada com o Serial ${serial}.` };
  }

  const previousIp = printer.ip;
  if (previousIp === newIp) {
    return { success: true, updated: false, printer, previousIp, newIp, message: 'O IP da impressora já coincide com o detectado.' };
  }

  const now = new Date().toISOString();

  // Tratamento não-destrutivo de colisão de IP caso o novo IP estivesse atribuído a outro registro
  const ipCollision = getDb().prepare('SELECT id, name FROM printers WHERE ip = ? AND id != ?').get(newIp, printer.id);
  if (ipCollision) {
    getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?')
      .run(`pendente-${newIp}-${Date.now().toString().slice(-4)}`, now, ipCollision.id);
  }

  // Atualiza para o novo IP
  getDb().prepare('UPDATE printers SET ip = ?, updated_at = ? WHERE id = ?').run(newIp, now, printer.id);

  // Invalida cache de status anterior
  try {
    getDb().prepare('DELETE FROM printer_status_cache WHERE printer_id = ?').run(printer.id);
  } catch {}

  const updatedPrinter = getPrinterById(printer.id);
  return {
    success: true,
    updated: true,
    printer: updatedPrinter,
    previousIp,
    newIp,
    serialNumber: serial,
    displacedPrinterId: ipCollision ? ipCollision.id : null
  };
}

export function extractSerialFromString(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  // Padrão de número de série Epson
  const epsonMatch = s.match(/\b(X[0-9A-Z]{9}|XC[0-9A-Z]{8})\b/i);
  if (epsonMatch) return epsonMatch[1].toUpperCase();

  // Padrão de número de série Brother
  const brotherMatch = s.match(/\b(U[0-9A-Z]{14})\b/i);
  if (brotherMatch) return brotherMatch[1].toUpperCase();

  // Padrão de número de série Lexmark
  const lexmarkMatch = s.match(/\b([0-9]{4,7}[0-9A-Z]{6,8})\b/i);
  if (lexmarkMatch) return lexmarkMatch[1].toUpperCase();

  // Padrão de número de série Xerox
  const xeroxMatch = s.match(/\b([A-Z0-9]{9,10})\b/i);
  if (xeroxMatch) return xeroxMatch[1].toUpperCase();

  return null;
}

export function findExistingPrinterMatch({ id, ip, name, macAddress, serialNumber, location, unitId, unitName }) {
  // 1. Busca por ID direto
  if (id) {
    const byId = getPrinterById(id);
    if (byId?.isActive) return byId;
  }

  // 2. Busca por MAC Address
  if (macAddress) {
    const cleanMac = formatMacAddress(macAddress);
    if (cleanMac) {
      const byMac = getPrinterByMac(cleanMac);
      if (byMac) return byMac;
    }
  }

  // 3. Busca por Serial explícito
  const explicitSerial = serialNumber ? String(serialNumber).trim().toUpperCase() : null;
  if (explicitSerial && explicitSerial !== '-' && explicitSerial !== 'N/D') {
    const bySerial = getPrinterBySerial(explicitSerial);
    if (bySerial) return bySerial;
  }

  // 4. Busca por Serial embutido no nome
  const serialFromName = extractSerialFromString(name);
  if (serialFromName) {
    const bySerialName = getPrinterBySerial(serialFromName);
    if (bySerialName) return bySerialName;
  }

  // 5. Busca por IP (se não for pendente)
  if (ip && !String(ip).startsWith('pendente')) {
    const byIp = getPrinterByIp(String(ip).trim());
    if (byIp) return byIp;
  }

  // 6. Busca por Nome idêntico dentro da mesma Unidade
  if (name && (unitId || unitName)) {
    const all = getPrinters();
    const cleanName = String(name).trim().toLowerCase();
    const byName = all.find(p => {
      const sameName = (p.name || '').trim().toLowerCase() === cleanName;
      const sameUnit = (unitId && p.unitId === unitId) ||
                       (unitName && (p.unitName || '').toLowerCase() === String(unitName).toLowerCase());
      return sameName && sameUnit;
    });
    if (byName) return byName;
  }

  // 7. Busca por Local idêntico dentro da mesma Unidade (para não duplicar sala de consultório se não houver conflito de serial/IP)
  if (location && location !== '-' && location.toLowerCase() !== 'estoque' && (unitId || unitName)) {
    const all = getPrinters();
    const cleanLoc = String(location).trim().toLowerCase();
    const cleanSerial = explicitSerial ? explicitSerial.replace(/[\s-]/g, '') : null;
    const byLoc = all.find(p => {
      const sameLoc = (p.location || '').trim().toLowerCase() === cleanLoc;
      const sameUnit = (unitId && p.unitId === unitId) ||
                       (unitName && (p.unitName || '').toLowerCase() === String(unitName).toLowerCase());
      if (!sameLoc || !sameUnit) return false;
      // Não colidir se os seriais forem explicitamente diferentes
      const existingSerial = (p.name || '').toUpperCase().replace(/[\s-]/g, '');
      if (cleanSerial && existingSerial && cleanSerial !== existingSerial) return false;
      // Não colidir se os IPs forem explicitamente diferentes e válidos
      if (ip && p.ip && !ip.startsWith('pendente') && !p.ip.startsWith('pendente') && ip !== p.ip) return false;
      return true;
    });
    if (byLoc) return byLoc;
  }

  return null;
}

export function deletePrinter(id) {
  if (getDb().prepare('SELECT 1 FROM printer_replacements WHERE replaced_printer_id = ? OR new_printer_id = ?').get(id, id)) {
    throw new Error('Ativo vinculado ao histórico de substituição não pode ser excluído.');
  }
  const p = getPrinterById(id);
  if (p) {
    try {
      getDb().prepare(`
        INSERT INTO deleted_printers (id, ip, name, unit_name, deleted_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET ip = excluded.ip, name = excluded.name, unit_name = excluded.unit_name, deleted_at = excluded.deleted_at
      `).run(p.id, p.ip || null, p.name || null, p.unitName || null, new Date().toISOString());
    } catch (e) {
      console.warn('[SQLite] Erro ao registrar impressora excluída:', e.message);
    }
  }
  getDb().prepare('DELETE FROM printers WHERE id = ?').run(id);
  getDb().prepare('DELETE FROM printer_status_cache WHERE printer_id = ?').run(id);
  getDb().prepare('DELETE FROM pending_recharges WHERE printer_id = ?').run(id);
}

export function getDeletedPrinters() {
  return getDb().prepare('SELECT * FROM deleted_printers ORDER BY deleted_at DESC').all();
}

export function isPrinterDeleted(id, ip) {
  return Boolean(getDb().prepare('SELECT 1 FROM deleted_printers WHERE id = ? OR (ip IS NOT NULL AND ip != \'\' AND ip = ?)').get(id, ip || ''));
}

// ============================================================================
// OPERAÇÕES: CACHE PERSISTIDO DE STATUS (Tolerante a reinicializações)
// ============================================================================
function mapCachedStatus(r) {
  const extra = r.telemetry_json ? JSON.parse(r.telemetry_json) : {};
  return {
    ...extra,
    id: r.printer_id,
    online: Boolean(r.online),
    info: { ...extra.info, model: r.model, serialNumber: r.serial_number, pageCount: r.page_count },
    status: { ...extra.status, code: r.status_code, description: r.status_description },
    supplies: r.supplies_json ? JSON.parse(r.supplies_json) : [],
    trays: r.trays_json ? JSON.parse(r.trays_json) : [],
    alertsAvailable: Boolean(r.online) && extra.alertsAvailable === true,
    cachedAt: r.cached_at
  };
}
export function getAllCachedStatuses() {
  return new Map(getDb().prepare('SELECT * FROM printer_status_cache').all().map(r => [r.printer_id, mapCachedStatus(r)]));
}
export function getCachedStatus(printerId) {
  const r = getDb().prepare('SELECT * FROM printer_status_cache WHERE printer_id = ?').get(printerId);
  return r ? mapCachedStatus(r) : null;
}

export function updateCachedStatus(printerId, data = {}) {
  const now = new Date().toISOString();
  const info = data.info || {};
  const status = data.status || {};
  const previous = getCachedStatus(printerId);
  const asset = getPrinterById(printerId);
  if (hasPrinterIdentityConflict({ ...previous?.info, macAddress: asset?.macAddress }, info)) {
    throw new Error('Outro equipamento foi detectado neste IP. Use Substituir equipamento para preservar o histórico.');
  }

  const online = data.online !== undefined ? (data.online ? 1 : 0) : (status.code !== undefined && status.code !== 5 ? 1 : 0);
  const statusCode = status.code !== undefined ? status.code : (data.statusCode !== undefined ? data.statusCode : (online ? 3 : 5));
  const statusDescription = status.description || data.statusDescription || (online ? 'Operando' : 'Desconectada');

  const rawPageCount = info.pageCount ?? data.pageCount;
  const pageCount = Number.isSafeInteger(rawPageCount) && rawPageCount >= 0 ? rawPageCount : null;
  const model = info.model || data.model || '';
  const serialNumber = info.serialNumber || data.serialNumber || '';

  const suppliesJson = JSON.stringify(data.supplies || status.supplies || []);
  const traysJson = JSON.stringify(data.trays || status.trays || []);

  getDb().prepare(`
    INSERT INTO printer_status_cache (printer_id, online, status_code, status_description, page_count, model, serial_number, supplies_json, trays_json, cached_at, telemetry_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(printer_id) DO UPDATE SET
      online = excluded.online,
      status_code = excluded.status_code,
      status_description = excluded.status_description,
      page_count = COALESCE(excluded.page_count, printer_status_cache.page_count),
      model = CASE WHEN excluded.model != '' THEN excluded.model ELSE printer_status_cache.model END,
      serial_number = CASE WHEN excluded.serial_number != '' THEN excluded.serial_number ELSE printer_status_cache.serial_number END,
      supplies_json = CASE WHEN excluded.supplies_json != '[]' THEN excluded.supplies_json ELSE printer_status_cache.supplies_json END,
      trays_json = CASE WHEN excluded.trays_json != '[]' THEN excluded.trays_json ELSE printer_status_cache.trays_json END,
      cached_at = excluded.cached_at,
      telemetry_json = excluded.telemetry_json
  `).run(
    printerId,
    online,
    statusCode,
    statusDescription,
    pageCount,
    model,
    serialNumber,
    suppliesJson,
    traysJson,
    now,
    JSON.stringify(data)
  );

  // Auto-popula mac_address na tabela printers se detectado pela telemetria
  const macCandidate = info.macAddress || data.macAddress;
  if (macCandidate) {
    try {
      getDb().prepare(`
        UPDATE printers
        SET mac_address = ?
        WHERE id = ? AND (mac_address IS NULL OR mac_address = '')
      `).run(formatMacAddress(macCandidate), printerId);
    } catch {}
  }
}

// Aliases para compatibilidade retroativa com edge-sync e contratos legados
export const getPrinterStatusCache = getCachedStatus;
export const savePrinterStatusCache = updateCachedStatus;

// ============================================================================
// OPERAÇÕES: SAÚDE OPERACIONAL DA IMPRESSORA (MON-001)
// ============================================================================
function mapPrinterHealthRow(r) {
  if (!r) return null;
  return {
    printerId: r.printer_id,
    state: r.state,
    severity: r.severity,
    reasonCode: r.reason_code,
    reason: r.reason,
    consecutiveFailures: Number(r.consecutive_failures) || 0,
    consecutiveSuccesses: Number(r.consecutive_successes) || 0,
    lastCheckAt: r.last_check_at,
    lastSuccessAt: r.last_success_at,
    lastFailureAt: r.last_failure_at,
    lastTransitionAt: r.last_transition_at,
    latencyMs: r.latency_ms === null || r.latency_ms === undefined ? null : Number(r.latency_ms),
    lastError: r.last_error,
    criticalSupply: r.critical_supply_json ? JSON.parse(r.critical_supply_json) : null,
    warningSupply: r.warning_supply_json ? JSON.parse(r.warning_supply_json) : null,
    telemetrySource: r.telemetry_source,
    updatedAt: r.updated_at
  };
}

export function getPrinterHealth(printerId) {
  if (!printerId) return null;
  const row = getDb().prepare('SELECT * FROM printer_health WHERE printer_id = ?').get(printerId);
  return mapPrinterHealthRow(row);
}

export function getAllPrinterHealth() {
  const rows = getDb().prepare('SELECT * FROM printer_health').all();
  return rows.map(mapPrinterHealthRow);
}

export function savePrinterHealth(printerId, health) {
  if (!printerId || !health) return null;
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO printer_health (
      printer_id, state, severity, reason_code, reason,
      consecutive_failures, consecutive_successes,
      last_check_at, last_success_at, last_failure_at, last_transition_at,
      latency_ms, last_error, critical_supply_json, warning_supply_json,
      telemetry_source, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(printer_id) DO UPDATE SET
      state = excluded.state,
      severity = excluded.severity,
      reason_code = excluded.reason_code,
      reason = excluded.reason,
      consecutive_failures = excluded.consecutive_failures,
      consecutive_successes = excluded.consecutive_successes,
      last_check_at = excluded.last_check_at,
      last_success_at = excluded.last_success_at,
      last_failure_at = excluded.last_failure_at,
      last_transition_at = excluded.last_transition_at,
      latency_ms = excluded.latency_ms,
      last_error = excluded.last_error,
      critical_supply_json = excluded.critical_supply_json,
      warning_supply_json = excluded.warning_supply_json,
      telemetry_source = excluded.telemetry_source,
      updated_at = excluded.updated_at
  `).run(
    printerId,
    health.state || 'stale',
    health.severity || 'warning',
    health.reasonCode || '',
    health.reason || '',
    Number(health.consecutiveFailures) || 0,
    Number(health.consecutiveSuccesses) || 0,
    health.lastCheckAt || now,
    health.lastSuccessAt || null,
    health.lastFailureAt || null,
    health.lastTransitionAt || now,
    health.latencyMs === null || health.latencyMs === undefined ? null : Number(health.latencyMs),
    health.lastError || null,
    health.criticalSupply ? JSON.stringify(health.criticalSupply) : null,
    health.warningSupply ? JSON.stringify(health.warningSupply) : null,
    health.telemetrySource || '',
    now
  );

  return getPrinterHealth(printerId);
}

// ============================================================================
// OPERAÇÕES: CONFIRMAÇÃO DE RECARGAS PENDENTES (PERSISTIDAS NO BANCO)
// ============================================================================
export function getPendingRecharge(id) {
  const r = getDb().prepare('SELECT * FROM pending_recharges WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    printerId: r.printer_id,
    supplyName: r.supply_name,
    supplyType: r.supply_type,
    baselineLevel: r.baseline_level,
    targetLevel: r.target_level,
    consecutiveCycles: r.consecutive_cycles,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen
  };
}

export function getAllPendingRecharges() {
  const rows = getDb().prepare('SELECT * FROM pending_recharges').all();
  return rows.map(r => ({
    id: r.id,
    printerId: r.printer_id,
    supplyName: r.supply_name,
    supplyType: r.supply_type,
    baselineLevel: r.baseline_level,
    targetLevel: r.target_level,
    consecutiveCycles: r.consecutive_cycles,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen
  }));
}

export function savePendingRecharge(item) {
  getDb().prepare(`
    INSERT INTO pending_recharges (id, printer_id, supply_name, supply_type, baseline_level, target_level, consecutive_cycles, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      target_level = excluded.target_level,
      consecutive_cycles = excluded.consecutive_cycles,
      last_seen = excluded.last_seen
  `).run(
    item.id,
    item.printerId,
    item.supplyName,
    item.supplyType || 'toner',
    item.baselineLevel,
    item.targetLevel,
    item.consecutiveCycles || 1,
    item.firstSeen || new Date().toISOString(),
    item.lastSeen || new Date().toISOString()
  );
}

export function setPendingRecharge(keyOrItem, data) {
  if (typeof keyOrItem === 'string' && data) {
    return savePendingRecharge({
      id: keyOrItem,
      printerId: data.printerId,
      supplyName: data.supplyName,
      supplyType: data.supplyType || 'toner',
      baselineLevel: data.levelBefore ?? data.baselineLevel ?? 0,
      targetLevel: data.levelAfter ?? data.targetLevel ?? 100,
      consecutiveCycles: data.consecutiveCycles || 1,
      firstSeen: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
  }
  return savePendingRecharge(keyOrItem);
}

export function deletePendingRecharge(id) {
  getDb().prepare('DELETE FROM pending_recharges WHERE id = ?').run(id);
}

/**
 * Expira pendências de recargas antigas que ultrapassaram o limite de tempo sem confirmação.
 */
export function expireStalePendingRecharges(maxAgeHours = 24) {
  try {
    const cutoff = new Date(Date.now() - maxAgeHours * 3600000).toISOString();
    const info = getDb().prepare('DELETE FROM pending_recharges WHERE last_seen < ?').run(cutoff);
    return info.changes || 0;
  } catch (err) {
    console.warn('[SQLite] Erro ao expirar recargas pendentes obsoletas:', err.message);
    return 0;
  }
}

/**
 * Avalia se um salto abrupto de nível de suprimento é apenas recuperação de oscilação/reboot transitório.
 */
export function isRebootGlitch(printerId, supplyName, newPercentage, lookbackLimit = 3) {
  if (!printerId || !supplyName || typeof newPercentage !== 'number') return false;
  try {
    const snapshots = getRecentSnapshotsForPrinter(printerId, lookbackLimit);
    if (!snapshots || snapshots.length < 2) return false;

    const normalizedSlot = normalizeSupplySlot(supplyName);
    for (let i = 1; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!Array.isArray(snap.supplies)) continue;
      const matching = snap.supplies.find(s => normalizeSupplySlot(s.name) === normalizedSlot);
      if (matching && typeof matching.percentage === 'number' && matching.percentage > 0) {
        if (Math.abs(matching.percentage - newPercentage) <= 5) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[SQLite Anti-Glitch] Erro ao avaliar reboot glitch:', err.message);
  }
  return false;
}

// ============================================================================
// OPERAÇÕES: FILA DE REPOSIÇÕES (PERSISTIDAS NO BANCO)
// ============================================================================
export function getReplenishments() {
  const rows = getDb().prepare('SELECT * FROM replenishments ORDER BY updated_at DESC').all();
  return rows.map(r => ({
    id: r.id,
    printerId: r.printer_id,
    printerName: r.printer_name,
    location: r.location,
    supplyName: r.supply_name,
    supplyType: r.supply_type,
    percentage: r.percentage,
    orderStatus: r.order_status,
    modelPart: r.model_part,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function getReplenishmentById(id) {
  const r = getDb().prepare('SELECT * FROM replenishments WHERE id = ?').get(id);
  if (!r) return null;
  return {
    id: r.id,
    printerId: r.printer_id,
    printerName: r.printer_name,
    location: r.location,
    supplyName: r.supply_name,
    supplyType: r.supply_type,
    percentage: r.percentage,
    orderStatus: r.order_status,
    modelPart: r.model_part,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function saveReplenishment(item, { suppressSync = false } = {}) {
  const database = getDb();
  database.exec('SAVEPOINT save_replenishment_delivery');
  try {
    const result = saveReplenishmentRecord(item);
    if (!suppressSync && (process.env.APP_MODE || '').toLowerCase() === 'edge') {
      addToSyncOutbox('replenishment', result.id, result);
    }
    database.exec('RELEASE save_replenishment_delivery');
    return result;
  } catch (error) {
    database.exec('ROLLBACK TO save_replenishment_delivery');
    database.exec('RELEASE save_replenishment_delivery');
    throw error;
  }
}

function saveReplenishmentRecord(item) {
  const now = item.updatedAt || new Date().toISOString();
  const createdAt = item.createdAt || now;
  getDb().prepare(`
    INSERT INTO replenishments (id, printer_id, printer_name, location, supply_name, supply_type, percentage, order_status, model_part, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      printer_name = excluded.printer_name,
      location = excluded.location,
      supply_name = excluded.supply_name,
      supply_type = excluded.supply_type,
      percentage = excluded.percentage,
      order_status = excluded.order_status,
      model_part = excluded.model_part,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    item.id,
    item.printerId,
    item.printerName || 'Impressora',
    item.location || '',
    item.supplyName,
    item.supplyType || 'other',
    item.percentage ?? 0,
    item.orderStatus || 'pending',
    item.modelPart || '',
    item.notes || '',
    createdAt,
    now
  );
  return getReplenishmentById(item.id);
}

export function deleteReplenishment(id) {
  const res = getDb().prepare('DELETE FROM replenishments WHERE id = ?').run(id);
  return res.changes > 0;
}

// ============================================================================
// OPERAÇÕES: OUTBOX PERSISTENTE DE SINCRONIZAÇÃO EDGE/HUB
// ============================================================================
export function addToSyncOutbox(eventTypeOrEntityType, entityIdOrPayload, maybePayload) {
  let entityType = eventTypeOrEntityType;
  let entityId = '';
  let payload = {};

  if (maybePayload !== undefined) {
    entityId = entityIdOrPayload || '';
    payload = maybePayload || {};
  } else if (typeof entityIdOrPayload === 'object' && entityIdOrPayload !== null) {
    payload = entityIdOrPayload;
    entityId = payload.id || payload.printerId || '';
  } else {
    entityId = entityIdOrPayload || '';
    payload = {};
  }

  const id = `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO edge_sync_outbox (id, entity_type, entity_id, payload_json, status, retry_count, created_at)
    VALUES (?, ?, ?, ?, 'pending', 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload_json = excluded.payload_json
  `).run(id, String(entityType), String(entityId), JSON.stringify(payload), now);
  return id;
}

export function getPendingSyncOutbox(limit = 100, scope = null) {
  let scopeSql = '';
  const params = [];
  if (scope) {
    const ids = scope.printerIds || [];
    if (!ids.length) return [];
    scopeSql = ` AND json_extract(payload_json, '$.printerId') IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  const retrySql = scope?.readyOnly ? ` AND (last_attempt IS NULL OR datetime(last_attempt, '+' || min(3600, retry_count * 30) || ' seconds') <= datetime('now'))` : '';
  const rows = getDb().prepare(`
    SELECT * FROM edge_sync_outbox
    WHERE status != 'completed' ${scopeSql}${retrySql}
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).all(...params, limit);
  return rows.map(r => ({
    id: r.id,
    entityType: r.entity_type,
    eventType: r.entity_type,
    entityId: r.entity_id,
    payload: JSON.parse(r.payload_json || '{}'),
    status: r.status || 'pending',
    retryCount: r.retry_count,
    attempts: r.retry_count,
    lastAttempt: r.last_attempt,
    lastError: r.last_error,
    createdAt: r.created_at
  }));
}

export function markSyncOutboxItemsCompleted(idsOrId = []) {
  const ids = Array.isArray(idsOrId) ? idsOrId : [idsOrId];
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const info = getDb().prepare(`UPDATE edge_sync_outbox SET status = 'completed' WHERE id IN (${placeholders})`).run(...ids);
  return info.changes || 0;
}

export function recordSyncOutboxError(idsOrId = [], errorMsg = '') {
  const ids = Array.isArray(idsOrId) ? idsOrId : [idsOrId];
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');
  getDb().prepare(`
    UPDATE edge_sync_outbox
    SET retry_count = retry_count + 1, status = 'failed', last_attempt = ?, last_error = ?
    WHERE id IN (${placeholders})
  `).run(now, String(errorMsg || ''), ...ids);
}

// ============================================================================
// OPERAÇÕES: RECARGAS & REPOSIÇÕES AUDITÁVEIS
// ============================================================================
export function getRecharges(filterOptions = {}) {
  const { printerId, unitName, fullOnly, timeRange, q } = filterOptions;
  let sql = 'SELECT * FROM recharges WHERE 1=1';
  const params = [];

  if (printerId) {
    sql += ' AND printer_id = ?';
    params.push(printerId);
  }
  if (unitName) {
    sql += ' AND LOWER(unit_name) = LOWER(?)';
    params.push(unitName);
  }
  if (fullOnly === true || fullOnly === 'true') {
    sql += ' AND is_full_recharge = 1';
  }

  if (timeRange && timeRange !== 'all') {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timeRange === 'today') {
      sql += ' AND timestamp >= ?';
      params.push(today.toISOString());
    } else if (timeRange === '7days') {
      const cut7 = new Date(now - 7 * 86400000).toISOString();
      sql += ' AND timestamp >= ?';
      params.push(cut7);
    } else if (timeRange === '30days') {
      const cut30 = new Date(now - 30 * 86400000).toISOString();
      sql += ' AND timestamp >= ?';
      params.push(cut30);
    } else if (timeRange === 'month') {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      sql += ' AND timestamp >= ?';
      params.push(monthStart);
    }
  }

  if (q) {
    sql += ' AND (LOWER(printer_name) LIKE ? OR LOWER(location) LIKE ? OR LOWER(supply_name) LIKE ? OR LOWER(unit_name) LIKE ? OR LOWER(ip) LIKE ? OR LOWER(technician) LIKE ?)';
    const searchParam = `%${q.toLowerCase().trim()}%`;
    params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
  }

  sql += ' ORDER BY timestamp DESC';
  const rows = getDb().prepare(sql).all(...params);

  return rows.map(r => ({
    id: r.id,
    printerId: r.printer_id,
    printerName: r.printer_name,
    ip: r.ip,
    unitName: r.unit_name,
    location: r.location,
    supplyName: r.supply_name,
    supplyType: r.supply_type,
    previousLevel: r.previous_level,
    newLevel: r.new_level,
    pageCount: r.page_count,
    pagesSinceLastRecharge: r.pages_since_last_recharge,
    source: r.source,
    isFullRecharge: Boolean(r.is_full_recharge),
    statusTag: r.status_tag,
    technician: r.technician,
    notes: r.notes,
    verificationStatus: r.verification_status || (r.source === 'manual' ? 'reported_manual' : 'legacy_unverified'),
    evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null,
    timestamp: r.timestamp
  }));
}

export function normalizeSupplySlot(supplyName) {
  if (!supplyName || typeof supplyName !== 'string') return '';
  // Remove serial number suffix like ';SN...', ';sn...', ' [SN...]' or ' (SN...)'
  let clean = supplyName.split(/;sn/i)[0].trim();
  clean = clean.replace(/\[\s*sn[^\]]+\]/i, '').trim();
  return clean.toLowerCase().replace(/\s+/g, ' ');
}

export function extractSupplySerial(supplyName) {
  if (!supplyName || typeof supplyName !== 'string') return null;
  const match = supplyName.match(/;SN([A-Za-z0-9]+)/i) ||
                supplyName.match(/\bSN[:=]?\s*([A-Za-z0-9]+)/i) ||
                supplyName.match(/\[SN[:=]?\s*([A-Za-z0-9]+)\]/i);
  return match ? match[1].trim() : null;
}

export function recordRecharge(event, { suppressSync = false } = {}) {
  const database = getDb();
  database.exec('SAVEPOINT register_recharge_delivery');
  try {
    const result = recordRechargeRecord(event);
    if (result && !suppressSync && (process.env.APP_MODE || '').toLowerCase() === 'edge') {
      addToSyncOutbox('recharge', result.id, result);
    }
    database.exec('RELEASE register_recharge_delivery');
    return result;
  } catch (error) {
    database.exec('ROLLBACK TO register_recharge_delivery');
    database.exec('RELEASE register_recharge_delivery');
    throw error;
  }
}

function recordRechargeRecord(event) {
  const db = getDb();
  const eventSlot = normalizeSupplySlot(event.supplyName);
  const eventSerial = extractSupplySerial(event.supplyName);
  const eventPages = Number.isSafeInteger(event.pageCount) && event.pageCount >= 0 ? event.pageCount : null;
  const newLevel = Number(event.newLevel);
  if (event.newLevel === null || event.newLevel === undefined || !Number.isFinite(newLevel) || newLevel < 0 || newLevel > 100) return null;
  const verificationStatus = event.source === 'manual' ? 'reported_manual' :
    (['verified_auto_high', 'detected_level_jump'].includes(event.verificationStatus) ? event.verificationStatus : 'legacy_unverified');

  // ---------------------------------------------------------------------------
  // MOTOR AUTÔNOMO DE VALIDAÇÃO PRÉ-INSERT (Hefesto Antifalhas)
  // ---------------------------------------------------------------------------
  // 1. Verificação de Duplicata Imediata (mesmo slot e mesmo contador de páginas)
  if (event.printerId && eventPages !== null) {
    const existing = db.prepare(`
      SELECT id, supply_name, timestamp FROM recharges
      WHERE printer_id = ? AND page_count = ?
      ORDER BY timestamp DESC
    `).all(event.printerId, eventPages);

    for (const dup of existing) {
      if (normalizeSupplySlot(dup.supply_name) === eventSlot) {
        console.warn(`[SQLite Anti-Duplicação] 🛑 Descartada recarga duplicada para ${event.printerName || event.printerId} (${event.supplyName}) no contador ${eventPages}. Já existe registro ${dup.id}.`);
        return null;
      }
    }
  }

  // 2. Verificação de Serial Idêntico (Chips RFID/CRUM):
  // Se o insumo reporta serial, uma reposição para 100% com serial idêntico ao ciclo anterior
  // sem impressão relevante (< 50 páginas) é um falso positivo de leitura.
  if (event.printerId && eventSerial && eventPages !== null) {
    const history = db.prepare(`
      SELECT id, supply_name, page_count, timestamp FROM recharges
      WHERE printer_id = ?
      ORDER BY timestamp DESC
    `).all(event.printerId);

    const lastForSlot = history.find(r => normalizeSupplySlot(r.supply_name) === eventSlot);
    if (lastForSlot) {
      const lastSerial = extractSupplySerial(lastForSlot.supply_name);
      if (lastSerial && lastSerial.toUpperCase() === eventSerial.toUpperCase()) {
        const pageDelta = eventPages - (lastForSlot.page_count || 0);
        if (pageDelta < 50) {
          console.warn(`[SQLite Anti-Glitch] 🛑 Descartada recarga com serial idêntico ao ciclo anterior (${event.printerName || event.printerId} - ${event.supplyName}). Serial: ${eventSerial} | Delta de páginas: ${pageDelta} (< 50).`);
          return null;
        }
      }
    }
  }

  // 3. Verificação de Plausibilidade de Ciclo:
  // Se novo nível >= 90%, mas delta de páginas é insignificante (< 30) em relação à última recarga cheia deste slot sem mudança de serial
  if (event.printerId && newLevel >= 90 && eventPages !== null) {
    const history = db.prepare(`
      SELECT id, supply_name, page_count, new_level, timestamp FROM recharges
      WHERE printer_id = ?
      ORDER BY timestamp DESC
    `).all(event.printerId);

    const lastFullSlot = history.find(r => normalizeSupplySlot(r.supply_name) === eventSlot && r.new_level >= 90);
    if (lastFullSlot) {
      const lastSerial = extractSupplySerial(lastFullSlot.supply_name);
      const hasDifferentSerial = Boolean(eventSerial && lastSerial && eventSerial.toUpperCase() !== lastSerial.toUpperCase());
      const pageDelta = eventPages - (lastFullSlot.page_count || 0);
      if (!hasDifferentSerial && pageDelta < 30 && pageDelta >= 0) {
        console.warn(`[SQLite Anti-Glitch] 🛑 Descartada recarga sem impressão plausível (${event.printerName || event.printerId} - ${event.supplyName}): apenas ${pageDelta} páginas desde a recarga anterior.`);
        return null;
      }
    }
  }

  const id = event.id || `rec-${Math.random().toString(36).substring(2, 10)}`;
  const now = event.timestamp || new Date().toISOString();
  const isFull = event.isFullRecharge !== undefined ? (event.isFullRecharge ? 1 : 0) : ((newLevel >= 95) ? 1 : 0);

  // Calcula paginas desde a ultima recarga do mesmo slot.
  let pagesCycle = event.pagesSinceLastRecharge || 0;
  if (!pagesCycle && eventPages && event.printerId) {
    const history = db.prepare(`
      SELECT supply_name, page_count FROM recharges
      WHERE printer_id = ? AND page_count > 0
      ORDER BY timestamp DESC
    `).all(event.printerId);
    const lastForSlot = history.find(r => normalizeSupplySlot(r.supply_name) === eventSlot);
    if (lastForSlot && eventPages >= lastForSlot.page_count) {
      pagesCycle = eventPages - lastForSlot.page_count;
    }
  }

  db.prepare(`
    INSERT INTO recharges (id, printer_id, printer_name, ip, unit_name, location, supply_name, supply_type, previous_level, new_level, page_count, pages_since_last_recharge, source, is_full_recharge, status_tag, technician, notes, timestamp, verification_status, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    event.printerId,
    event.printerName || '',
    event.ip || '',
    event.unitName || '',
    event.location || '',
    event.supplyName,
    event.supplyType || 'toner',
    event.previousLevel ?? null,
    newLevel,
    eventPages,
    pagesCycle,
    event.source || 'auto',
    isFull,
    event.statusTag || (isFull ? 'Recarga Oficial (Nova)' : 'Troca Provisória / Parcial'),
    event.technician || (event.source === 'auto' ? 'Sensor Automático SNMP' : 'Técnico'),
    event.notes || '',
    now,
    verificationStatus,
    event.evidence ? JSON.stringify(event.evidence) : null
  );

  const result = {
    ...event,
    id,
    pageCount: eventPages,
    verificationStatus,
    isFullRecharge: Boolean(isFull),
    pagesSinceLastRecharge: pagesCycle,
    timestamp: now
  };

  return result;
}

export function deleteRecharge(id) {
  const res = getDb().prepare('DELETE FROM recharges WHERE id = ?').run(id);
  return res.changes > 0;
}

export function cleanSpuriousRecharges(targetDb = getDb()) {
  const db = targetDb;
  const allRecharges = db.prepare('SELECT * FROM recharges ORDER BY printer_id ASC, timestamp ASC').all();
  const deletedIds = [];
  const details = [];

  // Agrupa por impressora e slot de suprimento normalizado
  const byPrinterAndSlot = new Map();
  for (const r of allRecharges) {
    const slot = normalizeSupplySlot(r.supply_name);
    const key = `${r.printer_id}:::${slot}`;
    if (!byPrinterAndSlot.has(key)) byPrinterAndSlot.set(key, []);
    byPrinterAndSlot.get(key).push(r);
  }

  for (const [key, records] of byPrinterAndSlot.entries()) {
    for (let i = 0; i < records.length; i++) {
      const current = records[i];
      if (deletedIds.includes(current.id)) continue;

      const currentSerial = extractSupplySerial(current.supply_name);

      for (let j = i + 1; j < records.length; j++) {
        const next = records[j];
        if (deletedIds.includes(next.id)) continue;

        const nextSerial = extractSupplySerial(next.supply_name);
        const pageDelta = (next.page_count || 0) - (current.page_count || 0);
        const timeDiffMs = Math.abs(new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime());

        // Caso 1: Mesma contagem de páginas e mesmo nível -> duplicata exata
        if (next.page_count === current.page_count && next.new_level === current.new_level && next.page_count > 0) {
          deletedIds.push(next.id);
          details.push(`Duplicata exata removida: ${next.id} (${next.printer_name} - ${next.supply_name}, páginas: ${next.page_count})`);
          continue;
        }

        // Caso 2: Serial idêntico com menos de 50 páginas rodadas -> falso positivo de leitura
        if (currentSerial && nextSerial && currentSerial.toUpperCase() === nextSerial.toUpperCase() && pageDelta < 50) {
          deletedIds.push(next.id);
          details.push(`Falso positivo removido (serial idêntico ${currentSerial} com delta de ${pageDelta} páginas): ${next.id} (${next.printer_name} - ${next.supply_name})`);
          continue;
        }

        // Caso 3: Inserção múltipla em intervalo curto (< 10 minutos) com delta zero de páginas
        if (timeDiffMs < 600000 && pageDelta === 0) {
          deletedIds.push(next.id);
          details.push(`Duplicata temporal (< 10min) removida: ${next.id} (${next.printer_name} - ${next.supply_name})`);
          continue;
        }
      }
    }
  }

  // Executa as exclusões no SQLite dentro de uma transação atômica
  if (deletedIds.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM recharges WHERE id = ?');
    db.exec('BEGIN');
    try {
      for (const id of deletedIds) {
        deleteStmt.run(id);
      }
      db.exec('COMMIT');
      console.log(`\x1b[32m%s\x1b[0m`, `[SQLite Saneamento] 🧹 Limpeza concluída: ${deletedIds.length} registros espúrios/duplicados removidos.`);
      for (const d of details) {
        console.log(`  - ${d}`);
      }
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('[SQLite Saneamento] Erro ao remover registros:', err);
    }
  } else {
    console.log('\x1b[32m%s\x1b[0m', '[SQLite Saneamento] 🛡️ Base de recargas auditada: 100% íntegra, nenhum registro espúrio encontrado.');
  }

  return {
    deletedCount: deletedIds.length,
    deletedIds,
    details
  };
}

export function sanitizeRechargeEncodings(targetDb = getDb()) {
  const db = targetDb;
  try {
    const rows = db.prepare(`
      SELECT id, location, printer_name, supply_name
      FROM recharges
      WHERE location LIKE '%\uFFFD%'
         OR printer_name LIKE '%\uFFFD%'
         OR location LIKE '%Consult%rio%'
         OR printer_name LIKE '%Consult%rio%'
    `).all();

    for (const r of rows) {
      const fixedLocation = (r.location || '')
        .replaceAll('\uFFFD', 'ó')
        .replace(/Consultrio/gi, 'Consultório')
        .replace(/Consult\?rio/gi, 'Consultório');
      const fixedPrinterName = (r.printer_name || '')
        .replaceAll('\uFFFD', 'ó')
        .replace(/Consultrio/gi, 'Consultório')
        .replace(/Consult\?rio/gi, 'Consultório');

      if (fixedLocation !== r.location || fixedPrinterName !== r.printer_name) {
        db.prepare('UPDATE recharges SET location = ?, printer_name = ? WHERE id = ?').run(fixedLocation, fixedPrinterName, r.id);
        console.log(`[SQLite Saneamento] 📝 Ortografia corrigida para recarga ${r.id}: "${fixedLocation}"`);
      }
    }
  } catch (err) {
    console.warn('[SQLite Saneamento] Aviso ao sanitizar codificação de recargas:', err.message);
  }
}

export function getRechargesSummary() {
  const printers = getPrinters();
  const summary = {};
  for (const p of printers) {
    summary[p.id] = {
      printerId: p.id,
      lastRecharge: null,
      lastFullRecharge: null,
      totalRecharges: 0
    };
  }

  const allRecharges = getDb().prepare('SELECT * FROM recharges ORDER BY timestamp ASC').all();
  for (const r of allRecharges) {
    const pid = r.printer_id;
    if (!summary[pid]) {
      summary[pid] = { printerId: pid, lastRecharge: null, lastFullRecharge: null, totalRecharges: 0 };
    }
    const item = {
      id: r.id,
      printerId: r.printer_id,
      printerName: r.printer_name,
      supplyName: r.supply_name,
      supplyType: r.supply_type,
      previousLevel: r.previous_level,
      newLevel: r.new_level,
      pageCount: r.page_count,
      pagesSinceLastRecharge: r.pages_since_last_recharge,
      source: r.source,
      isFullRecharge: Boolean(r.is_full_recharge),
      statusTag: r.status_tag,
      technician: r.technician,
      notes: r.notes,
      verificationStatus: r.verification_status || (r.source === 'manual' ? 'reported_manual' : 'legacy_unverified'),
      evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null,
      timestamp: r.timestamp
    };
    summary[pid].lastRecharge = item;
    if (item.isFullRecharge) {
      summary[pid].lastFullRecharge = item;
    }
    summary[pid].totalRecharges++;
  }

  return summary;
}

export function getRecentRechargeEvents(limit = 10) {
  const rows = getDb().prepare(`
    SELECT * FROM recharges
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);

  return rows.map(r => ({
    id: r.id,
    printerId: r.printer_id,
    printerName: r.printer_name,
    ip: r.ip,
    unitName: r.unit_name,
    location: r.location,
    supplyName: r.supply_name,
    previousLevel: r.previous_level,
    newLevel: r.new_level,
    isFullRecharge: Boolean(r.is_full_recharge),
    technician: r.technician,
    verificationStatus: r.verification_status || (r.source === 'manual' ? 'reported_manual' : 'legacy_unverified'),
    evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null,
    timestamp: r.timestamp
  }));
}

// ============================================================================
// OPERAÇÕES: CONTADORES DE PÁGINAS & TELEMETRIA DIÁRIA
// ============================================================================
export function recordPageCount(printerId, pageCount, supplies = [], { observedAt = new Date().toISOString(), source = 'device_poll' } = {}) {
  if (!printerId || !Number.isSafeInteger(pageCount) || pageCount < 0) return;
  const printer = getPrinterById(printerId);
  if (!printer || !printer.isActive) return;
  const instant = new Date(observedAt);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('invalid observation timestamp');
  const today = getBusinessDateKey(instant);
  const now = instant.toISOString();
  const database = getDb();
  database.exec('SAVEPOINT record_page_evidence');
  try {
    const last = database.prepare("SELECT * FROM printer_counter_observations WHERE printer_id=? AND status != 'out_of_order' ORDER BY observed_at DESC, id DESC LIMIT 1").get(printerId);
    if (last && now === last.observed_at && pageCount === last.page_count) { database.exec('RELEASE record_page_evidence'); return; }
    // Retain rejected samples too, so resets and late delivery can be inspected.
    const status = last && now < last.observed_at ? 'out_of_order' :
      (last && pageCount < last.page_count ? 'counter_regression' : 'accepted');
    database.prepare('INSERT INTO printer_counter_observations(printer_id,date,page_count,observed_at,status,source) VALUES(?,?,?,?,?,?)')
      .run(printerId, today, pageCount, now, status, source);
    if (status !== 'out_of_order') {
      if (printer.initialPageCount === null) updatePrinterInitialPageCount(printerId, pageCount);
      if (status === 'accepted') recordAllocationCount(database, printer, pageCount, now);
      database.prepare(`
        INSERT INTO page_history (printer_id, date, start_page_count, end_page_count, supplies_json, last_updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(printer_id, date) DO UPDATE SET
          end_page_count = COALESCE(MAX(page_history.end_page_count, excluded.end_page_count), excluded.end_page_count),
          supplies_json = excluded.supplies_json,
          last_updated_at = excluded.last_updated_at
      `).run(printerId, today, pageCount, pageCount, JSON.stringify(supplies || []), now);
    }
    database.exec('RELEASE record_page_evidence');
  } catch (error) {
    database.exec('ROLLBACK TO record_page_evidence'); database.exec('RELEASE record_page_evidence'); throw error;
  }
}

export function getDailyPrintEvidence(printerId, date = getBusinessDateKey()) {
  const database = getDb();
  const first = database.prepare("SELECT page_count,observed_at FROM printer_counter_observations WHERE printer_id=? AND date=? AND status != 'out_of_order' ORDER BY observed_at, id LIMIT 1").get(printerId, date);
  const stats = database.prepare(`SELECT COUNT(*) AS samples, MAX(page_count) AS end_counter,
    MAX(observed_at) AS last_at, MAX(status='counter_regression') AS regression
    FROM printer_counter_observations WHERE printer_id=? AND date=? AND status != 'out_of_order'`).get(printerId, date);
  const legacy = !first && database.prepare('SELECT id FROM page_history WHERE printer_id=? AND date=?').get(printerId, date);
  const regression = Boolean(stats.regression);
  const quality = regression ? 'counter_regression' : stats.samples >= 2 ? 'observed' :
    stats.samples === 1 ? 'awaiting_second_reading' : legacy ? 'legacy_unverified' : 'unavailable';
  return { printerId, date, quality, pages: quality === 'observed' ? stats.end_counter - first.page_count : null,
    startCounter: first?.page_count ?? null, endCounter: stats.end_counter,
    firstReadingAt: first?.observed_at ?? null, lastReadingAt: stats.last_at,
    readingCount: stats.samples, hasRegression: regression, coverage: 'since_first_reading',
    description: quality === 'observed' ? 'Diferença do contador físico entre as leituras exibidas; impressões anteriores à primeira leitura não estão incluídas.' :
      quality === 'counter_regression' ? 'O contador diminuiu. A produção deste dia exige revisão.' :
      quality === 'legacy_unverified' ? 'Histórico anterior sem sequência de leituras auditáveis.' : 'Aguardando duas leituras válidas do contador físico.' };
}

export function getPrinterPrintAudit(printerId, date = getBusinessDateKey()) {
  const readings = getDb().prepare('SELECT * FROM printer_counter_observations WHERE printer_id=? AND date=? ORDER BY observed_at DESC, id DESC LIMIT 500').all(printerId, date);
  return { summary: getDailyPrintEvidence(printerId, date), readings: readings.map(r => ({
    id: r.id, pageCount: r.page_count, observedAt: r.observed_at, status: r.status, source: r.source
  })), limit: 500 };
}

export function getAllPageHistory() {
  const rows = getDb().prepare(`SELECT h.*, EXISTS(SELECT 1 FROM printer_counter_observations o WHERE o.printer_id=h.printer_id AND o.date=h.date AND o.status='counter_regression') AS has_counter_regression FROM page_history h ORDER BY date ASC`).all();
  return rows.map(r => ({
    printerId: r.printer_id,
    date: r.date,
    startPageCount: r.start_page_count,
    endPageCount: r.end_page_count,
    supplies: r.supplies_json ? JSON.parse(r.supplies_json) : [],
    lastUpdatedAt: r.last_updated_at,
    hasCounterRegression: Boolean(r.has_counter_regression)
  }));
}

export function getTodayPagesMap() {
  const today = getBusinessDateKey();
  const rows = getDb().prepare('SELECT printer_id FROM page_history WHERE date=?').all(today);
  return new Map(rows.map(r => [r.printer_id, getDailyPrintEvidence(r.printer_id, today).pages]));
}

export function getTodayPageSnapshot(printerId) {
  if (!printerId) return null;
  const today = getBusinessDateKey();
  return getDb().prepare(`
    SELECT * FROM page_history WHERE printer_id = ? AND date = ?
  `).get(printerId, today);
}

export function updatePrinterInitialPageCount(id, initialPageCount) {
  if (!id) return;
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE printers SET initial_page_count = ?, updated_at = ? WHERE id = ?
  `).run(Number(initialPageCount) || 0, now, id);
}

export function recordTelemetrySnapshot({ printerId, ip, name, unitName, pageCount, supplies }) {
  if (!printerId) return;
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO telemetry_snapshots (printer_id, ip, name, unit_name, page_count, supplies_json, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    printerId,
    ip || '',
    name || '',
    unitName || '',
    Number.isSafeInteger(pageCount) && pageCount >= 0 ? pageCount : null,
    JSON.stringify(supplies || []),
    now
  );
}

export function getTelemetryHistory(limit = 500) {
  const rows = getDb().prepare('SELECT * FROM telemetry_snapshots ORDER BY recorded_at DESC LIMIT ?').all(limit);
  return rows.map(r => ({
    printerId: r.printer_id,
    ip: r.ip,
    name: r.name,
    unitName: r.unit_name,
    pageCount: r.page_count,
    supplies: r.supplies_json ? JSON.parse(r.supplies_json) : [],
    recordedAt: r.recorded_at
  }));
}

export function getRecentSnapshotsForPrinter(printerId, limit = 5) {
  if (!printerId) return [];
  const rows = getDb().prepare(`
    SELECT id, page_count, supplies_json, recorded_at
    FROM telemetry_snapshots
    WHERE printer_id = ?
    ORDER BY recorded_at DESC
    LIMIT ?
  `).all(printerId, limit);
  return rows.map(r => ({
    pageCount: r.page_count,
    supplies: r.supplies_json ? JSON.parse(r.supplies_json) : [],
    recordedAt: r.recorded_at
  }));
}


// ============================================================================
// OPERAÇÕES: BACKUP AUTOMÁTICO ROTATIVO (ÚLTIMOS 7 DIAS)
// ============================================================================
export function runDailyBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `hefesto_backup_${timestamp}.db`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    // Usa VACUUM INTO nativo do SQLite (snapshot atômico sem pausar writes)
    const escapedPath = backupFilePath.replace(/'/g, "''");
    getDb().exec(`VACUUM INTO '${escapedPath}'`);
    console.log('\x1b[32m%s\x1b[0m', `[SQLite Backup] Snapshot gerado com sucesso: ${backupFileName}`);

    // Limpeza de backups com mais de 7 dias
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('hefesto_backup_') && f.endsWith('.db'))
      .sort();

    if (files.length > 7) {
      const toDelete = files.slice(0, files.length - 7);
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, f));
          console.log(`[SQLite Backup] Removido backup rotativo antigo: ${f}`);
        } catch {}
      }
    }
    return backupFilePath;
  } catch (err) {
    console.error('[SQLite Backup] Erro ao realizar backup diário:', err);
    return null;
  }
}

// ============================================================================
// OPERAÇÕES: EXPURGO AUTOMÁTICO DE TELEMETRIA (DATA RETENTION & PRUNING)
// Mantém teto fixo de armazenamento (< 200 MB), preservando permanentemente
// recharges e page_history.
// ============================================================================
export function pruneOldTelemetrySnapshots(daysToKeep = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    const db = getDb();
    const countBefore = db.prepare('SELECT COUNT(*) as total FROM telemetry_snapshots WHERE recorded_at < ?').get(cutoffIso);

    if (countBefore && countBefore.total > 0) {
      db.prepare('DELETE FROM telemetry_snapshots WHERE recorded_at < ?').run(cutoffIso);
      console.log('\x1b[32m%s\x1b[0m', `[Data Retention] 🧹 Expurgo concluído: ${countBefore.total} snapshots antigos (> ${daysToKeep} dias) removidos.`);
      db.exec('PRAGMA optimize');
    } else {
      console.log('\x1b[32m%s\x1b[0m', `[Data Retention] 🛡️ Base de telemetria enxuta: nenhum snapshot anterior a ${daysToKeep} dias encontrado.`);
    }

    return {
      deletedCount: countBefore ? countBefore.total : 0,
      daysToKeep,
      cutoffDate: cutoffIso
    };
  } catch (err) {
    console.error('[Data Retention] Erro ao realizar expurgo de telemetria:', err);
    return { error: err.message };
  }
}

export function getDatabaseStats() {
  try {
    const stats = fs.statSync(DB_PATH);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    const db = getDb();
    const totalPrinters = db.prepare('SELECT COUNT(*) as total FROM printers').get().total;
    const totalRecharges = db.prepare('SELECT COUNT(*) as total FROM recharges').get().total;
    const totalSnapshots = db.prepare('SELECT COUNT(*) as total FROM telemetry_snapshots').get().total;
    const totalPageHistory = db.prepare('SELECT COUNT(*) as total FROM page_history').get().total;
    const dateRange = db.prepare('SELECT MIN(recorded_at) as oldest, MAX(recorded_at) as newest FROM telemetry_snapshots').get();

    return {
      dbSizeBytes: stats.size,
      dbSizeMB: Number(sizeInMB),
      totalPrinters,
      totalRecharges,
      totalSnapshots,
      totalPageHistory,
      oldestSnapshot: dateRange?.oldest || null,
      newestSnapshot: dateRange?.newest || null
    };
  } catch (err) {
    return { error: err.message };
  }
}

export function executePrinterReplacement(options) {
  return replacePrinter(getDb(), options);
}

export function getPrinterLifecycleBundle(printerIds) {
  const ids = new Set(printerIds);
  const replacements = getPrinterReplacements().filter(r => ids.has(r.replaced_printer_id) && ids.has(r.new_printer_id));
  const allocations = getDb().prepare('SELECT * FROM printer_allocations').all().filter(a => ids.has(a.printer_id));
  const allocationIds = new Set(allocations.map(a => a.id));
  const allocationPageHistory = getDb().prepare('SELECT * FROM printer_allocation_page_history').all().filter(a => allocationIds.has(a.allocation_id));
  return { replacements, allocations, allocationPageHistory };
}

export function applyPrinterLifecycleSync({ printers = [], replacements = [], allocations = [], allocationPageHistory = [] }) {
  const database = getDb();
  database.exec('BEGIN IMMEDIATE');
  try {
    // Desativados primeiro: liberar o IP real antes de importar o sucessor.
    for (const printer of [...printers].sort((a, b) => Number(a.isActive !== false) - Number(b.isActive !== false))) {
      const storageIp = printer.isActive === false ? (printer.registryIp || `${printer.ip}#replaced_sync_${printer.id}`) : printer.ip;
      if (printer.unitId && !getUnitById(printer.unitId)) saveUnit({ id: printer.unitId, name: printer.unitName || printer.unitId });
      savePrinter({ ...printer, ip: storageIp }, { skipAllocations: true });
      if (typeof printer.isActive === 'boolean') {
        database.prepare('UPDATE printers SET is_active = ?, decommissioned_at = ?, archived_ip = ? WHERE id = ?')
          .run(printer.isActive ? 1 : 0, printer.decommissionedAt || null, printer.isActive ? null : printer.ip, printer.id);
      }
      if (printer.status) updateCachedStatus(printer.id, printer.status);
    }
    for (const [table, rows, conflict] of [
      ['printer_replacements', replacements, 'id'], ['printer_allocations', allocations, 'id'],
      ['printer_allocation_page_history', allocationPageHistory, 'allocation_id, date']
    ]) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      const ordered = table === 'printer_allocations'
        ? [...rows].sort((a, b) => Number(!a.ended_at) - Number(!b.ended_at)) : rows;
      for (const row of ordered) {
        if (table === 'printer_allocations' && !row.ended_at) {
          // Edge é a origem da alocação atual. Evidência já observada no Hub permanece fechada e identificada.
          const local = database.prepare('SELECT * FROM printer_allocations WHERE printer_id = ? AND ended_at IS NULL AND id != ?').get(row.printer_id, row.id);
          if (local) {
            const endedAt = local.started_at > row.started_at ? local.started_at : row.started_at;
            const localCounter = getCachedStatus(row.printer_id)?.info?.pageCount ?? null;
            database.prepare("UPDATE printer_allocations SET ended_at = ?, end_counter = ?, source = source || ':superseded_by_edge' WHERE id = ?")
              .run(endedAt, localCounter, local.id);
          }
        }
        const fields = columns.filter(c => row[c] !== undefined);
        if (!fields.length) continue;
        const updates = fields.filter(c => !conflict.split(', ').includes(c)).map(c => `${c} = excluded.${c}`).join(', ');
        database.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})
          ON CONFLICT(${conflict}) DO UPDATE SET ${updates}`)
          .run(...fields.map(c => row[c] ?? null));
      }
    }
    database.exec('COMMIT');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

export function getPrinterAllocations(printerId) {
  return getDb().prepare('SELECT * FROM printer_allocations WHERE printer_id = ? ORDER BY started_at, rowid').all(printerId);
}

export function getPrinterReplacements(printerId) {
  const database = getDb();
  const query = `
    SELECT r.*,
           p_old.name as replaced_printer_name, p_old.ip as replaced_printer_ip,
           p_new.name as new_printer_name, p_new.ip as new_printer_ip
    FROM printer_replacements r
    LEFT JOIN printers p_old ON r.replaced_printer_id = p_old.id
    LEFT JOIN printers p_new ON r.new_printer_id = p_new.id
    ${printerId ? 'WHERE r.replaced_printer_id = ? OR r.new_printer_id = ?' : ''}
    ORDER BY r.replaced_at DESC
  `;
  return printerId ? database.prepare(query).all(printerId, printerId) : database.prepare(query).all();
}

export function closeDatabase() {
  if (db) {
    try {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch {}
      db.close();
      console.log('[SQLite] Conexão com o banco de dados fechada com sucesso.');
    } catch (err) {
      console.error('[SQLite] Erro ao fechar banco de dados:', err.message);
    } finally {
      db = null;
    }
  }
}

// DIAG-001/002: all alert writes and history reads share the operational database.
export const recordDeviceAlertSnapshot = input => recordAlerts(getDb(), input);
export const getPrinterAlertReport = (id, options) => readAlerts(getDb(), id, options);
