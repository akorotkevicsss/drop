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

import { UserAvatar } from '@/components/user-avatar';
import { supabase } from '@/lib/supabase';

type UserResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function FindScreen() {
  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    users,
    setUsers,
  ] =
    useState<UserResult[]>(
      []
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const loadUsers =
    async () => {
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

        setCurrentUserId(
          user.id
        );

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
            'FIND USERS ERROR:',
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
    };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  const results =
    useMemo(() => {
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
    }, [
      query,
      users,
    ]);

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator />
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
          styles.header
        }
      >
        <Text
          style={
            styles.title
          }
        >
          Find
        </Text>
      </View>

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
          placeholderTextColor="#555555"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {!query.trim() ? (
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
            Find people
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Search by name or @username. Open a profile to follow them and bring their Drops into your home feed.
          </Text>
        </View>
      ) : results.length ===
        0 ? (
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
            No users found.
          </Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
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
                  style={({ pressed }) => [
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
                    >
                      {name}
                    </Text>

                    {!!user.username && (
                      <Text
                        style={
                          styles.username
                        }
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
        '#000000',
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        '#000000',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
    },

    searchContainer: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },

    searchInput: {
      height: 46,
      borderRadius: 14,
      backgroundColor:
        '#151515',
      color: '#FFFFFF',
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
    },

    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    emptySubtitle: {
      color: '#666666',
      fontSize: 13,
      marginTop: 7,
      textAlign: 'center',
    },

    userRow: {
      minHeight: 72,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    userRowPressed: {
      opacity: 0.65,
    },

    userText: {
      flex: 1,
      marginLeft: 13,
    },

    name: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    username: {
      color: '#666666',
      fontSize: 13,
      marginTop: 3,
    },

    chevron: {
      color: '#555555',
      fontSize: 28,
      fontWeight: '200',
    },
  });