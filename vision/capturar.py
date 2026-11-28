"""Guarda fotos para entrenar el clasificador de botella, lata y vacío.

La cámara es la de clasificación, no la del reconocimiento facial.
Pon su número en CAMARA_CLASIFICACION dentro de vision/.env.

Teclas:
  b  botella
  c  lata
  v  vacío
  q / ESC  salir

Las fotos quedan en vision/dataset/train/<clase>/.
Antes de entrenar, aparta unas 40 de cada clase a vision/dataset/val/<clase>/.
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:
    pass

BASE = Path(__file__).parent
CLASES = {"b": "bottle", "c": "can", "v": "empty"}
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


def preparar_carpetas():
    for grupo in ("train", "val"):
        for clase in CLASES.values():
            (BASE / "dataset" / grupo / clase).mkdir(parents=True, exist_ok=True)


def contar():
    return {
        clase: len(list((BASE / "dataset" / "train" / clase).glob("*.jpg")))
        for clase in CLASES.values()
    }


def guardar(frame, clase):
    carpeta = BASE / "dataset" / "train" / clase
    nombre = datetime.now().strftime("%Y%m%d_%H%M%S_%f") + ".jpg"
    ruta = carpeta / nombre
    if not cv2.imwrite(str(ruta), frame):
        return None
    return ruta


def dibujar(frame, conteo, aviso):
    linea = "  ".join(f"{ETIQUETAS[clase]} {conteo[clase]}" for clase in CLASES.values())
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 72), (0, 0, 0), -1)
    cv2.putText(frame, linea, (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(frame, aviso, (16, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)


def main():
    preparar_carpetas()
    cap = abrir_camara()
    conteo = contar()
    aviso = "b botella   c lata   v vacio   q salir"
    while True:
        ok, frame = cap.read()
        if not ok:
            time.sleep(0.05)
            continue
        dibujar(frame, conteo, aviso)
        cv2.imshow("EcoRewards capturar", frame)
        tecla = cv2.waitKey(1) & 0xFF
        if tecla in (ord("q"), 27):
            break
        letra = chr(tecla) if 32 <= tecla < 127 else ""
        clase = CLASES.get(letra.lower())
        if clase is None:
            continue
        if guardar(frame, clase) is None:
            aviso = "No pude guardar la foto"
            continue
        conteo[clase] += 1
        aviso = f"Guardada: {ETIQUETAS[clase]} ({conteo[clase]})"

    cap.release()
    cv2.destroyAllWindows()
    print("Fotos en", BASE / "dataset" / "train")
    for clase, total in contar().items():
        print(f"  {clase}: {total}")


if __name__ == "__main__":
    main()
