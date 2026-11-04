"""Detección y reconocimiento facial con OpenCV (YuNet + SFace)."""
import sys
from pathlib import Path

import cv2
import numpy as np

MODELS_DIR = Path(__file__).parent / "models"
DETECTOR_MODEL = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNIZER_MODEL = MODELS_DIR / "face_recognition_sface_2021dec.onnx"


class FaceEngine:
    def __init__(self, detect_threshold: float = 0.85):
        for model in (DETECTOR_MODEL, RECOGNIZER_MODEL):
            if not model.exists():
                raise FileNotFoundError(
                    f"Falta el modelo {model.name}. Ejecuta: python download_models.py"
                )
        self.detector = cv2.FaceDetectorYN.create(
            str(DETECTOR_MODEL), "", (320, 320), detect_threshold, 0.3, 5000
        )
        self.recognizer = cv2.FaceRecognizerSF.create(str(RECOGNIZER_MODEL), "")

    def detect_largest(self, frame):
        """Devuelve la cara más grande del cuadro (o None)."""
        h, w = frame.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(frame)
        if faces is None or len(faces) == 0:
            return None
        return max(faces, key=lambda f: f[2] * f[3])

    def embed(self, frame, face) -> np.ndarray:
        """Vector normalizado de 128 valores para una cara detectada."""
        aligned = self.recognizer.alignCrop(frame, face)
        feature = self.recognizer.feature(aligned).flatten().astype(np.float64)
        return feature / (np.linalg.norm(feature) + 1e-9)


def face_is_usable(face, frame_shape, min_size: int = 90) -> bool:
    """Descarta caras muy pequeñas (lejos de la cámara) o cortadas por el borde."""
    x, y, w, h = face[:4]
    fh, fw = frame_shape[:2]
    if w < min_size or h < min_size:
        return False
    return x >= 0 and y >= 0 and x + w <= fw and y + h <= fh


def draw_face(frame, face, label: str = "", color=(80, 200, 80)):
    x, y, w, h = [int(v) for v in face[:4]]
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
    if label:
        cv2.putText(frame, label, (x, max(20, y - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)


def open_camera(index: int):
    """Abre la webcam. En Windows usa DirectShow: abre más rápido y evita errores de MSMF."""
    if sys.platform.startswith("win"):
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if cap.isOpened():
            return cap
    return cv2.VideoCapture(index)
