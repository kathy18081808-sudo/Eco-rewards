import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  videoRef: (el: HTMLVideoElement | null) => void;
  style?: ViewStyle;
  /** Imagen en espejo (más natural para la persona que se ve). */
  mirror?: boolean;
  /** Recuadro de la cara, en pixeles del video. */
  box?: { x: number; y: number; width: number; height: number } | null;
  videoSize?: { width: number; height: number } | null;
  boxColor?: string;
  children?: React.ReactNode;
}

// Muestra la cámara en la versión web. React Native no tiene <video>,
// pero react-native-web deja renderizar etiquetas HTML directamente.
export default function WebCameraView({
  videoRef,
  style,
  mirror = true,
  box,
  videoSize,
  boxColor = '#10B981',
  children,
}: Props) {
  const flip = mirror ? 'scaleX(-1)' : undefined;
  let boxStyle: any = null;
  if (box && videoSize?.width && videoSize?.height) {
    const left = (box.x / videoSize.width) * 100;
    boxStyle = {
      position: 'absolute',
      left: `${mirror ? 100 - left - (box.width / videoSize.width) * 100 : left}%`,
      top: `${(box.y / videoSize.height) * 100}%`,
      width: `${(box.width / videoSize.width) * 100}%`,
      height: `${(box.height / videoSize.height) * 100}%`,
      border: `4px solid ${boxColor}`,
      borderRadius: 16,
      boxSizing: 'border-box',
    };
  }

  return (
    <View style={[styles.container, style]}>
      {React.createElement('div', {
        style: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
        children: [
          React.createElement('video', {
            key: 'video',
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            style: { width: '100%', height: '100%', objectFit: 'cover', transform: flip, display: 'block' },
          }),
          boxStyle ? React.createElement('div', { key: 'box', style: boxStyle }) : null,
        ],
      })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
