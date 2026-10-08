// Contrato puro compartilhado pelo Health Engine (import) e pelo navegador
// (script clássico). Não contém estado de equipamento nem efeitos de rede.
(function (root) {
  'use strict';

  function percentage(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  }

  function component(supply = {}) {
    const name = String(supply.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const type = String(supply.type || '').toLowerCase();
    if (/maintenance box|caixa de manutencao/.test(name)) return 'maintenance';
    if (type === 'waste_toner' || /waste|residuo|coletor/.test(name)) return 'receptacle';
    if (type === 'imaging_kit' || /imaging|imagem|drum|fotocondutor|cilindro|photoconductor/.test(name)) return 'imaging';
    if (['fuser', 'maintenance_kit', 'transfer'].includes(type) || /fuser|fusor|maintenance|manutencao|transfer|belt/.test(name)) return 'maintenance';
    if (['toner', 'ink', 'ink_cartridge'].includes(type) || /toner|tinta|ink|cartucho/.test(name)) return 'consumable';
    return 'unknown';
  }

  function describe(supply = {}, policy = {}) {
    const kind = component(supply);
    const semantics = supply.semantics;
    const reportedPercentage = semantics === 'estimated_remaining_supply' && supply.estimated === true
      ? null : percentage(supply.percentage);
    const name = String(supply.name || '').toLowerCase();
    let metric = 'unknown';
    if (semantics === 'remaining_receptacle_space') metric = 'capacity';
    else if (semantics === 'remaining_maintenance_life') metric = 'life';
    else if (semantics === 'remaining_supply' || !semantics) {
      if (kind === 'consumable') metric = 'level';
      else if (kind === 'imaging' || kind === 'maintenance') metric = 'life';
      else if (kind === 'receptacle' && (supply.mibClass === 'receptacleThatIsFilled' || /restante|remaining/.test(name))) metric = 'capacity';
    }
    // Nome, presença de tanque e estimativa sem perfil não medem nível físico.
    // Componentes desconhecidos conservam o número bruto, sem interpretar zero.
    const pct = kind !== 'unknown' && metric !== 'unknown' ? reportedPercentage : null;
    const base = { kind, metric, percentage: pct, reportedPercentage,
      status: 'unknown', condition: 'unobservable', label: 'Nível não observável',
      valueLabel: reportedPercentage === null ? 'N/D' : `${reportedPercentage}%` };
    if (reportedPercentage === null) return base;
    if (pct === null) return { ...base, condition: 'undetermined', label: 'Não determinado' };

    const criticalAt = policy.criticalSupplyPct ?? 10;
    const warningAt = policy.warningSupplyPct ?? 30;
    let status = pct < criticalAt ? 'critical' : pct <= warningAt ? 'warning' : 'ok';
    let label = metric === 'level' ? 'Nível disponível' : metric === 'capacity' ? 'Capacidade restante' : 'Vida útil restante';
    let condition = 'available';
    if (kind === 'imaging' && pct <= warningAt) {
      status = 'warning';
      condition = 'replacement_recommended';
      label = pct === 0 ? 'Fim de vida estimado · Substituição recomendada' : 'Substituição recomendada';
    } else if (kind === 'consumable' && metric === 'level') {
      if (pct === 0) { status = 'critical'; condition = 'depleted'; label = 'Esgotado'; }
      else if (status !== 'ok') { condition = 'low'; label = status === 'critical' ? 'Nível crítico' : 'Nível baixo'; }
    } else if (status !== 'ok') {
      condition = status === 'critical' ? 'maintenance_required' : 'maintenance_recommended';
      label = pct === 0 && metric === 'capacity' ? 'Sem capacidade restante · Manutenção necessária'
        : status === 'critical' ? 'Manutenção necessária' : 'Manutenção recomendada';
    }
    return { ...base, status, condition, label,
      valueLabel: `${pct}%${metric === 'level' ? '' : ' restante'}` };
  }

  function text(supply, policy) {
    const view = describe(supply, policy);
    return view.status === 'ok' ? view.valueLabel : `${view.valueLabel} · ${view.label}`;
  }

  root.HefestoSupplySemantics = Object.freeze({ percentage, component, describe, text });
})(globalThis);
