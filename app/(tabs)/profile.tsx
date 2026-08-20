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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/user-avatar';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
};

type Drop = {
  id: string;
  text: string;
  city: string | null;
  created_at: string;
};

function formatDropTime(
  createdAt: string
) {
  const created =
    new Date(createdAt);

  const now =
    new Date();

  const difference =
    now.getTime() -
    created.getTime();

  const minutes =
    Math.floor(
      difference /
        (1000 * 60)
    );

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d`;
}

export default function ProfileScreen() {
  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    myDrops,
    setMyDrops,
  ] =
    useState<Drop[]>([]);

  const [
    followersCount,
    setFollowersCount,
  ] =
    useState(0);

  const [
    followingCount,
    setFollowingCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const loadProfile =
    async () => {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          Alert.alert(
            'Profile error',
            'Could not find the current user.'
          );

          return;
        }

        const {
          data: profileData,
          error:
            profileError,
        } =
          await supabase
            .from('profiles')
            .select(`
              id,
              username,
              display_name,
              bio,
              city,
              avatar_url
            `)
            .eq(
              'id',
              user.id
            )
            .single();

        if (
          profileError
        ) {
          console.error(
            'LOAD PROFILE ERROR:',
            profileError
          );

          Alert.alert(
            'Profile error',
            profileError.message
          );

          return;
        }

        const {
          count: followers,
          error:
            followersError,
        } =
          await supabase
            .from('follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'following_id',
              user.id
            );

        if (
          followersError
        ) {
          console.error(
            'FOLLOWERS COUNT ERROR:',
            followersError
          );
        }

        const {
          count: following,
          error:
            followingError,
        } =
          await supabase
            .from('follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'follower_id',
              user.id
            );

        if (
          followingError
        ) {
          console.error(
            'FOLLOWING COUNT ERROR:',
            followingError
          );
        }

        const {
          data: dropData,
          error: dropsError,
        } =
          await supabase
            .from('drops')
            .select(`
              id,
              text,
              city,
              created_at
            `)
            .eq(
              'author_id',
              user.id
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            );

        if (dropsError) {
          console.error(
            'PROFILE DROPS ERROR:',
            dropsError
          );

          return;
        }

        setProfile(
          profileData
        );

        setFollowersCount(
          followers ?? 0
        );

        setFollowingCount(
          following ?? 0
        );

        setMyDrops(
          dropData ?? []
        );
      } catch (error) {
        console.error(
          'PROFILE ERROR:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const openConnections = (
    type:
      | 'followers'
      | 'following'
  ) => {
    if (
      !profile?.username
    ) {
      return;
    }

    router.push(
      `/connections/${type}?username=${encodeURIComponent(
        profile.username
      )}`
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

  if (!profile) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.errorText
          }
        >
          Profile could not be loaded.
        </Text>

        <Pressable
          style={
            styles.retryButton
          }
          onPress={
            loadProfile
          }
        >
          <Text
            style={
              styles.retryText
            }
          >
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  const displayName =
    profile.display_name ||
    'Unnamed user';

  return (
    <View
      style={
        styles.container
      }
    >
      <ScrollView>
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
            Profile
          </Text>

          <Pressable
            onPress={() =>
              router.push(
                '/settings'
              )
            }
            hitSlop={12}
            style={
              styles.settingsIconButton
            }
          >
            <IconSymbol
              name="gearshape"
              size={21}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View
          style={
            styles.profile
          }
        >
          <UserAvatar
            uri={
              profile.avatar_url
            }
            name={
              displayName
            }
            size={82}
          />

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
            @{profile.username}
          </Text>

          {!!profile.bio && (
            <Text
              style={
                styles.bio
              }
            >
              {profile.bio}
            </Text>
          )}

          {!!profile.city && (
            <Text
              style={
                styles.city
              }
            >
              {profile.city}
            </Text>
          )}

          <View
            style={
              styles.stats
            }
          >
            <Pressable
              style={
                styles.stat
              }
              onPress={() =>
                openConnections(
                  'followers'
                )
              }
            >
              <Text
                style={
                  styles.statNumber
                }
              >
                {
                  followersCount
                }
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                Followers
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.stat
              }
              onPress={() =>
                openConnections(
                  'following'
                )
              }
            >
              <Text
                style={
                  styles.statNumber
                }
              >
                {
                  followingCount
                }
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                Following
              </Text>
            </Pressable>

            <View
              style={
                styles.stat
              }
            >
              <Text
                style={
                  styles.statNumber
                }
              >
                {
                  myDrops.length
                }
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                Drops
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed &&
                styles.editButtonPressed,
            ]}
            onPress={() =>
              router.push(
                '/edit-profile'
              )
            }
          >
            <Text
              style={
                styles.editText
              }
            >
              Edit profile
            </Text>
          </Pressable>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          YOUR DROPS
        </Text>

        {myDrops.length ===
        0 ? (
          <Text
            style={
              styles.emptyText
            }
          >
            You haven't dropped anything yet.
          </Text>
        ) : (
          myDrops.map(
            (drop) => (
              <View
                key={
                  drop.id
                }
                style={
                  styles.drop
                }
              >
                <Text
                  style={
                    styles.dropText
                  }
                >
                  {drop.text}
                </Text>

                <Text
                  style={
                    styles.dropMeta
                  }
                >
                  {drop.city
                    ? `${drop.city} · `
                    : ''}

                  {formatDropTime(
                    drop.created_at
                  )}
                </Text>
              </View>
            )
          )
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

    errorText: {
      color: '#777777',
      fontSize: 15,
    },

    retryButton: {
      marginTop: 16,
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },

    retryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },

    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
    },

    settingsIconButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    profile: {
      paddingHorizontal: 20,
      paddingVertical: 26,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    name: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
      marginTop: 20,
    },

    username: {
      color: '#666666',
      fontSize: 14,
      marginTop: 3,
    },

    bio: {
      color: '#CCCCCC',
      fontSize: 15,
      lineHeight: 21,
      marginTop: 16,
    },

    city: {
      color: '#666666',
      fontSize: 14,
      marginTop: 8,
    },

    stats: {
      flexDirection: 'row',
      gap: 30,
      marginTop: 22,
    },

    stat: {
      flexDirection: 'row',
      gap: 5,
    },

    statNumber: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },

    statLabel: {
      color: '#666666',
      fontSize: 14,
    },

    editButton: {
      marginTop: 26,
      height: 46,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    editButtonPressed: {
      opacity: 0.75,
    },

    editText: {
      color: '#000000',
      fontSize: 15,
      fontWeight: '600',
    },

    sectionTitle: {
      color: '#555555',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 8,
    },

    drop: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    dropText: {
      color: '#FFFFFF',
      fontSize: 18,
      lineHeight: 25,
    },

    dropMeta: {
      color: '#666666',
      fontSize: 13,
      marginTop: 8,
    },

    emptyText: {
      color: '#555555',
      fontSize: 14,
      padding: 20,
    },
  });