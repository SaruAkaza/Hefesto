/* Piloto Windows: inventário de filas e trabalhos, independente dos contadores de cobrança. */
(() => {
  let dialog, config, generation=0, detail;
  function closeDetail(){detail?.controller?.abort();detail=null;}
  function refreshDetail(statuses){if(detail?.form.isConnected){const status=statuses.get(detail.printer.id);if(status)detail.communication.textContent=date(status.cachedAt);return detail.load(true);}else closeDetail();}
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const f=id=>dialog?.querySelector('#ws-'+id);
  const date=value=>value?new Date(value).toLocaleString('pt-BR'):'Aguardando primeira coleta';
  const number=value=>value===null||value===undefined?'Não informado':Number(value).toLocaleString('pt-BR');
  function close(){generation++;dialog?.close();dialog?.remove();dialog=null;}
  async function request(path,options={}){
    const response=await apiFetch('/api/workstations/'+path,options);
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Não foi possível consultar os computadores.');
    return data;
  }
  async function open(){
    if(AppState.userRole!=='admin')return showToast('Acesso reservado ao administrador.','error');
    close();const version=generation;
    dialog=document.createElement('dialog');dialog.className='workstation-dialog';dialog.setAttribute('aria-labelledby','ws-title');
    dialog.innerHTML='<header><div><h2 id="ws-title">Instalar coletor Windows</h2><p>As impressoras USB aparecem no painel de impressoras, identificadas pela marca USB.</p></div><button id="ws-close" class="btn btn-secondary">Fechar</button></header><div id="ws-body" aria-live="polite">Carregando...</div>';
    document.body.append(dialog);f('close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();
    try{config=await request('config');if(version!==generation)return;render();}
    catch(error){if(version===generation&&f('body'))f('body').textContent=error.message;}
  }
  function render(){
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const units=config.units.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
    f('body').innerHTML=`<details open><summary>Instalar em um computador</summary>
      <p>Baixe o instalador, gere um código e execute o arquivo no computador conectado à impressora. A instalação solicita administrador local e mantém um serviço de coleta em segundo plano.</p>
      <div class="ws-controls"><button type="button" id="ws-download" class="btn btn-primary" ${config.installerAvailable?'':'disabled'}>Baixar instalador Windows</button><span>Servidor: <code>${esc(location.origin)}</code></span></div>
      <form id="ws-pair-form" class="ws-controls"><label>Unidade<select id="ws-pair-unit" required><option value="">Selecione</option>${units}</select></label><label>Local / setor<input id="ws-pair-sector" maxlength="150" placeholder="Opcional"></label><button class="btn btn-secondary" type="submit" id="ws-pair">Gerar código de instalação</button></form>
      <p id="ws-pair-result" role="status"></p><p id="ws-download-status" role="status"></p>
    </details>
    <div class="ws-controls"><button id="ws-refresh" class="btn btn-secondary" type="button">Atualizar coletores</button></div><div id="ws-computers"></div>`;
    f('download').onclick=download;f('pair-form').onsubmit=pair;f('refresh').onclick=refresh;renderComputers();
  }
  function renderComputers(){
    f('computers').innerHTML='<h3>Coletores instalados</h3>'+(!config.collectors.length?'<p>Nenhum coletor instalado. Gere um código e execute o instalador no computador piloto.</p>':`<div class="ws-table"><table><thead><tr><th>Computador</th><th>Unidade / setor</th><th>Última comunicação</th><th>Situação</th><th></th></tr></thead><tbody>${config.collectors.map(c=>`<tr><td>${esc(c.hostname)}</td><td>${esc(config.units.find(u=>u.id===c.unitId)?.name||'Unidade indisponível')}<br>${esc(c.sector||'')}</td><td>${esc(date(c.lastSeen))}</td><td>${c.revokedAt?'Revogado':c.lastSeen&&Date.now()-Date.parse(c.lastSeen)<300000?'Comunicando':'Sem comunicação'}${c.health.warning?'<br>'+esc(c.health.warning):''}</td><td>${c.revokedAt?'':`<button class="btn btn-secondary" type="button" data-ws-revoke="${esc(c.id)}">Revogar acesso</button>`}</td></tr>`).join('')}</tbody></table></div>`);
    f('computers').querySelectorAll('[data-ws-revoke]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Revogar o acesso deste coletor? O histórico será mantido.'))return;
      try{await request('collectors/'+encodeURIComponent(b.dataset.wsRevoke)+'/revoke',{method:'POST'});await refresh();}catch(e){showToast(e.message,'error');}
    });
  }
  async function refresh(){const version=generation;try{config=await request('config');if(version!==generation)return;renderComputers();}catch(e){if(version===generation)showToast(e.message,'error');}}
  async function pair(event){event.preventDefault();const version=generation;f('pair').disabled=true;try{
    const result=await request('pairings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitId:f('pair-unit').value,sector:f('pair-sector').value})});
    if(version!==generation)return;
    f('pair-result').innerHTML=`Código de uso único: <code class="ws-code">${esc(result.code)}</code><br>Válido até ${esc(date(result.expiresAt))}. Copie para o instalador.`;
  }catch(error){if(version===generation)f('pair-result').textContent=error.message;}finally{if(version===generation)f('pair').disabled=false;}}
  async function download(){const version=generation;f('download').disabled=true;try{
    const response=await apiFetch('/api/workstations/installer');if(!response.ok)throw Error('Instalador indisponível. Atualize a tela.');
    const blob=await response.blob();if(version!==generation)return;
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='HefestoColetor-Setup.exe';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    f('download-status').textContent='Instalador baixado. Execute no computador piloto com permissão de administrador local.';
  }catch(error){if(version===generation)f('download-status').textContent=error.message;}finally{if(version===generation)f('download').disabled=false;}}
  function renderRow(printer,status,isAdmin,floor,collapsed){
    const online=status?.collectorOnline,qty=status?.reportedPagesToday;
    return `<tr data-live-key="printer:${esc(printer.id)}" class="printer-telemetry-row ${collapsed?'floor-row-collapsed':''}" ${floor?`data-floor-row="${esc(floor)}"`:''}>
      <td class="cell-local" data-label="Local / Setor"><div class="cell-title-row"><span class="cell-title">${esc(printer.location||printer.hostname)}</span><span class="state-chip">${esc(printer.region)}</span></div>${isAdmin?`<div class="unit-name-text">${esc(printer.unitName)}</div>`:''}</td>
      <td class="cell-model" data-label="Modelo"><div class="cell-main">${esc(printer.name)} <span class="usb-connection-badge">USB</span></div><small>${esc(printer.driver)}</small></td>
      <td class="cell-ip" data-label="Conexão"><code class="ip-code">USB</code><div class="cell-note">${esc(printer.hostname)} · ${esc(printer.port)}</div></td>
      <td class="cell-supply" data-label="Suprimentos"><span class="cell-muted">Tinta: leitura não disponível</span></td>
      <td class="cell-counter" data-label="Contador"><div class="cell-muted">Contador físico: —</div><div class="cell-note">${qty===null||qty===undefined?'Sem quantidade registrada hoje':number(qty)+' pág. informadas hoje pelo Windows'}</div></td>
      <td class="cell-status" data-label="Status"><span class="status-indicator ${online?'partial':'offline'}"><span class="status-dot"></span>${status?.collectorRevoked?'Coletor revogado':online?'Coletor ativo':'Coletor sem comunicação'}</span><div class="cell-note">${esc(date(status?.cachedAt))}</div></td>
      <td class="cell-actions" data-label="Ações"><button type="button" class="deck-action-pill" data-usb-detail="${esc(printer.id)}">Detalhes</button></td></tr>`;
  }
  async function renderDetail(printer,status,container,isAdmin){
    closeDetail();
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    container.innerHTML=`<div class="usb-detail"><p><span class="usb-connection-badge">USB</span> ${esc(printer.hostname)} · ${esc(printer.port)}</p><p>${esc(printer.unitName)} · ${esc(printer.location||'Setor não informado')}</p>
      <p>Última comunicação do coletor: <span data-usb-communication>${esc(date(status?.cachedAt))}</span>. A comunicação do computador não confirma que a impressora está ligada.</p><p>Tinta e contador físico: não disponíveis neste piloto. Na M1180, confira a tinta visualmente.</p>
      ${isAdmin?`<form class="ws-controls" data-usb-filter><label>De<input type="date" name="start" value="${today.slice(0,7)}-01" required></label><label>Até<input type="date" name="end" value="${today}" required></label><button class="btn btn-primary" type="submit">Consultar impressões</button></form><p class="ws-note">Quantidades informadas pelo Windows, sem inclusão na cobrança. O login identifica a conta que enviou o trabalho.</p><div data-usb-report aria-live="polite"></div>`:'<p>Registros por usuário disponíveis ao administrador.</p>'}</div>`;
    if(!isAdmin)return;
    const form=container.querySelector('[data-usb-filter]'),output=container.querySelector('[data-usb-report]');let revision=0,lastReport=null;
    const active={printer,form,communication:container.querySelector('[data-usb-communication]'),controller:null,load};detail=active;
    async function load(background=false){
      if(background&&active.controller)return;
      active.controller?.abort();const controller=new AbortController();active.controller=controller;
      const deadline=setTimeout(()=>controller.abort(),10000),version=++revision;
      if(!background)output.textContent='Consultando...';try{
      const query=new URLSearchParams({start:form.elements.start.value,end:form.elements.end.value,collectorId:printer.collectorId,printerName:printer.name});
      const data=await request('report?'+query,{signal:controller.signal});if(controller.signal.aborted||detail!==active||version!==revision||!output.isConnected)return;
      const signature=JSON.stringify(data);if(background&&signature===lastReport)return;lastReport=signature;
      const html=`<p><strong>${number(data.totals.jobs)} trabalhos · ${number(data.totals.pages)} páginas informadas</strong></p>${data.totals.unknownJobs?'<p>Há trabalhos sem quantidade informada.</p>':''}<div class="ws-table"><table><thead><tr><th>Login</th><th>Trabalhos</th><th>Páginas</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td>${esc(g.username||'Não informado')}</td><td>${number(g.jobs)}</td><td>${number(g.pages)}</td></tr>`).join('')}</tbody></table></div><details><summary>Últimos 100 registros do período</summary><div class="ws-table"><table><thead><tr><th>Data / hora</th><th>Login</th><th>Páginas</th></tr></thead><tbody>${data.events.map(e=>`<tr><td>${esc(date(e.occurredAt))}</td><td>${esc(e.username||'Não informado')}</td><td>${number(e.pages)}</td></tr>`).join('')}</tbody></table></div></details>`;
      if(background&&window.DashboardRefresh)window.DashboardRefresh.patch(output,html);else output.innerHTML=html;
    }catch(e){if(!background&&detail===active&&version===revision&&output.isConnected)output.textContent=e.message;}finally{clearTimeout(deadline);if(active.controller===controller)active.controller=null;}}
    form.onsubmit=e=>{e.preventDefault();load();};await load();
  }
  window.WorkstationModule={renderRow,renderDetail,refreshDetail,closeDetail};
  document.addEventListener('click',event=>{const button=event.target.closest('[data-usb-detail]');if(button)openPrinterDetailDrawer(button.dataset.usbDetail);});
  document.getElementById('btn-workstations')?.addEventListener('click',open);
})();
