# Fix GitHub CLI token issue
Write-Host "Removing GITHUB_TOKEN from User environment variables..."
[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', $null, 'User')

$token = [Environment]::GetEnvironmentVariable('GITHUB_TOKEN', 'User')
if ($null -eq $token) {
    Write-Host "SUCCESS: GITHUB_TOKEN removed from User scope"
} else {
    Write-Host "ERROR: Failed to remove GITHUB_TOKEN"
    exit 1
}

Write-Host ""
Write-Host "IMPORTANT: Restart VS Code for changes to take effect"
Write-Host "After restart: gh auth status should show keyring account as active"
