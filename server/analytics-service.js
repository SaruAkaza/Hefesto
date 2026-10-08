/**
 * Analytics and Forecast Engine (Projeto Hefesto)
 *
 * Implementa semântica rigorosa para previsões de consumo e carga de trabalho:
 * - Separa produção observada, rendimento medido, rendimento nominal documentado e previsão.
 * - Suprimentos desconhecidos ou estimados nunca recebem percentuais inventados (ex: 85% em tanque).
 * - Sem perfil cadastrado, o rendimento nominal é estritamente nulo (sem adivinhação por marca).
 * - Sem histórico de consumo ou sem rendimento nominal, a previsão é declarada indisponível.
 * - Regressões de contador não produzem números negativos ou continuidade fictícia.
 */

export function isRefillableTank(supply) {
  if (!supply || !supply.name) return false;
  const lower = String(supply.name || '').toLowerCase();
  return (
    lower.includes('ink bottle') ||
    lower.includes('tanque de tinta') ||
    lower.includes('bottle') ||
    lower.includes('garrafa') ||
    supply.semantics === 'estimated_remaining_supply'
  );
}

export function normalizeSupplyPercentage(supply) {
  if (!supply) return null;

  // Suprimento explicitamente estimado ou tanque sem sensor direto não possui percentual medido
  if (supply.estimated || isRefillableTank(supply)) {
    return null;
  }

  if (supply.percentage !== null && supply.percentage !== undefined && supply.percentage !== '') {
    // Códigos especiais Printer-MIB (-2 someRemaining, -3 atLeastSomeRemaining) são qualitativos, não numéricos
    if (supply.percentage === -2 || supply.percentage === -3) {
      return null;
    }

    const p = Number(supply.percentage);
    if (Number.isFinite(p) && p >= 0) {
      return Math.max(0, Math.min(100, Math.round(p)));
    }
  }

  if (typeof supply.level === 'number' && typeof supply.maxLevel === 'number' && supply.maxLevel > 0) {
    return Math.max(0, Math.min(100, Math.round((supply.level / supply.maxLevel) * 100)));
  }

  return null;
}

export function getPrinterNominalMetrics(modelStr, printerName, database = null) {
  const model = String(modelStr || printerName || '').trim();
  if (!model || !database) {
    return {
      monthlyMaxNominal: null,
      blackYieldNominal: null,
      colorYieldNominal: null,
      source: null,
      sku: null
    };
  }

  try {
    // Procura perfil exato ou por correspondência de padrão na tabela consumable_profiles
    const row = database.prepare(`
      SELECT * FROM consumable_profiles
      WHERE ? LIKE '%' || model_pattern || '%' OR model_pattern LIKE '%' || ? || '%'
      ORDER BY nominal_yield_pages DESC
      LIMIT 1
    `).get(model, model);

    if (row && row.nominal_yield_pages > 0) {
      return {
        monthlyMaxNominal: null,
        blackYieldNominal: row.nominal_yield_pages,
        colorYieldNominal: row.nominal_yield_pages,
        source: row.nominal_yield_source || 'consumable_profiles',
        sku: row.sku || null
      };
    }
  } catch {
    // Tabela pode não estar criada ou sem dados
  }

  // Sem perfil cadastrado com fonte oficial: retorna nulo em vez de supor rendimentos genéricos por marca
  return {
    monthlyMaxNominal: null,
    blackYieldNominal: null,
    colorYieldNominal: null,
    source: null,
    sku: null
  };
}

export function calculateConsumableForecast({
  supply,
  avgPagesPerDay,
  nominalYield,
  isEstimated = false
} = {}) {
  if (!supply) {
    return {
      available: false,
      reason: 'missing_supply',
      pagesRemainingEstimated: null,
      daysRemainingEstimated: null,
      estimatedDepletionDate: null
    };
  }

  const estimated = Boolean(
    isEstimated ||
    supply.estimated ||
    supply.semantics === 'estimated_remaining_supply' ||
    isRefillableTank(supply)
  );

  if (estimated) {
    return {
      available: false,
      reason: 'estimated_supply_unmeasurable',
      pagesRemainingEstimated: null,
      daysRemainingEstimated: null,
      estimatedDepletionDate: null
    };
  }

  const percentage = normalizeSupplyPercentage(supply);
  if (percentage === null) {
    return {
      available: false,
      reason: 'unknown_percentage',
      pagesRemainingEstimated: null,
      daysRemainingEstimated: null,
      estimatedDepletionDate: null
    };
  }

  const yieldPages = Number(nominalYield);
  if (!Number.isFinite(yieldPages) || yieldPages <= 0) {
    return {
      available: false,
      reason: 'missing_nominal_profile',
      pagesRemainingEstimated: null,
      daysRemainingEstimated: null,
      estimatedDepletionDate: null
    };
  }

  const dailyBurn = Number(avgPagesPerDay);
  if (!Number.isFinite(dailyBurn) || dailyBurn <= 0) {
    return {
      available: false,
      reason: 'no_consumption_history',
      pagesRemainingEstimated: null,
      daysRemainingEstimated: null,
      estimatedDepletionDate: null
    };
  }

  const pagesRemainingEstimated = Math.max(0, Math.round(yieldPages * (percentage / 100)));
  const daysRemainingEstimated = Math.max(1, Math.round(pagesRemainingEstimated / dailyBurn));
  const targetDate = new Date(Date.now() + daysRemainingEstimated * 86400000);
  const estimatedDepletionDate = targetDate.toISOString().split('T')[0];

  return {
    available: true,
    reason: null,
    pagesRemainingEstimated,
    daysRemainingEstimated,
    estimatedDepletionDate
  };
}

export function calculateWorkload(projectedMonthly, monthlyMaxNominal) {
  const maxNominal = Number(monthlyMaxNominal);
  if (!Number.isFinite(maxNominal) || maxNominal <= 0) {
    return {
      capacityRatio: null,
      workloadStatus: 'unknown',
      workloadLabel: 'Capacidade Não Calibrada'
    };
  }

  const projected = Number(projectedMonthly) || 0;
  const capacityRatio = Math.round((projected / maxNominal) * 100);

  if (capacityRatio > 75) {
    return {
      capacityRatio,
      workloadStatus: 'high',
      workloadLabel: 'Alta Carga'
    };
  }
  if (capacityRatio < 20) {
    return {
      capacityRatio,
      workloadStatus: 'low',
      workloadLabel: 'Ociosa'
    };
  }
  return {
    capacityRatio,
    workloadStatus: 'ideal',
    workloadLabel: 'Carga Ideal'
  };
}

export function calculateProductionDelta(startCount, endCount) {
  if (startCount === null || startCount === undefined || endCount === null || endCount === undefined) {
    return { delta: 0, regression: false, valid: false };
  }

  const start = Number(startCount);
  const end = Number(endCount);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
    return { delta: 0, regression: false, valid: false };
  }

  if (end < start) {
    return { delta: 0, regression: true, valid: false };
  }

  return { delta: Math.trunc(end - start), regression: false, valid: true };
}
