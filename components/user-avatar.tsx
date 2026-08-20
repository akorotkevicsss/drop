import { Image, StyleSheet, Text, View } from 'react-native';

type UserAvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

export function UserAvatar({
  uri,
  name,
  size = 48,
}: UserAvatarProps) {
  const letter =
    name?.trim().charAt(0).toUpperCase() || '?';

  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: '#222222',
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <Text
        style={[
          styles.letter,
          {
            fontSize: Math.max(14, size * 0.36),
          },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  letter: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});