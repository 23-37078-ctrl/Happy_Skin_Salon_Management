param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing backend/.env. Copy .env.example and configure DATABASE_URL first."
}

$databaseUrl = (Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', ''
if (-not $databaseUrl -or $databaseUrl -match '<.*>') {
    throw "DATABASE_URL is not configured in backend/.env."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    throw "pg_dump was not found. Install PostgreSQL command-line tools and add them to PATH."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDirectory "happy-skin-$timestamp.backup"

& $pgDump.Source --format=custom --file=$backupFile --dbname=$databaseUrl
if ($LASTEXITCODE -ne 0) {
    throw "Database backup failed."
}

Write-Host "Backup created: $backupFile"
