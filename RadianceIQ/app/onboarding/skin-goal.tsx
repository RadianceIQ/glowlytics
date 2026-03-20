import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse, Path } from 'react-native-svg';
import { OnboardingTransition } from '../../src/components/OnboardingTransition';
import { OnboardingOptionCard } from '../../src/components/OnboardingOptionCard';
import { useStore } from '../../src/store/useStore';
import { screenToRoute } from '../../src/services/onboardingFlow';
import { Spacing } from '../../src/constants/theme';
import type { PrimaryGoal, ScanRegion } from '../../src/types';

interface GoalOption {
  label: string;
  description: string;
  value: PrimaryGoal;
  defaultRegion: ScanRegion;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    label: 'Acne & Breakouts',
    description: 'Track inflammation, active breakouts, and day-to-day clarity',
    value: 'acne',
    defaultRegion: 'whole_face',
  },
  {
    label: 'Sun Damage & Pigmentation',
    description: 'Monitor UV-related changes and visible pigmentation over time',
    value: 'sun_damage',
    defaultRegion: 'forehead',
  },
  {
    label: 'Aging & Texture',
    description: 'Follow fine lines, elasticity, and skin vitality trends',
    value: 'skin_age',
    defaultRegion: 'crows_feet',
  },
];

function AcneIllustration() {
  return (
    <Svg width={160} height={140} viewBox="0 0 160 140">
      <Defs>
        <RadialGradient id="acneGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#D15A57" stopOpacity={0.5} />
          <Stop offset="70%" stopColor="#D15A57" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#D15A57" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={80} cy={70} r={50} fill="url(#acneGlow)" />
      <Circle cx={80} cy={70} r={38} fill="none" stroke="#D15A57" strokeWidth={1} strokeOpacity={0.3} />
      <Circle cx={80} cy={70} r={26} fill="none" stroke="#D15A57" strokeWidth={1.2} strokeOpacity={0.35} />
      <Circle cx={65} cy={55} r={6} fill="#D15A57" fillOpacity={0.35} />
      <Circle cx={95} cy={60} r={4.5} fill="#D15A57" fillOpacity={0.3} />
      <Circle cx={75} cy={85} r={5} fill="#D15A57" fillOpacity={0.28} />
      <Circle cx={90} cy={80} r={3.5} fill="#D15A57" fillOpacity={0.25} />
      <Circle cx={80} cy={70} r={3} fill="#D15A57" fillOpacity={0.5} />
      <Circle cx={50} cy={45} r={2} fill="#D15A57" fillOpacity={0.15} />
      <Circle cx={115} cy={90} r={2} fill="#D15A57" fillOpacity={0.15} />
    </Svg>
  );
}

function SunDamageIllustration() {
  return (
    <Svg width={160} height={140} viewBox="0 0 160 140">
      <Defs>
        <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#B88C3E" stopOpacity={0.5} />
          <Stop offset="70%" stopColor="#B88C3E" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#B88C3E" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={80} cy={70} r={50} fill="url(#sunGlow)" />
      <Circle cx={80} cy={70} r={30} fill="none" stroke="#B88C3E" strokeWidth={1} strokeOpacity={0.25} />
      {/* Sun rays */}
      <Path d="M80 30 L80 18" stroke="#B88C3E" strokeWidth={1.5} strokeOpacity={0.35} strokeLinecap="round" />
      <Path d="M80 122 L80 110" stroke="#B88C3E" strokeWidth={1.5} strokeOpacity={0.35} strokeLinecap="round" />
      <Path d="M38 70 L26 70" stroke="#B88C3E" strokeWidth={1.5} strokeOpacity={0.35} strokeLinecap="round" />
      <Path d="M134 70 L122 70" stroke="#B88C3E" strokeWidth={1.5} strokeOpacity={0.35} strokeLinecap="round" />
      <Path d="M51 41 L43 33" stroke="#B88C3E" strokeWidth={1.2} strokeOpacity={0.25} strokeLinecap="round" />
      <Path d="M109 99 L117 107" stroke="#B88C3E" strokeWidth={1.2} strokeOpacity={0.25} strokeLinecap="round" />
      <Path d="M109 41 L117 33" stroke="#B88C3E" strokeWidth={1.2} strokeOpacity={0.25} strokeLinecap="round" />
      <Path d="M51 99 L43 107" stroke="#B88C3E" strokeWidth={1.2} strokeOpacity={0.25} strokeLinecap="round" />
      <Circle cx={80} cy={70} r={14} fill="#B88C3E" fillOpacity={0.25} />
      <Circle cx={80} cy={70} r={5} fill="#B88C3E" fillOpacity={0.5} />
    </Svg>
  );
}

function SkinAgeIllustration() {
  return (
    <Svg width={160} height={140} viewBox="0 0 160 140">
      <Defs>
        <RadialGradient id="ageBlue" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#4B7FCC" stopOpacity={0.5} />
          <Stop offset="70%" stopColor="#4B7FCC" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#4B7FCC" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={80} cy={70} r={50} fill="url(#ageBlue)" />
      {/* Texture waves */}
      <Path d="M30 55 Q55 45 80 55 Q105 65 130 55" fill="none" stroke="#4B7FCC" strokeWidth={0.8} strokeOpacity={0.2} />
      <Path d="M30 70 Q55 60 80 70 Q105 80 130 70" fill="none" stroke="#4B7FCC" strokeWidth={1} strokeOpacity={0.25} />
      <Path d="M30 85 Q55 75 80 85 Q105 95 130 85" fill="none" stroke="#4B7FCC" strokeWidth={0.8} strokeOpacity={0.2} />
      {/* Elasticity curves */}
      <Ellipse cx={80} cy={70} rx={28} ry={20} fill="none" stroke="#4B7FCC" strokeWidth={1.2} strokeOpacity={0.3} />
      <Circle cx={80} cy={70} r={10} fill="#4B7FCC" fillOpacity={0.2} />
      <Circle cx={80} cy={70} r={4} fill="#4B7FCC" fillOpacity={0.45} />
      <Circle cx={55} cy={50} r={1.5} fill="#4B7FCC" fillOpacity={0.2} />
      <Circle cx={110} cy={90} r={1.5} fill="#4B7FCC" fillOpacity={0.2} />
    </Svg>
  );
}

const ILLUSTRATIONS: Record<PrimaryGoal, React.ReactNode> = {
  acne: <AcneIllustration />,
  sun_damage: <SunDamageIllustration />,
  skin_age: <SkinAgeIllustration />,
};

// Default illustration when nothing is selected
function DefaultGoalIllustration() {
  return (
    <Svg width={160} height={140} viewBox="0 0 160 140">
      <Defs>
        <RadialGradient id="defaultGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3A9E8F" stopOpacity={0.4} />
          <Stop offset="70%" stopColor="#3A9E8F" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#3A9E8F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={80} cy={70} r={50} fill="url(#defaultGlow)" />
      <Circle cx={80} cy={70} r={35} fill="none" stroke="#3A9E8F" strokeWidth={0.8} strokeOpacity={0.2} />
      <Circle cx={80} cy={70} r={20} fill="none" stroke="#3A9E8F" strokeWidth={1} strokeOpacity={0.25} />
      <Circle cx={80} cy={70} r={5} fill="#3A9E8F" fillOpacity={0.35} />
    </Svg>
  );
}

export default function SkinGoal() {
  const router = useRouter();
  const {
    onboardingFlow,
    onboardingFlowIndex,
    setOnboardingFlowIndex,
    setProtocol,
  } = useStore();

  const [selected, setSelected] = useState<Set<PrimaryGoal>>(new Set());

  const toggleGoal = (goal: PrimaryGoal) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.size === 0) return;
    const primary = [...selected][0];
    const option = GOAL_OPTIONS.find((o) => o.value === primary);
    if (!option) return;
    setProtocol(option.value, option.defaultRegion);
    const nextIndex = onboardingFlowIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    router.push(screenToRoute(onboardingFlow[nextIndex]));
  };

  const handleTrackAll = () => {
    setSelected(new Set(GOAL_OPTIONS.map((o) => o.value)));
    setProtocol('acne', 'whole_face');
    const nextIndex = onboardingFlowIndex + 1;
    setOnboardingFlowIndex(nextIndex);
    router.push(screenToRoute(onboardingFlow[nextIndex]));
  };

  const handleBack = () => {
    const prevIndex = onboardingFlowIndex - 1;
    setOnboardingFlowIndex(prevIndex);
    router.back();
  };

  const firstSelected = selected.size > 0 ? [...selected][0] : null;
  const illustration = firstSelected ? ILLUSTRATIONS[firstSelected] : <DefaultGoalIllustration />;

  return (
    <OnboardingTransition
      illustration={illustration}
      heading="What do you want to focus on?"
      subtext="We'll tailor your scans and weekly check-ins to whatever matters most to you."
      primaryLabel="Continue"
      primaryOnPress={handleContinue}
      primaryDisabled={selected.size === 0}
      secondaryLabel="I want to track everything"
      secondaryOnPress={handleTrackAll}
      showProgress
      totalSteps={onboardingFlow.length}
      currentStep={onboardingFlowIndex}
      showBack
      onBack={handleBack}
    >
      <View style={styles.options}>
        {GOAL_OPTIONS.map((opt) => (
          <OnboardingOptionCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected.has(opt.value)}
            onPress={() => toggleGoal(opt.value)}
            multiSelect
          />
        ))}
      </View>
    </OnboardingTransition>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: Spacing.sm,
  },
});
