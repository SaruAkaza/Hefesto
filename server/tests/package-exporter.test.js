import test from 'node:test';
import assert from 'node:assert/strict';
import * as exporter from '../package-exporter.js';

test('HFE-REV-007B: Exportação Limpa de Pacote (F08)', async (t) => {
  await t.test('1. isSafeForDeployment rejeita bancos de dados, segredos e node_modules', () => {
    assert.strictEqual(exporter.isSafeForDeployment('server/db.js'), true);
    assert.strictEqual(exporter.isSafeForDeployment('public/index.html'), true);
    assert.strictEqual(exporter.isSafeForDeployment('package.json'), true);

    // Rejeições de segurança
    assert.strictEqual(exporter.isSafeForDeployment('.env'), false);
    assert.strictEqual(exporter.isSafeForDeployment('server/.env'), false);
    assert.strictEqual(exporter.isSafeForDeployment('server/data/hefesto.db'), false);
    assert.strictEqual(exporter.isSafeForDeployment('server/data/hefesto.db-wal'), false);
    assert.strictEqual(exporter.isSafeForDeployment('server/data/backups/backup_1.db'), false);
    assert.strictEqual(exporter.isSafeForDeployment('node_modules/express/index.js'), false);
    assert.strictEqual(exporter.isSafeForDeployment('.git/config'), false);
  });

  await t.test('2. getDeploymentFileList gera lista de arquivos do projeto sem bancos ou segredos', () => {
    const list = exporter.getDeploymentFileList();
    assert.ok(Array.isArray(list));
    assert.ok(list.length > 0);

    // Verifica que nenhum arquivo proibido foi incluído
    for (const item of list) {
      assert.strictEqual(exporter.isSafeForDeployment(item), true, `Arquivo inseguro detectado na lista de exportação: ${item}`);
    }

    // Garante que arquivos essenciais estão presentes
    assert.ok(list.includes('package.json'));
    assert.ok(list.some(f => f.startsWith('server/')));
    assert.ok(list.some(f => f.startsWith('public/')));
  });
});
