param(
  [string]$ApiBase = 'http://127.0.0.1',
  [string]$OutputDir = 'C:\Hefesto-MON0011-Test\audit'
)

$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'certify-vendor-supplies.mjs'
if (!(Test-Path $helper)) { throw "Helper Node nao encontrado: $helper" }
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$printers = Invoke-RestMethod "$ApiBase/api/printers" -TimeoutSec 30
$statuses = Invoke-RestMethod "$ApiBase/api/status/all" -TimeoutSec 90
$statusMap = @{}
$statuses | ForEach-Object { $statusMap[$_.id] = $_ }

function Get-FamilyInfo($p, $s) {
  $raw = "$($s.info.model) $($s.info.description) $($p.model) $($p.name)"
  $family = if ($raw -match '(?i)HL-L5212DW') {'HL-L5212DW'}
    elseif ($raw -match '(?i)M1180') {'M1180'}
    elseif ($raw -match '(?i)WF-C5890') {'WF-C5890'}
    elseif ($raw -match '(?i)WF-M5899') {'WF-M5899'}
    elseif ($raw -match '(?i)WF-M5799') {'WF-M5799'}
    elseif ($raw -match '(?i)WF-C5790') {'WF-C5790'}
    else {'Outro'}
  $vendor = if ($family -eq 'HL-L5212DW') {'Brother'}
    elseif ($family -match '^(M1180|WF-)') {'Epson'}
    else {'Outro'}
  [pscustomobject]@{ Vendor=$vendor; Family=$family }
}

$targets = foreach ($p in $printers) {
  $s = $statusMap[$p.id]
  $fi = Get-FamilyInfo $p $s
  if ($fi.Vendor -eq 'Outro' -or !$s.online) { continue }
  if (!$p.ip -or $p.ip -eq '-' -or $p.ip -match '^pendente-') { continue }
  [pscustomobject]@{
    id = $p.id
    vendor = $fi.Vendor
    family = $fi.Family
    name = $p.name
    ip = $p.ip
    community = if ($p.community) { $p.community } else { 'public' }
  }
}

$targets = $targets |
  Group-Object vendor,family |
  ForEach-Object { $_.Group | Select-Object -First 1 }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$targetsPath = Join-Path $OutputDir "vendor-targets-$stamp.json"
$jsonPath = Join-Path $OutputDir "vendor-certification-$stamp.json"
$targets | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $targetsPath

Write-Host ""
Write-Host "=== CERTIFICACAO EPSON + BROTHER ===" -ForegroundColor Cyan
Write-Host "Amostras=$($targets.Count)"
Write-Host "Somente leitura: SNMP GET + HTTP GET." -ForegroundColor DarkGray

node $helper $targetsPath $jsonPath
if ($LASTEXITCODE -ne 0) { throw "Certificacao Node falhou com codigo $LASTEXITCODE" }

$data = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "=== HEFESTO NORMALIZADO ===" -ForegroundColor Yellow
foreach ($r in $data) {
  Write-Host ""
  Write-Host "$($r.vendor) $($r.family) | protocolo=$($r.hefesto.protocol)" -ForegroundColor Cyan
  if ($r.hefesto.supplies) {
    $r.hefesto.supplies |
      Select-Object name,type,percentage,remainingPercentage,status,mibClass,semantics |
      Format-Table -AutoSize -Wrap
  } else {
    Write-Host "Sem suprimentos retornados pelo Hefesto." -ForegroundColor DarkYellow
  }
}

Write-Host ""
Write-Host "=== EVIDENCIA WEB EPSON ===" -ForegroundColor Yellow
$data | Where-Object vendor -eq 'Epson' | ForEach-Object {
  $p = $_.epsonWeb.printerInfo
  $m = $_.epsonWeb.maintenanceInfo
  [pscustomobject]@{
    Familia = $_.family
    PrinterInfoHTTP = $p.status
    MaintenanceHTTP = $m.status
    InkWaste = [bool]($p.evidence.hasInkWasteImage -or $m.evidence.hasInkWasteImage)
    MaintenanceIcon = [bool]($p.evidence.hasMaintenanceIcon -or $m.evidence.hasMaintenanceIcon)
    InkWasteHeight = if ($p.evidence.inkWasteHeight -ne $null) {$p.evidence.inkWasteHeight} else {$m.evidence.inkWasteHeight}
    PercentuaisDetectados = ((@($p.evidence.nearbyPercentages) + @($m.evidence.nearbyPercentages) | Sort-Object -Unique) -join ',')
  }
} | Format-Table -AutoSize -Wrap

Write-Host ""
Write-Host "=== OID PROPRIETARIA BROTHER ===" -ForegroundColor Yellow
$data | Where-Object vendor -eq 'Brother' | ForEach-Object {
  [pscustomobject]@{
    Familia = $_.family
    VersaoSNMP = $_.brotherPrivate.snmpVersion
    Toner = $_.brotherPrivate.interpreted.toner
    Drum = $_.brotherPrivate.interpreted.drum
    Fuser = $_.brotherPrivate.interpreted.fuser
    Laser = $_.brotherPrivate.interpreted.laser
    PFKit = $_.brotherPrivate.interpreted.pfKit
    Erro = $_.brotherPrivate.error
  }
} | Format-Table -AutoSize -Wrap

Write-Host ""
Write-Host "JSON=$jsonPath" -ForegroundColor Green
Write-Host "API_HTTP=" ((Invoke-WebRequest -UseBasicParsing "$ApiBase/" -TimeoutSec 10).StatusCode)
