import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAutoUpdater, isValidGitRef } from '../auto-updater.js';
const run = promisify(execFile);
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'hefesto-updater-'));
  const source = path.join(root, 'source'), live = path.join(root, 'live'), remote = path.join(root, 'remote.git');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(source); await run('git', ['init', '-b', 'main', source]);
  const git = (args, cwd = source) => run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { cwd });
  mkdirSync(path.join(source, 'server')); mkdirSync(path.join(source, 'public/js'), { recursive: true }); mkdirSync(path.join(source, 'scripts'));
  writeFileSync(path.join(source, '.gitignore'), 'server/node_modules/\n.env\nserver/data/\n');
  writeFileSync(path.join(source, 'public/js/app.js'), 'export const placeholder = true;');
  writeFileSync(path.join(source, 'package.json'), '{"type":"module","version":"1.0.0"}');
  writeFileSync(path.join(source, 'server/package.json'), '{"name":"test-updater","version":"1.0.0","type":"module"}');
  writeFileSync(path.join(source, 'server/package-lock.json'), '{"name":"test-updater","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"test-updater","version":"1.0.0"}}}');
  writeFileSync(path.join(source, 'server/server.js'), 'export const revision = 1;');
  copyFileSync(new URL('../../scripts/check-syntax.mjs', import.meta.url), path.join(source, 'scripts/check-syntax.mjs'));
  await git(['add', '.']); await git(['commit', '-m', 'Initial']);
  const original = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  await run('git', ['clone', '--bare', source, remote]);
  await git(['remote', 'add', 'origin', remote]);
  await run('git', ['clone', remote, live]);
  mkdirSync(path.join(live, 'server/data')); writeFileSync(path.join(live, 'server/data/hefesto.db'), 'operational-sentinel');
  writeFileSync(path.join(live, '.env'), 'LOCAL_SETTING=preserve');
  let restarts = 0;
  const publish = async (code = 'export const revision = 2;', version = '1.0.1') => {
    writeFileSync(path.join(source, 'server/server.js'), code);
    writeFileSync(path.join(source, 'package.json'), JSON.stringify({ type:'module', version }));
    await git(['add', '.']); await git(['commit', '-m', 'Update']); await git(['push', 'origin', 'main']);
    return (await git(['rev-parse', 'HEAD'])).stdout.trim();
  };
  const create = (options = {}) => createAutoUpdater({ rootDir: live, restart: () => { restarts++; }, ...options });
  return { root, source, live, git, original, publish, create, restarts: () => restarts };
}

test('updater applies a validated fast-forward in a real Git repo and preserves ignored operational files', async t => {
  const f = await fixture(t), target = await f.publish(), updater = f.create();
  const checked = await updater.checkForUpdates();
  assert.equal(checked.updateAvailable, true);
  assert.equal(checked.currentVersion, '1.0.0');
  assert.equal(checked.remoteVersion, '1.0.1');
  assert.equal(checked.lastMessage, 'Nova versão disponível: v1.0.0 → v1.0.1.');
  const applied = await updater.applyUpdate();
  assert.equal(applied.success, true, JSON.stringify(applied));
  assert.equal((await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(), target);
  assert.equal(f.restarts(), 1);
  assert.equal(readFileSync(path.join(f.live, 'server/data/hefesto.db'), 'utf8'), 'operational-sentinel');
  assert.equal(readFileSync(path.join(f.live, '.env'), 'utf8'), 'LOCAL_SETTING=preserve');
  assert.equal(updater.getUpdateStatus().isUpdating, false);
  assert.equal(updater.getUpdateStatus().currentVersion, '1.0.1');
  assert.equal((await updater.checkForUpdates()).lastMessage, 'Nenhuma atualização pendente (v1.0.1).');
});
test('updater rejects tracked edits and untracked files without discarding either', async t => {
  const f = await fixture(t); await f.publish(); const updater = f.create();
  writeFileSync(path.join(f.live, 'server/server.js'), 'local edit');
  assert.equal((await updater.applyUpdate()).success, false);
  assert.equal(readFileSync(path.join(f.live, 'server/server.js'), 'utf8'), 'local edit');
  await f.git(['restore', 'server/server.js'], f.live);
  writeFileSync(path.join(f.live, 'local-notes.txt'), 'local notes');
  assert.equal((await updater.applyUpdate()).success, false);
  assert.equal(readFileSync(path.join(f.live, 'local-notes.txt'), 'utf8'), 'local notes');
  assert.equal(f.restarts(), 0);
});
test('failed dependency installation rolls back code and restores previous dependencies without restart', async t => {
  const f = await fixture(t); await f.publish(); let installs = 0;
  const execute = async (command, args, options) => {
    if (command === process.execPath && args.includes('ci') && ++installs === 1) throw new Error('installation failure');
    return run(command, args, options);
  };
  const updater = f.create({ execute });
  const result = await updater.applyUpdate();
  assert.equal(result.success, false); assert.equal(result.rolledBack, true); assert.equal(installs, 2);
  assert.equal((await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(), f.original);
  assert.equal(f.restarts(), 0);
  assert.equal(updater.getUpdateStatus().currentVersion, '1.0.0');
});
test('invalid candidate syntax rolls back even after successful dependency installation', async t => {
  const f = await fixture(t); await f.publish('const broken = ;');
  const result = await f.create().applyUpdate();
  assert.equal(result.success, false); assert.equal(result.rolledBack, true);
  assert.equal((await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(), f.original); assert.equal(f.restarts(), 0);
});
test('divergent deployment commits are preserved and are not reported as safe updates', async t => {
  const f = await fixture(t); await f.publish();
  writeFileSync(path.join(f.live, 'local.js'), 'export const local = true;');
  await f.git(['add', '.'], f.live); await f.git(['commit', '-m', 'Local commit'], f.live);
  const local = (await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(); const updater = f.create();
  const checked = await updater.checkForUpdates();
  assert.equal(checked.updateAvailable, false); assert.match(checked.lastError, /divergentes/);
  assert.equal((await updater.applyUpdate()).success, false);
  assert.equal((await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(), local); assert.equal(f.restarts(), 0);
});
test('Git branch and auto-update flags are read after instance creation', async t => {
  const f = await fixture(t), env = { GIT_UPDATE_BRANCH: 'wrong', AUTO_UPDATE_ENABLED: 'false' }, updater = f.create({ environment: () => env });
  env.GIT_UPDATE_BRANCH = 'main'; await f.publish();
  assert.equal((await updater.checkForUpdates()).updateAvailable, true);
  env.AUTO_UPDATE_ENABLED = 'true'; const stop = updater.startAutoUpdateWatcher(); stop();
  assert.equal(typeof stop, 'function');
  for (const ref of ['-main', '.branch', 'main/', 'main//x', 'x.lock', ' main', 'main..x']) assert.equal(isValidGitRef(ref), false);
  assert.equal((await updater.applyUpdate('-main')).success, false); assert.equal(f.restarts(), 0);
});
test('update notices remain accurate when a candidate has the same or no valid declared version', async t => {
  const f = await fixture(t), updater = f.create();
  await f.publish('export const revision = 2;', '1.0.0');
  let checked = await updater.checkForUpdates();
  assert.equal(checked.updateAvailable, true);
  assert.equal(checked.lastMessage, 'Atualização disponível para v1.0.0.');
  await f.publish('export const revision = 3;', 'not-a-version');
  checked = await updater.checkForUpdates();
  assert.equal(checked.updateAvailable, true);
  assert.equal(checked.remoteVersion, null);
  assert.equal(checked.lastMessage, 'Atualização disponível.');
  assert.equal((await f.git(['rev-parse', 'HEAD'], f.live)).stdout.trim(), f.original);
  assert.equal(f.restarts(), 0);
});
