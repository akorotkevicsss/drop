import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Profile = {
  username: string | null;
  display_name: string | null;
};

type LastMessage = {
  text: string;
  created_at: string;
};

type LastEvent = {
  event_type: 'join' | 'reply';
  actor_id: string;
  drop_text_snapshot: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  author_id: string;
  participant_id: string;
  created_at: string;

  otherUser: Profile | null;

  lastMessage: LastMessage | null;
  lastEvent: LastEvent | null;

  lastActivityAt: string;
};

function formatInboxTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(
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

export default function InboxScreen() {
  const [
    conversations,
    setConversations,
  ] =
    useState<Conversation[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const loadConversations =
    async () => {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          return;
        }

        /*
         * LOAD UNIFIED DMs
         */

        const {
          data:
            conversationData,
          error:
            conversationError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .select(`
              id,
              author_id,
              participant_id,
              created_at
            `);

        if (
          conversationError
        ) {
          console.error(
            'INBOX ERROR:',
            conversationError
          );

          Alert.alert(
            'Error',
            'Could not load conversations.'
          );

          return;
        }

        const rawConversations =
          conversationData ?? [];

        /*
         * FIND OTHER USERS
         */

        const otherUserIds =
          rawConversations.map(
            (
              conversation
            ) =>
              conversation.author_id ===
              user.id
                ? conversation.participant_id
                : conversation.author_id
          );

        let profiles: {
          id: string;
          username:
            string | null;
          display_name:
            string | null;
        }[] = [];

        if (
          otherUserIds.length >
          0
        ) {
          const {
            data: profileData,
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
                display_name
              `)
              .in(
                'id',
                otherUserIds
              );

          if (
            profileError
          ) {
            console.error(
              'INBOX PROFILE ERROR:',
              profileError
            );
          } else {
            profiles =
              profileData ?? [];
          }
        }

        /*
         * LOAD LAST MESSAGE
         * +
         * LAST DROP EVENT
         */

        const result:
          Conversation[] =
          await Promise.all(
            rawConversations.map(
              async (
                conversation
              ) => {
                const otherUserId =
                  conversation.author_id ===
                  user.id
                    ? conversation.participant_id
                    : conversation.author_id;

                const profile =
                  profiles.find(
                    (item) =>
                      item.id ===
                      otherUserId
                  );

                const {
                  data:
                    lastMessageData,
                  error:
                    lastMessageError,
                } =
                  await supabase
                    .from(
                      'messages'
                    )
                    .select(`
                      text,
                      created_at
                    `)
                    .eq(
                      'conversation_id',
                      conversation.id
                    )
                    .order(
                      'created_at',
                      {
                        ascending:
                          false,
                      }
                    )
                    .limit(1)
                    .maybeSingle();

                if (
                  lastMessageError
                ) {
                  console.error(
                    'INBOX LAST MESSAGE ERROR:',
                    lastMessageError
                  );
                }

                const {
                  data:
                    lastEventData,
                  error:
                    lastEventError,
                } =
                  await supabase
                    .from(
                      'conversation_events'
                    )
                    .select(`
                      event_type,
                      actor_id,
                      drop_text_snapshot,
                      created_at
                    `)
                    .eq(
                      'conversation_id',
                      conversation.id
                    )
                    .order(
                      'created_at',
                      {
                        ascending:
                          false,
                      }
                    )
                    .limit(1)
                    .maybeSingle();

                if (
                  lastEventError
                ) {
                  console.error(
                    'INBOX LAST EVENT ERROR:',
                    lastEventError
                  );
                }

                const lastMessage =
                  lastMessageData ??
                  null;

                const lastEvent =
                  lastEventData ??
                  null;

                let lastActivityAt =
                  conversation.created_at;

                if (
                  lastMessage &&
                  new Date(
                    lastMessage.created_at
                  ).getTime() >
                    new Date(
                      lastActivityAt
                    ).getTime()
                ) {
                  lastActivityAt =
                    lastMessage.created_at;
                }

                if (
                  lastEvent &&
                  new Date(
                    lastEvent.created_at
                  ).getTime() >
                    new Date(
                      lastActivityAt
                    ).getTime()
                ) {
                  lastActivityAt =
                    lastEvent.created_at;
                }

                return {
                  id:
                    conversation.id,

                  author_id:
                    conversation.author_id,

                  participant_id:
                    conversation.participant_id,

                  created_at:
                    conversation.created_at,

                  otherUser:
                    profile
                      ? {
                          username:
                            profile.username,

                          display_name:
                            profile.display_name,
                        }
                      : null,

                  lastMessage,

                  lastEvent,

                  lastActivityAt,
                };
              }
            )
          );

        /*
         * NEWEST ACTIVITY FIRST
         */

        result.sort(
          (a, b) =>
            new Date(
              b.lastActivityAt
            ).getTime() -
            new Date(
              a.lastActivityAt
            ).getTime()
        );

        setConversations(
          result
        );
      } catch (error) {
        console.error(
          'INBOX LOAD ERROR:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

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
          Inbox
        </Text>
      </View>

      {conversations.length ===
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
            No conversations yet.
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Reply to a Drop, Join someone,
            or start a conversation.
          </Text>
        </View>
      ) : (
        <ScrollView>
          {conversations.map(
            (
              conversation
            ) => {
              const name =
                conversation
                  .otherUser
                  ?.display_name ||
                'Unnamed user';

              const username =
                conversation
                  .otherUser
                  ?.username;

              const lastMessage =
                conversation.lastMessage;

              const lastEvent =
                conversation.lastEvent;

              const messageTime =
                lastMessage
                  ? new Date(
                      lastMessage.created_at
                    ).getTime()
                  : 0;

              const eventTime =
                lastEvent
                  ? new Date(
                      lastEvent.created_at
                    ).getTime()
                  : 0;

              const lastItemIsEvent =
                eventTime >
                messageTime;

              let preview =
                'Start a conversation';

              if (
                lastItemIsEvent &&
                lastEvent
              ) {
                const actorIsMe =
                  lastEvent.actor_id ===
                  conversation.author_id ||
                  lastEvent.actor_id ===
                  conversation.participant_id
                    ? false
                    : false;

                /*
                 * Inbox не обязан писать имя автора события.
                 * Нам важнее коротко показать действие.
                 */

                preview =
                  lastEvent.event_type ===
                  'join'
                    ? 'Joined a Drop'
                    : 'Replied to a Drop';
              } else if (
                lastMessage
              ) {
                preview =
                  lastMessage.text;
              }

              return (
                <TouchableOpacity
                  key={
                    conversation.id
                  }
                  style={
                    styles.conversation
                  }
                  onPress={() =>
                    router.push(
                      `/chat/${conversation.id}`
                    )
                  }
                >
                  <View
                    style={
                      styles.avatar
                    }
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.conversationContent
                    }
                  >
                    <View
                      style={
                        styles.topRow
                      }
                    >
                      <View
                        style={
                          styles.nameRow
                        }
                      >
                        <Text
                          style={
                            styles.name
                          }
                        >
                          {name}
                        </Text>

                        {!!username && (
                          <Text
                            style={
                              styles.username
                            }
                          >
                            @{username}
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.time
                        }
                      >
                        {formatInboxTime(
                          conversation.lastActivityAt
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        lastItemIsEvent
                          ? styles.eventPreview
                          : styles.preview
                      }
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                  </View>
                </TouchableOpacity>
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
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 16,
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
      fontSize: 18,
      fontWeight: '600',
    },

    emptySubtitle: {
      color: '#666666',
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 8,
    },

    conversation: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#222222',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 14,
    },

    avatarText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    conversationContent: {
      flex: 1,
    },

    topRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: 10,
    },

    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },

    name: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    username: {
      color: '#555555',
      fontSize: 13,
    },

    time: {
      color: '#444444',
      fontSize: 12,
    },

    preview: {
      color: '#AAAAAA',
      fontSize: 14,
      marginTop: 5,
    },

    eventPreview: {
      color: '#666666',
      fontSize: 14,
      marginTop: 5,
    },
  });