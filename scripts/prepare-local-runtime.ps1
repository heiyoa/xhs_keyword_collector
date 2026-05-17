param(
  [string]$SourceRoot = "\\100.86.229.25\lobster-share\browser_modules",
  [string]$LocalRuntimeRoot = "C:\browser_modules_runtime"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $SourceRoot)) {
  throw "Source root not found: $SourceRoot"
}

New-Item -ItemType Directory -Force -Path $LocalRuntimeRoot | Out-Null

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
  "secrets",
  "node_modules"
)

foreach ($item in $items) {
  $source = Join-Path $SourceRoot $item
  $target = Join-Path $LocalRuntimeRoot $item

  if (!(Test-Path $source)) {
    continue
  }

  if ((Get-Item $source).PSIsContainer) {
    robocopy $source $target /MIR /MT:16 /R:2 /W:2 | Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "robocopy failed for $item with exit code $LASTEXITCODE"
    }
  } else {
    Copy-Item -LiteralPath $source -Destination $target -Force
  }
}

Write-Host "Prepared local runtime at $LocalRuntimeRoot"
