import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { HeartIcon } from '@/components/icons/HeartIcon';
import { UserAvatar } from '@/components/user-avatar';
import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type DropStatus = 'active' | 'ended' | 'cancelled';
type JoinMode = 'request' | 'free' | 'invite_only';
type JoinStatus = 'none' | 'pending' | 'accepted' | 'declined';

type DropRow = {
  id: string;
  author_id: string;
  text: string;
  city: string | null;
  event_time: string | null;
  event_end_time: string | null;
  location_text: string | null;
  join_enabled: boolean;
  join_until: string | null;
  join_limit: number | null;
  join_mode: JoinMode;
  reply_enabled: boolean;
  comments_enabled: boolean;
  age_restriction: string | null;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
  attached_video_path: string | null;
  dress_code: string | null;
  conditions: string | null;
  price_text: string | null;
  language_text: string | null;
  hashtags: string[] | null;
  status: DropStatus;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function formatEventDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getStatusLabel(drop: DropRow) {
  if (drop.status === 'ended') return 'THIS DROP HAS ENDED';
  if (drop.status === 'cancelled') return 'THIS DROP WAS CANCELLED';
  if (drop.event_time && new Date(drop.event_time).getTime() < Date.now()) {
    return 'THIS DROP HAS ENDED';
  }
  return null;
}

export default function DropDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [drop, setDrop] = useState<DropRow | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('none');
  const [participantCount, setParticipantCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data: dropData, error: dropError } = await supabase
        .from('drops')
        .select(`
          id, author_id, text, city, event_time, event_end_time, location_text,
          join_enabled, join_until, join_limit, join_mode, reply_enabled,
          comments_enabled, age_restriction, background_color, image_path,
          attached_image_path, attached_video_path, dress_code, conditions,
          price_text, language_text, hashtags, status, created_at
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (dropError || !dropData) {
        console.error('DROP DETAIL ERROR:', dropError);
        setDrop(null);
        return;
      }

      const nextDrop = dropData as DropRow;
      setDrop(nextDrop);

      const [{ data: profileData }, { count: likes }, { count: participants }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', nextDrop.author_id)
          .maybeSingle(),
        supabase
          .from('drop_likes')
          .select('*', { count: 'exact', head: true })
          .eq('drop_id', nextDrop.id),
        supabase
          .from('join_requests')
          .select('*', { count: 'exact', head: true })
          .eq('drop_id', nextDrop.id)
          .eq('status', 'accepted')
          .neq('user_id', nextDrop.author_id),
      ]);

      setAuthor((profileData as Profile | null) ?? null);
      setLikeCount(likes ?? 0);
      setParticipantCount(participants ?? 0);

      if (user && user.id !== nextDrop.author_id) {
        const [{ data: request }, { data: like }] = await Promise.all([
          supabase
            .from('join_requests')
            .select('status')
            .eq('drop_id', nextDrop.id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('drop_likes')
            .select('drop_id')
            .eq('drop_id', nextDrop.id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        setJoinStatus((request?.status as JoinStatus | undefined) ?? 'none');
        setLiked(!!like);
      } else {
        setJoinStatus('none');
        setLiked(false);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const imageUrl = useMemo(() => {
    if (!drop?.image_path) return null;
    return supabase.storage.from('drop-images').getPublicUrl(drop.image_path).data.publicUrl;
  }, [drop?.image_path]);

  const attachedImageUrl = useMemo(() => {
    if (!drop?.attached_image_path) return null;
    return supabase.storage.from('drop-images').getPublicUrl(drop.attached_image_path).data.publicUrl;
  }, [drop?.attached_image_path]);

  const isOwner = !!drop && currentUserId === drop.author_id;
  const ended = !!drop && (drop.status !== 'active' || (!!drop.event_time && new Date(drop.event_time).getTime() < Date.now()));
  const statusLabel = drop ? getStatusLabel(drop) : null;
  const eventLabel = drop ? formatEventDate(drop.event_time) : null;

  const toggleLike = async () => {
    if (!drop || !currentUserId || isOwner || actionLoading || ended) return;
    try {
      setActionLoading(true);
      if (liked) {
        const { error } = await supabase.from('drop_likes').delete().eq('drop_id', drop.id).eq('user_id', currentUserId);
        if (error) throw error;
        setLiked(false);
        setLikeCount((value) => Math.max(0, value - 1));
      } else {
        const { error } = await supabase.from('drop_likes').insert({ drop_id: drop.id, user_id: currentUserId });
        if (error) throw error;
        setLiked(true);
        setLikeCount((value) => value + 1);
      }
    } catch (error) {
      console.error('DROP LIKE ERROR:', error);
      Alert.alert('Error', 'Could not update Like.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!drop || !currentUserId || isOwner || actionLoading || ended || !drop.join_enabled) return;
    if (drop.join_mode === 'invite_only') {
      Alert.alert('Invite only', 'Contact the organizer first. The organizer can invite you to this Drop.');
      return;
    }
    try {
      setActionLoading(true);
      if (joinStatus === 'pending') {
        const { error } = await supabase.from('join_requests').delete().eq('drop_id', drop.id).eq('user_id', currentUserId);
        if (error) throw error;
        setJoinStatus('none');
        return;
      }
      if (joinStatus === 'accepted') return;
      if (joinStatus === 'declined') {
        await supabase.from('join_requests').delete().eq('drop_id', drop.id).eq('user_id', currentUserId);
      }
      const nextStatus = drop.join_mode === 'free' ? 'accepted' : 'pending';
      const { error } = await supabase.from('join_requests').insert({
        drop_id: drop.id,
        user_id: currentUserId,
        status: nextStatus,
      });
      if (error) throw error;
      setJoinStatus(nextStatus);
      if (nextStatus === 'accepted') setParticipantCount((value) => value + 1);
    } catch (error) {
      console.error('DROP JOIN ERROR:', error);
      Alert.alert('Error', 'Could not update your participation.');
    } finally {
      setActionLoading(false);
    }
  };

  const openAuthor = () => {
    if (!author?.username) return;
    router.push(`/user/${encodeURIComponent(author.username)}`);
  };

  if (loading) {
    return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator color={DropColors.warmWhite} /></View>;
  }

  if (!drop) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.stateTitle}>Drop unavailable.</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Go back</Text></Pressable>
      </View>
    );
  }

  const displayName = author?.display_name || author?.username || 'User';
  const detailRows = [
    drop.age_restriction
      ? ['Age', `${drop.age_restriction.replace(/\+$/, '')}+`]
      : null,
    drop.dress_code ? ['Dress code', drop.dress_code] : null,
    drop.price_text ? ['Price', drop.price_text] : null,
    drop.language_text ? ['Language', drop.language_text] : null,
    drop.conditions ? ['Conditions', drop.conditions] : null,
    drop.join_limit
      ? ['Capacity', `${participantCount}/${drop.join_limit}`]
      : participantCount > 0
        ? ['Going', `${participantCount}`]
        : null,
  ].filter(Boolean) as [string, string][];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DROP</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.authorRow} onPress={openAuthor}>
          <UserAvatar uri={author?.avatar_url} name={displayName} size={44} />
          <View style={styles.authorCopy}>
            <Text style={styles.authorName}>{displayName}</Text>
            {!!author?.username && <Text style={styles.username}>@{author.username}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={DropColors.textMuted} />
        </Pressable>

        {!!statusLabel && <View style={styles.statusBand}><Text style={styles.statusText}>{statusLabel}</Text></View>}

        {imageUrl ? (
          <ImageBackground source={{ uri: imageUrl }} style={styles.poster} imageStyle={styles.posterImage}>
            <View style={styles.posterOverlay}><Text style={styles.posterText}>{drop.text}</Text></View>
          </ImageBackground>
        ) : drop.background_color ? (
          <View style={[styles.poster, styles.colorPoster, { backgroundColor: drop.background_color }]}>
            <Text style={styles.posterText}>{drop.text}</Text>
          </View>
        ) : (
          <Text style={styles.mainText}>{drop.text}</Text>
        )}

        {!!attachedImageUrl && <ImageBackground source={{ uri: attachedImageUrl }} style={styles.attachment} imageStyle={styles.attachmentImage} />}

        {(eventLabel || drop.location_text) && (
          <View style={styles.primaryInfo}>
            {!!eventLabel && <View style={styles.infoRow}><Ionicons name="calendar-outline" size={18} color={DropColors.warmWhite} /><View><Text style={styles.infoLabel}>WHEN</Text><Text style={styles.infoValue}>{eventLabel}</Text></View></View>}
            {!!drop.location_text && <View style={styles.infoRow}><Ionicons name="location-outline" size={18} color={DropColors.warmWhite} /><View style={styles.infoCopy}><Text style={styles.infoLabel}>WHERE</Text><Text style={styles.infoValue}>{drop.location_text}</Text></View></View>}
          </View>
        )}

        {detailRows.length > 0 && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            {detailRows.map(([label, value]) => (
              <View style={styles.detailRow} key={label}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {!!drop.hashtags?.length && (
          <View style={styles.hashtags}>{drop.hashtags.map((tag) => <Text style={styles.hashtag} key={tag}>#{tag.replace(/^#/, '')}</Text>)}</View>
        )}

        <View style={styles.socialRow}>
          <View style={styles.socialMetric}><HeartIcon liked={liked || isOwner} size={20} /><Text style={styles.socialText}>{likeCount}</Text></View>
          {drop.join_limit ? <Text style={styles.socialText}>{participantCount}/{drop.join_limit} going</Text> : participantCount > 0 ? <Text style={styles.socialText}>{participantCount} going</Text> : null}
        </View>

        {drop.comments_enabled && !ended && (
          <Pressable style={styles.sectionLink} onPress={() => Alert.alert('Comments', 'Comments UI is the next Drop v2 layer.')}>
            <View><Text style={styles.sectionLinkTitle}>Comments</Text><Text style={styles.sectionLinkSubtitle}>Questions and public discussion</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}

        {isOwner ? (
          <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/drop/[id]/manage', params: { id: drop.id } } as any)}>
            <Text style={styles.primaryButtonText}>Manage Drop</Text>
          </Pressable>
        ) : !ended ? (
          <View style={styles.bottomActions}>
            {drop.join_enabled && (
              <Pressable style={[styles.primaryButton, styles.flexButton, joinStatus !== 'none' && styles.secondaryButton]} onPress={handleJoin} disabled={actionLoading}>
                <Text style={styles.primaryButtonText}>{actionLoading ? '...' : joinStatus === 'pending' ? 'Requested' : joinStatus === 'accepted' ? 'Joined' : drop.join_mode === 'invite_only' ? 'Invite only' : 'Join'}</Text>
              </Pressable>
            )}
            <Pressable style={styles.iconAction} onPress={toggleLike} disabled={actionLoading}><HeartIcon liked={liked} size={23} /></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DropColors.graphite },
  center: { flex: 1, backgroundColor: DropColors.graphite, alignItems: 'center', justifyContent: 'center', gap: 14 },
  header: { paddingTop: 52, minHeight: 96, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 42 },
  back: { color: DropColors.warmWhite, fontFamily: DropTypography.light, fontSize: 36, lineHeight: 38 },
  headerTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.semibold, fontSize: 15, letterSpacing: 1.7 },
  content: { paddingBottom: 42 },
  authorRow: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  authorCopy: { flex: 1, marginLeft: 11 },
  authorName: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 14 },
  username: { color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 12, marginTop: 2 },
  statusBand: { minHeight: 38, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: '#151515', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  statusText: { color: DropColors.textMuted, fontFamily: DropTypography.medium, fontSize: 10, letterSpacing: 1.1 },
  poster: { marginHorizontal: 18, marginTop: 18, minHeight: 280, borderRadius: 18, overflow: 'hidden', justifyContent: 'center' },
  posterImage: { borderRadius: 18 },
  posterOverlay: { minHeight: 280, padding: 22, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.64)' },
  colorPoster: { padding: 22 },
  posterText: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 24, lineHeight: 31 },
  mainText: { color: DropColors.warmWhite, fontFamily: DropTypography.regular, fontSize: 23, lineHeight: 31, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 6 },
  attachment: { marginHorizontal: 18, marginTop: 16, aspectRatio: 4 / 3, borderRadius: 18, overflow: 'hidden', backgroundColor: DropColors.surface },
  attachmentImage: { borderRadius: 18 },
  primaryInfo: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: DropColors.border },
  infoRow: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  infoCopy: { flex: 1 },
  infoLabel: { color: DropColors.textMuted, fontFamily: DropTypography.medium, fontSize: 9, letterSpacing: 1.1, marginBottom: 3 },
  infoValue: { color: DropColors.warmWhite, fontFamily: DropTypography.regular, fontSize: 14, lineHeight: 19 },
  detailsSection: { marginTop: 24 },
  sectionLabel: { paddingHorizontal: 18, color: DropColors.textMuted, fontFamily: DropTypography.medium, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  detailRow: { minHeight: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  detailLabel: { width: 92, color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 12 },
  detailValue: { flex: 1, color: DropColors.warmWhite, fontFamily: DropTypography.regular, fontSize: 13, lineHeight: 18 },
  hashtags: { paddingHorizontal: 18, marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hashtag: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 12 },
  socialRow: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  socialMetric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialText: { color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 12 },
  sectionLink: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  sectionLinkTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 14 },
  sectionLinkSubtitle: { color: DropColors.textMuted, fontFamily: DropTypography.regular, fontSize: 11, marginTop: 2 },
  chevron: { marginLeft: 'auto', color: DropColors.warmWhite, fontFamily: DropTypography.light, fontSize: 24 },
  bottomActions: { padding: 18, flexDirection: 'row', gap: 10 },
  primaryButton: { marginHorizontal: 18, marginTop: 18, height: 50, borderRadius: 17, backgroundColor: DropColors.wine, alignItems: 'center', justifyContent: 'center' },
  flexButton: { flex: 1, marginHorizontal: 0, marginTop: 0 },
  secondaryButton: { backgroundColor: '#242424', borderWidth: StyleSheet.hairlineWidth, borderColor: DropColors.border },
  primaryButtonText: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 14 },
  iconAction: { width: 50, height: 50, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: DropColors.border, backgroundColor: '#151515', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 16 },
  link: { color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 13 },
});