import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

import { UserAvatar } from '@/components/user-avatar';
import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Participant = { requestId: string; profile: Profile };
type DropRow = { id: string; text: string; status: 'active' | 'ended' | 'cancelled'; event_time: string | null };

export default function ManageDropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [drop, setDrop] = useState<DropRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: dropData, error: dropError } = await supabase
        .from('drops')
        .select('id,text,status,event_time')
        .eq('id', id)
        .eq('author_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (dropError || !dropData) {
        setDrop(null);
        return;
      }
      setDrop(dropData as DropRow);

      const { data: requests, error: requestError } = await supabase
        .from('join_requests')
        .select('id,user_id,status')
        .eq('drop_id', id);
      if (requestError) throw requestError;
      const accepted = (requests ?? []).filter((item) => item.status === 'accepted');
      setPendingCount((requests ?? []).filter((item) => item.status === 'pending').length);
      const ids = accepted.map((item) => item.user_id);
      if (!ids.length) {
        setParticipants([]);
        return;
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', ids);
      const profiles = (profileData ?? []) as Profile[];
      setParticipants(accepted.flatMap((request) => {
        const profile = profiles.find((item) => item.id === request.user_id);
        return profile ? [{ requestId: request.id, profile }] : [];
      }));
    } catch (error) {
      console.error('MANAGE DROP LOAD ERROR:', error);
      Alert.alert('Error', 'Could not load Drop management.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeParticipant = (participant: Participant) => {
    const name = participant.profile.display_name || participant.profile.username || 'this participant';
    Alert.alert('Remove participant?', `${name} will leave this Drop.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('join_requests').delete().eq('id', participant.requestId);
          if (error) {
            Alert.alert('Error', 'Could not remove participant.');
            return;
          }
          setParticipants((current) => current.filter((item) => item.requestId !== participant.requestId));
        },
      },
    ]);
  };

  const setStatus = (status: 'ended' | 'cancelled') => {
    if (!drop || working) return;
    const verb = status === 'ended' ? 'End' : 'Cancel';
    Alert.alert(`${verb} Drop?`, status === 'ended' ? 'The Drop stays visible as history, but interactions stop.' : 'Participants will see that this Drop was cancelled.', [
      { text: 'Keep Drop', style: 'cancel' },
      {
        text: verb, style: 'destructive', onPress: async () => {
          try {
            setWorking(true);
            const now = new Date().toISOString();
            const { error } = await supabase.from('drops').update({
              status,
              ended_at: status === 'ended' ? now : null,
              cancelled_at: status === 'cancelled' ? now : null,
            }).eq('id', drop.id).eq('author_id', currentUserId);
            if (error) throw error;
            setDrop({ ...drop, status });
          } catch (error) {
            console.error('DROP STATUS ERROR:', error);
            Alert.alert('Error', `Could not ${verb.toLowerCase()} this Drop.`);
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const deleteDrop = () => {
    if (!drop || working) return;
    Alert.alert('Delete Drop?', 'This removes the Drop from the app. This action is separate from ending it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setWorking(true);
            const { error } = await supabase.from('drops').update({ deleted_at: new Date().toISOString() }).eq('id', drop.id).eq('author_id', currentUserId);
            if (error) throw error;
            router.replace('/');
          } catch (error) {
            console.error('DELETE DROP ERROR:', error);
            Alert.alert('Error', 'Could not delete this Drop.');
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const createDropGroup = async () => {
    if (!drop || !currentUserId || !participants.length || working) return;
    try {
      setWorking(true);
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('drop_id', drop.id)
        .eq('conversation_type', 'group')
        .eq('source', 'group')
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        router.push(`/chat/${existing.id}`);
        return;
      }
      const first = participants[0]?.profile;
      if (!first) return;
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          author_id: currentUserId,
          participant_id: first.id,
          conversation_type: 'group',
          title: drop.text.length > 38 ? `${drop.text.slice(0, 38)}…` : drop.text,
          created_by: currentUserId,
          is_request: false,
          source: 'group',
          drop_id: drop.id,
          join_request_id: null,
        })
        .select('id')
        .single();
      if (conversationError || !conversation) throw conversationError;
      const members = [
        { conversation_id: conversation.id, user_id: currentUserId, is_admin: true, last_read_at: new Date().toISOString() },
        ...participants.map(({ profile }) => ({ conversation_id: conversation.id, user_id: profile.id, is_admin: false, last_read_at: null })),
      ];
      const { error: memberError } = await supabase.from('conversation_members').insert(members);
      if (memberError) throw memberError;
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('DROP GROUP ERROR:', error);
      Alert.alert('Error', 'Could not create the Drop group chat.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator color={DropColors.warmWhite} /></View>;
  if (!drop) return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><Text style={styles.title}>Drop unavailable.</Text></View>;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Manage Drop</Text><Text style={styles.headerSubtitle} numberOfLines={1}>{drop.text}</Text></View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>DROP</Text>
        <ActionRow title="Edit Drop" subtitle="Content, time, place and settings" icon="create-outline" onPress={() => router.push({ pathname: '/drop/[id]/edit', params: { id: drop.id } } as any)} />
        <ActionRow title="Join requests" subtitle={pendingCount ? `${pendingCount} waiting` : 'No pending requests'} icon="person-add-outline" onPress={() => router.push({ pathname: '/requests', params: { dropId: drop.id } })} />
        <ActionRow title="Group chat" subtitle={participants.length ? `Create or open chat with ${participants.length} participant${participants.length === 1 ? '' : 's'}` : 'No participants yet'} icon="chatbubbles-outline" onPress={createDropGroup} disabled={!participants.length || working} />

        <Text style={styles.sectionLabel}>PARTICIPANTS · {participants.length}</Text>
        {participants.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Nobody has joined yet.</Text><Text style={styles.emptyText}>Accepted users will appear here and become part of the active Drop.</Text></View>
        ) : participants.map((participant) => {
          const name = participant.profile.display_name || participant.profile.username || 'User';
          return (
            <Pressable key={participant.requestId} style={styles.participantRow} onPress={() => participant.profile.username && router.push(`/user/${encodeURIComponent(participant.profile.username)}`)}>
              <UserAvatar uri={participant.profile.avatar_url} name={name} size={40} />
              <View style={styles.participantCopy}><Text style={styles.participantName}>{name}</Text>{!!participant.profile.username && <Text style={styles.participantUsername}>@{participant.profile.username}</Text>}</View>
              <Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); removeParticipant(participant); }}><Text style={styles.remove}>Remove</Text></Pressable>
            </Pressable>
          );
        })}

        <Text style={styles.sectionLabel}>LIFECYCLE</Text>
        <View style={styles.statusRow}><Text style={styles.statusLabel}>Status</Text><Text style={styles.statusValue}>{drop.status.toUpperCase()}</Text></View>
        {drop.status === 'active' && <ActionRow title="End Drop" subtitle="Keep it as history and stop interactions" icon="checkmark-circle-outline" onPress={() => setStatus('ended')} />}
        {drop.status === 'active' && <ActionRow title="Cancel Drop" subtitle="Mark the event as cancelled" icon="close-circle-outline" onPress={() => setStatus('cancelled')} danger />}
        <ActionRow title="Delete Drop" subtitle="Remove it from the app" icon="trash-outline" onPress={deleteDrop} danger />
      </ScrollView>
    </View>
  );
}

function ActionRow({ title, subtitle, icon, onPress, danger = false, disabled = false }: { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionRow, disabled && styles.disabled, pressed && !disabled && styles.pressed]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={danger ? '#C86E6E' : DropColors.warmWhite} />
      <View style={styles.actionCopy}><Text style={[styles.actionTitle, danger && styles.danger]}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DropColors.graphite },
  center: { flex: 1, backgroundColor: DropColors.graphite, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 52, minHeight: 104, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  back: { width: 38, color: DropColors.warmWhite, fontFamily: DropTypography.light, fontSize: 36, lineHeight: 38 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.semibold, fontSize: 16 },
  headerSubtitle: { maxWidth: 230, color: DropColors.textMuted, fontFamily: DropTypography.regular, fontSize: 10, marginTop: 3 },
  headerSpacer: { width: 38 },
  content: { paddingBottom: 50 },
  sectionLabel: { marginTop: 24, marginBottom: 8, paddingHorizontal: 18, color: DropColors.textMuted, fontFamily: DropTypography.medium, fontSize: 10, letterSpacing: 1.2 },
  actionRow: { minHeight: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  actionCopy: { flex: 1 },
  actionTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 13 },
  actionSubtitle: { color: DropColors.textMuted, fontFamily: DropTypography.regular, fontSize: 10, marginTop: 3 },
  chevron: { color: DropColors.warmWhite, fontFamily: DropTypography.light, fontSize: 24 },
  participantRow: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  participantCopy: { flex: 1, marginLeft: 11 },
  participantName: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 13 },
  participantUsername: { color: DropColors.textMuted, fontFamily: DropTypography.regular, fontSize: 11, marginTop: 2 },
  remove: { color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 11 },
  empty: { paddingHorizontal: 18, paddingVertical: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border },
  emptyTitle: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 13 },
  emptyText: { color: DropColors.textMuted, fontFamily: DropTypography.regular, fontSize: 10, lineHeight: 15, marginTop: 4 },
  statusRow: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DropColors.border, backgroundColor: '#151515' },
  statusLabel: { color: DropColors.textSecondary, fontFamily: DropTypography.regular, fontSize: 12 },
  statusValue: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 10, letterSpacing: 1.2 },
  danger: { color: '#C86E6E' },
  disabled: { opacity: 0.38 },
  pressed: { backgroundColor: '#151515' },
  title: { color: DropColors.warmWhite, fontFamily: DropTypography.medium, fontSize: 15 },
});