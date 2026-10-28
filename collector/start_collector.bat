@echo off
echo ================================================================================
echo Starting Collector Service with Real-time Logging
echo ================================================================================
echo.

REM Kill existing Python processes running collector
echo Checking for existing collector processes...
taskkill /F /FI "WINDOWTITLE eq Collector*" 2>nul

REM Start collector with unbuffered output (-u flag)
echo Starting collector in unbuffered mode...
echo.

REM Set PYTHONUNBUFFERED environment variable for real-time output
set PYTHONUNBUFFERED=1

REM Start Python with -u flag for unbuffered output
python -u main.py

pause
