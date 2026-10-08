import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../db.js';
import { savePrintingCostTariff, listPrintingCostTariffs, decimalToUnits } from '../printing-cost-store.js';
import { calculatePrintingCostReport, calculatePrintingCostMonthlyHistory, validateCostPeriod } from '../printing-cost-service.js';
import { getBusinessDateKey } from '../date-utils.js';
import { PRINTING_COST_CATALOG, referenceForModel } from '../printing-cost-catalog.js';
import { listPrintingPagePrices, savePrintingPagePrice, currentPrintingPagePriceOptions } from '../printing-cost-prices.js';

function fixture(t, model = 'Lexmark MX622') {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); createSchema(db);
  db.prepare('INSERT INTO units(id,name) VALUES(?,?)').run('u','Unidade Exemplo');
  db.prepare('INSERT INTO printers(id,name,ip,unit_id,unit_name,location) VALUES(?,?,?,?,?,?)').run('p','Impressora Exemplo','192.0.2.10','u','Unidade Exemplo','Laboratório');
  db.prepare('INSERT INTO printer_status_cache(printer_id,model) VALUES(?,?)').run('p',model);
  t.after(() => db.close()); return db;
}
const tariff = (extra = {}) => ({printerId:'p',model:'Modelo Exemplo',contract:'Contrato fictício',effectiveFrom:'2024-02-01',paperFormat:'A4',deviceType:'mono',billingRule:'single',pageRate:'0.0123',monthlyRent:'10.00',rentRule:'prorated',unitId:'u',location:'Laboratório',...extra});
function history(db,date,pages,{regression=false,samples=2}={}) {
  db.prepare('INSERT INTO page_history(printer_id,date,start_page_count,end_page_count,last_updated_at) VALUES(?,?,?,?,?)').run('p',date,1000,1000+pages,`${date}T20:00:00Z`);
  for(let i=0;i<samples;i++) db.prepare('INSERT INTO printer_counter_observations(printer_id,date,page_count,observed_at,status,source) VALUES(?,?,?,?,?,?)').run('p',date,i?1000+pages:1000,`${date}T${i?'20':'10'}:00:00Z`,regression&&i?'counter_regression':'accepted','synthetic');
}
const report=(db,start='2024-02-01',end=start,extra={}) => calculatePrintingCostReport(db,{start,end,...extra});

test('instalação nova não contém preços e consultas sem tarifa não inventam custo zero',t => {
  const db=fixture(t); history(db,'2024-02-01',1000);
  assert.deepEqual(listPrintingPagePrices(db),[]);
  assert.ok(currentPrintingPagePriceOptions([]).every(p=>p.currentRateUnits===null));
  const result=report(db);
  assert.equal(result.totals.pages,1000); assert.equal(result.totals.monoPages,1000);
  assert.equal(result.totals.unpricedPages,1000); assert.equal(result.totals.pageCostMaxCents,null);
  assert.equal(result.totals.rentCostMaxCents,null); assert.equal(result.totals.estimatedTotalMaxCents,null);
  assert.equal(listPrintingCostTariffs(db).length,0);
  assert.ok(result.segments[0].warningCodes.includes('missing_tariff'));
});
test('catálogo classifica modelos sem conter valores de contratos',() => {
  assert.ok(PRINTING_COST_CATALOG.every(c=>c.pageRate===null&&c.monthlyRent===null));
  for(const model of ['Lexmark MX622adhe','Brother HL-L6412DW','EPSON WF-M5799 Series','HL-L5212DN']) {
    assert.equal(referenceForModel(model).deviceType,'mono');
    assert.equal(referenceForModel(model).pageRateUnits,null);
  }
  assert.equal(referenceForModel('Lexmark CX725').deviceType,'color');
  assert.equal(referenceForModel('MX6220'),null);
});
test('primeiro preço no meio do mês mantém custo parcial sem apagar volume anterior sem preço',t=>{
  const db=fixture(t);history(db,'2024-02-01',1000);history(db,'2024-02-02',2000);
  listPrintingPagePrices(db);
  db.prepare('INSERT INTO printing_cost_page_prices(scope_key,effective_from,page_rate_units,created_by,created_at) VALUES(?,?,?,?,?)').run('mono','2024-02-02',123,'synthetic','2024-02-02T12:00:00Z');
  const result=report(db,'2024-02-01','2024-02-02');
  assert.equal(result.totals.pages,3000);assert.equal(result.totals.unpricedPages,1000);
  assert.equal(result.totals.pricedPages,2000);assert.equal(result.totals.pageCostMaxCents,2460);
  assert.equal(result.totals.incompleteSegments,1);
});
test('tarifa explícita calcula páginas e aluguel sem alterar leituras',t => {
  const db=fixture(t);
  for(let d=1;d<=29;d++) history(db,`2024-02-${String(d).padStart(2,'0')}`,d===1?1000:0);
  const before=JSON.stringify(db.prepare('SELECT * FROM page_history').all());
  savePrintingCostTariff(db,tariff(),'test-admin');
  const result=report(db,'2024-02-01','2024-02-29');
  assert.equal(result.totals.pageCostMaxCents,1230); assert.equal(result.totals.rentCostMaxCents,1000);
  assert.equal(result.totals.estimatedTotalMaxCents,2230); assert.equal(result.totals.incompleteSegments,0);
  assert.equal(report(db,'2024-02-01','2024-02-15').totals.rentCostMaxCents,Math.round(1000*15/29));
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM page_history').all()),before);
});
test('preço PB geral só passa a valer na vigência cadastrada',t => {
  const db=fixture(t),today=getBusinessDateKey();
  savePrintingCostTariff(db,tariff(),'test-admin'); history(db,'2024-02-01',1000); history(db,today,1000);
  assert.equal(report(db,today).totals.pageCostMaxCents,1230);
  savePrintingPagePrice(db,{scopeKey:'mono',effectiveFrom:today,pageRate:'0.0234'},'test-admin');
  assert.equal(report(db,today).totals.pageCostMaxCents,2340);
  assert.equal(report(db).totals.pageCostMaxCents,1230); assert.equal(listPrintingCostTariffs(db).length,1);
});
test('preços versionados validam valores e preservam o histórico',t => {
  const db=fixture(t),today=getBusinessDateKey();
  const future=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const p={scopeKey:'mono',effectiveFrom:today,pageRate:'0,0123'};
  savePrintingPagePrice(db,p,'admin-a'); savePrintingPagePrice(db,{...p,pageRate:'0.0234'},'admin-b');
  savePrintingPagePrice(db,{...p,effectiveFrom:future,pageRate:'0.0345'},'admin-future');
  assert.equal(currentPrintingPagePriceOptions(listPrintingPagePrices(db))[0].currentRateUnits,234);
  assert.deepEqual(listPrintingPagePrices(db).map(p=>p.created_by),['admin-a','admin-b','admin-future']);
  for(const extra of [{scopeKey:'invalid'},{effectiveFrom:'2024-01-01'},{effectiveFrom:'2026-02-30'},{pageRate:'-1'},{pageRate:'0.00001'},{pageRate:'1;DELETE'}]) assert.throws(()=>savePrintingPagePrice(db,{...p,...extra},'admin'));
  assert.equal(listPrintingPagePrices(db).length,3);
});
test('colorida sem preços permanece sem custo; faixa exige preço PB e colorido',t => {
  const db=fixture(t,'Lexmark CX522'),today=getBusinessDateKey(); history(db,today,1000);
  assert.equal(report(db,today).totals.pageCostMaxCents,null);
  savePrintingPagePrice(db,{scopeKey:'color:CX522',effectiveFrom:today,pageRate:'0.1234'},'admin');
  assert.equal(report(db,today).totals.pageCostMaxCents,null);
  savePrintingPagePrice(db,{scopeKey:'mono',effectiveFrom:today,pageRate:'0.0123'},'admin');
  const result=report(db,today);
  assert.equal(result.totals.pageCostMinCents,1230); assert.equal(result.totals.pageCostMaxCents,12340);
  assert.equal(result.totals.colorPages,null); assert.equal(result.totals.unclassifiedPages,1000);
  assert.equal(result.totals.rentCostMaxCents,null);
});
test('colorida com regra pendente calcula só aluguel; tarifa única exige confirmação',t => {
  const db=fixture(t,'Lexmark CX522');history(db,'2024-02-01',1000);
  assert.throws(()=>savePrintingCostTariff(db,tariff({deviceType:'color'}),'admin'),/Confirme/);
  savePrintingCostTariff(db,tariff({deviceType:'color',billingRule:'unresolved',rentRule:'full_month'}),'admin');
  assert.equal(report(db).totals.pageCostMaxCents,null);assert.equal(report(db).totals.rentCostMaxCents,1000);
  savePrintingCostTariff(db,tariff({effectiveFrom:'2024-02-02',deviceType:'color',confirmSingleRate:true,rentRule:'full_month'}),'admin');
  history(db,'2024-02-02',1000);assert.equal(report(db,'2024-02-02').totals.estimatedTotalMaxCents,2230);
});
test('regressões e dias com uma única leitura não geram custo de páginas',t => {
  const db=fixture(t);savePrintingCostTariff(db,tariff(),'admin');
  history(db,'2024-02-01',1000,{regression:true});history(db,'2024-02-02',1000,{samples:1});
  const result=report(db,'2024-02-01','2024-02-03');
  assert.equal(result.totals.pages,0);assert.equal(result.totals.pageCostMaxCents,null);
  assert.ok(result.segments[0].warningCodes.includes('counter_regression'));
  assert.ok(result.segments[0].warningCodes.includes('missing_readings'));
});
test('versões de tarifas preservam dados e apontam aluguel integral duplicado',t => {
  const db=fixture(t); db.prepare('INSERT INTO units(id,name) VALUES(?,?)').run('v','Outra Unidade');
  const old=savePrintingCostTariff(db,tariff({rentRule:'full_month'}),'admin-a');
  savePrintingCostTariff(db,tariff({effectiveFrom:'2024-02-02',pageRate:'0.0234',monthlyRent:'20',unitId:'v',location:'Recepção',rentRule:'full_month'}),'admin-b');
  history(db,'2024-02-01',1000);history(db,'2024-02-02',1000);
  const result=report(db,'2024-02-01','2024-02-02',{groupBy:'sector'});
  assert.equal(result.rows.length,2);assert.equal(result.totals.pageCostMaxCents,3570);
  assert.equal(result.totals.rentCostMaxCents,3000); assert.equal(result.totals.incompleteSegments,2);
  assert.deepEqual({...listPrintingCostTariffs(db)[0]},old);
  assert.throws(()=>savePrintingCostTariff(db,tariff(),'admin'),/posterior/);
});
test('histórico mensal separa vigências e valida períodos',t => {
  const db=fixture(t);savePrintingCostTariff(db,tariff({rentRule:'full_month'}),'admin');
  savePrintingCostTariff(db,tariff({effectiveFrom:'2024-03-01',pageRate:'0.0234',monthlyRent:'20',rentRule:'full_month'}),'admin');
  history(db,'2024-02-01',1000);history(db,'2024-03-01',2000);
  const result=calculatePrintingCostMonthlyHistory(db,{startMonth:'2024-02',endMonth:'2024-03',unitId:'u',sector:'Laboratório'});
  assert.equal(result.rows.length,2);assert.equal(result.rows.find(r=>r.month==='2024-02').estimatedTotalMaxCents,2230);
  assert.equal(result.rows.find(r=>r.month==='2024-03').estimatedTotalMaxCents,6680);
  for(const [startMonth,endMonth] of [['2024-13','2024-13'],['2024-03','2024-02'],['2099-01','2099-01'],['2023-01','2024-03']]) assert.throws(()=>calculatePrintingCostMonthlyHistory(db,{startMonth,endMonth}));
  assert.equal(decimalToUnits('0,0123',4),123);
  assert.throws(()=>validateCostPeriod('2024-02-30','2024-03-01'));
  assert.throws(()=>validateCostPeriod('2023-01-01','2024-02-01'),/366/);
});
