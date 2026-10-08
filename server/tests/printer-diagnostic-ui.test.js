import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
function browser(t){ const w=new Window({url:'http://192.0.2.1',settings:{enableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 w.document.write('<main id="body"><section id="device-alert-details"></section><div data-diagnostic-panel="supplies">SUPPLIES</div><div data-diagnostic-panel="history">RECHARGES</div></main>');
 for(const file of ['device-alerts-ui.js','printer-diagnostic-ui.js'])w.eval(readFileSync(new URL('../../public/js/'+file,import.meta.url),'utf8'));
 t.after(async()=>{await w.happyDOM.abort();w.close();});return w; }
const report=()=>({remote:{message:'Read-only',url:'http://192.0.2.10/'},actions:{inspection:'Inspeção'},audit:{records:[],total:0},recurrence:{days:90,groups:[]}});
const alerts=()=>({diagnostic:{state:'error'},alerts:[{message:'Current error'}],history:[{message:'Historic error'}],total:1});
const flush=()=>new Promise(r=>setTimeout(r,5));
test('Raio-X isolates tabs, supports keyboard and shares one cached alert request',async t=>{
 const w=browser(t),body=w.document.getElementById('body');let reads=0;
 w.PrinterDiagnosticUI.mount(body,'p',{getTechnicalReport:async()=>report(),getPrinterAlerts:async()=>{reads++;return alerts();}});await flush();
 const tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');assert.equal(tabs.length,3);assert.equal(reads,1);
 assert.equal(panels[0].hidden,false);assert.match(panels[1].textContent,/SUPPLIES/);assert.match(panels[2].textContent,/RECHARGES/);
 assert.doesNotMatch(panels[0].textContent,/Historic error/);assert.match(panels[2].textContent,/Historic error/);
 tabs[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(panels[2].hidden,false);assert.equal(tabs[2].getAttribute('aria-selected'),'true');
});
test('HTTP LAN without randomUUID can submit, preserve failure fields and retry idempotently',async t=>{
 const w=browser(t),body=w.document.getElementById('body');Object.defineProperty(w.crypto,'randomUUID',{value:undefined});let first=true,payloads=[];
 const api={getTechnicalReport:async()=>report(),getPrinterAlerts:async()=>alerts(),startTechnicalIntervention:async(id,input)=>{payloads.push(input);if(first){first=false;throw new Error('Falha no banco');}return {};}};
 w.PrinterDiagnosticUI.mount(body,'p',api,{canWrite:true});await flush();const form=body.querySelector('form'),reason=form.querySelector('textarea');reason.value='Teste';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.match(body.textContent,/Falha no banco/);assert.equal(reason.value,'Teste');assert.equal(form.querySelector('button').disabled,false);
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(payloads.length,2);assert.equal(payloads[0].requestId,payloads[1].requestId);assert.match(payloads[0].requestId,/^[a-zA-Z0-9_-]{8,100}$/);
});
test('closing or replacing a drawer prevents late technical responses from changing its contents',async t=>{
 const w=browser(t),body=w.document.getElementById('body');let finish;
 w.PrinterDiagnosticUI.mount(body,'p',{getTechnicalReport:()=>new Promise(r=>{finish=r;}),getPrinterAlerts:async()=>alerts()});await flush();
 w.PrinterDiagnosticUI.close(body);body.replaceChildren(w.document.createTextNode('USB Details'));finish(report());await flush();assert.equal(body.textContent,'USB Details');
});
test('verification reuses returned telemetry and does not issue an additional collection',async t=>{
 const w=browser(t),body=w.document.getElementById('body');let received,queries=0;
 const record={id:'i',actor:'tech',actionLabel:'Inspeção',startedAt:new Date().toISOString(),reason:'Test',before:{fresh:true},outcome:{result:'performed'},events:[]};
 const api={getTechnicalReport:async()=>({...report(),audit:{records:[record],total:1}}),getPrinterAlerts:async()=>alerts(),verifyTechnicalIntervention:async()=>{queries++;return {telemetry:{online:true}};}};
 w.PrinterDiagnosticUI.mount(body,'p',api,{canWrite:true,onTelemetry:async data=>{received=data;}});await flush();
 [...body.querySelectorAll('button')].find(b=>b.textContent==='Verificar nova leitura').click();await flush();assert.equal(queries,1);assert.equal(received.online,true);
});
test('real dashboard assigns consumables/history and never substitutes sector name for serial',async t=>{
 const w=browser(t);w.document.write(readFileSync(new URL('../../public/index.html',import.meta.url),'utf8'));
 w.eval(readFileSync(new URL('../../public/js/supply-semantics.js',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../../public/js/app.js',import.meta.url),'utf8');w.eval(source.slice(0,source.indexOf("document.addEventListener('DOMContentLoaded'"))+'\nwindow.state=AppState;window.api=API;');
 w.state.userRole='admin';w.state.printers=[{id:'p',name:'Sector',location:'Room',ip:'192.0.2.10'}];w.state.statusData.set('p',{online:true,cachedAt:new Date().toISOString(),info:{},supplies:[{name:'Black Toner',percentage:50}],trays:[{name:'Tray 1',percentage:-2}],status:{printerCode:3}});w.state.healthData.set('p',{state:'ok',lastCheckAt:new Date().toISOString()});
 w.api.getRecharges=async()=>[];w.api.getPrinterAlerts=async()=>alerts();w.api.getTechnicalReport=async()=>report();await w.eval("openPrinterDetailDrawer('p')");await flush();
 const body=w.document.getElementById('detail-modal-body'),panels=body.querySelectorAll('[role="tabpanel"]');assert.equal(panels.length,3);assert.match(panels[1].textContent,/Toner \/ Tinta Preta/);assert.match(panels[1].textContent,/Nível não observável/);assert.match(panels[2].textContent,/Trocas de Insumos/);
 const serial=[...body.querySelectorAll('.detail-chip')].find(c=>/Número de Série/.test(c.textContent));assert.ok(serial);assert.match(serial.textContent,/N\/D/);assert.doesNotMatch(serial.textContent,/Sector/);
});
