@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Instalando el reconocimiento facial de EcoRewards ===
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% --version || (echo. & echo No se encontro Python. Instala Python 3.11 o 3.12 desde python.org y marca "Add Python to PATH". & pause & exit /b 1)
if not exist venv %PY% -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo Fallo la instalacion. & pause & exit /b 1)
python download_models.py || (echo Fallo la descarga de modelos. & pause & exit /b 1)
if not exist .env copy .env.example .env >nul
echo.
echo Listo. Ahora abre el archivo .env con el Bloc de notas y pega la llave SUPABASE_SERVICE_ROLE_KEY.
pause
