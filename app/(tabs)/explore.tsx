import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
};

type FollowRow = {
  following_id: string;
};

export default function ExploreScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null
  );

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    new Set()
  );

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [changingFollowId, setChangingFollowId] = useState<
    string | null
  >(null);

  const loadExplore = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('EXPLORE USER ERROR:', userError);
        Alert.alert('Error', 'Could not find the current user.');
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData, error: profilesError } =
        await supabase
          .from('profiles')
          .select(`
            id,
            username,
            display_name,
            bio,
            city
          `)
          .neq('id', user.id)
          .order('created_at', {
            ascending: false,
          });

      if (profilesError) {
        console.error(
          'EXPLORE PROFILES ERROR:',
          profilesError
        );

        Alert.alert(
          'Error',
          'Could not load profiles.'
        );

        return;
      }

      const { data: followData, error: followsError } =
        await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

      if (followsError) {
        console.error(
          'EXPLORE FOLLOWS ERROR:',
          followsError
        );

        Alert.alert(
          'Error',
          'Could not load follow information.'
        );

        return;
      }

      setProfiles(profileData ?? []);

      const nextFollowingIds = new Set(
        ((followData ?? []) as FollowRow[]).map(
          (follow) => follow.following_id
        )
      );

      setFollowingIds(nextFollowingIds);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadExplore();
    }, [])
  );

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const username =
        profile.username?.toLowerCase() ?? '';

      const displayName =
        profile.display_name?.toLowerCase() ?? '';

      const city =
        profile.city?.toLowerCase() ?? '';

      return (
        username.includes(query) ||
        displayName.includes(query) ||
        city.includes(query)
      );
    });
  }, [profiles, search]);

  const toggleFollow = async (profileId: string) => {
    if (!currentUserId || changingFollowId) {
      return;
    }

    const isFollowing =
      followingIds.has(profileId);

    try {
      setChangingFollowId(profileId);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId);

        if (error) {
          console.error('UNFOLLOW ERROR:', error);

          Alert.alert(
            'Error',
            'Could not unfollow this user.'
          );

          return;
        }

        setFollowingIds((current) => {
          const next = new Set(current);
          next.delete(profileId);
          return next;
        });

        return;
      }

      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: currentUserId,
          following_id: profileId,
        });

      if (error) {
        console.error('FOLLOW ERROR:', error);

        Alert.alert(
          'Error',
          'Could not follow this user.'
        );

        return;
      }

      setFollowingIds((current) => {
        const next = new Set(current);
        next.add(profileId);
        return next;
      });
    } finally {
      setChangingFollowId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Explore
        </Text>

        <Text style={styles.subtitle}>
          Find people on DROP.
        </Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search name or @username"
          placeholderTextColor="#555555"
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
      >
        {filteredProfiles.length === 0 ? (
          <Text style={styles.emptyText}>
            No people found.
          </Text>
        ) : (
          filteredProfiles.map((profile) => {
            const isFollowing =
              followingIds.has(profile.id);

            const displayName =
              profile.display_name ||
              'Unnamed user';

            const avatarLetter =
              displayName
                .charAt(0)
                .toUpperCase();

            return (
              <Pressable
                key={profile.id}
                style={styles.user}
                onPress={() => {
                  if (!profile.username) {
                    return;
                  }

                  router.push(
                    `/user/${profile.username}`
                  );
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {avatarLetter}
                  </Text>
                </View>

                <View style={styles.userContent}>
                  <Text style={styles.name}>
                    {displayName}
                  </Text>

                  {!!profile.username && (
                    <Text style={styles.username}>
                      @{profile.username}
                    </Text>
                  )}

                  {!!profile.bio && (
                    <Text
                      style={styles.bio}
                      numberOfLines={1}
                    >
                      {profile.bio}
                    </Text>
                  )}

                  {!!profile.city && (
                    <Text style={styles.city}>
                      {profile.city}
                    </Text>
                  )}
                </View>

                <Pressable
                  style={[
                    styles.followButton,
                    isFollowing &&
                      styles.followingButton,
                  ]}
                  disabled={
                    changingFollowId === profile.id
                  }
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleFollow(profile.id);
                  }}
                >
                  <Text
                    style={[
                      styles.followText,
                      isFollowing &&
                        styles.followingText,
                    ]}
                  >
                    {changingFollowId === profile.id
                      ? '...'
                      : isFollowing
                        ? 'Following'
                        : 'Follow'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    color: '#666666',
    fontSize: 14,
    marginTop: 6,
  },

  searchInput: {
    marginTop: 18,
    backgroundColor: '#151515',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#FFFFFF',
    fontSize: 15,
  },

  user: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  userContent: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  username: {
    color: '#666666',
    fontSize: 13,
    marginTop: 2,
  },

  bio: {
    color: '#777777',
    fontSize: 13,
    marginTop: 5,
  },

  city: {
    color: '#555555',
    fontSize: 12,
    marginTop: 4,
  },

  followButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 82,
    alignItems: 'center',
  },

  followingButton: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#444444',
  },

  followText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },

  followingText: {
    color: '#FFFFFF',
  },

  emptyText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 40,
  },
});