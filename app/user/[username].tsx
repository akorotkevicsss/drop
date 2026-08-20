import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useEffect,
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

import { UserAvatar } from '@/components/user-avatar';
import { supabase } from '@/lib/supabase';

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;

  followers_count: number;
  following_count: number;

  is_following: boolean;
  is_followed_by: boolean;
  is_mutual: boolean;

  can_view_followers: boolean;
  can_view_following: boolean;
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

export default function UserProfileScreen() {
  const { username } =
    useLocalSearchParams<{
      username: string;
    }>();

  const cleanUsername =
    username?.replace(
      '@',
      ''
    ) ?? '';

  const [
    profile,
    setProfile,
  ] =
    useState<
      PublicProfile | null
    >(null);

  const [
    userDrops,
    setUserDrops,
  ] =
    useState<Drop[]>([]);

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

  const [
    followLoading,
    setFollowLoading,
  ] =
    useState(false);

  useEffect(() => {
    loadProfile();
  }, [cleanUsername]);

  const loadProfile =
    async () => {
      if (!cleanUsername) {
        setProfile(null);
        setLoading(false);
        return;
      }

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
            'Error',
            'Could not find the current user.'
          );

          return;
        }

        setCurrentUserId(
          user.id
        );

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_public_profile',
            {
              target_username:
                cleanUsername,
            }
          );

        if (error) {
          console.error(
            'PUBLIC PROFILE RPC ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not load this profile.'
          );

          return;
        }

        const loadedProfile =
          (
            data?.[0] ??
            null
          ) as PublicProfile | null;

        if (!loadedProfile) {
          setProfile(null);
          setUserDrops([]);
          return;
        }

        setProfile(
          loadedProfile
        );

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
              loadedProfile.id
            )
            .is(
              'deleted_at',
              null
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
            'PUBLIC PROFILE DROPS ERROR:',
            dropsError
          );
        } else {
          setUserDrops(
            dropData ?? []
          );
        }
      } catch (error) {
        console.error(
          'PUBLIC PROFILE LOAD ERROR:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  const toggleFollow =
    async () => {
      if (
        !profile ||
        !currentUserId ||
        currentUserId ===
          profile.id ||
        followLoading
      ) {
        return;
      }

      try {
        setFollowLoading(
          true
        );

        if (
          profile.is_following
        ) {
          const {
            error,
          } =
            await supabase
              .from('follows')
              .delete()
              .eq(
                'follower_id',
                currentUserId
              )
              .eq(
                'following_id',
                profile.id
              );

          if (error) {
            Alert.alert(
              'Error',
              'Could not unfollow this user.'
            );

            return;
          }
        } else {
          const {
            error,
          } =
            await supabase
              .from('follows')
              .insert({
                follower_id:
                  currentUserId,

                following_id:
                  profile.id,
              });

          if (error) {
            Alert.alert(
              'Error',
              'Could not follow this user.'
            );

            return;
          }
        }

        /*
         * Reload through the RPC.
         * This updates:
         * count + mutual + Bio/City privacy
         * in one shot.
         */
        await loadProfile();
      } finally {
        setFollowLoading(
          false
        );
      }
    };

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

    const allowed =
      type === 'followers'
        ? profile.can_view_followers
        : profile.can_view_following;

    if (!allowed) {
      Alert.alert(
        type === 'followers'
          ? 'Followers are private'
          : 'Following is private',
        'This user has hidden this list.'
      );

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
          styles.container
        }
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <Pressable
          style={
            styles.backArea
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButton
            }
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={
            styles.notFound
          }
        >
          User not found.
        </Text>
      </View>
    );
  }

  const displayName =
    profile.display_name ||
    'Unnamed user';

  const isOwner =
    currentUserId ===
    profile.id;

  return (
    <View
      style={
        styles.container
      }
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButton
            }
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          @{profile.username}
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView>
        <View
          style={
            styles.profile
          }
        >
          <View
            style={
              styles.topRow
            }
          >
            <UserAvatar
              uri={
                profile.avatar_url
              }
              name={
                displayName
              }
              size={80}
            />

            {!isOwner && (
              <Pressable
                style={[
                  styles.followButton,

                  profile.is_following &&
                    styles.followingButton,
                ]}
                onPress={
                  toggleFollow
                }
                disabled={
                  followLoading
                }
              >
                <Text
                  style={[
                    styles.followText,

                    profile.is_following &&
                      styles.followingText,
                  ]}
                >
                  {followLoading
                    ? '...'
                    : profile.is_mutual
                      ? 'Mutual'
                      : profile.is_following
                        ? 'Following'
                        : 'Follow'}
                </Text>
              </Pressable>
            )}
          </View>

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
            {(isOwner ||
              profile.can_view_followers) && (
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
                    profile.followers_count
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
            )}

            {(isOwner ||
              profile.can_view_following) && (
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
                    profile.following_count
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
            )}

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
                  userDrops.length
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
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          ACTIVE DROPS
        </Text>

        {userDrops.length ===
        0 ? (
          <Text
            style={
              styles.emptyText
            }
          >
            No active Drops.
          </Text>
        ) : (
          userDrops.map(
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
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection: 'row',
      alignItems: 'center',
    },

    backArea: {
      paddingTop: 60,
      paddingLeft: 20,
    },

    backButton: {
      color: '#FFFFFF',
      fontSize: 40,
      lineHeight: 40,
      fontWeight: '200',
    },

    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    headerSpacer: {
      width: 24,
    },

    profile: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    topRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    followButton: {
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 22,
      minWidth: 100,
      alignItems: 'center',
    },

    followingButton: {
      backgroundColor:
        '#171717',
      borderWidth: 1,
      borderColor:
        '#444444',
    },

    followText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },

    followingText: {
      color: '#FFFFFF',
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

    notFound: {
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: 80,
    },
  });