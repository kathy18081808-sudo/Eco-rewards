@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Instalando el reconocimiento facial (InsightFace) de Eco-Rewards ===
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% --version || (echo. & echo No se encontro Python. Instala Python 3.11 desde python.org y marca "Add Python to PATH". & pause & exit /b 1)
if not exist venv %PY% -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip wheel
pip install onnxruntime || (echo Fallo onnxruntime. & pause & exit /b 1)
pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo ================================================================
  echo  No se pudo instalar insightface: Windows necesita compilarlo.
  echo  1. Descarga "Build Tools for Visual Studio" de visualstudio.microsoft.com/visual-cpp-build-tools
  echo  2. En el instalador marca "Desarrollo para el escritorio con C++" e instala
  echo  3. Reinicia la PC y vuelve a abrir 1_instalar.bat
  echo ================================================================
  pause & exit /b 1
)
if not exist .env copy .env.example .env >nul
echo.
echo Listo. Abre el archivo .env con el Bloc de notas y pega SUPABASE_SERVICE_ROLE_KEY.
echo (Si solo quieres probar el reconocimiento sin internet, usa 3_reconocer_sin_conexion.bat)
pause
