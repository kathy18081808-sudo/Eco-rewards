@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo T = terminar sesion,  Q o ESC = salir
python first_contact.py reconocer
pause
