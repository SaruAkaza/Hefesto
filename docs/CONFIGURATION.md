# Configuração

Use `.env.example` como referência. O servidor carrega `.env` na raiz ou em `server/`.

| Variável | Função |
| --- | --- |
| PORT | Porta HTTP; o exemplo usa 3000 |
| ADMIN_USERNAME / ADMIN_PASSWORD | Credenciais administrativas locais |
| APP_TIME_ZONE | Fuso dos contadores diários |
| APP_MODE | `hub` ou `edge` |
| HUB_SYNC_SECRET | Segredo usado pelo hub para aceitar sincronização |
| HUB_URL / HUB_TOKEN | Endereço e segredo do hub no edge |
| EDGE_UNIT_NAME / EDGE_UNIT_ID | Identidade local da unidade edge |
| AUTO_UPDATE_ENABLED | Atualizador Git, desabilitado no exemplo |

O banco SQLite é criado em `server/data/hefesto.db`. Faça backup antes de atualizar. Dados e configurações locais são ignorados pelo Git; essa exclusão não substitui a revisão antes de publicar.

Para personalizar a marca, copie `server/data/branding.example.json` para `server/data/branding.json` e altere os valores localmente.

## Custos

Nenhuma tarifa, aluguel ou referência contratual vem preenchida. A classificação técnica de modelos não informa preços. Abra **Custos / Editar valores** para definir o preço PB geral ou o preço colorido de um modelo suportado, com vigência a partir de hoje. A ausência de preços permanece desconhecida.

Tarifas completas por equipamento podem ser cadastradas por `POST /api/admin/printing-costs/tariffs`, com sessão administrativa no cabeçalho `Authorization: Bearer <token>`. Exemplo de corpo com valores exclusivamente fictícios:

```json
{
  "printerId": "id-cadastrado-na-sua-instancia",
  "model": "Modelo Exemplo",
  "contract": "Contrato de exemplo",
  "effectiveFrom": "2026-10-08",
  "paperFormat": "A4",
  "deviceType": "mono",
  "billingRule": "single",
  "pageRate": "0.0123",
  "monthlyRent": "10.00",
  "rentRule": "prorated",
  "unitId": "id-da-sua-unidade",
  "location": "Laboratório"
}
```

Cada nova tarifa por equipamento exige uma data posterior à versão anterior. Equipamentos coloridos com tarifa única exigem `confirmSingleRate: true`; sem confirmação, use `billingRule: "unresolved"`. O histórico total sem separação PB/cor não é convertido em volume colorido conhecido.

Uma tarifa PB geral vigente prevalece sobre o preço PB por equipamento. Não altera as vigências anteriores. Aluguel e impressão aparecem separadamente; leituras ausentes ou regressivas deixam o cálculo parcial.
