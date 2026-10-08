# Arquitetura

O servidor Node.js usa Express, SQLite nativo e net-snmp. A interface em `public/` usa JavaScript, HTML e CSS. O Hermes é um coletor Windows em C#.

| Parte | Responsabilidade |
| --- | --- |
| server/db.js | Esquema, migrações genéricas e persistência do inventário |
| server/snmp-service.js | Consulta SNMP e normalização de suprimentos |
| server/device-alerts.js | Interpretação dos alertas do dispositivo |
| server/consumable-lifecycle-*.js | Evidências e ciclos de consumíveis |
| server/technical-*.js | Intervenções, diagnóstico e auditoria |
| server/printer-replacement-*.js | Substituição e preservação de histórico |
| server/printing-cost-*.js | Tarifas locais e estimativas |
| server/workstations.js | Recepção autenticada de lotes do Hermes |
| server/edge-*.js | Sincronização de unidades |

SQLite é a fonte de verdade. Uma reinicialização não deve sobrescrever edições, ressuscitar equipamentos removidos ou inventar ciclos antigos. Suprimentos desconhecidos permanecem desconhecidos. A confirmação de uma manutenção exige leituras compatíveis e atuais do mesmo equipamento.

## Limites

- Fabricantes e modelos podem expor dados diferentes; disponibilidade não garante suporte integral.
- Previsões são estimativas e exigem histórico suficiente.
- O contador total de uma impressora colorida não comprova a separação PB/cor.
- Perfis de rendimento certificados, automação de resets e assistente IA não estão concluídos.
- Esta edição inclui somente impressoras e coleta Windows.

Os scripts Windows exigem validação em Windows. O serviço do painel também depende de um wrapper WinSW fornecido separadamente; o executável não integra este código-fonte. A instalação local com `npm start` funciona sem esse wrapper.
