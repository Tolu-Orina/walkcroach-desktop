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

function RankChildren([string]$parent, [int]$top = 20) {
  Write-Host ""
  Write-Host "=== $parent ==="
  $rows = @()
  Get-ChildItem -Force -LiteralPath $parent -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.PSIsContainer) {
      $gb = FolderSizeGB $_.FullName
      if ($null -ne $gb -and $gb -gt 0.05) {
        $rows += [PSCustomObject]@{ GB = $gb; Path = $_.Name }
      }
    } else {
      $gb = [math]::Round($_.Length / 1GB, 2)
      if ($gb -gt 0.05) {
        $rows += [PSCustomObject]@{ GB = $gb; Path = $_.Name }
      }
    }
  }
  $rows | Sort-Object GB -Descending | Select-Object -First $top | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
}

$u = $env:USERPROFILE
RankChildren $u
RankChildren "$u\AppData\Local"
RankChildren "$u\AppData\Local\Google"
RankChildren "$u\AppData\Roaming"
RankChildren "$u\dev"
RankChildren "$u\AppData\Local\Temp"
RankChildren "$u\.cursor"
