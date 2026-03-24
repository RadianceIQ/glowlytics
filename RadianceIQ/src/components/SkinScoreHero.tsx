import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Button } from './Button';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Surfaces,
  Shadows,
  Spacing,
} from '../constants/theme';
import type { CompositeSignals } from '../services/skinInsights';

interface Props {
  score: number;
  statusLabel: string;
  actionStatement: string;
  trendDelta: number;
  signals: CompositeSignals;
  onViewResults: () => void;
}

const scoreColor = (score: number) => {
  if (score >= 85) return Colors.success;
  if (score >= 70) return Colors.primary;
  if (score >= 55) return Colors.warning;
  return Colors.error;
};

export const SkinScoreHero: React.FC<Props> = ({
  score,
  statusLabel,
  actionStatement,
  trendDelta,
  signals,
  onViewResults,
}) => {
  const radius = 98;
  const [animatedScore, setAnimatedScore] = useState(0);
  const previousScore = useRef(0);
  const revealMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const from = previousScore.current;
    const to = score;
    const duration = 760;
    const startAt = Date.now();
    let frame = 0;

    const run = () => {
      const elapsed = Date.now() - startAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      setAnimatedScore(value);

      if (progress < 1) {
        frame = requestAnimationFrame(run);
      } else {
        previousScore.current = to;
      }
    };

    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  useEffect(() => {
    revealMotion.setValue(0);
    Animated.timing(revealMotion, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [score, revealMotion]);

  const accent = scoreColor(score);
  const displayScore = Math.round(animatedScore);
  const progressRatio = Math.max(0, Math.min(100, animatedScore)) / 100;
  const arcLength = Math.PI * radius;
  const progressLength = arcLength * progressRatio;
  const gaugeCenterX = 120;
  const gaugeCenterY = 120;
  const gaugePath = `M ${gaugeCenterX - radius} ${gaugeCenterY} A ${radius} ${radius} 0 0 1 ${gaugeCenterX + radius} ${gaugeCenterY}`;

  const trendColor = trendDelta >= 0 ? Colors.success : Colors.error;
  const trendCopy = trendDelta === 0 ? 'No change' : `${trendDelta > 0 ? '+' : ''}${trendDelta} vs baseline`;
  const revealStyle = {
    opacity: revealMotion,
    transform: [
      {
        translateY: revealMotion.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.card}>
      <View style={styles.glow} />
      <Text style={styles.eyebrow}>Overall Skin Score</Text>
      <View style={styles.gaugeWrap}>
        <Svg width={240} height={132}>
          <Defs>
            <LinearGradient id="skinGauge" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={Colors.primaryLight} />
              <Stop offset="100%" stopColor={accent} />
            </LinearGradient>
          </Defs>
          <Path
            d={gaugePath}
            stroke={Colors.divider}
            strokeWidth={14}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={gaugePath}
            stroke="url(#skinGauge)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${arcLength}`}
            fill="none"
          />
        </Svg>
        <View style={styles.centerScore}>
          <Text style={styles.score}>{displayScore}</Text>
          <Text style={styles.scoreLabel}>{statusLabel}</Text>
          <Text style={[styles.trend, { color: trendColor }]}>{trendCopy}</Text>
        </View>
      </View>

      <Text style={styles.actionStatement}>{actionStatement}</Text>

      <Animated.View style={[styles.actions, revealStyle]}>
        <Button title="View latest results" onPress={onViewResults} />
      </Animated.View>

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    ...Surfaces.hero,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  glow: {
    position: 'absolute',
    top: -42,
    right: -28,
    width: 220,
    height: 200,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glowPrimary,
    opacity: 0.45,
  },
  eyebrow: {
    color: Colors.secondaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  gaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 176,
  },
  centerScore: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  score: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.display,
    lineHeight: 52,
  },
  scoreLabel: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  trend: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
  },
  actionStatement: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  actions: {
    gap: Spacing.sm,
  },
});
