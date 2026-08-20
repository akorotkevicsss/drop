import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type DropAuthor = {
  username: string | null;
  display_name: string | null;
  city: string | null;
};

type Drop = {
  id: string;
  author_id: string;
  text: string;
  city: string | null;
  event_time: string | null;
  join_enabled: boolean;
  interested_enabled: boolean;
  reply_enabled: boolean;
  created_at: string;
  profiles: DropAuthor | null;
};

function formatDropTime(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();

  const difference =
    now.getTime() - created.getTime();

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days}d`;
}

export default function HomeScreen() {
  const [drops, setDrops] =
    useState<Drop[]>([]);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const loadDrops = async (
    manualRefresh = false
  ) => {
    try {
      if (manualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Error',
          'Could not find the current user.'
        );

        return;
      }

      setCurrentUserId(user.id);

      const {
        data,
        error,
      } = await supabase
        .from('drops')
        .select(`
          id,
          author_id,
          text,
          city,
          event_time,
          join_enabled,
          interested_enabled,
          reply_enabled,
          created_at,
          profiles!drops_author_id_fkey (
            username,
            display_name,
            city
          )
        `)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'LOAD DROPS ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Could not load Drops.'
        );

        return;
      }

      setDrops(
        (data ?? []) as unknown as Drop[]
      );
    } catch (error) {
      console.error(
        'LOAD DROPS ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Something went wrong while loading Drops.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDrops();
    }, [])
  );

  const openProfile = (
    drop: Drop
  ) => {
    if (
      drop.author_id === currentUserId
    ) {
      router.push('/profile');
      return;
    }

    const username =
      drop.profiles?.username;

    if (!username) {
      return;
    }

    router.push(
      `/user/${username}`
    );
  };

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          DROP
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.push('/create')
          }
        >
          <Text
            style={
              styles.headerButton
            }
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadDrops(true)
            }
            tintColor="#FFFFFF"
          />
        }
      >
        {drops.length === 0 ? (
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
              Nothing dropped yet.
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Be the first.
            </Text>
          </View>
        ) : (
          drops.map((drop) => {
            const displayName =
              drop.profiles
                ?.display_name ||
              'Unnamed user';

            const username =
              drop.profiles
                ?.username;

            const avatarLetter =
              displayName
                .charAt(0)
                .toUpperCase();

            const isOwnDrop =
              drop.author_id ===
              currentUserId;

            const time =
              formatDropTime(
                drop.created_at
              );

            const location =
              drop.city ||
              drop.profiles?.city;

            return (
              <View
                key={drop.id}
                style={styles.drop}
              >
                <Pressable
                  style={
                    styles.userRow
                  }
                  onPress={() =>
                    openProfile(drop)
                  }
                >
                  <View
                    style={
                      styles.avatar
                    }
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {avatarLetter}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {displayName}
                    </Text>

                    <Text
                      style={
                        styles.username
                      }
                    >
                      {username
                        ? `@${username}`
                        : ''}
                      {' · '}
                      {time}
                    </Text>
                  </View>
                </Pressable>

                <Text
                  style={
                    styles.dropText
                  }
                >
                  {drop.text}
                </Text>

                {!!location && (
                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {location}
                  </Text>
                )}

                {!isOwnDrop && (
                  <View
                    style={
                      styles.actions
                    }
                  >
                    {drop.join_enabled && (
                      <TouchableOpacity
                        style={
                          styles.joinButton
                        }
                        onPress={() =>
                          Alert.alert(
                            'Join',
                            'Real Join requests are the next backend step.'
                          )
                        }
                      >
                        <Text
                          style={
                            styles.joinText
                          }
                        >
                          Join
                        </Text>
                      </TouchableOpacity>
                    )}

                    {drop.interested_enabled && (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'Interested',
                            'Interested will be connected to Supabase next.'
                          )
                        }
                      >
                        <Text
                          style={
                            styles.secondaryAction
                          }
                        >
                          Interested
                        </Text>
                      </TouchableOpacity>
                    )}

                    {drop.reply_enabled && (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'Reply',
                            'Replies will be connected next.'
                          )
                        }
                      >
                        <Text
                          style={
                            styles.secondaryAction
                          }
                        >
                          Reply
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isOwnDrop && (
                  <Text
                    style={
                      styles.ownDrop
                    }
                  >
                    Your Drop
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
      alignItems: 'center',
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
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    logo: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 3,
    },

    headerButton: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '300',
    },

    drop: {
      paddingHorizontal: 20,
      paddingVertical: 22,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#222222',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    avatarText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    name: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    username: {
      color: '#666666',
      fontSize: 13,
      marginTop: 2,
    },

    dropText: {
      color: '#FFFFFF',
      fontSize: 19,
      lineHeight: 27,
      marginTop: 18,
    },

    meta: {
      color: '#777777',
      fontSize: 13,
      marginTop: 10,
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 22,
      marginTop: 18,
    },

    joinButton: {
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
    },

    joinText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },

    secondaryAction: {
      color: '#888888',
      fontSize: 14,
    },

    ownDrop: {
      color: '#555555',
      fontSize: 12,
      marginTop: 14,
    },

    emptyContainer: {
      paddingHorizontal: 20,
      paddingTop: 60,
      alignItems: 'center',
    },

    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    emptySubtitle: {
      color: '#555555',
      fontSize: 14,
      marginTop: 6,
    },
  });