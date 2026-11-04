@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
set "CUENTA="
set /p "CUENTA=Numero de cuenta o correo de la persona: "
if "%CUENTA%"=="" exit /b 0
python first_contact.py registrar "%CUENTA%"
pause
