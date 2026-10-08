param(
  [ValidateSet('Sample','All')]
  [string]$Mode = 'Sample',
  [string]$ApiBase = 'http://127.0.0.1',
  [string]$OutputDir = 'C:\Hefesto-MON0011-Test\audit'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeAudit = Join-Path $PSScriptRoot 'audit-printer-mib.mjs'

if (!(Test-Path $nodeAudit)) { throw "Helper Node nao encontrado: $nodeAudit" }
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
    elseif ($raw -match '(?i)CX735adse') {'CX735adse'}
    elseif ($raw -match '(?i)CX725') {'CX725'}
    elseif ($raw -match '(?i)CX532adwe') {'CX532adwe'}
    elseif ($raw -match '(?i)CX522ade') {'CX522ade'}
    elseif ($raw -match '(?i)MX622adhe') {'MX622adhe'}
    elseif ($raw -match '(?i)MX522adhe') {'MX522adhe'}
    elseif ($raw -match '(?i)MS421dn') {'MS421dn'}
    elseif ($raw -match '(?i)C60.*C70|C60-C70|Color EX') {'C60/C70'}
    else {'Nao identificado'}

  $vendor = if ($family -eq 'HL-L5212DW' -or $raw -match '(?i)brother') {'Brother'}
    elseif ($family -match '^CX|^MX|^MS' -or $raw -match '(?i)lexmark') {'Lexmark'}
    elseif ($family -eq 'C60/C70' -or $raw -match '(?i)xerox') {'Xerox'}
    elseif ($family -match '^(M1180|WF-)' -or $raw -match '(?i)epson') {'Epson'}
    else {'Outro'}

  [pscustomobject]@{ Vendor=$vendor; Family=$family }
}

$targets = foreach ($p in $printers) {
  $s = $statusMap[$p.id]
  $fi = Get-FamilyInfo $p $s
  if ($fi.Family -eq 'Nao identificado') { continue }
  if (!$p.ip -or $p.ip -eq '-' -or $p.ip -match '^pendente-') { continue }
  [pscustomobject]@{
    id        = $p.id
    vendor    = $fi.Vendor
    family    = $fi.Family
    name      = $p.name
    ip        = $p.ip
    community = if ($p.community) { $p.community } else { 'public' }
    online    = [bool]$s.online
  }
}

if ($Mode -eq 'Sample') {
  $targets = $targets |
    Where-Object { $_.online } |
    Group-Object vendor,family |
    ForEach-Object { $_.Group | Select-Object -First 1 }
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$targetsPath = Join-Path $OutputDir "targets-$Mode-$stamp.json"
$jsonPath = Join-Path $OutputDir "mib-raw-$Mode-$stamp.json"
$csvPath = Join-Path $OutputDir "mib-audit-$Mode-$stamp.csv"

$targets | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $targetsPath

Write-Host ""
Write-Host "=== AUDITORIA PRINTER-MIB ($Mode) ===" -ForegroundColor Cyan
Write-Host "Alvos=$($targets.Count)"
Write-Host "Somente leitura SNMP. Nenhum SET sera executado." -ForegroundColor DarkGray

node $nodeAudit $targetsPath $jsonPath
if ($LASTEXITCODE -ne 0) { throw "Auditoria Node falhou com codigo $LASTEXITCODE" }

$raw = Get-Content $jsonPath -Raw | ConvertFrom-Json
$raw | Select-Object vendor,family,name,ip,snmpVersion,index,classCode,className,typeCode,typeName,unitCode,unitName,description,maxCapacity,rawLevel,remainingPercent,semantics,error |
  Export-Csv $csvPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "=== RESUMO POR FAMILIA ===" -ForegroundColor Yellow
$raw |
  Where-Object { !$_.error } |
  Group-Object vendor,family |
  ForEach-Object {
    [pscustomobject]@{
      Fabricante = $_.Group[0].vendor
      Familia = $_.Group[0].family
      EntradasMIB = $_.Count
      Classes = (($_.Group.className | Sort-Object -Unique) -join ', ')
      Tipos = (($_.Group.typeName | Sort-Object -Unique) -join ', ')
      Unidades = (($_.Group.unitName | Sort-Object -Unique) -join ', ')
    }
  } | Format-Table -AutoSize -Wrap

Write-Host ""
Write-Host "=== ITENS DE MANUTENCAO / RESIDUO / IMAGEM / FUSOR ===" -ForegroundColor Yellow
$raw |
  Where-Object {
    !$_.error -and (
      $_.className -eq 'receptacleThatIsFilled' -or
      $_.typeName -match 'waste|opc|fuser|transfer|cleaner|developer' -or
      $_.description -match '(?i)waste|maintenance|maint|drum|imaging|fuser|transfer|resid|manuten|cilind'
    )
  } |
  Select-Object vendor,family,ip,className,typeName,description,maxCapacity,rawLevel,remainingPercent,semantics |
  Format-Table -AutoSize -Wrap

$errors = $raw | Where-Object { $_.error }
if ($errors) {
  Write-Host ""
  Write-Host "=== SEM RESPOSTA SNMP ===" -ForegroundColor DarkYellow
  $errors | Select-Object vendor,family,name,ip,error | Format-Table -AutoSize -Wrap
}

Write-Host ""
Write-Host "CSV=$csvPath" -ForegroundColor Green
Write-Host "JSON_RAW=$jsonPath" -ForegroundColor Green
Write-Host "API_HTTP=" ((Invoke-WebRequest -UseBasicParsing "$ApiBase/" -TimeoutSec 10).StatusCode)
