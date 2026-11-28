# Eco-Rewards · Clasificación de botella y lata

La cámara que antes era la ESP32-CAM ahora va a la computadora. Este programa
mira esa cámara, decide si el objeto es una botella o una lata, y le manda
`DETECT:bottle` o `DETECT:can` al ESP32 normal por WiFi. El ESP32 mueve el
servo y suma los puntos, igual que antes.

El reconocimiento facial no cambia. Sigue en `face_terminal/first_contact.py`:
abre la sesión en Supabase y el ESP32 la toma con `poll-session`. Este script
no abre sesiones y no habla con Supabase. Si no hay una sesión activa, el
ESP32 contesta `IGNORADO` y no mueve el servo.

```
Webcam de clasificación ──► clasificar.py (YOLO11n-cls, ONNX)
                                  │
                                  │  TCP 8090  DETECT:bottle / DETECT:can
                                  ▼
Cámara del rostro ──► first_contact.py ──abre sesión──► Supabase ◄──poll-session── ESP32
                                                                                      │
                                                                                      └── servo y puntos
```

## Por qué no Ollama

Ollama ya está en la máquina, pero un modelo de visión de lenguaje (Moondream,
LLaVA, Qwen-VL) tarda de medio segundo a varios segundos por foto y ocupa
varios GB de RAM. El rostro ya carga InsightFace `buffalo_l`. En 16 GB, los
dos a la vez dejan pasar la lata antes de clasificarla.

Este script usa un clasificador chico, YOLO11n-cls exportado a ONNX (unos
3–6 MB): OpenCV + ONNX Runtime, sin PyTorch mientras corre en vivo. Hace como
máximo 8 inferencias por segundo, a 224 px y con 2 hilos, para dejar CPU y
GPU al reconocimiento facial.

La RTX 4060 está en la máquina. Si el driver NVIDIA no responde, ONNX Runtime
sigue en CPU: en el Ryzen 7 alcanza para clasificar. Cuando el driver funcione,
el script usa CUDA solo.

## 1. Firmware del ESP32

Hay que volver a grabar `esp32/vision_controller/vision_controller.ino`. Al
arrancar, el LCD y el monitor serial muestran la IP y el puerto `8090`.
Anota esa IP.

La orden es la misma de siempre. El UART del pin 32 sigue aceptándola; el
camino normal ahora es WiFi. El detalle está en `esp32/uart_protocol.md`.

## 2. Instalar el programa que corre en vivo

En la carpeta `vision`:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

En `.env`, `CAMARA_CLASIFICACION` tiene que ser otra cámara que la de
`face_terminal` (`CAMARA`). `ESP32_HOST` es la IP del controlador.

Si `pip` no encuentra `onnxruntime` para el Python del sistema, crea el
entorno con Python 3.12.

## 3. Probar el servo sin modelo

Con una sesión abierta (rostro, QR o número en el teclado):

```bash
python clasificar.py --probar bottle
python clasificar.py --probar can
```

`OK` significa que el ESP32 va a mover el servo (botella a 0°, lata a 180°,
regreso al centro). `IGNORADO` significa que no hay sesión o que todavía está
ocupado con otro objeto. Si no hay respuesta, revisa que la computadora y el
ESP32 estén en la misma red.

## 4. Conseguir las detecciones

No hay un modelo incluido: el anterior vivía dentro de la ESP32-CAM. Hay que
entrenarlo con fotos de esta cámara, con un objeto a la vez y ocupando buena
parte del encuadre.

1. Monta la cámara mirando el hueco donde cae el objeto.
2. `python capturar.py`. Teclas: `b` botella, `c` lata, `v` vacío, `q` salir.
   Apunta a unas **200 fotos por clase**: PET y vidrio como botella, lata
   normal y aplastada, luz distinta y el objeto un poco movido. El vacío es
   el hueco sin nada, para no disparar el servo con el fondo.
3. Aparta a mano unas **40 fotos de cada clase** de `dataset/train/<clase>/`
   a `dataset/val/<clase>/`.
4. Sal del entorno de `vision` con `deactivate` y, desde la raíz del
   repositorio, entrena en **otro** entorno. PyTorch no debe quedar cargado
   junto al rostro:

```bash
python3 -m venv .venv-entrenar
source .venv-entrenar/bin/activate
pip install ultralytics
yolo classify train data=vision/dataset model=yolo11n-cls.pt epochs=50 imgsz=224
yolo export model=runs/classify/train/weights/best.pt format=onnx imgsz=224
mkdir -p vision/models
cp runs/classify/train/weights/best.onnx vision/models/reciclaje.onnx
```

La primera vez, Ultralytics descarga `yolo11n-cls.pt`. Si la carpeta del
entrenamiento no se llama `train`, usa la ruta que imprima el comando.

5. Vuelve al entorno de `vision` y corre:

```bash
python clasificar.py
```

La ventana muestra la clase, la confianza y si el ESP32 contestó. Solo manda
la orden cuando la misma clase (`bottle` o `can`) sale en **3 cuadros**
seguidos con confianza de al menos **0.70**, y espera **4 segundos** entre
una orden y la siguiente. `empty` no se envía. `q` o ESC cierran la ventana.

Si el ONNX no trae los nombres, pon en `.env` el orden del entrenamiento:

```text
CLASES=bottle,can,empty
```

## 5. Correrlo junto al rostro

Dos terminales:

```bash
# terminal 1
cd face_terminal && source venv/bin/activate && python first_contact.py reconocer

# terminal 2
cd vision && source venv/bin/activate && python clasificar.py
```

Cada uno con su cámara. La persona se identifica, deposita el objeto, este
programa avisa al ESP32 y el panel de la sesión suma los puntos.
