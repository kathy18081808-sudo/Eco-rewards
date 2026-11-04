"""Muestra cada cámara conectada para saber qué número (CAMERA_INDEX) es la webcam.

Teclas: N = siguiente cámara, Q = salir.
"""
import cv2

from face_engine import open_camera

found = []
key = None
for index in range(4):
    cap = open_camera(index)
    ok, _ = cap.read() if cap.isOpened() else (False, None)
    if not ok:
        cap.release()
        continue
    found.append(index)
    print(f"Mostrando cámara {index}. Pulsa N para la siguiente o Q para salir.")
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        cv2.putText(frame, f"CAMERA_INDEX={index}  (N = siguiente, Q = salir)", (15, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imshow("Probar camaras - EcoRewards", frame)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("n"), ord("q")):
            break
    cap.release()
    if key == ord("q"):
        break

cv2.destroyAllWindows()
print("Cámaras encontradas:", found or "ninguna")
print("Escribe en el archivo .env el número de la webcam: CAMERA_INDEX=<número>")
