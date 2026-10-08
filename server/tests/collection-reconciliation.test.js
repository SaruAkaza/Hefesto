import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';

test('HFE-REV-008B: Reconciliação Anti-Colisão Não Destrutiva (F10)', async (t) => {
  let testDb;

  t.beforeEach(() => {
    testDb = db.initDatabase(':memory:');
  });

  t.afterEach(() => {
    db.closeDatabase();
  });

  await t.test('1. reconcilePrinterIpByMac reconcilia IP e desloca colisão para pendente-* sem deletar registro', () => {
    // Cria impressora alvo (que mudou de IP para 198.18.6.50)
    db.savePrinter({
      id: 'p-target-1',
      name: 'HP Recepção',
      ip: '198.18.6.10',
      macAddress: 'AA:BB:CC:11:22:33',
      location: 'Recepção'
    });

    // Cria impressora que anteriormente ocupava 198.18.6.50
    db.savePrinter({
      id: 'p-old-occupant',
      name: 'Xerox Antiga',
      ip: '198.18.6.50',
      macAddress: '11:22:33:44:55:66',
      location: 'Triagem'
    });

    const recResult = db.reconcilePrinterIpByMac('AA:BB:CC:11:22:33', '198.18.6.50');

    assert.strictEqual(recResult.success, true);
    assert.strictEqual(recResult.updated, true);
    assert.strictEqual(recResult.previousIp, '198.18.6.10');
    assert.strictEqual(recResult.newIp, '198.18.6.50');
    assert.strictEqual(recResult.displacedPrinterId, 'p-old-occupant');

    // Verifica que a impressora alvo agora tem o IP 198.18.6.50
    const target = db.getPrinterById('p-target-1');
    assert.strictEqual(target.ip, '198.18.6.50');

    // Verifica que a impressora antiga não foi excluída, mas teve seu IP alterado para pendente-*
    const occupant = db.getPrinterById('p-old-occupant');
    assert.ok(occupant, 'Impressora deslocada não deve ser deletada');
    assert.ok(occupant.ip.startsWith('pendente-198.18.6.50'));
    assert.strictEqual(occupant.name, 'Xerox Antiga');
  });

  await t.test('2. reconcilePrinterIpBySerial reconcilia IP via Serial e desloca colisão não-destrutivamente', () => {
    db.savePrinter({
      id: 'p-serial-target',
      name: 'Epson Consultorio',
      ip: '198.18.12.5',
      location: 'Consultório 01'
    });

    // Registra status com serial number no cache
    db.updateCachedStatus('p-serial-target', {
      online: true,
      info: {
        serialNumber: 'DEMO00000003',
        model: 'Epson M1180'
      }
    });

    // Cria impressora em conflito no novo IP 198.18.12.88
    db.savePrinter({
      id: 'p-conflict-slot',
      name: 'Impressora Conflitante',
      ip: '198.18.12.88',
      location: 'Sala 02'
    });

    const recResult = db.reconcilePrinterIpBySerial('DEMO00000003', '198.18.12.88');
    assert.strictEqual(recResult.success, true);
    assert.strictEqual(recResult.updated, true);
    assert.strictEqual(recResult.newIp, '198.18.12.88');
    assert.strictEqual(recResult.displacedPrinterId, 'p-conflict-slot');

    const reconciled = db.getPrinterById('p-serial-target');
    assert.strictEqual(reconciled.ip, '198.18.12.88');

    const conflict = db.getPrinterById('p-conflict-slot');
    assert.ok(conflict.ip.startsWith('pendente-198.18.12.88'));
  });
});
