import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
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
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type NotificationType =
  | 'like'
  | 'join_request'
  | 'join_accepted'
  | 'reply'
  | 'message'
  | 'drop_rescheduled';

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  drop_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  text_snapshot: string | null;
  read_at: string | null;
  created_at: string;
  actor: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  requires_reconfirmation: boolean;
};

function formatActivityTime(
  dateString: string
) {
  const date = new Date(dateString);
  const difference =
    Date.now() - date.getTime();

  const minutes =
    Math.floor(difference / 60000);

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
    }
  );
}

function getActionText(
  type: NotificationType
) {
  switch (type) {
    case 'like':
      return 'liked your Drop';

    case 'join_request':
      return 'wants to join your Drop';

    case 'join_accepted':
      return 'accepted your Join request';

    case 'reply':
      return 'replied to your Drop';

    case 'message':
      return 'sent you a message';

    case 'drop_rescheduled':
      return 'changed the date of a Drop you joined';
  }
}

export default function ActivityScreen() {
  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationRow[]
  >([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const markAllRead =
    useCallback(
      async (
        userId: string
      ) => {
        const {
          error,
        } =
          await supabase
            .from(
              'notifications'
            )
            .update({
              read_at:
                new Date().toISOString(),
            })
            .eq(
              'user_id',
              userId
            )
            .is(
              'read_at',
              null
            );

        if (error) {
          console.error(
            'MARK ACTIVITY READ ERROR:',
            error
          );
        }
      },
      []
    );

  const loadNotifications =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const {
            data: {
              user,
            },
            error:
              userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            setCurrentUserId(
              null
            );

            setNotifications(
              []
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
            await supabase
              .from(
                'notifications'
              )
              .select(
                'id,user_id,actor_id,type,drop_id,conversation_id,message_id,text_snapshot,read_at,created_at'
              )
              .eq(
                'user_id',
                user.id
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              )
              .limit(100);

          if (error) {
            console.error(
              'LOAD ACTIVITY ERROR:',
              error
            );

            Alert.alert(
              'Error',
              'Could not load Activity.'
            );

            return;
          }

          const raw =
            data ?? [];

          const actorIds = [
            ...new Set(
              raw
                .map(
                  (item) =>
                    item.actor_id
                )
                .filter(
                  (
                    value
                  ): value is string =>
                    !!value
                )
            ),
          ];

          let profiles: {
            id: string;
            username:
              | string
              | null;
            display_name:
              | string
              | null;
            avatar_url:
              | string
              | null;
          }[] = [];

          if (
            actorIds.length >
            0
          ) {
            const {
              data:
                profileData,
              error:
                profileError,
            } =
              await supabase
                .from(
                  'profiles'
                )
                .select(
                  'id,username,display_name,avatar_url'
                )
                .in(
                  'id',
                  actorIds
                );

            if (
              profileError
            ) {
              console.error(
                'ACTIVITY PROFILES ERROR:',
                profileError
              );
            } else {
              profiles =
                profileData ??
                [];
            }
          }

          const rescheduledDropIds = [
            ...new Set(
              raw
                .filter(
                  (item) =>
                    item.type ===
                      'drop_rescheduled' &&
                    !!item.drop_id
                )
                .map(
                  (item) =>
                    item.drop_id as string
                )
            ),
          ];

          const reconfirmationByDrop =
            new Map<
              string,
              boolean
            >();

          if (
            rescheduledDropIds.length >
            0
          ) {
            const {
              data:
                reconfirmationRows,
              error:
                reconfirmationError,
            } =
              await supabase
                .from(
                  'join_requests'
                )
                .select(
                  'drop_id,reconfirmation_required,status'
                )
                .eq(
                  'user_id',
                  user.id
                )
                .eq(
                  'status',
                  'accepted'
                )
                .in(
                  'drop_id',
                  rescheduledDropIds
                );

            if (
              reconfirmationError
            ) {
              console.warn(
                'ACTIVITY RECONFIRMATION LOAD ERROR:',
                reconfirmationError
              );
            } else {
              (
                reconfirmationRows ??
                []
              ).forEach(
                (row) => {
                  reconfirmationByDrop.set(
                    row.drop_id,
                    row.reconfirmation_required ===
                      true
                  );
                }
              );
            }
          }

          const combined =
            raw.map(
              (item) => {
                const actor =
                  profiles.find(
                    (
                      profile
                    ) =>
                      profile.id ===
                      item.actor_id
                  );

                return {
                  ...item,
                  actor: actor
                    ? {
                        username:
                          actor.username,
                        display_name:
                          actor.display_name,
                        avatar_url:
                          actor.avatar_url,
                      }
                    : null,
                  requires_reconfirmation:
                    item.type ===
                      'drop_rescheduled' &&
                    !!item.drop_id &&
                    reconfirmationByDrop.get(
                      item.drop_id
                    ) === true,
                };
              }
            ) as NotificationRow[];

          setNotifications(
            combined
          );

          await markAllRead(
            user.id
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        markAllRead,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        loadNotifications();
      },
      [
        loadNotifications,
      ]
    )
  );

  useEffect(() => {
    if (
      !currentUserId
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `activity-${currentUserId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema:
              'public',
            table:
              'notifications',
            filter:
              `user_id=eq.${currentUserId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    currentUserId,
    loadNotifications,
  ]);

  const findUnifiedConversation =
    async (
      actorId: string
    ) => {
      if (
        !currentUserId
      ) {
        return null;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            'conversations'
          )
          .select('id')
          .or(
            `and(author_id.eq.${currentUserId},participant_id.eq.${actorId}),and(author_id.eq.${actorId},participant_id.eq.${currentUserId})`
          )
          .limit(1)
          .maybeSingle();

      if (error) {
        console.error(
          'ACTIVITY FIND DM ERROR:',
          error
        );

        return null;
      }

      return (
        data?.id ??
        null
      );
    };

  const confirmRescheduledDrop =
    async (
      notification:
        NotificationRow
    ) => {
      if (
        !currentUserId ||
        !notification.drop_id
      ) {
        return;
      }

      const {
        error,
      } =
        await supabase.rpc(
          'confirm_drop_reschedule',
          {
            p_drop_id:
              notification.drop_id,
          }
        );

      if (error) {
        Alert.alert(
          'Error',
          'Could not confirm your participation.'
        );
        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (item) =>
              item.drop_id ===
                notification.drop_id &&
              item.type ===
                'drop_rescheduled'
                ? {
                    ...item,
                    requires_reconfirmation:
                      false,
                  }
                : item
          )
      );
    };

  const leaveRescheduledDrop =
    async (
      notification:
        NotificationRow
    ) => {
      if (
        !currentUserId ||
        !notification.drop_id
      ) {
        return;
      }

      const {
        error,
      } =
        await supabase.rpc(
          'decline_drop_reschedule',
          {
            p_drop_id:
              notification.drop_id,
          }
        );

      if (error) {
        Alert.alert(
          'Error',
          'Could not update your participation.'
        );
        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (item) =>
              item.drop_id ===
                notification.drop_id &&
              item.type ===
                'drop_rescheduled'
                ? {
                    ...item,
                    requires_reconfirmation:
                      false,
                  }
                : item
          )
      );
    };

  const openNotification =
    async (
      notification:
        NotificationRow
    ) => {
      if (
        notification.type ===
          'drop_rescheduled' &&
        notification.drop_id
      ) {
        router.push({
          pathname:
            '/drop/[id]',
          params: {
            id:
              notification.drop_id,
          },
        } as any);

        return;
      }

      if (
        notification.type ===
          'join_request' &&
        notification.drop_id
      ) {
        router.push({
          pathname:
            '/requests',
          params: {
            dropId:
              notification.drop_id,
          },
        });

        return;
      }

      if (
        notification.type ===
        'like'
      ) {
        router.push(
          '/profile'
        );

        return;
      }

      if (
        notification.conversation_id
      ) {
        router.push(
          `/chat/${notification.conversation_id}`
        );

        return;
      }

      if (
        notification.actor_id
      ) {
        const conversationId =
          await findUnifiedConversation(
            notification.actor_id
          );

        if (
          conversationId
        ) {
          router.push(
            `/chat/${conversationId}`
          );

          return;
        }
      }

      Alert.alert(
        'Activity',
        'This item is no longer available.'
      );
    };

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.replace(
              '/'
            )
          }
          hitSlop={12}
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backArrow
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.title
            }
          >
            Activity
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            See what’s
            happening around
            your Drops.
          </Text>
        </View>
      </View>

      {notifications.length ===
      0 ? (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            No activity yet.
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Likes, Join
            requests, replies
            and messages will
            appear here.
          </Text>
        </View>
      ) : (
        <ScrollView>
          {notifications.map(
            (
              notification
            ) => {
              const actorName =
                notification
                  .actor
                  ?.display_name ||
                notification
                  .actor
                  ?.username ||
                'Someone';

              const action =
                getActionText(
                  notification.type
                );

              return (
                <Pressable
                  key={
                    notification.id
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.notification,
                    !notification.read_at &&
                      styles.notificationUnread,
                    pressed &&
                      styles.notificationPressed,
                  ]}
                  onPress={() =>
                    openNotification(
                      notification
                    )
                  }
                >
                  <UserAvatar
                    uri={
                      notification
                        .actor
                        ?.avatar_url
                    }
                    name={
                      actorName
                    }
                    size={42}
                  />

                  <View
                    style={
                      styles.notificationContent
                    }
                  >
                    <Text
                      style={
                        styles.notificationText
                      }
                    >
                      <Text
                        style={
                          styles.actorName
                        }
                      >
                        {
                          actorName
                        }
                      </Text>{' '}
                      {action}
                    </Text>

                    {!!notification.text_snapshot && (
                      <Text
                        style={
                          styles.snapshot
                        }
                        numberOfLines={
                          notification.type ===
                          'message'
                            ? 1
                            : 2
                        }
                      >
                        {
                          notification.text_snapshot
                        }
                      </Text>
                    )}

                    <Text
                      style={
                        styles.time
                      }
                    >
                      {formatActivityTime(
                        notification.created_at
                      )}
                    </Text>
                    {notification.type ===
                      'drop_rescheduled' &&
                      notification.requires_reconfirmation && (
                      <View
                        style={
                          styles.reconfirmActions
                        }
                      >
                        <Pressable
                          style={({
                            pressed,
                          }) => [
                            styles.reconfirmButton,
                            styles.reconfirmPrimary,
                            pressed &&
                              styles.reconfirmPressed,
                          ]}
                          onPress={(
                            event
                          ) => {
                            event.stopPropagation();
                            confirmRescheduledDrop(
                              notification
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.reconfirmPrimaryText
                            }
                          >
                            Confirm
                          </Text>
                        </Pressable>

                        <Pressable
                          style={({
                            pressed,
                          }) => [
                            styles.reconfirmButton,
                            styles.reconfirmSecondary,
                            pressed &&
                              styles.reconfirmPressed,
                          ]}
                          onPress={(
                            event
                          ) => {
                            event.stopPropagation();
                            leaveRescheduledDrop(
                              notification
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.reconfirmSecondaryText
                            }
                          >
                            Can't go
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {!notification.read_at && (
                    <View
                      style={
                        styles.unreadDot
                      }
                    />
                  )}
                </Pressable>
              );
            }
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 58,
      paddingHorizontal: 22,
      paddingBottom: 18,
      minHeight: 128,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'flex-end',
    },

    backButton: {
      width: 34,
      height: 52,
      marginRight: 8,
      justifyContent:
        'flex-start',
      paddingTop: 1,
    },

    backArrow: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 38,
      lineHeight: 38,
    },

    headerText: {
      flex: 1,
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 30,
      lineHeight: 36,
    },

    subtitle: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 40,
    },

    emptyTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 16,
    },

    emptySubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      lineHeight: 19,
      textAlign:
        'center',
      marginTop: 7,
    },

    notification: {
      minHeight: 72,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    notificationUnread: {
      backgroundColor:
        DropColors.surface,
    },

    notificationPressed: {
      opacity: 0.65,
    },

    notificationContent: {
      flex: 1,
      marginLeft: 12,
      paddingRight: 12,
    },

    notificationText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      lineHeight: 18,
    },

    actorName: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
    },

    snapshot: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },

    time: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      marginTop: 5,
    },

    reconfirmActions: {
      flexDirection: 'row',
      marginTop: 10,
      gap: 8,
    },

    reconfirmButton: {
      minHeight: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },

    reconfirmPrimary: {
      backgroundColor:
        DropColors.warmWhite,
    },

    reconfirmSecondary: {
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    reconfirmPrimaryText: {
      color:
        DropColors.graphite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 12,
    },

    reconfirmSecondaryText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },

    reconfirmPressed: {
      opacity: 0.65,
    },

    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        DropColors.wine,
    },
  });