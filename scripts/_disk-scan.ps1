$ErrorActionPreference = "SilentlyContinue"

function FolderSizeGB([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $out = robocopy $path NULL /L /S /NJH /NFL /NDL /NC /NS /NP /BYTES /R:0 /W:0 2>&1 | Out-String
  if ($out -match "Bytes\s*:\s*([\d,]+)") {
    $bytes = [int64]($Matches[1] -replace ",", "")
    return [math]::Round($bytes / 1GB, 2)
  }
  return $null
}

$used = [math]::Round((Get-PSDrive C).Used / 1GB, 1)
$free = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
Write-Host "Drive C: Used=${used}GB Free=${free}GB"
Write-Host ""
Write-Host "=== Top-level C:\ ==="
$top = @()
Get-ChildItem -Force C:\ -Directory | ForEach-Object {
  $gb = FolderSizeGB $_.FullName
  if ($null -ne $gb) {
    $top += [PSCustomObject]@{ GB = $gb; Path = $_.FullName }
  }
}
$top | Sort-Object GB -Descending | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

Write-Host "=== Hotspots ==="
$u = $env:USERPROFILE
$paths = @(
  "$u\AppData\Local",
  "$u\AppData\Roaming",
  "$u\AppData\Local\Temp",
  "$u\AppData\Local\Docker",
  "$u\AppData\Local\Packages",
  "$u\AppData\Local\pnpm",
  "$u\AppData\Local\npm-cache",
  "$u\AppData\Local\Programs",
  "$u\AppData\Local\Google",
  "$u\.cursor",
  "$u\.vscode",
  "$u\dev",
  "$u\Downloads",
  "C:\Program Files",
  "C:\Program Files (x86)",
  "C:\ProgramData",
  "C:\Windows",
  "C:\Windows\SoftwareDistribution\Download",
  "C:\Windows\Temp",
  "C:\hiberfil.sys",
  "C:\pagefile.sys",
  "C:\swapfile.sys"
)
$hot = @()
foreach ($p in $paths) {
  if (-not (Test-Path -LiteralPath $p)) { continue }
  $item = Get-Item -LiteralPath $p -Force
  if ($item.PSIsContainer) {
    $gb = FolderSizeGB $p
    if ($null -ne $gb) {
      $hot += [PSCustomObject]@{ GB = $gb; Path = $p }
    }
  } else {
    $hot += [PSCustomObject]@{ GB = [math]::Round($item.Length / 1GB, 2); Path = $p }
  }
}
$hot | Sort-Object GB -Descending | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
