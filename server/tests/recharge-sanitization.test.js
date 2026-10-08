import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema, sanitizeRechargeEncodings, setDatabase, closeDatabase } from '../db.js';

test('recharges table contains correctly accented Consultório records and no corrupted characters (isolated in-memory)', () => {
  const memDb = new DatabaseSync(':memory:');
  createSchema(memDb);
  setDatabase(memDb);

  try {
    // Insere fixtures sintéticas: registro corrompido com \uFFFD, registro legado sem acento e registro limpo
    memDb.prepare(`
      INSERT INTO recharges (id, printer_id, printer_name, location, supply_name, timestamp)
      VALUES
        ('rec-corrupt-1', 'p1', 'Impressora Teste Consult\uFFFDrio', 'Consult\uFFFDrio 01', 'Toner Black', '2026-09-28T10:00:00.000Z'),
        ('rec-legacy-2', 'p2', 'Impressora Consultrio', 'Consultrio 02', 'Toner Cyan', '2026-09-28T11:00:00.000Z'),
        ('rec-clean-3', 'p3', 'Impressora Consultório', 'Consultório 03', 'Toner Magenta', '2026-09-28T12:00:00.000Z')
    `).run();

    // Executa a sanitização no banco isolado
    sanitizeRechargeEncodings(memDb);

    // Verifica que o registro corrompido foi corrigido
    const rec1 = memDb.prepare("SELECT * FROM recharges WHERE id = 'rec-corrupt-1'").get();
    assert.ok(rec1, 'Registro rec-corrupt-1 deve existir');
    assert.equal(rec1.location, 'Consultório 01');
    assert.equal(rec1.printer_name, 'Impressora Teste Consultório');
    assert.ok(!rec1.location.includes('\uFFFD'));
    assert.ok(!rec1.printer_name.includes('\uFFFD'));

    // Verifica que o registro legado sem acento foi corrigido
    const rec2 = memDb.prepare("SELECT * FROM recharges WHERE id = 'rec-legacy-2'").get();
    assert.ok(rec2, 'Registro rec-legacy-2 deve existir');
    assert.equal(rec2.location, 'Consultório 02');
    assert.equal(rec2.printer_name, 'Impressora Consultório');

    // Verifica que o registro limpo foi preservado
    const rec3 = memDb.prepare("SELECT * FROM recharges WHERE id = 'rec-clean-3'").get();
    assert.ok(rec3, 'Registro rec-clean-3 deve existir');
    assert.equal(rec3.location, 'Consultório 03');
    assert.equal(rec3.printer_name, 'Impressora Consultório');

    // Garante que nenhum registro na tabela possui caractere corrompido
    const corrupted = memDb.prepare("SELECT id, location, printer_name FROM recharges WHERE location LIKE '%\uFFFD%' OR printer_name LIKE '%\uFFFD%'").all();
    assert.equal(corrupted.length, 0);
  } finally {
    closeDatabase();
  }
});
