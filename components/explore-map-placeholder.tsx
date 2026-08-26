import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    DropColors,
    DropTypography,
} from '@/constants/theme';

export function ExploreMapPlaceholder() {
  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.pin
        }
      >
        <View
          style={
            styles.pinDot
          }
        />
      </View>

      <Text
        style={
          styles.title
        }
      >
        Map
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        Coming soon later
      </Text>

      <Text
        style={
          styles.description
        }
      >
        Nearby Drops will appear here once map discovery is connected.
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 42,
      paddingBottom: 80,
      backgroundColor:
        DropColors.graphite,
    },

    pin: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        DropColors.border,
      backgroundColor:
        DropColors.surface,
      marginBottom: 18,
    },

    pinDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor:
        DropColors.wine,
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 28,
    },

    subtitle: {
      color:
        DropColors.wine,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
      marginTop: 7,
    },

    description: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      lineHeight: 19,
      textAlign:
        'center',
      marginTop: 10,
    },
  });