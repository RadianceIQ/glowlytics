import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Line, Rect, Text as SvgText, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../constants/theme';
import type { DetectedLesion } from '../types';

// Use app's primary teal palette instead of Matrix green
const PRIMARY = Colors.primary; // #7DE7E1
const PRIMARY_DIM = 'rgba(125, 231, 225, 0.30)';
const PRIMARY_GLOW = 'rgba(125, 231, 225, 0.08)';
const PRIMARY_BRIGHT = 'rgba(125, 231, 225, 0.95)';
const BG_DARK = 'rgba(6, 11, 18, 0.65)';

const CORNER_FRAC = 0.22;
const STROKE_W = 1.5;
const LABEL_H = 18;

interface Props {
  lesions: DetectedLesion[];
  width: number;
  height: number;
  mirrored?: boolean;
}

/** Animated lesion bounding box overlay — teal sci-fi theme with pulsing corners and sweep line. */
export const LesionOverlay: React.FC<Props> = ({ lesions, width, height, mirrored }) => {
  const fadeIn = useSharedValue(0);
  const scanLineY = useSharedValue(0);
  const cornerPulse = useSharedValue(0);
  const glowBreath = useSharedValue(0);
  const prevCount = useRef(0);

  // Fade in/out when lesions appear/disappear
  useEffect(() => {
    fadeIn.value = withTiming(lesions.length > 0 ? 1 : 0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    // Flash effect when new detections appear
    if (lesions.length > 0 && lesions.length !== prevCount.current) {
      glowBreath.value = 0;
      glowBreath.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
    }
    prevCount.current = lesions.length;
  }, [lesions.length]);

  useEffect(() => {
    // Sweep line — smooth vertical scan
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    // Corner brightness pulse
    cornerPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, []);

  const containerAnim = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const scanLineAnim = useAnimatedStyle(() => ({
    top: `${scanLineY.value * 100}%` as any,
    opacity: 0.5 + cornerPulse.value * 0.3,
  }));

  const flashAnim = useAnimatedStyle(() => ({
    opacity: glowBreath.value * 0.15,
  }));

  if (lesions.length === 0) return null;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {/* Full-screen flash on new detection */}
      <Animated.View style={[styles.flash, flashAnim]} />

      <Animated.View style={[StyleSheet.absoluteFill, containerAnim]}>
        {/* Sweep line */}
        <Animated.View style={[styles.scanLine, scanLineAnim]} />

        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="boxGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PRIMARY} stopOpacity={0.12} />
              <Stop offset="0.5" stopColor={PRIMARY} stopOpacity={0.04} />
              <Stop offset="1" stopColor={PRIMARY} stopOpacity={0.12} />
            </LinearGradient>
          </Defs>

          {lesions.map((lesion, i) => {
            const [bx, by, bw, bh] = lesion.bbox;
            let x = bx * width;
            const y = by * height;
            const w = bw * width;
            const h = bh * height;

            if (mirrored) x = width - x - w;

            const conf = Math.round(lesion.confidence * 100);
            const label = `${lesion.class.toUpperCase()} ${conf}%`;

            // Corner bracket lengths
            const cx = Math.min(w * CORNER_FRAC, 16);
            const cy = Math.min(h * CORNER_FRAC, 16);

            const x1 = x, y1 = y;
            const x2 = x + w, y2 = y + h;

            // Center point for target indicator
            const centerX = x + w / 2;
            const centerY = y + h / 2;

            return (
              <G key={`lesion-${i}`}>
                {/* Subtle fill */}
                <Rect
                  x={x} y={y} width={w} height={h}
                  fill="url(#boxGlow)"
                  rx={4}
                />

                {/* Corner brackets — rounded, thicker */}
                {/* Top-left */}
                <Line x1={x1} y1={y1 + 4} x2={x1} y2={y1 + cy} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />
                <Line x1={x1 + 4} y1={y1} x2={x1 + cx} y2={y1} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />

                {/* Top-right */}
                <Line x1={x2 - cx} y1={y1} x2={x2 - 4} y2={y1} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />
                <Line x1={x2} y1={y1 + 4} x2={x2} y2={y1 + cy} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />

                {/* Bottom-left */}
                <Line x1={x1} y1={y2 - cy} x2={x1} y2={y2 - 4} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />
                <Line x1={x1 + 4} y1={y2} x2={x1 + cx} y2={y2} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />

                {/* Bottom-right */}
                <Line x1={x2 - cx} y1={y2} x2={x2 - 4} y2={y2} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />
                <Line x1={x2} y1={y2 - cy} x2={x2} y2={y2 - 4} stroke={PRIMARY_BRIGHT} strokeWidth={STROKE_W} strokeLinecap="round" />

                {/* Thin edge connectors — dashed, subtle */}
                <Line x1={x1 + cx} y1={y1} x2={x2 - cx} y2={y1} stroke={PRIMARY_DIM} strokeWidth={0.5} strokeDasharray="2 6" />
                <Line x1={x1 + cx} y1={y2} x2={x2 - cx} y2={y2} stroke={PRIMARY_DIM} strokeWidth={0.5} strokeDasharray="2 6" />
                <Line x1={x1} y1={y1 + cy} x2={x1} y2={y2 - cy} stroke={PRIMARY_DIM} strokeWidth={0.5} strokeDasharray="2 6" />
                <Line x1={x2} y1={y1 + cy} x2={x2} y2={y2 - cy} stroke={PRIMARY_DIM} strokeWidth={0.5} strokeDasharray="2 6" />

                {/* Center crosshair dot */}
                <Circle cx={centerX} cy={centerY} r={2} fill={PRIMARY} fillOpacity={0.6} />
                <Circle cx={centerX} cy={centerY} r={6} fill="none" stroke={PRIMARY_DIM} strokeWidth={0.5} />

                {/* Label pill */}
                <Rect
                  x={x}
                  y={Math.max(0, y - LABEL_H - 4)}
                  width={Math.max(w, 72)}
                  height={LABEL_H}
                  fill={BG_DARK}
                  rx={9}
                />
                <SvgText
                  x={x + 8}
                  y={Math.max(LABEL_H - 5, y - 8)}
                  fill={PRIMARY}
                  fontSize={9}
                  fontWeight="600"
                  letterSpacing={0.8}
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
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
  },
});
