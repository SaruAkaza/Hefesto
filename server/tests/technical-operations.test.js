import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { captureTechnicalSnapshot as capture, compareTechnicalSnapshots as compare, summarizeRecurrence, remotePanelSupport } from '../technical-diagnostics.js';
import { ensureTechnicalAuditSchema, startTechnicalIntervention as start, appendTechnicalEvent as append, getTechnicalIntervention, listTechnicalInterventions } from '../technical-audit-store.js';
import { ensureDeviceAlertSchema, recordDeviceAlertSnapshot, getPrinterAlertReport } from '../device-alert-store.js';
const now = Date.parse('2026-10-08T12:00:00Z');
const printer = {id:'p',name:'Printer',unitId:'u',ip:'192.0.2.10'};
const telemetry = {online:true,cachedAt:new Date(now-60000).toISOString(), info:{serialNumber:'ABCD12345',model:'Lexmark XM3250'},supplies:[{index:1,name:'Fusor',type:'fuser',percentage:0}]};
const a = {source:'prt_alert_table',code:'paper_jam',rawCode:8,message:'Jam',severity:'critical'};
const report = {diagnostic:{current:true,state:'error'},sources:{prt_alert_table:{available:true,complete:true}},alerts:[{...a,alertKey:'jam'}]};
const snapshot = () => capture({printer,cached:structuredClone(telemetry),report:structuredClone(report),now});
function fixture(t) { const db=new DatabaseSync(':memory:');ensureDeviceAlertSchema(db);ensureTechnicalAuditSchema(db);t.after(()=>db.close());return db; }
const input = {action:'replace_fuser',reason:'Troca preventiva',ticket:'INC-42',requestId:'start_12345'};
test('only a later fresh observation of the same asset can provide maintenance evidence',()=>{
 const before=snapshot(), after=snapshot(); const at=new Date(now).toISOString();
 assert.equal(compare(before,after,at).status,'waiting_for_reading');
 after.observedAt=new Date(now+60000).toISOString();after.alerts=[];after.supplies[0].level=100;
 const c=compare(before,after,at);assert.equal(c.status,'changed');assert.equal(c.changes.length,2);assert.equal(c.provesRepair,false);
 after.sources.prt_alert_table.complete=false;after.supplies[0].level=0;assert.equal(compare(before,after,at).status,'not_observable');
 after.identity.serialNumber='OTHER1234';assert.equal(compare(before,after,at).status,'identity_mismatch');
 after.identity={};assert.equal(compare(before,after,at).status,'not_observable');
 after.fresh=false;assert.equal(compare(before,after,at).reason,'missing_fresh_observation');
 after.fresh=true;assert.equal(compare(before,after,'invalid').reason,'invalid_observation_time');
});
test('old, offline, unknown and estimated supplies never manufacture maintenance evidence',()=>{
 for(const cached of [{...telemetry,cachedAt:new Date(now-3600000).toISOString()},{...telemetry,online:false}]) assert.equal(capture({printer,cached,report,now}).fresh,false);
 const data=structuredClone(telemetry);data.supplies=[{name:'Ink',percentage:null,estimated:true},{name:'Drum',percentage:-2}];
 const s=capture({printer,cached:data,report,now});assert.equal(s.supplies[0].observable,false);assert.equal(s.supplies[0].level,null);assert.equal(s.supplies[1].level,null);
 const before=snapshot(),after=snapshot();after.observedAt=new Date(now+60000).toISOString();after.supplies[0].level=0;
 assert.equal(compare(before,after,new Date(now).toISOString()).status,'unchanged');
});
test('audit is append-only, idempotent and attributable to the authenticated actor',t=>{
 const db=fixture(t);let r=start(db,{printer,snapshot:snapshot(),input,actor:'tech',now}).record;
 assert.equal(r.actor,'tech');assert.equal(r.equipmentCommandExecuted,false);
 assert.equal(start(db,{printer,snapshot:snapshot(),input,actor:'tech',now}).duplicate,true);
 assert.throws(()=>start(db,{printer,snapshot:snapshot(),input:{...input,reason:'Different'},actor:'tech',now}),/outra intervenção/);
 assert.throws(()=>append(db,{record:r,actor:'tech',request:{requestId:'verify_1234'},kind:'verification'}),/Declare/);
 const args={record:r,actor:'tech',request:{requestId:'outcome_123',result:'performed',note:'Trocado'},kind:'outcome',snapshot:snapshot(),comparison:{status:'waiting_for_reading'},now:now+1000};
 r=append(db,args).record;assert.equal(append(db,args).duplicate,true);
 assert.throws(()=>append(db,{...args,record:r,request:{requestId:'outcome_456',result:'failed'}}),/já possui/);
 for(const sql of ['UPDATE technical_interventions SET actor=\'forged\'','DELETE FROM technical_interventions','UPDATE technical_intervention_events SET actor=\'forged\'','DELETE FROM technical_intervention_events']) assert.throws(()=>db.exec(sql),/append-only/);
 assert.equal(listTechnicalInterventions(db,'p').total,1);assert.equal(getTechnicalIntervention(db,r.id).events.length,1);
 assert.equal(listTechnicalInterventions(db,'other').total,0);
});
test('recurrence counts episodes, preserves dates and reports temporal association without inferring cause',t=>{
 const db=fixture(t);const sync=(alerts,at)=>recordDeviceAlertSnapshot(db,{printerId:'p',telemetry:{online:true,alerts,alertSources:{prt_alert_table:{available:true,complete:true}}},observedAt:new Date(at).toISOString()});
 sync([a],now-3600000);const before=capture({printer,cached:telemetry,report:getPrinterAlertReport(db,'p'),now});
 let record=start(db,{printer,snapshot:before,input,actor:'tech',now:now-1800000}).record;
 append(db,{record,actor:'tech',request:{requestId:'done_12345',result:'performed'},kind:'outcome',snapshot:before,now:now-1200000});
 sync([],now-600000);sync([a],now);
 const g=summarizeRecurrence(db,'p',{now}).groups[0];assert.equal(g.occurrences,2);assert.equal(g.active,1);assert.equal(g.shortestReturnMs,600000);assert.equal(g.relatedInterventions,1);assert.equal(g.latestReturnAfterInterventionMs,1200000);
 assert.equal(summarizeRecurrence(db,'other',{now}).groups.length,0);
});
test('remote entry is read-only, strictly IPv4 and cannot claim physical certification',()=>{
 const remote=remotePanelSupport(printer,snapshot());assert.equal(remote.url,'http://192.0.2.10/');assert.equal(remote.operatorPanel,'documented_not_validated');assert.equal(remote.automaticActions,false);
 assert.equal(remotePanelSupport({...printer,ip:'host.invalid'},snapshot()).url,null);
 assert.equal(remotePanelSupport(printer,{...snapshot(),fresh:false}).available,false);
 assert.equal(remotePanelSupport(printer,{...snapshot(),identity:{model:'Epson M1180'}}).operatorPanel,'not_certified');
});
