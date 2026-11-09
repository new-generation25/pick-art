# 정기 수집 1회 실행 (Windows 작업 스케줄러 "pick-art 정기 수집"이 매일 08:20·15:00에 부른다)
# 로그: collector\logs\scheduled_YYYYMMDD_HHmm.log
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("scheduled_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmm"))
$env:PYTHONUNBUFFERED = "1"
$env:PYTHONIOENCODING = "utf-8"
# 파이썬 출력(UTF-8)을 PowerShell 5.1이 cp949로 읽어 로그 한글이 깨지지 않게 한다
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
& python -u main.py --once *>&1 | Out-File -FilePath $log -Encoding utf8
exit $LASTEXITCODE
