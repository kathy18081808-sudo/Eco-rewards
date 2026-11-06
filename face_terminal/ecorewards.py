"""Conexión con Eco-Rewards (Supabase): cuentas, máquina y sesiones de reciclaje.

Usa la misma base de datos que la app web (eco-rewards-web.vercel.app). Cuando se abre una
sesión aquí (source='face'), la ESP32 la detecta con la función poll-session, igual que con
el código QR, y los puntos de cada botella o lata van a la cuenta de esa persona.
"""
import os
from datetime import datetime, timedelta, timezone

import requests

TIMEOUT = 10
SESION_SEGUNDOS = int(os.environ.get("SESION_SEGUNDOS", "60"))


def _cfg():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    code = os.environ.get("MACHINE_CODE", "").strip().upper()
    return url, key, code


def configurado() -> bool:
    url, key, code = _cfg()
    return bool(url and key and code)


def _headers(extra=None):
    _, key, _ = _cfg()
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _rest(path):
    url, _, _ = _cfg()
    return f"{url}/rest/v1/{path}"


def _get(tabla, params):
    r = requests.get(_rest(tabla), headers=_headers(), params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _ahora():
    return datetime.now(timezone.utc).isoformat()


def nombre(perfil) -> str:
    if not perfil:
        return "Reciclador"
    return (perfil.get("alias") or "").strip() or (perfil.get("full_name") or "").strip() or "Reciclador"


# ---------------------------------------------------------------- cuentas

_CAMPOS = "id,email,alias,full_name,account_number,points_balance"


def buscar_perfil(cuenta: str):
    """Busca la cuenta por correo o por número de cuenta."""
    cuenta = cuenta.strip()
    if "@" in cuenta:
        filtro = {"email": f"eq.{cuenta.lower()}"}
    else:
        filtro = {"account_number": f"eq.{cuenta}"}
    filas = _get("profiles", {**filtro, "select": _CAMPOS})
    return filas[0] if filas else None


def perfil_por_id(profile_id: str):
    filas = _get("profiles", {"id": f"eq.{profile_id}", "select": _CAMPOS})
    return filas[0] if filas else None


# ---------------------------------------------------------------- máquina y sesiones

def obtener_maquina():
    _, _, code = _cfg()
    filas = _get("machines", {
        "machine_code": f"eq.{code}",
        "is_active": "eq.true",
        "select": "id,machine_code,name",
    })
    if not filas:
        raise SystemExit(f"No existe una máquina activa con MACHINE_CODE={code}")
    return filas[0]


def sesion_activa(machine_id: str):
    filas = _get("recycling_sessions", {
        "machine_id": f"eq.{machine_id}",
        "status": "eq.armed",
        "expires_at": f"gt.{_ahora()}",
        "select": "id,user_id,source,expires_at,items_processed",
        "order": "armed_at.desc",
        "limit": "1",
    })
    return filas[0] if filas else None


def abrir_sesion(machine_id: str, profile_id: str):
    """Igual que escanear el QR, pero con source='face'."""
    if sesion_activa(machine_id):
        return None  # la máquina ya está en uso
    # Solo puede haber una sesión abierta por persona y por máquina
    requests.patch(
        _rest("recycling_sessions"),
        headers=_headers(),
        params={"status": "eq.armed", "or": f"(user_id.eq.{profile_id},machine_id.eq.{machine_id})"},
        json={"status": "cancelled"},
        timeout=TIMEOUT,
    ).raise_for_status()

    vence = datetime.now(timezone.utc) + timedelta(seconds=SESION_SEGUNDOS)
    r = requests.post(
        _rest("recycling_sessions"),
        headers=_headers({"Prefer": "return=representation"}),
        json={
            "machine_id": machine_id,
            "user_id": profile_id,
            "status": "armed",
            "source": "face",
            "expires_at": vence.isoformat(),
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()[0]


def terminar_sesion(session_id: str):
    requests.patch(
        _rest("recycling_sessions"),
        headers=_headers(),
        params={"id": f"eq.{session_id}", "status": "eq.armed"},
        json={"status": "completed"},
        timeout=TIMEOUT,
    ).raise_for_status()


# ---------------------------------------------------------------- rostros de la app (face-api, 128)

def rostros_de_la_app():
    """Vectores que guardó 'Mi rostro'. Cada fila: user_id y una lista de 128 números."""
    return _get("face_embeddings", {
        "model": "eq.faceapi",
        "select": "user_id,embedding",
    })


def peticiones_pendientes(machine_id: str):
    return _get("face_requests", {
        "machine_id": f"eq.{machine_id}",
        "status": "eq.pending",
        "expires_at": f"gt.{_ahora()}",
        "select": "id,user_id,expires_at",
        "order": "created_at.asc",
    })


def cerrar_peticion(request_id: str, status: str, session_id: str | None = None, error: str | None = None):
    cuerpo = {"status": status, "error": error}
    if session_id:
        cuerpo["session_id"] = session_id
    requests.patch(
        _rest("face_requests"),
        headers=_headers(),
        params={"id": f"eq.{request_id}"},
        json=cuerpo,
        timeout=TIMEOUT,
    ).raise_for_status()
