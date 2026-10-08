/* Fluxo genérico: consulta somente leitura, confirmação e ativos preservados. */
(() => {
  let dialog = null;
  let version = 0;
  const esc = value => escapeHtml(String(value ?? ''));
  const count = value => Number.isSafeInteger(value) ? value.toLocaleString('pt-BR') : 'Desconhecido';
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : 'Em uso';
  async function request(url, options = {}) {
    const response = await apiFetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível executar a operação.');
    return data;
  }
  function shell(title, content) {
    if (dialog) { dialog.close(); dialog.remove(); }
    version++;
    dialog = document.createElement('dialog');
    dialog.className = 'asset-dialog';
    dialog.setAttribute('aria-labelledby', 'asset-dialog-title');
    dialog.innerHTML = `<header><h2 id="asset-dialog-title">${esc(title)}</h2><button class="btn btn-secondary" type="button" data-close aria-label="Fechar">Fechar</button></header>${content}`;
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.showModal();
    return dialog;
  }
  async function open(id, proposedIp) {
    if (AppState.userRole !== 'admin') return showToast('Apenas administradores podem substituir equipamentos.', 'error');
    const old = AppState.printers.find(p => p.id === id);
    if (!old) return;
    const oldInfo = AppState.statusData.get(id)?.info || {};
    const view = shell('Substituir impressora', `
      <div class="asset-context"><strong>${esc(old.unitName)} • ${esc(old.location || old.name)}</strong>
        <p>Equipamento atual: ${esc(oldInfo.model || old.name)} · IP ${esc(old.ip)} · Série ${esc(oldInfo.serialNumber || 'Desconhecida')}</p>
        <p>O equipamento antigo será desativado e continuará no histórico com seus contadores e recargas.</p></div>
      <form id="asset-replacement-form">
        <div class="asset-grid">
          <label class="asset-wide">Origem do equipamento<select id="asset-source"><option value="">Cadastrar novo equipamento físico</option></select></label>
          <label>IP do equipamento instalado<input id="asset-ip" required value="${esc(proposedIp || old.ip)}" placeholder="198.18.6.50"></label>
          <label>Comunidade SNMP<input id="asset-community" value="${esc(old.community || 'public')}"></label>
          <div class="asset-wide"><button type="button" class="btn btn-secondary" id="asset-probe">Consultar equipamento neste IP</button>
            <p class="asset-message" id="asset-probe-message" role="status">Consulte o IP ou preencha manualmente os dados disponíveis. A consulta não grava uma substituição.</p></div>
          <label>Nome do novo equipamento<input id="asset-name" required value="${esc(old.name)}"></label>
          <label>Modelo<input id="asset-model" placeholder="Opcional se não houver leitura"></label>
          <label>Número de série<input id="asset-serial" placeholder="Desconhecido"></label>
          <label>MAC<input id="asset-mac" placeholder="00:11:22:33:44:55"></label>
          <label>Contador na instalação<input id="asset-counter" type="number" min="0" step="1" placeholder="Desconhecido — deixe vazio"></label>
          <label>Unidade de destino<select id="asset-unit"></select></label>
          <label class="asset-wide">Setor / localização<input id="asset-location" required value="${esc(old.location || '')}"></label>
          <label class="asset-wide">Motivo da substituição<textarea id="asset-reason" required rows="2"></textarea></label>
          <label class="asset-wide">Observações<textarea id="asset-notes" rows="2"></textarea></label>
        </div>
        <label class="asset-confirm"><input id="asset-confirm" type="checkbox" required>
          <span>Confirmo a troca física e os dados acima. O ativo antigo será preservado. Ao associar uma reserva, ela sairá do local anterior e manterá seu histórico acumulado.</span></label>
        <p id="asset-error" class="asset-error" role="alert"></p>
        <footer><span>Responsável registrado pela sessão autenticada.</span><button type="submit" id="asset-submit" class="btn btn-primary">Confirmar substituição</button></footer>
      </form>`);
    const generation = version;
    const field = name => view.querySelector(`#asset-${name}`);
    let assets = [];
    let wasOnline = false;
    field('unit').innerHTML = AppState.units.map(u => `<option value="${esc(u.id)}" ${u.id === old.unitId ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
    if (!old.unitId) field('unit').insertAdjacentHTML('afterbegin', '<option value="" selected>Manter unidade atual</option>');
    try {
      assets = await request('/api/printer-assets');
      if (generation !== version) return;
      field('source').insertAdjacentHTML('beforeend', assets.filter(p => p.id !== id).map(p =>
        `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.unitName)} / ${esc(p.location)}${p.isActive ? '' : ' (desativada)'}</option>`).join(''));
    } catch (error) { field('error').textContent = error.message; }
    field('source').onchange = async () => {
      field('confirm').checked = false;
      const selected = assets.find(p => p.id === field('source').value);
      field('name').readOnly = Boolean(selected);
      field('name').value = selected?.name || old.name;
      for (const name of ['model', 'serial', 'mac', 'counter']) field(name).value = '';
      wasOnline = false;
      if (selected) {
        const chosen = selected.id;
        try {
          const history = await request(`/api/printers/${encodeURIComponent(chosen)}/asset-history`);
          if (generation !== version || field('source').value !== chosen) return;
          field('confirm').checked = false;
          field('model').value = history.status?.info?.model || '';
          field('serial').value = history.status?.info?.serialNumber || '';
          field('mac').value = selected.macAddress || '';
          // Contador da nova alocação será consultado ou informado, sem regravar a base do ativo.
        } catch (error) { field('error').textContent = error.message; }
      }
    };
    field('probe').onclick = async () => {
      field('probe').disabled = true;
      field('submit').disabled = true;
      field('confirm').disabled = true;
      field('confirm').checked = false;
      field('error').textContent = '';
      const ip = field('ip').value.trim();
      field('probe-message').textContent = 'Consultando SNMP e MAC...';
      try {
        const result = await request(`/api/printers/${encodeURIComponent(id)}/replacement-preview`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip, community: field('community').value.trim() })
        });
        if (generation !== version || field('ip').value.trim() !== ip) return;
        field('confirm').checked = false;
        field('model').value = result.info.model || '';
        field('serial').value = result.info.serialNumber || '';
        field('mac').value = result.macAddress || '';
        field('counter').value = result.info.pageCount ?? '';
        wasOnline = result.online;
        field('probe-message').textContent = result.message;
      } catch (error) { field('probe-message').textContent = error.message; }
      finally {
        field('probe').disabled = false;
        field('submit').disabled = false;
        field('confirm').disabled = false;
        field('confirm').checked = false;
      }
    };
    for (const input of view.querySelectorAll('input:not([type=checkbox]), select, textarea')) {
      input.addEventListener('input', () => { field('confirm').checked = false; });
    }
    field('ip').addEventListener('input', () => {
      wasOnline = false;
      for (const name of ['model', 'serial', 'mac', 'counter']) field(name).value = '';
      field('probe-message').textContent = 'IP alterado. Consulte novamente ou preencha os dados manualmente.';
    });
    view.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      if (!field('confirm').checked || field('submit').disabled) return;
      field('submit').disabled = true;
      field('error').textContent = '';
      const raw = field('counter').value.trim();
      const payload = { newPrinter: { name: field('name').value.trim(), ip: field('ip').value.trim(), model: field('model').value.trim(),
        serialNumber: field('serial').value.trim(), macAddress: field('mac').value.trim(), community: field('community').value.trim() },
        associatedPrinterId: field('source').value || undefined, targetUnitId: field('unit').value || undefined,
        targetLocation: field('location').value.trim(), reason: field('reason').value.trim(), notes: field('notes').value.trim(),
        initialCounter: raw === '' ? null : Number(raw), replacementMode: wasOnline ? 'created_new' : 'manual', confirmed: true };
      try {
        await request(`/api/printers/${encodeURIComponent(id)}/replace`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      } catch (error) {
        field('error').textContent = error.message;
        field('submit').disabled = false;
        return;
      }
      // O commit já foi confirmado. Uma falha de apresentação não autoriza outra troca.
      field('submit').textContent = 'Substituição registrada';
      field('confirm').disabled = true;
      showToast('Substituição registrada. O histórico anterior foi preservado.', 'success');
      try {
        view.close();
        closePrinterDetailDrawer();
        await loadDashboardData(false, false);
      } catch (error) {
        console.warn('[Substituição] Falha ao atualizar a tela após a gravação:', error);
        showToast('A substituição já foi registrada. Recarregue o painel para atualizar a tela; não repita a troca.', 'warning');
      }
    };
  }
  async function history(id) {
    try {
      const assets = await request('/api/printer-assets');
      const view = shell('Histórico de equipamentos', `<label>Selecione um ativo, inclusive desativado<select id="asset-history-select">
        <option value="">Selecionar...</option>${assets.map(p => `<option value="${esc(p.id)}">${esc(p.unitName)} · ${esc(p.location || p.name)} · ${esc(p.name)} ${p.isActive ? '(ativo)' : '(desativado)'}</option>`).join('')}</select></label>
        <div id="asset-history-body" aria-live="polite"><p>Selecione um equipamento para consultar seu histórico.</p></div>`);
      const generation = version;
      const select = view.querySelector('select');
      const body = view.querySelector('#asset-history-body');
      select.onchange = async () => {
        const selected = select.value;
        if (!selected) return;
        body.textContent = 'Carregando histórico...';
        try {
          const data = await request(`/api/printers/${encodeURIComponent(selected)}/asset-history`);
          if (generation !== version || select.value !== selected) return;
          const p = data.printer;
          body.innerHTML = `<div class="asset-context"><h3>${esc(p.name)} — ${p.isActive ? 'Ativo' : 'Desativado'}</h3>
            <p>${esc(data.status?.info?.model || 'Modelo desconhecido')} · IP ${esc(p.ip)} · Série ${esc(data.status?.info?.serialNumber || 'Desconhecida')}</p>
            <p>Base do ativo: ${count(p.initialPageCount)} · Último contador: ${count(data.status?.info?.pageCount)} · Recargas preservadas: ${data.recharges.length}</p></div>
            <h3>Substituições</h3>${data.replacements.map(r => `<div class="asset-event"><strong>${esc(date(r.replaced_at))}</strong>
              <p>${esc(r.replaced_printer_name)} → ${esc(r.new_printer_name)} · ${esc(r.target_unit_name)} / ${esc(r.target_location)}</p>
              <p>${esc(r.replaced_by)} · ${esc(r.reason)} · Contador na troca: ${count(r.initial_counter)}</p>
              <button type="button" class="btn btn-secondary" data-asset="${esc(r.replaced_printer_id)}">Consultar antigo</button>
              <button type="button" class="btn btn-secondary" data-asset="${esc(r.new_printer_id)}">Consultar sucessor</button></div>`).join('') || '<p>Nenhuma substituição registrada.</p>'}
            <h3>Alocações</h3><p>Registros anteriores à atualização não são reconstruídos sem evidências.</p>
            ${data.allocations.map(a => `<p>${esc(a.unit_name)} / ${esc(a.location)} · ${esc(date(a.started_at))} → ${esc(date(a.ended_at))} · Base: ${count(a.start_counter)}</p>`).join('') || '<p>Sem alocação registrada nesta versão.</p>'}
            <details><summary>Contadores diários preservados (${data.pageHistory.length})</summary><div class="asset-table-wrap"><table><thead><tr><th>Data</th><th>Início</th><th>Fim</th></tr></thead><tbody>
              ${data.pageHistory.map(h => `<tr><td>${esc(h.date)}</td><td>${count(h.startPageCount)}</td><td>${count(h.endPageCount)}</td></tr>`).join('')}</tbody></table></div></details>
            <details><summary>Recargas preservadas (${data.recharges.length})</summary>${data.recharges.map(r => `<p>${esc(date(r.timestamp))} · ${esc(r.supplyName)} · ${esc(r.technician || '')}</p>`).join('')}</details>`;
          for (const button of body.querySelectorAll('[data-asset]')) button.onclick = () => { select.value = button.dataset.asset; select.onchange(); };
        } catch (error) { body.textContent = error.message; }
      };
      if (id) { select.value = id; await select.onchange(); }
    } catch (error) { showToast(error.message, 'error'); }
  }
  window.PrinterReplacement = { open, history };
  document.getElementById('btn-detail-replace')?.addEventListener('click', () => open(currentDrawerPrinterId));
  document.getElementById('btn-detail-asset-history')?.addEventListener('click', () => history(currentDrawerPrinterId));
  document.getElementById('btn-asset-history')?.addEventListener('click', () => history());
  document.getElementById('btn-form-replace')?.addEventListener('click', () => {
    const id = DOM.formId.value;
    const ip = DOM.formIp.value;
    closeModalForm();
    open(id, ip);
  });
})();
