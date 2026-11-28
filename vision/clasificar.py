"""Clasifica botella o lata con un modelo ONNX local y avisa al ESP32 por WiFi.

El reconocimiento facial (face_terminal/first_contact.py) no se toca: ese
programa abre la sesión y el ESP32 la toma con poll-session. Este script solo
manda DETECT:bottle o DETECT:can al puerto TCP 8090 cuando la misma clase se
sostiene 3 cuadros. El controlador mueve el servo y suma los puntos.

Hasta tener el modelo entrenado:

  python clasificar.py --probar bottle
  python clasificar.py --probar can

Con el modelo en vision/models/reciclaje.onnx:

  python clasificar.py

Opciones (vision/.env):
  CAMARA_CLASIFICACION   número de cámara o ruta /dev/v4l/by-id/...
  ESP32_HOST             IP que el ESP32 muestra al arrancar
  ESP32_PORT             8090
  MODELO                 models/reciclaje.onnx
  UMBRAL                 0.70
  CLASES                 bottle,can,empty  (solo si el ONNX no trae los nombres)
"""

import argparse
import ast
import os
import socket
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:
    pass

BASE = Path(__file__).parent
MODELO = Path(os.environ.get("MODELO", "models/reciclaje.onnx"))
if not MODELO.is_absolute():
    MODELO = BASE / MODELO
UMBRAL = float(os.environ.get("UMBRAL", "0.70"))
ESP32_HOST = os.environ.get("ESP32_HOST", "").strip()
ESP32_PORT = int(os.environ.get("ESP32_PORT", "8090"))
CUADROS_SEGUIDOS = 3
ESPERA_ENTRE_ORDENES = 4.0
INTERVALO_INFERENCIA = 0.125  # 8 veces por segundo, para dejar CPU al rostro
CLASES_SERVO = ("bottle", "can")
ETIQUETAS = {"bottle": "Botella", "can": "Lata", "empty": "Vacio"}


def abrir_camara():
    fuente = os.environ.get("CAMARA_CLASIFICACION", "0")
    fuente = int(fuente) if fuente.isdigit() else fuente
    if sys.platform.startswith("win") and isinstance(fuente, int):
        cap = cv2.VideoCapture(fuente, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(fuente)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        ayuda = "v4l2-ctl --list-devices" if sys.platform.startswith("linux") else "prueba con CAMARA_CLASIFICACION=1"
        sys.exit(f"No pude abrir la cámara de clasificación. Revisa con: {ayuda}")
    return cap


def enviar(clase, timeout=8.0, intentos=3):
    """Manda DETECT:<clase> y devuelve OK, IGNORADO o el texto que conteste el ESP32.

    El hotspot del teléfono pierde muchos paquetes, así que un intento de 2 s
    se agota antes de que el ESP32 conteste. Se reintenta con más margen.
    """
    ultimo = None
    for intento in range(intentos):
        try:
            with socket.create_connection((ESP32_HOST, ESP32_PORT), timeout=timeout) as sock:
                sock.sendall(f"DETECT:{clase}\n".encode("ascii"))
                sock.settimeout(timeout)
                data = b""
                while b"\n" not in data:
                    chunk = sock.recv(128)
                    if not chunk:
                        break
                    data += chunk
            return data.decode("ascii", errors="replace").strip()
        except OSError as error:
            ultimo = error
            if intento + 1 < intentos:
                time.sleep(0.4)
    raise ultimo


def probar(clase):
    if not ESP32_HOST:
        sys.exit("Falta ESP32_HOST en vision/.env (la IP que muestra el ESP32 al arrancar).")
    try:
        respuesta = enviar(clase)
    except OSError as error:
        sys.exit(f"No pude hablar con el ESP32 en {ESP32_HOST}:{ESP32_PORT}: {error}")
    print(f"DETECT:{clase} -> {respuesta or 'sin respuesta'}")
    if respuesta == "IGNORADO":
        print("El ESP32 recibió la orden y no movió el servo: no hay sesión activa o está ocupado.")
    elif respuesta == "OK":
        print("El ESP32 aceptó la orden y va a mover el servo.")


def abrir_sesion(ruta):
    opciones = ort.SessionOptions()
    opciones.intra_op_num_threads = 2
    opciones.inter_op_num_threads = 1
    disponibles = ort.get_available_providers()
    preferidos = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in disponibles]
    print("Providers disponibles:", disponibles)
    try:
        sesion = ort.InferenceSession(str(ruta), sess_options=opciones, providers=preferidos or None)
    except Exception:
        if "CPUExecutionProvider" in preferidos and preferidos != ["CPUExecutionProvider"]:
            print("CUDA no arrancó, sigo en CPU.")
            sesion = ort.InferenceSession(str(ruta), sess_options=opciones, providers=["CPUExecutionProvider"])
        else:
            raise
    print("Procesando con:", sesion.get_providers()[0])
    return sesion


def dimension(valor, respaldo):
    if isinstance(valor, (int, np.integer)) and int(valor) > 0:
        return int(valor)
    return respaldo


def tamano_entrada(sesion):
    forma = sesion.get_inputs()[0].shape
    alto = dimension(forma[2], 224) if len(forma) > 2 else 224
    ancho = dimension(forma[3], 224) if len(forma) > 3 else 224
    return sesion.get_inputs()[0].name, alto, ancho


def misma_cantidad(lista, cantidad):
    return bool(lista) and (cantidad is None or len(lista) == cantidad)


def cargar_clases(sesion, cantidad):
    metadatos = sesion.get_modelmeta().custom_metadata_map or {}
    crudo = metadatos.get("names", "")
    if crudo:
        try:
            nombres = ast.literal_eval(crudo)
        except (SyntaxError, ValueError):
            nombres = None
        if isinstance(nombres, dict):
            try:
                orden = [str(nombres[clave]) for clave in sorted(nombres, key=lambda k: int(k))]
            except (TypeError, ValueError):
                orden = []
            if misma_cantidad(orden, cantidad):
                return orden
        elif isinstance(nombres, (list, tuple)):
            orden = [str(nombre) for nombre in nombres]
            if misma_cantidad(orden, cantidad):
                return orden

    entorno = os.environ.get("CLASES", "")
    if entorno:
        lista = [parte.strip() for parte in entorno.split(",") if parte.strip()]
        if misma_cantidad(lista, cantidad):
            return lista

    archivo = MODELO.with_suffix(".names")
    if archivo.is_file():
        lista = [linea.strip() for linea in archivo.read_text(encoding="utf-8").splitlines() if linea.strip()]
        if misma_cantidad(lista, cantidad):
            return lista

    sys.exit(
        "El modelo no trae los nombres de las clases. "
        "Pon CLASES=bottle,can,empty en vision/.env, en el mismo orden del entrenamiento."
    )


def a_probabilidades(salida):
    valores = np.asarray(salida, dtype=np.float32).reshape(-1)
    if valores.size == 0:
        sys.exit("El modelo no devolvió ninguna clase.")
    if float(valores.min()) < 0 or abs(float(valores.sum()) - 1.0) > 0.05:
        valores = valores - float(valores.max())
        expuestos = np.exp(valores)
        total = float(expuestos.sum())
        valores = expuestos / total if total else expuestos
    return valores


def inferir(sesion, entrada, frame, alto, ancho):
    rgb = cv2.cvtColor(cv2.resize(frame, (ancho, alto)), cv2.COLOR_BGR2RGB)
    tensor = np.transpose(rgb.astype(np.float32) / 255.0, (2, 0, 1))[None, ...]
    salida = sesion.run(None, {entrada: tensor})[0]
    return a_probabilidades(salida)


def mandar(clase):
    if not ESP32_HOST:
        return "Falta ESP32_HOST en .env"
    try:
        respuesta = enviar(clase)
    except OSError:
        return "ESP32 no responde"
    if respuesta == "OK":
        return f"Servo: {ETIQUETAS.get(clase, clase)}"
    if respuesta == "IGNORADO":
        return "IGNORADO (sin sesion o ocupado)"
    return respuesta or "Sin respuesta"


def dibujar(frame, clase, confianza, aviso, consecutivos):
    etiqueta = ETIQUETAS.get(clase, clase)
    texto = f"{etiqueta}  {confianza:.0%}  ({consecutivos}/{CUADROS_SEGUIDOS})"
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 72), (0, 0, 0), -1)
    cv2.putText(frame, texto, (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(frame, aviso, (16, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)


def bucle(sesion, clases):
    entrada, alto, ancho = tamano_entrada(sesion)
    cap = abrir_camara()
    ultima_inferencia = 0.0
    ultimo_envio = 0.0
    consecutivos = 0
    candidata = ""
    vista_clase = "empty"
    vista_confianza = 0.0
    aviso = "Esperando un objeto"

    while True:
        ok, frame = cap.read()
        if not ok:
            time.sleep(0.05)
            continue

        ahora = time.monotonic()
        if ahora - ultima_inferencia >= INTERVALO_INFERENCIA:
            ultima_inferencia = ahora
            probabilidades = inferir(sesion, entrada, frame, alto, ancho)
            if probabilidades.size != len(clases):
                cap.release()
                cv2.destroyAllWindows()
                sys.exit(
                    f"El modelo devolvió {probabilidades.size} clases y la lista tiene {len(clases)}. "
                    "Revisa CLASES en vision/.env."
                )
            indice = int(np.argmax(probabilidades))
            vista_clase = clases[indice]
            vista_confianza = float(probabilidades[indice])
            aceptada = vista_clase in CLASES_SERVO and vista_confianza >= UMBRAL
            if aceptada and vista_clase == candidata:
                consecutivos += 1
            elif aceptada:
                candidata = vista_clase
                consecutivos = 1
            else:
                candidata = ""
                consecutivos = 0

            if consecutivos >= CUADROS_SEGUIDOS and ahora - ultimo_envio >= ESPERA_ENTRE_ORDENES:
                aviso = mandar(candidata)
                ultimo_envio = time.monotonic()
                consecutivos = 0
                candidata = ""

        dibujar(frame, vista_clase, vista_confianza, aviso, consecutivos)
        cv2.imshow("EcoRewards clasificacion", frame)
        tecla = cv2.waitKey(1) & 0xFF
        if tecla in (ord("q"), 27):
            break

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="Clasifica botella o lata y avisa al ESP32 por WiFi.")
    parser.add_argument("--probar", choices=CLASES_SERVO, help="Manda la orden al servo sin usar la cámara ni el modelo.")
    args = parser.parse_args()
    if args.probar:
        probar(args.probar)
        return
    if not MODELO.is_file():
        sys.exit(
            f"No está el modelo {MODELO}. "
            "Primero captura fotos con capturar.py y entrena, o prueba el servo con --probar bottle."
        )
    sesion = abrir_sesion(MODELO)
    forma = sesion.get_outputs()[0].shape
    cantidad = dimension(forma[-1], None) if len(forma) else None
    bucle(sesion, cargar_clases(sesion, cantidad))


if __name__ == "__main__":
    main()
