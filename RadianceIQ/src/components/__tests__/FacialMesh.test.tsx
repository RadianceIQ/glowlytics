import React from 'react';
import { render } from '@testing-library/react-native';
import { FacialMesh } from '../FacialMesh';
import type { DetectedCondition } from '../../types';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Defs: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
    Line: (props: any) => <View {...props} />,
    RadialGradient: (props: any) => <View {...props} />,
    Stop: (props: any) => <View {...props} />,
  };
});

describe('FacialMesh', () => {
  it('renders with the Facial Analysis header', () => {
    const { getByText } = render(
      <FacialMesh acneScore={50} sunDamageScore={30} skinAgeScore={40} />
    );
    expect(getByText('Facial Analysis')).toBeTruthy();
  });

  it('shows hot zones for elevated acne scores', () => {
    const { getByText } = render(
      <FacialMesh acneScore={60} sunDamageScore={20} skinAgeScore={20} />
    );
    // Acne > 40 should show "Acne activity" legend item
    expect(getByText('Acne activity')).toBeTruthy();
  });

  it('shows breakout zone for high acne', () => {
    const { getByText } = render(
      <FacialMesh acneScore={70} sunDamageScore={20} skinAgeScore={20} />
    );
    expect(getByText('Breakout zone')).toBeTruthy();
  });

  it('shows sun exposure for elevated sun damage', () => {
    const { getByText } = render(
      <FacialMesh acneScore={20} sunDamageScore={60} skinAgeScore={20} />
    );
    expect(getByText('Sun exposure')).toBeTruthy();
  });

  it('shows All clear when all scores are low', () => {
    const { getByText } = render(
      <FacialMesh acneScore={20} sunDamageScore={20} skinAgeScore={20} />
    );
    expect(getByText('All clear')).toBeTruthy();
  });

  it('shows severity labels', () => {
    const { getAllByText } = render(
      <FacialMesh acneScore={80} sunDamageScore={20} skinAgeScore={20} />
    );
    // acneScore 80 -> both "Acne activity" (elevated) and "Breakout zone" (elevated)
    const elevatedLabels = getAllByText('elevated');
    expect(elevatedLabels.length).toBeGreaterThanOrEqual(1);
  });

  // --- Condition-driven rendering tests ---

  it('uses condition data when conditions prop is provided', () => {
    const conditions: DetectedCondition[] = [
      {
        name: 'rosacea',
        severity: 'moderate',
        zones: [{ region: 'right_cheek', severity: 'moderate' }],
        description: 'Moderate rosacea detected on right cheek',
      },
      {
        name: 'dark_circles',
        severity: 'mild',
        zones: [{ region: 'under_eye', severity: 'mild' }],
        description: 'Mild dark circles under eyes',
      },
    ];

    const { getByText } = render(
      <FacialMesh acneScore={80} sunDamageScore={80} skinAgeScore={80} conditions={conditions} />
    );

    // Condition names should appear in the legend (underscores replaced with spaces)
    expect(getByText('Rosacea')).toBeTruthy();
    expect(getByText('Dark circles')).toBeTruthy();
  });

  it('falls back to threshold behavior when conditions is an empty array', () => {
    const { getByText } = render(
      <FacialMesh acneScore={60} sunDamageScore={20} skinAgeScore={20} conditions={[]} />
    );
    // Should use threshold-based logic (acne > 40 -> "Acne activity")
    expect(getByText('Acne activity')).toBeTruthy();
  });

  it('falls back to threshold behavior when conditions is undefined', () => {
    const { getByText } = render(
      <FacialMesh acneScore={20} sunDamageScore={60} skinAgeScore={20} conditions={undefined} />
    );
    // Should use threshold-based logic (sun > 45 -> "Sun exposure")
    expect(getByText('Sun exposure')).toBeTruthy();
  });

  it('shows severity badges for condition-driven zones', () => {
    const conditions: DetectedCondition[] = [
      {
        name: 'acne',
        severity: 'severe',
        zones: [
          { region: 'left_cheek', severity: 'severe' },
          { region: 'chin', severity: 'moderate' },
        ],
        description: 'Severe acne on left cheek, moderate on chin',
      },
    ];

    const { getAllByText } = render(
      <FacialMesh acneScore={20} sunDamageScore={20} skinAgeScore={20} conditions={conditions} />
    );

    // Severe maps to "elevated", moderate stays "moderate"
    expect(getAllByText('elevated').length).toBe(1);
    expect(getAllByText('moderate').length).toBe(1);
  });

  it('shows All clear when conditions have no zones', () => {
    const conditions: DetectedCondition[] = [
      {
        name: 'acne',
        severity: 'mild',
        zones: [],
        description: 'Minimal acne, no specific zones',
      },
    ];

    const { getByText } = render(
      <FacialMesh acneScore={20} sunDamageScore={20} skinAgeScore={20} conditions={conditions} />
    );

    expect(getByText('All clear')).toBeTruthy();
  });
});
