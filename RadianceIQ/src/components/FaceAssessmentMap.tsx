import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../constants/theme';
import type { FaceZoneInsight, SeverityLevel } from '../services/skinInsights';

interface Props {
  zones: FaceZoneInsight[];
  selectedZoneKey: string;
  onSelectZone: (zoneKey: string) => void;
}

const severityColors: Record<SeverityLevel, string> = {
  low: Colors.success,
  moderate: Colors.warning,
  high: Colors.error,
};

export const FaceAssessmentMap: React.FC<Props> = ({
  zones,
  selectedZoneKey,
  onSelectZone,
}) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulse.setValue(0.92);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1.08,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedZoneKey, pulse]);

  return (
    <View style={styles.container}>
      <View style={styles.faceModel}>
        <View style={styles.faceFrame}>
          <View style={styles.eyes}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
          <View style={styles.nose} />
          <View style={styles.mouth} />
        </View>

        {zones.map((zone) => {
          const selected = zone.key === selectedZoneKey;
          const markerTransform = selected
            ? [{ translateX: -14 }, { translateY: -14 }, { scale: pulse }]
            : [{ translateX: -14 }, { translateY: -14 }];

          return (
            <Animated.View
              key={zone.key}
              style={[
                styles.marker,
                {
                  top: `${zone.top}%`,
                  left: `${zone.left}%`,
                  borderColor: severityColors[zone.severity],
                  backgroundColor: selected
                    ? severityColors[zone.severity]
                    : severityColors[zone.severity] + '22',
                  transform: markerTransform,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => onSelectZone(zone.key)}
                activeOpacity={0.8}
                style={styles.markerTouch}
              >
                <Text style={[styles.markerLabel, selected && styles.markerLabelSelected]}>
                  {zone.label.slice(0, 1)}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  faceModel: {
    width: 248,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  faceFrame: {
    width: 190,
    height: 250,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface + '9A',
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  eyes: {
    flexDirection: 'row',
    gap: 42,
    marginTop: Spacing.sm,
  },
  eye: {
    width: 26,
    height: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textMuted + '66',
  },
  nose: {
    width: 10,
    height: 34,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textMuted + '4A',
  },
  mouth: {
    marginTop: Spacing.sm,
    width: 38,
    height: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textMuted + '52',
  },
  marker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  markerLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
  },
  markerLabelSelected: {
    color: '#08111C',
  },
});
