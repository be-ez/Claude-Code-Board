@echo off
chcp 65001 >nul

echo ========================================
echo   Claude Code Board
echo ========================================
echo.

REM Disable third-party trackers/analytics before starting (no-op if sh is unavailable)
sh "%~dp0scripts/no-tracking.sh" apply 2>nul

wt -w 0 nt -d "%~dp0backend" --title "後端" cmd /k "chcp 65001 >nul && npm run dev" ; ^
   new-tab -d "%~dp0frontend" --title "前端" cmd /k "chcp 65001 >nul && npm run dev"
  @REM  new-tab -d "C:\Users\User" --title "ngrok" cmd /k "chcp 65001 >nul && ngrok http 5173" ; ^
  @REM  new-tab -d "C:\Users\User" --title "nginx" cmd /k "chcp 65001 >nul && nginx.bat"

echo.
echo 所有服務已在 Windows Terminal 中啟動！
echo.
timeout /t 3
exit