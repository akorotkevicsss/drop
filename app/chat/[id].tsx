import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Conversation = {
  id: string;
  author_id: string;
  participant_id: string;
};

type OtherUser = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

type ConversationEvent = {
  id: string;
  conversation_id: string;
  actor_id: string;
  drop_id: string | null;
  event_type: 'join' | 'reply';
  drop_text_snapshot: string | null;
  created_at: string;
};

type TimelineItem =
  | {
      type: 'message';
      created_at: string;
      data: Message;
    }
  | {
      type: 'event';
      created_at: string;
      data: ConversationEvent;
    };

export default function ChatScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const scrollRef =
    useRef<ScrollView>(null);

  const [text, setText] =
    useState('');

  const [
    conversation,
    setConversation,
  ] =
    useState<Conversation | null>(
      null
    );

  const [
    otherUser,
    setOtherUser,
  ] =
    useState<OtherUser | null>(
      null
    );

  const [
    messages,
    setMessages,
  ] =
    useState<Message[]>([]);

  const [
    events,
    setEvents,
  ] =
    useState<
      ConversationEvent[]
    >([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    otherUserLastReadAt,
    setOtherUserLastReadAt,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  useEffect(() => {
    loadChat();
  }, [id]);

  /*
   * REALTIME:
   * messages + conversation_events
   */

  useEffect(() => {
    if (
      !conversation?.id ||
      !currentUserId
    ) {
      return;
    }

    const messageChannel =
      supabase
        .channel(
          `messages-${conversation.id}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter:
              `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            const newMessage =
              payload.new as Message;

            setMessages(
              (current) => {
                const alreadyExists =
                  current.some(
                    (message) =>
                      message.id ===
                      newMessage.id
                  );

                if (alreadyExists) {
                  return current;
                }

                return [
                  ...current,
                  newMessage,
                ];
              }
            );

            /*
             * Если входящее сообщение пришло,
             * пока чат открыт —
             * сразу считаем его прочитанным.
             */

            if (
              newMessage.sender_id !==
              currentUserId
            ) {
              markConversationRead(
                conversation.id,
                currentUserId
              );

              setTimeout(() => {
                markConversationNotificationsRead(
                  conversation.id,
                  currentUserId
                );
              }, 100);
            }

            scrollToBottom();
          }
        )
        .subscribe();

    const eventChannel =
      supabase
        .channel(
          `events-${conversation.id}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table:
              'conversation_events',
            filter:
              `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            const newEvent =
              payload.new as ConversationEvent;

            setEvents(
              (current) => {
                const alreadyExists =
                  current.some(
                    (event) =>
                      event.id ===
                      newEvent.id
                  );

                if (alreadyExists) {
                  return current;
                }

                return [
                  ...current,
                  newEvent,
                ];
              }
            );

            scrollToBottom();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        messageChannel
      );

      supabase.removeChannel(
        eventChannel
      );
    };
  }, [
    conversation?.id,
    currentUserId,
  ]);

  /*
   * REALTIME READ RECEIPTS
   */

  useEffect(() => {
    if (
      !conversation?.id ||
      !otherUser?.id
    ) {
      return;
    }

    const readChannel =
      supabase
        .channel(
          `reads-${conversation.id}-${otherUser.id}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'conversation_reads',
            filter:
              `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            const row =
              payload.new as {
                user_id?: string;
                last_read_at?: string;
              };

            if (
              row.user_id !==
              otherUser.id
            ) {
              return;
            }

            if (
              row.last_read_at
            ) {
              setOtherUserLastReadAt(
                row.last_read_at
              );
            }
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        readChannel
      );
    };
  }, [
    conversation?.id,
    otherUser?.id,
  ]);

  /*
   * TIMELINE
   */

  const timeline =
    useMemo<TimelineItem[]>(
      () => {
        const messageItems:
          TimelineItem[] =
          messages.map(
            (message) => ({
              type: 'message',
              created_at:
                message.created_at,
              data: message,
            })
          );

        const eventItems:
          TimelineItem[] =
          events.map(
            (event) => ({
              type: 'event',
              created_at:
                event.created_at,
              data: event,
            })
          );

        return [
          ...messageItems,
          ...eventItems,
        ].sort(
          (a, b) =>
            new Date(
              a.created_at
            ).getTime() -
            new Date(
              b.created_at
            ).getTime()
        );
      },
      [
        messages,
        events,
      ]
    );

  const scrollToBottom =
    () => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd(
          {
            animated: true,
          }
        );
      }, 100);
    };

  /*
   * TIME
   */

  const formatMessageTime = (
    dateString: string
  ) => {
    const date =
      new Date(dateString);

    return date.toLocaleTimeString(
      undefined,
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    );
  };

  /*
   * READ STATE
   */

  const markConversationRead =
    async (
      conversationId: string,
      userId: string
    ) => {
      const { error } =
        await supabase
          .from(
            'conversation_reads'
          )
          .upsert(
            {
              conversation_id:
                conversationId,

              user_id:
                userId,

              last_read_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'conversation_id,user_id',
            }
          );

      if (error) {
        console.error(
          'MARK CONVERSATION READ ERROR:',
          error
        );
      }
    };

  const markConversationNotificationsRead =
    async (
      conversationId: string,
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
          .eq(
            'conversation_id',
            conversationId
          )
          .is(
            'read_at',
            null
          );

      if (error) {
        console.error(
          'MARK CHAT NOTIFICATIONS READ ERROR:',
          error
        );
      }
    };

  const loadOtherUserReadState =
    async (
      conversationId: string,
      otherUserId: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'conversation_reads'
          )
          .select(
            'last_read_at'
          )
          .eq(
            'conversation_id',
            conversationId
          )
          .eq(
            'user_id',
            otherUserId
          )
          .maybeSingle();

      if (error) {
        console.error(
          'LOAD OTHER READ STATE ERROR:',
          error
        );

        return;
      }

      setOtherUserLastReadAt(
        data?.last_read_at ??
          null
      );
    };

  /*
   * LOAD CHAT
   */

  const loadChat =
    async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);

        const {
          data: { user },
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          Alert.alert(
            'Error',
            'Could not find the current user.'
          );

          return;
        }

        setCurrentUserId(
          user.id
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
              participant_id
            `)
            .eq(
              'id',
              id
            )
            .maybeSingle();

        if (
          conversationError
        ) {
          console.error(
            'LOAD CONVERSATION ERROR:',
            conversationError
          );

          return;
        }

        if (
          !conversationData
        ) {
          setConversation(
            null
          );

          return;
        }

        const isParticipant =
          conversationData.author_id ===
            user.id ||
          conversationData.participant_id ===
            user.id;

        if (!isParticipant) {
          setConversation(
            null
          );

          return;
        }

        setConversation(
          conversationData
        );

        const otherUserId =
          conversationData.author_id ===
          user.id
            ? conversationData.participant_id
            : conversationData.author_id;

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
              display_name
            `)
            .eq(
              'id',
              otherUserId
            )
            .single();

        if (
          profileError
        ) {
          console.error(
            'LOAD CHAT PROFILE ERROR:',
            profileError
          );
        } else {
          setOtherUser(
            profileData
          );
        }

        await Promise.all([
          loadMessages(
            conversationData.id
          ),

          loadEvents(
            conversationData.id
          ),

          loadOtherUserReadState(
            conversationData.id,
            otherUserId
          ),
        ]);

        await Promise.all([
          markConversationRead(
            conversationData.id,
            user.id
          ),

          markConversationNotificationsRead(
            conversationData.id,
            user.id
          ),
        ]);
      } catch (
        error
      ) {
        console.error(
          'LOAD CHAT ERROR:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  /*
   * LOAD MESSAGES
   */

  const loadMessages =
    async (
      conversationId: string
    ) => {
      const {
        data,
        error,
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
            created_at
          `)
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          );

      if (error) {
        console.error(
          'LOAD MESSAGES ERROR:',
          error
        );

        return;
      }

      setMessages(
        data ?? []
      );
    };

  /*
   * LOAD EVENTS
   */

  const loadEvents =
    async (
      conversationId: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'conversation_events'
          )
          .select(`
            id,
            conversation_id,
            actor_id,
            drop_id,
            event_type,
            drop_text_snapshot,
            created_at
          `)
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          );

      if (error) {
        console.error(
          'LOAD EVENTS ERROR:',
          error
        );

        return;
      }

      setEvents(
        (data ?? []) as
          ConversationEvent[]
      );
    };

  /*
   * SEND MESSAGE
   */

  const handleSend =
    async () => {
      const trimmedText =
        text.trim();

      if (
        !trimmedText ||
        !conversation ||
        !currentUserId ||
        sending
      ) {
        return;
      }

      try {
        setSending(true);

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'messages'
            )
            .insert({
              conversation_id:
                conversation.id,

              sender_id:
                currentUserId,

              text:
                trimmedText,
            })
            .select(`
              id,
              conversation_id,
              sender_id,
              text,
              created_at
            `)
            .single();

        if (error) {
          console.error(
            'SEND MESSAGE ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not send message.'
          );

          return;
        }

        setMessages(
          (current) => {
            const alreadyExists =
              current.some(
                (message) =>
                  message.id ===
                  data.id
              );

            if (
              alreadyExists
            ) {
              return current;
            }

            return [
              ...current,
              data,
            ];
          }
        );

        setText('');

        await markConversationRead(
          conversation.id,
          currentUserId
        );

        scrollToBottom();
      } finally {
        setSending(false);
      }
    };

  /*
   * IS MESSAGE READ
   */

  const isMessageRead = (
    message: Message
  ) => {
    if (
      !otherUserLastReadAt
    ) {
      return false;
    }

    return (
      new Date(
        otherUserLastReadAt
      ).getTime() >=
      new Date(
        message.created_at
      ).getTime()
    );
  };

  /*
   * CHECK ICON
   *
   * Рисуем именно линиями,
   * а не символом ✓.
   */

  const renderSingleCheck = () => {
    return (
      <View
        style={
          styles.singleCheck
        }
      >
        <View
          style={
            styles.checkShort
          }
        />

        <View
          style={
            styles.checkLong
          }
        />
      </View>
    );
  };

  /*
   * DOUBLE CHECK
   *
   * Две галочки находятся на одной
   * высоте и плотно сцеплены.
   */

  const renderDoubleCheck = () => {
    return (
      <View
        style={
          styles.doubleCheckContainer
        }
      >
        <View
          style={
            styles.doubleCheckLeft
          }
        >
          <View
            style={
              styles.doubleCheckLeftShort
            }
          />

          <View
            style={
              styles.doubleCheckLeftLong
            }
          />
        </View>

        <View
          style={
            styles.doubleCheckRight
          }
        >
          <View
            style={
              styles.doubleCheckRightShort
            }
          />

          <View
            style={
              styles.doubleCheckRightLong
            }
          />
        </View>
      </View>
    );
  };

  /*
   * MESSAGE STATUS
   *
   * Metadata position absolute.
   * Внутри текста есть невидимый spacer,
   * который резервирует для неё место.
   */

  const renderMessage = (
    message: Message
  ) => {
    const isMine =
      message.sender_id ===
      currentUserId;

    const isRead =
      isMine &&
      isMessageRead(
        message
      );

    const time =
      formatMessageTime(
        message.created_at
      );

    /*
     * Исходящему нужно чуть больше
     * места под time + ✓✓.
     *
     * Входящему — только time.
     */

    const spacer =
      isMine
        ? '             '
        : '        ';

    return (
      <View
        key={
          `message-${message.id}`
        }
        style={[
          styles.messageBubble,

          isMine
            ? styles.myMessage
            : styles.otherMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,

            isMine &&
              styles.myMessageText,
          ]}
        >
          {message.text}

          {/*
           * Невидимый placeholder.
           *
           * За счёт него React Native
           * заранее оставляет место в
           * последней строке под time/checks.
           */}
          <Text
            style={
              styles.metadataSpacer
            }
          >
            {spacer}
          </Text>
        </Text>

        <View
          style={[
            styles.messageMetadata,
            !isMine && styles.otherMessageMetadata,
          ]}
        >
          <Text
            style={[
              styles.messageTime,

              isMine
                ? styles.myMessageTime
                : styles.otherMessageTime,
            ]}
          >
            {time}
          </Text>

          {isMine && (
            <View
              style={
                styles.receiptWrapper
              }
            >
              {isRead
                ? renderDoubleCheck()
                : renderSingleCheck()}
            </View>
          )}
        </View>
      </View>
    );
  };

  /*
   * DROP EVENT
   */

  const renderEvent = (
    event:
      ConversationEvent
  ) => {
    const isCurrentUser =
      event.actor_id ===
      currentUserId;

    const actorLabel =
      isCurrentUser
        ? 'You'
        : otherUser
              ?.display_name ||
          otherUser
              ?.username ||
          'User';

    const action =
      event.event_type ===
      'join'
        ? 'joined a Drop'
        : 'replied to a Drop';

    return (
      <View
        key={
          `event-${event.id}`
        }
        style={
          styles.eventContainer
        }
      >
        <Text
          style={
            styles.eventAction
          }
        >
          {actorLabel}{' '}
          {action}
        </Text>

        {!!event.drop_text_snapshot && (
          <View
            style={
              styles.eventDropRow
            }
          >
            <View
              style={
                styles.eventLine
              }
            />

            <Text
              style={
                styles.eventDropText
              }
              numberOfLines={
                3
              }
            >
              {
                event.drop_text_snapshot
              }
            </Text>

            <View
              style={
                styles.eventLine
              }
            />
          </View>
        )}
      </View>
    );
  };

  /*
   * LOADING
   */

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator />

        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />
      </View>
    );
  }

  /*
   * NOT FOUND
   */

  if (!conversation) {
    return (
      <View
        style={
          styles.container
        }
      >
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />

        <View
          style={
            styles.header
          }
        >
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButton
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.headerPerson
            }
          >
            <Text
              style={
                styles.name
              }
            >
              Chat
            </Text>
          </View>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <Text
          style={
            styles.notFound
          }
        >
          Conversation not found.
        </Text>
      </View>
    );
  }

  const displayName =
    otherUser
      ?.display_name ||
    'Unnamed user';

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
    >
      <Stack.Screen
        options={{
          headerShown:
            false,
        }}
      />

      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButton
            }
          >
            ‹
          </Text>
        </TouchableOpacity>

        <View
          style={
            styles.headerPerson
          }
        >
          <Text
            style={
              styles.name
            }
          >
            {displayName}
          </Text>

          {!!otherUser
            ?.username && (
            <Text
              style={
                styles.username
              }
            >
              @{otherUser.username}
            </Text>
          )}
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={
          styles.messages
        }
        contentContainerStyle={
          styles.messagesContent
        }
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd(
            {
              animated:
                false,
            }
          )
        }
      >
        {timeline.length ===
          0 && (
          <Text
            style={
              styles.startMessage
            }
          >
            Start the conversation.
          </Text>
        )}

        {timeline.map(
          (item) => {
            if (
              item.type ===
              'event'
            ) {
              return renderEvent(
                item.data
              );
            }

            return renderMessage(
              item.data
            );
          }
        )}
      </ScrollView>

      <View
        style={
          styles.composer
        }
      >
        <TextInput
          style={
            styles.input
          }
          placeholder="Message..."
          placeholderTextColor="#555555"
          value={text}
          onChangeText={
            setText
          }
          returnKeyType="send"
          onSubmitEditing={
            handleSend
          }
          editable={
            !sending
          }
        />

        <TouchableOpacity
          style={[
            styles.sendButton,

            (
              !text.trim() ||
              sending
            ) &&
              styles.sendButtonDisabled,
          ]}
          disabled={
            !text.trim() ||
            sending
          }
          onPress={
            handleSend
          }
        >
          <Text
            style={
              styles.sendText
            }
          >
            {sending
              ? '...'
              : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    backButton: {
      color:
        '#FFFFFF',
      fontSize: 40,
      lineHeight: 40,
      fontWeight:
        '200',
    },

    headerPerson: {
      flex: 1,
      alignItems:
        'center',
    },

    headerSpacer: {
      width: 24,
    },

    name: {
      color:
        '#FFFFFF',
      fontSize: 16,
      fontWeight:
        '600',
    },

    username: {
      color:
        '#666666',
      fontSize: 12,
      marginTop: 2,
    },

    messages: {
      flex: 1,
    },

    messagesContent: {
      paddingHorizontal:
        20,
      paddingTop: 20,
      paddingBottom: 30,
      gap: 10,
    },

    startMessage: {
      color:
        '#555555',
      fontSize: 14,
      lineHeight: 20,
      textAlign:
        'center',
      marginTop: 30,
    },

    /*
     * MESSAGE BUBBLE
     */

    messageBubble: {
      position:
        'relative',

      maxWidth:
        '82%',

      minHeight: 42,

      borderRadius:
        18,

      paddingLeft: 15,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 9,
    },

      myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#FFFFFF',

        paddingLeft: 15,
        paddingRight: 30,
        paddingTop: 10,
        paddingBottom: 9,
      },

      otherMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#1A1A1A',

        paddingLeft: 15,
        paddingRight: 45,
        paddingTop: 10,
        paddingBottom: 9,
      },

    otherMessage: {
      alignSelf:
        'flex-start',

      backgroundColor:
        '#1A1A1A',
    },

    messageText: {
      color:
        '#FFFFFF',

      fontSize: 15,
      lineHeight: 21,
    },

    myMessageText: {
      color:
        '#000000',
    },

    /*
     * Невидимое место под metadata.
     */

    metadataSpacer: {
      color:
        'transparent',
      fontSize: 11,
    },

    /*
     * TIME + CHECKS
     */

      messageMetadata: {
        position: 'absolute',
        right: 9,
        bottom: 7,
        flexDirection: 'row',
        alignItems: 'center',
      },

    otherMessageMetadata: {
    right: 8,
  },  

    messageTime: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '400',
    },

    myMessageTime: {
      color:
        '#8A8A8A',
    },

    otherMessageTime: {
      color:
        '#666666',
        marginRight: -4,
    },

    receiptWrapper: {
      width: 20,
      height: 12,

      marginLeft: 4,

      justifyContent:
        'center',
    },

    /*
     * SINGLE CHECK
     */

    singleCheck: {
      position:
        'relative',

      width: 14,
      height: 10,

      marginLeft: 3,
    
    },

    checkShort: {
      position:
        'absolute',

      width: 6,
      height: 1.7,

      left: 0,
      top: 5,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '43deg',
        },
      ],
    },

    checkLong: {
      position:
        'absolute',

      width: 11,
      height: 1.7,

      left: 3,
      top: 3,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '-49deg',
        },
      ],
    },

    /*
     * DOUBLE CHECK
     *
     * Они теперь не используют mask.
     * Поэтому угол первой больше
     * не может быть обрезан.
     */

    doubleCheckContainer: {
      position:
        'relative',

      width: 20,
      height: 11,
    },

    /*
     * ЛЕВАЯ галочка.
     */

    doubleCheckLeft: {
      position:
        'absolute',

      left: 0,
      top: 0,

      width: 13,
      height: 10,
    },

    doubleCheckLeftShort: {
      position:
        'absolute',

      width: 6,
      height: 1.7,

      left: 0,
      top: 5,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '43deg',
        },
      ],
    },

    doubleCheckLeftLong: {
      position:
        'absolute',

      width: 11,
      height: 1.7,

      left: 3,
      top: 3,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '-49deg',
        },
      ],
    },

    /*
     * ПРАВАЯ галочка.
     *
     * Именно она стоит поверх/рядом
     * с левой.
     */

    doubleCheckRight: {
      position:
        'absolute',

      left: 6,
      top: 0,

      width: 14,
      height: 10,
    },

    /*
     * Короткий хвост правой галочки.
     *
     * Он действительно КОРОЧЕ,
     * но точка соединения остаётся
     * возле длинной линии.
     *
     * То есть визуально:
     *
     * ______|
     * становится
     *   ___|
     */

    doubleCheckRightShort: {
      position:
        'absolute',

      width: 4,
      height: 1.7,

      left: 2,
      top: 5,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '43deg',
        },
      ],
    },

    doubleCheckRightLong: {
      position:
        'absolute',

      width: 11,
      height: 1.7,

      left: 3,
      top: 3,

      backgroundColor:
        '#777777',

      borderRadius: 2,

      transform: [
        {
          rotate:
            '-49deg',
        },
      ],
    },

    /*
     * DROP EVENTS
     */

    eventContainer: {
      alignSelf:
        'center',
      alignItems:
        'center',
      width:
        '92%',
      marginVertical:
        16,
    },

    eventAction: {
      color:
        '#666666',
      fontSize: 12,
      fontWeight:
        '600',
      marginBottom:
        11,
    },

    eventDropRow: {
      width:
        '100%',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    eventLine: {
      flex: 1,
      height: 1,
      backgroundColor:
        '#242424',
    },

    eventDropText: {
      color:
        '#888888',
      fontSize: 14,
      lineHeight: 19,
      textAlign:
        'center',
      marginHorizontal:
        14,
      maxWidth:
        '70%',
    },

    /*
     * COMPOSER
     */

    composer: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,

      paddingHorizontal:
        14,

      paddingTop:
        10,

      paddingBottom:
        30,

      borderTopWidth:
        1,

      borderTopColor:
        '#1A1A1A',
    },

    input: {
      flex: 1,

      backgroundColor:
        '#171717',

      color:
        '#FFFFFF',

      fontSize: 15,

      paddingHorizontal:
        16,

      paddingVertical:
        11,

      borderRadius:
        22,
    },

    sendButton: {
      backgroundColor:
        '#FFFFFF',

      paddingHorizontal:
        16,

      paddingVertical:
        11,

      borderRadius:
        22,
    },

    sendButtonDisabled: {
      opacity:
        0.3,
    },

    sendText: {
      color:
        '#000000',

      fontSize: 14,

      fontWeight:
        '600',
    },

    notFound: {
      color:
        '#FFFFFF',

      marginTop:
        100,

      textAlign:
        'center',
    },
  });