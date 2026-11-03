"""Descarga los modelos de OpenCV Zoo (YuNet y SFace) a face_kiosk/models/."""
from pathlib import Path
import urllib.request

MODELS = {
    "face_detection_yunet_2023mar.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx":
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}

out = Path(__file__).parent / "models"
out.mkdir(exist_ok=True)
for name, url in MODELS.items():
    dest = out / name
    if dest.exists() and dest.stat().st_size > 100_000:
        print(f"Ya existe {name}")
        continue
    print(f"Descargando {name}…")
    mirror = url.replace("https://github.com/opencv/opencv_zoo/raw/main/",
                         "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/")
    for attempt in (url, mirror):
        try:
            urllib.request.urlretrieve(attempt, dest)
            if dest.stat().st_size > 100_000:
                break
        except Exception as exc:
            print(f"  falló {attempt}: {exc}")
    else:
        raise SystemExit(f"No se pudo descargar {name}. Bájalo a mano desde {url}")
    print(f"  {dest.stat().st_size // 1024} KB")
print("Modelos listos.")
