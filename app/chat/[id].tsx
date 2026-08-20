import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useEffect,
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
  drop_id: string;
  author_id: string;
  participant_id: string;
};

type OtherUser = {
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

export default function ChatScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const scrollRef =
    useRef<ScrollView>(null);

  const [text, setText] =
    useState('');

  const [conversation, setConversation] =
    useState<Conversation | null>(null);

  const [otherUser, setOtherUser] =
    useState<OtherUser | null>(null);

  const [dropText, setDropText] =
    useState('');

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  useEffect(() => {
    loadChat();
  }, [id]);

  useEffect(() => {
    if (!conversation?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `conversation-${conversation.id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMessage =
            payload.new as Message;

          setMessages((current) => {
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
          });

          setTimeout(() => {
            scrollRef.current?.scrollToEnd({
              animated: true,
            });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const loadChat = async () => {
    if (!id) {
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Error',
          'Could not find the current user.'
        );

        return;
      }

      setCurrentUserId(user.id);

      const {
        data: conversationData,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(`
          id,
          drop_id,
          author_id,
          participant_id
        `)
        .eq('id', id)
        .maybeSingle();

      if (conversationError) {
        console.error(
          'LOAD CONVERSATION ERROR:',
          conversationError
        );

        return;
      }

      if (!conversationData) {
        setConversation(null);
        return;
      }

      setConversation(
        conversationData
      );

      const otherUserId =
        conversationData.author_id === user.id
          ? conversationData.participant_id
          : conversationData.author_id;

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(`
          username,
          display_name
        `)
        .eq('id', otherUserId)
        .single();

      if (profileError) {
        console.error(
          'LOAD CHAT PROFILE ERROR:',
          profileError
        );
      } else {
        setOtherUser(profileData);
      }

      const {
        data: dropData,
        error: dropError,
      } = await supabase
        .from('drops')
        .select('text')
        .eq(
          'id',
          conversationData.drop_id
        )
        .single();

      if (dropError) {
        console.error(
          'LOAD CHAT DROP ERROR:',
          dropError
        );
      } else {
        setDropText(
          dropData.text
        );
      }

      await loadMessages(
        conversationData.id
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (
    conversationId: string
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from('messages')
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
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      console.error(
        'LOAD MESSAGES ERROR:',
        error
      );

      return;
    }

    setMessages(data ?? []);
  };

  const handleSend = async () => {
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
      } = await supabase
        .from('messages')
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

          if (alreadyExists) {
            return current;
          }

          return [
            ...current,
            data,
          ];
        }
      );

      setText('');

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    } finally {
      setSending(false);
    }
  };

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
            headerShown: false,
          }}
        />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View
        style={styles.container}
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <View
          style={styles.header}
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
              style={styles.name}
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
    otherUser?.display_name ||
    'Unnamed user';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        style={styles.header}
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
            style={styles.name}
          >
            {displayName}
          </Text>

          {!!otherUser?.username && (
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

      <View
        style={styles.context}
      >
        <Text
          style={
            styles.contextLabel
          }
        >
          CONNECTED THROUGH
        </Text>

        <Text
          style={
            styles.contextText
          }
          numberOfLines={2}
        >
          {dropText}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={
          styles.messagesContent
        }
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({
            animated: false,
          })
        }
      >
        {messages.length === 0 && (
          <Text
            style={
              styles.startMessage
            }
          >
            You connected through this Drop.
            Say something.
          </Text>
        )}

        {messages.map(
          (message) => {
            const isMine =
              message.sender_id ===
              currentUserId;

            return (
              <View
                key={message.id}
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
                </Text>
              </View>
            );
          }
        )}
      </ScrollView>

      <View
        style={styles.composer}
      >
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#555555"
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={
            handleSend
          }
          editable={!sending}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,

            (!text.trim() ||
              sending) &&
              styles.sendButtonDisabled,
          ]}
          disabled={
            !text.trim() ||
            sending
          }
          onPress={handleSend}
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
      alignItems: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
    },

    backButton: {
      color: '#FFFFFF',
      fontSize: 40,
      lineHeight: 40,
      fontWeight: '200',
    },

    headerPerson: {
      flex: 1,
      alignItems: 'center',
    },

    headerSpacer: {
      width: 24,
    },

    name: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    username: {
      color: '#666666',
      fontSize: 12,
      marginTop: 2,
    },

    context: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    contextLabel: {
      color: '#555555',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
    },

    contextText: {
      color: '#AAAAAA',
      fontSize: 14,
      marginTop: 5,
    },

    messages: {
      flex: 1,
    },

    messagesContent: {
      padding: 20,
      gap: 10,
    },

    startMessage: {
      color: '#555555',
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 30,
    },

    messageBubble: {
      maxWidth: '78%',
      paddingHorizontal: 15,
      paddingVertical: 11,
      borderRadius: 18,
    },

    myMessage: {
      alignSelf: 'flex-end',
      backgroundColor:
        '#FFFFFF',
    },

    otherMessage: {
      alignSelf: 'flex-start',
      backgroundColor:
        '#1A1A1A',
    },

    messageText: {
      color: '#FFFFFF',
      fontSize: 15,
      lineHeight: 20,
    },

    myMessageText: {
      color: '#000000',
    },

    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 30,
      borderTopWidth: 1,
      borderTopColor:
        '#1A1A1A',
    },

    input: {
      flex: 1,
      backgroundColor:
        '#171717',
      color: '#FFFFFF',
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 22,
    },

    sendButton: {
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 22,
    },

    sendButtonDisabled: {
      opacity: 0.3,
    },

    sendText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },

    notFound: {
      color: '#FFFFFF',
      marginTop: 100,
      textAlign: 'center',
    },
  });