import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
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
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Drop = {
  id: string;
  author_id: string;
  text: string;
  city: string | null;
  created_at: string;
};

type JoinRequest = {
  id: string;
  drop_id: string;
  user_id: string;
  status:
    | 'pending'
    | 'accepted'
    | 'declined';

  created_at: string;

  profile: {
    username: string | null;
    display_name: string | null;
  } | null;
};

export default function RequestsScreen() {
  const { dropId } =
    useLocalSearchParams<{
      dropId: string;
    }>();

  const [drop, setDrop] =
    useState<Drop | null>(null);

  const [requests, setRequests] =
    useState<JoinRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [dropId]);

  const loadRequests = async () => {
    if (!dropId) {
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
          'Could not find current user.'
        );

        return;
      }

      const {
        data: dropData,
        error: dropError,
      } = await supabase
        .from('drops')
        .select(`
          id,
          author_id,
          text,
          city,
          created_at
        `)
        .eq('id', dropId)
        .eq('author_id', user.id)
        .maybeSingle();

      if (
        dropError ||
        !dropData
      ) {
        console.error(
          'LOAD REQUEST DROP ERROR:',
          dropError
        );

        setDrop(null);
        return;
      }

      setDrop(dropData);

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from('join_requests')
        .select(`
          id,
          drop_id,
          user_id,
          status,
          created_at
        `)
        .eq('drop_id', dropId)
        .order('created_at', {
          ascending: true,
        });

      if (requestError) {
        console.error(
          'LOAD JOIN REQUESTS ERROR:',
          requestError
        );

        Alert.alert(
          'Error',
          'Could not load Join requests.'
        );

        return;
      }

      const rawRequests =
        requestData ?? [];

      const userIds =
        rawRequests.map(
          (request) =>
            request.user_id
        );

      let profiles: {
        id: string;
        username: string | null;
        display_name: string | null;
      }[] = [];

      if (userIds.length > 0) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(`
            id,
            username,
            display_name
          `)
          .in('id', userIds);

        if (profileError) {
          console.error(
            'LOAD REQUEST PROFILES ERROR:',
            profileError
          );
        } else {
          profiles =
            profileData ?? [];
        }
      }

      const combined:
        JoinRequest[] =
        rawRequests.map(
          (request) => {
            const profile =
              profiles.find(
                (item) =>
                  item.id ===
                  request.user_id
              );

            return {
              ...request,
              profile: profile
                ? {
                    username:
                      profile.username,

                    display_name:
                      profile.display_name,
                  }
                : null,
            };
          }
        );

      setRequests(combined);
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = async (
    requestId: string,
    status:
      | 'accepted'
      | 'declined'
  ) => {
    try {
      setUpdatingId(requestId);

      const { error } =
        await supabase
          .from('join_requests')
          .update({
            status,
          })
          .eq('id', requestId);

      if (error) {
        console.error(
          'UPDATE JOIN REQUEST ERROR:',
          error
        );

        Alert.alert(
          'Error',
          `Could not ${status === 'accepted' ? 'accept' : 'decline'} this request.`
        );

        return;
      }

      setRequests(
        (current) =>
          current.map(
            (request) =>
              request.id ===
              requestId
                ? {
                    ...request,
                    status,
                  }
                : request
          )
      );
    } finally {
      setUpdatingId(null);
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

  if (!drop) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <View style={styles.header}>
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

          <Text
            style={styles.title}
          >
            Requests
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={
              styles.emptyText
            }
          >
            Drop not found.
          </Text>
        </View>
      </View>
    );
  }

  const pendingRequests =
    requests.filter(
      (request) =>
        request.status ===
        'pending'
    );

  const acceptedRequests =
    requests.filter(
      (request) =>
        request.status ===
        'accepted'
    );

  const declinedRequests =
    requests.filter(
      (request) =>
        request.status ===
        'declined'
    );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
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

        <Text style={styles.title}>
          Requests
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <View
        style={
          styles.dropPreview
        }
      >
        <Text
          style={
            styles.dropLabel
          }
        >
          YOUR DROP
        </Text>

        <Text
          style={styles.dropText}
        >
          {drop.text}
        </Text>

        {!!drop.city && (
          <Text
            style={
              styles.dropMeta
            }
          >
            {drop.city}
          </Text>
        )}
      </View>

      <ScrollView>
        {pendingRequests.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              PENDING
            </Text>

            {pendingRequests.map(
              (request) => {
                const name =
                  request.profile
                    ?.display_name ||
                  'Unnamed user';

                const username =
                  request.profile
                    ?.username;

                return (
                  <View
                    key={
                      request.id
                    }
                    style={
                      styles.requestRow
                    }
                  >
                    <Pressable
                      style={
                        styles.person
                      }
                      onPress={() => {
                        if (
                          username
                        ) {
                          router.push(
                            `/user/${username}`
                          );
                        }
                      }}
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

                      <View>
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
                    </Pressable>

                    <View
                      style={
                        styles.actions
                      }
                    >
                      <TouchableOpacity
                        style={
                          styles.acceptButton
                        }
                        disabled={
                          updatingId ===
                          request.id
                        }
                        onPress={() =>
                          updateRequest(
                            request.id,
                            'accepted'
                          )
                        }
                      >
                        <Text
                          style={
                            styles.acceptText
                          }
                        >
                          Accept
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={
                          styles.declineButton
                        }
                        disabled={
                          updatingId ===
                          request.id
                        }
                        onPress={() =>
                          updateRequest(
                            request.id,
                            'declined'
                          )
                        }
                      >
                        <Text
                          style={
                            styles.declineText
                          }
                        >
                          Decline
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
            )}
          </>
        )}

        {acceptedRequests.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              JOINED
            </Text>

            {acceptedRequests.map(
              (request) => {
                const name =
                  request.profile
                    ?.display_name ||
                  'Unnamed user';

                const username =
                  request.profile
                    ?.username;

                return (
                  <View
                    key={
                      request.id
                    }
                    style={
                      styles.requestRow
                    }
                  >
                    <Pressable
                      style={
                        styles.person
                      }
                      onPress={() => {
                        if (
                          username
                        ) {
                          router.push(
                            `/user/${username}`
                          );
                        }
                      }}
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

                      <View>
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
                    </Pressable>

                    <Text
                      style={
                        styles.joinedText
                      }
                    >
                      Joined
                    </Text>
                  </View>
                );
              }
            )}
          </>
        )}

        {declinedRequests.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              DECLINED
            </Text>

            {declinedRequests.map(
              (request) => {
                const name =
                  request.profile
                    ?.display_name ||
                  'Unnamed user';

                const username =
                  request.profile
                    ?.username;

                return (
                  <View
                    key={
                      request.id
                    }
                    style={
                      styles.requestRow
                    }
                  >
                    <View
                      style={
                        styles.person
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

                      <View>
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
                    </View>

                    <Text
                      style={
                        styles.declinedStatus
                      }
                    >
                      Declined
                    </Text>
                  </View>
                );
              }
            )}
          </>
        )}

        {requests.length === 0 && (
          <View
            style={
              styles.emptyContainer
            }
          >
            <Text
              style={
                styles.emptyText
              }
            >
              No requests yet.
            </Text>
          </View>
        )}
      </ScrollView>
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
      alignItems: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
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
      borderBottomColor:
        '#1A1A1A',
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
      borderBottomColor:
        '#1A1A1A',
    },

    person: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#222222',
      alignItems: 'center',
      justifyContent:
        'center',
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
      backgroundColor:
        '#FFFFFF',
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
      backgroundColor:
        '#171717',
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 20,
    },

    declineText: {
      color: '#AAAAAA',
      fontSize: 14,
      fontWeight: '500',
    },

    joinedText: {
      color: '#777777',
      fontSize: 13,
      marginTop: 14,
    },

    declinedStatus: {
      color: '#555555',
      fontSize: 13,
      marginTop: 14,
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