"""Registrar (o borrar) la cara de un usuario.

Uso:
    python enroll.py 100245            # por número de cuenta
    python enroll.py correo@ejemplo.com
    python enroll.py 100245 --delete   # borra sus datos faciales
"""
import argparse
import time

import cv2
import numpy as np

import db
from face_engine import FaceEngine, draw_face, face_is_usable, open_camera

SAMPLES = 5
SECONDS_BETWEEN_SAMPLES = 0.8
CAMERA_INDEX = int(__import__("os").environ.get("CAMERA_INDEX", "0"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("usuario", help="Número de cuenta o email")
    parser.add_argument("--delete", action="store_true", help="Borrar datos faciales")
    args = parser.parse_args()

    profile = db.find_profile(args.usuario)
    if not profile:
        raise SystemExit("No se encontró ese usuario. Revisa el número de cuenta o email.")
    name = db.display_name(profile)

    if args.delete:
        db.delete_embeddings(profile["id"])
        print(f"Datos faciales de {name} eliminados.")
        return

    print(f"\nUsuario: {name} (cuenta {profile['account_number']})")
    print("Se guardará un vector numérico de tu rostro (no la foto) para identificarte")
    print("en la máquina EcoRewards. Puedes borrarlo cuando quieras.")
    if input("¿Aceptas? (s/n): ").strip().lower() != "s":
        print("Registro cancelado.")
        return

    engine = FaceEngine()
    cap = open_camera(CAMERA_INDEX)
    if not cap.isOpened():
        raise SystemExit("No se pudo abrir la webcam. Prueba con CAMERA_INDEX=1")

    samples, last_capture = [], 0.0
    tips = ["Mira de frente", "Gira un poco a la izquierda", "Gira un poco a la derecha",
            "Levanta un poco la barbilla", "Mira de frente y sonrie"]

    while len(samples) < SAMPLES:
        ok, frame = cap.read()
        if not ok:
            continue
        frame = cv2.flip(frame, 1)
        face = engine.detect_largest(frame)
        tip = tips[len(samples)]

        if face is not None and face_is_usable(face, frame.shape):
            draw_face(frame, face, f"{len(samples)}/{SAMPLES}")
            if time.time() - last_capture > SECONDS_BETWEEN_SAMPLES:
                samples.append(engine.embed(frame, face))
                last_capture = time.time()
        elif face is not None:
            tip = "Acercate mas a la camara"
            draw_face(frame, face, "", (0, 165, 255))
        else:
            tip = "No veo tu cara"

        cv2.putText(frame, tip, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.putText(frame, "Q = cancelar", (20, frame.shape[0] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        cv2.imshow("Registro facial - EcoRewards", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Cancelado.")
            break

    cap.release()
    cv2.destroyAllWindows()
    if len(samples) < SAMPLES:
        return

    # Aviso si esta cara ya se parece mucho a la de OTRO usuario registrado
    matrix, user_ids = db.load_all_embeddings()
    if len(user_ids):
        sims = matrix @ np.mean(samples, axis=0)
        best = int(np.argmax(sims))
        if user_ids[best] != profile["id"] and sims[best] > 0.5:
            other = db.get_profile(user_ids[best])
            print(f"Atención: esta cara se parece a la de {db.display_name(other)}.")
            if input("¿Guardar de todas formas? (s/n): ").strip().lower() != "s":
                return

    db.save_embeddings(profile["id"], samples)
    print(f"Listo: {name} registrado con {SAMPLES} muestras.")


if __name__ == "__main__":
    main()
