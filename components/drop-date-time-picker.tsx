import { useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { DropColors, DropTypography } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  value: Date | null;
  minimumDate?: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
};

type WheelProps = {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  label: string;
};

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

const ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const WHEEL_CENTER_OFFSET = ITEM_HEIGHT;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Wheel({
  values,
  value,
  onChange,
  label,
}: WheelProps) {
  const listRef = useRef<FlatList<number>>(null);

  const valueIndex = Math.max(0, values.indexOf(value));

  const scrollToIndex = (
    index: number,
    animated: boolean,
  ) => {
    listRef.current?.scrollToOffset({
      offset: index * ITEM_HEIGHT,
      animated,
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollToIndex(valueIndex, false);
    });

    return () => cancelAnimationFrame(frame);
  }, [valueIndex]);

  const settle = (offsetY: number) => {
    const index = Math.max(
      0,
      Math.min(
        values.length - 1,
        Math.round(offsetY / ITEM_HEIGHT),
      ),
    );

    scrollToIndex(index, true);
    onChange(values[index]);
  };

  return (
    <View style={styles.wheelColumn}>
      <View style={styles.wheelViewport}>
        <View
          pointerEvents="none"
          style={styles.wheelSelection}
        />

        <FlatList
          ref={listRef}
          data={values}
          keyExtractor={(item) => String(item)}
          style={styles.wheelList}
          contentContainerStyle={styles.wheelContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          nestedScrollEnabled
          bounces={false}
          decelerationRate="fast"
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          disableIntervalMomentum
          keyboardShouldPersistTaps="always"
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            settle(event.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(event) => {
            settle(event.nativeEvent.contentOffset.y);
          }}
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.wheelItem}
              onPress={() => {
                scrollToIndex(index, true);
                onChange(item);
              }}
            >
              <Text
                style={[
                  styles.wheelNumber,
                  item === value && styles.wheelNumberActive,
                ]}
              >
                {String(item).padStart(2, '0')}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <Text style={styles.wheelLabel}>
        {label}
      </Text>
    </View>
  );
}

export function DropDateTimePicker({
  visible,
  title,
  value,
  minimumDate,
  onClose,
  onConfirm,
}: Props) {
  const fallback = value ?? minimumDate ?? new Date();

  const [selected, setSelected] = useState(new Date(fallback));
  const [month, setMonth] = useState(
    new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      1,
    ),
  );
  const [hours, setHours] = useState(fallback.getHours());
  const [minutes, setMinutes] = useState(fallback.getMinutes());

  useEffect(() => {
    if (!visible) {
      return;
    }

    const next = value ?? minimumDate ?? new Date();

    setSelected(new Date(next));
    setMonth(
      new Date(
        next.getFullYear(),
        next.getMonth(),
        1,
      ),
    );
    setHours(next.getHours());
    setMinutes(next.getMinutes());
  }, [visible, value, minimumDate]);

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const days = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();

    return [
      ...Array(first).fill(null),
      ...Array.from(
        { length: days },
        (_, index) => index + 1,
      ),
    ];
  }, [month]);

  const shiftMonth = (delta: number) => {
    setMonth(
      new Date(
        month.getFullYear(),
        month.getMonth() + delta,
        1,
      ),
    );
  };

  const disabled = (day: number) => {
    if (!minimumDate) {
      return false;
    }

    const candidate = new Date(
      month.getFullYear(),
      month.getMonth(),
      day,
      23,
      59,
      59,
    );

    return candidate < minimumDate;
  };

  const confirm = () => {
    const result = new Date(selected);
    result.setHours(hours, minutes, 0, 0);

    if (minimumDate && result < minimumDate) {
      const minimum = new Date(minimumDate);

      setSelected(minimum);
      setHours(minimum.getHours());
      setMinutes(minimum.getMinutes());
      return;
    }

    onConfirm(result);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.top}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
            >
              <Text style={styles.secondary}>
                Cancel
              </Text>
            </Pressable>

            <Text style={styles.title}>
              {title}
            </Text>

            <Pressable
              onPress={confirm}
              hitSlop={10}
            >
              <Text style={styles.done}>
                Done
              </Text>
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              style={styles.arrow}
            >
              <Text style={styles.arrowText}>
                ‹
              </Text>
            </Pressable>

            <Text style={styles.month}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>

            <Pressable
              onPress={() => shiftMonth(1)}
              style={styles.arrow}
            >
              <Text style={styles.arrowText}>
                ›
              </Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {DAYS.map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={styles.dayName}
              >
                {day}
              </Text>
            ))}

            {cells.map((day, index) => {
              if (day === null) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={styles.cell}
                  />
                );
              }

              const selectedDay = sameDay(
                selected,
                new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  day,
                ),
              );

              return (
                <Pressable
                  key={day}
                  disabled={disabled(day)}
                  style={styles.cell}
                  onPress={() => {
                    const next = new Date(selected);

                    next.setFullYear(
                      month.getFullYear(),
                      month.getMonth(),
                      day,
                    );

                    setSelected(next);
                  }}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      selectedDay && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        disabled(day) && styles.disabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>
              TIME
            </Text>

            <View style={styles.wheelsRow}>
              <Wheel
                values={HOURS}
                value={hours}
                onChange={setHours}
                label="hour"
              />

              <Text style={styles.colon}>
                :
              </Text>

              <Wheel
                values={MINUTES}
                value={minutes}
                onChange={setMinutes}
                label="minute"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    overflow: 'hidden',
  },
  top: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  secondary: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 12,
  },
  title: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 14,
  },
  done: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 12,
  },
  monthRow: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: DropColors.warmWhite,
    fontSize: 30,
    fontWeight: '200',
  },
  month: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  grid: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayName: {
    width: '14.2857%',
    textAlign: 'center',
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 9,
    marginBottom: 6,
  },
  cell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: DropColors.wine,
  },
  dayText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 12,
  },
  disabled: {
    color: '#4E4E4E',
  },
  timeSection: {
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DropColors.border,
  },
  timeLabel: {
    paddingHorizontal: 18,
    marginBottom: 8,
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  wheelColumn: {
    width: 92,
    alignItems: 'stretch',
  },
  wheelViewport: {
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  wheelList: {
    height: WHEEL_HEIGHT,
  },
  wheelContent: {
    paddingVertical: WHEEL_CENTER_OFFSET,
  },
  wheelSelection: {
    position: 'absolute',
    zIndex: 0,
    left: 0,
    right: 0,
    top: WHEEL_CENTER_OFFSET,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    backgroundColor: '#151515',
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelNumber: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 18,
  },
  wheelNumberActive: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 21,
  },
  wheelLabel: {
    marginTop: 6,
    textAlign: 'center',
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 9,
  },
  colon: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 24,
    marginBottom: 16,
  },
});