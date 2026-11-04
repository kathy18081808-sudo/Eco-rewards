// Reconocimiento facial en el navegador (solo web) con face-api.js.
// La librería y los modelos se sirven desde /vendor y /models (carpeta public/).
// Solo se calculan vectores numéricos de 128 valores; no se guardan fotos.

declare global {
  interface Window {
    faceapi?: any;
  }
}

const SCRIPT_URL = '/vendor/face-api-1.7.15.js';
const MODELS_URL = '/models';

let loading: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.faceapi) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar face-api')));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar face-api'));
    document.head.appendChild(script);
  });
}

/** Carga face-api.js y los tres modelos (detector, puntos de la cara y reconocimiento). */
export function loadFaceApi(): Promise<any> {
  if (!loading) {
    loading = (async () => {
      await loadScript(SCRIPT_URL);
      const faceapi = window.faceapi;
      try {
        await faceapi.tf.setBackend('webgl');
      } catch {
        // si no hay WebGL se usa el backend por defecto
      }
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
      return faceapi;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

export interface FaceResult {
  descriptor: number[];
  box: { x: number; y: number; width: number; height: number };
  /** Ancho de la cara respecto al ancho del video (0–1): sirve para pedir que se acerquen. */
  sizeRatio: number;
  score: number;
}

/** Detecta la cara más clara del video y devuelve su vector de 128 valores (o null). */
export async function detectFace(video: HTMLVideoElement): Promise<FaceResult | null> {
  const faceapi = await loadFaceApi();
  if (!video.videoWidth) return null;
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;
  const { x, y, width, height } = result.detection.box;
  return {
    descriptor: Array.from(result.descriptor as Float32Array),
    box: { x, y, width, height },
    sizeRatio: width / video.videoWidth,
    score: result.detection.score,
  };
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** Enciende la cámara (la indicada por deviceId, o la frontal) y la conecta al <video>. */
export async function startCamera(video: HTMLVideoElement, deviceId?: string | null): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite usar la cámara. Usa Chrome y una dirección https.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
      : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function cameraErrorMessage(error: any): string {
  const name = error?.name;
  if (name === 'NotAllowedError') return 'Permite el acceso a la cámara en el navegador (ícono del candado o la cámara en la barra de direcciones).';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró la cámara. Revisa que la webcam esté conectada.';
  if (name === 'NotReadableError') return 'La cámara está siendo usada por otro programa. Ciérralo e intenta de nuevo.';
  return error?.message || 'No se pudo abrir la cámara.';
}

/** Distancia entre dos vectores faciales (menor = más parecidos). */
export function distance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}
