import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../server.js';
import * as db from '../db.js';
import { createSession, getSession, revokeSession, clearAllSessions, checkLoginRateLimit, recordLoginAttempt, resetLoginRateLimits } from '../auth.js';

test('auth module: unit tests for session lifecycle and rate limiting', () => {
  clearAllSessions();
  resetLoginRateLimits();

  // 1. Session creation and retrieval
  const session = createSession({ username: 'admin', role: 'admin' });
  assert.ok(session.token, 'Token deve ser gerado');
  assert.equal(session.username, 'admin');
  assert.equal(session.role, 'admin');

  const retrieved = getSession(session.token);
  assert.ok(retrieved, 'Sessão deve ser recuperada');
  assert.equal(retrieved.username, 'admin');

  // 2. Session expiration
  const expiredSession = createSession({ username: 'admin', role: 'admin', ttlMs: -1000 });
  assert.equal(getSession(expiredSession.token), null, 'Sessão expirada deve retornar null');

  // 3. Session revocation
  revokeSession(session.token);
  assert.equal(getSession(session.token), null, 'Sessão revogada deve retornar null');

  // 4. Rate limiting
  const testIp = '198.18.1.100';
  for (let i = 0; i < 9; i++) {
    recordLoginAttempt(testIp, false);
    assert.equal(checkLoginRateLimit(testIp).allowed, true, 'Menos de 10 tentativas deve ser permitido');
  }
  recordLoginAttempt(testIp, false); // 10ª tentativa
  assert.equal(checkLoginRateLimit(testIp).allowed, false, '10 tentativas falhas devem bloquear novas tentativas');

  recordLoginAttempt(testIp, true); // Sucesso reseta bloqueio
  assert.equal(checkLoginRateLimit(testIp).allowed, true, 'Tentativa com sucesso deve resetar rate limit');
});

test('auth HTTP integration: protects administrative routes from unauthorized access', async () => {
  // Configura DB isolado em memória
  const memDb = new DatabaseSync(':memory:');
  db.createSchema(memDb);
  db.setDatabase(memDb);
  clearAllSessions();
  resetLoginRateLimits();

  // Inicia servidor HTTP em porta aleatória temporária
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'test-secret-password-123';

  try {
    // 1. Anônimo tenta criar unidade -> 401
    const unauthRes = await fetch(`${baseUrl}/api/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unidade Não Autorizada' })
    });
    assert.equal(unauthRes.status, 401, 'POST /api/units sem autenticação deve retornar 401');

    // 2. Anônimo tenta criar impressora -> 401
    const unauthPrinterRes = await fetch(`${baseUrl}/api/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Imp 1', ip: '198.18.8.1' })
    });
    assert.equal(unauthPrinterRes.status, 401, 'POST /api/printers sem autenticação deve retornar 401');

    // 3. Login com senha errada -> 401
    const wrongLoginRes = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
    });
    assert.equal(wrongLoginRes.status, 401, 'Login incorreto deve retornar 401');

    // 4. Login com credenciais corretas -> 200 e token emitido
    const loginRes = await fetch(`${baseUrl}/api/auth/verify-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-secret-password-123' })
    });
    assert.equal(loginRes.status, 200, 'Login correto deve retornar 200');
    const loginData = await loginRes.json();
    assert.ok(loginData.token, 'Token deve estar presente na resposta de login');
    const adminToken = loginData.token;

    // 5. Checagem de sessão ativa -> 200
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.role, 'admin');

    // 6. Administrador autenticado cria unidade com sucesso -> 201
    const authUnitRes = await fetch(`${baseUrl}/api/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Unidade Alpha Teste', region: 'SP' })
    });
    assert.equal(authUnitRes.status, 201, 'POST /api/units com token válido deve retornar 201');
    const createdUnit = await authUnitRes.json();
    assert.equal(createdUnit.name, 'Unidade Alpha Teste');

    // 7. Logout revoga a sessão
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(logoutRes.status, 200);

    // 8. Tentativa com token revogado -> 401
    const postLogoutRes = await fetch(`${baseUrl}/api/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Unidade Pós-Logout' })
    });
    assert.equal(postLogoutRes.status, 401, 'Token revogado após logout deve retornar 401');

    // 9. Leitura pública permitida sem auth
    const publicUnitsRes = await fetch(`${baseUrl}/api/units`);
    assert.equal(publicUnitsRes.status, 200, 'GET /api/units continua acessível para visualização');
  } finally {
    server.close();
    db.closeDatabase();
  }
});
