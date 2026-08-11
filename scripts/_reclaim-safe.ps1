$ErrorActionPreference = "Continue"

function SizeGB([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) { return 0 }
  $out = robocopy $p NULL /L /S /NJH /NFL /NDL /NC /NS /NP /BYTES /R:0 /W:0 2>&1 | Out-String
  if ($out -match "Bytes\s*:\s*([\d,]+)") {
    return [math]::Round(([int64]($Matches[1] -replace ",", "")) / 1GB, 2)
  }
  return 0
}

function NukeDir([string]$p, [string]$label) {
  if (-not (Test-Path -LiteralPath $p)) {
    Write-Host "[skip] $label (missing)"
    return 0
  }
  $before = SizeGB $p
  Write-Host "[nuke] $label ($before GB) -> $p"
  try {
    $empty = Join-Path $env:TEMP ("wc-empty-" + [guid]::NewGuid().ToString("n"))
    New-Item -ItemType Directory -Path $empty | Out-Null
    robocopy $empty $p /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
  } catch {
    Write-Host ("[warn] {0}: {1}" -f $label, $_)
  }
  $left = if (Test-Path -LiteralPath $p) { SizeGB $p } else { 0 }
  Write-Host ("[done] {0} leftover={1}GB" -f $label, $left)
  return [math]::Max(0, $before - $left)
}

$freeBefore = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
Write-Host "Free before: ${freeBefore}GB"
$reclaimed = 0.0

# 1) fnm temporary multishells
$reclaimed += NukeDir "$env:LOCALAPPDATA\fnm_multishells" "fnm_multishells"

# 2) Cursor sandbox cache in Temp
$reclaimed += NukeDir "$env:LOCALAPPDATA\Temp\cursor-sandbox-cache" "cursor-sandbox-cache"

# 3) Named packaging/temp leftovers only
$tempRoot = "$env:LOCALAPPDATA\Temp"
Get-ChildItem $tempRoot -Directory -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -like "wc-sfx-*" -or
  $_.Name -like "wc-empty-*" -or
  $_.Name -like "vscode-stable-user-*" -or
  $_.Name -like "wct*" -or
  $_.Name -eq "windowssdk"
} | ForEach-Object {
  $reclaimed += NukeDir $_.FullName ("Temp\" + $_.Name)
}

# 4) Chrome caches only (keep profile)
$chromeBase = "$env:LOCALAPPDATA\Google\Chrome\User Data"
if (Test-Path $chromeBase) {
  Get-ChildItem $chromeBase -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($c in @("Cache", "Code Cache", "GPUCache", "Service Worker\CacheStorage", "GrShaderCache", "ShaderCache")) {
      $target = Join-Path $_.FullName $c
      if (Test-Path -LiteralPath $target) {
        $reclaimed += NukeDir $target ("Chrome\$($_.Name)\$c")
      }
    }
  }
}

# 5) Cursor caches only — not settings/workspaceStorage
foreach ($root in @("$env:APPDATA\Cursor", "$env:LOCALAPPDATA\Cursor")) {
  if (-not (Test-Path $root)) { continue }
  foreach ($c in @("Cache", "CachedData", "Code Cache", "GPUCache", "ShaderCache", "DawnGraphiteCache", "DawnWebGPUCache", "blob_storage")) {
    $target = Join-Path $root $c
    if (Test-Path -LiteralPath $target) {
      $reclaimed += NukeDir $target ("Cursor\$c")
    }
  }
}

# 6) npm cache
$reclaimed += NukeDir "$env:LOCALAPPDATA\npm-cache" "npm-cache"

# 7) Recycle Bin
Write-Host "[nuke] Recycle Bin"
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

$freeAfter = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$delta = [math]::Round($freeAfter - $freeBefore, 2)
Write-Host ""
Write-Host "Estimated reclaimed (folder deltas): ${reclaimed}GB"
Write-Host "Free after: ${freeAfter}GB (delta +${delta}GB)"
Write-Host "Skipped OneDrive (use Files On-Demand Free up space; do not delete cloud files)."
