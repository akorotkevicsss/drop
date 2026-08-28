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

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Participant = {
  requestId: string;
  profile: Profile;
};

export default function DropParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

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

      const { data: drop, error: dropError } = await supabase
        .from('drops')
        .select('id')
        .eq('id', id)
        .eq('author_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (dropError || !drop) {
        Alert.alert('Unavailable', 'This Drop could not be opened.');
        router.back();
        return;
      }

      const { data: group, error: groupError } = await supabase
        .from('conversations')
        .select('id')
        .eq('drop_id', id)
        .eq('conversation_type', 'group')
        .eq('source', 'group')
        .limit(1)
        .maybeSingle();

      if (groupError) throw groupError;
      setGroupId(group?.id ?? null);

      const { data: requests, error: requestError } = await supabase
        .from('join_requests')
        .select('id,user_id')
        .eq('drop_id', id)
        .eq('status', 'accepted');

      if (requestError) throw requestError;

      const userIds = Array.from(
        new Set((requests ?? []).map((request) => request.user_id))
      );

      if (userIds.length === 0) {
        setParticipants([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      const profileRows = (profiles ?? []) as Profile[];

      setParticipants(
        (requests ?? []).flatMap((request) => {
          const profile = profileRows.find((item) => item.id === request.user_id);
          return profile
            ? [{ requestId: request.id, profile }]
            : [];
        })
      );
    } catch (error) {
      console.warn('DROP PARTICIPANTS LOAD ERROR:', error);
      Alert.alert('Error', 'Could not load participants.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const removeParticipant = (participant: Participant) => {
    const name =
      participant.profile.display_name ||
      participant.profile.username ||
      'this participant';

    Alert.alert(
      'Remove participant?',
      `${name} will leave this Drop${groupId ? ' and its group chat' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setWorkingId(participant.requestId);

              const { error: requestError } = await supabase
                .from('join_requests')
                .delete()
                .eq('id', participant.requestId);

              if (requestError) throw requestError;

              if (groupId) {
                const { error: memberError } = await supabase
                  .from('conversation_members')
                  .delete()
                  .eq('conversation_id', groupId)
                  .eq('user_id', participant.profile.id);

                if (memberError) throw memberError;
              }

              setParticipants((current) =>
                current.filter((item) => item.requestId !== participant.requestId)
              );
            } catch (error) {
              console.warn('REMOVE DROP PARTICIPANT ERROR:', error);
              Alert.alert('Error', 'Could not remove participant.');
            } finally {
              setWorkingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Participants</Text>
          <Text style={styles.headerSubtitle}>
            {participants.length} accepted participant
            {participants.length === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={DropColors.warmWhite} />
        </View>
      ) : participants.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nobody has joined yet.</Text>
          <Text style={styles.emptyText}>
            Accepted users will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {participants.map((participant) => {
            const name =
              participant.profile.display_name ||
              participant.profile.username ||
              'User';
            const isWorking = workingId === participant.requestId;

            return (
              <Pressable
                key={participant.requestId}
                style={({ pressed }) => [
                  styles.participantRow,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (participant.profile.username) {
                    router.push(
                      `/user/${encodeURIComponent(participant.profile.username)}`
                    );
                  }
                }}
              >
                <UserAvatar
                  uri={participant.profile.avatar_url}
                  name={name}
                  size={42}
                />

                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{name}</Text>
                  {!!participant.profile.username && (
                    <Text style={styles.participantUsername}>
                      @{participant.profile.username}
                    </Text>
                  )}
                </View>

                <Pressable
                  hitSlop={10}
                  disabled={isWorking}
                  onPress={(event) => {
                    event.stopPropagation();
                    removeParticipant(participant);
                  }}
                >
                  <Text style={[styles.remove, isWorking && styles.disabledText]}>
                    {isWorking ? '...' : 'Remove'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 52,
    minHeight: 104,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  back: {
    width: 38,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 36,
    lineHeight: 38,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 16,
  },
  headerSubtitle: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
    marginTop: 3,
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    paddingBottom: 40,
  },
  participantRow: {
    minHeight: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  participantCopy: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  participantUsername: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  remove: {
    color: '#C86E6E',
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },
  disabledText: {
    opacity: 0.45,
  },
  empty: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 15,
  },
  emptyText: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
    marginTop: 5,
  },
  pressed: {
    backgroundColor: '#151515',
  },
});