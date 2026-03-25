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
import { LESION_INFO } from '../constants/lesions';
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

const LESION_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(LESION_INFO).map(([k, v]) => [k, v.color]),
);

const SVG_WIDTH = 310;
const SVG_HEIGHT = 320;

const severityColor = (severity: HotZone['severity'], conditionName?: string) => {
  if (conditionName && CONDITION_COLORS[conditionName]) {
    return CONDITION_COLORS[conditionName];
  }
  switch (severity) {
    case 'elevated': return Colors.error;
    case 'moderate': return Colors.warning;
    case 'low': return Colors.success;
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
              const cx = 150 + (c.cx - 150) * 0.86;
              const color = severityColor(zone.severity, zone.conditionName);
              return (
                <RadialGradient key={`g${i}`} id={`hz${i}`} cx={cx} cy={c.cy} r="48" gradientUnits="userSpaceOnUse">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.5" />
                  <Stop offset="45%" stopColor={color} stopOpacity="0.15" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              );
            })}
          </Defs>

          {/* Face mesh — horizontally compressed for realistic proportions */}
          <G transform="translate(150, 0) scale(0.86, 1) translate(-150, 0)" opacity={0.35}>
            {edges.map(([a, b], i) => (
              <Line key={i} x1={V[a][0]} y1={V[a][1]} x2={V[b][0]} y2={V[b][1]}
                stroke={Colors.primary} strokeWidth={0.6} />
            ))}
          </G>

          {/* Hot zone overlays — compressed to match narrowed mesh */}
          {hotZones.map((zone, i) => {
            const c = regionCenter[zone.region];
            const cx = 150 + (c.cx - 150) * 0.86; // match mesh compression
            const color = severityColor(zone.severity, zone.conditionName);
            return (
              <G key={`hz-${i}`}>
                <Circle cx={cx} cy={c.cy} r={48} fill={`url(#hz${i})`} />
                <Circle cx={cx} cy={c.cy} r={5} fill={color} opacity={0.85} />
                <Circle cx={cx} cy={c.cy} r={12} fill="none" stroke={color} strokeWidth={1.2} opacity={0.5} />
                <Circle cx={cx} cy={c.cy} r={24} fill="none" stroke={color} strokeWidth={0.6} opacity={0.25} strokeDasharray="3 5" />
                {/* Crosshair lines */}
                <Line x1={cx - 16} y1={c.cy} x2={cx - 8} y2={c.cy} stroke={color} strokeWidth={0.6} opacity={0.4} />
                <Line x1={cx + 8} y1={c.cy} x2={cx + 16} y2={c.cy} stroke={color} strokeWidth={0.6} opacity={0.4} />
                <Line x1={cx} y1={c.cy - 16} x2={cx} y2={c.cy - 8} stroke={color} strokeWidth={0.6} opacity={0.4} />
                <Line x1={cx} y1={c.cy + 8} x2={cx} y2={c.cy + 16} stroke={color} strokeWidth={0.6} opacity={0.4} />
              </G>
            );
          })}

          {/* Lesion bounding boxes — corner bracket style, compressed to match mesh */}
          {hasLesions && lesions.map((lesion, i) => {
            const [bx, by, bw, bh] = lesion.bbox;
            const rawX = bx * SVG_WIDTH;
            const x = 150 + (rawX - 150) * 0.86; // match mesh compression
            const y = by * SVG_HEIGHT;
            const w = bw * SVG_WIDTH;
            const h = bh * SVG_HEIGHT;
            const color = LESION_COLORS[lesion.class] || Colors.error;
            const opacity = Math.max(0.4, Math.min(0.9, lesion.confidence));
            const cl = Math.min(w * 0.25, 10);
            const clY = Math.min(h * 0.25, 10);
            const x1 = x, y1 = y, x2 = x + w, y2 = y + h;
            const cx = x + w / 2, cy = y + h / 2;

            return (
              <G key={`lesion-${i}`} opacity={opacity}>
                <Line x1={x1} y1={y1 + 2} x2={x1} y2={y1 + clY} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x1 + 2} y1={y1} x2={x1 + cl} y2={y1} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x2 - cl} y1={y1} x2={x2 - 2} y2={y1} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x2} y1={y1 + 2} x2={x2} y2={y1 + clY} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x1} y1={y2 - clY} x2={x1} y2={y2 - 2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x1 + 2} y1={y2} x2={x1 + cl} y2={y2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x2 - cl} y1={y2} x2={x2 - 2} y2={y2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x2} y1={y2 - clY} x2={x2} y2={y2 - 2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={x1 + cl} y1={y1} x2={x2 - cl} y2={y1} stroke={color} strokeWidth={0.4} strokeDasharray="2 6" opacity={0.5} />
                <Line x1={x1 + cl} y1={y2} x2={x2 - cl} y2={y2} stroke={color} strokeWidth={0.4} strokeDasharray="2 6" opacity={0.5} />
                <Circle cx={cx} cy={cy} r={2} fill={color} opacity={0.7} />
                <Circle cx={cx} cy={cy} r={5} fill="none" stroke={color} strokeWidth={0.5} opacity={0.4} />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legend */}
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
