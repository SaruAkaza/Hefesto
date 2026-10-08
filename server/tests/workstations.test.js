import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import { authMiddleware, createSession, clearAllSessions } from '../auth.js';
import {ensureWorkstationSchema,createPairing,enrollCollector,collectorForToken,ingestCollectorBatch,workstationReport,usbPrinterViews,createWorkstationRouter} from '../workstations.js';
const now=new Date('2026-10-06T04:00:00Z'),start=new Date('2026-10-05T23:00:00Z');
function fixture(t){const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE units(id TEXT PRIMARY KEY,name TEXT,region TEXT); INSERT INTO units VALUES('u','Unidade RJ','RJ'),('s','Unidade SP','SP'); CREATE TABLE printers(id TEXT PRIMARY KEY); INSERT INTO printers VALUES('existing');");ensureWorkstationSchema(db);t.after(()=>db.close());return db;}
function enroll(db){const pair=createPairing(db,{unitId:'u',sector:'Posto'},'admin',start);return enrollCollector(db,{code:pair.code,hostname:'PC-PILOTO',version:'0.1.0-pilot'},start);}
const batch=()=>({protocol:1,events:[{eventKey:'record-1',occurredAt:'2026-10-06T00:30:00Z',username:'DOMINIO\\usuario',clientHostname:'PC-PILOTO',printerName:'Epson M1180',port:'USB001',pages:3,jobId:'1',documentTitle:'MUST_NOT_BE_STORED'}],queues:[{key:'q',name:'Epson M1180',driver:'Epson M1180',connection:'usb',port:'USB001',deviceId:'USBPRINT\\M1180'}],health:{logEnabled:true,inventoryOk:true,backlog:0}});

test('pairing is single-use, expires, binds the registered unit and stores only credential hashes',t=>{
  const db=fixture(t),pair=createPairing(db,{unitId:'u'},'admin',start);
  const collector=enrollCollector(db,{code:pair.code,hostname:'PC',version:'test',unitId:'s'},start);
  assert.equal(collectorForToken(db,collector.token).unit_id,'u');
  assert.throws(()=>enrollCollector(db,{code:pair.code,hostname:'PC2',version:'test'},start),/já utilizado/);
  assert.notEqual(db.prepare('SELECT token_hash FROM workstation_collectors').get().token_hash,collector.token);
  const expired=createPairing(db,{unitId:'u'},'admin',start);assert.throws(()=>enrollCollector(db,{code:expired.code,hostname:'PC',version:'test'},now),/expirado/);
  assert.throws(()=>createPairing(db,{unitId:'invented'},'admin',start),/cadastrada/);
});

test('offline replay is idempotent; unknown pages and data-domain separation are preserved',t=>{
  const db=fixture(t),enrolled=enroll(db),collector=collectorForToken(db,enrolled.token),payload=batch();
  assert.deepEqual(ingestCollectorBatch(db,collector,payload,now),{accepted:1,inserted:1});
  assert.deepEqual(ingestCollectorBatch(db,collector,payload,now),{accepted:1,inserted:0});
  payload.events=[{...payload.events[0],eventKey:'record-2',pages:null}];ingestCollectorBatch(db,collector,payload,now);
  const report=workstationReport(db,{start:'2026-10-05',end:'2026-10-05'},now);
  assert.equal(report.totals.jobs,2);assert.equal(report.totals.pages,3);assert.equal(report.totals.unknownJobs,1);
  assert.equal(workstationReport(db,{start:'2026-10-06',end:'2026-10-06'},now).totals.jobs,0,'business day is Sao Paulo');
  assert.equal(workstationReport(db,{start:'2026-10-05',end:'2026-10-05',unitId:'s'},now).totals.jobs,0);
  assert.equal(workstationReport(db,{start:'2026-10-05',end:'2026-10-05',printerName:'Outra'},now).totals.jobs,0);
  assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM workstation_print_events').all()),/MUST_NOT_BE_STORED/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM printers').get().n,1);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='printing_cost_tariffs'").get(),undefined);
});

test('invalid batches cannot partially write events or erase the existing printer inventory',t=>{
  const db=fixture(t),collector=collectorForToken(db,enroll(db).token);ingestCollectorBatch(db,collector,batch(),now);
  const bad=batch();bad.events.push({...bad.events[0],eventKey:'bad',pages:-1});bad.queues=[];
  assert.throws(()=>ingestCollectorBatch(db,collector,bad,now),/páginas inválida/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workstation_print_events').get().n,1);
  assert.equal(db.prepare('SELECT active FROM workstation_queues').get().active,1);
  assert.throws(()=>ingestCollectorBatch(db,collector,{...batch(),events:[null]},now),/Evento inválido/);
  assert.throws(()=>workstationReport(db,{start:'2026-02-30',end:'2026-03-01'},now));
});

test('USB projection joins the main list without inventing an IP, ink percentage or hardware count',t=>{
  const db=fixture(t),collector=collectorForToken(db,enroll(db).token);ingestCollectorBatch(db,collector,batch(),now);
  const [{printer,status}]=usbPrinterViews(db,now);
  assert.equal(printer.connectionType,'usb');assert.equal(printer.ip,null);assert.equal(printer.hostname,'PC-PILOTO');assert.equal(printer.unitId,'u');
  assert.equal(status.online,null);assert.equal(status.collectorOnline,true);assert.equal(status.info.pageCount,null);assert.deepEqual(status.supplies,[]);assert.equal(printer.billingIncluded,false);
  assert.equal(usbPrinterViews(db,new Date(now.getTime()+600000))[0].status.collectorOnline,false);
  db.prepare('UPDATE workstation_collectors SET revoked_at=?').run(now.toISOString());assert.equal(usbPrinterViews(db,now)[0].status.collectorOnline,false);
});

test('HTTP restricts setup, installer and reports to administrators; collector tokens only ingest',async t=>{
  const db=fixture(t),app=express();app.use(express.json());app.use(authMiddleware);app.use('/api/workstations',createWorkstationRouter(()=>db,{installerPath:'/missing-installer.exe'}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));clearAllSessions();});
  const url='http://127.0.0.1:'+server.address().port+'/api/workstations/';
  const admin=createSession({username:'admin',role:'admin'}).token,operator=createSession({username:'op',role:'operator'}).token;
  const call=(path,token,body)=>fetch(url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  for(const path of ['config','report','installer','pairings']){const body=path==='pairings'?{unitId:'u'}:undefined;assert.equal((await call(path,null,body)).status,401);assert.equal((await call(path,operator,body)).status,403);}
  const pair=await(await call('pairings',admin,{unitId:'u'})).json();
  const enrollment=await call('enroll',null,{code:pair.code,hostname:'PC-PILOT',version:'test'});assert.equal(enrollment.status,201);const agent=await enrollment.json();
  assert.equal((await call('config',agent.token)).status,401);
  assert.equal((await call('batches',admin,{protocol:1,events:[]})).status,401);
  assert.equal((await call('batches',agent.token,{protocol:1,events:[],queues:[]})).status,200);
  const config=await(await call('config',admin)).json();assert.equal(config.collectors.length,1);assert.equal(config.installerAvailable,false);assert.doesNotMatch(JSON.stringify(config),/token_hash|protectedToken/);
  assert.equal((await call('collectors/'+agent.id+'/revoke',admin,{})).status,200);
  assert.equal((await call('batches',agent.token,{protocol:1,events:[]})).status,401);
});

test('Windows executable retains an unacknowledged batch and replays it without duplicate prints',{skip:process.platform!=='win32'},async t=>{
  const executable=fileURLToPath(new URL('../../deployment/collector/HefestoColetor-Setup.exe',import.meta.url));
  try{await fs.access(executable);}catch{t.skip('Execute node scripts/build-collector.mjs antes do teste Windows.');return;}
  const db=fixture(t),app=express();app.use(express.json());let drop=true;
  app.use('/api/workstations/batches',(req,res,next)=>{if(drop){drop=false;res.json=()=>res.status(503).send('Simulated lost acknowledgement');}next();});
  app.use('/api/workstations',createWorkstationRouter(()=>db));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'hefesto-collector-test-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});});
  const pairing=createPairing(db,{unitId:'u'},'test'),input=path.join(temp,'input.json'),output=path.join(temp,'result.json');
  await fs.writeFile(input,JSON.stringify({server:'http://127.0.0.1:'+server.address().port,code:pairing.code}));
  try{await promisify(execFile)(executable,['--transport-test',input,output],{timeout:30000});}catch(error){throw new Error('Coletor: '+await fs.readFile(output,'utf8').catch(()=>error.message));}
  const result=JSON.parse(await fs.readFile(output,'utf8'));assert.equal(result.success,true);assert.equal(result.unacknowledgedBatchRetained,true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workstation_print_events').get().n,1);assert.equal(db.prepare('SELECT pages FROM workstation_print_events').get().pages,2);
});
