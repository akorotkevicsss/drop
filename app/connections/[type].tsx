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
    View,
} from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import { supabase } from '@/lib/supabase';

type ConnectionType =
  | 'followers'
  | 'following';

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  can_view_followers: boolean;
  can_view_following: boolean;
};

type Connection = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ConnectionsScreen() {
  const {
    type,
    username,
  } =
    useLocalSearchParams<{
      type: string;
      username: string;
    }>();

  const cleanUsername =
    username?.replace(
      '@',
      ''
    ) ?? '';

  const connectionType:
    ConnectionType | null =
      type === 'followers' ||
      type === 'following'
        ? type
        : null;

  const [
    profile,
    setProfile,
  ] =
    useState<
      PublicProfile | null
    >(null);

  const [
    connections,
    setConnections,
  ] =
    useState<Connection[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    accessDenied,
    setAccessDenied,
  ] =
    useState(false);

  useEffect(() => {
    loadConnections();
  }, [
    connectionType,
    cleanUsername,
  ]);

  const loadConnections =
    async () => {
      if (
        !connectionType ||
        !cleanUsername
      ) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setAccessDenied(false);

        const {
          data:
            profileData,
          error:
            profileError,
        } =
          await supabase.rpc(
            'get_public_profile',
            {
              target_username:
                cleanUsername,
            }
          );

        if (
          profileError
        ) {
          console.error(
            'CONNECTION PROFILE ERROR:',
            profileError
          );

          Alert.alert(
            'Error',
            'Could not load this profile.'
          );

          return;
        }

        const loadedProfile =
          (
            profileData?.[0] ??
            null
          ) as PublicProfile | null;

        if (
          !loadedProfile
        ) {
          setProfile(null);
          return;
        }

        setProfile(
          loadedProfile
        );

        const allowed =
          connectionType ===
          'followers'
            ? loadedProfile.can_view_followers
            : loadedProfile.can_view_following;

        if (!allowed) {
          setAccessDenied(
            true
          );

          setConnections(
            []
          );

          return;
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_profile_connections',
            {
              target_user_id:
                loadedProfile.id,

              connection_type:
                connectionType,
            }
          );

        if (error) {
          console.error(
            'LOAD CONNECTIONS ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not load this list.'
          );

          return;
        }

        setConnections(
          (data ?? []) as
            Connection[]
        );
      } finally {
        setLoading(false);
      }
    };

  const title =
    connectionType ===
    'followers'
      ? 'Followers'
      : connectionType ===
          'following'
        ? 'Following'
        : 'Connections';

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

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
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={10}
        >
          <Text
            style={
              styles.back
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.title
            }
          >
            {title}
          </Text>

          {!!profile?.username && (
            <Text
              style={
                styles.subtitle
              }
            >
              @{profile.username}
            </Text>
          )}
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      {accessDenied ? (
        <View
          style={
            styles.stateContainer
          }
        >
          <Text
            style={
              styles.stateTitle
            }
          >
            This list is private.
          </Text>

          <Text
            style={
              styles.stateText
            }
          >
            The user has chosen not to show who is in this list.
          </Text>
        </View>
      ) : connections.length ===
        0 ? (
        <View
          style={
            styles.stateContainer
          }
        >
          <Text
            style={
              styles.stateTitle
            }
          >
            {connectionType ===
            'followers'
              ? 'No followers yet.'
              : 'Not following anyone yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView>
          {connections.map(
            (connection) => {
              const name =
                connection.display_name ||
                connection.username ||
                'Unnamed user';

              return (
                <Pressable
                  key={
                    connection.id
                  }
                  style={({ pressed }) => [
                    styles.personRow,
                    pressed &&
                      styles.personRowPressed,
                  ]}
                  onPress={() => {
                    if (
                      !connection.username
                    ) {
                      return;
                    }

                    router.push(
                      `/user/${connection.username}`
                    );
                  }}
                >
                  <UserAvatar
                    uri={
                      connection.avatar_url
                    }
                    name={
                      name
                    }
                    size={48}
                  />

                  <View
                    style={
                      styles.personText
                    }
                  >
                    <Text
                      style={
                        styles.personName
                      }
                    >
                      {name}
                    </Text>

                    {!!connection.username && (
                      <Text
                        style={
                          styles.personUsername
                        }
                      >
                        @{connection.username}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={
                      styles.chevron
                    }
                  >
                    ›
                  </Text>
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
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection: 'row',
      alignItems: 'center',
    },

    back: {
      color: '#FFFFFF',
      fontSize: 40,
      lineHeight: 40,
      fontWeight: '200',
    },

    headerText: {
      flex: 1,
      alignItems: 'center',
    },

    title: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    subtitle: {
      color: '#555555',
      fontSize: 11,
      marginTop: 2,
    },

    headerSpacer: {
      width: 24,
    },

    personRow: {
      minHeight: 72,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    personRowPressed: {
      opacity: 0.65,
    },

    personText: {
      flex: 1,
      marginLeft: 13,
    },

    personName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    personUsername: {
      color: '#666666',
      fontSize: 13,
      marginTop: 3,
    },

    chevron: {
      color: '#555555',
      fontSize: 28,
      fontWeight: '200',
    },

    stateContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },

    stateTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },

    stateText: {
      color: '#666666',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 7,
    },
  });