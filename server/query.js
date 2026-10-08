import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'hefesto.db');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 5000');
const inputQuery = process.argv.slice(2).join(' ').trim();

if (!inputQuery || inputQuery.toLowerCase() === 'tables' || inputQuery.toLowerCase() === 'tabelas') {
  console.log('\n📂 Tabelas disponíveis no banco hefesto.db:\n');
  const tables = db.prepare(`
    SELECT name AS Tabela,
           (SELECT COUNT(*) FROM pragma_table_info(m.name)) AS Colunas
    FROM sqlite_master m
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  console.table(tables);
  console.log('\n💡 Dica de uso:');
  console.log('   node server/query.js "SELECT * FROM recharges LIMIT 5"');
  console.log('   node server/query.js "SELECT id, name, ip, location FROM printers LIMIT 10"\n');
  process.exit(0);
}

try {
  const stmt = db.prepare(inputQuery);
  const rows = stmt.all();
  if (rows.length === 0) {
    console.log('\nℹ️ Nenhum registro retornado ou operação concluída.\n');
  } else {
    console.log('\n📊 Resultado da consulta:\n');
    console.table(rows);
    console.log(`Total de registros retornados: ${rows.length}\n`);
  }
} catch (err) {
  console.error('\n❌ Erro ao executar SQL:', err.message, '\n');
}
