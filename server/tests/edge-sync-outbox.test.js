import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import * as db from '../db.js';
import * as edgeSync from '../edge-sync-service.js';

test('HFE-REV-005B: Outbox e Escopo de Filial no Edge', async (t) => {
  const originalAppMode = process.env.APP_MODE;
  const originalHubUrl = process.env.HUB_URL;
  const originalHubToken = process.env.HUB_TOKEN;
  const originalEdgeUnitName = process.env.EDGE_UNIT_NAME;
  const originalEdgeUnitId = process.env.EDGE_UNIT_ID;

  let testDb;
  let hubServer;
  let hubReceivedPayload = null;
  let hubHeaders = null;
  let hubStatusCode = 200;

  t.beforeEach(async () => {
    testDb = db.initDatabase(':memory:');
    hubReceivedPayload = null;
    hubHeaders = null;
    hubStatusCode = 200;

    // Inicia um mock HTTP server para o Hub
    await new Promise((resolve) => {
      hubServer = http.createServer((req, res) => {
        hubHeaders = req.headers;
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            hubReceivedPayload = body ? JSON.parse(body) : {};
          } catch {
            hubReceivedPayload = { raw: body };
          }
          res.writeHead(hubStatusCode, { 'Content-Type': 'application/json' });
          if (hubStatusCode === 200) {
            res.end(JSON.stringify({ success: true, message: 'OK', acknowledgedOutboxIds: hubReceivedPayload.outbox.map(item => item.id) }));
          } else {
            res.end(JSON.stringify({ error: 'Hub Error' }));
          }
        });
      });
      hubServer.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });
  });

  t.afterEach(async () => {
    if (hubServer) {
      await new Promise((resolve) => hubServer.close(resolve));
    }
    db.closeDatabase();
    process.env.APP_MODE = originalAppMode;
    process.env.HUB_URL = originalHubUrl;
    process.env.HUB_TOKEN = originalHubToken;
    process.env.EDGE_UNIT_NAME = originalEdgeUnitName;
    process.env.EDGE_UNIT_ID = originalEdgeUnitId;
  });

  await t.test('1. addToSyncOutbox enfileira itens e getPendingSyncOutbox recupera corretamente', () => {
    const outboxId = db.addToSyncOutbox('recharge_registered', {
      printerId: 'p-outbox-1',
      supplyName: 'Toner Black',
      newLevel: 100
    });

    assert.ok(outboxId, 'Deve retornar ID da outbox gerado');

    const pending = db.getPendingSyncOutbox();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, outboxId);
    assert.strictEqual(pending[0].eventType, 'recharge_registered');
    assert.strictEqual(pending[0].payload.supplyName, 'Toner Black');
    assert.strictEqual(pending[0].attempts, 0);
    assert.strictEqual(pending[0].status, 'pending');
  });

  await t.test('2. triggerEdgeSync transmite apenas dados da filial e limpa itens da outbox após sucesso (HTTP 200)', async () => {
    const port = hubServer.address().port;
    const hubUrl = `http://127.0.0.1:${port}`;
    const hubToken = 'secret-edge-token-123';

    // Cria unidades para satisfazer foreign keys
    db.saveUnit({ id: 'unit-btf', name: 'Unidade Botafogo' });
    db.saveUnit({ id: 'unit-ctr', name: 'Unidade Centro' });

    // Cria impressoras de diferentes filiais
    db.savePrinter({
      id: 'p-botafogo-1',
      name: 'HP Botafogo Recepcao',
      ip: '198.18.12.20',
      unitName: 'Unidade Botafogo',
      unitId: 'unit-btf'
    });
    db.savePrinter({
      id: 'p-centro-1',
      name: 'HP Centro Faturamento',
      ip: '198.18.23.30',
      unitName: 'Unidade Centro',
      unitId: 'unit-ctr'
    });

    // Registra recargas
    db.recordRecharge({
      printerId: 'p-botafogo-1',
      printerName: 'HP Botafogo Recepcao',
      ip: '198.18.12.20',
      unitName: 'Unidade Botafogo',
      supplyName: 'Toner Black',
      previousLevel: 10,
      newLevel: 100,
      pageCount: 5000,
      source: 'manual'
    });

    // Adiciona evento na outbox
    const outboxId = db.addToSyncOutbox('replenishment_created', {
      printerId: 'p-botafogo-1',
      modelPart: 'W1105A',
      percentage: 5
    });

    const syncResult = await edgeSync.triggerEdgeSync({
      hubUrl,
      hubToken,
      edgeUnitName: 'Unidade Botafogo',
      edgeUnitId: 'unit-btf'
    });

    assert.strictEqual(syncResult.success, true);
    assert.ok(hubReceivedPayload, 'Hub deve ter recebido o payload');
    assert.strictEqual(hubHeaders['x-edge-token'], hubToken);
    assert.strictEqual(hubReceivedPayload.edgeUnitName, 'Unidade Botafogo');

    // Verifica que apenas a impressora da filial Botafogo foi transmitida
    assert.strictEqual(hubReceivedPayload.printers.length, 1);
    assert.strictEqual(hubReceivedPayload.printers[0].id, 'p-botafogo-1');

    // Verifica que a recarga transmitida é de Botafogo
    assert.strictEqual(hubReceivedPayload.recharges.length, 1);
    assert.strictEqual(hubReceivedPayload.recharges[0].printerId, 'p-botafogo-1');

    // Verifica que o item da outbox foi transmitido no payload
    assert.strictEqual(hubReceivedPayload.outbox.length, 1);
    assert.strictEqual(hubReceivedPayload.outbox[0].id, outboxId);

    // Verifica que após o sucesso, o item da outbox foi marcado como completed (não está mais pendente)
    const remainingPending = db.getPendingSyncOutbox();
    assert.strictEqual(remainingPending.length, 0, 'Outbox não deve ter mais itens pendentes');
  });

  await t.test('3. triggerEdgeSync registra erro na outbox em caso de falha de conexão ou HTTP 500 sem perder o item', async () => {
    const port = hubServer.address().port;
    const hubUrl = `http://127.0.0.1:${port}`;
    const hubToken = 'secret-edge-token-123';
    hubStatusCode = 500; // Simula falha do servidor Hub

    db.savePrinter({
      id: 'p-botafogo-2',
      name: 'HP Botafogo Triagem',
      ip: '198.18.12.25',
      unitName: 'Unidade Botafogo'
    });

    const outboxId = db.addToSyncOutbox('alert_created', {
      printerId: 'p-botafogo-2',
      alert: 'Toner Low'
    });

    const syncResult = await edgeSync.triggerEdgeSync({
      hubUrl,
      hubToken,
      edgeUnitName: 'Unidade Botafogo'
    });

    assert.strictEqual(syncResult.success, false);

    // O item da outbox deve continuar pendente, mas com attempts incrementado e status 'failed'
    const pending = db.getPendingSyncOutbox();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, outboxId);
    assert.strictEqual(pending[0].attempts, 1);
    assert.strictEqual(pending[0].status, 'failed');
    assert.ok(pending[0].lastError.includes('Hub Error') || pending[0].lastError.includes('HTTP 500'));
  });
});
