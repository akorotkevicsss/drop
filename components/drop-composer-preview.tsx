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
  const hasVisualBackground = !!backgroundColor;

  return (
    <View
      style={[
        styles.card,
        hasVisualBackground && styles.cardWithBackground,
        backgroundColor
          ? { backgroundColor }
          : null,
      ]}
    >
      <View style={styles.textCenter}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="What do you want to do?"
          placeholderTextColor={DropColors.textMuted}
          multiline
          maxLength={maxLength}
          autoFocus={autoFocus}
          selectionColor={DropColors.wine}
          style={styles.input}
        />
      </View>

      <Text style={styles.counter}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    minHeight: 260,
    marginHorizontal: 18,
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  cardWithBackground: {
    borderRadius: 18,
    overflow: 'hidden',
    borderBottomWidth: 0,
  },
  textCenter: {
    flex: 1,
    minHeight: 260,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 46,
  },
  input: {
    width: '100%',
    padding: 0,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 21,
    lineHeight: 28,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  counter: {
    position: 'absolute',
    right: 18,
    bottom: 12,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },
});