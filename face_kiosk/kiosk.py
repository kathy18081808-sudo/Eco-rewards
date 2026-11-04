"""Kiosko de reconocimiento facial para la máquina EcoRewards.

- Lee la webcam, reconoce caras registradas y arma una sesión (source='face').
- La ESP32 detecta esa sesión con poll-session, igual que con el QR. No hay que cambiar su firmware.
- Sirve la pantalla de la tablet en http://<IP-de-la-laptop>:5000

Uso:  python kiosk.py
"""
import os
import socket
import threading
import time
from datetime import datetime, timezone

import cv2
import numpy as np
from flask import Flask, Response, jsonify, send_from_directory

import db
from face_engine import FaceEngine, draw_face, face_is_usable, open_camera

CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))
MATCH_THRESHOLD = float(os.environ.get("MATCH_THRESHOLD", "0.42"))  # coseno SFace (oficial: 0.363)
CONFIRM_FRAMES = int(os.environ.get("CONFIRM_FRAMES", "4"))          # cuadros seguidos para confirmar
RECOGNIZE_EVERY = 0.2       # s entre intentos de reconocimiento (~5 por segundo)
RELOAD_EMBEDDINGS_EVERY = 30
SESSION_POLL_EVERY = 1.0
REARM_COOLDOWN = 10         # s antes de volver a reconocer a quien acaba de terminar

app = Flask(__name__, static_folder="static")

state_lock = threading.Lock()
state = {
    "mode": "idle",          # idle | recognizing | active | thanks | error
    "message": "Mírame para empezar",
    "user_name": None,
    "points_balance": None,
    "points_start": None,
    "items": 0,
    "seconds_left": 0,
    "source": None,
    "session_id": None,
}
latest_jpeg = None
cooldown_until = {}  # user_id -> timestamp


def set_state(**kwargs):
    with state_lock:
        state.update(kwargs)


def get_state():
    with state_lock:
        return dict(state)


# ---------------- Hilo de cámara + reconocimiento ----------------

def camera_loop(machine):
    global latest_jpeg
    engine = FaceEngine()
    cap = open_camera(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    if not cap.isOpened():
        set_state(mode="error", message="No se pudo abrir la cámara")
        return

    matrix, user_ids = db.load_all_embeddings()
    last_reload = time.time()
    last_attempt = 0.0
    candidate, streak = None, 0
    print(f"[kiosko] {len(set(user_ids))} usuarios con cara registrada")

    while True:
        ok, frame = cap.read()
        if not ok:
            time.sleep(0.05)
            continue
        frame = cv2.flip(frame, 1)
        now = time.time()

        if now - last_reload > RELOAD_EMBEDDINGS_EVERY:
            try:
                matrix, user_ids = db.load_all_embeddings()
            except Exception as exc:
                print("[kiosko] error recargando caras:", exc)
            last_reload = now

        current = get_state()
        busy = current["mode"] in ("active", "thanks")

        if not busy and now - last_attempt > RECOGNIZE_EVERY:
            last_attempt = now
            face = engine.detect_largest(frame)
            if face is None:
                candidate, streak = None, 0
                if current["mode"] == "recognizing":
                    set_state(mode="idle", message="Mírame para empezar")
            elif not face_is_usable(face, frame.shape):
                draw_face(frame, face, "Acercate", (0, 165, 255))
                set_state(mode="recognizing", message="Acércate un poco más")
            elif len(user_ids) == 0:
                draw_face(frame, face, "Sin registros", (0, 0, 255))
                set_state(mode="recognizing", message="No hay caras registradas")
            else:
                sims = matrix @ engine.embed(frame, face)
                best = int(np.argmax(sims))
                score, uid = float(sims[best]), user_ids[best]

                if score >= MATCH_THRESHOLD and cooldown_until.get(uid, 0) < now:
                    streak = streak + 1 if uid == candidate else 1
                    candidate = uid
                    draw_face(frame, face, f"{score:.2f}")
                    set_state(mode="recognizing", message="Reconociendo…")
                    if streak >= CONFIRM_FRAMES:
                        arm_for_user(machine, uid)
                        candidate, streak = None, 0
                else:
                    candidate, streak = None, 0
                    draw_face(frame, face, f"? {score:.2f}", (0, 0, 255))
                    set_state(mode="recognizing",
                              message="No te reconozco. Usa tu PIN en el teclado o el QR")

        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if ok:
            latest_jpeg = buf.tobytes()


def arm_for_user(machine, user_id):
    try:
        profile = db.get_profile(user_id)
        session = db.arm_face_session(machine["id"], user_id)
        set_state(mode="active", session_id=session["id"], source="face",
                  user_name=db.display_name(profile),
                  points_balance=profile["points_balance"],
                  points_start=profile["points_balance"], items=0,
                  seconds_left=db.SESSION_TTL_SECONDS,
                  message="¡Deposita tus botellas y latas!")
        print(f"[kiosko] sesión armada para {db.display_name(profile)}")
    except Exception as exc:
        print("[kiosko] error armando sesión:", exc)
        set_state(mode="error", message="Error de conexión. Usa tu PIN.")


# ---------------- Hilo que sigue la sesión en Supabase ----------------

def session_loop(machine):
    """Refleja en la tablet la sesión activa (de cara, QR o teclado) y los puntos que suben."""
    while True:
        time.sleep(SESSION_POLL_EVERY)
        try:
            current = get_state()
            session = db.get_armed_session(machine["id"])

            if session:
                profile = db.get_profile(session["user_id"])
                expires = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
                left = max(0, int((expires - datetime.now(timezone.utc)).total_seconds()))
                start = (current["points_start"]
                         if current["session_id"] == session["id"] and current["points_start"] is not None
                         else profile["points_balance"])
                set_state(mode="active", session_id=session["id"], source=session["source"],
                          user_name=db.display_name(profile),
                          points_balance=profile["points_balance"], points_start=start,
                          items=session["items_processed"], seconds_left=left,
                          message="¡Deposita tus botellas y latas!")
            elif current["mode"] == "active":
                # La sesión terminó (expiró o se cerró): pantalla de agradecimiento
                cooldown_user(current)
                set_state(mode="thanks", message="¡Gracias por reciclar!", seconds_left=0)
                time.sleep(4)
                set_state(mode="idle", message="Mírame para empezar", user_name=None,
                          points_balance=None, points_start=None, items=0,
                          session_id=None, source=None)
        except Exception as exc:
            print("[kiosko] error consultando sesión:", exc)


def cooldown_user(current):
    """Evita volver a armar al mismo usuario apenas termina su sesión."""
    try:
        if current.get("session_id"):
            rows = db._get("recycling_sessions",
                           {"id": f"eq.{current['session_id']}", "select": "user_id"})
            if rows:
                cooldown_until[rows[0]["user_id"]] = time.time() + REARM_COOLDOWN
    except Exception:
        pass


# ---------------- Servidor web para la tablet ----------------

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/status")
def status():
    return jsonify(get_state())


@app.route("/video")
def video():
    def stream():
        while True:
            if latest_jpeg:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + latest_jpeg + b"\r\n")
            time.sleep(0.07)
    return Response(stream(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/end", methods=["POST"])
def end():
    current = get_state()
    if current["session_id"]:
        try:
            db.end_session(current["session_id"])
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True})


def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    machine = db.get_machine()
    print(f"[kiosko] Máquina: {machine['name']} ({machine['machine_code']})")
    threading.Thread(target=camera_loop, args=(machine,), daemon=True).start()
    threading.Thread(target=session_loop, args=(machine,), daemon=True).start()
    print(f"[kiosko] Abre en la tablet:  http://{local_ip()}:5000")
    app.run(host="0.0.0.0", port=5000, threaded=True)
