# ==============================================================================
# SCRIPT DE INSTALAÇÃO DO HEFESTO PRINT MONITOR COMO SERVIÇO WINDOWS DEDICADO
# ==============================================================================

# 1. Garante elevação de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[Hefesto] Solicitando privilégios de Administrador..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$serverDir = Join-Path $rootDir "server"
$serviceExe = Join-Path $scriptDir "HefestoService.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   INSTALADOR DO SERVIÇO WINDOWS - HEFESTO PRINT MONITOR    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Verificação e Instalação do Node.js (Requer Node >= 22.13.0 para node:sqlite nativo)
Write-Host "[1/5] Verificando ambiente Node.js (requer v22.13.0+ para SQLite nativo)..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $env:Path += ";C:\Program Files\nodejs"
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    }
}

$needInstall = $false
if (-not $nodeCmd) {
    Write-Host " -> Node.js não detectado no sistema." -ForegroundColor Yellow
    $needInstall = $true
} else {
    $nodeVersionRaw = node -v
    $nodeVersion = [version]($nodeVersionRaw.Trim().TrimStart("v"))
    if ($nodeVersion -lt [version]"22.13.0") {
        Write-Host " -> Versão atual do Node.js ($nodeVersionRaw) é anterior à v22.13.0." -ForegroundColor Yellow
        Write-Host " -> O banco SQLite nativo do Hefesto requer Node v22.13.0+. Atualizando..." -ForegroundColor Yellow
        $needInstall = $true
    } else {
        Write-Host " -> Node.js detectado: $nodeVersionRaw (compatível com SQLite nativo)" -ForegroundColor Green
    }
}

if ($needInstall) {
    Write-Host " -> Baixando instalador oficial do Node.js LTS (v22.14.0 x64)..." -ForegroundColor Cyan
    $nodeMsiUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
    $tempMsi = Join-Path $env:TEMP "nodejs-v22-lts.msi"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeMsiUrl -OutFile $tempMsi -UseBasicParsing
        Write-Host " -> Instalando/Atualizando Node.js silenciosamente..." -ForegroundColor Cyan
        Start-Process msiexec.exe -ArgumentList "/i `"$tempMsi`" /qn /norestart" -Wait
        $env:Path += ";C:\Program Files\nodejs"
        Remove-Item $tempMsi -Force -ErrorAction SilentlyContinue
        Write-Host " -> Node.js v22 LTS instalado com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Não foi possível instalar o Node.js automaticamente: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Por favor, baixe o Node.js v22 em https://nodejs.org e execute novamente este instalador." -ForegroundColor Red
        Pause
        exit 1
    }
}

# 2.1 Verificação do Git (necessário para Auto-Update via GitHub)
Write-Host " -> Verificando Git for Windows (para auto-atualizacoes)..." -ForegroundColor Yellow
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
        $env:Path += ";C:\Program Files\Git\cmd"
        $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    }
}

if ($gitCmd) {
    $gitVersion = git --version
    Write-Host " -> Git detectado: $gitVersion (Auto-Update pronto!)" -ForegroundColor Green
} else {
    Write-Host " -> Git nao detectado no sistema." -ForegroundColor Yellow
    Write-Host " -> Tentando instalar Git for Windows silenciosamente..." -ForegroundColor Cyan
    try {
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
            $env:Path += ";C:\Program Files\Git\cmd"
            Write-Host " -> Git instalado com sucesso via winget!" -ForegroundColor Green
        } else {
            Write-Host " -> Aviso: Git nao instalado. O painel funcionara perfeitamente, mas para receber auto-atualizacoes do GitHub instale o Git posteriormente." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host " -> Aviso: Nao foi possivel instalar Git automaticamente. O painel operara normalmente." -ForegroundColor DarkYellow
    }
}

# Configura safe.directory no Git para evitar erro de dubious ownership com usuarios locais e de dominio
try {
    git config --system --add safe.directory "$rootDir"
    Write-Host " -> Repositório Hefesto configurado como diretório seguro no Git." -ForegroundColor Green
} catch {}

# 3. Verificação de dependências do servidor
Write-Host "[2/5] Verificando dependências do servidor (npm)..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $serverDir "node_modules"))) {
    Write-Host " -> Instalando dependências em $serverDir..." -ForegroundColor Cyan
    Push-Location $serverDir
    try {
        npm install --omit=dev --no-audit --no-fund
    } finally {
        Pop-Location
    }
} else {
    Write-Host " -> Módulos do servidor já presentes." -ForegroundColor Green
}

# 4. Configuração das Regras do Firewall do Windows
Write-Host "[3/5] Configurando regras no Firewall do Windows..." -ForegroundColor Yellow
try {
    # Libera Porta 80 HTTP (Entrada)
    $existingRuleHttp = Get-NetFirewallRule -DisplayName "Hefesto Print Monitor (HTTP Porta 80)" -ErrorAction SilentlyContinue
    if (-not $existingRuleHttp) {
        New-NetFirewallRule -DisplayName "Hefesto Print Monitor (HTTP Porta 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -Profile Any -Description "Permite acesso web à interface do painel Hefesto" | Out-Null
        Write-Host " -> Regra de Firewall HTTP Porta 80 criada." -ForegroundColor Green
    } else {
        Write-Host " -> Regra de Firewall HTTP Porta 80 já existe." -ForegroundColor Green
    }

    # Libera Porta 161 UDP SNMP (Entrada e Saída)
    $existingRuleSnmp = Get-NetFirewallRule -DisplayName "Hefesto Print Monitor (SNMP UDP 161)" -ErrorAction SilentlyContinue
    if (-not $existingRuleSnmp) {
        New-NetFirewallRule -DisplayName "Hefesto Print Monitor (SNMP UDP 161)" -Direction Inbound -LocalPort 161 -Protocol UDP -Action Allow -Profile Any -Description "Permite respostas de telemetria SNMP das impressoras" | Out-Null
        Write-Host " -> Regra de Firewall SNMP criada." -ForegroundColor Green
    } else {
        Write-Host " -> Regra de Firewall SNMP já existe." -ForegroundColor Green
    }
} catch {
    Write-Host " -> Aviso ao configurar Firewall: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# 5. Instalação e Inicialização do Serviço Windows
Write-Host "[4/5] Registrando Serviço Windows 'HefestoPrintMonitor'..." -ForegroundColor Yellow

if (-not (Test-Path $serviceExe)) {
    Write-Host "ERRO: O executável $serviceExe não foi encontrado." -ForegroundColor Red
    Pause
    exit 1
}

Push-Location $scriptDir
try {
    # Para e desinstala qualquer versão prévia do serviço
    & $serviceExe stop 2>$null | Out-Null
    Start-Sleep -Seconds 2
    & $serviceExe uninstall 2>$null | Out-Null
    Start-Sleep -Seconds 2

    # Instala e Inicia
    Write-Host " -> Registrando novo serviço..." -ForegroundColor Cyan
    & $serviceExe install
    Start-Sleep -Seconds 2

    Write-Host " -> Configurando política de auto-recuperação contínua no Windows (SCM)..." -ForegroundColor Cyan
    sc.exe failure HefestoPrintMonitor reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
    sc.exe failureflag HefestoPrintMonitor 1 | Out-Null

    Write-Host "[5/5] Iniciando serviço Windows..." -ForegroundColor Yellow
    & $serviceExe start
    Start-Sleep -Seconds 3

    $serviceStatus = Get-Service -Name "HefestoPrintMonitor" -ErrorAction SilentlyContinue
    if ($serviceStatus -and $serviceStatus.Status -eq "Running") {
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "   HEFESTO INSTALADO E RODANDO COMO SERVIÇO COM SUCESSO!    " -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host " -> O serviço inicia automaticamente no boot do Windows." -ForegroundColor Green
        Write-Host " -> Não necessita de login de usuário na máquina servidora." -ForegroundColor Green
        Write-Host ""

        # Obter endereços IPs da máquina
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
        Write-Host "Endereços para acessar na rede:" -ForegroundColor Cyan
        Write-Host " • Localmente: http://localhost/" -ForegroundColor White
        foreach ($ip in $ips) {
            Write-Host " • Na Rede ($($ip.InterfaceAlias)): http://$($ip.IPAddress)/" -ForegroundColor White
        }
        Write-Host ""
    } else {
        Write-Host "Aviso: O serviço foi instalado, mas o status atual é: $($serviceStatus.Status)" -ForegroundColor Yellow
        Write-Host "Consulte os logs em: $scriptDir\logs" -ForegroundColor Cyan
    }
} catch {
    Write-Host "ERRO na instalação do serviço: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
