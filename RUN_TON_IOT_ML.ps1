$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Engine = Join-Path $ProjectRoot "python-engine"
$VenvPython = Join-Path $Engine ".venv\Scripts\python.exe"
$Dataset = Join-Path $Engine "datasets\ton_iot\train_test_network.csv"
$MaxRows = if ($env:SAFECUT_MAX_ROWS) { $env:SAFECUT_MAX_ROWS } else { "200000" }

Write-Host "SafeCut ML training: TON_IoT network benchmark" -ForegroundColor Cyan
Set-Location $Engine

if (-not (Test-Path (Join-Path $Engine ".venv"))) {
    Write-Host "Creating Python virtual environment..."
    py -m venv .venv
}
if (-not (Test-Path $VenvPython)) {
    throw "Virtual environment Python not found. Install Python 3 and rerun this script."
}

Write-Host "Installing Python dependencies..."
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed." }
& $VenvPython -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed." }

if (-not (Test-Path $Dataset)) {
    Write-Host "Downloading TON_IoT network dataset..."
    & $VenvPython -m ml.download_ton_iot
    if ($LASTEXITCODE -ne 0) {
        throw "Dataset download failed. Check the network and consult python-engine/ml/README.md for the official source/manual download steps."
    }
}

Write-Host "Training/evaluating five models (max rows: $MaxRows)..." -ForegroundColor Cyan
& $VenvPython -m ml.train --dataset ton_iot --data $Dataset --target-col label --max-rows $MaxRows
if ($LASTEXITCODE -ne 0) { throw "Training/evaluation failed. See the error above." }

Write-Host "Completed. Start the Next.js app from project root with: npm ci; npm run dev" -ForegroundColor Green
Write-Host "Open http://localhost:3000/ml-lab to view the measured results."
