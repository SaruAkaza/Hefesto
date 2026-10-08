import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { createDashboardSnapshot } from '../dashboard-snapshot.js';

async function endpoint(t,read,options){
  const app=express();app.get('/',createDashboardSnapshot(read,options));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  return since=>fetch('http://127.0.0.1:'+server.address().port+'/'+(since?'?since='+encodeURIComponent(since):''));
}
function readings(){return {units:[{id:'u'}],printers:[{id:'a'},{id:'b'}],statuses:[{id:'a',pagesToday:2},{id:'b',pagesToday:null}],health:[{printerId:'a',health:{state:'ok'}}],healthOverview:{counts:{ok:1}},rechargesSummary:{},collectionAt:'2026-10-06T13:00:00Z'};}
test('snapshot sends only changed readings, handles removal and recovers after an expired revision',async t=>{
  const data=readings(),call=await endpoint(t,()=>data,{historyLimit:2});
  const first=await(await call()).json();assert.equal(first.full,true);assert.equal(first.statuses.length,2);
  const unchanged=await call(first.revision);assert.equal(unchanged.status,204);assert.equal(await unchanged.text(),'');
  data.statuses[0]={id:'a',pagesToday:7};
  const delta=await(await call(first.revision)).json();assert.equal(delta.full,false);assert.deepEqual(delta.statuses,[{id:'a',pagesToday:7}]);assert.equal(delta.printers,undefined);assert.equal(delta.units,undefined);
  data.statuses.pop();data.printers.pop();
  const removed=await(await call(delta.revision)).json();assert.deepEqual(removed.removedIds,['b']);assert.deepEqual(removed.printers,[{id:'a'}]);
  const recovered=await(await call(first.revision)).json();assert.equal(recovered.full,true);assert.equal(recovered.statuses.length,1);
});
test('failed snapshot retains the last revision and does not invent replacement readings',async t=>{
  let fail=false;const data=readings(),call=await endpoint(t,()=>{if(fail)throw Error('synthetic');return data;});
  const first=await(await call()).json();fail=true;assert.equal((await call(first.revision)).status,500);fail=false;
  assert.equal((await call(first.revision)).status,204);
});

const source=readFileSync(new URL('../../public/js/dashboard-refresh.js',import.meta.url),'utf8');
function browser(t){
  const w=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}}),timers=new Map();let id=0;
  w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};w.clearTimeout=n=>timers.delete(n);
  Object.defineProperty(w.document,'hidden',{configurable:true,value:false});w.eval(source);
  t.after(()=>{w.DashboardRefresh.stop();w.close();});
  const state={printers:[],units:[],statusData:new Map(),healthData:new Map(),isRefreshing:false,activeUnitFilter:'u',searchQuery:'PC',collapsedFloors:new Set(['Andar'])};
  let renders=0,stamps=0,loggedIn=true,failures=0;
  const config={state,canRefresh:()=>loggedIn,request:async()=>({ok:true,status:200,json:async()=>({full:true,revision:'r1',statuses:[{id:'a',pagesToday:7}],health:[],printers:[{id:'a'}],units:[]})}),render:()=>renders++,timestamp:()=>stamps++,failed:()=>failures++};
  return {w,timers,state,config,get renders(){return renders;},get stamps(){return stamps;},get failures(){return failures;},logout(){loggedIn=false;}};
}
test('silent refresh changes counts, preserves filters, sends revisions and updates details without device collection',async t=>{
  const f=browser(t),calls=[];let details=0;
  f.w.WorkstationModule={refreshDetail:()=>details++};
  f.config.request=async(url)=>{calls.push(url);return calls.length===1?{ok:true,status:200,json:async()=>({full:true,revision:'r1',statuses:[{id:'a',pagesToday:7}],health:[]})}:{ok:true,status:204};};
  f.w.DashboardRefresh.start(f.config);assert.ok([...f.timers.values()].some(x=>x.delay===15000));
  await f.w.DashboardRefresh.refresh();await f.w.DashboardRefresh.refresh();
  assert.equal(f.state.statusData.get('a').pagesToday,7);assert.equal(f.state.activeUnitFilter,'u');assert.equal(f.state.searchQuery,'PC');assert.equal(f.state.collapsedFloors.has('Andar'),true);
  assert.match(calls[1],/since=r1/);assert.doesNotMatch(calls.join(),/force|status\/all/);assert.equal(f.renders,1);assert.equal(f.stamps,2);assert.equal(details,2);
});
test('hidden and logged-out pages pause refresh; return to the page checks immediately',async t=>{
  const f=browser(t);let calls=0;f.config.request=async()=>{calls++;return{ok:true,status:204};};f.w.DashboardRefresh.start(f.config);
  Object.defineProperty(f.w.document,'hidden',{configurable:true,value:true});f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));await f.w.DashboardRefresh.refresh();assert.equal(calls,0);assert.equal(f.timers.size,0);
  Object.defineProperty(f.w.document,'hidden',{configurable:true,value:false});f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));await new Promise(r=>setImmediate(r));assert.equal(calls,1);
  f.logout();await f.w.DashboardRefresh.refresh();assert.equal(calls,1);
});
test('slow requests cannot overlap; reset discards late responses and failures preserve existing data',async t=>{
  const f=browser(t);let finish,calls=0,signal;f.state.statusData.set('old',{id:'old',pagesToday:3});
  f.config.request=async(url,opts)=>{calls++;signal=opts.signal;return new Promise(r=>finish=r);};f.w.DashboardRefresh.start(f.config);
  const pending=f.w.DashboardRefresh.refresh();await f.w.DashboardRefresh.refresh();assert.equal(calls,1);
  f.w.DashboardRefresh.reset();assert.equal(signal.aborted,true);finish({ok:true,status:200,json:async()=>({full:true,revision:'late',statuses:[],health:[]})});await pending;assert.equal(f.state.statusData.get('old').pagesToday,3);assert.equal(f.renders,0);
  f.config.request=async()=>{throw Error('network');};await f.w.DashboardRefresh.refresh();assert.equal(f.failures,1);assert.equal(f.state.statusData.get('old').pagesToday,3);
});
test('DOM reconciliation preserves row identity, focused buttons, expanded history and scroll position',t=>{
  const f=browser(t);f.w.document.body.innerHTML='<div id="content"><table><tbody><tr data-live-key="a"><td>2</td><td><button>A</button></td></tr><tr data-live-key="b"><td>3</td><td><button>B</button></td></tr></tbody></table><details open><summary>Histórico</summary><p>Antigo</p></details></div>';
  const root=f.w.document.getElementById('content'),row=root.querySelector('tr'),button=row.querySelector('button');button.focus();root.scrollTop=80;
  f.w.DashboardRefresh.patch(root,'<table><tbody><tr data-live-key="a"><td>7</td><td><button>A</button></td></tr><tr data-live-key="b"><td>3</td><td><button>B</button></td></tr></tbody></table><details><summary>Histórico</summary><p>Novo</p></details>');
  assert.equal(root.querySelector('tr'),row);assert.equal(row.querySelector('button'),button);assert.equal(f.w.document.activeElement,button);assert.equal(root.querySelector('details').open,true);assert.equal(root.scrollTop,80);assert.match(root.textContent,/7/);
  f.w.DashboardRefresh.patch(root,'<table><tbody><tr data-live-key="b"><td>3</td></tr><tr data-live-key="a"><td>8</td><td><button>A</button></td></tr></tbody></table>');
  assert.equal(root.querySelectorAll('tr')[1],row);assert.equal(root.querySelector('details'),null);
});

test('real dashboard endpoint serves missing cache immediately without network probes or telemetry writes',async t=>{
  const db=await import('../db.js');db.initDatabase({inMemory:true,skipSeeds:true,skipCleanups:true});
  db.savePrinter({id:'unread',name:'Synthetic unread printer',ip:'192.0.2.45'});
  const {app}=await import('../server.js');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.closeDatabase();});
  const url='http://127.0.0.1:'+server.address().port+'/api/dashboard/snapshot';
  const response=await fetch(url,{signal:AbortSignal.timeout(1500)});assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.statuses[0].online,null);assert.equal(data.statuses[0].cachedAt,null);assert.equal(data.statuses[0].pagesToday,null);assert.equal(data.health[0].health.state,'stale');
  assert.equal(db.getDb().prepare('SELECT COUNT(*) AS n FROM printer_counter_observations').get().n,0);
  assert.equal((await fetch(url+'?since='+encodeURIComponent(data.revision))).status,204);
});

test('Hermes background history preserves the selected period, expanded records and failed-read values',async t=>{
  const f=browser(t);f.w.eval(readFileSync(new URL('../../public/js/workstations.js',import.meta.url),'utf8'));
  const container=f.w.document.createElement('div');f.w.document.body.append(container);const calls=[];let pages=7,fail=false;
  f.w.apiFetch=async url=>{calls.push(url);if(fail)throw Error('synthetic failure');return{ok:true,json:async()=>({totals:{jobs:2,pages,unknownJobs:0},groups:[{username:'LOGIN',jobs:2,pages}],events:[{occurredAt:'2026-10-06T12:00:00Z',username:'LOGIN',pages}]})};};
  const printer={id:'usb:1',name:'M1180',hostname:'PC-TESTE',collectorId:'collector',port:'USB001'};
  await f.w.WorkstationModule.renderDetail(printer,{},container,true);
  const form=container.querySelector('form'),history=container.querySelector('details'),output=container.querySelector('[data-usb-report]');
  form.elements.start.value='2026-10-06';form.elements.end.value='2026-10-06';history.open=true;container.scrollTop=120;pages=10;
  await f.w.WorkstationModule.refreshDetail(new Map([['usb:1',{cachedAt:'2026-10-06T13:00:00Z'}]]));
  assert.match(calls.at(-1),/start=2026-10-06/);assert.equal(form.elements.start.value,'2026-10-06');assert.equal(container.querySelector('details'),history);assert.equal(history.open,true);assert.equal(container.scrollTop,120);assert.match(output.textContent,/10 páginas/);
  fail=true;await f.w.WorkstationModule.refreshDetail(new Map());assert.match(output.textContent,/10 páginas/);assert.equal(history.open,true);
  f.w.WorkstationModule.closeDetail();await f.w.WorkstationModule.refreshDetail(new Map());assert.equal(calls.length,3);
});
test('closing Hermes details discards an outstanding history response',async t=>{
  const f=browser(t);f.w.eval(readFileSync(new URL('../../public/js/workstations.js',import.meta.url),'utf8'));
  const container=f.w.document.createElement('div');f.w.document.body.append(container);let finish;
  f.w.apiFetch=async()=>new Promise(r=>finish=r);
  const pending=f.w.WorkstationModule.renderDetail({id:'usb:1',name:'M1180',hostname:'PC',collectorId:'collector'}, {},container,true);
  f.w.WorkstationModule.closeDetail();finish({ok:true,json:async()=>({totals:{jobs:99,pages:99,unknownJobs:0},groups:[],events:[]})});await pending;
  assert.doesNotMatch(container.textContent,/99 trabalhos/);
});

test('collection timestamp describes the selected unit rather than a newer reading in another unit',t=>{
  const f=browser(t),app=readFileSync(new URL('../../public/js/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  f.w.AppState={units:[],printers:[{id:'a',unitId:'u'},{id:'b',unitId:'s'}],activeUnitFilter:'u',activeRegionFilter:'all',statusData:new Map([['a',{cachedAt:'2026-10-06T12:00:00Z'}],['b',{cachedAt:'2026-10-06T13:00:00Z'}]])};
  f.w.DOM={lastUpdatedText:f.w.document.createElement('span')};
  for(const name of ['getScopedPrinters','updateLastUpdatedTimestamp'])f.w.eval(app.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n}\\n'))[0]);
  f.w.updateLastUpdatedTimestamp();assert.ok(f.w.DOM.lastUpdatedText.title.includes(new Date('2026-10-06T12:00:00Z').toLocaleString('pt-BR')));
});
