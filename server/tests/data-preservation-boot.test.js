import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as db from '../db.js';

test('HFE-REV-006: Preservação de Dados, Boot Seguro e Sincronização Não-Destrutiva', async (t) => {
  let testDb;

  t.beforeEach(() => {
    testDb = db.initDatabase(':memory:');
  });

  t.afterEach(() => {
    db.closeDatabase();
  });

  await t.test('1. Impressora modificada pelo usuário no SQLite não tem dados sobrescritos pelo syncSeedData', () => {
    // Insere impressora com modificações manuais do usuário
    const customPrinter = {
      id: 'p-custom-1',
      name: 'Nome Customizado pelo TI',
      ip: '198.18.6.100',
      location: 'Consultório 99 - Ala Vip',
      unitName: 'Unidade Principal',
      initialPageCount: 12000,
      macAddress: 'AA:BB:CC:DD:EE:01'
    };
    db.savePrinter(customPrinter);

    // Executa syncSeedData
    db.syncSeedData();

    // Reconsulta a impressora
    const afterSync = db.getPrinterById('p-custom-1');
    assert.strictEqual(afterSync.name, 'Nome Customizado pelo TI');
    assert.strictEqual(afterSync.location, 'Consultório 99 - Ala Vip');
    assert.strictEqual(afterSync.initialPageCount, 12000);
    assert.strictEqual(afterSync.macAddress, 'AA:BB:CC:DD:EE:01');
  });

  await t.test('2. Impressoras excluídas explicitamente (deleted_printers) nunca são ressuscitadas no boot', () => {
    const printerToDelete = {
      id: 'p-deleted-test',
      name: 'Impressora Desativada',
      ip: '198.18.6.200',
      location: 'Descarte'
    };
    db.savePrinter(printerToDelete);
    assert.ok(db.getPrinterById('p-deleted-test'));

    // Exclui a impressora (cria tombstone)
    db.deletePrinter('p-deleted-test');
    assert.strictEqual(db.getPrinterById('p-deleted-test'), null);
    assert.strictEqual(db.isPrinterDeleted('p-deleted-test', '198.18.6.200'), true);

    // Executa syncSeedData
    db.syncSeedData();

    // Deve permanecer excluída
    assert.strictEqual(db.getPrinterById('p-deleted-test'), null);
  });

  await t.test('3. Enriquecimento seguro: preenche mac_address quando ausente sem alterar outros campos', () => {
    const printerWithoutMac = {
      id: 'p-no-mac',
      name: 'Impressora Sem MAC',
      ip: '198.18.6.210',
      location: 'Recepção 01',
      unitName: 'Unidade Centro',
      macAddress: null
    };
    db.savePrinter(printerWithoutMac);

    const before = db.getPrinterById('p-no-mac');
    assert.strictEqual(before.macAddress, null);

    // Salva com MAC
    db.savePrinter({
      ...before,
      macAddress: '11:22:33:44:55:66'
    });

    const after = db.getPrinterById('p-no-mac');
    assert.strictEqual(after.macAddress, '11:22:33:44:55:66');
    assert.strictEqual(after.name, 'Impressora Sem MAC');
    assert.strictEqual(after.location, 'Recepção 01');
  });
});
