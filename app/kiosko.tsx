import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import WebCameraView from '../components/WebCameraView';
import {
  loadFaceApi,
  detectFace,
  startCamera,
  stopCamera,
  listCameras,
  cameraErrorMessage,
  FaceResult,
} from '../lib/faceWeb';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

// Pantalla del kiosko: se abre en Chrome en la laptop de la máquina, con la webcam conectada.
// Reconoce la cara, abre la sesión de reciclaje y muestra los puntos en vivo.
// La ESP32 detecta la sesión con poll-session, igual que cuando se escanea el QR.

const STORAGE_KEY = 'ecorewards-kiosk';
const MIN_FACE_RATIO = 0.15;
const IDENTIFY_EVERY_MS = 1000;
const STATUS_EVERY_MS = 1500;
const COOLDOWN_MS = 10000;

interface KioskConfig {
  code: string;
  key: string;
  cameraId: string | null;
}

interface SessionInfo {
  id: string;
  source: string;
  display_name: string;
  points_balance: number;
  items: number;
  expires_at: string;
  user_ref: string;
}

type Mode = 'setup' | 'loading' | 'idle' | 'active' | 'thanks' | 'error';

function readConfig(): KioskConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeConfig(config: KioskConfig | null) {
  try {
    if (config) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin almacenamiento: se pedirá la configuración cada vez
  }
}

export default function KioskScreen() {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [message, setMessage] = useState('Mírame para empezar');
  const [machineName, setMachineName] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [startPoints, setStartPoints] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [face, setFace] = useState<FaceResult | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

  // formulario de configuración
  const [formCode, setFormCode] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formCamera, setFormCamera] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [checking, setChecking] = useState(false);

  const videoEl = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const modeRef = useRef<Mode>('setup');
  const sessionRef = useRef<SessionInfo | null>(null);
  const cooldown = useRef<{ ref: string; until: number } | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Configuración guardada en esta computadora
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const saved = readConfig();
    if (saved) {
      setFormCode(saved.code);
      setFormKey(saved.key);
      setFormCamera(saved.cameraId);
      setConfig(saved);
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      // pedir permiso una vez para que aparezcan los nombres de las cámaras
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      // se mostrará el error al encender la cámara
    }
    setCameras(await listCameras().catch(() => []));
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && !config) refreshCameras();
  }, [config, refreshCameras]);

  const applyStatus = useCallback((data: any) => {
    if (data?.machine_name) setMachineName(data.machine_name);
    const s: SessionInfo | null = data?.session ?? null;
    const previous = sessionRef.current;

    if (s) {
      if (!previous || previous.id !== s.id) setStartPoints(s.points_balance);
      sessionRef.current = s;
      setSession(s);
      setSecondsLeft(Math.max(0, Math.round((new Date(s.expires_at).getTime() - Date.now()) / 1000)));
      setMode('active');
    } else if (previous) {
      // la sesión terminó (por tiempo o con el botón)
      cooldown.current = { ref: previous.user_ref, until: Date.now() + COOLDOWN_MS };
      sessionRef.current = null;
      setMode('thanks');
      setTimeout(() => {
        if (modeRef.current === 'thanks') {
          setSession(null);
          setStartPoints(null);
          setMessage('Mírame para empezar');
          setMode('idle');
        }
      }, 4000);
    }
  }, []);

  // Arranque: cargar modelos, encender webcam y empezar los ciclos
  useEffect(() => {
    if (Platform.OS !== 'web' || !config) return;
    let stopped = false;

    (async () => {
      setMode('loading');
      setMessage('Cargando el reconocimiento facial…');
      try {
        const { data, error } = await supabase.rpc('kiosk_status', { p_code: config.code, p_key: config.key });
        if (error) throw error;
        await loadFaceApi();
        for (let i = 0; i < 20 && !videoEl.current; i++) await new Promise((r) => setTimeout(r, 50));
        stream.current = await startCamera(videoEl.current!, config.cameraId);
        if (stopped) return;
        setMessage('Mírame para empezar');
        setMode('idle');
        applyStatus(data);
      } catch (error: any) {
        if (stopped) return;
        setMessage(error?.name ? cameraErrorMessage(error) : error?.message || 'Error al iniciar el kiosko');
        setMode('error');
        return;
      }

      // Ciclo 1: estado de la máquina (sesión, puntos, artículos)
      const statusLoop = async () => {
        while (!stopped) {
          try {
            const { data } = await supabase.rpc('kiosk_status', { p_code: config.code, p_key: config.key });
            if (data && !stopped) applyStatus(data);
          } catch {
            // sin conexión momentánea: se reintenta
          }
          await new Promise((r) => setTimeout(r, STATUS_EVERY_MS));
        }
      };

      // Ciclo 2: detectar y reconocer caras cuando la máquina está libre
      const faceLoop = async () => {
        let lastIdentify = 0;
        while (!stopped) {
          const video = videoEl.current;
          if (video && modeRef.current === 'idle') {
            if (video.videoWidth) setVideoSize({ width: video.videoWidth, height: video.videoHeight });
            const result = await detectFace(video).catch(() => null);
            if (stopped) break;
            setFace(result);

            if (!result) {
              setMessage('Mírame para empezar');
            } else if (result.sizeRatio < MIN_FACE_RATIO) {
              setMessage('Acércate un poco más');
            } else if (Date.now() - lastIdentify > IDENTIFY_EVERY_MS) {
              lastIdentify = Date.now();
              setMessage('Reconociendo…');
              const ignore =
                cooldown.current && cooldown.current.until > Date.now() ? cooldown.current.ref : null;
              const { data, error } = await supabase.rpc('kiosk_identify', {
                p_code: config.code,
                p_key: config.key,
                p_descriptor: result.descriptor,
                p_ignore_user_ref: ignore,
              });
              if (error) {
                setMessage('Error de conexión. Usa tu PIN o el QR.');
              } else if (data?.matched || data?.busy) {
                applyStatus(data);
              } else {
                setMessage('No te reconozco. Registra tu rostro en la app, o usa tu PIN o el QR.');
              }
            }
          } else {
            setFace(null);
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      };

      statusLoop();
      faceLoop();
    })();

    return () => {
      stopped = true;
      stopCamera(stream.current);
    };
  }, [config, applyStatus]);

  // Cuenta regresiva de la sesión
  useEffect(() => {
    if (mode !== 'active') return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode]);

  const saveConfig = async () => {
    const next = { code: formCode.trim().toUpperCase(), key: formKey.trim().toUpperCase(), cameraId: formCamera };
    if (!next.code || !next.key) {
      setFormError('Escribe el código de la máquina y la clave del kiosko.');
      return;
    }
    setChecking(true);
    setFormError('');
    const { error } = await supabase.rpc('kiosk_status', { p_code: next.code, p_key: next.key });
    setChecking(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    writeConfig(next);
    setConfig(next);
  };

  const openSetup = () => {
    stopCamera(stream.current);
    setConfig(null);
    setMode('setup');
  };

  const endSession = async () => {
    if (!config) return;
    await supabase.rpc('kiosk_end', { p_code: config.code, p_key: config.key });
  };

  const fullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.setupPage, { justifyContent: 'center' }]}>
        <Text style={styles.setupText}>El kiosko funciona en la versión web, en una computadora con webcam.</Text>
      </View>
    );
  }

  // ---------- Configuración ----------
  if (!config) {
    return (
      <ScrollView style={styles.setupPage} contentContainerStyle={styles.setupContent}>
        <Text style={styles.logo}>
          ECO <Text style={{ color: Colors.primary }}>REWARDS</Text> · Kiosko
        </Text>
        <Text style={styles.setupText}>
          Configura esta computadora como el kiosko de la máquina. Solo se hace una vez.
        </Text>

        <Text style={styles.label}>Código de la máquina</Text>
        <TextInput style={styles.input} value={formCode} onChangeText={setFormCode} placeholder="ECO-XXXXXX" autoCapitalize="characters" />

        <Text style={styles.label}>Clave del kiosko</Text>
        <TextInput style={styles.input} value={formKey} onChangeText={setFormKey} placeholder="Clave de 10 caracteres" autoCapitalize="characters" secureTextEntry />

        <Text style={styles.label}>Cámara</Text>
        {cameras.length === 0 && <Text style={styles.setupHint}>Conecta la webcam y permite el acceso a la cámara.</Text>}
        {cameras.map((c, i) => (
          <TouchableOpacity
            key={c.deviceId || i}
            style={[styles.cameraOption, formCamera === c.deviceId && styles.cameraOptionActive]}
            onPress={() => setFormCamera(c.deviceId)}
          >
            <Ionicons name={formCamera === c.deviceId ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
            <Text style={styles.cameraText}>{c.label || `Cámara ${i + 1}`}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={refreshCameras}>
          <Text style={styles.link}>Actualizar lista de cámaras</Text>
        </TouchableOpacity>

        {!!formError && <Text style={styles.error}>{formError}</Text>}

        <TouchableOpacity style={styles.primary} onPress={saveConfig} disabled={checking}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Iniciar kiosko</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- Kiosko ----------
  const earned = session && startPoints !== null ? session.points_balance - startPoints : 0;
  const recognized = mode === 'active' || mode === 'thanks';

  return (
    <View style={styles.page}>
      <View style={styles.cameraPane}>
        <WebCameraView
          videoRef={(el) => (videoEl.current = el)}
          style={StyleSheet.absoluteFillObject as any}
          box={mode === 'idle' ? face?.box : null}
          videoSize={videoSize}
          boxColor={face && face.sizeRatio >= MIN_FACE_RATIO ? '#10B981' : '#F59E0B'}
        />
        {recognized && <View style={styles.okFrame} />}
      </View>

      <View style={styles.panel}>
        <View style={styles.topRow}>
          <Text style={styles.logo}>
            ECO <Text style={{ color: Colors.primary }}>REWARDS</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={fullscreen} style={styles.iconButton}>
              <Ionicons name="expand-outline" size={20} color="#cfd8d3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={openSetup} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={20} color="#cfd8d3" />
            </TouchableOpacity>
          </View>
        </View>

        {mode === 'loading' && <ActivityIndicator size="large" color={Colors.primary} />}

        <Text style={styles.hello}>
          {session ? `¡Hola, ${session.display_name}!` : mode === 'thanks' ? '¡Gracias por reciclar!' : '¡Hola!'}
        </Text>
        <Text style={[styles.message, mode === 'error' && { color: '#FCA5A5' }]}>
          {mode === 'active' ? 'Deposita tus botellas y latas' : mode === 'thanks' ? 'Tus puntos ya están en tu cuenta' : message}
        </Text>

        {session && (
          <View style={styles.points}>
            <Text style={styles.pointsLabel}>TUS ECO PUNTOS</Text>
            <Text style={styles.pointsValue}>{session.points_balance}</Text>
            {session.items > 0 && (
              <Text style={styles.pointsEarned}>
                +{earned} pts · {session.items} {session.items === 1 ? 'artículo' : 'artículos'}
              </Text>
            )}
          </View>
        )}

        {mode === 'active' && (
          <View style={styles.bottomRow}>
            <Text style={styles.timer}>La sesión se cierra en {secondsLeft}s</Text>
            <TouchableOpacity style={styles.primarySmall} onPress={endSession}>
              <Text style={styles.primaryText}>Terminar</Text>
            </TouchableOpacity>
          </View>
        )}

        {(mode === 'idle' || mode === 'error') && (
          <View style={styles.steps}>
            <Text style={styles.step}><Text style={styles.stepBold}>1.</Text> Mira a la cámara</Text>
            <Text style={styles.step}><Text style={styles.stepBold}>2.</Text> Deposita botellas (+15) y latas (+10)</Text>
            <Text style={styles.step}><Text style={styles.stepBold}>¿No te reconoce?</Text> Registra tu rostro en la app, o usa tu PIN o el QR</Text>
            {mode === 'error' && (
              <TouchableOpacity style={styles.primarySmall} onPress={openSetup}>
                <Text style={styles.primaryText}>Revisar configuración</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!!machineName && <Text style={styles.machine}>{machineName} · {config.code}</Text>}
      </View>
    </View>
  );
}

const DARK = '#14171a';

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: DARK, minHeight: '100%' as any },
  cameraPane: { flexGrow: 1.15, flexBasis: 420, minHeight: 320, backgroundColor: '#000', position: 'relative' },
  okFrame: { ...StyleSheet.absoluteFillObject, borderWidth: 8, borderColor: Colors.primary },
  panel: { flexGrow: 1, flexBasis: 360, padding: 32, gap: 20, justifyContent: 'center', backgroundColor: '#1e2327' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: '#f2f5f0', fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  iconButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  hello: { color: '#f2f5f0', fontSize: 44, fontWeight: '800' },
  message: { color: '#9aa5a0', fontSize: 22 },
  points: { backgroundColor: '#1f5f2e', borderRadius: 20, padding: 24 },
  pointsLabel: { color: '#cfe8c4', fontSize: 16 },
  pointsValue: { color: '#6cc417', fontSize: 72, fontWeight: '900' },
  pointsEarned: { color: '#f2f5f0', fontSize: 22, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  timer: { color: '#9aa5a0', fontSize: 18 },
  steps: { gap: 8 },
  step: { color: '#9aa5a0', fontSize: 17, lineHeight: 26 },
  stepBold: { color: '#f2f5f0', fontWeight: '700' },
  machine: { color: '#5d6964', fontSize: 13 },
  primary: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  primarySmall: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', alignSelf: 'flex-start' },
  primaryText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  setupPage: { flex: 1, backgroundColor: DARK },
  setupContent: { padding: 32, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  setupText: { color: '#9aa5a0', fontSize: FontSize.md, marginBottom: Spacing.md },
  setupHint: { color: '#9aa5a0', fontSize: FontSize.sm },
  label: { color: '#f2f5f0', fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm },
  input: { backgroundColor: '#fff', borderRadius: BorderRadius.md, height: 50, paddingHorizontal: 14, fontSize: FontSize.md },
  cameraOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: BorderRadius.md, backgroundColor: '#1e2327' },
  cameraOptionActive: { borderWidth: 1, borderColor: Colors.primary },
  cameraText: { color: '#f2f5f0', fontSize: FontSize.md, flex: 1 },
  link: { color: Colors.primary, fontWeight: '700', marginTop: 4 },
  error: { color: '#FCA5A5', fontSize: FontSize.sm },
});
