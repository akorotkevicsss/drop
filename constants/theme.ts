import {
  Platform,
} from 'react-native';

export const DropColors = {
  graphite: '#0C0C0C',
  warmWhite: '#FFF2E4',
  wine: '#7D0D0D',

  surface: '#333333',
  surfaceElevated: '#3A3A3A',
  border: '#444444',
  textSecondary: '#B8B0A8',
  textMuted: '#77716C',
} as const;

export const DropTypography = {
  light: 'FiraSans_300Light',
  regular: 'FiraSans_400Regular',
  medium: 'FiraSans_500Medium',
  semibold: 'FiraSans_600SemiBold',
  bold: 'FiraSans_700Bold',
} as const;

export const Colors = {
  light: {
    text: DropColors.warmWhite,
    background:
      DropColors.graphite,
    tint: DropColors.wine,
    icon: DropColors.warmWhite,
    tabIconDefault:
      DropColors.textMuted,
    tabIconSelected:
      DropColors.wine,
  },

  dark: {
    text: DropColors.warmWhite,
    background:
      DropColors.graphite,
    tint: DropColors.wine,
    icon: DropColors.warmWhite,
    tabIconDefault:
      DropColors.textMuted,
    tabIconSelected:
      DropColors.wine,
  },
};

export const Fonts =
  Platform.select({
    ios: {
      sans:
        DropTypography.regular,
      serif: 'ui-serif',
      rounded:
        DropTypography.regular,
      mono: 'ui-monospace',
    },

    default: {
      sans:
        DropTypography.regular,
      serif: 'serif',
      rounded:
        DropTypography.regular,
      mono: 'monospace',
    },

    web: {
      sans:
        'FiraSans_400Regular, sans-serif',
      serif:
        'Georgia, serif',
      rounded:
        'FiraSans_400Regular, sans-serif',
      mono:
        'monospace',
    },
  });