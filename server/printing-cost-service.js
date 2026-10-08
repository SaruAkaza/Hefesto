import { getBusinessDateKey, getInclusiveDateSpanDays } from './date-utils.js';
import { listPrintingCostTariffs } from './printing-cost-store.js';
import { referenceForModel } from './printing-cost-catalog.js';
import { listPrintingPagePrices } from './printing-cost-prices.js';

export function validateCostPeriod(start, end) {
  let days;
  try { days = getInclusiveDateSpanDays(start, end); }
  catch { throw new Error('Informe datas válidas e uma data final igual ou posterior à inicial.'); }
  if (days > 366) throw new Error('Consulte no máximo 366 dias por vez.');
  if (end > getBusinessDateKey()) throw new Error('A data final não pode estar no futuro.');
  return days;
}
function dates(start, end) {
  const result = [];
  for (let time = Date.parse(`${start}T12:00:00Z`); time <= Date.parse(`${end}T12:00:00Z`); time += 86400000) result.push(new Date(time).toISOString().slice(0, 10));
  return result;
}
function daysInMonth(date) { return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate(); }
const warnings = {
  missing_tariff: 'Preço não configurado. O volume está disponível, mas falta o preço.',
  missing_readings: 'Há dias sem contadores. O custo de páginas cobre apenas os dados disponíveis.',
  counter_regression: 'O contador diminuiu. Os dias afetados não foram calculados.',
  legacy_history: 'Parte do volume vem de histórico sem sequência de leituras auditáveis.',
  observed_coverage: 'Contagem desde a primeira leitura de cada dia. Impressões fora dessa cobertura podem estar ausentes.',
  color_rule_pending: 'Falta definir a cobrança de preto e branco neste equipamento colorido.',
  full_month_versions: 'Mais de uma versão no mês com aluguel integral. Confira a cobrança contratual.',
  configured_reference: 'Estimativa com os preços cadastrados nesta instalação.',
  general_mono_reference: 'Preço PB geral aplicado; este modelo não tem aluguel no catálogo.',
  missing_rent: 'Aluguel deste modelo não informado no catálogo. Não está incluído no total.',
  rent_range: 'Aluguel informado como faixa; confira a regra contratual.',
  color_split_unavailable: 'O histórico registra apenas o total deste equipamento. A quantidade PB/cor não está separada.',
  color_estimate_range: 'Faixa de estimativa entre o preço PB geral vigente e a tarifa colorida do modelo; a regra PB do contrato não está confirmada.'
};

export function calculatePrintingCostReport(database, { start, end, unitId = '', sector = '', groupBy = 'printer' }) {
  validateCostPeriod(start, end);
  if (!['printer', 'unit', 'sector'].includes(groupBy)) throw new Error('Agrupamento inválido.');
  const tariffs = listPrintingCostTariffs(database);
  const pagePrices = listPrintingPagePrices(database);
  const printers = database.prepare(`SELECT p.*, c.model AS detected_model, c.serial_number
    FROM printers p LEFT JOIN printer_status_cache c ON c.printer_id=p.id ORDER BY p.unit_name, p.location, p.name`).all();
  const histories = database.prepare(`SELECT h.*, EXISTS(SELECT 1 FROM printer_counter_observations o
    WHERE o.printer_id=h.printer_id AND o.date=h.date AND o.status='counter_regression') AS regression,
    (SELECT COUNT(*) FROM printer_counter_observations o WHERE o.printer_id=h.printer_id AND o.date=h.date AND o.status != 'out_of_order') AS samples,
    (SELECT page_count FROM printer_counter_observations o WHERE o.printer_id=h.printer_id AND o.date=h.date AND o.status != 'out_of_order' ORDER BY observed_at,id LIMIT 1) AS first_observed,
    (SELECT MAX(page_count) FROM printer_counter_observations o WHERE o.printer_id=h.printer_id AND o.date=h.date AND o.status != 'out_of_order') AS last_observed
    FROM page_history h WHERE h.date BETWEEN ? AND ?`).all(start, end);
  const historyMap = new Map(histories.map(h => [`${h.printer_id}/${h.date}`, h]));
  const byPrinter = new Map();
  for (const tariff of tariffs) {
    if (!byPrinter.has(tariff.printer_id)) byPrinter.set(tariff.printer_id, []);
    byPrinter.get(tariff.printer_id).push(tariff);
  }
  const calendar = dates(start, end), segments = [];
  for (const printer of printers) {
    const versions = byPrinter.get(printer.id) || [];
    const automatic = referenceForModel(printer.detected_model);
    const reference = automatic && { id: `reference-${printer.id}`, model: automatic.model,
      device_type: automatic.deviceType, billing_rule: automatic.deviceType === 'mono' ? 'single' : 'reference_range',
      page_rate_units: automatic.pageRateUnits, monthly_rent_cents: automatic.monthlyRentCents,
      monthly_rent_min_cents: automatic.monthlyRentMinCents, monthly_rent_max_cents: automatic.monthlyRentMaxCents,
      rent_rule: 'prorated', unit_id: printer.unit_id, unit_name: printer.unit_name || 'Sem unidade',
      location: printer.location || 'Sem setor', reference_period: null, source: automatic.source, automatic: true,
      general_mono_reference: automatic.generalMonoReference };
    if (printer.is_active === 0 && !versions.length && !histories.some(h => h.printer_id === printer.id)) continue;
    const parts = new Map();
    for (const date of calendar) {
      const tariff = versions.findLast(t => t.effective_from <= date) || reference;
      const priceScope = tariff?.device_type === 'mono' ? 'mono' : tariff?.device_type === 'color' ? `color:${referenceForModel(tariff.model)?.model?.replace(/^Lexmark /,'') || ''}` : null;
      const pagePrice = pagePrices.findLast(p => p.scope_key === priceScope && p.effective_from <= date);
      const pageRate = pagePrice?.page_rate_units ?? tariff?.page_rate_units ?? null;
      const monoReferenceRate = pagePrices.findLast(p => p.scope_key === 'mono' && p.effective_from <= date)?.page_rate_units ?? null;
      const source = tariff || { unit_id: printer.unit_id, unit_name: printer.unit_name || 'Sem unidade', location: printer.location || 'Sem setor' };
      if (unitId && source.unit_id !== unitId) continue;
      if (sector && source.location !== sector) continue;
      const key = `${tariff?.id || 'missing'}/${date.slice(0, 7)}`;
      if (!parts.has(key)) parts.set(key, {
        printerId: printer.id, name: printer.name, serialNumber: printer.serial_number || null,
        model: tariff?.model || printer.detected_model || null, tariffId: tariff?.id || null,
        contract: tariff?.contract || null, unitId: source.unit_id, unitName: source.unit_name, location: source.location,
        referencePeriod: tariff?.reference_period || null, source: tariff?.source || null,
        start: date, end: date, pages: 0, measuredDays: 0, expectedDays: 0,
        pageCostCents: null, rentCostCents: null, totalCostCents: null,
        pageRateUnits: pageRate, monthlyRentCents: tariff?.monthly_rent_cents ?? null,
        rentRule: tariff?.rent_rule || null, billingRule: tariff?.billing_rule || null,
        automaticReference: Boolean(tariff?.automatic), deviceType: tariff?.device_type || null,
        monoPages: 0, colorPages: tariff?.device_type === 'mono' ? 0 : null, unclassifiedPages: 0,
        pageCostMinCents: null, pageCostMaxCents: null, rentCostMinCents: null, rentCostMaxCents: null,
        warningCodes: new Set(pageRate === null ? ['missing_tariff'] : ['configured_reference']),
        unpricedPages: 0, _pricedDays: 0,
        _rent: 0, _rentMin: 0, _rentMax: 0, _pageAmount: 0, _minPageAmount: 0, _maxPageAmount: 0, _rates: new Set()
      });
      const row = parts.get(key);
      if (pageRate === null || (tariff?.billing_rule === 'reference_range' && monoReferenceRate === null)) row.warningCodes.add('missing_tariff');
      if (pageRate !== null) row._rates.add(pageRate);
      row.end = date; row.expectedDays++;
      if (tariff) {
        const multiplier = tariff.rent_rule === 'full_month' ? 1 : 1 / daysInMonth(date);
        if (tariff.monthly_rent_cents !== null) {
          if (tariff.rent_rule === 'full_month') row._rent = tariff.monthly_rent_cents;
          else row._rent += tariff.monthly_rent_cents * multiplier;
        }
        if (tariff.automatic) {
          if (tariff.monthly_rent_min_cents !== null) row._rentMin += tariff.monthly_rent_min_cents * multiplier;
          if (tariff.monthly_rent_max_cents !== null) row._rentMax += tariff.monthly_rent_max_cents * multiplier;
          if (tariff.general_mono_reference) row.warningCodes.add('general_mono_reference');
          if (tariff.monthly_rent_min_cents === null) row.warningCodes.add('missing_rent');
          else if (tariff.monthly_rent_cents === null) row.warningCodes.add('rent_range');
          if (tariff.billing_rule === 'reference_range') row.warningCodes.add('color_estimate_range');
        }
        if (tariff.device_type === 'color' && tariff.billing_rule === 'unresolved') row.warningCodes.add('color_rule_pending');
      }
      const history = historyMap.get(`${printer.id}/${date}`);
      const first = history?.samples >= 2 ? history.first_observed : history?.start_page_count;
      const last = history?.samples >= 2 ? history.last_observed : history?.end_page_count;
      const valid = history && Number.isSafeInteger(first) && Number.isSafeInteger(last) && first >= 0 && last >= first;
      if (history?.regression || (history && !valid)) { row.warningCodes.add('counter_regression'); continue; }
      if (!valid || history.samples === 1) { row.warningCodes.add('missing_readings'); continue; }
      const pages = last - first;
      row.pages += pages; row.measuredDays++;
      if (row.deviceType === 'mono') row.monoPages += pages;
      else { row.unclassifiedPages += pages; if (row.deviceType === 'color') row.warningCodes.add('color_split_unavailable'); }
      if (history.samples === 0) row.warningCodes.add('legacy_history');
      else row.warningCodes.add('observed_coverage');
      if (tariff?.billing_rule === 'single' && pageRate !== null) {
        row._pageAmount += pages * pageRate;
        row._pricedDays++;
      }
      if (tariff?.billing_rule === 'reference_range' && pageRate !== null && monoReferenceRate !== null) {
        row._minPageAmount += pages * Math.min(monoReferenceRate,pageRate);
        row._maxPageAmount += pages * Math.max(monoReferenceRate,pageRate);
        row._pricedDays++;
      }
      if (!tariff || tariff.billing_rule === 'unresolved' || pageRate === null || (tariff.billing_rule === 'reference_range' && monoReferenceRate === null)) row.unpricedPages += pages;
    }
    for (const row of parts.values()) {
      row.rentCostCents = row.monthlyRentCents !== null ? Math.round(row._rent) : null;
      if (row.tariffId && row.billingRule === 'single' && row._pricedDays) row.pageCostCents = Math.round(row._pageAmount / 100);
      row.pageCostMinCents = row.pageCostCents; row.pageCostMaxCents = row.pageCostCents;
      if (row.billingRule === 'reference_range' && row._pricedDays) {
        row.pageCostMinCents = Math.round(row._minPageAmount / 100);
        row.pageCostMaxCents = Math.round(row._maxPageAmount / 100);
      }
      row.rentCostMinCents = row.rentCostCents; row.rentCostMaxCents = row.rentCostCents;
      if (row.warningCodes.has('rent_range')) { row.rentCostMinCents = Math.round(row._rentMin); row.rentCostMaxCents = Math.round(row._rentMax); }
      if (row.pageCostCents !== null && row.rentCostCents !== null) row.totalCostCents = row.pageCostCents + row.rentCostCents;
      row.complete = row.measuredDays === row.expectedDays && row.totalCostCents !== null && !row.warningCodes.has('counter_regression') && !row.warningCodes.has('missing_tariff');
      row.status = row.complete ? 'estimate' : 'incomplete';
      row.warningCodes = [...row.warningCodes];
      row.warnings = row.warningCodes.map(code => warnings[code]);
      row.pageRatesUsed = [...row._rates].sort((a,b) => a-b);
      delete row._rent; delete row._rentMin; delete row._rentMax; delete row._pageAmount; delete row._minPageAmount; delete row._maxPageAmount; delete row._rates; delete row._pricedDays;
      segments.push(row);
    }
  }
  // Integral por versão é uma escolha explícita. Não esconder possível cobrança dupla.
  const monthVersions = new Map();
  for (const row of segments.filter(r => r.tariffId)) {
    const key = `${row.printerId}/${row.start.slice(0, 7)}`;
    if (!monthVersions.has(key)) monthVersions.set(key, []);
    monthVersions.get(key).push(row);
  }
  for (const rows of monthVersions.values()) if (rows.length > 1 && rows.some(r => r.rentRule === 'full_month')) for (const row of rows) {
    row.complete = false; row.status = 'incomplete'; row.warningCodes.push('full_month_versions'); row.warnings.push(warnings.full_month_versions);
  }
  const groups = new Map();
  for (const row of segments) {
    const key = groupBy === 'unit' ? JSON.stringify([row.unitId, row.unitName]) : groupBy === 'sector' ? JSON.stringify([row.unitId, row.unitName, row.location]) : JSON.stringify([row.printerId, row.unitId, row.unitName, row.location]);
    if (!groups.has(key)) groups.set(key, { key, label: groupBy === 'unit' ? row.unitName : groupBy === 'sector' ? `${row.unitName} / ${row.location}` : row.name,
      printerId: groupBy === 'printer' ? row.printerId : null, unitName: row.unitName, location: groupBy === 'unit' ? null : row.location,
      pages: 0, knownPageCostCents: 0, knownRentCostCents: 0, knownSubtotalCents: 0, incompleteSegments: 0, segments: [] });
    const group = groups.get(key); group.pages += row.pages;
    group.knownPageCostCents += row.pageCostCents ?? 0; group.knownRentCostCents += row.rentCostCents ?? 0;
    group.knownSubtotalCents += (row.pageCostCents ?? 0) + (row.rentCostCents ?? 0);
    if (!row.complete) group.incompleteSegments++;
    group.segments.push(row);
  }
  const rows = [...groups.values()];
  const totals = rows.reduce((total, row) => ({ pages: total.pages + row.pages,
    knownPageCostCents: total.knownPageCostCents + row.knownPageCostCents,
    knownRentCostCents: total.knownRentCostCents + row.knownRentCostCents,
    knownSubtotalCents: total.knownSubtotalCents + row.knownSubtotalCents,
    incompleteSegments: total.incompleteSegments + row.incompleteSegments }),
  { pages: 0, knownPageCostCents: 0, knownRentCostCents: 0, knownSubtotalCents: 0, incompleteSegments: 0 });
  for (const group of [...rows, totals]) {
    const parts = group === totals ? segments : group.segments;
    Object.assign(group, summarizeCostSegments(parts));
  }
  return { start, end, unitId, sector, groupBy, currency: 'BRL', estimate: true, rows, segments, totals,
    coverageNote: warnings.observed_coverage, referenceNote: warnings.configured_reference };
}

function summarizeCostSegments(parts) {
  const summary = { pages: parts.reduce((sum,s) => sum + s.pages, 0) };
  summary.monoPages = parts.reduce((sum, s) => sum + s.monoPages, 0);
  summary.unclassifiedPages = parts.reduce((sum, s) => sum + s.unclassifiedPages, 0);
  summary.colorPages = summary.unclassifiedPages ? null : 0;
  summary.unpricedPages = parts.reduce((sum, s) => sum + s.unpricedPages, 0);
  summary.pricedPages = summary.pages - summary.unpricedPages;
  summary.pageCostMinCents = parts.some(s => s.pageCostMinCents !== null) ? parts.reduce((sum, s) => sum + (s.pageCostMinCents ?? 0), 0) : null;
  summary.pageCostMaxCents = parts.some(s => s.pageCostMaxCents !== null) ? parts.reduce((sum, s) => sum + (s.pageCostMaxCents ?? 0), 0) : null;
  summary.rentCostMinCents = parts.some(s => s.rentCostMinCents !== null) ? parts.reduce((sum, s) => sum + (s.rentCostMinCents ?? 0), 0) : null;
  summary.rentCostMaxCents = parts.some(s => s.rentCostMaxCents !== null) ? parts.reduce((sum, s) => sum + (s.rentCostMaxCents ?? 0), 0) : null;
  summary.estimatedTotalMinCents = summary.pageCostMinCents !== null || summary.rentCostMinCents !== null ? (summary.pageCostMinCents ?? 0) + (summary.rentCostMinCents ?? 0) : null;
  summary.estimatedTotalMaxCents = summary.pageCostMaxCents !== null || summary.rentCostMaxCents !== null ? (summary.pageCostMaxCents ?? 0) + (summary.rentCostMaxCents ?? 0) : null;
  summary.missingRentPrinters = new Set(parts.filter(s => s.rentCostMaxCents === null).map(s => s.printerId)).size;
  summary.monoRateUnits = [...new Set(parts.filter(s => s.deviceType === 'mono').flatMap(s => s.pageRatesUsed))].sort((a,b) => a-b);
  summary.colorRateUnits = [...new Set(parts.filter(s => s.deviceType === 'color').flatMap(s => s.pageRatesUsed))].sort((a,b) => a-b);
  summary.monoCostCents = parts.some(s => s.deviceType === 'mono' && s.pageCostCents !== null) ? parts.filter(s => s.deviceType === 'mono').reduce((sum,s) => sum + (s.pageCostCents ?? 0),0) : null;
  return summary;
}

// Reutiliza os segmentos por mês e vigência; não recalcula nem grava os preços.
export function calculatePrintingCostMonthlyHistory(database, { startMonth, endMonth, unitId = '', sector = '', groupBy = 'unit' }) {
  const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  if (!validMonth(startMonth) || !validMonth(endMonth) || startMonth > endMonth) throw new Error('Informe um intervalo de meses válido.');
  const today = getBusinessDateKey();
  if (endMonth > today.slice(0,7)) throw new Error('O mês final não pode estar no futuro.');
  const start = `${startMonth}-01`;
  const monthEnd = `${endMonth}-${String(daysInMonth(`${endMonth}-01`)).padStart(2,'0')}`;
  const end = monthEnd > today ? today : monthEnd;
  const report = calculatePrintingCostReport(database, { start, end, unitId, sector, groupBy });
  const monthly = new Map();
  for (const group of report.rows) for (const segment of group.segments) {
    const month = segment.start.slice(0,7), key = JSON.stringify([month, group.key]);
    if (!monthly.has(key)) monthly.set(key, { key, month, label: group.label, unitName: group.unitName, location: group.location, segments: [] });
    monthly.get(key).segments.push(segment);
  }
  const rows = [...monthly.values()].map(row => ({ ...row, ...summarizeCostSegments(row.segments),
    start: row.month+'-01', end: row.month === endMonth ? end : `${row.month}-${String(daysInMonth(row.month+'-01')).padStart(2,'0')}`,
    partialMonth: row.month === today.slice(0,7) && end < monthEnd }));
  rows.sort((a,b) => b.month.localeCompare(a.month) || a.label.localeCompare(b.label,'pt-BR'));
  return { startMonth, endMonth, start, end, unitId, sector, groupBy, currency: 'BRL', estimate: true, rows, totals: report.totals };
}
