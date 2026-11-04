# Eco-Rewards · Reconocimiento facial en la NVIDIA Jetson

Programa de terminal (`first_contact.py`) que reconoce a las personas con una webcam USB
usando **InsightFace (modelo `buffalo_l`)** en la GPU de la Jetson, y abre su sesión de
reciclaje en la máquina Eco-Rewards.

```
Webcam USB ──► Jetson (first_contact.py, InsightFace en GPU)
                 │   faces_db.json  (caras registradas, local)
                 │
                 └──abre sesión──► Supabase ◄──poll-session── ESP32 (servo + sensores)
                                      ▲
                     app web (eco-rewards-web.vercel.app): cuentas, puntos, ranking
```

- Las caras se guardan **en la Jetson**, en el documento `faces_db.json`
  (un vector de 512 números por persona, nunca fotos).
- Cuando reconoce a alguien, crea una sesión `source = 'face'` en Supabase.
  La ESP32 la toma igual que cuando se escanea el QR, y cada botella o lata
  suma puntos en la **cuenta de la app web** de esa persona.
- Con `SIN_CONEXION=1` funciona solo como demostración de reconocimiento, sin internet.

---

## 1. Requisitos

| | |
|---|---|
| Placa | NVIDIA Jetson (Orin Nano / Orin NX / AGX Orin) |
| Sistema | **JetPack 6** (Ubuntu 22.04, **Python 3.10**) |
| Cámara | Webcam USB |
| Internet | Para instalar, descargar el modelo la primera vez y abrir sesiones |

Comprueba la versión:

```bash
cat /etc/nv_tegra_release      # versión de L4T / JetPack
python3 --version              # debe ser 3.10.x
v4l2-ctl --list-devices        # lista las cámaras (si falta: sudo apt install v4l-utils)
```

## 2. Máximo rendimiento (recomendado para la demo)

```bash
sudo nvpmodel -m 0     # modo de máxima potencia
sudo jetson_clocks     # fija los relojes al máximo
```

## 3. Instalación

```bash
sudo apt update
sudo apt install -y python3-venv python3-dev python3-pip build-essential cmake v4l-utils

cd face_terminal
python3 -m venv venv
source venv/bin/activate
pip install -U pip wheel

# ONNX Runtime con GPU para Jetson (JetPack 6, CUDA 12.6, Python 3.10)
pip install onnxruntime-gpu --index-url https://pypi.jetson-ai-lab.io/jp6/cu126

# Resto de dependencias (insightface se compila: tarda 5–10 minutos en la Jetson)
pip install -r requirements.txt
```

Verifica que ONNX Runtime ve la GPU:

```bash
python -c "import onnxruntime as ort; print(ort.get_available_providers())"
```

Debe aparecer `CUDAExecutionProvider`. Si solo aparece `CPUExecutionProvider`, el programa
**igual funciona**, pero más lento: usa `DET_SIZE=320` en el `.env`.

> **¿JetPack 5?** El índice de arriba es para JetPack 6. Para JetPack 5 (Python 3.8)
> descarga el wheel de `onnxruntime-gpu` desde el *Jetson Zoo* de NVIDIA (elinux.org/Jetson_Zoo).

## 4. Configuración

```bash
cp .env.example .env
nano .env
```

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API Keys → **service_role / secret**.
  Es secreta: solo va en la Jetson, nunca en GitHub ni en la app.
- `MACHINE_CODE`: el mismo de la ESP32 (`ECO-48FM6V`).
- `CAMARA`: el número de la webcam. Si `v4l2-ctl --list-devices` la muestra como `/dev/video2`,
  pon `CAMARA=2`, o la ruta fija `/dev/v4l/by-id/usb-...-video-index0` (no cambia al reiniciar).

La primera vez que corra, InsightFace descarga el modelo `buffalo_l` (~280 MB) a `~/.insightface/`.

## 5. Uso

```bash
source venv/bin/activate

# Registrar (la persona ya debe tener cuenta en la app web)
python first_contact.py registrar 100001              # número de cuenta
python first_contact.py registrar correo@gmail.com    # o correo
#   → ESPACIO = capturar (5 veces, moviendo un poco la cabeza), ESC = cancelar

# Ver y borrar personas registradas
python first_contact.py listar
python first_contact.py borrar 100001

# Reconocer en vivo y abrir sesiones en la máquina
python first_contact.py reconocer
#   → T = terminar la sesión,  Q / ESC = salir

# Demostración sin internet (solo reconocimiento)
SIN_CONEXION=1 python first_contact.py reconocer
```

En la ventana de **reconocer** se ve:

- Recuadro **verde** con el nombre y la similitud (ej. `Andreina (0.72)`) si la reconoce;
  **rojo** `desconocido` si no.
- Abajo, el panel de la máquina: `Hola, Andreina!`, puntos, artículos depositados
  y segundos restantes de la sesión.
- Los **FPS** arriba a la izquierda (con GPU, 15–30 FPS según el modelo de Jetson).

Para evitar errores, la sesión se abre solo después de reconocer a la misma persona en
**3 cuadros seguidos**, y no se vuelve a abrir para ella hasta 10 segundos después de cerrar.

## 6. El documento `faces_db.json`

```json
{
  "modelo": "insightface/buffalo_l",
  "umbral": 0.45,
  "actualizado": "2026-11-05T10:20:31",
  "personas": {
    "100001": {
      "cuenta": "100001",
      "nombre": "Andreina",
      "email": "correo@gmail.com",
      "profile_id": "uuid de la cuenta en Supabase",
      "registrado": "2026-11-05T10:18:02",
      "muestras": 5,
      "embedding": [0.0166, 0.0395, ... 512 números ...]
    }
  }
}
```

- `embedding`: promedio normalizado de las 5 muestras. Se compara con **similitud coseno**
  (1 = idéntico, 0 = nada parecido). Se acepta si es mayor o igual a `UMBRAL`.
- Si existe el `faces_db.pkl` de las pruebas anteriores, se convierte solo a JSON al primer uso.
- Las personas registradas con `SIN_CONEXION=1` se vinculan a su cuenta automáticamente
  la primera vez que se las reconoce con internet.
- `faces_db.json` tiene datos biométricos: está en `.gitignore` y no se sube a GitHub.

## 7. Guion sugerido para la demo

1. `python first_contact.py listar` → mostrar quién está registrado.
2. `cat faces_db.json` (o abrirlo) → explicar que se guarda un vector, no una foto.
3. `python first_contact.py reconocer` → una persona registrada se acerca: recuadro verde y "Hola".
4. Deposita una lata → el panel suma +10 pts y la app web del celular muestra los mismos puntos.
5. Una persona **no** registrada → recuadro rojo `desconocido`.
6. Explicar el código: `cargar_modelo()` (GPU), `mejor_match()` (similitud coseno), `Sesion` (conexión con la máquina).

## 8. Problemas comunes

| Problema | Solución |
|---|---|
| `No pude abrir la cámara` | `v4l2-ctl --list-devices` y ajustar `CAMARA` |
| Solo `CPUExecutionProvider` | Reinstalar `onnxruntime-gpu` desde el índice de Jetson; mientras, `DET_SIZE=320` |
| Muy lento / pocos FPS | `sudo nvpmodel -m 0 && sudo jetson_clocks`, y `DET_SIZE=320` |
| Confunde a dos personas | Subir `UMBRAL` a 0.5–0.55 y volver a registrar con buena luz |
| No reconoce a alguien registrado | Bajar `UMBRAL` a 0.40 o registrar de nuevo frente a la cámara de la máquina |
| `No existe una cuenta Eco-Rewards` | La persona debe registrarse primero en eco-rewards-web.vercel.app |
| La máquina no reacciona | Revisar que la ESP32 tenga el mismo `MACHINE_CODE` y esté conectada a internet |
