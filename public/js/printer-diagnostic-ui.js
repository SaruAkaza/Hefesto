(function (root) {
  'use strict';
  let currentPrinter = null, selectedTab = 'overview', sequence = 0;
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : 'N/D';
  const comparisons = { changed: 'Mudança técnica observada', unchanged: 'Nenhuma mudança observada',
    not_observable: 'Alteração técnica não observável', waiting_for_reading: 'Aguardando leitura posterior', identity_mismatch: 'Identidade diferente: comparação bloqueada' };
  const outcomes = { performed: 'Realizada — declaração do técnico', failed: 'Falhou — declaração do técnico', cancelled: 'Registro cancelado pelo técnico' };
  function add(parent, tag, text, className) {
    const e = parent.ownerDocument.createElement(tag); if (text != null) e.textContent = text;
    if (className) e.className = className; parent.append(e); return e;
  }
  // HTTP on the hospital LAN may not expose randomUUID (secure contexts only).
  const key = () => root.crypto?.randomUUID ? root.crypto.randomUUID() :
    root.crypto?.getRandomValues ? Array.from(root.crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('') :
    `request-${Date.now()}-${++sequence}`;
  function button(parent, label) { const b = add(parent, 'button', label, 'btn btn-secondary btn-sm'); b.type = 'button'; return b; }
  function link(parent, label, value, device = false) {
    try {
      const u = new URL(value);
      const valid = device ? u.protocol === 'http:' && /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) && u.hostname.split('.').every(n => Number(n) <= 255) && u.pathname === '/' :
        u.protocol === 'https:' && ['publications.lexmark.com', 'support.lexmark.com'].includes(u.hostname);
      if (!valid || u.username || u.password || u.port) return;
      const a = add(parent, 'a', label, 'btn btn-secondary btn-sm'); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    } catch { /* No executable or unverified destination. */ }
  }
  function field(form, label, tag = 'input') {
    const wrapper = add(form, 'label', null, 'technical-field'); add(wrapper, 'span', label);
    return add(wrapper, tag, null, 'form-input');
  }
  function mount(container, printerId, api, { canWrite = false, onTelemetry } = {}) {
    if (currentPrinter !== printerId) selectedTab = 'overview'; currentPrinter = printerId;
    const session = {}; container._diagnosticSession = session;
    const alive = () => container.isConnected && container._diagnosticSession === session;
    const children = [...container.children], nav = add(container, 'div', null, 'printer-diagnostic-tabs');
    container.prepend(nav); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Diagnóstico da impressora');
    const names = { overview: 'Visão geral', supplies: 'Suprimentos', history: 'Histórico técnico' }, tabs = {}, panels = {}, prefix = `printer-diagnostic-${++sequence}`;
    for (const [name, label] of Object.entries(names)) {
      const tab = button(nav, label), panel = add(container, 'section', null, 'printer-diagnostic-panel');
      tab.id = `${prefix}-${name}-tab`; panel.id = `${prefix}-${name}`;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
      tabs[name] = tab; panels[name] = panel;
    }
    for (const child of children) (panels[child.dataset.diagnosticPanel] || panels.overview).append(child);
    const select = name => { selectedTab = name; for (const n of Object.keys(tabs)) {
      tabs[n].setAttribute('aria-selected', String(n === name)); tabs[n].tabIndex = n === name ? 0 : -1; panels[n].hidden = n !== name;
    } };
    for (const [name, tab] of Object.entries(tabs)) {
      tab.addEventListener('click', () => select(name));
      tab.addEventListener('keydown', e => {
        const keys = Object.keys(tabs), index = keys.indexOf(name);
        const next = e.key === 'ArrowRight' ? (index + 1) % keys.length : e.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : null;
        if (next !== null) { e.preventDefault(); select(keys[next]); tabs[keys[next]].focus(); }
      });
    }
    select(selectedTab);
    const technical = add(panels.history, 'section', null, 'technical-audit-card'); panels.history.prepend(technical);
    const alertHistory = add(panels.history, 'section', null, 'device-alert-card');
    const alertCache = new Map();
    const getAlerts = (id, offset) => { if (!alertCache.has(offset)) alertCache.set(offset, Promise.resolve().then(() => api.getPrinterAlerts(id, offset))); return alertCache.get(offset); };
    root.DeviceAlertsUI?.load(container.querySelector('#device-alert-details'), printerId, getAlerts, { currentOnly: true });
    root.DeviceAlertsUI?.load(alertHistory, printerId, getAlerts, { historyOnly: true });
    const notice = add(technical, 'p', 'Consultando histórico técnico…', 'device-alert-meta'); notice.setAttribute('role', 'status');
    async function run(target, operation, after) {
      const buttons = [...target.querySelectorAll('button')]; for (const b of buttons) b.disabled = true;
      notice.textContent = 'Registrando…';
      try {
        const result = await operation(); if (!alive()) return;
        notice.textContent = 'Registro salvo.';
        if (after) await after(result); else await load();
      } catch (error) { if (alive()) { notice.textContent = error.message || 'Não foi possível salvar. Tente novamente.'; for (const b of buttons) b.disabled = false; } }
    }
    function recordCard(parent, record) {
      const card = add(parent, 'details', null, 'technical-record');
      add(card, 'summary', `${record.actionLabel} · ${date(record.startedAt)} · ${record.outcome ? outcomes[record.outcome.result] : 'Em acompanhamento'}`);
      add(card, 'p', `${record.actor} · Motivo: ${record.reason}`, 'device-alert-meta');
      if (record.ticket) add(card, 'p', `Chamado: ${record.ticket}`, 'device-alert-meta');
      add(card, 'p', `Série registrada: ${record.serialNumber || 'não observável'} · Origem: registro manual no Hefesto`, 'device-alert-meta');
      add(card, 'p', `Leitura anterior: ${date(record.before?.observedAt)} · ${record.before?.fresh ? 'disponível' : 'não observável ou antiga'}`, 'device-alert-meta');
      const event = record.verification || record.outcome;
      if (event?.comparison) {
        add(card, 'strong', comparisons[event.comparison.status] || 'Comparação indisponível');
        for (const c of event.comparison.changes || []) add(card, 'div', c.type === 'alert_not_present' ? `Alerta não presente na nova leitura: ${c.message}` :
          `${c.component}: ${c.before} → ${c.after}`, 'device-alert-meta');
        add(card, 'p', `Leitura posterior: ${date(event.after?.observedAt)}. A comparação não certifica reparo físico.`, 'device-alert-meta');
      }
      if (event?.note) add(card, 'p', `Observação: ${event.note}`, 'device-alert-meta');
      if (canWrite && !record.outcome) {
        const form = add(card, 'div'), note = field(form, 'Observação do resultado (opcional)', 'textarea'); note.maxLength = 1000; note.rows = 2;
        const controls = add(form, 'div', null, 'technical-controls');
        for (const [result, label] of [['performed', 'Declarar realizada'], ['failed', 'Declarar falha'], ['cancelled', 'Cancelar registro']]) {
          const b = button(controls, label), requestId = key();
          b.addEventListener('click', () => run(form, () => api.technicalOutcome(printerId, record.id, { result, note: note.value, requestId })));
        }
      }
      if (canWrite && record.outcome?.result === 'performed') {
        const b = button(card, 'Verificar nova leitura'), requestId = key();
        b.addEventListener('click', () => run(card, () => api.verifyTechnicalIntervention(printerId, record.id, { requestId }), async result => {
          alertCache.clear();
          if (result.telemetry && onTelemetry) { await onTelemetry(result.telemetry); return; }
          root.DeviceAlertsUI?.load(container.querySelector('#device-alert-details'), printerId, getAlerts, { currentOnly: true });
          root.DeviceAlertsUI?.load(alertHistory, printerId, getAlerts, { historyOnly: true }); await load();
        }));
      }
      const audit = add(card, 'details', null, 'device-alert-meta'); add(audit, 'summary', 'Ver registros de auditoria');
      for (const e of record.events || []) add(audit, 'div', `${date(e.at)} · ${e.actor} · ${e.kind === 'verification' ? 'Verificação da telemetria' : outcomes[e.result]}${e.note ? ' · ' + e.note : ''}`);
    }
    async function load() {
      const report = await api.getTechnicalReport(printerId); if (!alive()) return;
      technical.replaceChildren(); add(technical, 'h4', 'Intervenções & auditoria'); technical.append(notice); notice.textContent = '';
      add(technical, 'p', 'O registro descreve a ação realizada pelo técnico. O Hefesto compara as leituras disponíveis; salvar não envia comandos à impressora.', 'device-alert-meta');
      if (canWrite) {
        const remote = add(technical, 'details', null, 'technical-record'); add(remote, 'summary', 'Acesso ao painel da impressora');
        add(remote, 'p', report.remote.message, 'device-alert-meta');
        if (report.remote.url) link(remote, 'Abrir painel web', report.remote.url, true);
        else add(remote, 'p', 'Acesso indisponível: falta um IP ou uma leitura atual.', 'device-alert-meta');
        if (report.remote.reference) link(remote, 'Documentação do painel remoto', report.remote.reference.url);
        const formDetails = add(technical, 'details', null, 'technical-record'); add(formDetails, 'summary', 'Registrar intervenção');
        const form = add(formDetails, 'form'), action = field(form, 'Ação técnica', 'select');
        for (const [value, label] of Object.entries(report.actions)) { const option = add(action, 'option', label); option.value = value; }
        const reason = field(form, 'Motivo', 'textarea'); reason.required = true; reason.maxLength = 500; reason.rows = 2;
        const ticket = field(form, 'Chamado (opcional)'); ticket.maxLength = 80;
        const submit = button(form, 'Registrar início'); submit.type = 'submit'; const requestId = key();
        form.addEventListener('submit', e => { e.preventDefault(); if (form.reportValidity()) run(form, () => api.startTechnicalIntervention(printerId, { action: action.value, reason: reason.value, ticket: ticket.value, requestId })); });
      }
      const records = add(technical, 'div');
      if (!report.audit.records.length) add(records, 'p', 'Nenhuma intervenção registrada. O histórico começa com os registros disponíveis.', 'device-alert-meta');
      for (const record of report.audit.records) recordCard(records, record);
      let offset = report.audit.records.length;
      if (offset < report.audit.total) {
        const more = button(technical, 'Mais intervenções');
        more.addEventListener('click', async () => {
          more.disabled = true;
          try { const page = await api.getTechnicalReport(printerId, offset); if (!alive()) return;
            for (const r of page.audit.records) recordCard(records, r); offset += page.audit.records.length;
            if (offset >= page.audit.total) more.remove(); else more.disabled = false;
          } catch { if (alive()) { more.disabled = false; more.textContent = 'Falha ao carregar. Tentar novamente'; } }
        });
      }
      const recurrence = add(technical, 'details', null, 'technical-record'); add(recurrence, 'summary', `Recorrência de alertas · ${report.recurrence.days} dias`);
      add(recurrence, 'p', 'Conta episódios distintos observados pelo Hefesto. Não reconstitui incidentes anteriores à coleta.', 'device-alert-meta');
      if (report.recurrence.truncated) add(recurrence, 'p', 'Exibição limitada a 5.000 episódios; contagem parcial.', 'device-alert-meta');
      if (!report.recurrence.groups.length) add(recurrence, 'p', 'Nenhuma ocorrência no período.', 'device-alert-meta');
      for (const g of report.recurrence.groups) {
        const row = add(recurrence, 'div', null, 'device-alert-item'); add(row, 'strong', `${g.code} · ${g.message}`);
        add(row, 'div', `${g.occurrences} ocorrência(s) no período · ${g.active ? 'Em acompanhamento' : 'Sem episódio ativo'}`, 'device-alert-meta');
        if (g.shortestReturnMs !== null) add(row, 'div', `Menor intervalo até o retorno: ${(g.shortestReturnMs / 3600000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h após encerramento na fonte.`, 'device-alert-meta');
        if (g.relatedInterventions) add(row, 'div', `${g.relatedInterventions} intervenção(ões) com esse alerta na leitura anterior.`, 'device-alert-meta');
        if (g.latestReturnAfterInterventionMs != null) add(row, 'div', `Retorno observado ${(g.latestReturnAfterInterventionMs / 3600000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h após a última intervenção relacionada. Associação temporal; não determina a causa.`, 'device-alert-meta');
      }
    }
    load().catch(() => { if (alive()) { notice.textContent = 'Não foi possível consultar o histórico técnico.'; const retry = button(technical, 'Tentar novamente'); retry.addEventListener('click', () => load().catch(() => {})); } });
  }
  function close(container) { if (container) container._diagnosticSession = null; }
  root.PrinterDiagnosticUI = Object.freeze({ mount, close });
})(window);
