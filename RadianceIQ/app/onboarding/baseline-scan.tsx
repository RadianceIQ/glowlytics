import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScannerAnimation } from '../../src/components/ScannerAnimation';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';
import { simulateScanReading, simulatePhotoQualityCheck } from '../../src/services/mockScanner';
import { analyzeSkiN } from '../../src/services/skinAnalysis';

type Phase = 'connect' | 'scanning' | 'photo' | 'analyzing' | 'complete';

export default function BaselineScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const store = useStore();
  const protocol = useStore((s) => s.protocol);
  const user = useStore((s) => s.user);

  const [phase, setPhase] = useState<Phase>('connect');
  const [scannerData, setScannerData] = useState<any>(null);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [qualityCheck, setQualityCheck] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const cameraRef = useRef<any>(null);

  const handleConnect = async () => {
    setPhase('scanning');
    // Simulate scanner reading
    const reading = await simulateScanReading();
    setScannerData(reading);
    setPhase('photo');
  };

  const handleTakePhoto = async () => {
    setPhotoTaken(true);
    const quality = await simulatePhotoQualityCheck();
    setQualityCheck(quality);

    if (quality.score >= 0.7) {
      setPhase('analyzing');
      // Run analysis
      if (user && protocol) {
        const analysis = await analyzeSkiN({
          scannerData,
          userProfile: user,
          protocol,
          previousOutputs: [],
          dailyContext: {
            sunscreen_used: true,
            new_product_added: false,
          },
        });

        const dailyRecord = store.addDailyRecord({
          date: new Date().toISOString().split('T')[0],
          scanner_reading_id: `baseline_${Date.now()}`,
          scanner_indices: scannerData,
          scanner_quality_flag: 'pass',
          scan_region: protocol.scan_region,
          sunscreen_used: true,
          new_product_added: false,
        });

        store.addModelOutput({
          daily_id: dailyRecord.daily_id,
          ...analysis,
        });

        setResults(analysis);
        setPhase('complete');
      }
    } else {
      // Photo quality too low, let them retry
      setPhotoTaken(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <ProgressDots total={6} current={4} />
        <Text style={styles.title}>Camera Access</Text>
        <Text style={styles.subtitle}>
          We need camera access to capture your skin scan photos.
        </Text>
        <Button title="Grant Camera Access" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProgressDots total={6} current={4} />

      {phase === 'connect' && (
        <View style={styles.content}>
          <Text style={styles.title}>Baseline Scan</Text>
          <Text style={styles.subtitle}>
            Let's capture your first scan to establish your baseline.
          </Text>
          <ScannerAnimation phase="searching" />
          <Button title="Connect Scanner" onPress={handleConnect} />
          <Text style={styles.hint}>
            Scanning region: {protocol?.scan_region?.replace(/_/g, ' ')}
          </Text>
        </View>
      )}

      {phase === 'scanning' && (
        <View style={styles.content}>
          <Text style={styles.title}>Reading Scanner...</Text>
          <ScannerAnimation phase="scanning" message="Hold steady..." />
        </View>
      )}

      {phase === 'photo' && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            {/* Bounding box overlay */}
            <View style={styles.overlay}>
              <View style={styles.boundingBox}>
                <Text style={styles.regionLabel}>
                  {protocol?.scan_region?.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Quality indicators */}
            {qualityCheck && !qualityCheck.centered && (
              <View style={styles.tipBanner}>
                <Text style={styles.tipText}>Center your face in the frame</Text>
              </View>
            )}

            <View style={styles.cameraControls}>
              {!photoTaken ? (
                <>
                  <View style={styles.qualityIndicators}>
                    <Text style={styles.qualityItem}>
                      {qualityCheck?.lighting !== false ? 'OK' : '!'} Lighting
                    </Text>
                    <Text style={styles.qualityItem}>
                      {qualityCheck?.centered !== false ? 'OK' : '!'} Centered
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                    <View style={styles.captureInner} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.processingOverlay}>
                  <Text style={styles.processingText}>Checking quality...</Text>
                </View>
              )}
            </View>
          </CameraView>
        </View>
      )}

      {phase === 'analyzing' && (
        <View style={styles.content}>
          <Text style={styles.title}>Analyzing...</Text>
          <ScannerAnimation phase="scanning" message="Processing your baseline..." />
        </View>
      )}

      {phase === 'complete' && results && (
        <View style={styles.content}>
          <ScannerAnimation phase="complete" />
          <Text style={styles.title}>Baseline Captured!</Text>

          <View style={styles.resultsPreview}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Acne</Text>
              <Text style={[styles.resultScore, { color: Colors.acne }]}>{results.acne_score}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Sun Damage</Text>
              <Text style={[styles.resultScore, { color: Colors.sunDamage }]}>{results.sun_damage_score}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Skin Age</Text>
              <Text style={[styles.resultScore, { color: Colors.skinAge }]}>{results.skin_age_score}</Text>
            </View>
          </View>

          <Text style={styles.trendNote}>Trend starts after 3 scans</Text>

          <Button
            title="Save Baseline"
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
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.lg,
    textTransform: 'capitalize',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
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
  },
  tipBanner: {
    position: 'absolute',
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.warning + 'DD',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  tipText: {
    color: Colors.background,
    fontSize: FontSize.sm,
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
    color: Colors.text,
    fontSize: FontSize.xs,
    backgroundColor: Colors.background + 'AA',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
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
  processingOverlay: {
    backgroundColor: Colors.background + 'CC',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  processingText: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  resultsPreview: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  resultScore: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  trendNote: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
});
