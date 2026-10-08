# ==============================================================================
# SCRIPT DE DESINSTALAÇÃO DO SERVIÇO WINDOWS - HEFESTO PRINT MONITOR
# ==============================================================================

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[Hefesto] Solicitando privilégios de Administrador..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serviceExe = Join-Path $scriptDir "HefestoService.exe"

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "   DESINSTALAÇÃO DO SERVIÇO WINDOWS - HEFESTO              " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $serviceExe) {
    Push-Location $scriptDir
    try {
        Write-Host "Parando serviço 'HefestoPrintMonitor'..." -ForegroundColor Cyan
        & $serviceExe stop 2>$null | Out-Null
        Start-Sleep -Seconds 2

        Write-Host "Removendo serviço do sistema operacional..." -ForegroundColor Cyan
        & $serviceExe uninstall
        Start-Sleep -Seconds 2

        Write-Host ""
        Write-Host "[OK] Serviço desinstalado com sucesso." -ForegroundColor Green
        Write-Host "Os dados do banco de dados (hefesto.db) foram preservados intactos." -ForegroundColor Green
    } catch {
        Write-Host "Erro ao desinstalar serviço: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Executável $serviceExe não encontrado." -ForegroundColor Red
}

Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
