import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Shadows,
  Spacing,
} from '../constants/theme';
import type { DetectedCondition, DetectedLesion, SignalConfidence } from '../types';
import { V, edges } from './meshData';

interface HotZone {
  label: string;
  severity: 'low' | 'moderate' | 'elevated';
  region: 'forehead' | 'left_cheek' | 'right_cheek' | 'nose' | 'chin' | 'jaw' | 'under_eye' | 'temple';
  conditionName?: string;
}

interface Props {
  acneScore: number;
  sunDamageScore: number;
  skinAgeScore: number;
  conditions?: DetectedCondition[];
  lesions?: DetectedLesion[];
  signalConfidence?: SignalConfidence;
}

const CONDITION_COLORS: Record<string, string> = {
  acne: '#FF4444',
  hyperpigmentation: '#F2B56A',
  fine_lines: '#B68AFF',
  rosacea: '#FF7A78',
  dehydration: '#4DA6FF',
  sun_spots: '#FFB347',
  texture_irregularity: '#7DE7E1',
  dark_circles: '#9B8EC4',
  enlarged_pores: '#E8A87C',
};

const LESION_COLORS: Record<string, string> = {
  comedone: '#FFB347',
  papule: '#FF7A78',
  pustule: '#FF4444',
  nodule: '#E63946',
  macule: '#F2B56A',
  patch: '#B68AFF',
};

// SVG viewBox dimensions for coordinate mapping
const SVG_WIDTH = 310;
const SVG_HEIGHT = 320;

const severityColor = (severity: HotZone['severity'], conditionName?: string) => {
  if (conditionName && CONDITION_COLORS[conditionName]) {
    return CONDITION_COLORS[conditionName];
  }
  switch (severity) {
    case 'elevated':
      return Colors.error;
    case 'moderate':
      return Colors.warning;
    case 'low':
      return Colors.success;
  }
};

const CX = 150;

const regionCenter: Record<HotZone['region'], { cx: number; cy: number }> = {
  forehead: { cx: CX, cy: 68 },
  left_cheek: { cx: 80, cy: 180 },
  right_cheek: { cx: 220, cy: 180 },
  nose: { cx: CX, cy: 155 },
  chin: { cx: CX, cy: 285 },
  jaw: { cx: CX, cy: 250 },
  under_eye: { cx: 112, cy: 130 },
  temple: { cx: 55, cy: 100 },
};

function deriveHotZones(acne: number, sun: number, age: number, conditions?: DetectedCondition[]): HotZone[] {
  // When conditions are provided, use them for precise zone mapping
  if (conditions && conditions.length > 0) {
    const zones: HotZone[] = [];
    for (const condition of conditions) {
      for (const zone of condition.zones) {
        const severity: HotZone['severity'] =
          zone.severity === 'severe' ? 'elevated' :
          zone.severity === 'moderate' ? 'moderate' : 'low';
        zones.push({
          label: condition.name.replace(/_/g, ' '),
          severity,
          region: zone.region as HotZone['region'],
          conditionName: condition.name,
        });
      }
    }
    if (zones.length === 0) {
      zones.push({ label: 'All clear', severity: 'low', region: 'nose' });
    }
    return zones;
  }

  // Fallback: threshold-based logic when no conditions data available
  const zones: HotZone[] = [];
  if (acne > 40)
    zones.push({ label: 'Acne activity', severity: acne > 70 ? 'elevated' : 'moderate', region: 'left_cheek' });
  if (acne > 55)
    zones.push({ label: 'Breakout zone', severity: acne > 75 ? 'elevated' : 'moderate', region: 'chin' });
  if (sun > 45)
    zones.push({ label: 'Sun exposure', severity: sun > 70 ? 'elevated' : 'moderate', region: 'forehead' });
  if (sun > 55)
    zones.push({ label: 'Pigmentation', severity: sun > 70 ? 'elevated' : 'moderate', region: 'right_cheek' });
  if (age > 50)
    zones.push({ label: 'Fine lines', severity: age > 70 ? 'elevated' : 'moderate', region: 'nose' });
  if (zones.length === 0)
    zones.push({ label: 'All clear', severity: 'low', region: 'nose' });
  return zones;
}

export const FacialMesh: React.FC<Props> = ({ acneScore, sunDamageScore, skinAgeScore, conditions, lesions, signalConfidence }) => {
  const hotZones = deriveHotZones(acneScore, sunDamageScore, skinAgeScore, conditions);
  const hasLesions = lesions && lesions.length > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Facial Analysis</Text>
      <View style={styles.meshContainer}>
        <Svg width={280} height={290} viewBox="-5 0 310 320">
          <Defs>
            {hotZones.map((zone, i) => {
              const c = regionCenter[zone.region];
              const color = severityColor(zone.severity, zone.conditionName);
              return (
                <RadialGradient key={`g${i}`} id={`hz${i}`} cx={c.cx} cy={c.cy} r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
                  <Stop offset="55%" stopColor={color} stopOpacity="0.18" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              );
            })}
          </Defs>

          {/* Wireframe edges */}
          <G opacity={0.32}>
            {edges.map(([a, b], i) => (
              <Line key={i} x1={V[a][0]} y1={V[a][1]} x2={V[b][0]} y2={V[b][1]}
                stroke={Colors.primaryLight} strokeWidth={0.6} />
            ))}
          </G>

          {/* Vertices — brighter at key landmarks */}
          <G>
            {V.map(([x, y], i) => {
              // Key landmark vertices get brighter dots
              const isContour = i <= 23;
              const isEye = (i >= 50 && i <= 69);
              const isNose = (i >= 70 && i <= 83);
              const isLip = (i >= 111 && i <= 127);
              const bright = isContour || isEye || isNose || isLip;
              return (
                <Circle key={i} cx={x} cy={y}
                  r={bright ? 1.5 : 1.0}
                  fill={Colors.primaryLight}
                  opacity={bright ? 0.6 : 0.3}
                />
              );
            })}
          </G>

          {/* Left pupil */}
          <Circle cx={V[59][0]} cy={V[59][1]} r={6} fill="none" stroke={Colors.primaryLight} strokeWidth={0.5} opacity={0.2} />
          <Circle cx={V[59][0]} cy={V[59][1]} r={2.5} fill={Colors.primaryLight} opacity={0.15} />
          {/* Right pupil */}
          <Circle cx={V[69][0]} cy={V[69][1]} r={6} fill="none" stroke={Colors.primaryLight} strokeWidth={0.5} opacity={0.2} />
          <Circle cx={V[69][0]} cy={V[69][1]} r={2.5} fill={Colors.primaryLight} opacity={0.15} />

          {/* Hot zone overlays */}
          {hotZones.map((zone, i) => {
            const c = regionCenter[zone.region];
            const color = severityColor(zone.severity, zone.conditionName);
            return (
              <G key={`hz-${i}`}>
                <Circle cx={c.cx} cy={c.cy} r={50} fill={`url(#hz${i})`} />
                <Circle cx={c.cx} cy={c.cy} r={5} fill={color} opacity={0.9} />
                <Circle cx={c.cx} cy={c.cy} r={11} fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
                <Circle cx={c.cx} cy={c.cy} r={22} fill="none" stroke={color} strokeWidth={0.5} opacity={0.2} strokeDasharray="3 4" />
              </G>
            );
          })}

          {/* Lesion bounding boxes from YOLOv8 detector */}
          {hasLesions && lesions.map((lesion, i) => {
            const [bx, by, bw, bh] = lesion.bbox;
            const x = bx * SVG_WIDTH;
            const y = by * SVG_HEIGHT;
            const w = bw * SVG_WIDTH;
            const h = bh * SVG_HEIGHT;
            const color = LESION_COLORS[lesion.class] || Colors.error;
            const opacity = Math.max(0.3, Math.min(0.8, lesion.confidence));
            return (
              <G key={`lesion-${i}`}>
                <Rect
                  x={x} y={y} width={w} height={h}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2}
                  opacity={opacity}
                  strokeDasharray="4 2"
                />
                <Circle
                  cx={x + w / 2} cy={y + h / 2}
                  r={2}
                  fill={color}
                  opacity={opacity}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        {hotZones.map((zone, i) => {
          const color = severityColor(zone.severity, zone.conditionName);
          const displayLabel = zone.label.charAt(0).toUpperCase() + zone.label.slice(1);
          return (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{displayLabel}</Text>
              <Text style={[styles.legendSeverity, { color }]}>
                {zone.severity}
              </Text>
            </View>
          );
        })}
        {hasLesions && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.legendLabel}>
              {lesions.length} lesion{lesions.length !== 1 ? 's' : ''} detected
            </Text>
            <Text style={[styles.legendSeverity, { color: Colors.error }]}>
              {lesions.filter(l => l.confidence > 0.7).length} high conf
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.lg,
    overflow: 'visible',
    ...Shadows.card,
  },
  eyebrow: {
    color: Colors.secondaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  meshContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    overflow: 'visible',
  },
  legend: {
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  legendSeverity: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
