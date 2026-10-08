import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDatabase,
  setDatabase,
  closeDatabase,
  executePrinterReplacement,
  getPrinterReplacements,
  getDb
} from '../db.js';

let testDb;

test.beforeEach(() => {
  testDb = initDatabase({ isMemory: true });
  setDatabase(testDb);
});

test.afterEach(() => {
  closeDatabase();
});

test('Printer Replacement - Rejeita substituição sem confirmação explícita', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES ('unit-1', 'Hospital Central', 'SP')
  `).run();

  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name)
    VALUES ('prn-epson-1', 'Epson M1180 Consultório 1', '198.18.13.50', 'Consultório 1', 'unit-1', 'Hospital Central')
  `).run();

  assert.throws(() => {
    executePrinterReplacement({
      replacedPrinterId: 'prn-epson-1',
      newPrinter: {
        name: 'Lexmark MS821 Consultório 1',
        ip: '198.18.13.50',
        model: 'Lexmark MS821'
      },
      replacedBy: 'Carlos TI',
      reason: 'Cabeça de impressão da Epson danificada',
      confirmed: false // Confirmação ausente
    });
  }, /confirmação explícita/i);
});

test('Printer Replacement - Preserva Epson e histórico, cria Lexmark separada e vincula evento', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES ('unit-1', 'Hospital Central', 'SP')
  `).run();

  // 1. Cadastrar Epson original com histórico de recargas e contadores
  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, initial_page_count)
    VALUES ('prn-epson-old', 'Epson M1180 - Recepção', '198.18.14.10', 'Recepção', 'unit-1', 'Hospital Central', 1000)
  `).run();

  // Histórico de contadores da Epson
  db.prepare(`
    INSERT INTO page_history (printer_id, date, start_page_count, end_page_count, last_updated_at)
    VALUES ('prn-epson-old', '2026-08-01', 15000, 15000, '2026-08-01 10:00:00'),
           ('prn-epson-old', '2026-09-01', 25000, 25000, '2026-09-01 10:00:00')
  `).run();

  // Histórico de recargas da Epson
  db.prepare(`
    INSERT INTO recharges (id, printer_id, printer_name, supply_name, previous_level, new_level, page_count, timestamp)
    VALUES ('rec-epson-1', 'prn-epson-old', 'Epson M1180 - Recepção', 'Black Ink', 5, 100, 20000, '2026-08-15 14:00:00')
  `).run();

  // 2. Executar a substituição por Lexmark MS821 assumindo o mesmo IP
  const result = executePrinterReplacement({
    replacedPrinterId: 'prn-epson-old',
    newPrinter: {
      id: 'prn-lexmark-new',
      name: 'Lexmark MS821 - Recepção',
      ip: '198.18.14.10', // Mesmo IP de produção
      model: 'Lexmark MS821dn',
      serial_number: 'LX789123',
      initial_page_count: 500
    },
    replacedBy: 'Mariana Silva - TI',
    reason: 'Substituição por aumento de demanda de impressão; Epson enviada para manutenção preventiva.',
    initialCounter: 500,
    notes: 'Lexmark instalada na bancada principal da recepção.',
    confirmed: true
  });

  assert.equal(result.success, true);
  assert.equal(result.replacedPrinter.id, 'prn-epson-old');
  assert.equal(result.newPrinter.id, 'prn-lexmark-new');

  // 3. Verificar que a Epson CONTINUA EXISTINDO no banco com todo seu histórico intacto
  const epsonRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-epson-old');
  assert.ok(epsonRow, 'Epson original deve continuar existindo na tabela printers');
  assert.equal(epsonRow.is_active, 0, 'Epson deve ser marcada como inativa/desativada');
  assert.ok(epsonRow.decommissioned_at, 'Epson deve registrar data de desativação');
  assert.ok(epsonRow.ip.includes('#replaced_'), 'IP da Epson arquivado para liberar o IP físico para a Lexmark');

  // Histórico da Epson intacto
  const epsonCounters = db.prepare('SELECT * FROM page_history WHERE printer_id = ?').all('prn-epson-old');
  assert.equal(epsonCounters.length, 2, 'Histórico de contadores da Epson preservado');
  const epsonRecharges = db.prepare('SELECT * FROM recharges WHERE printer_id = ?').all('prn-epson-old');
  assert.equal(epsonRecharges.length, 1, 'Histórico de recargas da Epson preservado');

  // 4. Verificar que a Lexmark foi criada como registro separado com marco zero próprio
  const lexmarkRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-lexmark-new');
  assert.ok(lexmarkRow, 'Lexmark deve existir como registro autônomo');
  assert.equal(lexmarkRow.ip, '198.18.14.10', 'Lexmark assume o IP de produção liberado');
  assert.equal(lexmarkRow.name, 'Lexmark MS821 - Recepção');
  assert.equal(lexmarkRow.is_active, 1);
  assert.equal(lexmarkRow.initial_page_count, 500);

  const lexmarkCounters = db.prepare('SELECT * FROM page_history WHERE printer_id = ?').all('prn-lexmark-new');
  assert.equal(lexmarkCounters.length, 1);
  assert.equal(lexmarkCounters[0].start_page_count, 500, 'Lexmark inicia no seu marco zero de 500 páginas');

  // 5. Verificar o evento vinculador de substituição
  const replacements = getPrinterReplacements('prn-epson-old');
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].replaced_printer_id, 'prn-epson-old');
  assert.equal(replacements[0].new_printer_id, 'prn-lexmark-new');
  assert.equal(replacements[0].replaced_by, 'Mariana Silva - TI');
  assert.equal(replacements[0].reason, 'Substituição por aumento de demanda de impressão; Epson enviada para manutenção preventiva.');
  assert.equal(replacements[0].initial_counter, 500);
  assert.equal(replacements[0].confirmed, 1);
});

test('Printer Replacement HTTP API - Endpoint /api/printers/:id/replace e auditoria', async () => {
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const { authMiddleware, requireAdmin, requireAuth, createSession } = await import('../auth.js');
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES ('unit-http-1', 'Hospital Norte', 'SP')
  `).run();

  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, initial_page_count)
    VALUES ('prn-epson-http', 'Epson M1180 - Posto 2', '198.18.15.20', 'Posto 2', 'unit-http-1', 'Hospital Norte', 500)
  `).run();

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);

  app.post('/api/printers/:id/replace', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { newPrinter, replacedBy, reason, initialCounter, notes, confirmed } = req.body || {};
    if (!confirmed) {
      return res.status(400).json({ error: 'A substituição de impressora requer confirmação explícita (confirmed: true).' });
    }
    try {
      const result = executePrinterReplacement({
        replacedPrinterId: id,
        newPrinter,
        replacedBy: replacedBy || req.user?.username || 'Administrador',
        reason,
        initialCounter,
        notes,
        confirmed: true
      });
      res.status(201).json(result);
    } catch (err) {
      const statusCode = err.message.includes('não encontrada') ? 404 : 400;
      res.status(statusCode).json({ error: err.message });
    }
  });

  app.get('/api/printers/:id/replacements', requireAuth(), (req, res) => {
    try {
      const replacements = getPrinterReplacements(req.params.id);
      res.json(replacements);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const session = createSession({ username: 'admin', role: 'admin' });

  try {
    // 1. Chamada sem token deve retornar 401
    const unauthRes = await fetch(`${baseUrl}/api/printers/prn-epson-http/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
      body: JSON.stringify({ confirmed: true })
    });
    assert.equal(unauthRes.status, 401);

    // 2. Chamada autenticada com confirmação explícita
    const authRes = await fetch(`${baseUrl}/api/printers/prn-epson-http/replace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
        'Connection': 'close'
      },
      body: JSON.stringify({
        newPrinter: {
          id: 'prn-lexmark-http',
          name: 'Lexmark MS821 - Posto 2',
          ip: '198.18.15.20',
          model: 'Lexmark MS821',
          serial_number: 'LX999888',
          initial_page_count: 200
        },
        replacedBy: 'Equipe Helpdesk',
        reason: 'Upgrade para modelo laser de alta velocidade',
        initialCounter: 200,
        confirmed: true
      })
    });
    assert.equal(authRes.status, 201);
    const data = await authRes.json();
    assert.equal(data.success, true);
    assert.equal(data.replacedPrinter.id, 'prn-epson-http');
    assert.equal(data.newPrinter.id, 'prn-lexmark-http');

    // 3. Consultar histórico de substituições via API
    const listRes = await fetch(`${baseUrl}/api/printers/prn-epson-http/replacements`, {
      headers: { 'Authorization': `Bearer ${session.token}`, 'Connection': 'close' }
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].reason, 'Upgrade para modelo laser de alta velocidade');
    assert.equal(list[0].replaced_by, 'Equipe Helpdesk');
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('Printer Replacement - Suporta mesma marca e modelo (equipamentos idênticos com Seriais/MACs distintos)', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES ('unit-hp', 'Unidade Exemplo', 'SP')
  `).run();

  // Impressora antiga: HP LaserJet M404n
  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, mac_address, initial_page_count)
    VALUES ('prn-hp-old', 'HP M404n - Recepção', '198.18.16.15', 'Recepção', 'unit-hp', 'Unidade Exemplo', '00:11:22:33:44:55', 0)
  `).run();

  db.prepare(`
    INSERT INTO printer_status_cache (printer_id, model, serial_number, page_count)
    VALUES ('prn-hp-old', 'HP LaserJet Pro M404n', 'HP-SER-AAA111', 45000)
  `).run();

  db.prepare(`
    INSERT INTO page_history (printer_id, date, start_page_count, end_page_count, last_updated_at)
    VALUES ('prn-hp-old', '2026-09-01', 40000, 45000, '2026-09-01 18:00:00')
  `).run();

  // Executar substituição por outra HP LaserJet Pro M404n de MESMO modelo
  const result = executePrinterReplacement({
    replacedPrinterId: 'prn-hp-old',
    newPrinter: {
      id: 'prn-hp-new',
      name: 'HP M404n - Recepção (Substituta)',
      ip: '198.18.16.15',
      model: 'HP LaserJet Pro M404n', // MESMO MODELO
      serial_number: 'HP-SER-BBB222',  // Serial físico distinto
      mac_address: 'AA:BB:CC:DD:EE:FF', // MAC físico distinto
      initial_page_count: 120
    },
    targetUnitId: 'unit-hp',
    targetUnitName: 'Unidade Exemplo',
    targetLocation: 'Recepção - Triagem',
    replacedBy: 'Técnico Suporte HP',
    reason: 'Troca de impressora por desgaste do rolete de tração; substituída por máquina idêntica de backup.',
    initialCounter: 120,
    confirmed: true
  });

  assert.equal(result.success, true);
  assert.equal(result.replacedPrinter.model, 'HP LaserJet Pro M404n');
  assert.equal(result.newPrinter.model, 'HP LaserJet Pro M404n');
  assert.equal(result.replacedPrinter.serial, 'HP-SER-AAA111');
  assert.equal(result.newPrinter.serial, 'HP-SER-BBB222');

  // Verificar que a HP antiga continua no banco, inativa, com histórico de 45.000 páginas preservado
  const oldRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-hp-old');
  assert.equal(oldRow.is_active, 0);
  assert.ok(oldRow.ip.includes('#replaced_'));
  const oldHistory = db.prepare('SELECT * FROM page_history WHERE printer_id = ?').all('prn-hp-old');
  assert.equal(oldHistory.length, 1);
  assert.equal(oldHistory[0].end_page_count, 45000);

  // Verificar que a HP nova assumiu o IP com marco zero próprio de 120 páginas
  const newRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-hp-new');
  assert.equal(newRow.is_active, 1);
  assert.equal(newRow.ip, '198.18.16.15');
  assert.equal(newRow.location, 'Recepção - Triagem');
  assert.equal(newRow.mac_address, 'AA:BB:CC:DD:EE:FF');

  const newHistory = db.prepare('SELECT * FROM page_history WHERE printer_id = ?').all('prn-hp-new');
  assert.equal(newHistory.length, 1);
  assert.equal(newHistory[0].start_page_count, 120);

  // Evento registrado com identificadores físicos
  const replacements = getPrinterReplacements('prn-hp-old');
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].replaced_model, 'HP LaserJet Pro M404n');
  assert.equal(replacements[0].new_model, 'HP LaserJet Pro M404n');
  assert.equal(replacements[0].replaced_serial, 'HP-SER-AAA111');
  assert.equal(replacements[0].new_serial, 'HP-SER-BBB222');
  assert.equal(replacements[0].target_location, 'Recepção - Triagem');
});

test('Printer Replacement - Associação de equipamento existente do estoque com transferência de setor/unidade', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES
      ('unit-infantil', 'Hospital Infantil', 'SP'),
      ('unit-estoque', 'Almoxarifado TI', 'SP')
  `).run();

  // 1. Equipamento defeituoso na UTI Neonatal
  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, initial_page_count)
    VALUES ('prn-defective-uti', 'Brother DCP-L5652 - UTI', '198.18.17.20', 'UTI Neonatal', 'unit-infantil', 'Hospital Infantil', 100)
  `).run();

  // 2. Equipamento reserva no almoxarifado
  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, mac_address, initial_page_count)
    VALUES ('prn-spare-ti', 'Brother DCP-L5652 - Reserva', '198.18.18.5', 'Bancada TI', 'unit-estoque', 'Almoxarifado TI', 'BB:22:33:44:55:66', 2000)
  `).run();
  db.prepare(`
    INSERT INTO printer_status_cache (printer_id, model, serial_number, page_count)
    VALUES ('prn-spare-ti', 'Brother DCP-L5652DN', 'BR-SPARE-999', 2400)
  `).run();

  // 3. Executar substituição associando a reserva e movendo para a UTI com assunção de IP
  const result = executePrinterReplacement({
    replacedPrinterId: 'prn-defective-uti',
    associatedPrinterId: 'prn-spare-ti',
    targetUnitId: 'unit-infantil',
    targetUnitName: 'Hospital Infantil',
    targetLocation: 'UTI Neonatal - Posto Enfermagem',
    newPrinter: {
      ip: '198.18.17.20' // Assume o IP físico da UTI
    },
    replacedBy: 'Equipe Campo TI',
    reason: 'Fusor da impressora antiga parou de aquecer. Ativado equipamento de backup do estoque.',
    confirmed: true
  });

  assert.equal(result.success, true);
  assert.equal(result.replacementMode, 'associated_existing');

  // A impressora defeituosa foi desativada e teve IP liberado
  const defRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-defective-uti');
  assert.equal(defRow.is_active, 0);
  assert.ok(defRow.ip.includes('#replaced_'));

  // A impressora reserva agora atua na UTI Neonatal com o IP da UTI
  const spareRow = db.prepare('SELECT * FROM printers WHERE id = ?').get('prn-spare-ti');
  assert.equal(spareRow.is_active, 1);
  assert.equal(spareRow.ip, '198.18.17.20');
  assert.equal(spareRow.location, 'UTI Neonatal - Posto Enfermagem');
  assert.equal(spareRow.unit_id, 'unit-infantil');
  assert.equal(spareRow.unit_name, 'Hospital Infantil');

  // Evento registrado
  const rep = getPrinterReplacements('prn-defective-uti');
  assert.equal(rep.length, 1);
  assert.equal(rep[0].new_printer_id, 'prn-spare-ti');
  assert.equal(rep[0].replacement_mode, 'associated_existing');
  assert.equal(rep[0].target_location, 'UTI Neonatal - Posto Enfermagem');
});

test('Printer Replacement - Substituição manual quando identificação automática (Serial/MAC) está indisponível', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO units (id, name, region) VALUES ('unit-farm', 'Hospital Geral', 'SP')
  `).run();

  // Impressora sem serial e sem MAC detectáveis (ex: switch gerenciado bloqueando SNMP)
  db.prepare(`
    INSERT INTO printers (id, name, ip, location, unit_id, unit_name, initial_page_count)
    VALUES ('prn-generic-old', 'Impressora Térmica Farmácia', '198.18.19.30', 'Farmácia Satélite', 'unit-farm', 'Hospital Geral', 0)
  `).run();

  // Substituição manual sem serial e sem MAC
  const result = executePrinterReplacement({
    replacedPrinterId: 'prn-generic-old',
    newPrinter: {
      name: 'Impressora Térmica Etiquetas - Farmácia Nova',
      ip: '198.18.19.30'
      // serial_number e mac_address omitidos propositalmente
    },
    targetLocation: 'Farmácia Satélite - Balcão 1',
    replacementMode: 'manual',
    replacedBy: 'Farmacêutico Plantonista / TI Local',
    reason: 'Substituição manual de emergência: equipamento sem SNMP ativo no momento da troca.',
    notes: 'Identificação física conferida visualmente pela etiqueta de patrimônio PAT-45091.',
    initialCounter: 0,
    confirmed: true
  });

  assert.equal(result.success, true);
  assert.equal(result.replacedPrinter.id, 'prn-generic-old');
  assert.ok(result.newPrinter.id);
  assert.equal(result.newPrinter.serial, null);
  assert.equal(result.newPrinter.mac, null);

  // Registro de substituição preservado com modo manual
  const repList = getPrinterReplacements('prn-generic-old');
  assert.equal(repList.length, 1);
  assert.equal(repList[0].replacement_mode, 'manual');
  assert.equal(repList[0].notes, 'Identificação física conferida visualmente pela etiqueta de patrimônio PAT-45091.');
  assert.equal(repList[0].confirmed, 1);
});
