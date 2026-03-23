import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { OnboardingGridOption } from '../../src/components/OnboardingOptionCard';
import { useStore } from '../../src/store/useStore';
import { useOnboardingNavigation } from '../../src/hooks/useOnboardingNavigation';
import { Spacing } from '../../src/constants/theme';

const AGE_OPTIONS = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55+',
] as const;

function AgeIllustration() {
  return (
    <Svg width={180} height={160} viewBox="0 0 180 160">
      <Defs>
        <RadialGradient id="ageCenter" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3A9E8F" stopOpacity={0.6} />
          <Stop offset="100%" stopColor="#3A9E8F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Concentric rings */}
      <Circle cx={90} cy={80} r={70} fill="none" stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.1} />
      <Circle cx={90} cy={80} r={58} fill="none" stroke="#3A9E8F" strokeWidth={1.2} strokeOpacity={0.15} />
      <Circle cx={90} cy={80} r={46} fill="none" stroke="#3A9E8F" strokeWidth={1.5} strokeOpacity={0.22} />
      <Circle cx={90} cy={80} r={34} fill="none" stroke="#3A9E8F" strokeWidth={1.8} strokeOpacity={0.3} />
      <Circle cx={90} cy={80} r={22} fill="none" stroke="#3A9E8F" strokeWidth={2} strokeOpacity={0.4} />
      <Circle cx={90} cy={80} r={10} fill="url(#ageCenter)" />
      {/* Center dot */}
      <Circle cx={90} cy={80} r={4} fill="#3A9E8F" fillOpacity={0.8} />
      {/* Ring intersect dots */}
      <Circle cx={90} cy={10} r={2.5} fill="#3A9E8F" fillOpacity={0.3} />
      <Circle cx={148} cy={80} r={2} fill="#3A9E8F" fillOpacity={0.25} />
      <Circle cx={32} cy={80} r={2} fill="#3A9E8F" fillOpacity={0.2} />
      <Circle cx={90} cy={150} r={2.5} fill="#3A9E8F" fillOpacity={0.3} />
      <Circle cx={136} cy={46} r={1.5} fill="#3A9E8F" fillOpacity={0.2} />
      <Circle cx={44} cy={114} r={1.5} fill="#3A9E8F" fillOpacity={0.2} />
    </Svg>
  );
}

export default function AgeRange() {
  const { advance, goBack, onboardingFlow, onboardingFlowIndex } = useOnboardingNavigation();
  const updateUser = useStore((s) => s.updateUser);

  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    updateUser({ age_range: selected });
    advance();
  };

  const handleSkip = () => {
    advance();
  };

  return (
    <OnboardingTransition
      illustration={<AgeIllustration />}
      heading="First up — how old are you?"
      subtext="Your skin changes a lot decade to decade. This helps us set the right baseline for you."
      primaryLabel="Continue"
      primaryOnPress={handleContinue}
      primaryDisabled={!selected}
      secondaryLabel="Skip"
      secondaryOnPress={handleSkip}
      showProgress
      totalSteps={onboardingFlow.length}
      currentStep={onboardingFlowIndex}
      showBack
      onBack={goBack}
    >
      <View style={styles.grid}>
        {AGE_OPTIONS.map((age) => (
          <View key={age} style={styles.gridItem}>
            <OnboardingGridOption
              label={age}
              selected={selected === age}
              onPress={() => setSelected(age)}
            />
          </View>
        ))}
      </View>
    </OnboardingTransition>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    width: '48%',
  },
});
