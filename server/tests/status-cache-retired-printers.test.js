import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../db.js';

test('preserved status of replaced printers cannot force a network scan when opening the dashboard', async t => {
  db.initDatabase({ inMemory: true, skipSeeds: true, skipCleanups: true });
  db.savePrinter({ id: 'active', name: 'Active printer', ip: 'pendente-synthetic-active' });
  db.savePrinter({ id: 'retired', name: 'Replaced printer', ip: 'pendente-synthetic-retired' });
  db.getDb().prepare('UPDATE printers SET is_active=0 WHERE id=?').run('retired');
  const cachedAt = '2026-10-02T20:00:00.000Z';
  for (const id of ['active', 'retired']) {
    db.updateCachedStatus(id, { online: true, cachedAt, info: { model: 'Synthetic model', pageCount: 1234 } });
  }
  const persistedCachedAt = db.getCachedStatus('active').cachedAt;
  // Import after the isolated fixture to reproduce startup with both historical caches.
  const { app } = await import('../server.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.closeDatabase(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status/all`, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  const statuses = await response.json();
  assert.deepEqual(statuses.map(p => p.id), ['active']);
  assert.equal(statuses[0].online, true);
  assert.equal(statuses[0].cachedAt, persistedCachedAt);
  assert.equal(db.getCachedStatus('retired').info.pageCount, 1234);
  assert.equal(db.getDb().prepare('SELECT COUNT(*) AS n FROM printer_counter_observations').get().n, 0);
});
