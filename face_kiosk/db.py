"""Acceso a Supabase vía REST (PostgREST) con la service role key del kiosko."""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MACHINE_CODE = os.environ.get("MACHINE_CODE", "").strip().upper()
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", "60"))

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en face_kiosk/.env")

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}
TIMEOUT = 10


def _get(table: str, params: dict):
    r = requests.get(f"{REST}/{table}", headers=HEADERS, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Usuarios ----------

def find_profile(identifier: str):
    """Busca un perfil por número de cuenta o por email."""
    identifier = identifier.strip()
    if "@" in identifier:
        # Los correos de Clerk se guardan en minúsculas
        field, identifier = "email", identifier.lower()
    else:
        field = "account_number"
    rows = _get("profiles", {
        field: f"eq.{identifier}",
        "select": "id,email,alias,full_name,account_number,points_balance",
    })
    return rows[0] if rows else None


def get_profile(user_id: str):
    rows = _get("profiles", {
        "id": f"eq.{user_id}",
        "select": "id,alias,full_name,account_number,points_balance",
    })
    return rows[0] if rows else None


def display_name(profile) -> str:
    return profile.get("alias") or profile.get("full_name") or "Reciclador"


# ---------- Vectores faciales ----------

def save_embeddings(user_id: str, embeddings: list):
    rows = [{"user_id": user_id, "embedding": [float(v) for v in e]} for e in embeddings]
    r = requests.post(f"{REST}/face_embeddings", headers=HEADERS, json=rows, timeout=TIMEOUT)
    r.raise_for_status()
    r = requests.patch(f"{REST}/profiles", headers=HEADERS,
                       params={"id": f"eq.{user_id}"},
                       json={"face_consent_at": _now_iso()}, timeout=TIMEOUT)
    r.raise_for_status()


def delete_embeddings(user_id: str):
    r = requests.delete(f"{REST}/face_embeddings", headers=HEADERS,
                        params={"user_id": f"eq.{user_id}"}, timeout=TIMEOUT)
    r.raise_for_status()
    requests.patch(f"{REST}/profiles", headers=HEADERS, params={"id": f"eq.{user_id}"},
                   json={"face_consent_at": None}, timeout=TIMEOUT).raise_for_status()


def load_all_embeddings():
    """Devuelve (matriz Nx128, lista de user_id por fila)."""
    rows = _get("face_embeddings", {"select": "user_id,embedding"})
    if not rows:
        return np.zeros((0, 128)), []
    matrix = np.array([r["embedding"] for r in rows], dtype=np.float64)
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-9
    return matrix, [r["user_id"] for r in rows]


# ---------- Máquina y sesiones ----------

def get_machine():
    rows = _get("machines", {
        "machine_code": f"eq.{MACHINE_CODE}",
        "is_active": "eq.true",
        "select": "id,machine_code,name",
    })
    if not rows:
        raise SystemExit(f"No existe una máquina activa con MACHINE_CODE={MACHINE_CODE}")
    return rows[0]


def get_armed_session(machine_id: str):
    rows = _get("recycling_sessions", {
        "machine_id": f"eq.{machine_id}",
        "status": "eq.armed",
        "expires_at": f"gt.{_now_iso()}",
        "select": "id,user_id,source,expires_at,items_processed",
        "order": "armed_at.desc",
        "limit": "1",
    })
    return rows[0] if rows else None


def arm_face_session(machine_id: str, user_id: str):
    """Igual que arm-session (QR), pero con source='face'. La ESP32 la detecta con poll-session."""
    # Cancela sesiones armadas de esta máquina o de este usuario (solo puede haber una)
    requests.patch(f"{REST}/recycling_sessions", headers=HEADERS,
                   params={"status": "eq.armed",
                           "or": f"(user_id.eq.{user_id},machine_id.eq.{machine_id})"},
                   json={"status": "cancelled"}, timeout=TIMEOUT).raise_for_status()

    expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    r = requests.post(f"{REST}/recycling_sessions",
                      headers={**HEADERS, "Prefer": "return=representation"},
                      json={"machine_id": machine_id, "user_id": user_id,
                            "status": "armed", "source": "face",
                            "expires_at": expires.isoformat()},
                      timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()[0]


def end_session(session_id: str):
    requests.patch(f"{REST}/recycling_sessions", headers=HEADERS,
                   params={"id": f"eq.{session_id}", "status": "eq.armed"},
                   json={"status": "completed"}, timeout=TIMEOUT).raise_for_status()
