import crypto from 'node:crypto';
import { getInclusiveDateSpanDays } from './date-utils.js';

export function ensurePrintingCostSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS printing_cost_tariffs (
      id TEXT PRIMARY KEY,
      printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE RESTRICT,
      effective_from TEXT NOT NULL,
      contract TEXT NOT NULL,
      model TEXT NOT NULL,
      paper_format TEXT NOT NULL,
      device_type TEXT NOT NULL,
      billing_rule TEXT NOT NULL,
      page_rate_units INTEGER NOT NULL,
      monthly_rent_cents INTEGER NOT NULL,
      rent_rule TEXT NOT NULL,
      unit_id TEXT, unit_name TEXT NOT NULL, location TEXT NOT NULL,
      reference_period TEXT NOT NULL,
      source TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(printer_id, effective_from)
    );
    CREATE INDEX IF NOT EXISTS idx_printing_cost_tariffs_period
      ON printing_cost_tariffs(printer_id, effective_from);
  `);
}

export function decimalToUnits(value, decimals, label = 'Valor') {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!new RegExp(`^\\d{1,8}(?:\\.\\d{1,${decimals}})?$`).test(raw)) {
    throw new Error(`${label}: informe um valor não negativo com até ${decimals} casas decimais.`);
  }
  const [integer, fraction = ''] = raw.split('.');
  const result = Number(integer) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'));
  if (!Number.isSafeInteger(result)) throw new Error(`${label} fora do limite permitido.`);
  return result;
}
const clean = (value, label, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} é obrigatório (até ${max} caracteres).`);
  return value.trim();
};
function oneOf(value, choices, label) {
  if (!choices.includes(value)) throw new Error(`${label} inválido.`);
  return value;
}
export function listPrintingCostTariffs(database) {
  ensurePrintingCostSchema(database);
  return database.prepare('SELECT * FROM printing_cost_tariffs ORDER BY printer_id, effective_from').all();
}
// Versões somente acrescentadas. Alterações nunca regravam preços ou centros de custo anteriores.
export function savePrintingCostTariff(database, input, username) {
  ensurePrintingCostSchema(database);
  const printerId = clean(input.printerId, 'Equipamento');
  const printer = database.prepare('SELECT * FROM printers WHERE id=?').get(printerId);
  if (!printer) throw new Error('Equipamento não encontrado.');
  const effectiveFrom = clean(input.effectiveFrom, 'Início de vigência', 10);
  try { getInclusiveDateSpanDays(effectiveFrom, effectiveFrom); }
  catch { throw new Error('Informe uma data de início válida no formato AAAA-MM-DD.'); }
  const type = oneOf(input.deviceType, ['mono', 'color'], 'Tipo de equipamento');
  const billingRule = oneOf(input.billingRule, ['single', 'unresolved'], 'Regra de cobrança');
  if (type === 'mono' && billingRule !== 'single') throw new Error('Equipamentos monocromáticos usam tarifa única.');
  if (type === 'color' && billingRule === 'single' && input.confirmSingleRate !== true) {
    throw new Error('Confirme que o contrato cobra a mesma tarifa para todas as páginas, inclusive preto e branco.');
  }
  const unitId = input.unitId ? clean(input.unitId, 'Unidade') : null;
  const unit = unitId && database.prepare('SELECT * FROM units WHERE id=?').get(unitId);
  if (unitId && !unit) throw new Error('Unidade não encontrada.');
  const tariff = {
    id: `cost-${crypto.randomUUID()}`, printer_id: printerId, effective_from: effectiveFrom,
    contract: clean(input.contract, 'Contrato'), model: clean(input.model, 'Modelo'),
    paper_format: oneOf(input.paperFormat, ['A4', 'A3', 'A4/A3'], 'Formato'),
    device_type: type, billing_rule: billingRule,
    page_rate_units: decimalToUnits(input.pageRate, 4, 'Tarifa por página'),
    monthly_rent_cents: decimalToUnits(input.monthlyRent, 2, 'Aluguel mensal'),
    rent_rule: oneOf(input.rentRule, ['prorated', 'full_month'], 'Regra do aluguel'),
    unit_id: unitId, unit_name: clean(unit?.name || input.unitName || printer.unit_name, 'Nome da unidade'),
    location: clean(input.location || printer.location, 'Setor'),
    reference_period: clean(input.referencePeriod || effectiveFrom.slice(0, 7), 'Referência', 40),
    source: clean(input.source || 'Configuração informada pelo administrador', 'Origem', 250),
    notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 1000) : '',
    created_by: clean(username, 'Responsável'), created_at: new Date().toISOString()
  };
  database.exec('SAVEPOINT save_printing_cost_tariff');
  try {
    const last = database.prepare('SELECT effective_from FROM printing_cost_tariffs WHERE printer_id=? ORDER BY effective_from DESC LIMIT 1').get(printerId);
    if (last && effectiveFrom <= last.effective_from) throw new Error('Use uma data posterior à última versão para preservar o histórico.');
    const fields = Object.keys(tariff);
    database.prepare(`INSERT INTO printing_cost_tariffs (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(tariff));
    database.exec('RELEASE save_printing_cost_tariff');
    return tariff;
  } catch (error) {
    database.exec('ROLLBACK TO save_printing_cost_tariff'); database.exec('RELEASE save_printing_cost_tariff'); throw error;
  }
}
