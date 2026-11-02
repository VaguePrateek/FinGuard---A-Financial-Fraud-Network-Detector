# FinGuard - start backend and frontend in separate terminals.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting FinGuard backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\backend'; python -m uvicorn app.main:app --reload --port 8000"
)

Write-Host "Starting FinGuard frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\frontend'; npm run dev"
)

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host "FinGuard is starting. API docs: http://localhost:8000/docs" -ForegroundColor Green
