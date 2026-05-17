param(
  [string]$TargetRoot = "\\100.86.229.25\lobster-share\browser_modules",
  [switch]$SkipNodeModules
)

$ErrorActionPreference = "Stop"

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TargetRoot = $TargetRoot.TrimEnd("\")

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

$items = @(
  "package.json",
  "package-lock.json",
  ".env",
  ".env.example",
  "config",
  "docs",
  "src",
  "scripts",
  "data",
  "artifacts",
  "secrets"
)

foreach ($item in $items) {
  $source = Join-Path $SourceRoot $item
  $target = Join-Path $TargetRoot $item

  if (!(Test-Path $source)) {
    continue
  }

  if ((Get-Item $source).PSIsContainer) {
    robocopy $source $target /MIR /MT:16 /R:2 /W:2 /XD node_modules runtime | Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "robocopy failed for $item with exit code $LASTEXITCODE"
    }
  } else {
    Copy-Item -LiteralPath $source -Destination $target -Force
  }
}

foreach ($dir in @("data", "runtime\logs", "runtime\locks", "runtime\temp", "artifacts\profile-archives", "artifacts\run-evidence")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot $dir) | Out-Null
}

if (-not $SkipNodeModules) {
  $sourceNodeModules = Join-Path $SourceRoot "node_modules"
  $targetNodeModules = Join-Path $TargetRoot "node_modules"
  if (Test-Path $sourceNodeModules) {
    robocopy $sourceNodeModules $targetNodeModules /MIR /MT:16 /R:2 /W:2 | Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "robocopy failed for node_modules with exit code $LASTEXITCODE"
    }
  } else {
    Write-Host "node_modules not found locally. Run npm install before full sync."
  }
}

Write-Host "Synced browser modules to $TargetRoot"
