/* Ferramenta administrativa independente. Não altera coleta ou inventário. */
(() => {
  let dialog, config, report, monthly, generation = 0, reportVersion = 0, historyVersion = 0;
  const esc = value => escapeHtml(String(value ?? ''));
  const number = value => Number(value).toLocaleString('pt-BR');
  const money = cents => cents === null || cents === undefined ? 'Não disponível' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const rate = units => (units / 10000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const rates = values => values.length ? values.map(rate).join(' / ') : 'Sem tarifa no filtro';
  const range = (min, max) => min === null || max === null ? 'Não disponível' : min === max ? money(min) : `${money(min)} a ${money(max)}`;
  const monthLabel = value => `${value.slice(5,7)}/${value.slice(0,4)}`;
  const dateLabel = value => `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`;
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const f = name => dialog.querySelector(`#cost-${name}`);
  const option = (id, label) => `<option value="${esc(id)}">${esc(label)}</option>`;
  function close() { generation++; dialog?.close(); dialog?.remove(); dialog = null; config = null; report = null; monthly = null; }
  async function request(path, options = {}) {
    const response = await apiFetch(`/api/admin/printing-costs/${path}`, options);
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) close();
      throw new Error(data.error || 'Não foi possível consultar os custos.');
    }
    return data;
  }
  async function open() {
    if (AppState.userRole !== 'admin') return showToast('Apenas administradores podem consultar custos.', 'error');
    close(); const version = generation;
    dialog = document.createElement('dialog'); dialog.className = 'printing-cost-dialog';
    dialog.setAttribute('aria-labelledby', 'cost-title');
    dialog.innerHTML = `<header><div><h2 id="cost-title">Custos de impressão</h2><p class="cost-note">Quantidade × preço por página = total das impressões no período.</p></div><button type="button" class="btn btn-secondary" id="cost-close">Fechar</button></header><div id="cost-body" aria-live="polite">Carregando...</div>`;
    document.body.append(dialog); f('close').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.showModal();
    try {
      const data = await request('config');
      if (version !== generation) return;
      config = data; renderBody(); await loadReport();
    } catch (error) { if (version === generation && dialog) f('body').textContent = error.message; }
  }
  function renderBody() {
    const date = today(), currentMonth = date.slice(0,7);
    const previousMonth = new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7))-2, 1)).toISOString().slice(0,7);
    f('body').innerHTML = `<form id="cost-filter-form"><div class="cost-toolbar">
      <label>De<input id="cost-start" type="date" required value="${currentMonth}-01" max="${date}"></label>
      <label>Até<input id="cost-end" type="date" required value="${date}" max="${date}"></label>
      <label>Unidade<select id="cost-filter-unit"><option value="">Todas as unidades</option>${config.units.map(u => option(u.id,u.name)).join('')}</select></label>
      <label>Setor<select id="cost-sector" disabled><option value="">Selecione uma unidade</option></select></label>
      <label>Visualizar por<select id="cost-group"><option value="unit">Unidade</option><option value="sector">Setor</option><option value="printer">Equipamento</option></select></label>
      </div><div class="cost-actions"><button class="btn btn-primary" id="cost-calculate" type="submit">Consultar período</button><button class="btn btn-secondary" id="cost-export" type="button" disabled>Exportar CSV</button><button class="btn btn-secondary" id="cost-edit-prices" type="button" aria-expanded="false" aria-controls="cost-price-editor">Editar valores</button></div></form>
      <section id="cost-price-editor" class="cost-section" hidden aria-labelledby="cost-price-title"><h3 id="cost-price-title">Editar preço por impressão</h3>
      <p class="cost-note">O preço mono vale para todos os equipamentos monocromáticos, em todas as unidades. A tarifa colorida vale para o modelo escolhido. Alterações valem a partir da data informada; dias anteriores mantêm seus preços.</p>
      <form id="cost-price-form"><div class="cost-price-toolbar"><label>Tipo de impressão<select id="cost-price-type">${config.pagePriceOptions.map(o => option(o.key,o.label)).join('')}</select></label><label>Preço por página (R$)<input id="cost-price-value" type="text" inputmode="decimal" required placeholder="0,05"></label><label>Aplicar a partir de<input id="cost-price-start" type="date" required min="${date}" value="${date}"></label></div><div class="cost-actions"><button class="btn btn-primary" id="cost-price-save" type="submit">Salvar preço</button></div></form>
      <p id="cost-price-status" role="status"></p><details><summary>Alterações de preço</summary><div id="cost-price-changes" class="cost-scroll"></div></details></section>
      <p id="cost-error" class="cost-error" role="alert"></p><div id="cost-results" aria-live="polite"></div>
      <details class="cost-section" id="cost-history-section"><summary>Histórico das Tarifas</summary>
      <p class="cost-note">Volume, preços aplicados e valor estimado mês a mês. Usa a unidade e o setor selecionados acima. O mês atual vai até hoje.</p>
      <form id="cost-history-form"><div class="cost-history-toolbar"><label>De (mês)<input id="cost-history-start" type="month" required value="${previousMonth}" max="${currentMonth}"></label><label>Até (mês)<input id="cost-history-end" type="month" required value="${currentMonth}" max="${currentMonth}"></label><button class="btn btn-primary" id="cost-history-calculate" type="submit">Consultar histórico</button><button class="btn btn-secondary" id="cost-history-export" type="button" disabled>Exportar histórico</button></div></form>
      <p id="cost-history-error" class="cost-error" role="alert"></p><div id="cost-history-results" aria-live="polite"></div></details>
      <p class="cost-note cost-section">Nenhum preço é predefinido. Cadastre os valores da sua instalação. Os preços já salvos são preservados. A consulta principal mostra apenas impressões; o aluguel aparece separado no histórico mensal.</p>`;
    f('filter-form').onsubmit = event => { event.preventDefault(); return refreshFilters(); };
    for (const name of ['start','end','sector','group']) f(name).onchange = refreshFilters;
    f('filter-unit').onchange = () => { updateSectors(); return refreshFilters(); };
    f('history-form').onsubmit = event => { event.preventDefault(); return loadHistory(); };
    for (const name of ['history-start','history-end']) f(name).onchange = loadHistory;
    f('history-section').ontoggle = () => { if (f('history-section').open && !monthly) return loadHistory(); };
    f('export').onclick = () => exportCsv(false); f('history-export').onclick = () => exportCsv(true);
    f('edit-prices').onclick = () => { const editor = f('price-editor'); editor.hidden = !editor.hidden; f('edit-prices').setAttribute('aria-expanded',String(!editor.hidden)); if (!editor.hidden) f('price-type').focus(); };
    f('price-type').onchange = selectPagePrice;
    f('price-form').onsubmit = event => { event.preventDefault(); return savePagePrice(); };
    selectPagePrice(); renderPriceChanges();
  }
  function selectPagePrice() {
    const selected = config.pagePriceOptions.find(o => o.key === f('price-type').value);
    f('price-value').value = (selected.currentRateUnits === null ? '' : (selected.currentRateUnits / 10000).toFixed(4)).replace(/0+$/,'').replace(/\.$/,'').replace('.',',');
    const date = [today(),selected.latestEffectiveFrom || ''].sort().at(-1);
    f('price-start').min = date; f('price-start').value = date;
    f('price-status').textContent = '';
  }
  function renderPriceChanges() {
    f('price-changes').innerHTML = `<table><thead><tr><th>Tipo</th><th>A partir de</th><th>Preço / página</th><th>Responsável</th></tr></thead><tbody>${[...config.pagePrices].reverse().map(p => `<tr><td>${esc(config.pagePriceOptions.find(o => o.key === p.scope_key)?.label || p.scope_key)}</td><td>${dateLabel(p.effective_from)}</td><td>${rate(p.page_rate_units)}</td><td>${esc(p.created_by)}</td></tr>`).join('')}</tbody></table>`;
  }
  async function savePagePrice() {
    if (!f('price-form').reportValidity()) return;
    const version = generation;
    f('price-save').disabled = true; f('price-status').textContent = 'Salvando preço...'; f('price-status').className = '';
    try {
      await request('page-prices', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scopeKey:f('price-type').value,pageRate:f('price-value').value,effectiveFrom:f('price-start').value}) });
      if (version !== generation) return;
      const updated = await request('config');
      if (version !== generation) return;
      config = updated; selectPagePrice(); renderPriceChanges();
      f('price-status').textContent = 'Preço salvo. O cálculo foi atualizado para a data escolhida.';
      await refreshFilters();
    } catch (error) { if (version === generation && dialog) { f('price-status').className = 'cost-error'; f('price-status').textContent = error.message; } }
    finally { if (version === generation && dialog) f('price-save').disabled = false; }
  }
  function updateSectors() {
    const unit = f('filter-unit').value;
    const locations = [...new Set(config.sectors.filter(s => s.unitId === unit).map(s => s.location))].sort((a,b) => a.localeCompare(b,'pt-BR'));
    f('sector').innerHTML = option('',unit ? 'Todos os setores' : 'Selecione uma unidade') + locations.map(l => option(l,l)).join('');
    f('sector').disabled = !unit;
  }
  async function refreshFilters() {
    const historyOpen = f('history-section').open;
    historyVersion++; monthly = null; f('history-export').disabled = true;
    if (historyOpen) await Promise.allSettled([loadReport(),loadHistory()]);
    else { f('history-results').textContent = ''; await loadReport(); }
  }
  function scopeQuery() { return { unitId: f('filter-unit').value, sector: f('sector').value, groupBy: f('group').value }; }
  async function loadReport() {
    const version = generation, requestVersion = ++reportVersion;
    f('calculate').disabled = true; f('export').disabled = true; f('error').textContent = ''; report = null;
    f('results').textContent = 'Calculando as impressões...';
    try {
      const data = await request(`report?${new URLSearchParams({ start:f('start').value, end:f('end').value, ...scopeQuery() })}`);
      if (version !== generation || requestVersion !== reportVersion) return;
      report = data; renderReport(); f('export').disabled = !report.rows.length;
    } catch (error) {
      if (version === generation && requestVersion === reportVersion && dialog) { f('error').textContent = error.message; f('results').textContent = ''; }
    } finally { if (version === generation && requestVersion === reportVersion && dialog) f('calculate').disabled = false; }
  }
  function priceCell(row) {
    return `${row.monoRateUnits.length ? `PB: ${rates(row.monoRateUnits)}` : ''}${row.monoRateUnits.length && row.colorRateUnits.length ? '<br>' : ''}${row.colorRateUnits.length ? `Cor: ${rates(row.colorRateUnits)}` : ''}${!row.monoRateUnits.length && !row.colorRateUnits.length ? 'Sem preço' : ''}`;
  }
  function printTotal(row) { return `${range(row.pageCostMinCents,row.pageCostMaxCents)}${row.unpricedPages ? '<br><span class="cost-warning">Parcial</span>' : ''}`; }
  function renderReport() {
    const t = report.totals;
    f('results').innerHTML = `<div class="cost-summary">
      <div>Páginas no período<strong>${number(t.pages)}</strong></div>
      <div>Preço PB / página<strong>${rates(t.monoRateUnits)}</strong></div>
      <div>Preço colorida / página<strong>${rates(t.colorRateUnits)}</strong></div>
      <div class="cost-total">Total das impressões${t.unpricedPages ? ' (parcial)' : ''}<strong>${range(t.pageCostMinCents,t.pageCostMaxCents)}</strong></div></div>
      <p class="cost-breakdown">Preto e branco: <strong>${number(t.monoPages)} páginas</strong> · custo calculado: <strong>${money(t.monoCostCents)}</strong>. Coloridas: <strong>${t.colorPages === null ? 'quantidade não separada no histórico' : number(t.colorPages)+' páginas'}</strong>${t.unclassifiedPages ? `. Sem separação PB/cor: <strong>${number(t.unclassifiedPages)} páginas</strong>` : ''}.</p>
      ${t.unpricedPages ? `<p class="cost-warning">${number(t.unpricedPages)} páginas sem preço conhecido não estão incluídas no total.</p>` : ''}
      ${t.unclassifiedPages ? '<p class="cost-warning">O histórico contém apenas o contador total de equipamentos coloridos ou sem modelo. A quantidade colorida não é estimada; quando há tarifa, o custo sem separação aparece em faixa.</p>' : ''}
      <div class="cost-scroll"><table><thead><tr><th>${report.groupBy === 'unit' ? 'Unidade' : report.groupBy === 'sector' ? 'Setor' : 'Equipamento'}</th><th>Páginas</th><th>PB</th><th>Coloridas</th><th>Preço por página</th><th>Total das impressões</th></tr></thead><tbody>${report.rows.map(row => `<tr><td>${esc(row.label)}${report.groupBy === 'printer' ? `<br><span class="cost-note">${esc(row.unitName)} / ${esc(row.location)}</span>` : ''}</td><td class="cost-number">${number(row.pages)}</td><td class="cost-number">${number(row.monoPages)}</td><td>${row.colorPages === null ? `Não separado<br><span class="cost-note">${number(row.unclassifiedPages)} páginas PB/cor</span>` : number(row.colorPages)}</td><td>${priceCell(row)}</td><td class="cost-number">${printTotal(row)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum equipamento encontrado para o filtro.</td></tr>'}</tbody></table></div>
      <p class="cost-note">${esc(report.coverageNote)} Páginas são faces impressas, inclusive frente e verso. Valores estimados com o histórico disponível.</p>`;
  }
  async function loadHistory() {
    const version = generation, requestVersion = ++historyVersion;
    f('history-calculate').disabled = true; f('history-export').disabled = true; f('history-error').textContent = ''; monthly = null;
    f('history-results').textContent = 'Consultando os meses...';
    try {
      const data = await request(`history?${new URLSearchParams({ startMonth:f('history-start').value,endMonth:f('history-end').value,...scopeQuery() })}`);
      if (version !== generation || requestVersion !== historyVersion) return;
      monthly = data; renderHistory(); f('history-export').disabled = !monthly.rows.length;
    } catch (error) {
      if (version === generation && requestVersion === historyVersion && dialog) { f('history-error').textContent = error.message; f('history-results').textContent = ''; }
    } finally { if (version === generation && requestVersion === historyVersion && dialog) f('history-calculate').disabled = false; }
  }
  function renderHistory() {
    const t = monthly.totals;
    f('history-results').innerHTML = `<p class="cost-note">De ${dateLabel(monthly.start)} a ${dateLabel(monthly.end)} · ${number(t.pages)} páginas · impressões: ${range(t.pageCostMinCents,t.pageCostMaxCents)}.</p>
      <div class="cost-scroll"><table><thead><tr><th>Mês / período</th><th>${monthly.groupBy === 'unit' ? 'Unidade' : monthly.groupBy === 'sector' ? 'Setor' : 'Equipamento'}</th><th>Páginas PB / cor</th><th>Preço por página</th><th>Impressões</th><th>Aluguel conhecido</th><th>Total mensal estimado</th></tr></thead><tbody>${monthly.rows.map(row => `<tr><td>${monthLabel(row.month)}${row.partialMonth ? ' (em andamento)' : ''}<br><span class="cost-note">${dateLabel(row.start)} a ${dateLabel(row.end)}</span></td><td>${esc(row.label)}</td><td>${number(row.pages)} no total<br>PB: ${number(row.monoPages)}<br>Cor: ${row.colorPages === null ? 'não separado' : number(row.colorPages)}</td><td>${priceCell(row)}</td><td class="cost-number">${printTotal(row)}</td><td class="cost-number">${range(row.rentCostMinCents,row.rentCostMaxCents)}</td><td class="cost-number">${range(row.estimatedTotalMinCents,row.estimatedTotalMaxCents)}${row.unpricedPages || row.missingRentPrinters ? '<br><span class="cost-warning">Parcial</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7">Sem registros para os filtros escolhidos.</td></tr>'}</tbody></table></div>
      <p class="cost-note">Total mensal = impressões + aluguel conhecido. Aluguel de referência proporcional aos dias; preços salvos mantêm sua regra. Valores ausentes não são tratados como zero.</p>`;
  }
  function exportCsv(isHistory) {
    const data = isHistory ? monthly : report;
    if (!data || AppState.userRole !== 'admin') return;
    const safeCell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g,'""')}"`; };
    const amount = value => value === null ? '' : (value/100).toFixed(2).replace('.',',');
    const rows = [['Período inicial','Período final','Unidade / setor / equipamento','Páginas','PB identificado','Coloridas identificadas','Sem separação PB/cor','Preço PB R$','Preço colorida R$','Impressões mínimo R$','Impressões máximo R$',...(isHistory ? ['Aluguel mínimo R$','Aluguel máximo R$','Total mensal mínimo R$','Total mensal máximo R$'] : []),'Observação'],
      ...data.rows.map(row => [row.start || data.start,row.end || data.end,row.label,row.pages,row.monoPages,row.colorPages,row.unclassifiedPages,row.monoRateUnits.map(u => (u/10000).toFixed(4).replace('.',',')).join(' / '),row.colorRateUnits.map(u => (u/10000).toFixed(4).replace('.',',')).join(' / '),amount(row.pageCostMinCents),amount(row.pageCostMaxCents),...(isHistory ? [amount(row.rentCostMinCents),amount(row.rentCostMaxCents),amount(row.estimatedTotalMinCents),amount(row.estimatedTotalMaxCents)] : []),row.unpricedPages || (isHistory && row.missingRentPrinters) ? 'Estimativa parcial' : 'Estimativa com dados disponíveis'])];
    const url = URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row => row.map(safeCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href = url; link.download = `hefesto-${isHistory ? 'historico-tarifas' : 'impressoes'}-${data.start}-${data.end}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  document.getElementById('btn-printing-costs')?.addEventListener('click',open);
  document.getElementById('btn-logout')?.addEventListener('click',close);
  window.PrintingCosts = {open,close};
})();
