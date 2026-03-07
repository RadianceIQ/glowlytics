import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScannerAnimation } from '../../src/components/ScannerAnimation';
import { useStore } from '../../src/store/useStore';
import { simulateScanReading, simulatePhotoQualityCheck } from '../../src/services/mockScanner';

type Phase = 'scan' | 'photo' | 'complete';

export default function DailyScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const protocol = useStore((s) => s.protocol);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const cameraRef = useRef<any>(null);

  const [phase, setPhase] = useState<Phase>('scan');
  const [scannerData, setScannerData] = useState<any>(null);
  const [photoTaken, setPhotoTaken] = useState(false);

  const baselineRecord = dailyRecords.length > 0 ? dailyRecords[0] : null;

  const handleStartScan = async () => {
    const reading = await simulateScanReading(
      baselineRecord?.scanner_indices || undefined
    );
    setScannerData(reading);
    setPhase('photo');
  };

  const handleTakePhoto = async () => {
    setPhotoTaken(true);
    const quality = await simulatePhotoQualityCheck();

    if (quality.score >= 0.7) {
      setPhase('complete');
    } else {
      setPhotoTaken(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Access Needed</Text>
        <Button title="Grant Camera Access" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {phase === 'scan' && (
        <View style={styles.content}>
          <Text style={styles.title}>Daily Scan</Text>
          <Text style={styles.regionReminder}>
            Scan the same region: {protocol?.scan_region?.replace(/_/g, ' ')}
          </Text>
          <ScannerAnimation phase="scanning" message="Hold steady..." />
          <Button title="Start Reading" onPress={handleStartScan} />
        </View>
      )}

      {phase === 'photo' && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
          />
          {/* Overlay as sibling, not child of CameraView */}
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.boundingBox}>
              <Text style={styles.regionLabel}>
                {protocol?.scan_region?.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <View style={styles.baselineOverlay}>
              <Text style={styles.baselineText}>Match baseline framing</Text>
            </View>
          </View>

          <View style={styles.cameraControls}>
            <View style={styles.qualityIndicators}>
              <Text style={styles.qualityItem}>OK Lighting</Text>
              <Text style={styles.qualityItem}>OK Centered</Text>
              <Text style={styles.qualityItem}>OK Focus</Text>
            </View>
            {!photoTaken ? (
              <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.processingText}>Checking quality...</Text>
            )}
          </View>
        </View>
      )}

      {phase === 'complete' && (
        <View style={styles.content}>
          <ScannerAnimation phase="complete" />
          <Text style={styles.title}>Scan captured!</Text>
          <Button
            title="Continue to check-in"
            onPress={() => router.push({
              pathname: '/scan/checkin',
              params: {
                inflammation: scannerData?.inflammation_index?.toString() || '40',
                pigmentation: scannerData?.pigmentation_index?.toString() || '30',
                texture: scannerData?.texture_index?.toString() || '35',
              },
            })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  regionReminder: {
    fontSize: FontSize.md,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    textTransform: 'capitalize',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boundingBox: {
    width: 200,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.md,
  },
  regionLabel: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    backgroundColor: Colors.background + 'CC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  baselineOverlay: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  baselineText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  qualityIndicators: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  qualityItem: {
    color: Colors.success,
    fontSize: FontSize.xs,
    backgroundColor: Colors.background + 'AA',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
  },
  processingText: {
    color: Colors.text,
    fontSize: FontSize.md,
    backgroundColor: Colors.background + 'CC',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
});
