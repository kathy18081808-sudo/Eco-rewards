import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import WebCameraView from '../components/WebCameraView';
import {
  loadFaceApi,
  detectFace,
  startCamera,
  stopCamera,
  cameraErrorMessage,
  FaceResult,
} from '../lib/faceWeb';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

const SAMPLES = 5;
const MIN_FACE_RATIO = 0.2; // la cara debe ocupar al menos 20% del ancho
const TIPS = ['Mira de frente', 'Gira un poco a la izquierda', 'Gira un poco a la derecha', 'Levanta un poco la barbilla', 'Mira de frente y sonríe'];

type Step = 'intro' | 'capturing' | 'saving' | 'done';

export default function RegisterFaceScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [hasFace, setHasFace] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [samples, setSamples] = useState<number[][]>([]);
  const [face, setFace] = useState<FaceResult | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);

  const videoEl = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const running = useRef(false);

  const checkExisting = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('face_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('model', 'faceapi');
    setHasFace((count ?? 0) > 0);
  }, [user]);

  useEffect(() => {
    checkExisting();
    return () => {
      running.current = false;
      stopCamera(stream.current);
    };
  }, [checkExisting]);

  const save = async (collected: number[][]) => {
    if (!user) return;
    setStep('saving');
    stopCamera(stream.current);
    try {
      // Reemplaza el registro anterior (si existía)
      await supabase.from('face_embeddings').delete().eq('user_id', user.id).eq('model', 'faceapi');
      const { error } = await supabase.from('face_embeddings').insert(
        collected.map((embedding) => ({ user_id: user.id, embedding, model: 'faceapi' }))
      );
      if (error) throw error;
      await supabase.from('profiles').update({ face_consent_at: new Date().toISOString() }).eq('id', user.id);
      setHasFace(true);
      refreshProfile();
      setStep('done');
    } catch (error: any) {
      Alert.alert('No se pudo guardar', error?.message || 'Intenta de nuevo.');
      setStep('intro');
    }
  };

  const start = async () => {
    setSamples([]);
    setFace(null);
    setMessage('Cargando el reconocimiento facial…');
    setStep('capturing');
    try {
      await loadFaceApi();
      // esperar a que el <video> exista en pantalla
      for (let i = 0; i < 20 && !videoEl.current; i++) await new Promise((r) => setTimeout(r, 50));
      stream.current = await startCamera(videoEl.current!);
    } catch (error: any) {
      Alert.alert('Cámara', cameraErrorMessage(error));
      setStep('intro');
      return;
    }

    running.current = true;
    const collected: number[][] = [];
    let lastCapture = 0;

    while (running.current && collected.length < SAMPLES) {
      const video = videoEl.current;
      if (!video) break;
      if (video.videoWidth && !videoSize) setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      const result = await detectFace(video).catch(() => null);
      setFace(result);

      if (!result) {
        setMessage('No veo tu cara. Ponte frente a la cámara con buena luz.');
      } else if (result.sizeRatio < MIN_FACE_RATIO) {
        setMessage('Acércate un poco más a la cámara.');
      } else {
        setMessage(TIPS[collected.length]);
        if (Date.now() - lastCapture > 900 && result.score > 0.7) {
          collected.push(result.descriptor);
          lastCapture = Date.now();
          setSamples([...collected]);
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    running.current = false;
    if (collected.length === SAMPLES) await save(collected);
  };

  const cancel = () => {
    running.current = false;
    stopCamera(stream.current);
    setStep('intro');
  };

  const removeFace = () => {
    if (!user) return;
    Alert.alert('Borrar mi rostro', '¿Seguro que quieres borrar tus datos faciales? Ya no te reconocerá la máquina.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('face_embeddings').delete().eq('user_id', user.id);
          if (error) {
            Alert.alert('Error', error.message);
            return;
          }
          await supabase.from('profiles').update({ face_consent_at: null }).eq('id', user.id);
          setHasFace(false);
          refreshProfile();
          Alert.alert('Listo', 'Tus datos faciales fueron borrados.');
        },
      },
    ]);
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.text}>El registro facial está disponible en la versión web: eco-rewards-web.vercel.app</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => { cancel(); router.back(); }}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Mi rostro</Text>

      {step === 'intro' && (
        <>
          <View style={styles.card}>
            <Ionicons name="scan-outline" size={40} color={Colors.primary} />
            <Text style={styles.cardTitle}>
              {hasFace ? 'Tu rostro ya está registrado' : 'Identifícate en la máquina con tu cara'}
            </Text>
            <Text style={styles.text}>
              Te tomaremos 5 muestras con la cámara. Solo se guarda un código numérico de tu rostro, nunca fotos,
              y lo puedes borrar cuando quieras.
            </Text>
          </View>

          <Text style={styles.consent}>
            Al continuar, aceptas que EcoRewards guarde este código para identificarte en sus máquinas de reciclaje.
          </Text>

          <TouchableOpacity style={styles.button} onPress={start}>
            <Text style={styles.buttonText}>{hasFace ? 'Volver a registrar mi rostro' : 'Aceptar y registrar mi rostro'}</Text>
          </TouchableOpacity>

          {hasFace && (
            <TouchableOpacity style={styles.danger} onPress={removeFace}>
              <Text style={styles.dangerText}>Borrar mi rostro</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {step === 'capturing' && (
        <>
          <WebCameraView
            videoRef={(el) => (videoEl.current = el)}
            style={styles.camera}
            box={face?.box}
            videoSize={videoSize}
            boxColor={face && face.sizeRatio >= MIN_FACE_RATIO ? '#10B981' : '#F59E0B'}
          />
          <Text style={styles.tip}>{message}</Text>
          <View style={styles.dots}>
            {Array.from({ length: SAMPLES }, (_, i) => (
              <View key={i} style={[styles.dot, i < samples.length && styles.dotDone]} />
            ))}
          </View>
          <TouchableOpacity style={styles.secondary} onPress={cancel}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'saving' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>Guardando…</Text>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.card}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
          <Text style={styles.cardTitle}>¡Rostro registrado!</Text>
          <Text style={styles.text}>Ponte frente a la cámara de la máquina EcoRewards y te reconocerá.</Text>
          <TouchableOpacity style={[styles.button, { alignSelf: 'stretch' }]} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.buttonText}>Listo</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl, maxWidth: 560, width: '100%', alignSelf: 'center', gap: Spacing.md },
  center: { justifyContent: 'center', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  text: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  consent: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  camera: { width: '100%', aspectRatio: 4 / 3, borderRadius: BorderRadius.lg },
  tip: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.border },
  dotDone: { backgroundColor: Colors.primary },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.md },
  buttonText: { color: Colors.surface, fontSize: FontSize.md, fontWeight: '700' },
  secondary: { alignItems: 'center', padding: Spacing.sm },
  secondaryText: { color: Colors.textSecondary, fontWeight: '600' },
  danger: { alignItems: 'center', padding: Spacing.sm },
  dangerText: { color: '#DC2626', fontWeight: '700' },
});
