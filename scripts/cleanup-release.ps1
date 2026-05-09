# Cleanup script for preparing the repo for public release
# Usage: run from repository root in PowerShell (run as a user with appropriate permissions)

$targets = @(
    'release',
    'dist-electron',
    'build-resources',
    'dist',
    'out',
    'release/win-unpacked'
)

Write-Host "This script will permanently remove build/release artifacts from the working copy." -ForegroundColor Yellow
Write-Host "Targets to remove:`n  $($targets -join "`n  ")`n" -ForegroundColor Cyan

$confirm = Read-Host "Type DELETE to remove the listed targets from disk (or press Enter to cancel)"
if ($confirm -ne 'DELETE') {
    Write-Host "Cancelled by user. No files removed." -ForegroundColor Green
    exit 0
}

foreach ($t in $targets) {
    $path = Join-Path -Path (Get-Location) -ChildPath $t
    if (Test-Path $path) {
        Write-Host "Removing: $path" -ForegroundColor Yellow
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Not found: $path" -ForegroundColor DarkGray
    }
}

Write-Host "Cleanup complete." -ForegroundColor Green
Write-Host "If you want to remove these files from git history as well, run the suggested commands in the repository root (manual step):" -ForegroundColor Cyan
Write-Host "  git rm -r --cached release dist-electron build-resources dist out" -ForegroundColor White
Write-Host "  git commit -m 'Remove build artifacts'" -ForegroundColor White
Write-Host "To purge large files from history use the BFG Repo-Cleaner or git filter-repo. See README checklist." -ForegroundColor White
