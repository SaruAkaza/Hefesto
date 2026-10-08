/* Refresh persisted readings independently of device collection. */
(() => {
  let timer, controller, revision = null, running = false, options;
  const interval = 15000;
  function cancel() { clearTimeout(timer); controller?.abort(); controller = null; }
  function allowed() { return running && !document.hidden && options.canRefresh(); }
  function schedule() { clearTimeout(timer); if (running && !document.hidden) timer = setTimeout(tick, interval); }
  async function refresh() {
    if (!allowed() || controller || options.state.isRefreshing) return;
    const request = new AbortController(); controller = request;
    const deadline = setTimeout(() => request.abort(), 10000);
    try {
      const response = await options.request('/api/dashboard/snapshot' + (revision ? '?since=' + encodeURIComponent(revision) : ''), { signal: request.signal });
      if (request.signal.aborted || !allowed()) return;
      if (response.status === 204) { options.timestamp(); window.WorkstationModule?.refreshDetail(options.state.statusData); return; }
      if (!response.ok) throw Error('Atualização indisponível');
      const data = await response.json();
      if (request.signal.aborted || !allowed()) return;
      if (!Array.isArray(data.statuses) || !Array.isArray(data.health) || typeof data.revision !== 'string') throw Error('Resposta inválida');
      const state = options.state;
      if (data.full) { state.statusData.clear(); state.healthData.clear(); }
      for (const id of data.removedIds || []) { state.statusData.delete(id); state.healthData.delete(id); }
      for (const item of data.statuses) state.statusData.set(item.id, item);
      for (const item of data.health) state.healthData.set(item.printerId, item.health);
      for (const key of ['units', 'printers', 'healthOverview', 'rechargesSummary']) if (data[key] !== undefined) state[key] = data[key];
      if (data.collectionAt !== undefined) state.lastCollectionAt = data.collectionAt;
      revision = data.revision;
      options.render(); options.timestamp();
      window.WorkstationModule?.refreshDetail(state.statusData);
    } catch (error) {
      if (!request.signal.aborted && allowed()) options.failed?.();
    } finally {
      clearTimeout(deadline); if (controller === request) controller = null;
    }
  }
  async function tick() { try { await refresh(); } finally { schedule(); } }
  function visibility() { cancel(); if (!document.hidden && running) tick(); }
  function reset() { revision = null; controller?.abort(); }
  function start(config) {
    stop(); options = config; running = true;
    document.addEventListener('visibilitychange', visibility); schedule();
  }
  function stop() { running = false; cancel(); revision = null; document.removeEventListener('visibilitychange', visibility); }

  // Keep existing rows, focus and expanded details; only reconcile changed DOM values.
  function patch(element, html) {
    if (!element) return;
    const focused = document.activeElement;
    const draft = element.cloneNode(false); draft.innerHTML = html;
    function sync(current, next) {
      if (current.isEqualNode(next)) return current;
      if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { const replacement = next.cloneNode(true); current.replaceWith(replacement); return replacement; }
      if (current.nodeType !== 1) { current.nodeValue = next.nodeValue; return current; }
      for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name) && !(current.nodeName === 'DETAILS' && attr.name === 'open')) current.removeAttribute(attr.name);
      for (const attr of next.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
      reconcile(current, next);
      return current;
    }
    const key = node => node.nodeType === 1 ? node.getAttribute('data-live-key') : null;
    function reconcile(current, next) {
      const keyed = new Map([...current.childNodes].map(node => [key(node), node]).filter(([id]) => id));
      let cursor = current.firstChild;
      for (const wanted of next.childNodes) {
        const id = key(wanted);
        let existing = id ? keyed.get(id) : cursor && !key(cursor) ? cursor : null;
        if (!existing) { existing = wanted.cloneNode(true); current.insertBefore(existing, cursor); }
        else { if (existing !== cursor) current.insertBefore(existing, cursor); existing = sync(existing, wanted); }
        cursor = existing.nextSibling;
      }
      while (cursor) { const nextNode = cursor.nextSibling; cursor.remove(); cursor = nextNode; }
    }
    reconcile(element, draft);
    if (focused?.isConnected && document.activeElement !== focused && element.contains(focused)) focused.focus({ preventScroll: true });
  }
  window.DashboardRefresh = { start, stop, reset, refresh, patch, interval };
})();
