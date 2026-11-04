@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
set "SIN_CONEXION=1"
echo Modo sin conexion: solo reconocimiento.  Q o ESC = salir
python first_contact.py reconocer
pause
