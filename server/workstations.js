import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAdmin } from './auth.js';
import { getBusinessDateKey, getInclusiveDateSpanDays } from './date-utils.js';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const installer = fileURLToPath(new URL('../deployment/collector/HefestoColetor-Setup.exe', import.meta.url));
const fault = (message, status = 400) => Object.assign(new Error(message), { status });
function text(value, max, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw fault('Campo obrigatório ausente.');
    return null;
  }
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw fault('Texto inválido.');
  return value;
}
export function ensureWorkstationSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS workstation_pairings (
    code_hash TEXT PRIMARY KEY, unit_id TEXT NOT NULL, sector TEXT, created_by TEXT NOT NULL,
    expires_at TEXT NOT NULL, used_at TEXT);
  CREATE TABLE IF NOT EXISTS workstation_collectors (
    id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, hostname TEXT NOT NULL, unit_id TEXT NOT NULL,
    sector TEXT, version TEXT NOT NULL, created_at TEXT NOT NULL, last_seen TEXT, revoked_at TEXT,
    health_json TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE IF NOT EXISTS workstation_queues (
    collector_id TEXT NOT NULL REFERENCES workstation_collectors(id), queue_key TEXT NOT NULL,
    name TEXT NOT NULL, driver TEXT, port TEXT, connection TEXT NOT NULL, device_id TEXT,
    observed_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(collector_id, queue_key));
  CREATE TABLE IF NOT EXISTS workstation_print_events (
    collector_id TEXT NOT NULL REFERENCES workstation_collectors(id), event_key TEXT NOT NULL,
    occurred_at TEXT NOT NULL, business_date TEXT NOT NULL, username TEXT, client_hostname TEXT,
    printer_name TEXT NOT NULL, port TEXT, pages INTEGER, job_id TEXT, received_at TEXT NOT NULL,
    PRIMARY KEY(collector_id, event_key));
  CREATE INDEX IF NOT EXISTS idx_workstation_events_date ON workstation_print_events(business_date, collector_id);`);
}

export function createPairing(db, input, actor, now = new Date()) {
  const unitId = text(input.unitId, 100, true), sector = text(input.sector, 150);
  if (!db.prepare('SELECT id FROM units WHERE id=?').get(unitId)) throw fault('Selecione uma unidade cadastrada.');
  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(now.getTime() + 30 * 60000).toISOString();
  db.prepare('DELETE FROM workstation_pairings WHERE expires_at < ?').run(now.toISOString());
  db.prepare('INSERT INTO workstation_pairings(code_hash,unit_id,sector,created_by,expires_at) VALUES(?,?,?,?,?)')
    .run(sha(code), unitId, sector, actor, expiresAt);
  return { code, expiresAt };
}

export function enrollCollector(db, input, now = new Date()) {
  const code = text(input.code, 64, true), hostname = text(input.hostname, 255, true), version = text(input.version, 30, true);
  const token = crypto.randomBytes(32).toString('hex'), id = crypto.randomUUID(), timestamp = now.toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const pairing = db.prepare('SELECT * FROM workstation_pairings WHERE code_hash=? AND used_at IS NULL AND expires_at>?').get(sha(code), timestamp);
    if (!pairing) throw fault('Código inválido, expirado ou já utilizado.', 401);
    if (!db.prepare('SELECT id FROM units WHERE id=?').get(pairing.unit_id)) throw fault('A unidade não está mais cadastrada.');
    db.prepare('INSERT INTO workstation_collectors(id,token_hash,hostname,unit_id,sector,version,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id, sha(token), hostname, pairing.unit_id, pairing.sector, version, timestamp);
    db.prepare('UPDATE workstation_pairings SET used_at=? WHERE code_hash=?').run(timestamp, sha(code));
    db.exec('COMMIT');
    return { id, token, enrolledAt: timestamp, protocol: 1 };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function collectorForToken(db, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT * FROM workstation_collectors WHERE token_hash=? AND revoked_at IS NULL').get(sha(token));
}

export function ingestCollectorBatch(db, collector, input, now = new Date()) {
  if (input.protocol !== 1) throw fault('Versão de protocolo inválida.');
  if (!Array.isArray(input.events) || input.events.length > 250) throw fault('Lote de eventos inválido.');
  if (input.queues !== undefined && input.queues !== null && (!Array.isArray(input.queues) || input.queues.length > 200)) throw fault('Inventário inválido.');
  const events = input.events.map(e => {
    if (!e || typeof e !== 'object') throw fault('Evento inválido.');
    const occurredAt = text(e.occurredAt, 40, true), date = new Date(occurredAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 300000 || date.getTime() < Date.parse(collector.created_at) - 300000) throw fault('Data de evento fora do período de coleta.');
    if (e.pages !== null && e.pages !== undefined && (!Number.isSafeInteger(e.pages) || e.pages < 0 || e.pages > 1000000)) throw fault('Quantidade de páginas inválida.');
    return [collector.id, text(e.eventKey, 150, true), date.toISOString(), getBusinessDateKey(date), text(e.username, 255), text(e.clientHostname, 255),
      text(e.printerName, 255, true), text(e.port, 255), e.pages ?? null, text(e.jobId, 40), now.toISOString()];
  });
  const queues = input.queues?.map(q => {
    if (!q || typeof q !== 'object') throw fault('Fila inválida.');
    if (!['usb','tcpip','shared','virtual','other'].includes(q.connection)) throw fault('Tipo de conexão inválido.');
    return [collector.id, text(q.key, 128, true), text(q.name, 255, true), text(q.driver, 255), text(q.port, 255), q.connection, text(q.deviceId, 500), now.toISOString()];
  });
  const health = { logEnabled: input.health?.logEnabled === true, inventoryOk: input.health?.inventoryOk === true,
    backlog: Number.isInteger(input.health?.backlog) ? Math.max(0, Math.min(100000, input.health.backlog)) : null,
    warning: text(input.health?.warning, 500) };
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert = db.prepare('INSERT OR IGNORE INTO workstation_print_events VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    let inserted = 0;
    for (const event of events) inserted += Number(insert.run(...event).changes);
    if (queues) {
      db.prepare('UPDATE workstation_queues SET active=0 WHERE collector_id=?').run(collector.id);
      const upsert = db.prepare(`INSERT INTO workstation_queues(collector_id,queue_key,name,driver,port,connection,device_id,observed_at) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(collector_id,queue_key) DO UPDATE SET name=excluded.name,driver=excluded.driver,port=excluded.port,connection=excluded.connection,device_id=excluded.device_id,observed_at=excluded.observed_at,active=1`);
      for (const queue of queues) upsert.run(...queue);
    }
    db.prepare('UPDATE workstation_collectors SET last_seen=?,health_json=? WHERE id=?').run(now.toISOString(), JSON.stringify(health), collector.id);
    db.exec('COMMIT');
    return { accepted: events.length, inserted };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function workstationReport(db, query = {}, now = new Date()) {
  const today = getBusinessDateKey(now), start = query.start || today.slice(0,7)+'-01', end = query.end || today;
  if (getInclusiveDateSpanDays(start, end) > 366) throw fault('Consulte até 366 dias por vez.');
  const unitId = text(query.unitId,100), collectorId = text(query.collectorId,100);
  const conditions = ['e.business_date BETWEEN ? AND ?'], params = [start, end];
  if (unitId) { conditions.push('c.unit_id=?'); params.push(unitId); }
  if (collectorId) { conditions.push('c.id=?'); params.push(collectorId); }
  if (query.printerName) { conditions.push('e.printer_name=?'); params.push(text(query.printerName,255,true)); }
  const from = `FROM workstation_print_events e JOIN workstation_collectors c ON c.id=e.collector_id WHERE ${conditions.join(' AND ')}`;
  const totals = db.prepare(`SELECT COUNT(*) AS jobs, SUM(e.pages) AS pages, SUM(CASE WHEN e.pages IS NULL THEN 1 ELSE 0 END) AS unknownJobs ${from}`).get(...params);
  const groups = db.prepare(`SELECT c.id AS collectorId,c.hostname,c.unit_id AS unitId,c.sector,e.username,e.printer_name AS printerName,COUNT(*) AS jobs,SUM(e.pages) AS pages,SUM(CASE WHEN e.pages IS NULL THEN 1 ELSE 0 END) AS unknownJobs ${from}
    GROUP BY c.id,e.username,e.printer_name ORDER BY c.hostname,e.username,e.printer_name LIMIT 1001`).all(...params);
  const events = db.prepare(`SELECT e.occurred_at AS occurredAt,c.hostname,e.client_hostname AS clientHostname,e.username,e.printer_name AS printerName,e.port,e.pages ${from} ORDER BY e.occurred_at DESC LIMIT 100`).all(...params);
  return { start, end, totals, groups: groups.slice(0,1000), groupsTruncated: groups.length > 1000, events };
}

// Read-only presentation adapter: USB queues never enter the SNMP polling or billing inventory.
export function usbPrinterViews(db, now = new Date()) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='workstation_queues'").get()) return [];
  const rows=db.prepare(`SELECT q.*,c.hostname,c.unit_id,c.sector,c.last_seen,c.revoked_at,u.name AS unit_name,u.region
    FROM workstation_queues q JOIN workstation_collectors c ON c.id=q.collector_id LEFT JOIN units u ON u.id=c.unit_id
    WHERE q.connection='usb' AND q.active=1 ORDER BY c.hostname,q.name`).all();
  const counts=new Map(db.prepare(`SELECT collector_id,printer_name,SUM(pages) AS pages FROM workstation_print_events
    WHERE business_date=? GROUP BY collector_id,printer_name`).all(getBusinessDateKey(now)).map(r=>[JSON.stringify([r.collector_id,r.printer_name]),r.pages]));
  return rows.map(q=>{
    const id='usb:'+q.collector_id+':'+q.queue_key;
    const collectorOnline=!q.revoked_at && q.last_seen && now.getTime()-Date.parse(q.last_seen)<300000;
    const printer={id,name:q.name,ip:null,connectionType:'usb',collectorId:q.collector_id,hostname:q.hostname,
      unitId:q.unit_id,unitName:q.unit_name||'Sem unidade',region:q.region||'',location:q.sector||'',port:q.port,driver:q.driver,
      isActive:true,billingIncluded:false};
    const status={id,connectionType:'usb',online:null,collectorOnline:Boolean(collectorOnline),collectorRevoked:Boolean(q.revoked_at),cachedAt:q.last_seen,
      info:{model:q.driver||q.name,pageCount:null},supplies:[],pagesToday:null,reportedPagesToday:counts.get(JSON.stringify([q.collector_id,q.name]))??null};
    return {printer,status};
  });
}

export function createWorkstationRouter(getDatabase, { installerPath = installer } = {}) {
  const router = Router(), attempts = new Map();
  const database = () => { const db = getDatabase(); ensureWorkstationSchema(db); return db; };
  const wrap = fn => (req,res,next) => { try { fn(req,res); } catch (error) {
    if (error.status || error instanceof RangeError) return res.status(error.status || 400).json({ error: error.message });
    console.error('[Coletor] Falha interna:', error.code || error.name); res.status(500).json({error:'Não foi possível processar a coleta.'});
  }};
  router.post('/enroll', wrap((req,res) => {
    const now = Date.now(), key = req.ip;
    for (const [ip,r] of attempts) if (r.until < now) attempts.delete(ip);
    const record = attempts.get(key) || { count:0, until:now+600000 };
    if (++record.count > 15) throw fault('Muitas tentativas. Aguarde dez minutos.',429);
    attempts.set(key,record);
    const result = enrollCollector(database(),req.body || {}); attempts.delete(key); res.status(201).json(result);
  }));
  router.post('/batches', wrap((req,res) => {
    const db = database(), collector = collectorForToken(db,req.headers.authorization?.replace(/^Bearer /,''));
    if (!collector) throw fault('Coletor não autorizado ou revogado.',401);
    res.json(ingestCollectorBatch(db,collector,req.body || {}));
  }));
  router.use(requireAdmin);
  router.get('/config', wrap((req,res) => {
    const db = database();
    res.json({ units:db.prepare('SELECT id,name,region FROM units ORDER BY name').all(), installerAvailable:fs.existsSync(installerPath), version:'0.1.0-pilot',
      collectors:db.prepare('SELECT id,hostname,unit_id AS unitId,sector,version,created_at AS createdAt,last_seen AS lastSeen,revoked_at AS revokedAt,health_json AS health FROM workstation_collectors ORDER BY hostname').all().map(c=>({...c,health:JSON.parse(c.health)})),
      queues:db.prepare('SELECT collector_id AS collectorId,name,driver,port,connection,device_id AS deviceId,observed_at AS observedAt FROM workstation_queues WHERE active=1 ORDER BY collector_id,name').all() });
  }));
  router.post('/pairings', wrap((req,res) => res.status(201).json(createPairing(database(),req.body || {},req.user.username))));
  router.post('/collectors/:id/revoke', wrap((req,res) => {
    const result = database().prepare('UPDATE workstation_collectors SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(new Date().toISOString(),req.params.id);
    if (!result.changes) throw fault('Coletor não encontrado ou já revogado.',404);
    res.json({revoked:true});
  }));
  router.get('/report', wrap((req,res) => res.json(workstationReport(database(),req.query))));
  router.get('/installer', (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.download(installerPath,'HefestoColetor-Setup.exe',error=>{if(error && !res.headersSent)res.status(404).json({error:'Instalador ainda não disponível.'});});
  });
  router.use((req,res)=>res.status(404).json({error:'Recurso de coleta não encontrado.'}));
  return router;
}
