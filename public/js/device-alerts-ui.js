(function (root) {
  'use strict';
  const labels = { normal: 'Sem alertas nas fontes consultadas', attention: 'Atenção',
    error: 'Erro interno', unknown: 'Estado interno não observável agora' };
  const sourceLabels = { prt_alert_table: 'Printer-MIB', hr_printer_error_state: 'SNMP: erros da impressora',
    hr_device_status: 'SNMP: estado do dispositivo', vendor_custom: 'Fabricante', lexmark_ews: 'Lexmark: painel web' };
  const groups = { 5: 'Impressora', 6: 'Tampa', 8: 'Entrada de papel', 9: 'Saída de papel',
    10: 'Mecanismo de impressão', 11: 'Suprimentos', 13: 'Caminho do papel', 18: 'Alertas' };
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : 'Não informado';
  function add(parent, tag, text, className) {
    const node = parent.ownerDocument.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    parent.append(node); return node;
  }
  function alertRow(parent, alert, historical) {
    const item = add(parent, 'div', null, 'device-alert-item');
    const status = alert.eventKind === 'unary' ? 'Evento' : alert.active ? 'Em acompanhamento' : 'Encerrado na fonte';
    add(item, 'strong', `${historical ? status + ' · ' : ''}${({ critical: 'Erro', warning: 'Atenção', info: 'Informação' })[alert.severity] || 'Severidade desconhecida'} · ${alert.message || alert.label || 'Alerta informado pelo equipamento'}`);
    const raw = alert.rawCode == null ? '' : ` · Código: ${alert.rawCode}`;
    add(item, 'div', `${sourceLabels[alert.source] || alert.source || 'Fonte não informada'}${raw}`, 'device-alert-meta');
    if (alert.component) {
      const c = alert.component;
      add(item, 'div', `${groups[c.group] || 'Grupo ' + c.group} · Índice ${c.index} · Localização ${c.location}`, 'device-alert-meta');
    }
    const knowledge = alert.knowledge;
    if (knowledge && ['code_documented', 'message_documented'].includes(knowledge.status)) {
      const guidance = add(item, 'details', null, 'device-alert-meta');
      add(guidance, 'summary', knowledge.status === 'message_documented' ? 'Orientação pelo texto do aviso' : 'Orientação documentada');
      add(guidance, 'div', `${knowledge.model} · ${knowledge.component}`);
      add(guidance, 'p', knowledge.meaning);
      const actions = add(guidance, 'ul');
      for (const action of knowledge.actions || []) add(actions, 'li', action);
      add(guidance, 'p', knowledge.limitation);
      const reference = knowledge.reference || {};
      if (reference.section) add(guidance, 'div', reference.section);
      try {
        const url = new URL(reference.url);
        if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
            ['publications.lexmark.com', 'support.lexmark.com'].includes(url.hostname)) {
          const link = add(guidance, 'a', reference.title || 'Documentação do fabricante');
          link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        }
      } catch { /* An invalid source is never an executable link. */ }
      add(guidance, 'div', `Catálogo ${knowledge.catalogVersion} · Fonte: ${reference.revision || 'edição não informada'} · Conferida: ${reference.reviewedAt || 'N/D'}`);
      if (knowledge.status === 'message_documented') add(item, 'div', 'Interpretação numérica do código não certificada.', 'device-alert-meta');
    } else if (alert.interpretationStatus === 'not_catalogued') {
      add(item, 'div', 'Interpretação do código não cadastrada.', 'device-alert-meta');
      if (knowledge?.reason === 'model_not_observed') add(item, 'div', 'Modelo não registrado nessa observação.', 'device-alert-meta');
    }
    add(item, 'div', `Detectado: ${date(alert.firstSeenAt)} · Última observação: ${date(alert.lastSeenAt)}`, 'device-alert-meta');
    if (alert.resolvedAt) add(item, 'div', `Encerrado: ${date(alert.resolvedAt)} · Não presente em leitura válida da fonte.`, 'device-alert-meta');
  }
  function render(target, report, options = {}) {
    target.replaceChildren(); target.className = 'device-alert-card';
    if (!options.historyOnly) {
    add(target, 'h4', 'Estado do equipamento');
    const diagnostic = report.diagnostic || { state: 'unknown' };
    add(target, 'strong', labels[diagnostic.state] || labels.unknown, 'device-alert-state');
    if (diagnostic.observedAt) add(target, 'div', `Última consulta: ${date(diagnostic.observedAt)}`, 'device-alert-meta');
    if (!diagnostic.current && diagnostic.lastKnownState && diagnostic.lastKnownState !== 'unknown') {
      add(target, 'div', `Último estado observado: ${labels[diagnostic.lastKnownState]}`, 'device-alert-meta');
    }
    add(target, 'p', diagnostic.coverage === 'complete' ? 'Fontes SNMP consultadas. Conectividade e consumíveis são avaliados separadamente.' :
      'Leitura parcial. A ausência de alerta nas fontes consultadas não certifica todos os componentes.', 'device-alert-meta');
    const lexmark = report.sources?.lexmark_ews;
    if (lexmark) {
      const reasons = { timeout: 'tempo de resposta excedido', authentication_required: 'acesso exige autenticação',
        identity_mismatch: 'equipamento diferente da leitura SNMP', identity_not_observable: 'identidade não confirmada',
        unrecognized_status: 'formato não reconhecido', incomplete_status: 'resposta incompleta' };
      add(target, 'div', lexmark.available && lexmark.complete ? (diagnostic.current ?
        'Painel web Lexmark consultado.' : 'Última leitura disponível do painel web Lexmark.') :
        `Painel web Lexmark: ${reasons[lexmark.reason] || 'leitura indisponível ou incompleta'}.`, 'device-alert-meta');
      if (lexmark.firmware) add(target, 'div', `Firmware Lexmark: ${lexmark.firmware} · Observado: ${date(lexmark.observedAt)}`, 'device-alert-meta');
    }
    for (const alert of report.alerts || []) alertRow(target, alert, false);
    } else add(target, 'h4', 'Histórico de alertas');
    if (options.currentOnly) return;
    const details = add(target, 'details');
    details.open = Boolean(options.historyOnly);
    add(details, 'summary', `Histórico de alertas (${report.total || 0})`);
    if (!report.history?.length) add(details, 'p', 'Nenhuma ocorrência registrada. O histórico começa com as observações disponíveis.', 'device-alert-meta');
    for (const alert of report.history || []) alertRow(details, alert, true);
    if (report.total > (report.offset || 0) + (report.history?.length || 0)) {
      const button = add(details, 'button', 'Carregar mais', 'btn btn-secondary btn-sm');
      button.type = 'button'; button.dataset.alertOffset = String((report.offset || 0) + report.history.length);
    }
  }
  async function load(target, printerId, getReport, options = {}) {
    if (!target) return;
    const request = {}; target._alertRequest = request;
    try {
      const report = await getReport(printerId, 0);
      if (!target.isConnected || target._alertRequest !== request) return;
      render(target, report, options);
      if (target._alertListener) target.removeEventListener('click', target._alertListener);
      target._alertListener = async event => {
        const button = event.target.closest('[data-alert-offset]');
        if (!button || button.disabled || target._alertRequest !== request) return;
        button.disabled = true;
        try {
          const page = await getReport(printerId, Number(button.dataset.alertOffset));
          if (!target.isConnected || target._alertRequest !== request) return;
          // Appending pages preserves the already viewed history and the state snapshot.
          const details = button.parentElement; button.remove();
          for (const alert of page.history || []) alertRow(details, alert, true);
          if (page.offset + page.history.length < page.total) {
            button.dataset.alertOffset = String(page.offset + page.history.length); button.disabled = false; details.append(button);
          }
        } catch { button.disabled = false; button.textContent = 'Falha ao carregar. Tentar novamente'; }
      };
      target.addEventListener('click', target._alertListener);
    } catch {
      if (target.isConnected && target._alertRequest === request) {
        target.replaceChildren(); add(target, 'h4', 'Estado do equipamento');
        add(target, 'p', 'Não foi possível consultar os alertas. Tente atualizar os detalhes.', 'device-alert-meta');
      }
    }
  }
  root.DeviceAlertsUI = Object.freeze({ render, load });
})(window);
