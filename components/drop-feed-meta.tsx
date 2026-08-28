import { StyleSheet, Text, View } from 'react-native';

import { DropColors, DropTypography } from '@/constants/theme';

type DropFeedMetaProps = {
  eventTime: string | null;
  eventEndTime: string | null;
  status: 'active' | 'ended' | 'cancelled' | string | null;
  location: string | null;
  ageRestriction: string | null;
  joinLimit: number | null;
};

function formatEventDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DropFeedMeta({
  eventTime,
  eventEndTime,
  status,
  location,
  ageRestriction,
  joinLimit,
}: DropFeedMetaProps) {
  const start = formatEventDate(eventTime);
  const end = formatEventDate(eventEndTime);

  const items = [
    start ? (end ? `${start} — ${end}` : start) : null,
    location?.trim() || null,
    ageRestriction?.trim() || null,
    joinLimit ? `${joinLimit} spots` : null,
  ].filter(Boolean) as string[];

  if (!items.length && status === 'active') return null;

  return (
    <View style={styles.container}>
      {status === 'cancelled' && <Text style={styles.status}>CANCELLED</Text>}
      {status === 'ended' && <Text style={styles.status}>ENDED</Text>}

      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 5,
  },
  status: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: DropColors.textMuted,
    marginRight: 7,
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },
});