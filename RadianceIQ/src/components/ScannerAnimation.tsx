import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius, FontSize, FontFamily, Spacing } from '../constants/theme';

interface Props {
  phase: 'searching' | 'connecting' | 'scanning' | 'complete' | 'error';
  deviceName?: string;
  message?: string;
}

export const ScannerAnimation: React.FC<Props> = ({ phase, deviceName, message }) => {
  const [pulseAnim] = useState(new Animated.Value(0.3));
  const [spinAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (phase === 'searching' || phase === 'connecting' || phase === 'scanning') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        ])
      );
      const spin = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      );
      pulse.start();
      spin.start();
      return () => { pulse.stop(); spin.stop(); };
    }
  }, [phase]);

  const phaseConfig = {
    searching: { icon: '...', text: 'Searching for scanner...', color: Colors.info },
    connecting: { icon: '~', text: `Connecting to ${deviceName || 'scanner'}...`, color: Colors.primary },
    scanning: { icon: '*', text: message || 'Hold steady...', color: Colors.primary },
    complete: { icon: 'OK', text: 'Scan complete!', color: Colors.success },
    error: { icon: '!', text: message || 'Connection failed', color: Colors.error },
  };

  const config = phaseConfig[phase];

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.circle,
        { borderColor: config.color, opacity: pulseAnim },
      ]}>
        <Animated.View style={[
          styles.innerCircle,
          { backgroundColor: config.color + '20' },
        ]}>
          <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
        </Animated.View>
      </Animated.View>
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
      {phase === 'scanning' && (
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, {
            backgroundColor: config.color,
            opacity: pulseAnim,
          }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  innerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: FontSize.hero,
    fontFamily: FontFamily.sansBold,
  },
  text: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansSemiBold,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    width: '60%',
    height: '100%',
    borderRadius: 2,
  },
});
