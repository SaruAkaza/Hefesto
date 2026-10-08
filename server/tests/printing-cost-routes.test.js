import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';
import { app } from '../server.js';
import { createSession, clearAllSessions } from '../auth.js';
import { getBusinessDateKey } from '../date-utils.js';

test('rotas montadas no servidor restringem todas as consultas e gravações ao administrador', async t => {
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  db.savePrinter({ id: 'printer', name: 'Lexmark MX622', ip: '198.18.8.1', unitName: 'Unidade A', location: 'Posto' });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); clearAllSessions(); db.closeDatabase(); });
  const url = `http://127.0.0.1:${server.address().port}/api/admin/printing-costs/`;
  const admin = createSession({ username: 'admin-audit', role: 'admin' });
  const operator = createSession({ username: 'operator', role: 'operator' });
  const call = (path, token, body) => fetch(url + path, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(3000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const path of ['config', 'report?start=2024-02-01&end=2024-02-29', 'history?startMonth=2024-02&endMonth=2024-03', 'tariffs', 'page-prices']) {
    const body = ['tariffs','page-prices'].includes(path) ? {} : undefined;
    assert.equal((await call(path, null, body)).status, 401); assert.equal((await call(path, operator.token, body)).status, 403);
  }
  assert.equal(db.getDb().prepare("SELECT name FROM sqlite_master WHERE name='printing_cost_tariffs'").get(), undefined, 'acesso bloqueado não cria tabelas');
  assert.equal(db.getDb().prepare("SELECT name FROM sqlite_master WHERE name='printing_cost_page_prices'").get(), undefined);
  const config = await (await call('config', admin.token)).json(); assert.equal(config.catalog.length, 26);
  assert.equal(config.pagePriceOptions.length,5); assert.equal(config.pagePriceOptions[0].currentRateUnits,null);
  const savedPrice = await call('page-prices',admin.token,{scopeKey:'mono',effectiveFrom:getBusinessDateKey(),pageRate:'0,06',createdBy:'forged'});
  assert.equal(savedPrice.status,201); assert.equal((await savedPrice.json()).created_by,'admin-audit');
  assert.equal((await call('page-prices',admin.token,{scopeKey:'forged',effectiveFrom:getBusinessDateKey(),pageRate:'0.05'})).status,400);
  const payload = { printerId: 'printer', contract: 'Contrato', model: 'MX622', effectiveFrom: '2024-02-01',
    paperFormat: 'A4', deviceType: 'mono', billingRule: 'single', pageRate: '0.05', monthlyRent: '250', rentRule: 'full_month', createdBy: 'forged' };
  const response = await call('tariffs', admin.token, payload); assert.equal(response.status, 201);
  assert.equal((await response.json()).created_by, 'admin-audit');
  assert.equal((await call('tariffs', admin.token, payload)).status, 400);
  assert.equal((await call('report?start=2024-02-01&end=2024-02-29', admin.token)).status, 200);
  assert.equal((await call('report?start=garbage&end=2024-02-29', admin.token)).status, 400);
  assert.equal((await call('history?startMonth=2024-02&endMonth=2024-03', admin.token)).status, 200);
  assert.equal((await call('history?startMonth=2024-13&endMonth=2024-03', admin.token)).status, 400);
  assert.equal(db.getPrinters().length, 1); assert.equal(db.getAllPageHistory().length, 0);
});
