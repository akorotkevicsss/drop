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
import { supabase } from '@/lib/supabase';

type NotificationType =
  | 'like'
  | 'join_request'
  | 'join_accepted'
  | 'reply'
  | 'message';

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
};

function formatActivityTime(
  dateString: string
) {
  const date =
    new Date(dateString);

  const now =
    new Date();

  const difference =
    now.getTime() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        (1000 * 60)
    );

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days =
    Math.floor(
      hours / 24
    );

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
  }
}

export default function ActivityScreen() {
  const [
    notifications,
    setNotifications,
  ] =
    useState<NotificationRow[]>(
      []
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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
              .select(`
                id,
                user_id,
                actor_id,
                type,
                drop_id,
                conversation_id,
                message_id,
                text_snapshot,
                read_at,
                created_at
              `)
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

          const actorIds =
            [
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
              string | null;
            display_name:
              string | null;
            avatar_url:
              string | null;
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
                .select(`
                  id,
                  username,
                  display_name,
                  avatar_url
                `)
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

          const combined =
            raw.map(
              (item) => {
                const actor =
                  profiles.find(
                    (profile) =>
                      profile.id ===
                      item.actor_id
                  );

                return {
                  ...item,

                  actor:
                    actor
                      ? {
                          username:
                            actor.username,

                          display_name:
                            actor.display_name,

                          avatar_url:
                            actor.avatar_url,
                        }
                      : null,
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
          setLoading(false);
        }
      },
      [
        markAllRead,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [
      loadNotifications,
    ])
  );

  /*
   * Activity is open:
   * new events appear immediately and are
   * immediately considered seen.
   */
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

  const openNotification =
    async (
      notification:
        NotificationRow
    ) => {
      /*
       * JOIN REQUEST
       */
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

      /*
       * LIKE
       *
       * No Drop-detail screen yet,
       * so own Profile is the useful target.
       */
      if (
        notification.type ===
        'like'
      ) {
        router.push(
          '/profile'
        );

        return;
      }

      /*
       * Reply / accepted / message:
       * normally conversation_id is present.
       */
      if (
        notification.conversation_id
      ) {
        router.push(
          `/chat/${notification.conversation_id}`
        );

        return;
      }

      /*
       * Join accepted can race the backend
       * conversation creation trigger.
       * Resolve unified A↔B DM on tap.
       */
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
        <ActivityIndicator />
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
        <Text
          style={
            styles.title
          }
        >
          Activity
        </Text>
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
            Likes, Join requests, replies and messages will appear here.
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
                    size={46}
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
                        {actorName}
                      </Text>

                      {' '}
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
        '#000000',
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        '#000000',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
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
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    emptySubtitle: {
      color: '#666666',
      fontSize: 14,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 8,
    },

    notification: {
      minHeight: 76,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection: 'row',
      alignItems: 'center',
    },

    notificationUnread: {
      backgroundColor:
        '#090909',
    },

    notificationPressed: {
      opacity: 0.65,
    },

    notificationContent: {
      flex: 1,
      marginLeft: 13,
      paddingRight: 12,
    },

    notificationText: {
      color: '#AAAAAA',
      fontSize: 14,
      lineHeight: 19,
    },

    actorName: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    snapshot: {
      color: '#666666',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },

    time: {
      color: '#444444',
      fontSize: 11,
      marginTop: 5,
    },

    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#FFFFFF',
    },
  });