# Start Crypto Exchange Backend Server
$ErrorActionPreference = "Stop"

Write-Host "Starting Crypto Exchange Backend..." -ForegroundColor Cyan

# Kill any existing node processes on port 3001
$portProcess = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($portProcess) {
    $pid = $portProcess.OwningProcess
    Write-Host "WARNING: Killing existing process on port 3001 (PID: $pid)" -ForegroundColor Yellow
    Stop-Process -Id $pid -Force
    Start-Sleep -Seconds 2
}

# Start server in detached process
$job = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "SUCCESS: Server started in new window (PID: $($job.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "Server Information:" -ForegroundColor Cyan
Write-Host "   - API URL: http://localhost:3001" -ForegroundColor White
Write-Host "   - Health: http://localhost:3001/health" -ForegroundColor White
Write-Host "   - Version: http://localhost:3001/api/version" -ForegroundColor White
Write-Host ""
Write-Host "To stop the server, close the new window or run:" -ForegroundColor Yellow
Write-Host "   Stop-Process -Id $($job.Id)" -ForegroundColor Gray
Write-Host ""

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

# Test server
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    Write-Host "SUCCESS: Server is running!" -ForegroundColor Green
    Write-Host "   Status: $($data.data.status)" -ForegroundColor White
    Write-Host "   Uptime: $([Math]::Round($data.data.uptime, 2))s" -ForegroundColor White
} catch {
    Write-Host "WARNING: Server may still be starting... Check the new window for logs." -ForegroundColor Yellow
}
