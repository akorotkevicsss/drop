import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useRef,
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

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { warmChatScreenCache } from '@/lib/chat-screen-prefetch';
import { supabase } from '@/lib/supabase';
import {
  getScreenCache,
  setScreenCache,
} from '@/lib/tab-screen-cache';

type DropStatus =
  | 'active'
  | 'ended'
  | 'cancelled';

type DropRow = {
  id: string;
  text: string;
  status: DropStatus;
  event_time: string | null;
  event_end_time: string | null;
};

type GroupState = {
  id: string;
  memberIds: string[];
} | null;


type EditDropPrefetchCache = {
  text: string;
  eventStartIso: string | null;
  eventEndIso: string | null;
  location: string;
  age: string;
  dressCode: string;
  price: string;
  language: string;
  conditions: string;
  hashtags: string;
  joinEnabled: boolean;
  joinMode: 'request' | 'free' | 'invite_only';
  capacity: string;
  replyEnabled: boolean;
  commentsEnabled: boolean;
  ratingEnabled: boolean;
};

type ManageCache = {
  drop: DropRow | null;
  participantCount: number;
  pendingCount: number;
  currentUserId: string | null;
  group: GroupState;
};

export default function ManageDropScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const cacheKey =
    id
      ? `manage-drop:${id}`
      : '';

  const cached =
    cacheKey
      ? getScreenCache<ManageCache>(
          cacheKey
        )
      : null;

  const [
    drop,
    setDrop,
  ] = useState<DropRow | null>(
    cached?.drop ?? null
  );

  const [
    participantCount,
    setParticipantCount,
  ] = useState(
    cached?.participantCount ?? 0
  );

  const [
    pendingCount,
    setPendingCount,
  ] = useState(
    cached?.pendingCount ?? 0
  );

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(
    cached?.currentUserId ?? null
  );

  const [
    loading,
    setLoading,
  ] = useState(!cached);

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    group,
    setGroup,
  ] = useState<GroupState>(
    cached?.group ?? null
  );

  const requestInFlight =
    useRef(false);

  const cacheStateRef =
    useRef<ManageCache>({
      drop:
        cached?.drop ?? null,
      participantCount:
        cached?.participantCount ?? 0,
      pendingCount:
        cached?.pendingCount ?? 0,
      currentUserId:
        cached?.currentUserId ?? null,
      group:
        cached?.group ?? null,
    });

  const saveCache =
    (
      next:
        Partial<ManageCache>
    ) => {
      cacheStateRef.current = {
        ...cacheStateRef.current,
        ...next,
      };

      if (cacheKey) {
        setScreenCache<ManageCache>(
          cacheKey,
          cacheStateRef.current
        );
      }
    };

  const load =
    useCallback(
      async (
        showLoader = false
      ) => {
        if (
          !id ||
          requestInFlight.current
        ) {
          return;
        }

        requestInFlight.current =
          true;

        if (
          showLoader &&
          !drop
        ) {
          setLoading(true);
        }

        try {
          const {
            data: {
              session,
            },
          } =
            await supabase.auth.getSession();

          const user =
            session?.user ??
            null;

          if (!user) {
            return;
          }

          setCurrentUserId(
            user.id
          );

          const [
            dropResult,
            groupResult,
            requestsResult,
            editResult,
          ] = await Promise.all([
            supabase
              .from('drops')
              .select(
                'id,text,status,event_time,event_end_time'
              )
              .eq('id', id)
              .eq(
                'author_id',
                user.id
              )
              .is(
                'deleted_at',
                null
              )
              .maybeSingle(),

            supabase
              .from(
                'conversations'
              )
              .select('id')
              .eq(
                'drop_id',
                id
              )
              .eq(
                'conversation_type',
                'group'
              )
              .eq(
                'source',
                'group'
              )
              .limit(1)
              .maybeSingle(),

            supabase
              .from(
                'join_requests'
              )
              .select(
                'user_id,status'
              )
              .eq(
                'drop_id',
                id
              ),

            supabase
              .from('drops')
              .select(
                'text,event_time,event_end_time,location_text,age_restriction,join_limit,join_enabled,join_mode,reply_enabled,comments_enabled,rating_enabled,dress_code,conditions,price_text,language_text,hashtags'
              )
              .eq('id', id)
              .eq('author_id', user.id)
              .maybeSingle(),
          ]);

          if (
            dropResult.error ||
            !dropResult.data
          ) {
            setDrop(null);
            saveCache({
              drop: null,
              currentUserId:
                user.id,
            });
            return;
          }

          if (
            groupResult.error
          ) {
            throw groupResult.error;
          }

          if (
            requestsResult.error
          ) {
            throw requestsResult.error;
          }

          const nextDrop =
            dropResult.data as DropRow;

          const requests =
            requestsResult.data ??
            [];

          const accepted =
            requests.filter(
              (item) =>
                item.status ===
                'accepted'
            );

          const nextParticipantCount =
            accepted.length;

          const nextPendingCount =
            requests.filter(
              (item) =>
                item.status ===
                'pending'
            ).length;

          let nextGroup:
            GroupState = null;

          if (
            groupResult.data?.id
          ) {
            const {
              data:
                groupMembers,
              error:
                groupMembersError,
            } =
              await supabase
                .from(
                  'conversation_members'
                )
                .select(
                  'user_id'
                )
                .eq(
                  'conversation_id',
                  groupResult.data.id
                );

            if (
              groupMembersError
            ) {
              throw groupMembersError;
            }

            nextGroup = {
              id:
                groupResult.data.id,
              memberIds:
                (
                  groupMembers ??
                  []
                ).map(
                  (member) =>
                    member.user_id
                ),
            };
          }

          setDrop(nextDrop);
          setParticipantCount(
            nextParticipantCount
          );
          setPendingCount(
            nextPendingCount
          );
          setGroup(nextGroup);

          if (nextGroup?.id) {
            void warmChatScreenCache(
              nextGroup.id,
              user.id
            );
          }

          if (
            editResult.data &&
            !editResult.error
          ) {
            const editData =
              editResult.data;

            setScreenCache<EditDropPrefetchCache>(
              `edit-drop:${id}`,
              {
                text:
                  editData.text ?? '',
                eventStartIso:
                  editData.event_time ?? null,
                eventEndIso:
                  editData.event_end_time ?? null,
                location:
                  editData.location_text ?? '',
                age:
                  String(
                    editData.age_restriction ?? ''
                  )
                    .replace(/\+$/, '')
                    .replace(/\D/g, '')
                    .slice(0, 2),
                dressCode:
                  editData.dress_code ?? '',
                price:
                  editData.price_text ?? '',
                language:
                  editData.language_text ?? '',
                conditions:
                  editData.conditions ?? '',
                hashtags:
                  (editData.hashtags ?? [])
                    .map(
                      (tag: string) =>
                        `#${tag.replace(/^#/, '')}`
                    )
                    .join(' '),
                joinEnabled:
                  editData.join_enabled ?? true,
                joinMode:
                  (editData.join_mode as
                    | 'request'
                    | 'free'
                    | 'invite_only') ??
                  'request',
                capacity:
                  editData.join_limit
                    ? String(editData.join_limit)
                    : '',
                replyEnabled:
                  editData.reply_enabled ?? true,
                commentsEnabled:
                  editData.comments_enabled ?? false,
                ratingEnabled:
                  editData.rating_enabled ?? false,
              }
            );
          }

          saveCache({
            drop: nextDrop,
            participantCount:
              nextParticipantCount,
            pendingCount:
              nextPendingCount,
            currentUserId:
              user.id,
            group:
              nextGroup,
          });
        } catch (error) {
          console.error(
            'MANAGE DROP LOAD ERROR:',
            error
          );

          if (!drop) {
            Alert.alert(
              'Error',
              'Could not load Drop management.'
            );
          }
        } finally {
          requestInFlight.current =
            false;
          setLoading(false);
        }
      },
      [
        id,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        void load(
          !cacheStateRef.current.drop
        );
      },
      [
        id,
      ]
    )
  );

  const updateCachedDrop =
    (
      nextDrop: DropRow
    ) => {
      setDrop(nextDrop);
      saveCache({
        drop: nextDrop,
      });
    };

  const setStatus =
    (
      status:
        | 'ended'
        | 'cancelled'
    ) => {
      if (
        !drop ||
        working
      ) {
        return;
      }

      const verb =
        status === 'ended'
          ? 'End'
          : 'Cancel';

      const message =
        status === 'ended'
          ? 'The Drop stays visible as history, but interactions stop.'
          : 'Participants will see that this Drop was cancelled.';

      Alert.alert(
        `${verb} Drop?`,
        message,
        [
          {
            text:
              'Keep Drop',
            style:
              'cancel',
          },
          {
            text: verb,
            style:
              'destructive',
            onPress:
              async () => {
                try {
                  setWorking(true);

                  const now =
                    new Date().toISOString();

                  const {
                    error,
                  } =
                    await supabase
                      .from(
                        'drops'
                      )
                      .update({
                        status,
                        ended_at:
                          status ===
                          'ended'
                            ? now
                            : null,
                        cancelled_at:
                          status ===
                          'cancelled'
                            ? now
                            : null,
                      })
                      .eq(
                        'id',
                        drop.id
                      )
                      .eq(
                        'author_id',
                        currentUserId
                      );

                  if (error) {
                    throw error;
                  }

                  updateCachedDrop({
                    ...drop,
                    status,
                  });
                } catch (error) {
                  console.error(
                    'DROP STATUS ERROR:',
                    error
                  );

                  Alert.alert(
                    'Error',
                    `Could not ${verb.toLowerCase()} this Drop.`
                  );
                } finally {
                  setWorking(false);
                }
              },
          },
        ]
      );
    };

  const restoreDrop =
    () => {
      if (
        !drop ||
        working
      ) {
        return;
      }

      const effectiveEnd =
        drop.event_end_time ??
        drop.event_time;

      if (
        effectiveEnd &&
        new Date(
          effectiveEnd
        ).getTime() <=
          Date.now()
      ) {
        Alert.alert(
          'Update the date first',
          'This Drop is already in the past. Set a future start/end time in Edit Drop before restoring it.',
          [
            {
              text:
                'Not now',
              style:
                'cancel',
            },
            {
              text:
                'Edit Drop',
              onPress:
                () =>
                  router.push({
                    pathname:
                      '/drop/[id]/edit',
                    params: {
                      id:
                        drop.id,
                    },
                  } as any),
            },
          ]
        );

        return;
      }

      Alert.alert(
        'Restore Drop?',
        'The Drop will become active again and interactions will be available.',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Restore',
            onPress:
              async () => {
                try {
                  setWorking(true);

                  const {
                    error,
                  } =
                    await supabase
                      .from(
                        'drops'
                      )
                      .update({
                        status:
                          'active',
                        ended_at:
                          null,
                        cancelled_at:
                          null,
                      })
                      .eq(
                        'id',
                        drop.id
                      )
                      .eq(
                        'author_id',
                        currentUserId
                      );

                  if (error) {
                    throw error;
                  }

                  updateCachedDrop({
                    ...drop,
                    status:
                      'active',
                  });
                } catch (error) {
                  console.error(
                    'RESTORE DROP ERROR:',
                    error
                  );

                  Alert.alert(
                    'Error',
                    'Could not restore this Drop.'
                  );
                } finally {
                  setWorking(false);
                }
              },
          },
        ]
      );
    };

  const deleteDrop =
    () => {
      if (
        !drop ||
        working
      ) {
        return;
      }

      Alert.alert(
        'Delete Drop?',
        'This removes the Drop from the app. This action is separate from ending it.',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Delete',
            style:
              'destructive',
            onPress:
              async () => {
                try {
                  setWorking(true);

                  const {
                    error,
                  } =
                    await supabase
                      .from(
                        'drops'
                      )
                      .update({
                        deleted_at:
                          new Date().toISOString(),
                      })
                      .eq(
                        'id',
                        drop.id
                      )
                      .eq(
                        'author_id',
                        currentUserId
                      );

                  if (error) {
                    throw error;
                  }

                  router.replace(
                    '/'
                  );
                } catch (error) {
                  console.error(
                    'DELETE DROP ERROR:',
                    error
                  );

                  Alert.alert(
                    'Error',
                    'Could not delete this Drop.'
                  );
                } finally {
                  setWorking(false);
                }
              },
          },
        ]
      );
    };

  const syncExistingGroup =
    async (
      conversationId:
        string
    ) => {
      if (
        !drop ||
        !currentUserId
      ) {
        return;
      }

      try {
        const {
          data:
            acceptedRequests,
          error:
            acceptedError,
        } =
          await supabase
            .from(
              'join_requests'
            )
            .select(
              'user_id'
            )
            .eq(
              'drop_id',
              drop.id
            )
            .eq(
              'status',
              'accepted'
            );

        if (
          acceptedError
        ) {
          throw acceptedError;
        }

        const acceptedUserIds =
          Array.from(
            new Set(
              (
                acceptedRequests ??
                []
              ).map(
                (request) =>
                  request.user_id
              )
            )
          );

        const {
          data:
            members,
          error:
            membersError,
        } =
          await supabase
            .from(
              'conversation_members'
            )
            .select(
              'user_id'
            )
            .eq(
              'conversation_id',
              conversationId
            );

        if (
          membersError
        ) {
          throw membersError;
        }

        const existingMemberIds =
          (
            members ??
            []
          ).map(
            (member) =>
              member.user_id
          );

        const desiredMembers = [
          {
            userId:
              currentUserId,
            isAdmin:
              true,
          },
          ...acceptedUserIds.map(
            (userId) => ({
              userId,
              isAdmin:
                false,
            })
          ),
        ];

        const missingMembers =
          desiredMembers.filter(
            (member) =>
              !existingMemberIds.includes(
                member.userId
              )
          );

        if (
          missingMembers.length
        ) {
          const {
            error:
              memberError,
          } =
            await supabase
              .from(
                'conversation_members'
              )
              .insert(
                missingMembers.map(
                  (
                    member
                  ) => ({
                    conversation_id:
                      conversationId,
                    user_id:
                      member.userId,
                    is_admin:
                      member.isAdmin,
                    last_read_at:
                      member.isAdmin
                        ? new Date().toISOString()
                        : null,
                  })
                )
              );

          if (
            memberError
          ) {
            throw memberError;
          }
        }

        const nextGroup = {
          id:
            conversationId,
          memberIds:
            Array.from(
              new Set([
                ...existingMemberIds,
                ...desiredMembers.map(
                  (member) =>
                    member.userId
                ),
              ])
            ),
        };

        setGroup(nextGroup);
        saveCache({
          group:
            nextGroup,
        });
      } catch (error) {
        console.warn(
          'DROP GROUP SYNC ERROR:',
          error
        );
      }
    };

  const createDropGroup =
    async () => {
      if (
        !drop ||
        !currentUserId ||
        participantCount === 0 ||
        working
      ) {
        return;
      }

      if (group?.id) {
        const conversationId =
          group.id;

        /*
         * Start warming recent group-chat images before navigation.
         * Navigation stays instant; the media cache continues in parallel.
         */
        void warmChatScreenCache(
          conversationId,
          currentUserId
        );

        router.push(
          `/chat/${conversationId}`
        );

        void syncExistingGroup(
          conversationId
        );

        return;
      }

      let stage =
        'loading participants';

      try {
        setWorking(true);

        const {
          data:
            acceptedRequests,
          error:
            acceptedError,
        } =
          await supabase
            .from(
              'join_requests'
            )
            .select(
              'user_id'
            )
            .eq(
              'drop_id',
              drop.id
            )
            .eq(
              'status',
              'accepted'
            );

        if (
          acceptedError
        ) {
          throw acceptedError;
        }

        const acceptedUserIds =
          Array.from(
            new Set(
              (
                acceptedRequests ??
                []
              ).map(
                (request) =>
                  request.user_id
              )
            )
          );

        if (
          acceptedUserIds.length ===
          0
        ) {
          Alert.alert(
            'No participants',
            'Accept at least one participant before creating a group chat.'
          );
          return;
        }

        stage =
          'creating the group';

        const firstParticipantId =
          acceptedUserIds[0];

        const {
          data:
            conversation,
          error:
            conversationError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .insert({
              author_id:
                currentUserId,
              participant_id:
                firstParticipantId,
              conversation_type:
                'group',
              title:
                drop.text.length >
                38
                  ? `${drop.text.slice(
                      0,
                      38
                    )}…`
                  : drop.text,
              created_by:
                currentUserId,
              is_request:
                false,
              source:
                'group',
              drop_id:
                drop.id,
              join_request_id:
                null,
            })
            .select('id')
            .single();

        if (
          conversationError ||
          !conversation
        ) {
          throw (
            conversationError ??
            new Error(
              'Conversation was not returned after insert.'
            )
          );
        }

        stage =
          'adding group members';

        const desiredMembers = [
          {
            userId:
              currentUserId,
            isAdmin:
              true,
          },
          ...acceptedUserIds.map(
            (userId) => ({
              userId,
              isAdmin:
                false,
            })
          ),
        ];

        const {
          error:
            memberError,
        } =
          await supabase
            .from(
              'conversation_members'
            )
            .insert(
              desiredMembers.map(
                (
                  member
                ) => ({
                  conversation_id:
                    conversation.id,
                  user_id:
                    member.userId,
                  is_admin:
                    member.isAdmin,
                  last_read_at:
                    member.isAdmin
                      ? new Date().toISOString()
                      : null,
                })
              )
            );

        if (
          memberError
        ) {
          throw memberError;
        }

        const nextGroup = {
          id:
            conversation.id,
          memberIds:
            desiredMembers.map(
              (member) =>
                member.userId
            ),
        };

        setGroup(nextGroup);
        saveCache({
          group:
            nextGroup,
        });

        router.push(
          `/chat/${conversation.id}`
        );
      } catch (
        error: any
      ) {
        console.warn(
          'DROP GROUP ERROR:',
          {
            stage,
            error,
          }
        );

        const detail =
          error?.message
            ? `\n\n${error.message}`
            : '';

        Alert.alert(
          'Could not create group chat',
          `Failed while ${stage}.${detail}`
        );
      } finally {
        setWorking(false);
      }
    };

  if (
    loading &&
    !drop
  ) {
    return (
      <View style={styles.center}>
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />
        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
      </View>
    );
  }

  if (!drop) {
    return (
      <View style={styles.center}>
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />
        <Text style={styles.title}>
          Drop unavailable.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown:
            false,
        }}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={12}
        >
          <Text style={styles.back}>
            ‹
          </Text>
        </Pressable>

        <View
          style={styles.headerCopy}
        >
          <Text
            style={styles.headerTitle}
          >
            Manage Drop
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
            numberOfLines={1}
          >
            {drop.text}
          </Text>
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={styles.sectionLabel}
        >
          DROP
        </Text>

        <ActionRow
          title="Edit Drop"
          subtitle="Content, time, place and settings"
          icon="create-outline"
          onPress={() =>
            router.push({
              pathname:
                '/drop/[id]/edit',
              params: {
                id:
                  drop.id,
              },
            } as any)
          }
        />

        <ActionRow
          title="Join requests"
          subtitle={
            pendingCount
              ? `${pendingCount} waiting`
              : 'No pending requests'
          }
          icon="person-add-outline"
          onPress={() =>
            router.push({
              pathname:
                '/requests',
              params: {
                dropId:
                  drop.id,
              },
            })
          }
        />

        <ActionRow
          title={
            group
              ? 'Open group chat'
              : 'Group chat'
          }
          subtitle={
            participantCount
              ? `${group ? 'Open and sync' : 'Create chat'} with ${participantCount} participant${participantCount === 1 ? '' : 's'}`
              : 'No participants yet'
          }
          icon="chatbubbles-outline"
          onPress={
            createDropGroup
          }
          disabled={
            participantCount ===
              0 ||
            working
          }
        />

        <ActionRow
          title="Participants"
          subtitle={`${participantCount} accepted participant${participantCount === 1 ? '' : 's'}`}
          icon="people-outline"
          onPress={() =>
            router.push({
              pathname:
                '/drop/[id]/participants',
              params: {
                id:
                  drop.id,
              },
            } as any)
          }
        />

        <Text
          style={styles.sectionLabel}
        >
          LIFECYCLE
        </Text>

        <View
          style={styles.statusRow}
        >
          <Text
            style={
              styles.statusLabel
            }
          >
            Status
          </Text>

          <Text
            style={
              styles.statusValue
            }
          >
            {drop.status.toUpperCase()}
          </Text>
        </View>

        {drop.status ===
          'active' && (
          <ActionRow
            title="End Drop"
            subtitle="Keep it as history and stop interactions"
            icon="checkmark-circle-outline"
            onPress={() =>
              setStatus('ended')
            }
          />
        )}

        {drop.status ===
          'active' && (
          <ActionRow
            title="Cancel Drop"
            subtitle="Mark the event as cancelled"
            icon="close-circle-outline"
            onPress={() =>
              setStatus(
                'cancelled'
              )
            }
            danger
          />
        )}

        {drop.status !==
          'active' && (
          <ActionRow
            title="Restore Drop"
            subtitle="Make this Drop active again"
            icon="refresh-circle-outline"
            onPress={
              restoreDrop
            }
          />
        )}

        <ActionRow
          title="Delete Drop"
          subtitle="Remove it from the app"
          icon="trash-outline"
          onPress={deleteDrop}
          danger
        />
      </ScrollView>
    </View>
  );
}

function ActionRow({
  title,
  subtitle,
  icon,
  onPress,
  danger = false,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  icon:
    keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,
        disabled &&
          styles.disabled,
        pressed &&
          !disabled &&
          styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          danger
            ? '#C86E6E'
            : DropColors.warmWhite
        }
      />

      <View
        style={styles.actionCopy}
      >
        <Text
          style={[
            styles.actionTitle,
            danger &&
              styles.danger,
          ]}
        >
          {title}
        </Text>

        <Text
          style={
            styles.actionSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <Text style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    center: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 52,
      minHeight: 104,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    back: {
      width: 38,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 36,
      lineHeight: 38,
    },

    headerCopy: {
      flex: 1,
      alignItems:
        'center',
    },

    headerTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 16,
    },

    headerSubtitle: {
      maxWidth: 230,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      marginTop: 3,
    },

    headerSpacer: {
      width: 38,
    },

    content: {
      paddingBottom: 50,
    },

    sectionLabel: {
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 18,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.2,
    },

    actionRow: {
      minHeight: 66,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 13,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    actionCopy: {
      flex: 1,
    },

    actionTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    actionSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      marginTop: 3,
    },

    chevron: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 24,
    },

    statusRow: {
      minHeight: 54,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      backgroundColor:
        '#151515',
    },

    statusLabel: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
    },

    statusValue: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.2,
    },

    danger: {
      color:
        '#C86E6E',
    },

    disabled: {
      opacity: 0.38,
    },

    pressed: {
      backgroundColor:
        '#151515',
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
    },
  });
