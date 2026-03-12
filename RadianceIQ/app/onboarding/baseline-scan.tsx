import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScannerAnimation } from '../../src/components/ScannerAnimation';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { getCameraPermissionStatus } from '../../src/services/permissionState';
import { useStore } from '../../src/store/useStore';
import { simulateScanReading, simulatePhotoQualityCheck } from '../../src/services/mockScanner';

type Phase = 'intro' | 'scan' | 'photo' | 'complete';

export default function BaselineScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const protocol = useStore((s) => s.protocol);
  const addDailyRecord = useStore((s) => s.addDailyRecord);
  const addModelOutput = useStore((s) => s.addModelOutput);
  const cameraPermissionStatus = useStore((s) => s.user?.camera_permission_status);
  const updateUser = useStore((s) => s.updateUser);
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('intro');
  const [scannerData, setScannerData] = useState<any>(null);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!permission) return;

    const nextStatus = getCameraPermissionStatus(permission);
    if (cameraPermissionStatus === nextStatus) return;

    updateUser({
      camera_permission_status: nextStatus,
    });
  }, [
    permission?.status,
    permission?.granted,
    permission?.canAskAgain,
    cameraPermissionStatus,
    updateUser,
  ]);

  const handleStartScan = async () => {
    const reading = await simulateScanReading();
    setScannerData(reading);
    setPhase('photo');
  };

  const handleTakePhoto = async () => {
    setPhotoTaken(true);

    // Capture actual photo
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo?.uri) {
          setPhotoUri(photo.uri);
        }
      } catch {
        // Photo capture failed, continue without it
      }
    }

    const quality = await simulatePhotoQualityCheck();

    if (quality.score >= 0.7) {
      // Save baseline record
      const record = addDailyRecord({
        date: new Date().toISOString().split('T')[0],
        scanner_reading_id: `baseline_${Date.now()}`,
        scanner_indices: {
          inflammation_index: scannerData?.inflammation_index ?? 40,
          pigmentation_index: scannerData?.pigmentation_index ?? 30,
          texture_index: scannerData?.texture_index ?? 35,
        },
        scanner_quality_flag: 'pass',
        scan_region: protocol?.scan_region || 'left_cheek',
        photo_uri: photoUri || undefined,
        sunscreen_used: false,
        new_product_added: false,
      });

      // Generate baseline model output
      addModelOutput({
        daily_id: record.daily_id,
        acne_score: Math.round(50 + (scannerData?.inflammation_index ?? 40) * 0.3),
        sun_damage_score: Math.round(40 + (scannerData?.pigmentation_index ?? 30) * 0.3),
        skin_age_score: Math.round(45 + (scannerData?.texture_index ?? 35) * 0.3),
        confidence: 'med',
        primary_driver: 'baseline',
        recommended_action: 'Your baseline is set! Scan daily at the same time for the best trend accuracy.',
        escalation_flag: false,
      });

      setPhase('complete');
    } else {
      setPhotoTaken(false);
    }
  };

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <OnboardingHero
          total={7}
          current={5}
          eyebrow="Step 6 · Baseline"
          title="Take your first scan."
          subtitle="This establishes your personal baseline. All future scores are measured against it."
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next</Text>
          <Text style={styles.infoItem}>1. Scanner reads skin indices (simulated)</Text>
          <Text style={styles.infoItem}>2. Camera captures a reference photo</Text>
          <Text style={styles.infoItem}>3. AI generates your baseline scores</Text>
        </View>

        <View style={styles.footer}>
          {!permission?.granted ? (
            <Button title="Enable Camera & Start" onPress={async () => {
              await requestPermission();
              setPhase('scan');
            }} />
          ) : (
            <Button title="Start Baseline Scan" onPress={() => setPhase('scan')} />
          )}
        </View>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.title}>Camera Access Needed</Text>
          <Text style={styles.subtitle}>
            We need camera access to capture your baseline scan photo.
          </Text>
          <Button title="Grant Camera Access" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {phase === 'scan' && (
        <View style={styles.centeredContent}>
          <Text style={styles.title}>Baseline Scan</Text>
          <Text style={styles.regionReminder}>
            Region: {protocol?.scan_region?.replace(/_/g, ' ')}
          </Text>
          <ScannerAnimation phase="scanning" message="Reading skin indices..." />
          <Button title="Start Scanner" onPress={handleStartScan} />
        </View>
      )}

      {phase === 'photo' && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.boundingBox}>
              <Text style={styles.regionLabel}>
                {protocol?.scan_region?.replace(/_/g, ' ').toUpperCase()}
              </Text>
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
        <View style={styles.centeredContent}>
          <ScannerAnimation phase="complete" />
          <Text style={styles.title}>Baseline captured!</Text>
          <Text style={styles.subtitle}>
            Your personal baseline is set. Future scans will track changes from here.
          </Text>
          <Button
            title="Continue"
            onPress={() => router.push('/onboarding/boost')}
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
    paddingTop: 56,
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  infoTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
    marginBottom: Spacing.xs,
  },
  infoItem: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.sansBold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
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
    fontFamily: FontFamily.sansBold,
    backgroundColor: Colors.background + 'CC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
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
