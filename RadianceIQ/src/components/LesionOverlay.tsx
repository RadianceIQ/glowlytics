import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { DetectedLesion } from '../types';

// Neon green — "The Matrix" accent
const NEON = '#00FF41';
const NEON_DIM = 'rgba(0, 255, 65, 0.35)';
const NEON_GLOW = 'rgba(0, 255, 65, 0.12)';

// Corner bracket length as fraction of box dimension
const CORNER_FRAC = 0.25;
const STROKE_W = 1.5;
const LABEL_H = 16;

interface Props {
  lesions: DetectedLesion[];
  width: number;
  height: number;
  mirrored?: boolean;
}

/** Sci-fi corner bracket bounding box with neon glow + scanning line. */
export const LesionOverlay: React.FC<Props> = ({ lesions, width, height, mirrored }) => {
  const fadeIn = useSharedValue(0);
  const scanLineY = useSharedValue(0);
  const glowPulse = useSharedValue(0.6);

  useEffect(() => {
    fadeIn.value = withTiming(lesions.length > 0 ? 1 : 0, { duration: 250 });
  }, [lesions.length]);

  useEffect(() => {
    // Scanning line sweeps top → bottom continuously
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
    );
    // Glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 }),
      ),
      -1,
    );
  }, []);

  const containerAnim = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const scanLineAnim = useAnimatedStyle(() => ({
    top: `${scanLineY.value * 100}%` as any,
    opacity: glowPulse.value * 0.6,
  }));

  if (lesions.length === 0) return null;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, containerAnim]}>
        {/* Scanning line */}
        <Animated.View style={[styles.scanLine, scanLineAnim]} />

        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {lesions.map((lesion, i) => {
            const [bx, by, bw, bh] = lesion.bbox;
            let x = bx * width;
            const y = by * height;
            const w = bw * width;
            const h = bh * height;

            if (mirrored) x = width - x - w;

            const conf = Math.round(lesion.confidence * 100);
            const label = `${lesion.class.toUpperCase()}  ${conf}%`;

            // Corner bracket lengths
            const cx = Math.min(w * CORNER_FRAC, 14);
            const cy = Math.min(h * CORNER_FRAC, 14);

            // Corner coordinates
            const x1 = x, y1 = y;
            const x2 = x + w, y2 = y + h;

            return (
              <G key={`lesion-${i}`}>
                {/* Glow fill */}
                <Rect
                  x={x} y={y} width={w} height={h}
                  fill={NEON_GLOW}
                  rx={2}
                />

                {/* Top-left corner */}
                <Line x1={x1} y1={y1} x2={x1 + cx} y2={y1} stroke={NEON} strokeWidth={STROKE_W} />
                <Line x1={x1} y1={y1} x2={x1} y2={y1 + cy} stroke={NEON} strokeWidth={STROKE_W} />

                {/* Top-right corner */}
                <Line x1={x2 - cx} y1={y1} x2={x2} y2={y1} stroke={NEON} strokeWidth={STROKE_W} />
                <Line x1={x2} y1={y1} x2={x2} y2={y1 + cy} stroke={NEON} strokeWidth={STROKE_W} />

                {/* Bottom-left corner */}
                <Line x1={x1} y1={y2 - cy} x2={x1} y2={y2} stroke={NEON} strokeWidth={STROKE_W} />
                <Line x1={x1} y1={y2} x2={x1 + cx} y2={y2} stroke={NEON} strokeWidth={STROKE_W} />

                {/* Bottom-right corner */}
                <Line x1={x2 - cx} y1={y2} x2={x2} y2={y2} stroke={NEON} strokeWidth={STROKE_W} />
                <Line x1={x2} y1={y2 - cy} x2={x2} y2={y2} stroke={NEON} strokeWidth={STROKE_W} />

                {/* Dim edge lines connecting corners */}
                <Line x1={x1 + cx} y1={y1} x2={x2 - cx} y2={y1} stroke={NEON_DIM} strokeWidth={0.5} strokeDasharray="3 4" />
                <Line x1={x1 + cx} y1={y2} x2={x2 - cx} y2={y2} stroke={NEON_DIM} strokeWidth={0.5} strokeDasharray="3 4" />
                <Line x1={x1} y1={y1 + cy} x2={x1} y2={y2 - cy} stroke={NEON_DIM} strokeWidth={0.5} strokeDasharray="3 4" />
                <Line x1={x2} y1={y1 + cy} x2={x2} y2={y2 - cy} stroke={NEON_DIM} strokeWidth={0.5} strokeDasharray="3 4" />

                {/* Label background */}
                <Rect
                  x={x}
                  y={Math.max(0, y - LABEL_H - 3)}
                  width={Math.max(w, 80)}
                  height={LABEL_H}
                  fill="rgba(0, 0, 0, 0.7)"
                  rx={3}
                />
                {/* Label text — monospace */}
                <SvgText
                  x={x + 4}
                  y={Math.max(LABEL_H - 4, y - 6)}
                  fill={NEON}
                  fontSize={10}
                  fontWeight="700"
                  fontFamily="Courier"
                >
                  {label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: NEON,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
});
