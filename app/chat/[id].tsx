import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useState } from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatStore } from '@/store/chats';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [text, setText] = useState('');

  const conversations = useChatStore(
    (state) => state.conversations
  );

  const sendMessage = useChatStore(
    (state) => state.sendMessage
  );

  const conversation = conversations.find(
    (item) => item.id === Number(id)
  );

  if (!conversation) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <Text style={styles.notFound}>
          Conversation not found.
        </Text>
      </View>
    );
  }

  const handleSend = () => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    sendMessage(
      conversation.id,
      trimmedText
    );

    setText('');
  };

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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerPerson}>
          <Text style={styles.name}>
            {conversation.participantName}
          </Text>

          <Text style={styles.username}>
            {conversation.participantUsername}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.context}>
        <Text style={styles.contextLabel}>
          CONNECTED THROUGH
        </Text>

        <Text style={styles.contextText}>
          {conversation.dropText}
        </Text>
      </View>

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {conversation.messages.length === 0 && (
          <Text style={styles.startMessage}>
            You connected through this Drop.
            Say something.
          </Text>
        )}

        {conversation.messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'you'
                ? styles.myMessage
                : styles.otherMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.sender === 'you' &&
                  styles.myMessageText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#555555"
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !text.trim() &&
              styles.sendButtonDisabled,
          ]}
          disabled={!text.trim()}
          onPress={handleSend}
        >
          <Text style={styles.sendText}>
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
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
    borderBottomColor: '#1A1A1A',
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
    backgroundColor: '#FFFFFF',
  },

  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A1A1A',
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
    borderTopColor: '#1A1A1A',
  },

  input: {
    flex: 1,
    backgroundColor: '#171717',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
  },

  sendButton: {
    backgroundColor: '#FFFFFF',
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