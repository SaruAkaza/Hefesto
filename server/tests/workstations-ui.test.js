import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
const source=readFileSync(new URL('../../public/js/workstations.js',import.meta.url),'utf8');
function fixture(t){const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});window.eval(source);t.after(()=>window.close());return window;}
test('USB row shares the existing printer table and exposes hostname with safe text, no IP or SNMP actions',t=>{
  const w=fixture(t),printer={id:'usb:1',connectionType:'usb',name:'M1180 <img src=x>',hostname:'PC-TESTE',driver:'Epson M1180',unitName:'Unidade',region:'RJ',port:'USB001'};
  w.document.body.innerHTML='<table><tbody>'+w.WorkstationModule.renderRow(printer,{collectorOnline:true,reportedPagesToday:null},true,'USB',false)+'</tbody></table>';
  const row=w.document.querySelector('tr');assert.equal(row.children.length,7);assert.equal(row.querySelector('img'),null);assert.equal(row.querySelector('.usb-connection-badge').textContent,'USB');
  assert.match(row.textContent,/PC-TESTE/);assert.match(row.textContent,/Contador físico: —/);assert.match(row.textContent,/Coletor ativo/);assert.doesNotMatch(row.textContent,/0%|Aguardando IP/);
  assert.equal(row.querySelectorAll('button').length,1);assert.equal(row.querySelector('button').dataset.usbDetail,'usb:1');
});
test('USB details query user history only for administrators and scope it to this computer and printer',async t=>{
  const w=fixture(t),container=w.document.createElement('div');w.document.body.append(container);
  const calls=[];w.apiFetch=async url=>{calls.push(url);return{ok:true,json:async()=>({totals:{jobs:1,pages:2,unknownJobs:0},groups:[{username:'<b>login</b>',jobs:1,pages:2}],events:[]})};};
  const printer={id:'usb:1',name:'M1180',hostname:'PC',collectorId:'collector',port:'USB001'};
  await w.WorkstationModule.renderDetail(printer,{},container,false);assert.equal(calls.length,0);
  await w.WorkstationModule.renderDetail(printer,{},container,true);assert.equal(calls.length,1);assert.match(calls[0],/collectorId=collector/);assert.match(calls[0],/printerName=M1180/);
  assert.equal(container.querySelector('b'),null);assert.match(container.textContent,/<b>login<\/b>/);
});

test('main printer list searches USB by hostname, sorts without IP and keeps disconnected collectors visible',t=>{
  const w=fixture(t),app=readFileSync(new URL('../../public/js/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const names=['getPrinterHealth','isPrinterUnconfigured','getEffectiveHealthState','isHealthAttentionState','isHealthFailureState','isHealthConnectivityAvailable','setInventoryHtml','renderMyPrinters','renderGroupHeaderHtml','renderPrinterRowHtml'];
  w.document.body.innerHTML='<table><tbody id="printers"></tbody></table>';
  w.DOM={myPrintersListBody:w.document.getElementById('printers')};w.Icons={};w.escapeHtml=s=>String(s);w.parseFloorFromLocation=()=>null;w.getSortedFloors=x=>x;
  const printers=['PC-Z','PC-A'].map((hostname,i)=>({id:'usb:'+i,name:'M1180',connectionType:'usb',hostname,ip:null,location:'',unitId:'u',region:'RJ'}));
  w.AppState={printers,statusData:new Map(printers.map((p,i)=>[p.id,{collectorOnline:i===0}])),healthData:new Map(),userRole:'admin',searchQuery:'',locationFilter:'',activeFloorFilter:'',overviewFilter:'all',sortBy:'ip-asc',collapsedFloors:new Set()};
  for(const name of names){const match=app.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n}\\n'));assert.ok(match,name);w.eval(match[0]);}
  w.renderMyPrinters(printers);assert.equal(w.document.querySelectorAll('.usb-connection-badge').length,2);assert.match(w.document.body.textContent,/Coletor sem comunicação/);
  w.AppState.searchQuery='pc-a';w.renderMyPrinters(printers);assert.equal(w.document.querySelectorAll('.usb-connection-badge').length,1);assert.match(w.document.body.textContent,/PC-A/);
  w.AppState.searchQuery='usb';w.AppState.overviewFilter='online';w.renderMyPrinters(printers);assert.equal(w.document.querySelectorAll('.usb-connection-badge').length,1);assert.match(w.document.body.textContent,/PC-Z/);
});
