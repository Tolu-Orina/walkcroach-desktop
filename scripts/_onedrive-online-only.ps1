# Safely reclaim OneDrive LOCAL disk only. Does NOT delete cloud files.
# Unpins OneDrive to online-only, then RE-PINS the CF exception folder.
$ErrorActionPreference = "Continue"

$od = $env:OneDrive
if (-not $od -or -not (Test-Path -LiteralPath $od)) {
  $od = Join-Path $env:USERPROFILE "OneDrive"
}
if (-not (Test-Path -LiteralPath $od)) {
  Write-Host "OneDrive folder not found - aborting."
  exit 1
}

$cfKeep = Join-Path $od "Desktop\New folder\CF"
if (-not (Test-Path -LiteralPath $cfKeep)) {
  Write-Host "CF exception folder missing: $cfKeep"
  Write-Host "Aborting so we do not unpin without a confirmed exception path."
  exit 1
}

function SizeGB([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) { return 0 }
  $out = robocopy $p NULL /L /S /NJH /NFL /NDL /NC /NS /NP /BYTES /R:0 /W:0 2>&1 | Out-String
  $m = [regex]::Match($out, "Bytes\s*:\s*([0-9,]+)")
  if ($m.Success) {
    $n = $m.Groups[1].Value.Replace(",", "")
    return [math]::Round(([int64]$n) / 1GB, 2)
  }
  return 0
}

$attrib = Join-Path $env:SystemRoot "System32\attrib.exe"
$freeBefore = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$sizeBefore = SizeGB $od
$cfBefore = SizeGB $cfKeep

Write-Host "OneDrive folder: $od"
Write-Host "EXCEPTION (keep local): $cfKeep"
Write-Host "OneDrive local footprint before: ${sizeBefore}GB"
Write-Host "CF local footprint before: ${cfBefore}GB"
Write-Host "C: free before: ${freeBefore}GB"
Write-Host ""
Write-Host "Safe mode: online-only for everything else. CF will be re-pinned. Nothing deleted from cloud."
Write-Host ""

Write-Host "Step 1: attrib +U -P on OneDrive (online-only)..."
& $attrib "+U" "-P" "$od\*" "/S" "/D" | Out-Null
Write-Host "attrib unpin exit: $LASTEXITCODE"

Write-Host "Step 2: attrib +P -U on CF exception (keep local)..."
& $attrib "+P" "-U" "$cfKeep" | Out-Null
& $attrib "+P" "-U" "$cfKeep\*" "/S" "/D" | Out-Null
Write-Host "attrib pin CF exit: $LASTEXITCODE"

try {
  $shell = New-Object -ComObject Shell.Application
  $folder = $shell.NameSpace($cfKeep)
  if ($null -ne $folder) {
    foreach ($verb in $folder.Self.Verbs()) {
      $name = ($verb.Name -replace "&", "")
      if ($name -match "always keep") {
        Write-Host "Invoking Explorer verb on CF: $name"
        $verb.DoIt()
        break
      }
    }
  }
} catch {
  Write-Host ("CF shell verb skipped: {0}" -f $_)
}

Start-Sleep -Seconds 8

$sizeAfter = SizeGB $od
$cfAfter = SizeGB $cfKeep
$freeAfter = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$delta = [math]::Round($freeAfter - $freeBefore, 2)
Write-Host ""
Write-Host "OneDrive local footprint after: ${sizeAfter}GB (was ${sizeBefore}GB)"
Write-Host "CF local footprint after: ${cfAfter}GB (was ${cfBefore}GB)"
Write-Host "C: free after: ${freeAfter}GB (delta +${delta}GB)"
Write-Host ""
Write-Host "Cloud files were NOT deleted. CF kept available offline."
