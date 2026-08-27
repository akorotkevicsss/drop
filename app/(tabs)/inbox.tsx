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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type InboxMode =
  | 'messages'
  | 'requests';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Member = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};

type ConversationRow = {
  id: string;
  author_id: string;
  participant_id: string;
  conversation_type:
    | 'direct'
    | 'group';
  title: string | null;
  created_by: string | null;
  is_request: boolean;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type:
    | 'text'
    | 'image'
    | 'voice';
  created_at: string;
};

type EventRow = {
  conversation_id: string;
  event_type:
    | 'join'
    | 'reply';
  drop_text_snapshot:
    string | null;
  created_at: string;
};

type InboxConversation = {
  id: string;
  conversationType:
    | 'direct'
    | 'group';
  title: string;
  avatarUrl: string | null;
  preview: string;
  lastActivityAt: string;
  unread: boolean;
  isRequest: boolean;
};

function formatInboxTime(
  dateString: string
) {
  const date =
    new Date(dateString);

  const difference =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        60000
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

function messagePreview(
  message:
    MessageRow | null
) {
  if (!message) {
    return null;
  }

  if (
    message.message_type ===
    'image'
  ) {
    return 'Photo';
  }

  if (
    message.message_type ===
    'voice'
  ) {
    return 'Voice message';
  }

  return (
    message.text ||
    'Message'
  );
}

export default function InboxScreen() {
  const [
    mode,
    setMode,
  ] =
    useState<InboxMode>(
      'messages'
    );

  const [
    conversations,
    setConversations,
  ] =
    useState<
      InboxConversation[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const loadConversations =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          const {
            data: {
              user,
            },
          } =
            await supabase.auth.getUser();

          if (!user) {
            setConversations(
              []
            );
            return;
          }

          const {
            data:
              membershipData,
            error:
              membershipError,
          } =
            await supabase
              .from(
                'conversation_members'
              )
              .select(`
                conversation_id,
                user_id,
                last_read_at
              `)
              .eq(
                'user_id',
                user.id
              )
              .is(
                'left_at',
                null
              );

          if (
            membershipError
          ) {
            console.error(
              'INBOX MEMBERSHIPS ERROR:',
              membershipError
            );
            return;
          }

          const memberships =
            (
              membershipData ??
              []
            ) as Member[];

          if (
            memberships.length ===
            0
          ) {
            setConversations(
              []
            );
            return;
          }

          const conversationIds =
            memberships.map(
              (item) =>
                item.conversation_id
            );

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
                conversation_type,
                title,
                created_by,
                is_request,
                created_at
              `)
              .in(
                'id',
                conversationIds
              );

          if (
            conversationError
          ) {
            console.error(
              'INBOX CONVERSATIONS ERROR:',
              conversationError
            );
            return;
          }

          const rawConversations =
            (
              conversationData ??
              []
            ) as ConversationRow[];

          const {
            data:
              allMembersData,
            error:
              allMembersError,
          } =
            await supabase
              .from(
                'conversation_members'
              )
              .select(`
                conversation_id,
                user_id,
                last_read_at
              `)
              .in(
                'conversation_id',
                conversationIds
              )
              .is(
                'left_at',
                null
              );

          if (
            allMembersError
          ) {
            console.error(
              'INBOX ALL MEMBERS ERROR:',
              allMembersError
            );
          }

          const allMembers =
            (
              allMembersData ??
              []
            ) as Member[];

          const otherUserIds =
            [
              ...new Set(
                allMembers
                  .filter(
                    (member) =>
                      member.user_id !==
                      user.id
                  )
                  .map(
                    (member) =>
                      member.user_id
                  )
              ),
            ];

          let profiles:
            Profile[] = [];

          if (
            otherUserIds.length >
            0
          ) {
            const {
              data,
              error,
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
                  otherUserIds
                );

            if (error) {
              console.error(
                'INBOX PROFILES ERROR:',
                error
              );
            } else {
              profiles =
                (
                  data ??
                  []
                ) as Profile[];
            }
          }

          const {
            data:
              messageData,
            error:
              messageError,
          } =
            await supabase
              .from(
                'messages'
              )
              .select(`
                id,
                conversation_id,
                sender_id,
                text,
                message_type,
                created_at
              `)
              .in(
                'conversation_id',
                conversationIds
              )
              .is(
                'deleted_for_everyone_at',
                null
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              );

          if (
            messageError
          ) {
            console.error(
              'INBOX MESSAGES ERROR:',
              messageError
            );
          }

          const messages =
            (
              messageData ??
              []
            ) as MessageRow[];

          const {
            data:
              eventData,
            error:
              eventError,
          } =
            await supabase
              .from(
                'conversation_events'
              )
              .select(`
                conversation_id,
                event_type,
                drop_text_snapshot,
                created_at
              `)
              .in(
                'conversation_id',
                conversationIds
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              );

          if (
            eventError
          ) {
            console.error(
              'INBOX EVENTS ERROR:',
              eventError
            );
          }

          const events =
            (
              eventData ??
              []
            ) as EventRow[];

          const next =
            rawConversations.map(
              (
                conversation
              ) => {
                const myMembership =
                  memberships.find(
                    (item) =>
                      item.conversation_id ===
                      conversation.id
                  );

                const members =
                  allMembers.filter(
                    (item) =>
                      item.conversation_id ===
                      conversation.id
                  );

                const others =
                  members.filter(
                    (member) =>
                      member.user_id !==
                      user.id
                  );

                const otherProfiles =
                  others
                    .map(
                      (member) =>
                        profiles.find(
                          (profile) =>
                            profile.id ===
                            member.user_id
                        )
                    )
                    .filter(
                      (
                        profile
                      ): profile is Profile =>
                        !!profile
                    );

                const lastMessage =
                  messages.find(
                    (message) =>
                      message.conversation_id ===
                      conversation.id
                  ) ??
                  null;

                const lastEvent =
                  events.find(
                    (event) =>
                      event.conversation_id ===
                      conversation.id
                  ) ??
                  null;

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

                const lastActivityAt =
                  messageTime >=
                  eventTime
                    ? lastMessage
                        ?.created_at ??
                      conversation.created_at
                    : lastEvent
                        ?.created_at ??
                      conversation.created_at;

                let preview =
                  'Start a conversation';

                if (
                  messageTime >=
                    eventTime &&
                  lastMessage
                ) {
                  preview =
                    messagePreview(
                      lastMessage
                    ) ??
                    preview;
                } else if (
                  lastEvent
                ) {
                  preview =
                    lastEvent.event_type ===
                    'join'
                      ? 'Joined a Drop'
                      : 'Replied to a Drop';
                }

                const lastReadAt =
                  myMembership
                    ?.last_read_at;

                const unread =
                  !!lastMessage &&
                  lastMessage.sender_id !==
                    user.id &&
                  (
                    !lastReadAt ||
                    new Date(
                      lastMessage.created_at
                    ).getTime() >
                      new Date(
                        lastReadAt
                      ).getTime()
                  );

                if (
                  conversation.conversation_type ===
                  'group'
                ) {
                  return {
                    id:
                      conversation.id,
                    conversationType:
                      'group' as const,
                    title:
                      conversation.title?.trim() ||
                      otherProfiles
                        .slice(
                          0,
                          3
                        )
                        .map(
                          (profile) =>
                            profile.display_name ||
                            profile.username ||
                            'User'
                        )
                        .join(
                          ', '
                        ) ||
                      'Group',
                    avatarUrl:
                      null,
                    preview,
                    lastActivityAt,
                    unread,
                    isRequest:
                      conversation.is_request,
                  };
                }

                const other =
                  otherProfiles[0];

                return {
                  id:
                    conversation.id,
                  conversationType:
                    'direct' as const,
                  title:
                    other?.display_name ||
                    other?.username ||
                    'Unnamed user',
                  avatarUrl:
                    other?.avatar_url ??
                    null,
                  preview,
                  lastActivityAt,
                  unread,
                  isRequest:
                    conversation.is_request &&
                    conversation.created_by !==
                      user.id,
                };
              }
            );

          next.sort(
            (a, b) =>
              new Date(
                b.lastActivityAt
              ).getTime() -
              new Date(
                a.lastActivityAt
              ).getTime()
          );

          setConversations(
            next
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        loadConversations();
      },
      [
        loadConversations,
      ]
    )
  );

  const visible =
    conversations.filter(
      (conversation) =>
        mode ===
        'requests'
          ? conversation.isRequest
          : !conversation.isRequest
    );

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
          Messages
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Keep conversations and requests in one place.
        </Text>
      </View>

      <View
        style={
          styles.modeRow
        }
      >
        <Pressable
          style={
            styles.modeButton
          }
          onPress={() =>
            setMode(
              'messages'
            )
          }
        >
          <Text
            style={[
              styles.modeText,
              mode ===
                'messages' &&
                styles.modeTextActive,
            ]}
          >
            Messages
          </Text>

          <View
            style={[
              styles.modeLine,
              mode ===
                'messages' &&
                styles.modeLineActive,
            ]}
          />
        </Pressable>

        <View
          style={
            styles.modeDivider
          }
        />

        <Pressable
          style={
            styles.modeButton
          }
          onPress={() =>
            setMode(
              'requests'
            )
          }
        >
          <Text
            style={[
              styles.modeText,
              mode ===
                'requests' &&
                styles.modeTextActive,
            ]}
          >
            Requests
          </Text>

          <View
            style={[
              styles.modeLine,
              mode ===
                'requests' &&
                styles.modeLineActive,
            ]}
          />
        </Pressable>
      </View>

      {loading ? (
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
      ) : visible.length ===
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
            {mode ===
            'messages'
              ? 'No messages yet.'
              : 'No requests.'}
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            {mode ===
            'messages'
              ? 'Start a conversation or reply to a Drop.'
              : 'New message requests will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {visible.map(
            (
              conversation
            ) => (
              <Pressable
                key={
                  conversation.id
                }
                style={({ pressed }) => [
                  styles.conversation,
                  pressed &&
                    styles.conversationPressed,
                ]}
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
                  {conversation.conversationType ===
                  'group' ? (
                    <View
                      style={
                        styles.groupAvatar
                      }
                    >
                      <Text
                        style={
                          styles.groupAvatarText
                        }
                      >
                        {
                          conversation.title
                            .trim()
                            .slice(
                              0,
                              1
                            )
                            .toUpperCase()
                        }
                      </Text>
                    </View>
                  ) : (
                    <UserAvatar
                      uri={
                        conversation.avatarUrl
                      }
                      name={
                        conversation.title
                      }
                      size={
                        46
                      }
                    />
                  )}
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
                    <Text
                      numberOfLines={
                        1
                      }
                      style={[
                        styles.name,
                        conversation.unread &&
                          styles.nameUnread,
                      ]}
                    >
                      {
                        conversation.title
                      }
                    </Text>

                    <View
                      style={
                        styles.rightMeta
                      }
                    >
                      <Text
                        style={
                          styles.time
                        }
                      >
                        {formatInboxTime(
                          conversation.lastActivityAt
                        )}
                      </Text>

                      {conversation.unread && (
                        <View
                          style={
                            styles.unreadDot
                          }
                        />
                      )}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.preview,
                      conversation.unread &&
                        styles.previewUnread,
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {
                      conversation.preview
                    }
                  </Text>
                </View>
              </Pressable>
            )
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={() =>
          router.push(
            '/new-message'
          )
        }
        hitSlop={
          8
        }
        style={({ pressed }) => [
          styles.floatingCreateButton,
          pressed &&
            styles.floatingCreateButtonPressed,
        ]}
      >
        <Ionicons
          name="add"
          size={28}
          color={DropColors.warmWhite}
        />
      </Pressable>
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

    header: {
      minHeight: 128,
      paddingTop: 52,
      paddingHorizontal: 18,
      paddingBottom: 18,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      justifyContent: 'flex-end',
    },

    title: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.light,
      fontWeight: '300',
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: 0,
    },

    subtitle: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontWeight: '400',
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },

    modeRow: {
      height: 42,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    modeButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    modeText: {
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 14,
    },

    modeTextActive: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
    },

    modeLine: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 0,
      height: 1,
      backgroundColor: 'transparent',
    },

    modeLineActive: {
      backgroundColor: DropColors.wine,
    },

    modeDivider: {
      width: StyleSheet.hairlineWidth,
      height: 20,
      alignSelf: 'center',
      backgroundColor: DropColors.border,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    listContent: {
      paddingBottom: 88,
    },

    conversation: {
      minHeight: 72,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },

    conversationPressed: {
      opacity: 0.62,
    },

    avatar: {
      width: 46,
      height: 46,
      marginRight: 12,
    },

    groupAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        DropColors.surface,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    groupAvatarText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
    },

    conversationContent: {
      flex: 1,
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 10,
    },

    name: {
      flex: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    nameUnread: {
      fontFamily:
        DropTypography.semibold,
    },

    rightMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    time: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        DropColors.wine,
    },

    preview: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 4,
    },

    previewUnread: {
      color:
        DropColors.textSecondary,
    },

    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 40,
      paddingBottom: 50,
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
      textAlign: 'center',
      marginTop: 7,
    },

    floatingCreateButton: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      zIndex: 20,
      elevation: 6,
    },

    floatingCreateButtonPressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.97,
        },
      ],
    },

  });