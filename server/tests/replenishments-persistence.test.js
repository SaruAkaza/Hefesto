import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDatabase,
  setDatabase,
  closeDatabase,
  savePrinter,
  deletePrinter,
  getReplenishments,
  getReplenishmentById,
  saveReplenishment,
  deleteReplenishment
} from '../db.js';
import { app } from '../server.js';
import { createSession } from '../auth.js';

let testDb;
let adminSessionToken;

test.before(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
  const session = createSession('admin');
  adminSessionToken = session.token;
});

test.after(() => {
  closeDatabase();
});

test('Replenishments Persistence - SQLite CRUD & Cascade operations', () => {
  const printerId = 'p-replenish-1';
  savePrinter({
    id: printerId,
    name: 'Brother Reception',
    ip: '198.18.5.10',
    community: 'public'
  });

  // 1. Initially empty
  assert.equal(getReplenishments().length, 0);

  // 2. Insert replenishment item
  const item1 = {
    id: 'rep-1',
    printerId,
    printerName: 'Brother Reception',
    location: 'Recepção',
    supplyName: 'Toner Preto TN-3472',
    supplyType: 'toner',
    percentage: 10,
    orderStatus: 'pending',
    modelPart: 'TN-3472',
    notes: 'Solicitado via painel'
  };

  const saved = saveReplenishment(item1);
  assert.ok(saved);
  assert.equal(saved.id, 'rep-1');
  assert.equal(saved.printerId, printerId);
  assert.equal(saved.orderStatus, 'pending');
  assert.equal(saved.percentage, 10);

  // 3. Retrieve by ID and List
  const fetched = getReplenishmentById('rep-1');
  assert.equal(fetched.id, 'rep-1');
  assert.equal(fetched.supplyName, 'Toner Preto TN-3472');

  const list = getReplenishments();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'rep-1');

  // 4. Update replenishment item
  saveReplenishment({
    ...fetched,
    orderStatus: 'ordered',
    notes: 'Pedido de compra #1234'
  });

  const updated = getReplenishmentById('rep-1');
  assert.equal(updated.orderStatus, 'ordered');
  assert.equal(updated.notes, 'Pedido de compra #1234');

  // 5. Delete replenishment item
  const deleted = deleteReplenishment('rep-1');
  assert.equal(deleted, true);
  assert.equal(getReplenishments().length, 0);
  assert.equal(getReplenishmentById('rep-1'), null);

  // 6. Test Foreign Key Cascade on Printer Deletion
  const item2 = {
    id: 'rep-2',
    printerId,
    printerName: 'Brother Reception',
    supplyName: 'Cilindro DR-3440',
    supplyType: 'imaging_kit',
    percentage: 5,
    orderStatus: 'pending'
  };
  saveReplenishment(item2);
  assert.equal(getReplenishments().length, 1);

  deletePrinter(printerId);
  assert.equal(getReplenishments().length, 0, 'Replenishments must cascade delete when parent printer is deleted');
});

test('Replenishments HTTP API - Endpoints CRUD & Authorization', async () => {
  const printerId = 'p-replenish-http';
  savePrinter({
    id: printerId,
    name: 'Kyocera ECOSYS M3655idn',
    ip: '198.18.5.11',
    community: 'public'
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/replenishments (public / authenticated)
    const resGet = await fetch(`${baseUrl}/api/replenishments`);
    assert.equal(resGet.status, 200);
    const initialList = await resGet.json();
    assert.ok(Array.isArray(initialList));

    // 2. POST /api/replenishments without auth -> 401
    const resPostUnauth = await fetch(`${baseUrl}/api/replenishments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerId, supplyName: 'Toner TK-3182' })
    });
    assert.equal(resPostUnauth.status, 401);

    // 3. POST /api/replenishments with admin auth -> 201
    const resPostAuth = await fetch(`${baseUrl}/api/replenishments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        id: 'rep-http-1',
        printerId,
        printerName: 'Kyocera ECOSYS M3655idn',
        supplyName: 'Toner TK-3182',
        supplyType: 'toner',
        percentage: 8,
        orderStatus: 'pending',
        notes: 'Crítico'
      })
    });
    assert.equal(resPostAuth.status, 201);
    const createdItem = await resPostAuth.json();
    assert.equal(createdItem.id, 'rep-http-1');
    assert.equal(createdItem.supplyName, 'Toner TK-3182');

    // 4. PUT /api/replenishments/:id with admin auth -> 200
    const resPut = await fetch(`${baseUrl}/api/replenishments/rep-http-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        orderStatus: 'in_stock',
        notes: 'Chegou na TI'
      })
    });
    assert.equal(resPut.status, 200);
    const updatedItem = await resPut.json();
    assert.equal(updatedItem.orderStatus, 'in_stock');
    assert.equal(updatedItem.notes, 'Chegou na TI');

    // 5. DELETE /api/replenishments/:id with admin auth -> 204
    const resDelete = await fetch(`${baseUrl}/api/replenishments/rep-http-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminSessionToken}` }
    });
    assert.equal(resDelete.status, 204);

    // Verify deletion
    const resGetAfter = await fetch(`${baseUrl}/api/replenishments`);
    const afterList = await resGetAfter.json();
    assert.equal(afterList.some(i => i.id === 'rep-http-1'), false);
  } finally {
    server.close();
  }
});
