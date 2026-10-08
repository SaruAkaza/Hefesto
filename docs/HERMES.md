# Hermes — coletor Windows

O código do coletor está em `collector/windows/HefestoCollector.cs`. Ele identifica estações e impressoras locais, processa eventos de impressão e envia lotes ao Hefesto. Não há servidor ou credencial predefinidos nesta edição.

## Compilar

No Windows com .NET Framework 4.x e compilador C# instalado:

```powershell
node scripts/build-collector.mjs
```

O script gera `deployment/collector/HefestoColetor-Setup.exe`, executa seu autoteste e grava o SHA-256. Os binários gerados não são versionados.

Execute o instalador como administrador. Informe o endereço do seu Hefesto, a unidade e o token de coleta gerado pela própria instância. O segredo local é protegido com DPAPI. O servidor recebe dados pela API `/api/workstations`.

O coletor exige Windows, permissões para instalar o serviço e acesso aos eventos de impressão. Valide o autoteste e faça um piloto com uma estação de teste antes da implantação. Não envie configurações, logs ou tokens locais ao repositório público.
