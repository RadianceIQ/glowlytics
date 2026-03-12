import React from 'react';
import { render } from '@testing-library/react-native';
import { FacialMesh } from '../FacialMesh';

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
    // acneScore 80 → both "Acne activity" (elevated) and "Breakout zone" (elevated)
    const elevatedLabels = getAllByText('elevated');
    expect(elevatedLabels.length).toBeGreaterThanOrEqual(1);
  });
});
