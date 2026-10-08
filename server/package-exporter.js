import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Lista os arquivos que devem compor o pacote limpo de produção do Hefesto
 */
export function getDeploymentFileList(rootDir = ROOT_DIR) {
  const allowedRoots = ['public', 'server', 'deployment', 'collector', 'scripts', 'docs', 'licenses', 'package.json', '.env.example', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md', 'SECURITY.md'];
  const excludedPatterns = [
    /node_modules/i,
    /^server\/data\/(?!branding\.example\.json$)/i,
    /\.git/i,
    /\.env/i,
    /\.db(-journal|-wal|-shm)?$/i,
    /backups/i,
    /\.tmp$/i,
    /\.log$/i,
    /\.zip$/i
  ];

  const files = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      const isExcluded = excludedPatterns.some(pattern => pattern.test(relativePath));
      if (isExcluded) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  for (const rootItem of allowedRoots) {
    const itemPath = path.join(rootDir, rootItem);
    if (fs.existsSync(itemPath)) {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        walk(itemPath);
      } else {
        const rel = path.relative(rootDir, itemPath).replace(/\\/g, '/');
        files.push(rel);
      }
    }
  }

  return files;
}

/**
 * Verifica se um arquivo é seguro para distribuição no pacote limpo
 */
export function isSafeForDeployment(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();

  if (normalized.startsWith('server/data/') && normalized !== 'server/data/branding.example.json') return false;
  if (normalized.includes('node_modules')) return false;
  if (normalized.includes('.env') && normalized !== '.env.example') return false;
  if (normalized.endsWith('.db') || normalized.endsWith('.db-wal') || normalized.endsWith('.db-shm')) return false;
  if (normalized.includes('backups/')) return false;
  if (normalized.includes('.git/')) return false;

  return true;
}
