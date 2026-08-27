import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { DropColors, DropTypography } from '@/constants/theme';
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

function formatDropTime(createdAt: string) {
  const minutes = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60000
  );
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myDrops, setMyDrops] = useState<Drop[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Profile error', 'Could not find the current user.');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, city, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('LOAD PROFILE ERROR:', profileError);
        Alert.alert('Profile error', profileError.message);
        return;
      }

      const { count: followers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: following } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      const { data: dropData, error: dropsError } = await supabase
        .from('drops')
        .select('id, text, city, created_at')
        .eq('author_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (dropsError) {
        console.error('PROFILE DROPS ERROR:', dropsError);
      }

      setProfile(profileData);
      setFollowersCount(followers ?? 0);
      setFollowingCount(following ?? 0);
      setMyDrops(dropData ?? []);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const openConnections = (type: 'followers' | 'following') => {
    if (!profile?.username) return;

    router.push(
      `/connections/${type}?username=${encodeURIComponent(profile.username)}`
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={DropColors.warmWhite} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Profile could not be loaded.</Text>
      </View>
    );
  }

  const displayName = profile.display_name || 'Unnamed user';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>DROP</Text>

          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={styles.iconButton}
          >
            <IconSymbol
              name="gearshape"
              size={21}
              color={DropColors.warmWhite}
            />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <UserAvatar
            uri={profile.avatar_url}
            name={displayName}
            size={92}
          />

          <View style={styles.nameBlock}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
          </View>
        </View>

        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {!!profile.city && (
          <Text style={styles.city}>{profile.city.toUpperCase()}</Text>
        )}

        <View style={styles.stats}>
          <Pressable
            style={styles.stat}
            onPress={() => openConnections('followers')}
          >
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>

          <View style={styles.statDivider} />

          <Pressable
            style={styles.stat}
            onPress={() => openConnections('following')}
          >
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{myDrops.length}</Text>
            <Text style={styles.statLabel}>Drops</Text>
          </View>
        </View>

        <Pressable
          style={styles.lineAction}
          onPress={() => router.push('/edit-profile')}
        >
          <Text style={styles.lineActionText}>Edit profile</Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YOUR DROPS</Text>
          <Text style={styles.sectionCount}>{myDrops.length}</Text>
        </View>

        {myDrops.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet.</Text>
            <Text style={styles.muted}>
              Your active Drops will live here.
            </Text>
          </View>
        ) : (
          myDrops.map((drop) => (
            <View key={drop.id} style={styles.drop}>
              <Text style={styles.dropText}>{drop.text}</Text>
              <Text style={styles.dropMeta}>
                {drop.city ? `${drop.city} · ` : ''}
                {formatDropTime(drop.created_at)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DropColors.graphite },
  center: {
    flex: 1,
    backgroundColor: DropColors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 40 },
  header: {
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 18,
    letterSpacing: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    paddingHorizontal: 22,
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  nameBlock: { flex: 1 },
  name: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 26,
  },
  username: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 14,
    marginTop: 3,
  },
  bio: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 22,
    marginTop: 22,
  },
  city: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    paddingHorizontal: 22,
    marginTop: 10,
  },
  stats: {
    marginTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    flexDirection: 'row',
    minHeight: 72,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: DropColors.border,
    marginVertical: 16,
  },
  statNumber: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 16,
  },
  statLabel: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    marginTop: 3,
  },
  lineAction: {
    marginHorizontal: 22,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineActionText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 14,
  },
  chevron: {
    color: DropColors.wine,
    fontFamily: DropTypography.light,
    fontSize: 22,
  },
  sectionHeader: {
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.bold,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  sectionCount: {
    color: DropColors.wine,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  drop: {
    paddingHorizontal: 22,
    paddingVertical: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  dropText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  dropMeta: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    marginTop: 7,
  },
  empty: {
    paddingHorizontal: 22,
    paddingTop: 30,
  },
  emptyTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 16,
    marginBottom: 5,
  },
  muted: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 14,
  },
});