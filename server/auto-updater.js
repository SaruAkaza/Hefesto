import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
function declaredVersion(manifest) {
  try {
    const version = JSON.parse(manifest).version;
    return typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) ? version : null;
  } catch { return null; }
}

export function isValidGitRef(ref) {
  if (typeof ref !== 'string' || ref !== ref.trim() || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref)) return false;
  return !ref.includes('..') && !ref.includes('//') && ref.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'));
}
function npmEntry() {
  const bin = path.dirname(process.execPath);
  const candidates = [process.env.npm_execpath, path.join(bin, 'node_modules/npm/bin/npm-cli.js'), path.join(bin, '../lib/node_modules/npm/bin/npm-cli.js'), path.join(bin, 'npm')].filter(Boolean);
  for (const entry of candidates) {
    try { const resolved = fs.realpathSync(entry); if (path.basename(resolved) === 'npm-cli.js') return resolved; } catch {}
  }
  throw new Error('npm-cli.js não localizado junto ao Node.js; atualização interrompida.');
}
function restartService() {
  const timer = setTimeout(() => {
    if (process.platform === 'win32') {
      const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', 'Start-Sleep -Seconds 2; Restart-Service -Name "HefestoPrintMonitor" -Force -ErrorAction Stop'], { detached: true, stdio: 'ignore', shell: false });
      child.on('error', error => console.error('[Auto-Updater] Reinício do serviço:', error.message));
      child.unref();
    }
    setTimeout(() => process.exit(1), 1500);
  }, 2000);
  timer.unref();
}

// Instance boundaries allow real temporary Git repositories in tests without touching the deployment.
export function createAutoUpdater({ rootDir = ROOT_DIR, execute = execFileAsync, restart = restartService, environment = () => process.env, npmCli = npmEntry } = {}) {
  const installedVersion = () => {
    try { return declaredVersion(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')); }
    catch { return null; }
  };
  const state = { isChecking: false, isUpdating: false, lastChecked: null, currentCommit: null, remoteCommit: null, currentVersion: installedVersion(), remoteVersion: null, updateAvailable: false, lastMessage: 'Inicializando verificador de atualizações...', lastError: null };
  const git = (args, timeout = 30000) => execute('git', ['-c', `safe.directory=${rootDir}`, ...args], { cwd: rootDir, timeout, shell: false });
  const branchName = target => {
    const branch = target ?? environment().GIT_UPDATE_BRANCH ?? 'main';
    if (!isValidGitRef(branch)) throw new Error('Referência Git inválida.');
    return branch;
  };
  const snapshot = () => ({ ...state });
  const fullHead = async () => (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const versionAt = async commit => {
    try { return declaredVersion((await git(['show', `${commit}:package.json`])).stdout); }
    catch { return null; }
  };
  const fetchTarget = async branch => {
    await git(['fetch', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`], 60000);
    return (await git(['rev-parse', '--verify', `refs/remotes/origin/${branch}^{commit}`])).stdout.trim();
  };
  const isAncestor = async (a, b) => {
    try { await git(['merge-base', '--is-ancestor', a, b]); return true; }
    catch (error) { if (error.code === 1) return false; throw error; }
  };
  const cleanTree = async () => {
    const result = await git(['status', '--porcelain', '--untracked-files=all']);
    if (result.stdout.trim()) throw new Error('Há alterações locais ou arquivos não rastreados; atualização bloqueada para preservá-los.');
  };
  const install = async () => execute(process.execPath, [npmCli(), 'ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: path.join(rootDir, 'server'), timeout: 120000, shell: false });
  async function getCurrentCommit() {
    try { const head = await fullHead(); state.currentCommit = head.slice(0, 12); state.currentVersion = installedVersion(); return state.currentCommit; }
    catch { state.currentCommit = 'unknown'; return 'unknown'; }
  }
  async function checkForUpdates(targetBranch) {
    if (state.isChecking || state.isUpdating) return snapshot();
    state.isChecking = true; state.lastError = null; state.updateAvailable = false; state.remoteVersion = null;
    try {
      const branch = branchName(targetBranch), current = await fullHead(), remote = await fetchTarget(branch);
      state.currentCommit = current.slice(0, 12); state.remoteCommit = remote.slice(0, 12);
      state.currentVersion = await versionAt(current); state.remoteVersion = await versionAt(remote);
      if (current === remote || await isAncestor(remote, current)) {
        state.lastMessage = `Nenhuma atualização pendente${state.currentVersion ? ` (v${state.currentVersion})` : ''}.`;
      } else if (await isAncestor(current, remote)) {
        state.updateAvailable = true;
        state.lastMessage = state.currentVersion && state.remoteVersion && state.currentVersion !== state.remoteVersion
          ? `Nova versão disponível: v${state.currentVersion} → v${state.remoteVersion}.`
          : `Atualização disponível${state.remoteVersion ? ` para v${state.remoteVersion}` : ''}.`;
      } else { throw new Error('Históricos Git divergentes; reconciliação manual necessária.'); }
    } catch (error) {
      state.lastError = error.message; state.lastMessage = 'Não foi possível verificar uma atualização segura.';
    } finally { state.isChecking = false; state.lastChecked = new Date().toISOString(); }
    return snapshot();
  }
  async function applyUpdate(targetBranch) {
    if (state.isUpdating || state.isChecking) return { success: false, message: 'Verificação ou atualização já em andamento.' };
    state.isUpdating = true; state.lastError = null;
    let original = null, changed = false;
    try {
      const branch = branchName(targetBranch);
      await cleanTree();
      original = await fullHead();
      const activeBranch = (await git(['symbolic-ref', '--short', 'HEAD'])).stdout.trim();
      if (activeBranch !== branch) throw new Error(`Branch ativa ${activeBranch} difere da configurada ${branch}.`);
      const target = await fetchTarget(branch);
      if (target === original) { state.currentVersion = installedVersion(); state.remoteVersion = state.currentVersion; state.updateAvailable = false; return { success: true, message: 'Sistema já atualizado.' }; }
      if (!await isAncestor(original, target)) throw new Error('Atualização exige fast-forward; commits locais serão preservados.');
      await cleanTree();
      changed = true;
      await git(['merge', '--ff-only', '--no-edit', target], 60000);
      await install();
      await execute(process.execPath, [path.join(rootDir, 'scripts/check-syntax.mjs')], { cwd: rootDir, timeout: 120000, shell: false });
      // Load the actual declared production dependencies in a fresh Node process.
      await execute(process.execPath, ['--input-type=module', '-e', "import fs from 'node:fs'; const p = JSON.parse(fs.readFileSync('package.json', 'utf8')); for (const name of Object.keys(p.dependencies || {})) await import(name);"], { cwd: path.join(rootDir, 'server'), timeout: 30000, shell: false });
      await cleanTree();
      if (await fullHead() !== target) throw new Error('Commit instalado difere da revisão validada.');
      state.currentCommit = target.slice(0, 12); state.remoteCommit = target.slice(0, 12); state.updateAvailable = false;
      state.currentVersion = installedVersion(); state.remoteVersion = state.currentVersion;
      state.lastMessage = `Atualização${state.currentVersion ? ` v${state.currentVersion}` : ''} validada; reinício agendado.`;
      await restart();
      return { success: true, message: state.lastMessage };
    } catch (error) {
      let rollbackError = null;
      if (changed) {
        try {
          // --keep refuses to discard edits made after the initial cleanliness check.
          await git(['reset', '--keep', original], 60000);
          await install();
          await getCurrentCommit();
        } catch (failure) { rollbackError = failure.message; }
      }
      state.lastError = error.message + (rollbackError ? ` | Falha na recuperação: ${rollbackError}` : '');
      state.lastMessage = changed && !rollbackError ? 'Atualização falhou; código e dependências anteriores restaurados.' : 'Atualização interrompida; serviço não foi reiniciado.';
      return { success: false, error: state.lastError, rolledBack: changed && !rollbackError, rollbackError };
    } finally { state.isUpdating = false; }
  }
  function startAutoUpdateWatcher(intervalMinutes = 30) {
    // Read only when called, after server.js has loaded the deployment .env.
    if (String(environment().AUTO_UPDATE_ENABLED || 'false').toLowerCase() !== 'true') {
      state.lastMessage = 'Auto-update desabilitado por configuração (AUTO_UPDATE_ENABLED=false).';
      return () => {};
    }
    let stopped = false;
    const tick = async () => {
      try { const checked = await checkForUpdates(); if (!stopped && checked.updateAvailable && !checked.isChecking && !checked.isUpdating) await applyUpdate(); }
      catch (error) { state.lastError = error.message; }
    };
    const first = setTimeout(tick, 120000);
    const interval = setInterval(tick, Math.max(1, Number(intervalMinutes) || 30) * 60000);
    first.unref(); interval.unref();
    return () => { stopped = true; clearTimeout(first); clearInterval(interval); };
  }
  return { getCurrentCommit, checkForUpdates, applyUpdate, startAutoUpdateWatcher, getUpdateStatus: snapshot, runGit: git };
}
const updater = createAutoUpdater();
export const { getCurrentCommit, checkForUpdates, applyUpdate, startAutoUpdateWatcher, getUpdateStatus, runGit } = updater;
