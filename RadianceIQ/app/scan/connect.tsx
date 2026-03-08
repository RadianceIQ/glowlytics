import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScannerAnimation } from '../../src/components/ScannerAnimation';
import { useStore } from '../../src/store/useStore';
import { simulateScannerDiscovery, simulateConnection } from '../../src/services/mockScanner';

type Phase = 'gate' | 'instructions' | 'searching' | 'select' | 'confirming' | 'connected' | 'busy';

export default function ConnectScanner() {
  const router = useRouter();
  const { connectScanner, scannerConnected, scannerName } = useStore();
  const protocol = useStore((s) => s.protocol);

  const [phase, setPhase] = useState<Phase>(scannerConnected ? 'connected' : 'gate');
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Skip to scan if already connected
  useEffect(() => {
    if (scannerConnected) {
      setPhase('connected');
    }
  }, []);

  const handleSearch = async () => {
    setPhase('searching');
    const found = await simulateScannerDiscovery();
    setDevices(found);
    setPhase('select');
  };

  const handleConnect = async (device: string) => {
    setSelectedDevice(device);
    setPhase('confirming');
    const success = await simulateConnection(device);
    if (success) {
      connectScanner(device);
      setPhase('connected');
    } else {
      setPhase('busy');
    }
  };

  return (
    <View style={styles.container}>
      {phase === 'gate' && (
        <View style={styles.content}>
          <Text style={styles.title}>Connect your scanner</Text>
          <Text style={styles.subtitle}>
            This scanner connects to one phone at a time.
          </Text>
          <View style={styles.scannerIllustration}>
            <View style={styles.scannerIcon}>
              <Text style={styles.scannerIconText}>~</Text>
            </View>
          </View>
          <Button title="Connect Scanner" onPress={() => setPhase('instructions')} />
          <TouchableOpacity style={styles.troubleshoot}>
            <Text style={styles.troubleshootText}>Troubleshoot</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'instructions' && (
        <View style={styles.content}>
          <Text style={styles.title}>Make scanner available</Text>
          <View style={styles.instructionsList}>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>1</Text>
              <Text style={styles.instructionText}>
                If someone else is connected, ask them to disconnect or turn off Bluetooth.
              </Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>2</Text>
              <Text style={styles.instructionText}>
                Press and hold the scanner button for 3 seconds until it blinks.
              </Text>
            </View>
          </View>
          <Button title="I'm ready" onPress={handleSearch} />
        </View>
      )}

      {phase === 'searching' && (
        <View style={styles.content}>
          <ScannerAnimation phase="searching" />
          <Text style={styles.searchingText}>Searching for nearby scanners...</Text>
        </View>
      )}

      {phase === 'select' && (
        <View style={styles.content}>
          <Text style={styles.title}>Select your scanner</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceItem}
                onPress={() => handleConnect(item)}
              >
                <View style={styles.deviceIcon}>
                  <Text style={styles.deviceIconText}>~</Text>
                </View>
                <View>
                  <Text style={styles.deviceName}>{item}</Text>
                  <Text style={styles.deviceStatus}>Available</Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.deviceList}
          />
        </View>
      )}

      {phase === 'confirming' && (
        <View style={styles.content}>
          <ScannerAnimation
            phase="connecting"
            deviceName={selectedDevice || undefined}
          />
          <Text style={styles.confirmText}>
            Press the scanner button once to confirm
          </Text>
        </View>
      )}

      {phase === 'connected' && (
        <View style={styles.content}>
          <ScannerAnimation phase="complete" />
          <Text style={styles.title}>Connected!</Text>
          <Text style={styles.subtitle}>{scannerName || selectedDevice}</Text>
          <Button
            title="Start Scan"
            onPress={() => router.push('/scan/daily')}
          />
        </View>
      )}

      {phase === 'busy' && (
        <View style={styles.content}>
          <Text style={styles.title}>Scanner is currently in use</Text>
          <Text style={styles.subtitle}>
            Only one phone can connect at a time.
          </Text>
          <View style={styles.busyOptions}>
            <Button title="Try again" onPress={handleSearch} />
            <Button
              title="Show disconnect steps"
              variant="secondary"
              onPress={() => setPhase('instructions')}
            />
          </View>
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
  },
  scannerIllustration: {
    alignItems: 'center',
    marginVertical: Spacing.xxl,
  },
  scannerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerIconText: {
    fontSize: 36,
    color: Colors.primary,
  },
  troubleshoot: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  troubleshootText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },
  instructionsList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  instruction: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansBold,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  instructionText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  searchingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  deviceList: {
    marginVertical: Spacing.lg,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconText: {
    fontSize: 20,
    color: Colors.primary,
  },
  deviceName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  deviceStatus: {
    color: Colors.success,
    fontSize: FontSize.sm,
  },
  confirmText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  busyOptions: {
    gap: Spacing.md,
  },
});
