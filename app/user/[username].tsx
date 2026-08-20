import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useDropStore } from '@/store/drops';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  show_followers: boolean;
  show_following: boolean;
};

export default function UserProfileScreen() {
  const { username } =
    useLocalSearchParams<{
      username: string;
    }>();

  const drops = useDropStore(
    (state) => state.drops
  );

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [followersCount, setFollowersCount] =
    useState(0);

  const [followingCount, setFollowingCount] =
    useState(0);

  const [isFollowing, setIsFollowing] =
    useState(false);

  const [isFollowedBy, setIsFollowedBy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [followLoading, setFollowLoading] =
    useState(false);

  const cleanUsername =
    username?.replace('@', '') ?? '';

  useEffect(() => {
    loadProfile();
  }, [cleanUsername]);

  const loadProfile = async () => {
    try {
      setLoading(true);

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
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          bio,
          city,
          avatar_url,
          show_followers,
          show_following
        `)
        .eq('username', cleanUsername)
        .maybeSingle();

      if (profileError) {
        console.error(
          'PUBLIC PROFILE ERROR:',
          profileError
        );

        Alert.alert(
          'Error',
          'Could not load this profile.'
        );

        return;
      }

      if (!profileData) {
        setProfile(null);
        return;
      }

      setProfile(profileData);

      const {
        count: followers,
      } = await supabase
        .from('follows')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'following_id',
          profileData.id
        );

      const {
        count: following,
      } = await supabase
        .from('follows')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'follower_id',
          profileData.id
        );

      setFollowersCount(
        followers ?? 0
      );

      setFollowingCount(
        following ?? 0
      );

      const {
        data: outgoingFollow,
      } = await supabase
        .from('follows')
        .select('follower_id')
        .eq(
          'follower_id',
          user.id
        )
        .eq(
          'following_id',
          profileData.id
        )
        .maybeSingle();

      const {
        data: incomingFollow,
      } = await supabase
        .from('follows')
        .select('follower_id')
        .eq(
          'follower_id',
          profileData.id
        )
        .eq(
          'following_id',
          user.id
        )
        .maybeSingle();

      setIsFollowing(
        !!outgoingFollow
      );

      setIsFollowedBy(
        !!incomingFollow
      );
    } catch (error) {
      console.error(
        'PUBLIC PROFILE LOAD ERROR:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (
      !profile ||
      !currentUserId ||
      followLoading
    ) {
      return;
    }

    try {
      setFollowLoading(true);

      if (isFollowing) {
        const { error } =
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

        setIsFollowing(false);

        setFollowersCount(
          (current) =>
            Math.max(0, current - 1)
        );

        return;
      }

      const { error } =
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

      setIsFollowing(true);

      setFollowersCount(
        (current) =>
          current + 1
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const userDrops =
    useMemo(() => {
      if (!profile?.username) {
        return [];
      }

      return drops.filter(
        (drop) =>
          drop.username.replace(
            '@',
            ''
          ) === profile.username
      );
    }, [drops, profile]);

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
        style={styles.container}
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <Pressable
          style={styles.backArea}
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
          style={styles.notFound}
        >
          User not found.
        </Text>
      </View>
    );
  }

  const displayName =
    profile.display_name ||
    'Unnamed user';

  const avatarLetter =
    displayName
      .charAt(0)
      .toUpperCase();

  const isMutual =
    isFollowing &&
    isFollowedBy;

  return (
    <View
      style={styles.container}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
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
          style={styles.profile}
        >
          <View
            style={styles.topRow}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {avatarLetter}
              </Text>
            </View>

            {currentUserId !==
              profile.id && (
              <Pressable
                style={[
                  styles.followButton,

                  isFollowing &&
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

                    isFollowing &&
                      styles.followingText,
                  ]}
                >
                  {followLoading
                    ? '...'
                    : isMutual
                      ? 'Mutual'
                      : isFollowing
                        ? 'Following'
                        : 'Follow'}
                </Text>
              </Pressable>
            )}
          </View>

          <Text
            style={styles.name}
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
              style={styles.bio}
            >
              {profile.bio}
            </Text>
          )}

          {!!profile.city && (
            <Text
              style={styles.city}
            >
              {profile.city}
            </Text>
          )}

          <View
            style={styles.stats}
          >
            {profile.show_followers && (
              <View
                style={styles.stat}
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {followersCount}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Followers
                </Text>
              </View>
            )}

            {profile.show_following && (
              <View
                style={styles.stat}
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {followingCount}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Following
                </Text>
              </View>
            )}

            <View
              style={styles.stat}
            >
              <Text
                style={
                  styles.statNumber
                }
              >
                {userDrops.length}
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

        {userDrops.length === 0 ? (
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
                key={drop.id}
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
                  {drop.meta}
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

    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor:
        '#222222',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    avatarText: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '600',
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