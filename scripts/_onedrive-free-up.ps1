# Invoke OneDrive "Free up space" (dehydrate local copies).
# CF exception must already be pinned (Always keep on this device).
# Does NOT delete cloud files.
$ErrorActionPreference = "Continue"

$od = $env:OneDrive
if (-not $od) { $od = Join-Path $env:USERPROFILE "OneDrive" }
$cfKeep = Join-Path $od "Desktop\New folder\CF"

function SizeGB([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) { return 0 }
  $out = robocopy $p NULL /L /S /NJH /NFL /NDL /NC /NS /NP /BYTES /R:0 /W:0 2>&1 | Out-String
  $m = [regex]::Match($out, "Bytes\s*:\s*([0-9,]+)")
  if ($m.Success) {
    return [math]::Round(([int64]$m.Groups[1].Value.Replace(",", "")) / 1GB, 2)
  }
  return 0
}

$attrib = Join-Path $env:SystemRoot "System32\attrib.exe"

# Ensure CF stays pinned before dehydrating the rest
Write-Host "Re-confirm pin on CF: $cfKeep"
& $attrib "+P" "-U" "$cfKeep" | Out-Null
& $attrib "+P" "-U" "$cfKeep\*" "/S" "/D" | Out-Null

$freeBefore = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$sizeBefore = SizeGB $od
$cfBefore = SizeGB $cfKeep
Write-Host "OneDrive before: ${sizeBefore}GB | CF before: ${cfBefore}GB | Free: ${freeBefore}GB"

$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace($od)
if ($null -eq $folder) {
  Write-Host "Could not open OneDrive shell namespace"
  exit 1
}

$invoked = $false
foreach ($verb in $folder.Self.Verbs()) {
  $name = ($verb.Name -replace "&", "")
  Write-Host ("verb: {0}" -f $name)
  if ($name -match "(?i)free up space") {
    Write-Host "Invoking: $name"
    $verb.DoIt()
    $invoked = $true
    break
  }
}

if (-not $invoked) {
  Write-Host "Root Free up space verb not found. Trying top-level children except Desktop..."
  $desktop = Join-Path $od "Desktop"
  Get-ChildItem -LiteralPath $od -Force | Where-Object {
    $_.PSIsContainer -and ($_.FullName -ne $desktop)
  } | ForEach-Object {
    $ns = $shell.NameSpace($_.FullName)
    if ($null -eq $ns) { return }
    foreach ($verb in $ns.Self.Verbs()) {
      $name = ($verb.Name -replace "&", "")
      if ($name -match "(?i)free up space") {
        Write-Host ("Free up space: {0}" -f $_.FullName)
        $verb.DoIt()
        break
      }
    }
  }
  # Desktop: free space on siblings of "New folder", and inside New folder except CF
  $newFolder = Join-Path $desktop "New folder"
  if (Test-Path -LiteralPath $desktop) {
    Get-ChildItem -LiteralPath $desktop -Force | Where-Object {
      $_.Name -ne "New folder"
    } | ForEach-Object {
      $ns = $shell.NameSpace($_.FullName)
      if ($null -eq $ns) { return }
      foreach ($verb in $ns.Self.Verbs()) {
        $name = ($verb.Name -replace "&", "")
        if ($name -match "(?i)free up space") {
          Write-Host ("Free up space: {0}" -f $_.FullName)
          $verb.DoIt()
          break
        }
      }
    }
  }
  if (Test-Path -LiteralPath $newFolder) {
    Get-ChildItem -LiteralPath $newFolder -Force | Where-Object {
      $_.Name -ne "CF"
    } | ForEach-Object {
      $ns = $shell.NameSpace($_.FullName)
      if ($null -eq $ns) { return }
      foreach ($verb in $ns.Self.Verbs()) {
        $name = ($verb.Name -replace "&", "")
        if ($name -match "(?i)free up space") {
          Write-Host ("Free up space: {0}" -f $_.FullName)
          $verb.DoIt()
          break
        }
      }
    }
  }
}

Write-Host "Waiting for OneDrive to dehydrate..."
Start-Sleep -Seconds 20

# Re-pin CF again in case a parent free-up touched it
& $attrib "+P" "-U" "$cfKeep" | Out-Null
& $attrib "+P" "-U" "$cfKeep\*" "/S" "/D" | Out-Null

$sizeAfter = SizeGB $od
$cfAfter = SizeGB $cfKeep
$freeAfter = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
Write-Host ""
Write-Host "OneDrive after: ${sizeAfter}GB (was ${sizeBefore}GB)"
Write-Host "CF after: ${cfAfter}GB (was ${cfBefore}GB) - exception kept local"
Write-Host "C: free after: ${freeAfter}GB (delta +$([math]::Round($freeAfter - $freeBefore, 2))GB)"
Write-Host "Nothing deleted from cloud."
