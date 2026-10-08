import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDatabase,
  setDatabase,
  closeDatabase,
  savePrinter,
  getCachedStatus,
  updateCachedStatus,
  getPrinterStatusCache,
  savePrinterStatusCache,
  getPrinters,
  getUnits
} from '../db.js';
import { app } from '../server.js';

let testDb;

test.before(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
});

test.after(() => {
  closeDatabase();
});

test('Edge/Hub Contract - Status Cache preserves nested objects and aliases work', () => {
  const printerId = 'p-edge-cache-1';
  savePrinter({
    id: printerId,
    name: 'Lexmark MX711dhe',
    ip: '198.18.5.20',
    community: 'public'
  });

  const payload = {
    online: true,
    status: {
      code: 3,
      description: 'Ociosa / Pronta'
    },
    info: {
      pageCount: 54321,
      model: 'Lexmark MX711dhe',
      serialNumber: 'DEMO00000008'
    },
    supplies: [
      { name: 'Cartucho de Toner Preto', type: 'toner', percentage: 75, maxCapacity: 25000, currentLevel: 18750 },
      { name: 'Unidade de Imagem', type: 'imaging_kit', percentage: 40, maxCapacity: 100000, currentLevel: 40000 }
    ],
    trays: [
      { name: 'Bandeja 1', status: 'OK', level: 80 }
    ]
  };

  // 1. Save using updateCachedStatus
  updateCachedStatus(printerId, payload);

  // 2. Fetch using getCachedStatus
  const cached = getCachedStatus(printerId);
  assert.ok(cached);
  assert.equal(cached.online, true);
  assert.equal(cached.info.pageCount, 54321);
  assert.equal(cached.info.model, 'Lexmark MX711dhe');
  assert.equal(cached.info.serialNumber, 'DEMO00000008');
  assert.equal(cached.status.code, 3);
  assert.equal(cached.status.description, 'Ociosa / Pronta');
  assert.equal(cached.supplies.length, 2);
  assert.equal(cached.supplies[0].name, 'Cartucho de Toner Preto');
  assert.equal(cached.supplies[0].percentage, 75);
  assert.equal(cached.trays.length, 1);
  assert.equal(cached.trays[0].name, 'Bandeja 1');

  // 3. Aliases work identically
  const aliasCached = getPrinterStatusCache(printerId);
  assert.deepEqual(aliasCached, cached);

  savePrinterStatusCache(printerId, {
    ...payload,
    info: { ...payload.info, pageCount: 54400 }
  });
  assert.equal(getCachedStatus(printerId).info.pageCount, 54400);
});

test('Edge/Hub Contract - HTTP /api/edge/sync endpoint receives and persists branch telemetry', async () => {
  process.env.HUB_SYNC_SECRET = 'test-secret-token-123';

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthorized request without token
    const resNoAuth = await fetch(`${baseUrl}/api/edge/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edgeUnitName: 'Filial Niterói' })
    });
    assert.equal(resNoAuth.status, 401);

    // 2. Authorized request with matching token
    const syncPayload = {
      edgeUnitName: 'Filial Niterói',
      edgeUnitId: 'unit-niteroi',
      printers: [
        {
          id: 'p-niteroi-1',
          name: 'Brother Recepção Niterói',
          ip: '198.18.22.50',
          location: 'Recepção Principal',
          unitId: 'unit-niteroi',
          unitName: 'Filial Niterói',
          initialPageCount: 1200,
          status: {
            online: true,
            statusCode: 3,
            statusDescription: 'Operando',
            info: {
              pageCount: 15400,
              model: 'Brother HL-L6402DW',
              serialNumber: 'DEMO00000009'
            },
            supplies: [
              { name: 'Toner TN-3472', type: 'toner', percentage: 88 }
            ],
            trays: []
          }
        }
      ],
      recharges: [
        {
          id: 'rec-niteroi-1',
          printerId: 'p-niteroi-1',
          printerName: 'Brother Recepção Niterói',
          ip: '198.18.22.50',
          unitName: 'Filial Niterói',
          supplyName: 'Toner TN-3472',
          supplyType: 'toner',
          previousLevel: 5,
          newLevel: 100,
          pageCount: 15000,
          isFullRecharge: true,
          timestamp: new Date().toISOString()
        }
      ]
    };

    const resSync = await fetch(`${baseUrl}/api/edge/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-edge-token': 'test-secret-token-123'
      },
      body: JSON.stringify(syncPayload)
    });

    assert.equal(resSync.status, 200);
    const syncResult = await resSync.json();
    assert.equal(syncResult.success, true);
    assert.equal(syncResult.receivedPrinters, 1);
    assert.equal(syncResult.receivedRecharges, 1);

    // 3. Verify unit created on Hub
    const units = getUnits();
    const unitFound = units.find(u => u.name === 'Filial Niterói');
    assert.ok(unitFound, 'Branch unit should have been created on Hub');

    // 4. Verify printer persisted on Hub
    const printers = getPrinters();
    const printerFound = printers.find(p => p.id === 'p-niteroi-1');
    assert.ok(printerFound);
    assert.equal(printerFound.ip, '198.18.22.50');

    // 5. Verify status cache persisted on Hub with supplies intact
    const cachedStatus = getCachedStatus('p-niteroi-1');
    assert.ok(cachedStatus);
    assert.equal(cachedStatus.online, true);
    assert.equal(cachedStatus.info.model, 'Brother HL-L6402DW');
    assert.equal(cachedStatus.supplies.length, 1);
    assert.equal(cachedStatus.supplies[0].name, 'Toner TN-3472');
    assert.equal(cachedStatus.supplies[0].percentage, 88);
  } finally {
    server.close();
  }
});
