import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'expo-camera';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Ellipse, Line } from 'react-native-svg';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { useStore } from '../../src/store/useStore';
import { screenToRoute } from '../../src/services/onboardingFlow';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';

function CameraIllustration() {
  return (
    <Svg width={200} height={160} viewBox="0 0 200 160">
      <Defs>
        <RadialGradient id="lensGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3A9E8F" stopOpacity={0.85} />
          <Stop offset="50%" stopColor="#3A9E8F" stopOpacity={0.25} />
          <Stop offset="100%" stopColor="#3A9E8F" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="lensCore" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
          <Stop offset="25%" stopColor="#3A9E8F" stopOpacity={0.8} />
          <Stop offset="60%" stopColor="#3A9E8F" stopOpacity={0.2} />
          <Stop offset="100%" stopColor="#3A9E8F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Outer glow field */}
      <Ellipse cx={100} cy={80} rx={78} ry={68} fill="url(#lensGlow)" />
      {/* Aperture blades - 6 geometric segments */}
      <Path
        d="M100 42 L120 58 L120 80 L100 96 L80 80 L80 58 Z"
        fill="none"
        stroke="#3A9E8F"
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
      <Path
        d="M100 48 L116 61 L116 77 L100 90 L84 77 L84 61 Z"
        fill="none"
        stroke="#3A9E8F"
        strokeWidth={1}
        strokeOpacity={0.35}
      />
      {/* Inner aperture triangles */}
      <Path d="M100 48 L116 61 L100 56 Z" fill="#3A9E8F" fillOpacity={0.12} />
      <Path d="M116 61 L116 77 L108 69 Z" fill="#3A9E8F" fillOpacity={0.1} />
      <Path d="M116 77 L100 90 L108 77 Z" fill="#3A9E8F" fillOpacity={0.08} />
      <Path d="M100 90 L84 77 L92 77 Z" fill="#3A9E8F" fillOpacity={0.1} />
      <Path d="M84 77 L84 61 L92 69 Z" fill="#3A9E8F" fillOpacity={0.12} />
      <Path d="M84 61 L100 48 L92 61 Z" fill="#3A9E8F" fillOpacity={0.1} />
      {/* Crosshair lines */}
      <Line x1={100} y1={35} x2={100} y2={55} stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.3} strokeLinecap="round" />
      <Line x1={100} y1={93} x2={100} y2={113} stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.3} strokeLinecap="round" />
      <Line x1={60} y1={69} x2={80} y2={69} stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.3} strokeLinecap="round" />
      <Line x1={120} y1={69} x2={140} y2={69} stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.3} strokeLinecap="round" />
      {/* Lens core */}
      <Circle cx={100} cy={69} r={14} fill="url(#lensCore)" />
      <Circle cx={100} cy={69} r={5} fill="#3A9E8F" fillOpacity={0.9} />
      {/* Corner brackets */}
      <Path d="M55 40 L55 50 M55 40 L65 40" stroke="#3A9E8F" strokeWidth={1.5} strokeOpacity={0.3} strokeLinecap="round" />
      <Path d="M145 40 L145 50 M145 40 L135 40" stroke="#3A9E8F" strokeWidth={1.5} strokeOpacity={0.3} strokeLinecap="round" />
      <Path d="M55 110 L55 100 M55 110 L65 110" stroke="#3A9E8F" strokeWidth={1.5} strokeOpacity={0.3} strokeLinecap="round" />
      <Path d="M145 110 L145 100 M145 110 L135 110" stroke="#3A9E8F" strokeWidth={1.5} strokeOpacity={0.3} strokeLinecap="round" />
      {/* Accent dots */}
      <Circle cx={50} cy={35} r={2} fill="#3A9E8F" fillOpacity={0.3} />
      <Circle cx={152} cy={32} r={1.5} fill="#3A9E8F" fillOpacity={0.25} />
      <Circle cx={48} cy={120} r={1.5} fill="#3A9E8F" fillOpacity={0.2} />
      <Circle cx={155} cy={118} r={2} fill="#3A9E8F" fillOpacity={0.25} />
    </Svg>
  );
}

export default function CameraPermission() {
  const router = useRouter();
  const { onboardingFlow, onboardingFlowIndex, setOnboardingFlowIndex, updateUser } = useStore();

  const handleEnable = async () => {
    const result = await Camera.requestCameraPermissionsAsync();
    updateUser({
      camera_permission_status: result.granted ? 'granted' : 'denied',
    });

    const nextIndex = onboardingFlowIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    router.push(screenToRoute(onboardingFlow[nextIndex]) as any);
  };

  const handleSkip = () => {
    updateUser({ camera_permission_status: 'not_requested' });

    const nextIndex = onboardingFlowIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    router.push(screenToRoute(onboardingFlow[nextIndex]) as any);
  };

  const handleBack = () => {
    const prevIndex = onboardingFlowIndex - 1;
    setOnboardingFlowIndex(prevIndex);
    router.back();
  };

  return (
    <OnboardingTransition
      illustration={<CameraIllustration />}
      heading="One last thing — we need your camera."
      subtext="Your photos are processed privately and never shared. We don't access your camera in the background."
      primaryLabel="Enable camera access"
      primaryOnPress={handleEnable}
      secondaryLabel="Set up later"
      secondaryOnPress={handleSkip}
      showProgress
      totalSteps={onboardingFlow.length}
      currentStep={onboardingFlowIndex}
      showBack
      onBack={handleBack}
    >
      <View style={styles.trustCard}>
        <View style={styles.trustIconRow}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Path
              d="M10 2L3 6V10C3 14.4 6 18.3 10 19C14 18.3 17 14.4 17 10V6L10 2Z"
              fill="#3A9E8F"
              fillOpacity={0.15}
              stroke="#3A9E8F"
              strokeWidth={1.2}
              strokeOpacity={0.6}
            />
            <Path
              d="M7.5 10L9.5 12L13 8"
              fill="none"
              stroke="#3A9E8F"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.trustTitle}>Privacy-first design</Text>
        </View>
        <Text style={styles.trustBody}>
          Photos stay yours. Glowlytics never accesses your camera in the background. You control when scans happen.
        </Text>
      </View>
    </OnboardingTransition>
  );
}

const styles = StyleSheet.create({
  trustCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 158, 143, 0.15)',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  trustIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trustTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  trustBody: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
