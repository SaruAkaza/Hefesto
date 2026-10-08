import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as db from '../db.js';
import {listPrintingPagePrices} from '../printing-cost-prices.js';
import {isSafeForDeployment} from '../package-exporter.js';

test('primeira instalação começa sem inventário, redes ou preços e preserva cadastro posterior',t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'hefesto-public-'));
  t.after(()=>{db.closeDatabase();rmSync(directory,{recursive:true,force:true});});
  const dbPath=path.join(directory,'test.db');
  db.closeDatabase();db.initDatabase({dbPath,skipSeeds:false});
  const database=db.getDb();
  for(const table of ['units','printers','corporate_subnets']) assert.equal(database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
  assert.deepEqual(listPrintingPagePrices(database),[]);
  db.saveUnit({id:'example',name:'Unidade Exemplo',region:'SP'});
  db.closeDatabase();db.initDatabase({dbPath,skipSeeds:false});
  assert.equal(db.getUnits()[0].name,'Unidade Exemplo');
  assert.equal(db.getDb().prepare('SELECT COUNT(*) AS n FROM corporate_subnets').get().n,0);
});
test('exportação rejeita qualquer dado local, incluindo configuração de marca e inventários',()=>{
  for(const name of ['units.json','printers.json','branding.json','custom-inventory.csv','observations.json']) assert.equal(isSafeForDeployment(`server/data/${name}`),false);
  assert.equal(isSafeForDeployment('server/data/branding.example.json'),true);
  const html=readFileSync(new URL('../../public/index.html',import.meta.url),'utf8');
  assert.match(html,/hefesto\.svg/);
});
