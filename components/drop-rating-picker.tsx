import Ionicons from '@expo/vector-icons/Ionicons';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    DropColors,
    DropTypography,
} from '@/constants/theme';

type Props = {
  visible: boolean;
  value: number;
  saving?: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
  onSave: () => void;
};

export function DropRatingPicker({
  visible,
  value,
  saving = false,
  onChange,
  onClose,
  onSave,
}: Props) {
  const renderStar = (index: number) => {
    const starValue = index + 1;
    const filled = value >= starValue;
    const half = !filled && value >= starValue - 0.5;

    return (
      <View
        key={starValue}
        style={styles.starWrap}
      >
        <View style={styles.starLayer}>
          <Ionicons
            name="star"
            size={38}
            color={DropColors.warmWhite}
          />

          {(filled || half) && (
            <View
              pointerEvents="none"
              style={[
                styles.wineClip,
                half
                  ? styles.wineClipHalf
                  : styles.wineClipFull,
              ]}
            >
              <Ionicons
                name="star"
                size={38}
                color={DropColors.wine}
                style={styles.wineStar}
              />
            </View>
          )}
        </View>

        <View style={styles.hitRow}>
          <Pressable
            style={styles.halfHit}
            onPress={() =>
              onChange(
                starValue - 0.5
              )
            }
          />

          <Pressable
            style={styles.halfHit}
            onPress={() =>
              onChange(
                starValue
              )
            }
          />
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={styles.sheet}
          onPress={() => {}}
        >
          <Text style={styles.eyebrow}>
            EVENT RATE
          </Text>

          <Text style={styles.title}>
            How was this Drop?
          </Text>

          <Text style={styles.subtitle}>
            Rate the event from 1 to 5.
          </Text>

          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map(
              renderStar
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancel}
              onPress={onClose}
              disabled={saving}
            >
              <Text
                style={
                  styles.cancelText
                }
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.save,
                saving &&
                  styles.disabled,
              ]}
              onPress={onSave}
              disabled={saving}
            >
              <Text
                style={
                  styles.saveText
                }
              >
                {saving
                  ? '...'
                  : 'Save rate'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth:
      StyleSheet.hairlineWidth,
    borderColor:
      DropColors.border,
    backgroundColor:
      '#181818',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },

  eyebrow: {
    color:
      DropColors.textMuted,
    fontFamily:
      DropTypography.bold,
    fontSize: 10,
    letterSpacing: 1.8,
  },

  title: {
    color:
      DropColors.warmWhite,
    fontFamily:
      DropTypography.semibold,
    fontSize: 22,
    marginTop: 8,
  },

  subtitle: {
    color:
      DropColors.textSecondary,
    fontFamily:
      DropTypography.regular,
    fontSize: 13,
    marginTop: 5,
  },

  stars: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginTop: 26,
  },

  starWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  starLayer: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wineClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 38,
    overflow: 'hidden',
  },

  wineClipFull: {
    width: 38,
  },

  wineClipHalf: {
    width: 19,
  },

  wineStar: {
    width: 38,
    height: 38,
  },

  hitRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },

  halfHit: {
    flex: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },

  cancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth:
      StyleSheet.hairlineWidth,
    borderColor:
      DropColors.border,
    backgroundColor:
      DropColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  save: {
    flex: 1.3,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor:
      DropColors.warmWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.55,
  },

  cancelText: {
    color:
      DropColors.textSecondary,
    fontFamily:
      DropTypography.medium,
    fontSize: 13,
  },

  saveText: {
    color:
      DropColors.graphite,
    fontFamily:
      DropTypography.semibold,
    fontSize: 13,
  },
});