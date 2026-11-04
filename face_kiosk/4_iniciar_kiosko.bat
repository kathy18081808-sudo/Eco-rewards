@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo Abre en la tablet la direccion http://... que aparece abajo (misma red WiFi).
echo Para detener el kiosko, cierra esta ventana.
python kiosk.py
pause
