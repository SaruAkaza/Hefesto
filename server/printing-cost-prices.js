import { PRINTING_COST_CATALOG } from './printing-cost-catalog.js';
import { decimalToUnits } from './printing-cost-store.js';
import { getBusinessDateKey, getInclusiveDateSpanDays } from './date-utils.js';

export const PRINTING_PAGE_PRICE_OPTIONS = Object.freeze([
  { key: 'mono', label: 'Preto e branco — todos os mono', defaultRateUnits: null },
  ...PRINTING_COST_CATALOG.filter(c => c.type === 'color').map(c => ({
    key: `color:${c.model}`, label: `Colorida — ${c.brand} ${c.model}`,
    defaultRateUnits: null
  }))
]);

export function ensurePrintingPagePriceSchema(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS printing_cost_page_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_key TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    page_rate_units INTEGER NOT NULL CHECK(page_rate_units >= 0),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_printing_cost_page_prices_scope ON printing_cost_page_prices(scope_key,effective_from,id);`);

}

export function listPrintingPagePrices(database) {
  ensurePrintingPagePriceSchema(database);
  return database.prepare('SELECT * FROM printing_cost_page_prices ORDER BY scope_key,effective_from,id').all();
}

export function savePrintingPagePrice(database, input, username) {
  ensurePrintingPagePriceSchema(database);
  if (!PRINTING_PAGE_PRICE_OPTIONS.some(o => o.key === input.scopeKey)) throw new Error('Selecione um tipo de impressão válido.');
  try { getInclusiveDateSpanDays(input.effectiveFrom, input.effectiveFrom); }
  catch { throw new Error('Informe uma data inicial válida.'); }
  if (input.effectiveFrom < getBusinessDateKey()) throw new Error('Use hoje ou uma data futura para preservar os dias anteriores.');
  const pageRateUnits = decimalToUnits(input.pageRate, 4, 'Preço por página');
  if (typeof username !== 'string' || !username.trim()) throw new Error('Responsável não identificado.');
  database.exec('SAVEPOINT printing_page_price');
  try {
    const last = database.prepare('SELECT effective_from FROM printing_cost_page_prices WHERE scope_key=? ORDER BY effective_from DESC,id DESC LIMIT 1').get(input.scopeKey);
    if (last && input.effectiveFrom < last.effective_from) throw new Error(`Use uma data igual ou posterior a ${last.effective_from} para preservar o histórico.`);
    const createdAt = new Date().toISOString();
    const result = database.prepare('INSERT INTO printing_cost_page_prices(scope_key,effective_from,page_rate_units,created_by,created_at) VALUES(?,?,?,?,?)')
      .run(input.scopeKey,input.effectiveFrom,pageRateUnits,username.trim(),createdAt);
    database.exec('RELEASE printing_page_price');
    return { id: Number(result.lastInsertRowid), scope_key: input.scopeKey, effective_from: input.effectiveFrom, page_rate_units: pageRateUnits, created_by: username.trim(), created_at: createdAt };
  } catch (error) {
    database.exec('ROLLBACK TO printing_page_price'); database.exec('RELEASE printing_page_price'); throw error;
  }
}

export function currentPrintingPagePriceOptions(prices) {
  const today = getBusinessDateKey();
  return PRINTING_PAGE_PRICE_OPTIONS.map(option => ({ ...option,
    currentRateUnits: prices.findLast(p => p.scope_key === option.key && p.effective_from <= today)?.page_rate_units ?? option.defaultRateUnits,
    latestEffectiveFrom: prices.findLast(p => p.scope_key === option.key)?.effective_from || null
  }));
}
