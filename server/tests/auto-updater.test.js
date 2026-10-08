import test from 'node:test';
import assert from 'node:assert/strict';
import * as autoUpdater from '../auto-updater.js';

test('HFE-REV-007A: Auto-Updater Seguro e Isolamento do Ambiente (F08)', async (t) => {
  await t.test('1. isValidGitRef valida nomes de branch/tag e rejeita tentativas de injeção', () => {
    // Válidos
    assert.strictEqual(autoUpdater.isValidGitRef('main'), true);
    assert.strictEqual(autoUpdater.isValidGitRef('feat/hefesto-stabilization'), true);
    assert.strictEqual(autoUpdater.isValidGitRef('v2.0.0'), true);
    assert.strictEqual(autoUpdater.isValidGitRef('release-2026.09'), true);

    // Inválidos / Tentativas de injeção
    assert.strictEqual(autoUpdater.isValidGitRef(''), false);
    assert.strictEqual(autoUpdater.isValidGitRef(null), false);
    assert.strictEqual(autoUpdater.isValidGitRef('main; rm -rf /'), false);
    assert.strictEqual(autoUpdater.isValidGitRef('main && calc.exe'), false);
    assert.strictEqual(autoUpdater.isValidGitRef('main | evil'), false);
    assert.strictEqual(autoUpdater.isValidGitRef('branch..evil'), false);
    assert.strictEqual(autoUpdater.isValidGitRef('branch`whoami`'), false);
  });

  await t.test('2. getUpdateStatus retorna estrutura íntegra', () => {
    const status = autoUpdater.getUpdateStatus();
    assert.strictEqual(typeof status.isChecking, 'boolean');
    assert.strictEqual(typeof status.isUpdating, 'boolean');
    assert.strictEqual(typeof status.updateAvailable, 'boolean');
    assert.ok(status.lastMessage);
  });

  await t.test('3. getCurrentCommit não lança exceção em ambiente de teste ou repositório protegido', async () => {
    const commit = await autoUpdater.getCurrentCommit();
    assert.ok(typeof commit === 'string');
    assert.ok(commit.length > 0);
  });
});
