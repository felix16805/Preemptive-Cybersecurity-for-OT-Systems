$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Engine = Join-Path $ProjectRoot "python-engine"
$VenvPython = Join-Path $Engine ".venv\Scripts\python.exe"
$Dataset = Join-Path $Engine "datasets\synthetic_ot\ot_cybersecurity_synthetic_15000.csv"

Write-Host "SafeCut ML: synthetic OT cybersecurity coursework experiment" -ForegroundColor Cyan
Write-Host "NOTICE: This is generated synthetic data, not real industrial telemetry." -ForegroundColor Yellow
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
    Write-Host "Generating 15,000 synthetic OT cybersecurity rows..."
    & $VenvPython -m ml.generate_synthetic_ot --rows 15000
    if ($LASTEXITCODE -ne 0) { throw "Synthetic dataset generation failed." }
}

Write-Host "Training and evaluating five ML models..." -ForegroundColor Cyan
& $VenvPython -m ml.train --dataset synthetic_ot --data $Dataset --target-col label --max-rows 0
if ($LASTEXITCODE -ne 0) { throw "Training/evaluation failed. See the error above." }

Write-Host "Training completed. Start the Next.js app from the project root with: npm ci; npm run dev" -ForegroundColor Green
Write-Host "Open http://localhost:3000/ml-lab to view the measured synthetic-data results."
Write-Host "IMPORTANT: Do not report these synthetic scores as real-world validation." -ForegroundColor Yellow
