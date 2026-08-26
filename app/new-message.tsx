import {
    Stack,
    router,
} from 'expo-router';

import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import {
    DropColors,
    DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode =
  | 'direct'
  | 'group';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function NewMessageScreen() {
  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    profiles,
    setProfiles,
  ] =
    useState<
      Profile[]
    >([]);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    mode,
    setMode,
  ] =
    useState<Mode>(
      'direct'
    );

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    groupTitle,
    setGroupTitle,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  useEffect(
    () => {
      loadFollowing();
    },
    []
  );

  const loadFollowing =
    async () => {
      try {
        setLoading(
          true
        );

        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          return;
        }

        setCurrentUserId(
          user.id
        );

        const {
          data:
            followData,
          error:
            followError,
        } =
          await supabase
            .from(
              'follows'
            )
            .select(
              'following_id'
            )
            .eq(
              'follower_id',
              user.id
            );

        if (
          followError
        ) {
          console.error(
            'NEW MESSAGE FOLLOWS ERROR:',
            followError
          );
          return;
        }

        const ids =
          (
            followData ??
            []
          ).map(
            (follow) =>
              follow.following_id
          );

        if (
          ids.length ===
          0
        ) {
          setProfiles(
            []
          );
          return;
        }

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
              ids
            )
            .order(
              'display_name',
              {
                ascending:
                  true,
              }
            );

        if (
          error
        ) {
          console.error(
            'NEW MESSAGE PROFILES ERROR:',
            error
          );
          return;
        }

        setProfiles(
          (
            data ??
            []
          ) as Profile[]
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const filteredProfiles =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase()
            .replace(
              /^@/,
              ''
            );

        if (
          !normalized
        ) {
          return profiles;
        }

        return profiles.filter(
          (profile) => {
            const name =
              (
                profile.display_name ??
                ''
              ).toLowerCase();

            const username =
              (
                profile.username ??
                ''
              ).toLowerCase();

            return (
              name.includes(
                normalized
              ) ||
              username.includes(
                normalized
              )
            );
          }
        );
      },
      [
        profiles,
        query,
      ]
    );

  const createDirect =
    async (
      profile: Profile
    ) => {
      if (
        !currentUserId ||
        creating
      ) {
        return;
      }

      try {
        setCreating(
          true
        );

        const {
          data:
            existing,
          error:
            existingError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .select(
              'id'
            )
            .eq(
              'conversation_type',
              'direct'
            )
            .or(
              `and(author_id.eq.${currentUserId},participant_id.eq.${profile.id}),and(author_id.eq.${profile.id},participant_id.eq.${currentUserId})`
            )
            .limit(1)
            .maybeSingle();

        if (
          existingError
        ) {
          console.error(
            'FIND DIRECT ERROR:',
            existingError
          );
        }

        if (
          existing?.id
        ) {
          router.replace(
            `/chat/${existing.id}`
          );
          return;
        }

        const {
          data:
            conversation,
          error:
            conversationError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .insert({
              author_id:
                currentUserId,
              participant_id:
                profile.id,
              conversation_type:
                'direct',
              created_by:
                currentUserId,
              is_request:
                false,
              source:
                'direct',
              drop_id:
                null,
              join_request_id:
                null,
            })
            .select(
              'id'
            )
            .single();

        if (
          conversationError ||
          !conversation
        ) {
          console.error(
            'CREATE DIRECT ERROR:',
            conversationError
          );

          Alert.alert(
            'Error',
            'Could not start this conversation.'
          );
          return;
        }

        const {
          error:
            memberError,
        } =
          await supabase
            .from(
              'conversation_members'
            )
            .insert([
              {
                conversation_id:
                  conversation.id,
                user_id:
                  currentUserId,
                is_admin:
                  true,
                last_read_at:
                  new Date().toISOString(),
              },
              {
                conversation_id:
                  conversation.id,
                user_id:
                  profile.id,
                is_admin:
                  false,
              },
            ]);

        if (
          memberError &&
          memberError.code !==
            '23505'
        ) {
          console.error(
            'CREATE DIRECT MEMBERS ERROR:',
            memberError
          );
        }

        router.replace(
          `/chat/${conversation.id}`
        );
      } finally {
        setCreating(
          false
        );
      }
    };

  const toggleSelected =
    (
      userId: string
    ) => {
      setSelectedIds(
        (current) => {
          const next =
            new Set(
              current
            );

          if (
            next.has(
              userId
            )
          ) {
            next.delete(
              userId
            );
          } else {
            next.add(
              userId
            );
          }

          return next;
        }
      );
    };

  const createGroup =
    async () => {
      if (
        !currentUserId ||
        selectedIds.size <
          2 ||
        creating
      ) {
        return;
      }

      const selected =
        profiles.filter(
          (profile) =>
            selectedIds.has(
              profile.id
            )
        );

      const title =
        groupTitle.trim() ||
        selected
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
          );

      try {
        setCreating(
          true
        );

        const firstMember =
          selected[0];

        if (
          !firstMember
        ) {
          return;
        }

        const {
          data:
            conversation,
          error:
            conversationError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .insert({
              author_id:
                currentUserId,
              participant_id:
                firstMember.id,
              conversation_type:
                'group',
              title,
              created_by:
                currentUserId,
              is_request:
                false,
              source:
                'group',
              drop_id:
                null,
              join_request_id:
                null,
            })
            .select(
              'id'
            )
            .single();

        if (
          conversationError ||
          !conversation
        ) {
          console.error(
            'CREATE GROUP ERROR:',
            conversationError
          );

          Alert.alert(
            'Error',
            conversationError
              ?.message ??
              'Could not create group.'
          );
          return;
        }

        const members = [
          {
            conversation_id:
              conversation.id,
            user_id:
              currentUserId,
            is_admin:
              true,
            last_read_at:
              new Date().toISOString(),
          },
          ...selected.map(
            (profile) => ({
              conversation_id:
                conversation.id,
              user_id:
                profile.id,
              is_admin:
                false,
              last_read_at:
                null,
            })
          ),
        ];

        const {
          error:
            memberError,
        } =
          await supabase
            .from(
              'conversation_members'
            )
            .insert(
              members
            );

        if (
          memberError
        ) {
          console.error(
            'CREATE GROUP MEMBERS ERROR:',
            memberError
          );

          Alert.alert(
            'Error',
            'The group was created, but its members could not be added.'
          );
          return;
        }

        router.replace(
          `/chat/${conversation.id}`
        );
      } finally {
        setCreating(
          false
        );
      }
    };

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
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={
            10
          }
        >
          <Text
            style={
              styles.cancel
            }
          >
            Cancel
          </Text>
        </Pressable>

        <Text
          style={
            styles.title
          }
        >
          {mode ===
          'direct'
            ? 'New message'
            : 'New group'}
        </Text>

        {mode ===
        'group' ? (
          <Pressable
            onPress={
              createGroup
            }
            disabled={
              selectedIds.size <
                2 ||
              creating
            }
          >
            <Text
              style={[
                styles.createText,
                (
                  selectedIds.size <
                    2 ||
                  creating
                ) &&
                  styles.createTextDisabled,
              ]}
            >
              {creating
                ? '...'
                : 'Create'}
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.headerSpacer
            }
          />
        )}
      </View>

      <Pressable
        style={
          styles.body
        }
        onPress={
          Keyboard.dismiss
        }
      >
        {mode ===
          'group' && (
          <TextInput
            value={
              groupTitle
            }
            onChangeText={
              setGroupTitle
            }
            placeholder="Group name (optional)"
            placeholderTextColor={
              DropColors.textMuted
            }
            selectionColor={
              DropColors.wine
            }
            style={
              styles.groupTitleInput
            }
            maxLength={
              60
            }
          />
        )}

        <View
          style={
            styles.searchRow
          }
        >
          <Text
            style={
              styles.searchIcon
            }
          >
            ⌕
          </Text>

          <TextInput
            value={
              query
            }
            onChangeText={
              setQuery
            }
            placeholder="Search following"
            placeholderTextColor={
              DropColors.textMuted
            }
            autoCapitalize="none"
            autoCorrect={
              false
            }
            selectionColor={
              DropColors.wine
            }
            style={
              styles.searchInput
            }
          />
        </View>

        {mode ===
          'direct' && (
          <Pressable
            onPress={() => {
              setMode(
                'group'
              );
              setSelectedIds(
                new Set()
              );
            }}
            style={({ pressed }) => [
              styles.groupBar,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.groupBarText
              }
            >
              Create group chat
            </Text>

            <Text
              style={
                styles.groupBarArrow
              }
            >
              →
            </Text>
          </Pressable>
        )}

        {mode ===
          'group' && (
          <Pressable
            onPress={() => {
              setMode(
                'direct'
              );
              setSelectedIds(
                new Set()
              );
            }}
            style={({ pressed }) => [
              styles.backToDirect,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.backToDirectText
              }
            >
              ← Back to new message
            </Text>
          </Pressable>
        )}

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              color={
                DropColors.warmWhite
              }
            />
          </View>
        ) : profiles.length ===
          0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No one here yet.
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Follow people first, then you can start conversations here.
            </Text>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={
              false
            }
          >
            {filteredProfiles.map(
              (
                profile
              ) => {
                const name =
                  profile.display_name ||
                  profile.username ||
                  'Unnamed user';

                const selected =
                  selectedIds.has(
                    profile.id
                  );

                return (
                  <Pressable
                    key={
                      profile.id
                    }
                    onPress={() =>
                      mode ===
                      'direct'
                        ? createDirect(
                            profile
                          )
                        : toggleSelected(
                            profile.id
                          )
                    }
                    style={({ pressed }) => [
                      styles.userRow,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <UserAvatar
                      uri={
                        profile.avatar_url
                      }
                      name={
                        name
                      }
                      size={
                        44
                      }
                    />

                    <View
                      style={
                        styles.userText
                      }
                    >
                      <Text
                        style={
                          styles.name
                        }
                      >
                        {name}
                      </Text>

                      {!!profile.username && (
                        <Text
                          style={
                            styles.username
                          }
                        >
                          @{profile.username}
                        </Text>
                      )}
                    </View>

                    {mode ===
                      'group' && (
                      <View
                        style={[
                          styles.selectionCircle,
                          selected &&
                            styles.selectionCircleSelected,
                        ]}
                      >
                        {selected && (
                          <View
                            style={
                              styles.selectionDot
                            }
                          />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        )}
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
      paddingTop: 52,
      paddingHorizontal: 18,
      paddingBottom: 13,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    cancel: {
      minWidth: 60,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
    },

    createText: {
      minWidth: 60,
      textAlign: 'right',
      color:
        DropColors.wine,
      fontFamily:
        DropTypography.semibold,
      fontSize: 14,
    },

    createTextDisabled: {
      opacity: 0.35,
    },

    headerSpacer: {
      width: 60,
    },

    body: {
      flex: 1,
    },

    groupTitleInput: {
      marginHorizontal: 18,
      minHeight: 48,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 15,
    },

    searchRow: {
      marginHorizontal: 18,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    searchIcon: {
      color:
        DropColors.textSecondary,
      fontSize: 22,
      marginRight: 10,
      marginBottom: 2,
    },

    searchInput: {
      flex: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 16,
      paddingVertical: 13,
    },

    groupBar: {
      minHeight: 52,
      marginHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    groupBarText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    groupBarArrow: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.light,
      fontSize: 20,
    },

    backToDirect: {
      minHeight: 44,
      marginHorizontal: 18,
      justifyContent:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    backToDirectText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    userRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    userText: {
      flex: 1,
      marginLeft: 12,
    },

    name: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    username: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 2,
    },

    selectionCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    selectionCircleSelected: {
      borderColor:
        DropColors.wine,
    },

    selectionDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor:
        DropColors.wine,
    },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 38,
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

    pressed: {
      opacity: 0.62,
    },
  });