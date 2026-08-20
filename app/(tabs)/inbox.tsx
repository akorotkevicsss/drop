import { router } from 'expo-router';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatStore } from '@/store/chats';

export default function InboxScreen() {
  const conversations = useChatStore(
    (state) => state.conversations
  );

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
            When someone joins a Drop, your conversation
            will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView>
          {conversations.map((conversation) => {
            const lastMessage =
              conversation.messages[
                conversation.messages.length - 1
              ];

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
                  <Text style={styles.avatarText}>
                    {conversation.participantName.charAt(0)}
                  </Text>
                </View>

                <View style={styles.conversationContent}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>
                      {conversation.participantName}
                    </Text>

                    <Text style={styles.username}>
                      {conversation.participantUsername}
                    </Text>
                  </View>

                  {lastMessage ? (
                    <Text
                      style={styles.preview}
                      numberOfLines={1}
                    >
                      {lastMessage.text}
                    </Text>
                  ) : (
                    <Text
                      style={styles.contextPreview}
                      numberOfLines={1}
                    >
                      Connected through: {conversation.dropText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
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
    backgroundColor: '#000000',
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