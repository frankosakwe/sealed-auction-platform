@echo off
echo Starting Private-Input Sealed-Bid Auction System...
echo.

echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please run setup.bat first.
    pause
    exit /b 1
)

echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

node server.js
