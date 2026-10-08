import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const source = readFileSync(new URL('../../public/js/release-notes.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
function fixture(t) {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.body.innerHTML = html.match(/<dialog class="release-notes-dialog"[\s\S]*?<\/dialog>/)[0];
  let release = { version: '1.0.1', releaseTag: 'Novidades', releaseNotes: ['Mudança de teste'] };
  window.fetch = async () => ({ ok: true, json: async () => release });
  window.eval(source);
  t.after(() => window.close());
  return { window, setRelease: value => { release = value; }, dialog: window.document.getElementById('release-notes-dialog'), confirm: () => window.document.getElementById('release-notes-confirm').click() };
}

test('release notice appears after login once per confirmed version and access profile', async t => {
  const f = fixture(t), api = f.window.ReleaseNotes;
  assert.equal(f.dialog.open, false);
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, true);
  f.confirm(); assert.equal(f.dialog.open, false);
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, false);
  await api.onLogin('operator:unit'); assert.equal(f.dialog.open, true);
  f.confirm();
  f.setRelease({ version: '1.1.0', releaseNotes: ['Nova função'] });
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, true);
  assert.match(f.dialog.textContent, /v1\.1\.0/);
});

test('logout does not acknowledge unread notes and cancels an in-flight login notice', async t => {
  const f = fixture(t), api = f.window.ReleaseNotes;
  await api.onLogin('admin:test'); api.onLogout();
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, true);
  api.onLogout();
  let resolve;
  f.window.fetch = () => new Promise(done => { resolve = done; });
  const loading = api.onLogin('admin:test'); api.onLogout();
  resolve({ ok: true, json: async () => ({ version: '1.0.1', releaseNotes: ['Mudança'] }) });
  await loading; assert.equal(f.dialog.open, false);
  assert.equal(f.window.localStorage.getItem('hefesto_release_seen:admin:test'), null);
});

test('notes render as text and failed requests can be retried without suppressing the notice', async t => {
  const f = fixture(t), api = f.window.ReleaseNotes;
  f.window.fetch = async () => { throw new Error('offline'); };
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, false);
  f.window.fetch = async () => ({ ok: true, json: async () => ({ version: '1.0.1', releaseTag: '<img src=x>', releaseNotes: ['<script>bad</script>', null, 123] }) });
  await api.onLogin('admin:test'); assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.querySelector('script, img'), null);
  assert.equal(f.dialog.querySelectorAll('li').length, 1);
  assert.match(f.dialog.textContent, /<script>bad<\/script>/);
  const footer = html.match(/<footer class="app-footer">([\s\S]*?)<\/footer>/)[1];
  assert.doesNotMatch(footer, /<a\b|<button\b|<details\b|<time\b/);
});
