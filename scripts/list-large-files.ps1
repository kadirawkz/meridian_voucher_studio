# Lists files in the git index larger than a specified size (default 5MB)
# Usage: run from repo root in PowerShell

param(
    [int]$minSizeMB = 5
)

Write-Host "Listing files in git index larger than $minSizeMB MB..."

# Ensure we're in a git repo
if (-not (Test-Path .git)) {
    Write-Host "Not a git repository (missing .git directory)." -ForegroundColor Red
    exit 1
}

# Use git rev-list and git ls-tree to find files in HEAD
$sizeThreshold = $minSizeMB * 1024 * 1024
$objects = git rev-list --objects --all | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize) %(rest)'

# Fallback if git cat-file --batch-check isn't supported in this environment
if ($LASTEXITCODE -ne 0) {
    Write-Host "Unable to inspect git object sizes. Ensure git is available." -ForegroundColor Red
    exit 1
}

$lines = $objects -split "`n"

foreach ($line in $lines) {
    if (-not $line) { continue }
    $parts = $line -split ' ', 4
    $size = [int64]$parts[2]
    $path = $parts[3]
    if ($size -gt $sizeThreshold) {
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "$sizeMB MB - $path"
    }
}

Write-Host "Done. Consider using BFG or git filter-repo to remove large files from history." -ForegroundColor Green
