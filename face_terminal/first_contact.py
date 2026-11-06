"""Reconocimiento facial de Eco-Rewards desde la terminal (webcam).

Con conexión, `reconocer` espera el botón "Activar con mi rostro" de la app
(o la tecla ESPACIO, que hace de botón de la máquina). Compara la webcam con
los vectores de 128 números que guardó "Mi rostro" y abre la sesión. La ESP32
la toma igual que con el código QR y los puntos van a esa cuenta.

Sin conexión, sigue el modo local de InsightFace (faces_db.json).

Uso:
  python first_contact.py reconocer            # espera el botón de la app
  python first_contact.py registrar <cuenta>   # registro local (sin conexión)
  python first_contact.py listar               # muestra las personas locales
  python first_contact.py borrar <cuenta>      # borra una cara local

Opciones (variables de entorno o archivo .env):
  CAMARA=1                    número de cámara (o ruta /dev/v4l/by-id/... en Linux)
  SIN_CONEXION=1              solo reconocimiento local, sin abrir sesiones
  DET_SIZE=320                tamaño de detección local (más bajo = más rápido)
  UMBRAL=0.45                 distancia máxima del vector de "Mi rostro"
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MACHINE_CODE   (ver .env.example)

Teclas: ESPACIO = identificar a cualquiera, T = terminar sesión, Q / ESC = salir
"""

# --- Arreglo de cuDNN (Linux + GPU): debe ir ANTES de importar cv2 / onnxruntime / insightface ---
# Crea el enlace libcudnn.so y agrega la carpeta de cuDNN (instalada con pip dentro
# del venv) a LD_LIBRARY_PATH. Después relanza el script una vez para que el sistema
# tome la variable. En Windows o sin cuDNN no hace nada.
import os
import sys
import sysconfig

_CUDNN = os.path.join(sysconfig.get_paths()["purelib"], "nvidia", "cudnn", "lib")
_LINK = os.path.join(_CUDNN, "libcudnn.so")

if sys.platform.startswith("linux") and os.path.isdir(_CUDNN):
    if not os.path.exists(_LINK):
        try:
            os.symlink("libcudnn.so.9", _LINK)
        except OSError:
            pass
    if _CUDNN not in os.environ.get("LD_LIBRARY_PATH", ""):
        os.environ["LD_LIBRARY_PATH"] = _CUDNN + ":" + os.environ.get("LD_LIBRARY_PATH", "")
        os.execv(sys.executable, [sys.executable] + sys.argv)
# ------------------------------------------------------------------------------------------------

import json
import pickle
import subprocess
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:
    pass

import ecorewards  # conexión con Supabase (mismo proyecto que la app web)

BASE = Path(__file__).parent
DB_FILE = BASE / "faces_db.json"
OLD_PKL = BASE / "faces_db.pkl"
MODELO = "buffalo_l"
UMBRAL = float(os.environ.get("UMBRAL", "0.45"))  # similitud mínima para aceptar
MUESTRAS = 5          # fotos que se toman al registrar una cara
DET_SIZE = int(os.environ.get("DET_SIZE", "640"))  # en la Jetson, 320 o 480 es más rápido
CONFIRMAR = 3         # cuadros seguidos reconociendo a la misma persona antes de abrir sesión
ESPERA_REPETIR = 10   # segundos antes de volver a abrir sesión a la misma persona
SIN_CONEXION = os.environ.get("SIN_CONEXION", "0") == "1" or not ecorewards.configurado()


# ----------------------------------------------------------------------------- modelo y cámara

def cargar_modelo():
    print("Providers disponibles:", ort.get_available_providers())
    if hasattr(ort, "preload_dlls"):
        ort.preload_dlls()
    app = FaceAnalysis(
        name=MODELO,
        providers=[p for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
                   if p in ort.get_available_providers()],
    )
    app.prepare(ctx_id=0, det_size=(DET_SIZE, DET_SIZE))
    try:
        usado = app.models["detection"].session.get_providers()[0]
        print("Procesando con:", usado)
    except Exception:
        pass
    return app


def abrir_camara():
    fuente = os.environ.get("CAMARA", "0")
    fuente = int(fuente) if fuente.isdigit() else fuente
    if sys.platform.startswith("win") and isinstance(fuente, int):
        cap = cv2.VideoCapture(fuente, cv2.CAP_DSHOW)  # en Windows abre más rápido
    else:
        cap = cv2.VideoCapture(fuente)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    if not cap.isOpened():
        ayuda = "v4l2-ctl --list-devices" if sys.platform.startswith("linux") else "prueba con CAMARA=1"
        sys.exit(f"No pude abrir la cámara. Revisa con: {ayuda}")
    return cap


# ----------------------------------------------------------------------------- documento JSON

def _db_vacia():
    return {"modelo": f"insightface/{MODELO}", "umbral": UMBRAL, "actualizado": None, "personas": {}}


def cargar_db():
    """Lee faces_db.json. Si solo existe el faces_db.pkl de las pruebas anteriores, lo convierte."""
    if DB_FILE.exists():
        with open(DB_FILE, encoding="utf-8") as f:
            return json.load(f)
    db = _db_vacia()
    if OLD_PKL.exists():
        with open(OLD_PKL, "rb") as f:
            viejo = pickle.load(f)
        for cuenta, emb in viejo.items():
            db["personas"][str(cuenta)] = {
                "cuenta": str(cuenta),
                "nombre": str(cuenta),
                "profile_id": None,
                "registrado": None,
                "muestras": None,
                "embedding": [round(float(v), 6) for v in np.asarray(emb).ravel()],
            }
        guardar_db(db)
        print(f"Convertí {OLD_PKL.name} a {DB_FILE.name} ({len(viejo)} personas).")
    return db


def guardar_db(db):
    db["actualizado"] = datetime.now().isoformat(timespec="seconds")
    # Legible: estructura con sangría, pero cada vector de 512 números en una sola línea
    copia = json.loads(json.dumps(db))
    vectores = {}
    for i, persona in enumerate(copia["personas"].values()):
        marca = f"@@VECTOR_{i}@@"
        vectores[marca] = json.dumps(persona["embedding"])
        persona["embedding"] = marca
    texto = json.dumps(copia, ensure_ascii=False, indent=2)
    for marca, vector in vectores.items():
        texto = texto.replace(f'"{marca}"', vector)
    tmp = DB_FILE.with_suffix(".tmp")
    tmp.write_text(texto, encoding="utf-8")
    tmp.replace(DB_FILE)


def matriz(db):
    """Embeddings como matriz normalizada para comparar rápido."""
    cuentas = list(db["personas"])
    if not cuentas:
        return cuentas, np.zeros((0, 512), dtype=np.float32)
    m = np.array([db["personas"][c]["embedding"] for c in cuentas], dtype=np.float32)
    m /= np.linalg.norm(m, axis=1, keepdims=True) + 1e-9
    return cuentas, m


def mejor_match(emb, cuentas, m):
    if not cuentas:
        return None, -1.0
    sims = m @ emb  # similitud coseno (embeddings normalizados)
    i = int(np.argmax(sims))
    mejor = float(sims[i])
    return (cuentas[i], mejor) if mejor >= UMBRAL else (None, mejor)


# ----------------------------------------------------------------------------- comandos

def registrar(cuenta):
    perfil = None
    if not SIN_CONEXION:
        perfil = ecorewards.buscar_perfil(cuenta)
        if not perfil:
            sys.exit(f"No existe una cuenta Eco-Rewards con '{cuenta}'. Regístrate primero en la app web.")
        cuenta = perfil["account_number"] or cuenta
        print(f"Cuenta encontrada: {ecorewards.nombre(perfil)} (cuenta {perfil['account_number']}, "
              f"{perfil['points_balance']} pts)")

    print("Se guardará un vector numérico de tu rostro (no la foto) en faces_db.json.")
    if input("¿Aceptas? (s/n): ").strip().lower() != "s":
        print("Registro cancelado.")
        return

    app = cargar_modelo()
    cap = abrir_camara()
    muestras = []
    print(f"Registrando '{cuenta}'. ESPACIO = capturar, ESC = cancelar")
    print("Tip: mueve un poco la cabeza entre captura y captura.")

    while len(muestras) < MUESTRAS:
        ok, frame = cap.read()
        if not ok:
            continue
        faces = app.get(frame)
        vista = frame.copy()
        for f in faces:
            x1, y1, x2, y2 = map(int, f.bbox)
            cv2.rectangle(vista, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(vista, f"Muestra {len(muestras)}/{MUESTRAS} - ESPACIO para capturar",
                    (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        cv2.imshow("Registrar", vista)

        k = cv2.waitKey(1) & 0xFF
        if k == 27:
            break
        if k == 32:
            if len(faces) != 1:
                print("Debe haber exactamente 1 cara en la imagen.")
                continue
            muestras.append(faces[0].normed_embedding)
            print(f"Muestra {len(muestras)}/{MUESTRAS} guardada")

    cap.release()
    cv2.destroyAllWindows()

    if len(muestras) < MUESTRAS:
        print("Registro cancelado.")
        return

    emb = np.mean(muestras, axis=0)
    emb = emb / np.linalg.norm(emb)

    db = cargar_db()
    cuentas, m = matriz(db)
    otro, sim = mejor_match(emb, cuentas, m)
    if otro and otro != cuenta:
        print(f"Atención: esta cara se parece a la de '{otro}' (similitud {sim:.2f}).")
        if input("¿Guardar de todas formas? (s/n): ").strip().lower() != "s":
            return

    db["personas"][cuenta] = {
        "cuenta": cuenta,
        "nombre": ecorewards.nombre(perfil) if perfil else cuenta,
        "email": perfil.get("email") if perfil else None,
        "profile_id": perfil["id"] if perfil else None,
        "registrado": datetime.now().isoformat(timespec="seconds"),
        "muestras": MUESTRAS,
        "embedding": [round(float(v), 6) for v in emb],
    }
    guardar_db(db)
    print(f"Listo: '{cuenta}' guardado en {DB_FILE.name}. Personas registradas: {list(db['personas'])}")


def listar():
    db = cargar_db()
    if not db["personas"]:
        print("No hay caras registradas.")
        return
    print(f"{len(db['personas'])} personas en {DB_FILE.name} (modelo {db['modelo']}):")
    for p in db["personas"].values():
        enlace = "vinculada a la app" if p.get("profile_id") else "solo local"
        print(f"  - {p['cuenta']:<12} {p['nombre']:<24} {enlace}  registrado {p.get('registrado') or '-'}")


def borrar(cuenta):
    db = cargar_db()
    if db["personas"].pop(cuenta, None) is None:
        sys.exit(f"'{cuenta}' no está registrado.")
    guardar_db(db)
    print(f"Se borró la cara de '{cuenta}'.")


class Sesion:
    """Abre y sigue la sesión de la máquina en segundo plano, para no congelar el video."""

    def __init__(self):
        self.maquina = None
        self.info = None          # {"nombre", "puntos", "inicio", "items", "segundos"}
        self.mensaje = ""
        self.ultimo = {}          # profile_id -> momento en que terminó su sesión
        self._lock = threading.Lock()
        self._ocupado = False
        self.al_vincular = None   # se llama para guardar el JSON cuando se vincula una cuenta
        if not SIN_CONEXION:
            self.maquina = ecorewards.obtener_maquina()
            threading.Thread(target=self._seguir, daemon=True).start()

    def abrir(self, persona):
        if SIN_CONEXION or self._ocupado or self.info:
            return
        pid = persona.get("profile_id")
        if not pid:
            # registrada sin conexión: se vincula a su cuenta la primera vez
            try:
                perfil = ecorewards.buscar_perfil(persona["cuenta"])
            except Exception as e:
                self.mensaje = f"Sin conexión: {e}"
                return
            if not perfil:
                self.mensaje = f"'{persona['cuenta']}' no tiene cuenta en Eco-Rewards"
                return
            pid = persona["profile_id"] = perfil["id"]
            persona["nombre"] = ecorewards.nombre(perfil)
            if self.al_vincular:
                self.al_vincular()
        if time.time() - self.ultimo.get(pid, 0) < ESPERA_REPETIR:
            return
        self._ocupado = True

        def trabajo():
            try:
                ecorewards.abrir_sesion(self.maquina["id"], pid)
                self.mensaje = f"Sesión abierta para {persona['nombre']}"
                print(self.mensaje)
            except Exception as e:
                self.mensaje = f"Error al abrir sesión: {e}"
                print(self.mensaje)
            finally:
                self._ocupado = False

        threading.Thread(target=trabajo, daemon=True).start()

    def terminar(self):
        if self.info and self.info.get("id"):
            threading.Thread(target=ecorewards.terminar_sesion, args=(self.info["id"],), daemon=True).start()

    def _seguir(self):
        while True:
            try:
                s = ecorewards.sesion_activa(self.maquina["id"])
                with self._lock:
                    if s:
                        perfil = ecorewards.perfil_por_id(s["user_id"])
                        fin = datetime.fromisoformat(s["expires_at"].replace("Z", "+00:00"))
                        inicio = self.info["inicio"] if self.info and self.info["id"] == s["id"] else perfil["points_balance"]
                        self.info = {
                            "id": s["id"],
                            "user_id": s["user_id"],
                            "nombre": ecorewards.nombre(perfil),
                            "puntos": perfil["points_balance"],
                            "inicio": inicio,
                            "items": s["items_processed"],
                            "fuente": s["source"],
                            "segundos": max(0, int((fin - datetime.now(timezone.utc)).total_seconds())),
                        }
                    elif self.info:
                        self.ultimo[self.info["user_id"]] = time.time()
                        print(f"Sesión terminada: {self.info['nombre']} ganó {self.info['puntos'] - self.info['inicio']} pts")
                        self.info = None
            except Exception as e:
                self.mensaje = f"Sin conexión: {e}"
            time.sleep(1.5)


class DescriptorApp:
    """Mismo vector de 128 números que guarda 'Mi rostro' en el navegador."""

    def __init__(self):
        script = BASE / "descriptor_server.mjs"
        if not (BASE / "node_modules" / "face-api.js").exists():
            sys.exit(
                "Faltan las librerías del vector de 'Mi rostro'. "
                "En face_terminal ejecuta: npm install"
            )
        self.listo = threading.Event()
        self.proc = subprocess.Popen(
            ["node", str(script)],
            cwd=BASE,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        threading.Thread(target=self._leer_errores, daemon=True).start()
        if not self.listo.wait(120):
            self.cerrar()
            sys.exit("El modelo de 'Mi rostro' no arrancó. Revisa: npm install")

    def _leer_errores(self):
        for linea in self.proc.stderr:
            texto = linea.rstrip()
            if texto:
                print(texto)
            if "listos" in texto:
                self.listo.set()

    def vector(self, frame):
        foto = BASE / ".frame.jpg"
        cv2.imwrite(str(foto), frame)
        self.proc.stdin.write(str(foto) + "\n")
        self.proc.stdin.flush()
        linea = self.proc.stdout.readline()
        if not linea or linea.strip() == "null":
            return None
        return np.asarray(json.loads(linea), dtype=np.float32)

    def cerrar(self):
        if self.proc.poll() is None:
            self.proc.kill()


def distancia(a, b) -> float:
    d = np.asarray(a, dtype=np.float32) - np.asarray(b, dtype=np.float32)
    return float(np.sqrt(np.dot(d, d)))


def reconocer_con_app():
    """Espera el botón de la app (o ESPACIO) y abre la sesión de esa persona."""
    sesion = Sesion()
    maquina = sesion.maquina
    print(f"Conectado a Eco-Rewards. Máquina: {maquina['name']} ({maquina['machine_code']})")
    print("Esperando 'Activar con mi rostro' en la app. ESPACIO identifica a cualquiera.")

    descriptor = DescriptorApp()
    cap = abrir_camara()
    rostros = {}
    actualizado = 0.0
    busqueda = None
    racha_id, racha = None, 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue
            ahora = time.time()
            if ahora - actualizado > 2:
                actualizado = ahora
                try:
                    rostros = {}
                    for fila in ecorewards.rostros_de_la_app():
                        muestra = fila["embedding"]
                        if isinstance(muestra, str):
                            muestra = json.loads(muestra) if muestra.startswith("[") else [
                                float(x) for x in muestra.strip("{}").split(",") if x
                            ]
                        rostros.setdefault(fila["user_id"], []).append(muestra)
                    if busqueda is None:
                        pendientes = ecorewards.peticiones_pendientes(maquina["id"])
                        if pendientes:
                            pet = pendientes[0]
                            busqueda = {
                                "user_id": pet["user_id"],
                                "request_id": pet["id"],
                                "hasta": datetime.fromisoformat(
                                    pet["expires_at"].replace("Z", "+00:00")
                                ).timestamp(),
                            }
                            racha_id, racha = None, 0
                            print("La app pidió reconocer un rostro. Mira a la cámara.")
                except Exception as e:
                    sesion.mensaje = f"Sin conexión: {e}"

            etiqueta = None
            if busqueda and ahora > busqueda["hasta"]:
                if busqueda.get("request_id"):
                    try:
                        ecorewards.cerrar_peticion(busqueda["request_id"], "expired", error="tiempo agotado")
                    except Exception as e:
                        print(e)
                print("No se reconoció a tiempo.")
                busqueda = None
                racha_id, racha = None, 0
            elif busqueda:
                vector = descriptor.vector(frame)
                candidatos = (
                    {busqueda["user_id"]: rostros.get(busqueda["user_id"], [])}
                    if busqueda.get("user_id")
                    else rostros
                )
                mejor_id, mejor_d = None, UMBRAL
                if vector is not None:
                    for user_id, muestras in candidatos.items():
                        for muestra in muestras:
                            d = distancia(vector, muestra)
                            if d < mejor_d:
                                mejor_id, mejor_d = user_id, d
                if mejor_id and mejor_id == racha_id:
                    racha += 1
                else:
                    racha_id, racha = mejor_id, (1 if mejor_id else 0)
                if mejor_id:
                    etiqueta = f"coincide ({mejor_d:.2f})"
                elif vector is not None:
                    etiqueta = "no coincide"
                else:
                    etiqueta = "sin cara"
                if mejor_id and racha >= CONFIRMAR and not sesion.info and not sesion._ocupado:
                    persona = {"profile_id": mejor_id, "nombre": "Reciclador", "cuenta": mejor_id}
                    try:
                        persona["nombre"] = ecorewards.nombre(ecorewards.perfil_por_id(mejor_id))
                    except Exception:
                        pass
                    request_id = busqueda.get("request_id")
                    sesion.abrir(persona)
                    if request_id:
                        def marcar(rid=request_id, pid=mejor_id):
                            for _ in range(20):
                                time.sleep(0.4)
                                activa = ecorewards.sesion_activa(maquina["id"])
                                if activa and activa["user_id"] == pid:
                                    ecorewards.cerrar_peticion(rid, "matched", session_id=activa["id"])
                                    return
                            ecorewards.cerrar_peticion(rid, "failed", error="no se pudo abrir la sesión")
                        threading.Thread(target=marcar, daemon=True).start()
                    busqueda = None
                    racha_id, racha = None, 0

            if sesion.info:
                info = sesion.info
                ganados = info["puntos"] - info["inicio"]
                lineas = [
                    f"Hola, {info['nombre']}!",
                    f"{info['puntos']} pts  (+{ganados})  articulos: {info['items']}",
                    f"Deposita tus botellas y latas - cierra en {info['segundos']}s",
                ]
                fondo = (40, 110, 40)
            elif busqueda:
                lineas = [etiqueta or "Mira a la camara"]
                fondo = (40, 70, 110)
            else:
                lineas = ["Esperando el boton de la app", "ESPACIO = identificar a cualquiera"]
                fondo = (50, 50, 50)
            if sesion.mensaje and not sesion.info:
                lineas.append(sesion.mensaje[:70])
            alto = 30 + 32 * len(lineas)
            cv2.rectangle(frame, (0, frame.shape[0] - alto), (frame.shape[1], frame.shape[0]), fondo, -1)
            for i, texto in enumerate(lineas):
                cv2.putText(
                    frame, texto, (20, frame.shape[0] - alto + 35 + 32 * i),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2,
                )
            cv2.imshow("Reconocer - Eco-Rewards", frame)
            k = cv2.waitKey(1) & 0xFF
            if k in (ord("q"), 27):
                break
            if k == ord("t"):
                sesion.terminar()
            if k == 32 and busqueda is None and not sesion.info:
                busqueda = {"user_id": None, "request_id": None, "hasta": time.time() + 25}
                racha_id, racha = None, 0
                print("Botón de la máquina: identificando a cualquiera durante 25 s.")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        descriptor.cerrar()


def reconocer():
    if not SIN_CONEXION:
        reconocer_con_app()
        return
    db = cargar_db()
    if not db["personas"]:
        sys.exit("No hay caras registradas. Primero: python first_contact.py registrar <cuenta>")
    cuentas, m = matriz(db)

    sesion = Sesion()
    sesion.al_vincular = lambda: guardar_db(db)
    if SIN_CONEXION:
        print("Modo SIN CONEXIÓN: solo reconocimiento local (no se abren sesiones).")
    else:
        print(f"Conectado a Eco-Rewards. Máquina: {sesion.maquina['name']} ({sesion.maquina['machine_code']})")

    app = cargar_modelo()
    cap = abrir_camara()
    print("Reconociendo... T = terminar sesión, Q o ESC = salir")
    t_prev = time.time()
    racha_cuenta, racha = None, 0

    while True:
        ok, frame = cap.read()
        if not ok:
            continue

        caras = app.get(frame)
        if caras:
            # la cara más grande es la de quien está frente a la máquina
            caras.sort(key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        for idx, f in enumerate(caras):
            cuenta, score = mejor_match(f.normed_embedding, cuentas, m)
            persona = db["personas"].get(cuenta) if cuenta else None
            x1, y1, x2, y2 = map(int, f.bbox)
            color = (0, 255, 0) if persona else (0, 0, 255)
            etiqueta = f"{persona['nombre']} ({score:.2f})" if persona else f"desconocido ({score:.2f})"
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, etiqueta, (x1, max(y1 - 10, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

            if idx == 0:
                racha = racha + 1 if cuenta and cuenta == racha_cuenta else (1 if cuenta else 0)
                racha_cuenta = cuenta
                if persona and racha >= CONFIRMAR:
                    sesion.abrir(persona)
        if not caras:
            racha_cuenta, racha = None, 0

        # Panel con el estado de la máquina
        info = sesion.info
        if info:
            ganados = info["puntos"] - info["inicio"]
            lineas = [f"Hola, {info['nombre']}!  ({info['fuente']})",
                      f"{info['puntos']} pts  (+{ganados})  articulos: {info['items']}",
                      f"Deposita tus botellas y latas - cierra en {info['segundos']}s"]
            fondo = (40, 110, 40)
        else:
            lineas = ["Mira a la camara para empezar" if not SIN_CONEXION else "Modo sin conexion"]
            fondo = (50, 50, 50)
        alto = 30 + 32 * len(lineas)
        cv2.rectangle(frame, (0, frame.shape[0] - alto), (frame.shape[1], frame.shape[0]), fondo, -1)
        for i, texto in enumerate(lineas):
            cv2.putText(frame, texto, (20, frame.shape[0] - alto + 35 + 32 * i),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        ahora = time.time()
        fps = 1.0 / max(ahora - t_prev, 1e-6)
        t_prev = ahora
        cv2.putText(frame, f"FPS: {fps:.0f}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        cv2.imshow("Reconocer - Eco-Rewards", frame)
        k = cv2.waitKey(1) & 0xFF
        if k in (ord("q"), 27):
            break
        if k == ord("t"):
            sesion.terminar()

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "registrar":
        registrar(sys.argv[2])
    elif len(sys.argv) >= 2 and sys.argv[1] == "reconocer":
        reconocer()
    elif len(sys.argv) >= 2 and sys.argv[1] == "listar":
        listar()
    elif len(sys.argv) >= 3 and sys.argv[1] == "borrar":
        borrar(sys.argv[2])
    else:
        print(__doc__)
