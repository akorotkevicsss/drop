import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useEffect, useState } from 'react';
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

import { DropFeedMeta } from '@/components/drop-feed-meta';
import { DropRatingPicker } from '@/components/drop-rating-picker';
import { UserAvatar } from '@/components/user-avatar';
import { DropColors, DropTypography } from '@/constants/theme';
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
  location_text: string | null;
  event_time: string | null;
  event_end_time: string | null;
  status: 'active' | 'ended' | 'cancelled';
  age_restriction: string | null;
  join_limit: number | null;
  created_at: string;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
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

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const cleanUsername = username?.replace('@', '') ?? '';

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [userDrops, setUserDrops] = useState<Drop[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [averageEventRate, setAverageEventRate] = useState<number | null>(null);
  const [eventRatingsCount, setEventRatingsCount] = useState(0);
  const [dropAverageRatings, setDropAverageRatings] =
    useState<Record<string, number>>({});
  const [joinStatuses, setJoinStatuses] =
    useState<Record<string, 'none' | 'pending' | 'accepted' | 'declined'>>({});
  const [myRatings, setMyRatings] =
    useState<Record<string, number>>({});
  const [ratingDropId, setRatingDropId] =
    useState<string | null>(null);
  const [ratingValue, setRatingValue] =
    useState(5);
  const [ratingSaving, setRatingSaving] =
    useState(false);

  useEffect(() => {
    loadProfile();
  }, [cleanUsername]);

  const loadProfile = async () => {
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
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Could not find the current user.');
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase.rpc(
        'get_public_profile',
        { target_username: cleanUsername }
      );

      if (error) {
        console.error('PUBLIC PROFILE RPC ERROR:', error);
        Alert.alert('Error', 'Could not load this profile.');
        return;
      }

      const loadedProfile = (data?.[0] ?? null) as PublicProfile | null;

      if (!loadedProfile) {
        setProfile(null);
        setUserDrops([]);
        return;
      }

      setProfile(loadedProfile);

      const {
        data: ratingSummary,
        error: ratingError,
      } =
        await supabase.rpc(
          'get_profile_event_rating',
          {
            p_user_id:
              loadedProfile.id,
          }
        );

      if (ratingError) {
        console.error(
          'PUBLIC EVENT RATE ERROR:',
          ratingError
        );
      } else {
        const summary =
          ratingSummary?.[0];

        setAverageEventRate(
          summary?.average_rating === null ||
          summary?.average_rating === undefined
            ? null
            : Number(
                summary.average_rating
              )
        );

        setEventRatingsCount(
          Number(
            summary?.ratings_count ?? 0
          )
        );
      }

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
          age_restriction,
          join_limit,
          created_at,
          background_color,
          image_path,
          attached_image_path
        `)
        .eq('author_id', loadedProfile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (dropsError) {
        console.error('PUBLIC PROFILE DROPS ERROR:', dropsError);
      } else {
        setUserDrops(dropData ?? []);
      }

      const dropIds =
        (dropData ?? []).map(
          (drop) => drop.id
        );

      if (dropIds.length > 0) {
        const [
          ratingsResult,
          joinResult,
          myRatingsResult,
        ] = await Promise.all([
          supabase
            .from('drop_ratings')
            .select('drop_id,rating')
            .in('drop_id', dropIds),
          supabase
            .from('join_requests')
            .select('drop_id,status')
            .eq('user_id', user.id)
            .in('drop_id', dropIds),
          supabase
            .from('drop_ratings')
            .select('drop_id,rating')
            .eq('user_id', user.id)
            .in('drop_id', dropIds),
        ]);

        const totals:
          Record<string, number> = {};
        const counts:
          Record<string, number> = {};

        (ratingsResult.data ?? []).forEach(
          (row) => {
            totals[row.drop_id] =
              (totals[row.drop_id] ?? 0) +
              Number(row.rating);
            counts[row.drop_id] =
              (counts[row.drop_id] ?? 0) + 1;
          }
        );

        const averages:
          Record<string, number> = {};

        Object.keys(totals).forEach(
          (dropId) => {
            averages[dropId] =
              Math.round(
                (
                  totals[dropId] /
                  counts[dropId]
                ) * 10
              ) / 10;
          }
        );

        setDropAverageRatings(averages);

        const nextStatuses:
          Record<
            string,
            'none' | 'pending' | 'accepted' | 'declined'
          > = {};

        (joinResult.data ?? []).forEach(
          (row) => {
            nextStatuses[row.drop_id] =
              row.status;
          }
        );

        setJoinStatuses(nextStatuses);

        const nextRatings:
          Record<string, number> = {};

        (myRatingsResult.data ?? []).forEach(
          (row) => {
            nextRatings[row.drop_id] =
              Number(row.rating);
          }
        );

        setMyRatings(nextRatings);
      } else {
        setDropAverageRatings({});
        setJoinStatuses({});
        setMyRatings({});
      }
    } finally {
      setLoading(false);
    }
  };

  const openRating = (dropId: string) => {
    setRatingDropId(dropId);
    setRatingValue(
      myRatings[dropId] ?? 5
    );
  };

  const saveRating = async () => {
    if (!ratingDropId || ratingSaving) return;

    try {
      setRatingSaving(true);

      const { error } = await supabase.rpc(
        'rate_ended_drop',
        {
          p_drop_id: ratingDropId,
          p_rating: ratingValue,
        }
      );

      if (error) throw error;

      setMyRatings(
        (current) => ({
          ...current,
          [ratingDropId]: ratingValue,
        })
      );

      setRatingDropId(null);
      await loadProfile();
    } catch (error) {
      console.error(
        'PROFILE RATE DROP ERROR:',
        error
      );
      Alert.alert(
        'Rate',
        'Could not save your rate.'
      );
    } finally {
      setRatingSaving(false);
    }
  };

  const toggleFollow = async () => {
    if (
      !profile ||
      !currentUserId ||
      currentUserId === profile.id ||
      followLoading
    ) {
      return;
    }

    try {
      setFollowLoading(true);

      if (profile.is_following) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profile.id);

        if (error) {
          Alert.alert('Error', 'Could not unfollow this user.');
          return;
        }
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: profile.id,
        });

        if (error) {
          Alert.alert('Error', 'Could not follow this user.');
          return;
        }
      }

      await loadProfile();
    } finally {
      setFollowLoading(false);
    }
  };

  const openMessage = async () => {
    if (!profile || !currentUserId || messageLoading) return;

    try {
      setMessageLoading(true);

      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('conversation_type', 'direct')
        .or(
          `and(author_id.eq.${currentUserId},participant_id.eq.${profile.id}),and(author_id.eq.${profile.id},participant_id.eq.${currentUserId})`
        )
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error('PROFILE FIND DIRECT ERROR:', existingError);
      }

      if (existing?.id) {
        router.push(`/chat/${existing.id}`);
        return;
      }

      const { data: conversation, error: conversationError } =
        await supabase
          .from('conversations')
          .insert({
            author_id: currentUserId,
            participant_id: profile.id,
            conversation_type: 'direct',
            created_by: currentUserId,
            is_request: true,
            source: 'direct',
            drop_id: null,
            join_request_id: null,
          })
          .select('id')
          .single();

      if (conversationError || !conversation) {
        console.error(
          'PROFILE CREATE REQUEST ERROR:',
          conversationError
        );
        Alert.alert('Error', 'Could not send this message request.');
        return;
      }

      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: currentUserId,
            is_admin: true,
            last_read_at: new Date().toISOString(),
          },
          {
            conversation_id: conversation.id,
            user_id: profile.id,
            is_admin: false,
          },
        ]);

      if (memberError && memberError.code !== '23505') {
        console.error(
          'PROFILE CREATE REQUEST MEMBERS ERROR:',
          memberError
        );
      }

      router.push(`/chat/${conversation.id}`);
    } finally {
      setMessageLoading(false);
    }
  };

  const openConnections = (type: 'followers' | 'following') => {
    if (!profile?.username) return;

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
      <View style={styles.center}>
        <ActivityIndicator color={DropColors.warmWhite} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>User not found.</Text>
      </View>
    );
  }

  const displayName = profile.display_name || 'Unnamed user';
  const isOwner = currentUserId === profile.id;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.wordmark}>DROP</Text>
        <View style={styles.headerSpacer} />
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
          {(isOwner || profile.can_view_followers) && (
            <Pressable
              style={styles.stat}
              onPress={() => openConnections('followers')}
            >
              <Text style={styles.statNumber}>
                {profile.followers_count}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
          )}

          <View style={styles.statDivider} />

          {(isOwner || profile.can_view_following) && (
            <Pressable
              style={styles.stat}
              onPress={() => openConnections('following')}
            >
              <Text style={styles.statNumber}>
                {profile.following_count}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          )}

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{userDrops.length}</Text>
            <Text style={styles.statLabel}>Drops</Text>
          </View>
        </View>

        {averageEventRate !== null && (
          <View style={styles.eventRateRow}>
            <View>
              <Text style={styles.eventRateLabel}>
                Average event rate
              </Text>

              <Text style={styles.eventRateMeta}>
                {eventRatingsCount}{' '}
                {eventRatingsCount === 1
                  ? 'rating'
                  : 'ratings'}
              </Text>
            </View>

            <Text style={styles.eventRateValue}>
              ★ {averageEventRate.toFixed(1)}
            </Text>
          </View>
        )}

        {!isOwner && (
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.action,
                profile.is_following
                  ? styles.followActionActive
                  : styles.followAction,
              ]}
              onPress={toggleFollow}
              disabled={followLoading}
            >
              <Text style={styles.actionLabel}>
                {followLoading
                  ? '...'
                  : profile.is_mutual
                    ? 'Mutual'
                    : profile.is_following
                      ? 'Following'
                      : 'Follow'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.action,
                styles.messageAction,
              ]}
              onPress={openMessage}
              disabled={messageLoading}
            >
              <Text style={styles.messageLabel}>
                {messageLoading ? '...' : 'Message'}
              </Text>
            </Pressable>
          </View>
        )}
        
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DROPS</Text>
        </View>

        {userDrops.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>No active Drops.</Text>
          </View>
        ) : (
          userDrops.map((drop) => {
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

            const joinStatus =
              joinStatuses[drop.id] ?? 'none';

            const averageRating =
              dropAverageRatings[drop.id];

            const myRating =
              myRatings[drop.id];

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

                <DropFeedMeta
                  eventTime={drop.event_time}
                  eventEndTime={drop.event_end_time}
                  status={drop.status}
                  location={location}
                  ageRestriction={drop.age_restriction}
                  joinLimit={drop.join_limit}
                />
                <Text style={styles.dropMeta}>{formatDropTime(drop.created_at)}</Text>

                {drop.status === 'ended' &&
                  (
                    joinStatus === 'accepted'
                      ? true
                      : averageRating !== undefined
                  ) && (
                    <View style={styles.cardRateRow}>
                      {joinStatus === 'accepted' ? (
                        <Pressable
                          style={styles.cardRateButton}
                          onPress={(event) => {
                            event.stopPropagation();
                            openRating(drop.id);
                          }}
                        >
                          <Text style={styles.cardRateText}>
                            {myRating !== undefined
                              ? `★ ${myRating.toFixed(1)}`
                              : 'Rate'}
                          </Text>
                        </Pressable>
                      ) : averageRating !== undefined ? (
                        <View style={styles.cardRateButton}>
                          <Text style={styles.cardRateText}>
                            ★ {averageRating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <DropRatingPicker
        visible={ratingDropId !== null}
        value={ratingValue}
        saving={ratingSaving}
        onChange={setRatingValue}
        onClose={() =>
          setRatingDropId(null)
        }
        onSave={saveRating}
      />
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
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 38,
    lineHeight: 38,
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 16,
    letterSpacing: 4,
  },
  headerSpacer: { width: 24 },
  scroll: { paddingBottom: 40 },
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
  eventRateRow: {
    minHeight: 62,
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventRateLabel: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 14,
  },
  eventRateMeta: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  eventRateValue: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 16,
  },
  actions: {
    width: '100%',
  },
  action: {
    width: '100%',
    height: 56,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  followAction: {
    backgroundColor: '#151515',
  },
  followActionActive: {
    backgroundColor: '#242424',
  },
  messageAction: {
    backgroundColor: DropColors.wine,
  },
  actionLabel: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 14,
  },
  messageLabel: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 14,
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
  dropMeta: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    marginTop: 7,
  },
  cardRateRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  cardRateButton: {
    minHeight: 34,
    minWidth: 66,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    backgroundColor: DropColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRateText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 12,
  },
  empty: { paddingHorizontal: 22, paddingTop: 26 },
  muted: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 14,
  },
});