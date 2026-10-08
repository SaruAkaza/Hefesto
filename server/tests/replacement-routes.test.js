import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import * as db from '../db.js';
import { authMiddleware, createSession, clearAllSessions } from '../auth.js';
import { createPrinterReplacementRouter } from '../printer-replacement-routes.js';

test('router real protege histórico, consulta somente leitura e responsável da sessão', async () => {
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  db.savePrinter({ id: 'old', name: 'Epson', ip: '198.18.9.10', unitName: 'Unidade Exemplo' });
  const app = express(); app.use(express.json()); app.use(authMiddleware);
  let probes = 0;
  app.use('/api', createPrinterReplacementRouter({ db, queryPrinterStatus: async () => {
    probes++; return { online: true, info: { model: 'Lexmark', serialNumber: 'NEW123', pageCount: 500 }, supplies: [] };
  }, getPrinterMacAddress: async () => '00:11:22:33:44:66',
  onReplaced() { throw new Error('Falha simulada na notificação de cache após o commit'); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  const admin = createSession({ username: 'admin-real', role: 'admin' });
  const operator = createSession({ username: 'op', role: 'operator' });
  const call = (url, token, method = 'GET', body) => fetch(root + url, { method,
    signal: AbortSignal.timeout(2000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await call('/printer-replacements')).status, 401);
    assert.equal((await call('/printers/old/replacements', operator.token)).status, 200);
    assert.equal((await call('/printers/old/replacement-preview', operator.token, 'POST', { ip: '198.18.9.20' })).status, 403);
    assert.equal((await call('/printers/old/replacement-preview', admin.token, 'POST', { ip: 'garbage' })).status, 400);
    assert.equal(probes, 0);
    const preview = await call('/printers/old/replacement-preview', admin.token, 'POST', { ip: '198.18.9.20' });
    const data = await preview.json(); assert.equal(data.info.model, 'Lexmark');
    assert.equal(db.getPrinterReplacements().length, 0);
    assert.equal(db.getPrinterById('old').isActive, true);
    const replaced = await call('/printers/old/replace', admin.token, 'POST', {
      newPrinter: { name: 'Nova', ip: data.ip, model: data.info.model, serialNumber: data.info.serialNumber, macAddress: data.macAddress },
      reason: 'Troca', initialCounter: data.info.pageCount, confirmed: true, replacedBy: 'forged-user'
    });
    assert.equal(replaced.status, 201);
    assert.equal((await replaced.json()).success, true, 'falha de notificação não transforma commit em erro HTTP');
    assert.equal(db.getPrinterReplacements()[0].replaced_by, 'admin-real');
    const archives = await (await call('/printer-assets', admin.token)).json();
    assert.equal(archives.find(p => p.id === 'old').isActive, false);
    const history = await (await call('/printers/old/asset-history', admin.token)).json();
    assert.equal(history.printer.id, 'old'); assert.equal(history.replacements.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); clearAllSessions(); db.closeDatabase(); }
});
