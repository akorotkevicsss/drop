import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatStore } from '@/store/chats';
import { useDropStore } from '@/store/drops';

export default function RequestsScreen() {
  const { dropId } = useLocalSearchParams<{
    dropId: string;
  }>();

  const drops = useDropStore((state) => state.drops);

  const acceptRequest = useDropStore(
    (state) => state.acceptRequest
  );

  const declineRequest = useDropStore(
    (state) => state.declineRequest
  );

  const createConversation = useChatStore(
    (state) => state.createConversation
  );

  const conversations = useChatStore(
    (state) => state.conversations
  );

  const numericDropId = Number(dropId);

  const drop = drops.find(
    (item) => item.id === numericDropId
  );

  if (!drop) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Requests</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Drop not found.
          </Text>
        </View>
      </View>
    );
  }

  const pendingRequests = drop.requests.filter(
    (request) => request.status === 'pending'
  );

  const acceptedRequests = drop.requests.filter(
    (request) => request.status === 'accepted'
  );

  const handleAccept = (
    requestId: number,
    name: string,
    username: string
  ) => {
    acceptRequest(drop.id, requestId);

    createConversation({
      id: Date.now(),
      dropId: drop.id,
      dropText: drop.text,
      participantName: name,
      participantUsername: username,
      messages: [],
    });
  };

  const openChat = (username: string) => {
    const conversation = conversations.find(
      (item) =>
        item.dropId === drop.id &&
        item.participantUsername === username
    );

    if (!conversation) {
      return;
    }

    router.push(`/chat/${conversation.id}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Requests</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.dropPreview}>
        <Text style={styles.dropLabel}>
          YOUR DROP
        </Text>

        <Text style={styles.dropText}>
          {drop.text}
        </Text>

        <Text style={styles.dropMeta}>
          {drop.meta}
        </Text>
      </View>

      <ScrollView>
        {pendingRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              PENDING
            </Text>

            {pendingRequests.map((request) => (
              <View
                key={request.id}
                style={styles.requestRow}
              >
                <View style={styles.person}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.name.charAt(0)}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.name}>
                      {request.name}
                    </Text>

                    <Text style={styles.username}>
                      {request.username}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() =>
                      handleAccept(
                        request.id,
                        request.name,
                        request.username
                      )
                    }
                  >
                    <Text style={styles.acceptText}>
                      Accept
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() =>
                      declineRequest(
                        drop.id,
                        request.id
                      )
                    }
                  >
                    <Text style={styles.declineText}>
                      Decline
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {acceptedRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              JOINED
            </Text>

            {acceptedRequests.map((request) => (
              <View
                key={request.id}
                style={styles.requestRow}
              >
                <View style={styles.person}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.name.charAt(0)}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.name}>
                      {request.name}
                    </Text>

                    <Text style={styles.username}>
                      {request.username}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() =>
                    openChat(request.username)
                  }
                >
                  <Text style={styles.chatButtonText}>
                    Open chat
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {pendingRequests.length === 0 &&
          acceptedRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No requests yet.
              </Text>
            </View>
          )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    color: '#FFFFFF',
    fontSize: 40,
    lineHeight: 40,
    fontWeight: '200',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  headerSpacer: {
    width: 28,
  },

  dropPreview: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },

  dropLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  dropText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    marginTop: 10,
  },

  dropMeta: {
    color: '#666666',
    fontSize: 13,
    marginTop: 8,
  },

  sectionTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },

  requestRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },

  person: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  username: {
    color: '#666666',
    fontSize: 13,
    marginTop: 3,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  acceptButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },

  acceptText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },

  declineButton: {
    backgroundColor: '#171717',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },

  declineText: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '500',
  },

  chatButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },

  chatButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },

  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },

  emptyText: {
    color: '#666666',
    fontSize: 15,
  },
});