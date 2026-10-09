# Hefesto

Monitoramento de impressoras de rede via SNMP e coleta de impressoras USB com Hermes.

O Hefesto reúne inventário, conectividade, suprimentos, contadores, alertas, histórico técnico e estimativas de custos em um painel web. A instalação começa com banco vazio: unidades, equipamentos, redes e preços são configurados localmente.

## Apresentação em vídeo

[![Assistir à apresentação pública do Hefesto, narrada por Matheus Izaias](docs/media/hefesto-apresentacao-capa.png)](https://saruakaza.github.io/Hefesto/media/)

**[▶ Assistir à apresentação completa (2 min)](https://saruakaza.github.io/Hefesto/media/)** · [Baixar o MP4](https://github.com/SaruAkaza/Hefesto/raw/refs/heads/main/docs/media/Hefesto-apresentacao-publica-voz-Matheus.mp4)

Demonstração da edição pública com dados fictícios e narração de Matheus Izaias. Clique na capa ou no link acima para abrir o vídeo.

## Recursos

- Impressoras de rede: descoberta por IP, número de série ou MAC, importação de planilhas e consulta SNMP.
- Suprimentos: níveis, semântica de consumo, registros de abastecimento e previsão baseada em leituras disponíveis.
- Diagnóstico: alertas do equipamento, evidências, intervenções auditáveis e recorrência de manutenção.
- Inventário: substituição de impressoras com preservação do histórico do equipamento anterior.
- Impressoras USB: código-fonte do coletor Windows Hermes, com associação da estação e envio autenticado.
- Custos: preços configuráveis, vigências preservadas, relatórios por unidade, setor e equipamento.
- Operação distribuída: modos hub e edge, com sincronização autenticada.

## Instalação local

Requisitos: Node.js 22.13 ou superior, npm e acesso às impressoras que você administra. O SNMP precisa estar habilitado nos equipamentos.

```sh
git clone https://github.com/SaruAkaza/Hefesto.git
cd Hefesto
npm ci --prefix server
cp .env.example .env
```

No PowerShell, substitua o último comando por `Copy-Item .env.example .env`.

Edite `.env`: defina uma senha própria em `ADMIN_PASSWORD` e, se usar sincronização, um segredo aleatório em `HUB_SYNC_SECRET`. Nunca envie esse arquivo ao GitHub.

```sh
npm start
```

Abra `http://localhost:3000`. Entre como administrador usando as credenciais definidas, cadastre uma unidade e adicione suas impressoras. Cadastre redes explicitamente antes de varrer um intervalo. Os endereços reservados dos exemplos e testes não são equipamentos reais.

Para usar um ZIP do código-fonte, extraia a pasta e execute os mesmos comandos a partir de `npm ci --prefix server`.

## Documentação

- [Configuração e custos](docs/CONFIGURATION.md)
- [Coletor Hermes](docs/HERMES.md)
- [Arquitetura e limites](docs/ARCHITECTURE.md)
- [Contribuições](CONTRIBUTING.md)
- [Segurança](SECURITY.md)
- [Licenças de terceiros](THIRD_PARTY_NOTICES.md)

## Verificação

```sh
npm ci --prefix server
npm run ci
```

Os testes usam bancos temporários ou em memória. Não é necessário acessar impressoras para executar a suíte.

## Autoria e licença

Criado por **Matheus Izaias (SaruAkaza)**. Copyright © 2026 Matheus Izaias.

O código próprio do Hefesto é distribuído sob a [licença MIT](LICENSE). É permitido usar, modificar e distribuir o software, inclusive comercialmente, preservando o aviso de copyright e o texto da licença. A licença não transfere automaticamente ao autor original os direitos sobre alterações de terceiros.

Dependências de terceiros conservam suas respectivas licenças e avisos, descritos em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
