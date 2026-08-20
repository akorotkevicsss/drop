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

type Conversation = {
  id: string;
  drop_id: string;
  author_id: string;
  participant_id: string;
  created_at: string;

  drop: {
    text: string;
  } | null;

  otherUser: Profile | null;

  lastMessage: {
    text: string;
    created_at: string;
  } | null;
};

export default function InboxScreen() {
  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const loadConversations = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const {
        data: conversationData,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(`
          id,
          drop_id,
          author_id,
          participant_id,
          created_at,
          drops!conversations_drop_id_fkey (
            text
          )
        `)
        .order('created_at', {
          ascending: false,
        });

      if (conversationError) {
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

      const otherUserIds =
        rawConversations.map(
          (conversation) =>
            conversation.author_id === user.id
              ? conversation.participant_id
              : conversation.author_id
        );

      let profiles: {
        id: string;
        username: string | null;
        display_name: string | null;
      }[] = [];

      if (otherUserIds.length > 0) {
        const {
          data: profileData,
        } = await supabase
          .from('profiles')
          .select(`
            id,
            username,
            display_name
          `)
          .in('id', otherUserIds);

        profiles = profileData ?? [];
      }

      const result: Conversation[] =
        await Promise.all(
          rawConversations.map(
            async (conversation) => {
              const otherUserId =
                conversation.author_id === user.id
                  ? conversation.participant_id
                  : conversation.author_id;

              const profile =
                profiles.find(
                  (item) =>
                    item.id === otherUserId
                );

              const {
                data: lastMessageData,
              } = await supabase
                .from('messages')
                .select(`
                  text,
                  created_at
                `)
                .eq(
                  'conversation_id',
                  conversation.id
                )
                .order('created_at', {
                  ascending: false,
                })
                .limit(1)
                .maybeSingle();

              return {
                id: conversation.id,
                drop_id:
                  conversation.drop_id,
                author_id:
                  conversation.author_id,
                participant_id:
                  conversation.participant_id,
                created_at:
                  conversation.created_at,

                drop:
                  conversation.drops as unknown as {
                    text: string;
                  } | null,

                otherUser: profile
                  ? {
                      username:
                        profile.username,

                      display_name:
                        profile.display_name,
                    }
                  : null,

                lastMessage:
                  lastMessageData ?? null,
              };
            }
          )
        );

      setConversations(result);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Inbox
        </Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            No conversations yet.
          </Text>

          <Text style={styles.emptySubtitle}>
            When someone joins a Drop,
            your conversation will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView>
          {conversations.map(
            (conversation) => {
              const name =
                conversation.otherUser
                  ?.display_name ||
                'Unnamed user';

              const username =
                conversation.otherUser
                  ?.username;

              return (
                <TouchableOpacity
                  key={conversation.id}
                  style={styles.conversation}
                  onPress={() =>
                    router.push(
                      `/chat/${conversation.id}`
                    )
                  }
                >
                  <View style={styles.avatar}>
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
                        styles.nameRow
                      }
                    >
                      <Text
                        style={styles.name}
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

                    {conversation.lastMessage ? (
                      <Text
                        style={
                          styles.preview
                        }
                        numberOfLines={1}
                      >
                        {
                          conversation
                            .lastMessage.text
                        }
                      </Text>
                    ) : (
                      <Text
                        style={
                          styles.contextPreview
                        }
                        numberOfLines={1}
                      >
                        Connected through:{' '}
                        {conversation.drop
                          ?.text}
                      </Text>
                    )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderBottomColor: '#1A1A1A',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
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

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  preview: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 5,
  },

  contextPreview: {
    color: '#555555',
    fontSize: 14,
    marginTop: 5,
  },
});