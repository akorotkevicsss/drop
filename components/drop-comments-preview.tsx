import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  backgroundColor: string | null;
  maxLength?: number;
  autoFocus?: boolean;
};

export function DropComposerPreview({
  value,
  onChangeText,
  backgroundColor,
  maxLength = 280,
  autoFocus = false,
}: Props) {
  return (
    <View
      style={[
        styles.visual,
        backgroundColor
          ? {
              backgroundColor,
            }
          : null,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="What do you want to do?"
        placeholderTextColor={
          DropColors.textMuted
        }
        multiline
        maxLength={maxLength}
        autoFocus={autoFocus}
        selectionColor={DropColors.wine}
        style={styles.input}
      />

      <Text style={styles.counter}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors Home styles.dropVisual + dropVisualSolid:
  // minHeight 176, 18px horizontal/vertical padding, centered content.
  visual: {
    position: 'relative',
    minHeight: 176,
    marginHorizontal: 18,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: DropColors.surface,
  },

  // Mirrors Home styles.dropVisualText:
  input: {
    width: '100%',
    padding: 0,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'left',
    textAlignVertical: 'center',
  },

  counter: {
    position: 'absolute',
    right: 12,
    bottom: 9,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },
});