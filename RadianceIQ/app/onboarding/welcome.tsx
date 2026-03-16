import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse } from 'react-native-svg';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { useStore } from '../../src/store/useStore';
import { buildOnboardingFlow, screenToRoute } from '../../src/services/onboardingFlow';
import { trackEvent } from '../../src/services/analytics';

function WelcomeIllustration() {
  return (
    <Svg width={200} height={160} viewBox="0 0 200 160">
      <Defs>
        <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#7DE7E1" stopOpacity={0.9} />
          <Stop offset="55%" stopColor="#7DE7E1" stopOpacity={0.3} />
          <Stop offset="100%" stopColor="#7DE7E1" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="purpleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8A95FF" stopOpacity={0.7} />
          <Stop offset="60%" stopColor="#8A95FF" stopOpacity={0.2} />
          <Stop offset="100%" stopColor="#8A95FF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
          <Stop offset="30%" stopColor="#7DE7E1" stopOpacity={0.8} />
          <Stop offset="70%" stopColor="#7DE7E1" stopOpacity={0.15} />
          <Stop offset="100%" stopColor="#7DE7E1" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Outer purple halo */}
      <Ellipse cx={115} cy={80} rx={80} ry={70} fill="url(#purpleGlow)" />
      {/* Mid teal glow */}
      <Circle cx={100} cy={80} r={60} fill="url(#orbGlow)" />
      {/* Orbiting ring 1 */}
      <Circle cx={100} cy={80} r={48} fill="none" stroke="#7DE7E1" strokeWidth={1} strokeOpacity={0.25} />
      {/* Orbiting ring 2 */}
      <Circle cx={100} cy={80} r={36} fill="none" stroke="#8A95FF" strokeWidth={0.8} strokeOpacity={0.2} />
      {/* Core orb */}
      <Circle cx={100} cy={80} r={22} fill="url(#coreGlow)" />
      {/* Inner bright dot */}
      <Circle cx={100} cy={80} r={6} fill="#7DE7E1" fillOpacity={0.9} />
      {/* Accent dots */}
      <Circle cx={60} cy={50} r={3} fill="#8A95FF" fillOpacity={0.5} />
      <Circle cx={145} cy={55} r={2.5} fill="#7DE7E1" fillOpacity={0.4} />
      <Circle cx={55} cy={110} r={2} fill="#7DE7E1" fillOpacity={0.3} />
      <Circle cx={150} cy={105} r={3.5} fill="#8A95FF" fillOpacity={0.35} />
    </Svg>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { createUser, setOnboardingFlow, setOnboardingFlowIndex } = useStore();

  const handleStart = () => {
    trackEvent('onboarding_started');
    createUser({});
    const flow = buildOnboardingFlow();
    setOnboardingFlow(flow);
    setOnboardingFlowIndex(0);
    const nextIndex = 1;
    setOnboardingFlowIndex(nextIndex);
    router.push(screenToRoute(flow[nextIndex]));
  };

  const handleSkip = () => {
    trackEvent('onboarding_skipped');
    createUser({ onboarding_complete: true });
    router.replace('/(tabs)/today' as any);
  };

  return (
    <OnboardingTransition
      illustration={<WelcomeIllustration />}
      heading="A few questions to make this yours."
      subtext="Glowlytics adapts to your skin, your lifestyle, and your goals. This takes under two minutes."
      primaryLabel="Let's go"
      primaryOnPress={handleStart}
      secondaryLabel="I'll set this up later"
      secondaryOnPress={handleSkip}
      showProgress={false}
    >
      <View />
    </OnboardingTransition>
  );
}
