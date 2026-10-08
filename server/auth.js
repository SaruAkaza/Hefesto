import crypto from 'crypto';

// Armazenamento em memória de sessões ativas
const activeSessions = new Map();

// Armazenamento de tentativas de login para rate-limiting anti-força bruta
const failedLoginAttempts = new Map();

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_FAILED_ATTEMPTS = 10;
const RATE_LIMIT_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutos de bloqueio após 10 falhas

/**
 * Cria uma nova sessão autenticada com token criptograficamente seguro.
 */
export function createSession({ username, role = 'admin', unitId = null, unitName = null, ttlMs = DEFAULT_SESSION_TTL_MS }) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session = {
    token,
    username,
    role,
    unitId,
    unitName,
    createdAt: now,
    expiresAt: now + ttlMs,
    lastActivityAt: now
  };
  activeSessions.set(token, session);
  return session;
}

/**
 * Recupera e valida uma sessão ativa pelo token.
 */
export function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  session.lastActivityAt = Date.now();
  return session;
}

/**
 * Revoga uma sessão ativa (logout).
 */
export function revokeSession(token) {
  if (!token) return false;
  return activeSessions.delete(token);
}

/**
 * Limpa todas as sessões (útil para isolamento em testes).
 */
export function clearAllSessions() {
  activeSessions.clear();
}

/**
 * Verifica se o IP atingiu o limite de tentativas falhas de login.
 */
export function checkLoginRateLimit(ip) {
  const key = String(ip || 'unknown');
  const record = failedLoginAttempts.get(key);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const elapsed = now - record.lastFailedAt;
    if (elapsed < RATE_LIMIT_LOCKOUT_MS) {
      const remainingMs = RATE_LIMIT_LOCKOUT_MS - elapsed;
      return { allowed: false, remainingMs };
    }
    // Período de bloqueio expirou, reseta
    failedLoginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Registra o resultado de uma tentativa de login para controle de taxa.
 */
export function recordLoginAttempt(ip, success) {
  const key = String(ip || 'unknown');
  if (success) {
    failedLoginAttempts.delete(key);
    return;
  }

  const now = Date.now();
  const record = failedLoginAttempts.get(key) || { count: 0, lastFailedAt: now };
  record.count += 1;
  record.lastFailedAt = now;
  failedLoginAttempts.set(key, record);
}

/**
 * Limpa o histórico de rate limits (útil para testes).
 */
export function resetLoginRateLimits() {
  failedLoginAttempts.clear();
}

/**
 * Extrai o token de autenticação dos headers ou cookies da requisição.
 */
export function extractToken(req) {
  if (!req) return null;

  // 1. Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }

  // 2. Custom header x-admin-token
  const customHeader = req.headers?.['x-admin-token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader.trim();
  }

  // 3. Cookie hefesto_session
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)hefesto_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1].trim());
  }

  return null;
}

/**
 * Middleware Express para identificar a sessão ativa e injetar em req.user.
 */
export function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const session = getSession(token);
    if (session) {
      req.user = session;
      req.sessionToken = token;
    }
  }
  next();
}

/**
 * Middleware para exigir perfil de Administrador em rotas mutáveis / administrativas.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autenticado. Faça login como administrador para executar esta ação.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores podem executar esta ação.'
    });
  }

  next();
}

/**
 * Middleware flexível para exigir papéis específicos (ex: ['admin', 'operator']).
 */
export function requireAuth(roles = ['admin', 'operator']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso não autenticado. Sessão inválida ou expirada.'
      });
    }

    if (Array.isArray(roles) && roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Permissão insuficiente para seu perfil.'
      });
    }

    next();
  };
}
