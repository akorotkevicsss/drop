import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
  location_text: string | null;
  event_time: string | null;
  event_end_time: string | null;
  status: string | null;
  created_at: string;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
};


function formatEventRange(startValue: string | null, endValue: string | null) {
  if (!startValue) return null;
  const start = new Date(startValue); if (Number.isNaN(start.getTime())) return null;
  const date = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  const st = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!endValue) return `${date} · ${st}`;
  const end = new Date(endValue); if (Number.isNaN(end.getTime())) return `${date} · ${st}`;
  const et = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const same = start.toDateString() === end.toDateString();
  return same ? `${date} · ${st}–${et}` : `${date} ${st} → ${end.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase()} ${et}`;
}
function dropStatusLabel(status: string | null | undefined, endValue: string | null) {
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'ended') return 'ENDED';
  if (endValue && new Date(endValue).getTime() < Date.now()) return 'ENDED';
  return null;
}
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
        .select(`
          id,
          text,
          city,
          location_text,
          event_time,
          event_end_time,
          status,
          created_at,
          background_color,
          image_path,
          attached_image_path
        `)
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
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <Text style={styles.headerSubtitle}>
            Manage your identity, connections and Drops.
          </Text>
        </View>

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

      <ScrollView contentContainerStyle={styles.scroll}>
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
        </View>

        {myDrops.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet.</Text>
            <Text style={styles.muted}>
              Your active Drops will live here.
            </Text>
          </View>
        ) : (
          myDrops.map((drop) => {
            const imageUrl =
              drop.image_path
                ? supabase.storage
                    .from('drop-images')
                    .getPublicUrl(drop.image_path)
                    .data.publicUrl
                : null;

            const attachedImageUrl =
              drop.attached_image_path
                ? supabase.storage
                    .from('drop-images')
                    .getPublicUrl(drop.attached_image_path)
                    .data.publicUrl
                : null;

            const hasBackground =
              !!drop.background_color ||
              !!imageUrl;

            const location =
              drop.location_text ||
              drop.city;

            return (
              <Pressable key={drop.id} style={styles.drop} onPress={() => router.push({ pathname: '/drop/[id]', params: { id: drop.id } } as any)}>
                {hasBackground ? (
                  imageUrl ? (
                    <ImageBackground
                      source={{ uri: imageUrl }}
                      style={styles.dropVisual}
                      imageStyle={styles.dropVisualImage}
                    >
                      <View style={styles.dropVisualOverlay}>
                        <Text style={styles.dropVisualText}>
                          {drop.text}
                        </Text>
                      </View>
                    </ImageBackground>
                  ) : (
                    <View
                      style={[
                        styles.dropVisual,
                        {
                          backgroundColor:
                            drop.background_color ??
                            DropColors.surface,
                        },
                      ]}
                    >
                      <Text style={styles.dropVisualText}>
                        {drop.text}
                      </Text>
                    </View>
                  )
                ) : (
                  <Text style={styles.dropText}>
                    {drop.text}
                  </Text>
                )}

                {!!attachedImageUrl && (
                  <ImageBackground
                    source={{ uri: attachedImageUrl }}
                    style={styles.attachedImage}
                    imageStyle={styles.attachedImageRadius}
                  />
                )}

                {dropStatusLabel(drop.status, drop.event_end_time) && <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{dropStatusLabel(drop.status, drop.event_end_time)}</Text></View>}
                {!!formatEventRange(drop.event_time, drop.event_end_time) && <Text style={styles.eventMeta}>◷  {formatEventRange(drop.event_time, drop.event_end_time)}</Text>}
                <Text style={styles.dropMeta}>
                  {location ? `${location} · ` : ''}
                  {formatDropTime(drop.created_at)}
                </Text>
              </Pressable>
            );
          })
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
    minHeight: 128,
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 16,
  },
  headerTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 30,
    lineHeight: 36,
  },
  headerSubtitle: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  iconButton: {
    width: 38,
    height: 38,
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
    minHeight: 56,
    paddingHorizontal: 22,
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
    color: DropColors.warmWhite,
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
  dropVisual: {
    minHeight: 180,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  dropVisualImage: {
    borderRadius: 16,
  },
  dropVisualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  dropVisualText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 20,
    lineHeight: 26,
  },
  attachedImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  attachedImageRadius: {
    borderRadius: 16,
  },
  statusBadge: { alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#2A1717', borderWidth: StyleSheet.hairlineWidth, borderColor: DropColors.wine },
  statusBadgeText: { color: DropColors.warmWhite, fontFamily: DropTypography.semibold, fontSize: 9, letterSpacing: 1 },
  eventMeta: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 11, marginTop: 8 },
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