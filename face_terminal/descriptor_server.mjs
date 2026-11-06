// Calcula el mismo vector de 128 números que "Mi rostro" (face-api.js).
// Se queda abierto: cada línea de entrada es la ruta de una foto y
// cada línea de salida es el vector en JSON, o "null".
import { createRequire } from 'node:module';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('@tensorflow/tfjs');
const napi = require('@napi-rs/canvas');
const faceapi = require('face-api.js');
await faceapi.tf.ready();

class Canvas {
  constructor(width = 1, height = 1) {
    this._canvas = napi.createCanvas(width || 1, height || 1);
  }
  get width() {
    return this._canvas.width;
  }
  set width(value) {
    this._canvas.width = value || 1;
  }
  get height() {
    return this._canvas.height;
  }
  set height(value) {
    this._canvas.height = value || 1;
  }
  getContext(type) {
    return this._canvas.getContext(type);
  }
}
faceapi.env.monkeyPatch({
  Canvas,
  Image: napi.Image,
  ImageData: napi.ImageData,
  CanvasRenderingContext2D: napi.CanvasRenderingContext2D || Canvas,
});

const models = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models');

await Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromDisk(models),
  faceapi.nets.faceLandmark68Net.loadFromDisk(models),
  faceapi.nets.faceRecognitionNet.loadFromDisk(models),
]);
console.error('modelos face-api listos');

const lines = readline.createInterface({ input: process.stdin });
for await (const file of lines) {
  const ruta = file.trim();
  if (!ruta) continue;
  try {
    const image = await napi.loadImage(ruta);
    const result = await faceapi
      .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) {
      console.log('null');
    } else {
      console.log(JSON.stringify(Array.from(result.descriptor)));
    }
  } catch (error) {
    console.error(error.message || error);
    console.log('null');
  }
}
