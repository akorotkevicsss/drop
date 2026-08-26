import {
    router,
    useFocusEffect,
} from 'expo-router';

import {
    useCallback,
    useMemo,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    UserAvatar,
} from '@/components/user-avatar';

import {
    DropColors,
    DropTypography,
} from '@/constants/theme';

import {
    supabase,
} from '@/lib/supabase';

type UserResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function ExplorePeopleSearch() {
  const [query, setQuery] =
    useState('');

  const [users, setUsers] =
    useState<UserResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const loadUsers =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (!user) {
            setUsers([]);
            return;
          }

          const {
            data,
            error,
          } =
            await supabase
              .from('profiles')
              .select(`
                id,
                username,
                display_name,
                avatar_url
              `)
              .neq(
                'id',
                user.id
              )
              .order(
                'display_name',
                {
                  ascending:
                    true,
                }
              )
              .limit(100);

          if (error) {
            console.error(
              'EXPLORE PEOPLE SEARCH ERROR:',
              error
            );
            return;
          }

          setUsers(
            (
              data ?? []
            ) as UserResult[]
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        loadUsers();
      },
      [
        loadUsers,
      ]
    )
  );

  const results =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase()
            .replace(
              /^@/,
              ''
            );

        if (!normalized) {
          return [];
        }

        return users.filter(
          (user) => {
            const username =
              (
                user.username ??
                ''
              ).toLowerCase();

            const displayName =
              (
                user.display_name ??
                ''
              ).toLowerCase();

            return (
              username.includes(
                normalized
              ) ||
              displayName.includes(
                normalized
              )
            );
          }
        );
      },
      [
        query,
        users,
      ]
    );

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          color={
            DropColors.wine
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
      <View
        style={
          styles.searchContainer
        }
      >
        <TextInput
          style={
            styles.searchInput
          }
          value={
            query
          }
          onChangeText={
            setQuery
          }
          placeholder="Search people"
          placeholderTextColor={
            DropColors.textMuted
          }
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          selectionColor={
            DropColors.wine
          }
        />
      </View>

      {!query.trim() ? (
        <View
          style={
            styles.emptyContainer
          }
        >
          <View
            style={
              styles.accentDot
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            Find people
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Search by name or @username.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            No users found
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Try another name or username.
          </Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {results.map(
            (user) => {
              const name =
                user.display_name ||
                user.username ||
                'Unnamed user';

              return (
                <Pressable
                  key={
                    user.id
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.userRow,
                    pressed &&
                      styles.userRowPressed,
                  ]}
                  onPress={() => {
                    if (
                      !user.username
                    ) {
                      return;
                    }

                    router.push(
                      `/user/${user.username}`
                    );
                  }}
                >
                  <UserAvatar
                    uri={
                      user.avatar_url
                    }
                    name={
                      name
                    }
                    size={48}
                  />

                  <View
                    style={
                      styles.userText
                    }
                  >
                    <Text
                      style={
                        styles.name
                      }
                      numberOfLines={1}
                    >
                      {name}
                    </Text>

                    {!!user.username && (
                      <Text
                        style={
                          styles.username
                        }
                        numberOfLines={1}
                      >
                        @{user.username}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={
                      styles.chevron
                    }
                  >
                    ›
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>
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

    loadingContainer: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    searchContainer: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 10,
    },

    searchInput: {
      height: 48,
      borderRadius: 15,
      backgroundColor:
        DropColors.surface,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 15,
      paddingHorizontal: 16,
    },

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 40,
      paddingBottom: 80,
    },

    accentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        DropColors.wine,
      marginBottom: 14,
    },

    emptyTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 17,
    },

    emptySubtitle: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      marginTop: 7,
      textAlign:
        'center',
    },

    userRow: {
      minHeight: 74,
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      borderRadius: 16,
      backgroundColor:
        DropColors.surface,
    },

    userRowPressed: {
      opacity: 0.6,
    },

    userText: {
      flex: 1,
      marginLeft: 13,
    },

    name: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
    },

    username: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      marginTop: 3,
    },

    chevron: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.light,
      fontSize: 28,
    },
  });