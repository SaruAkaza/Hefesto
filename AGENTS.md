# Hefesto — instruções de manutenção

Escopo: impressoras SNMP, suprimentos, diagnóstico, custos locais, hub/edge e coletor Hermes.

- Use Node.js >=22.13. Execute `npm ci --prefix server` e `npm run ci`.
- Testes devem usar SQLite em memória ou diretórios temporários; nunca `server/data/hefesto.db` de uma instalação.
- SQLite é a fonte de verdade. Seeds locais opcionais não devem sobrescrever edições ou recriar tombstones.
- Nenhuma unidade, rede, impressora, tarifa, credencial ou marca de uma instalação vem predefinida.
- Preserve trilhas de auditoria, histórico técnico, contadores e substituições.
- Valores desconhecidos não são zero e não sustentam previsões inventadas.
- Use execFile assíncrono com argumentos separados, validação e timeout para comandos externos.
- Atualize versão nos dois manifests, no lock do servidor, no fallback da aplicação e nos links de cache HTML.
- Use somente dados sintéticos em documentação, fixtures e exemplos.
