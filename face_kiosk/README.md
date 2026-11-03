# Reconocimiento facial — EcoRewards

La laptop reconoce la cara del usuario con la webcam y **arma una sesión de reciclaje**
en Supabase (igual que cuando escanea el QR, pero con `source = 'face'`).
La ESP32 ya consulta `poll-session` cada 2 s, así que toma la sesión sola:
**no hay que cambiar el firmware de la ESP32.**

```
Webcam ──USB──► Laptop (kiosk.py) ──crea sesión──► Supabase ◄──poll-session── ESP32
                    │                                  ▲                        │
                    └──WiFi──► Tablet (navegador)      └──── add-points ◄───────┘
```

## 1. Base de datos (una sola vez)

En Supabase → SQL Editor, ejecuta `supabase/migrations/006_face_recognition.sql`.
Agrega la tabla `face_embeddings`, la columna `face_consent_at` y permite `source = 'face'`.

## 2. Instalar en la laptop

Requiere Python 3.9 o superior.

```bash
cd face_kiosk
python -m venv venv
# Windows:  venv\Scripts\activate      Mac/Linux:  source venv/bin/activate
pip install -r requirements.txt
python download_models.py
```

Copia `.env.example` como `.env` y llénalo:

- `SUPABASE_URL`: la misma del proyecto.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API → `service_role`.
  Es secreta: solo va en la laptop del kiosko, nunca en la app ni en GitHub.
- `MACHINE_CODE`: el mismo que tiene la ESP32.

## 3. Registrar caras

```bash
python enroll.py 100245              # número de cuenta del usuario
python enroll.py correo@ejemplo.com  # o su email
```

Pide consentimiento, abre la cámara y toma 5 muestras automáticamente (sigue las
indicaciones: de frente, girar un poco, etc.). Se guardan solo números, no fotos.

Para borrar la cara de alguien: `python enroll.py 100245 --delete`

## 4. Encender el kiosko

```bash
python kiosk.py
```

La consola muestra algo como `Abre en la tablet: http://192.168.1.50:5000`.
Abre esa dirección en Chrome de la tablet (misma red WiFi) y toca **Pantalla completa**.

Flujo: la persona mira la cámara → la reconoce en ~1 s → la tablet dice "¡Hola, Andreina!"
→ deposita → la ESP32 suma los puntos → la tablet los muestra subiendo en vivo.
La sesión se cierra sola a los 60 s sin depósitos, o con el botón **Terminar**.
Si alguien usa el QR o el PIN del teclado, la tablet también muestra su nombre y puntos.

## Ajustes finos (en `.env`)

| Problema | Ajuste |
|---|---|
| Confunde a dos personas | Subir `MATCH_THRESHOLD` a 0.46–0.50 |
| No reconoce a alguien registrado | Bajar a 0.38, o volver a registrarlo con mejor luz |
| Abre la cámara de la laptop y no la webcam | `CAMERA_INDEX=1` |
| Se activa muy rápido / muy lento | `CONFIRM_FRAMES` (4 ≈ 1 segundo) |

## Consejos para la demo

- **Luz frontal** sobre la cara (una tira LED arriba de la tablet). La luz de espaldas es lo que más falla.
- Registren a cada integrante con la **misma iluminación** del lugar de la presentación.
- Si la tablet se apaga: Ajustes → Pantalla → Tiempo de espera al máximo, y conéctenla al cargador.
- Desactiven el ahorro de energía de la laptop para que no suspenda la webcam.
- Plan B siempre listo: PIN en el teclado y QR.

## Archivos

- `kiosk.py`: cámara + reconocimiento + servidor de la tablet.
- `enroll.py`: registrar o borrar caras.
- `face_engine.py`: modelos YuNet (detecta) y SFace (reconoce) de OpenCV.
- `db.py`: lectura y escritura en Supabase.
- `static/index.html`: pantalla de la tablet.
