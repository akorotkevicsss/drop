import {
    Stack,
    router,
    useFocusEffect,
    useLocalSearchParams,
} from 'expo-router';
import {
    useCallback,
    useState,
} from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import {
    DropColors,
    DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type RatingRow = {
  id: string;
  user_id: string;
  rating: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type DisplayRating = RatingRow & {
  profile: ProfileRow | null;
};

export default function DropRatesScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const [
    ratings,
    setRatings,
  ] = useState<
    DisplayRating[]
  >([]);

  const [
    average,
    setAverage,
  ] = useState<
    number | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const load = useCallback(
    async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const {
          data: drop,
          error:
            dropError,
        } =
          await supabase
            .from('drops')
            .select(
              'id,author_id'
            )
            .eq('id', id)
            .maybeSingle();

        if (
          dropError ||
          !drop ||
          drop.author_id !==
            user.id
        ) {
          router.back();
          return;
        }

        const {
          data:
            ratingRows,
          error:
            ratingsError,
        } =
          await supabase
            .from(
              'drop_ratings'
            )
            .select(
              'id,user_id,rating,created_at'
            )
            .eq(
              'drop_id',
              id
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            );

        if (
          ratingsError
        ) {
          console.error(
            'DROP RATES ERROR:',
            ratingsError
          );
          return;
        }

        const rows =
          (
            ratingRows ??
            []
          ) as RatingRow[];

        const userIds =
          rows.map(
            (item) =>
              item.user_id
          );

        let profiles:
          ProfileRow[] = [];

        if (
          userIds.length >
          0
        ) {
          const {
            data:
              profileRows,
          } =
            await supabase
              .from(
                'profiles'
              )
              .select(
                'id,username,display_name,avatar_url'
              )
              .in(
                'id',
                userIds
              );

          profiles =
            (
              profileRows ??
              []
            ) as ProfileRow[];
        }

        const profileMap =
          new Map(
            profiles.map(
              (profile) => [
                profile.id,
                profile,
              ]
            )
          );

        setRatings(
          rows.map(
            (rating) => ({
              ...rating,
              profile:
                profileMap.get(
                  rating.user_id
                ) ?? null,
            })
          )
        );

        if (
          rows.length ===
          0
        ) {
          setAverage(
            null
          );
        } else {
          const total =
            rows.reduce(
              (
                sum,
                item
              ) =>
                sum +
                Number(
                  item.rating
                ),
              0
            );

          setAverage(
            Math.round(
              (
                total /
                rows.length
              ) * 10
            ) / 10
          );
        }
      } finally {
        setLoading(
          false
        );
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(
      () => {
        load();
      },
      [load]
    )
  );

  if (loading) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />

        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <Stack.Screen
        options={{
          headerShown:
            false,
        }}
      />

      <View
        style={
          styles.header
        }
      >
        <Text
          style={
            styles.back
          }
          onPress={() =>
            router.back()
          }
        >
          ‹
        </Text>

        <Text
          style={
            styles.headerTitle
          }
        >
          RATES
        </Text>

        <View
          style={
            styles.headerSide
          }
        />
      </View>

      <View
        style={
          styles.summary
        }
      >
        <Text
          style={
            styles.average
          }
        >
          {average === null
            ? '—'
            : `★ ${average.toFixed(
                1
              )}`}
        </Text>

        <Text
          style={
            styles.summaryLabel
          }
        >
          {ratings.length}{' '}
          {ratings.length ===
          1
            ? 'rating'
            : 'ratings'}
        </Text>
      </View>

      {ratings.length ===
      0 ? (
        <View
          style={
            styles.empty
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            No rates yet.
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Participant rates
            will appear here.
          </Text>
        </View>
      ) : (
        <View>
          {ratings.map(
            (item) => {
              const name =
                item.profile
                  ?.display_name ||
                item.profile
                  ?.username ||
                'User';

              return (
                <View
                  key={
                    item.id
                  }
                  style={
                    styles.row
                  }
                >
                  <UserAvatar
                    uri={
                      item.profile
                        ?.avatar_url
                    }
                    name={
                      name
                    }
                    size={42}
                  />

                  <View
                    style={
                      styles.person
                    }
                  >
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {name}
                    </Text>

                    {!!item.profile
                      ?.username && (
                      <Text
                        style={
                          styles.username
                        }
                      >
                        @
                        {
                          item.profile
                            .username
                        }
                      </Text>
                    )}
                  </View>

                  <Text
                    style={
                      styles.rating
                    }
                  >
                    ★{' '}
                    {Number(
                      item.rating
                    ).toFixed(
                      1
                    )}
                  </Text>
                </View>
              );
            }
          )}
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    center: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 52,
      minHeight: 96,
      paddingHorizontal: 18,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    back: {
      width: 42,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 36,
      lineHeight: 38,
    },

    headerTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 15,
      letterSpacing: 1.7,
    },

    headerSide: {
      width: 42,
    },

    summary: {
      paddingHorizontal: 22,
      paddingVertical: 26,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    average: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 34,
    },

    summaryLabel: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 4,
    },

    row: {
      minHeight: 70,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    person: {
      flex: 1,
      marginLeft: 12,
    },

    name: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    username: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 2,
    },

    rating: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 15,
    },

    empty: {
      paddingHorizontal: 22,
      paddingTop: 40,
      alignItems:
        'center',
    },

    emptyTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
    },

    emptyText: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 5,
    },
  });