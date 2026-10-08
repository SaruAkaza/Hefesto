import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';

test.beforeEach(() => { db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true }); });
test.after(() => db.closeDatabase());
function asset(id, ip, extra = {}) {
  db.savePrinter({ id, ip, name: id, unitName: 'Unidade Exemplo', location: 'Laboratório', initialPageCount: 100, ...extra });
}
function setup(extra = {}) {
  asset('old', '198.18.9.10', extra);
  return { replacedPrinterId: 'old', newPrinter: { id: 'new', name: 'Nova', ip: '198.18.9.10' }, replacedBy: 'admin', reason: 'Troca física', confirmed: true };
}
test('contador ausente permanece desconhecido sem inventar produção', () => {
  db.executePrinterReplacement(setup());
  assert.equal(db.getPrinterById('new').initialPageCount, null);
  assert.equal(db.getCachedStatus('new').info.pageCount, null);
  assert.equal(db.getPrinterReplacements('new')[0].initial_counter, null);
  assert.equal(db.getDb().prepare('SELECT COUNT(*) n FROM page_history WHERE printer_id = ?').get('new').n, 0);
  db.recordPageCount('new', 630);
  assert.equal(db.getPrinterById('new').initialPageCount, 630);
});
test('zero explícito é válido e não é recalibrado na primeira leitura', () => {
  db.executePrinterReplacement({ ...setup(), initialCounter: 0 });
  db.recordPageCount('new', 12);
  assert.equal(db.getPrinterById('new').initialPageCount, 0);
  assert.equal(db.getDb().prepare('SELECT start_page_count FROM page_history WHERE printer_id = ?').get('new').start_page_count, 0);
});
test('confirmação deve ser true booleano, nunca texto', () => {
  assert.throws(() => db.executePrinterReplacement({ ...setup(), confirmed: 'false' }), /confirmação/);
  assert.equal(db.getPrinterById('old').isActive, true);
});
test('valida contador inteiro não negativo e não converte string vazia em zero', () => {
  const options = setup();
  for (const initialCounter of [-1, 1.5, '10', '', Infinity]) {
    assert.throws(() => db.executePrinterReplacement({ ...options, initialCounter }), /contador/i);
  }
});
test('identidade física igual indica mudança de IP, não substituição', () => {
  const options = setup({ macAddress: '00:11:22:33:44:55' });
  options.newPrinter.macAddress = '00-11-22-33-44-55';
  assert.throws(() => db.executePrinterReplacement(options), /mesmo equipamento/i);
});
test('reenvio não substitui ativo já desativado nem cria outra auditoria', () => {
  const options = setup();
  db.executePrinterReplacement(options);
  assert.throws(() => db.executePrinterReplacement(options), /desativad/i);
  assert.equal(db.getPrinterReplacements().length, 1);
  assert.deepEqual(db.getPrinters().map(p => p.id), ['new']);
  assert.equal(db.getPrinterById('old').ip, '198.18.9.10');
});
test('reserva mantém produção do dia, base antiga e duas alocações', () => {
  const options = setup();
  asset('reserve', '198.18.20.20', { unitName: 'Estoque', location: 'Reserva', initialPageCount: 20 });
  db.recordPageCount('reserve', 200);
  db.recordPageCount('reserve', 250);
  db.executePrinterReplacement({ ...options, associatedPrinterId: 'reserve', newPrinter: { ip: '198.18.9.10' }, initialCounter: 250 });
  assert.equal(db.getPrinterById('reserve').initialPageCount, 20);
  const history = db.getDb().prepare('SELECT * FROM page_history WHERE printer_id = ?').get('reserve');
  assert.equal(history.start_page_count, 200);
  assert.equal(history.end_page_count, 250);
  const allocations = db.getPrinterAllocations('reserve');
  assert.equal(allocations.length, 2);
  assert.equal(allocations[0].unit_name, 'Estoque');
  assert.ok(allocations[0].ended_at);
  assert.equal(allocations[1].unit_name, 'Unidade Exemplo');
  assert.equal(allocations[1].start_counter, 250);
});
test('exclusão de ativos vinculados não apaga histórico de substituição', () => {
  db.executePrinterReplacement(setup());
  assert.throws(() => db.deletePrinter('old'), /histórico/i);
  assert.throws(() => db.getDb().prepare('DELETE FROM printers WHERE id = ?').run('new'), /histórico/i);
  assert.equal(db.getPrinterReplacements().length, 1);
});
test('colisão de IP faz rollback e mantém antiga ativa', () => {
  const options = setup();
  asset('other', '198.18.9.30');
  options.newPrinter.ip = '198.18.9.30';
  assert.throws(() => db.executePrinterReplacement(options));
  assert.equal(db.getPrinterById('old').isActive, true);
  assert.equal(db.getPrinterById('new'), null);
  assert.equal(db.getPrinterReplacements().length, 0);
});
test('telemetria de outro equipamento não mistura serial e contador com o ativo antigo', () => {
  setup();
  db.updateCachedStatus('old', { online: true, info: { serialNumber: 'OLD123', model: 'Epson', pageCount: 200 } });
  assert.throws(() => db.updateCachedStatus('old', { online: true, info: { serialNumber: 'NEW456', model: 'Lexmark', pageCount: 5000 } }), /substitu/i);
  assert.equal(db.getCachedStatus('old').info.pageCount, 200);
  assert.equal(db.getCachedStatus('old').info.serialNumber, 'OLD123');
});
test('cache offline não inventa zero quando contador ainda é desconhecido', () => {
  db.executePrinterReplacement(setup());
  db.updateCachedStatus('new', { online: false, info: {} });
  assert.equal(db.getCachedStatus('new').info.pageCount, null);
});
test('sincronização replica troca e desativação atomicamente, sem reativar antigo', () => {
  db.executePrinterReplacement(setup());
  const printers = db.getPrinters({ includeInactive: true });
  const bundle = db.getPrinterLifecycleBundle(printers.map(p => p.id));
  db.closeDatabase(); db.initDatabase({ inMemory: true, skipSeeds: true });
  db.applyPrinterLifecycleSync({ printers, ...bundle });
  db.applyPrinterLifecycleSync({ printers, ...bundle });
  assert.deepEqual(db.getPrinters().map(p => p.id), ['new']);
  assert.equal(db.getPrinterById('old').ip, '198.18.9.10');
  assert.equal(db.getPrinterReplacements().length, 1);
  assert.equal(db.getPrinterById('new').initialPageCount, null);
  assert.equal(db.getPrinterAllocations('new').length, 1);
});
