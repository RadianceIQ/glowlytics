import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

          return (
            <TouchableOpacity
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
                  transform: [{ translateX: -14 }, { translateY: -14 }],
                },
              ]}
              onPress={() => onSelectZone(zone.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.markerLabel, selected && styles.markerLabelSelected]}>
                {zone.label.slice(0, 1)}
              </Text>
            </TouchableOpacity>
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
  markerLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
  },
  markerLabelSelected: {
    color: '#08111C',
  },
});
