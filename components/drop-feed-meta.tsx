import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';

type DropFeedMetaProps = {
  eventTime: string | null;
  eventEndTime: string | null;
  status:
    | 'active'
    | 'ended'
    | 'cancelled'
    | string
    | null;
  location: string | null;
  onLocationPress?:
    | (() => void)
    | null;
  ageRestriction: string | null;
  joinLimit: number | null;
};

function formatEventDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toLocaleString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

export function DropFeedMeta({
  eventTime,
  eventEndTime,
  status,
  location,
  onLocationPress,
  ageRestriction,
  joinLimit,
}: DropFeedMetaProps) {
  const start =
    formatEventDate(
      eventTime
    );

  const end =
    formatEventDate(
      eventEndTime
    );

  const dateLabel =
    start
      ? end
        ? `${start} — ${end}`
        : start
      : null;

  const locationLabel =
    location?.trim() ||
    null;

  const ageLabel =
    ageRestriction?.trim() ||
    null;

  const spotsLabel =
    joinLimit
      ? `${joinLimit} spots`
      : null;

  const hasItems =
    !!dateLabel ||
    !!locationLabel ||
    !!ageLabel ||
    !!spotsLabel;

  if (
    !hasItems &&
    status === 'active'
  ) {
    return null;
  }

  const renderRow = (
    value: string,
    key: string,
    onPress?:
      | (() => void)
      | null
  ) => {
    const content = (
      <>
        <View
          style={
            styles.dot
          }
        />

        <Text
          style={
            styles.text
          }
          numberOfLines={1}
        >
          {value}
        </Text>
      </>
    );

    if (onPress) {
      return (
        <Pressable
          key={key}
          style={({
            pressed,
          }) => [
            styles.row,
            pressed &&
              styles.locationPressed,
          ]}
          onPress={(
            event
          ) => {
            event.stopPropagation();
            onPress();
          }}
          hitSlop={6}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View
        key={key}
        style={
          styles.row
        }
      >
        {content}
      </View>
    );
  };

  return (
    <View
      style={
        styles.container
      }
    >
      {status ===
        'cancelled' && (
        <Text
          style={
            styles.status
          }
        >
          CANCELLED
        </Text>
      )}

      {status ===
        'ended' && (
        <Text
          style={
            styles.status
          }
        >
          ENDED
        </Text>
      )}

      {!!dateLabel &&
        renderRow(
          dateLabel,
          'date'
        )}

      {!!locationLabel &&
        renderRow(
          locationLabel,
          'location',
          onLocationPress
        )}

      {!!ageLabel &&
        renderRow(
          ageLabel,
          'age'
        )}

      {!!spotsLabel &&
        renderRow(
          spotsLabel,
          'spots'
        )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      marginTop: 10,
      gap: 5,
    },

    status: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1,
      marginBottom: 2,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },

    locationPressed: {
      opacity: 0.62,
    },

    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor:
        DropColors.textMuted,
      marginRight: 7,
    },

    text: {
      flex: 1,
      minWidth: 0,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },
  });