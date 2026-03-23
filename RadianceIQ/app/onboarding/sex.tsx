import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse, Path } from 'react-native-svg';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { OnboardingOptionCard } from '../../src/components/OnboardingOptionCard';
import { useStore } from '../../src/store/useStore';
import { useOnboardingNavigation } from '../../src/hooks/useOnboardingNavigation';
import { buildOnboardingFlow, screenToRoute } from '../../src/services/onboardingFlow';
import { Colors, FontFamily, FontSize, Spacing } from '../../src/constants/theme';
import type { BiologicalSex } from '../../src/types';

const SEX_OPTIONS: { label: string; value: BiologicalSex }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Intersex / Other', value: 'other' },
];

function SexIllustration() {
  return (
    <Svg width={180} height={160} viewBox="0 0 180 160">
      <Defs>
        <RadialGradient id="clayCenter" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#C5A880" stopOpacity={0.5} />
          <Stop offset="60%" stopColor="#C5A880" stopOpacity={0.15} />
          <Stop offset="100%" stopColor="#C5A880" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="tealWash" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3A9E8F" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#3A9E8F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Background teal wash */}
      <Ellipse cx={90} cy={80} rx={75} ry={65} fill="url(#tealWash)" />
      {/* Clay cellular forms */}
      <Circle cx={70} cy={65} r={28} fill="url(#clayCenter)" />
      <Circle cx={110} cy={85} r={24} fill="url(#clayCenter)" />
      <Circle cx={85} cy={100} r={18} fill="url(#clayCenter)" />
      {/* Cell outlines */}
      <Circle cx={70} cy={65} r={28} fill="none" stroke="#C5A880" strokeWidth={1} strokeOpacity={0.3} />
      <Circle cx={110} cy={85} r={24} fill="none" stroke="#C5A880" strokeWidth={1} strokeOpacity={0.25} />
      <Circle cx={85} cy={100} r={18} fill="none" stroke="#3A9E8F" strokeWidth={0.8} strokeOpacity={0.2} />
      {/* Interconnecting arcs */}
      <Path d="M70 65 Q90 55 110 85" fill="none" stroke="#3A9E8F" strokeWidth={0.8} strokeOpacity={0.2} />
      <Path d="M110 85 Q95 95 85 100" fill="none" stroke="#C5A880" strokeWidth={0.8} strokeOpacity={0.2} />
      {/* Nuclei */}
      <Circle cx={70} cy={65} r={5} fill="#C5A880" fillOpacity={0.5} />
      <Circle cx={110} cy={85} r={4} fill="#C5A880" fillOpacity={0.4} />
      <Circle cx={85} cy={100} r={3.5} fill="#3A9E8F" fillOpacity={0.4} />
      {/* Scattered micro dots */}
      <Circle cx={45} cy={45} r={2} fill="#C5A880" fillOpacity={0.25} />
      <Circle cx={140} cy={60} r={1.5} fill="#3A9E8F" fillOpacity={0.2} />
      <Circle cx={50} cy={120} r={2} fill="#3A9E8F" fillOpacity={0.15} />
      <Circle cx={135} cy={115} r={1.5} fill="#C5A880" fillOpacity={0.2} />
    </Svg>
  );
}

export default function Sex() {
  const router = useRouter();
  const { goBack, onboardingFlow, onboardingFlowIndex } = useOnboardingNavigation();
  const setOnboardingFlowIndex = useStore((s) => s.setOnboardingFlowIndex);
  const setOnboardingFlow = useStore((s) => s.setOnboardingFlow);
  const updateUser = useStore((s) => s.updateUser);

  const [selected, setSelected] = useState<BiologicalSex | null>(null);

  const advanceWithSex = (sex: BiologicalSex) => {
    const periodApplicable = sex === 'female' ? 'yes' : 'no';
    updateUser({ sex, period_applicable: periodApplicable });

    // Rebuild the flow with the selected sex to conditionally include menstrual screens
    const newFlow = buildOnboardingFlow(sex);
    setOnboardingFlow(newFlow);

    // Find our current position in the new flow
    const currentScreenIndex = newFlow.indexOf('sex');
    const nextIndex = currentScreenIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    // Use replace to prevent stale screens in the navigation stack after flow rebuild
    router.replace(screenToRoute(newFlow[nextIndex]) as any);
  };

  const handleContinue = () => {
    if (!selected) return;
    advanceWithSex(selected);
  };

  const handlePreferNot = () => {
    updateUser({ sex: 'prefer_not', period_applicable: 'prefer_not' });
    const newFlow = buildOnboardingFlow('prefer_not');
    setOnboardingFlow(newFlow);
    const currentScreenIndex = newFlow.indexOf('sex');
    const nextIndex = currentScreenIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    router.replace(screenToRoute(newFlow[nextIndex]) as any);
  };

  return (
    <OnboardingTransition
      illustration={<SexIllustration />}
      heading="What's your biological sex?"
      subtext="Hormones play a huge role in how your skin behaves. This helps us read your scores more accurately."
      primaryLabel="Continue"
      primaryOnPress={handleContinue}
      primaryDisabled={!selected}
      secondaryLabel="Prefer not to say"
      secondaryOnPress={handlePreferNot}
      showProgress
      totalSteps={onboardingFlow.length}
      currentStep={onboardingFlowIndex}
      showBack
      onBack={goBack}
    >
      <View style={styles.options}>
        {SEX_OPTIONS.map((opt) => (
          <OnboardingOptionCard
            key={opt.value}
            label={opt.label}
            selected={selected === opt.value}
            onPress={() => setSelected(opt.value)}
          />
        ))}
      </View>
      <Text style={styles.privacy}>
        This stays private and is only used for skin analysis context.
      </Text>
    </OnboardingTransition>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: Spacing.sm,
  },
  privacy: {
    color: Colors.textDim,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 16,
  },
});
