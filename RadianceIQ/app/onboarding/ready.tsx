import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { useStore } from '../../src/store/useStore';
import { trackEvent } from '../../src/services/analytics';

const AnimatedView = Animated.View;

function ReadyIllustration() {
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <AnimatedView style={pulseStyle}>
      <Svg width={220} height={180} viewBox="0 0 220 180">
        <Defs>
          <RadialGradient id="readyOuterGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F2B56A" stopOpacity={0.35} />
            <Stop offset="40%" stopColor="#F2B56A" stopOpacity={0.12} />
            <Stop offset="70%" stopColor="#7DE7E1" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#7DE7E1" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="readyMidGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#7DE7E1" stopOpacity={0.8} />
            <Stop offset="35%" stopColor="#7DE7E1" stopOpacity={0.45} />
            <Stop offset="65%" stopColor="#39B5BF" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#39B5BF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="readyInnerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="20%" stopColor="#C7FFFA" stopOpacity={0.6} />
            <Stop offset="45%" stopColor="#7DE7E1" stopOpacity={0.4} />
            <Stop offset="100%" stopColor="#7DE7E1" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="readyGoldRing" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F2B56A" stopOpacity={0.5} />
            <Stop offset="60%" stopColor="#F2B56A" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#F2B56A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="readyCoreWhite" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="40%" stopColor="#C7FFFA" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#7DE7E1" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Outermost warm glow */}
        <Ellipse cx={110} cy={90} rx={100} ry={85} fill="url(#readyOuterGlow)" />
        {/* Gold ring aura */}
        <Ellipse cx={110} cy={90} rx={72} ry={65} fill="url(#readyGoldRing)" />
        {/* Main teal orb field */}
        <Circle cx={110} cy={90} r={58} fill="url(#readyMidGlow)" />
        {/* Orbital ring 1 - gold */}
        <Circle cx={110} cy={90} r={52} fill="none" stroke="#F2B56A" strokeWidth={1} strokeOpacity={0.25} />
        {/* Orbital ring 2 - teal */}
        <Circle cx={110} cy={90} r={42} fill="none" stroke="#7DE7E1" strokeWidth={1.2} strokeOpacity={0.3} />
        {/* Orbital ring 3 - inner teal */}
        <Circle cx={110} cy={90} r={32} fill="none" stroke="#C7FFFA" strokeWidth={0.8} strokeOpacity={0.2} />
        {/* Inner glow sphere */}
        <Circle cx={110} cy={90} r={24} fill="url(#readyInnerGlow)" />
        {/* Core bright point */}
        <Circle cx={110} cy={90} r={10} fill="url(#readyCoreWhite)" />
        <Circle cx={110} cy={90} r={4} fill="#FFFFFF" fillOpacity={0.95} />
        {/* Accent orbiting particles - gold */}
        <Circle cx={55} cy={55} r={3} fill="#F2B56A" fillOpacity={0.5} />
        <Circle cx={168} cy={60} r={2.5} fill="#F2B56A" fillOpacity={0.4} />
        <Circle cx={50} cy={120} r={2} fill="#F2B56A" fillOpacity={0.3} />
        <Circle cx={172} cy={115} r={3} fill="#F2B56A" fillOpacity={0.35} />
        {/* Accent orbiting particles - teal */}
        <Circle cx={70} cy={38} r={2} fill="#7DE7E1" fillOpacity={0.45} />
        <Circle cx={155} cy={42} r={2.5} fill="#7DE7E1" fillOpacity={0.4} />
        <Circle cx={65} cy={140} r={2.5} fill="#7DE7E1" fillOpacity={0.3} />
        <Circle cx={160} cy={135} r={2} fill="#7DE7E1" fillOpacity={0.35} />
        <Circle cx={110} cy={30} r={2} fill="#C7FFFA" fillOpacity={0.3} />
        <Circle cx={110} cy={150} r={1.5} fill="#C7FFFA" fillOpacity={0.25} />
        {/* Extra shimmer dots */}
        <Circle cx={85} cy={160} r={1.5} fill="#F2B56A" fillOpacity={0.2} />
        <Circle cx={140} cy={25} r={1.5} fill="#7DE7E1" fillOpacity={0.2} />
      </Svg>
    </AnimatedView>
  );
}

export default function Ready() {
  const router = useRouter();
  const { updateUser } = useStore();

  const handleBaseline = () => {
    trackEvent('onboarding_completed', { chose_baseline_scan: true });
    updateUser({ onboarding_complete: true });
    router.replace('/scan/camera' as any);
  };

  const handleExplore = () => {
    trackEvent('onboarding_completed', { chose_baseline_scan: false });
    updateUser({ onboarding_complete: true });
    router.replace('/(tabs)/today' as any);
  };

  return (
    <OnboardingTransition
      illustration={<ReadyIllustration />}
      heading="You're ready to start tracking."
      subtext="Your first scan sets your baseline. Everything that follows is measured against it -- that's where the real insight begins."
      primaryLabel="Take my baseline scan"
      primaryOnPress={handleBaseline}
      secondaryLabel="Explore first"
      secondaryOnPress={handleExplore}
      showProgress={false}
    >
      {/* No interactive content on the ready screen */}
      <View />
    </OnboardingTransition>
  );
}
