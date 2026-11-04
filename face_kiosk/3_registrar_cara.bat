@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
:otra
echo.
set "USUARIO="
set /p "USUARIO=Correo o numero de cuenta de la persona (Enter para salir): "
if "%USUARIO%"=="" exit /b 0
python enroll.py "%USUARIO%"
goto otra
