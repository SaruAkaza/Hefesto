// Novidades no primeiro acesso à versão, após o login ou a retomada da sessão.
window.ReleaseNotes = (() => {
  const dialog = document.getElementById('release-notes-dialog');
  const title = document.getElementById('release-notes-title');
  const summary = document.getElementById('release-notes-summary');
  const list = document.getElementById('release-notes-list');
  const confirm = document.getElementById('release-notes-confirm');
  const seenInPage = new Map();
  let revision = 0;
  let shown = null;

  function acknowledge() {
    if (!shown) return;
    const { key, version } = shown;
    seenInPage.set(key, version);
    try { localStorage.setItem(key, version); } catch {}
    shown = null;
    dialog.close();
  }
  confirm?.addEventListener('click', acknowledge);
  dialog?.addEventListener('cancel', event => { event.preventDefault(); acknowledge(); });

  function onLogout() {
    revision++;
    shown = null;
    if (dialog?.open) dialog.close();
  }

  async function onLogin(scope) {
    onLogout();
    if (!dialog || !title || !summary || !list || typeof scope !== 'string' || !scope) return;
    const request = revision;
    try {
      const response = await fetch('/api/system/version', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const release = await response.json();
      if (request !== revision || typeof release.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(release.version)) return;
      const notes = Array.isArray(release.releaseNotes) ? release.releaseNotes.filter(note => typeof note === 'string' && note.trim()) : [];
      if (!notes.length) return;
      const key = `hefesto_release_seen:${scope}`;
      let seen = seenInPage.get(key);
      try { seen = localStorage.getItem(key) || seen; } catch {}
      if (seen === release.version) return;
      title.textContent = `Novidades do Hefesto v${release.version}`;
      summary.textContent = typeof release.releaseTag === 'string' ? release.releaseTag : '';
      summary.hidden = !summary.textContent;
      list.replaceChildren();
      for (const note of notes) {
        const item = document.createElement('li');
        item.textContent = note;
        list.append(item);
      }
      shown = { key, version: release.version };
      dialog.showModal();
    } catch {
      // Não bloqueia o acesso nem marca como vista uma atualização indisponível.
    }
  }
  return { onLogin, onLogout };
})();
