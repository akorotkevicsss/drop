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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type DropAuthor = {
  username: string | null;
  display_name: string | null;
  city: string | null;
};

type Drop = {
  id: string;
  author_id: string;
  text: string;
  city: string | null;
  event_time: string | null;
  join_enabled: boolean;
  interested_enabled: boolean;
  reply_enabled: boolean;
  created_at: string;
  profiles: DropAuthor | null;
};

type JoinStatus =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'declined';

type MyJoinRequest = {
  drop_id: string;
  status:
    | 'pending'
    | 'accepted'
    | 'declined';
};

function formatDropTime(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();

  const difference =
    now.getTime() - created.getTime();

  const minutes = Math.floor(
    difference / (1000 * 60)
  );

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days}d`;
}

export default function HomeScreen() {
  const [drops, setDrops] =
    useState<Drop[]>([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(null);

  const [
    joinStatuses,
    setJoinStatuses,
  ] =
    useState<
      Record<string, JoinStatus>
    >({});

  const [
    pendingCounts,
    setPendingCounts,
  ] =
    useState<
      Record<string, number>
    >({});

  const [
    likedDropIds,
    setLikedDropIds,
  ] =
    useState<Set<string>>(
      new Set()
    );

  const [
    likeCounts,
    setLikeCounts,
  ] =
    useState<
      Record<string, number>
    >({});

  const [
    joinLoadingId,
    setJoinLoadingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    likeLoadingId,
    setLikeLoadingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    replyLoadingId,
    setReplyLoadingId,
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
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const loadDrops = async (
    manualRefresh = false
  ) => {
    try {
      if (manualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user },
        error: userError,
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
        data,
        error,
      } = await supabase
        .from('drops')
        .select(`
          id,
          author_id,
          text,
          city,
          event_time,
          join_enabled,
          interested_enabled,
          reply_enabled,
          created_at,
          profiles!drops_author_id_fkey (
            username,
            display_name,
            city
          )
        `)
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'LOAD DROPS ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Could not load Drops.'
        );

        return;
      }

      const loadedDrops =
        (data ??
          []) as unknown as Drop[];

      setDrops(
        loadedDrops
      );

      const {
        data: allLikes,
        error:
          allLikesError,
      } = await supabase
        .from(
          'drop_likes'
        )
        .select(
          'drop_id, user_id'
        );

      if (
        allLikesError
      ) {
        console.error(
          'LOAD LIKES ERROR:',
          allLikesError
        );
      } else {
        const nextLikedIds =
          new Set<string>();

        const nextLikeCounts:
          Record<
            string,
            number
          > = {};

        (
          allLikes ?? []
        ).forEach(
          (like) => {
            nextLikeCounts[
              like.drop_id
            ] =
              (
                nextLikeCounts[
                  like.drop_id
                ] ?? 0
              ) + 1;

            if (
              like.user_id ===
              user.id
            ) {
              nextLikedIds.add(
                like.drop_id
              );
            }
          }
        );

        setLikedDropIds(
          nextLikedIds
        );

        setLikeCounts(
          nextLikeCounts
        );
      }

      const {
        data:
          myRequests,
        error:
          myRequestsError,
      } = await supabase
        .from(
          'join_requests'
        )
        .select(
          'drop_id, status'
        )
        .eq(
          'user_id',
          user.id
        );

      if (
        myRequestsError
      ) {
        console.error(
          'MY JOIN REQUESTS ERROR:',
          myRequestsError
        );
      } else {
        const nextStatuses:
          Record<
            string,
            JoinStatus
          > = {};

        (
          (myRequests ??
            []) as MyJoinRequest[]
        ).forEach(
          (request) => {
            nextStatuses[
              request.drop_id
            ] =
              request.status;
          }
        );

        setJoinStatuses(
          nextStatuses
        );
      }

      const ownDropIds =
        loadedDrops
          .filter(
            (drop) =>
              drop.author_id ===
              user.id
          )
          .map(
            (drop) =>
              drop.id
          );

      if (
        ownDropIds.length ===
        0
      ) {
        setPendingCounts(
          {}
        );
      } else {
        const {
          data:
            pendingRequests,
          error:
            pendingError,
        } =
          await supabase
            .from(
              'join_requests'
            )
            .select(
              'drop_id'
            )
            .in(
              'drop_id',
              ownDropIds
            )
            .eq(
              'status',
              'pending'
            );

        if (
          pendingError
        ) {
          console.error(
            'PENDING COUNTS ERROR:',
            pendingError
          );
        } else {
          const counts:
            Record<
              string,
              number
            > = {};

          (
            pendingRequests ??
            []
          ).forEach(
            (
              request
            ) => {
              counts[
                request.drop_id
              ] =
                (
                  counts[
                    request
                      .drop_id
                  ] ?? 0
                ) + 1;
            }
          );

          setPendingCounts(
            counts
          );
        }
      }
    } catch (
      error
    ) {
      console.error(
        'LOAD DROPS ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Something went wrong while loading Drops.'
      );
    } finally {
      setLoading(
        false
      );

      setRefreshing(
        false
      );
    }
  };

  useFocusEffect(
    useCallback(
      () => {
        loadDrops();
      },
      []
    )
  );

  const handleLike =
    async (
      drop: Drop
    ) => {
      if (
        !currentUserId ||
        likeLoadingId
      ) {
        return;
      }

      const isLiked =
        likedDropIds.has(
          drop.id
        );

      try {
        setLikeLoadingId(
          drop.id
        );

        if (isLiked) {
          const {
            error,
          } =
            await supabase
              .from(
                'drop_likes'
              )
              .delete()
              .eq(
                'drop_id',
                drop.id
              )
              .eq(
                'user_id',
                currentUserId
              );

          if (error) {
            console.error(
              'UNLIKE ERROR:',
              error
            );

            Alert.alert(
              'Error',
              'Could not remove Like.'
            );

            return;
          }

          setLikedDropIds(
            (
              current
            ) => {
              const next =
                new Set(
                  current
                );

              next.delete(
                drop.id
              );

              return next;
            }
          );

          setLikeCounts(
            (
              current
            ) => ({
              ...current,

              [drop.id]:
                Math.max(
                  0,
                  (
                    current[
                      drop.id
                    ] ?? 0
                  ) - 1
                ),
            })
          );

          return;
        }

        const {
          error,
        } =
          await supabase
            .from(
              'drop_likes'
            )
            .insert({
              drop_id:
                drop.id,

              user_id:
                currentUserId,
            });

        if (error) {
          console.error(
            'LIKE ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not Like this Drop.'
          );

          return;
        }

        setLikedDropIds(
          (
            current
          ) => {
            const next =
              new Set(
                current
              );

            next.add(
              drop.id
            );

            return next;
          }
        );

        setLikeCounts(
          (
            current
          ) => ({
            ...current,

            [drop.id]:
              (
                current[
                  drop.id
                ] ?? 0
              ) + 1,
          })
        );
      } finally {
        setLikeLoadingId(
          null
        );
      }
    };

  const handleJoin =
    async (
      drop: Drop
    ) => {
      if (
        !currentUserId ||
        joinLoadingId
      ) {
        return;
      }

      const currentStatus =
        joinStatuses[
          drop.id
        ] ?? 'none';

      try {
        setJoinLoadingId(
          drop.id
        );

        if (
          currentStatus ===
          'pending'
        ) {
          const {
            error,
          } =
            await supabase
              .from(
                'join_requests'
              )
              .delete()
              .eq(
                'drop_id',
                drop.id
              )
              .eq(
                'user_id',
                currentUserId
              );

          if (error) {
            console.error(
              'CANCEL JOIN ERROR:',
              error
            );

            Alert.alert(
              'Error',
              'Could not cancel your request.'
            );

            return;
          }

          setJoinStatuses(
            (
              current
            ) => ({
              ...current,

              [drop.id]:
                'none',
            })
          );

          return;
        }

        if (
          currentStatus ===
          'accepted'
        ) {
          return;
        }

        if (
          currentStatus ===
          'declined'
        ) {
          const {
            error:
              deleteError,
          } =
            await supabase
              .from(
                'join_requests'
              )
              .delete()
              .eq(
                'drop_id',
                drop.id
              )
              .eq(
                'user_id',
                currentUserId
              );

          if (
            deleteError
          ) {
            Alert.alert(
              'Error',
              'Could not send a new request.'
            );

            return;
          }
        }

        const {
          error,
        } =
          await supabase
            .from(
              'join_requests'
            )
            .insert({
              drop_id:
                drop.id,

              user_id:
                currentUserId,

              status:
                'pending',
            });

        if (error) {
          console.error(
            'JOIN REQUEST ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not send Join request.'
          );

          return;
        }

        setJoinStatuses(
          (
            current
          ) => ({
            ...current,

            [drop.id]:
              'pending',
          })
        );
      } finally {
        setJoinLoadingId(
          null
        );
      }
    };

  const handleReply =
    async (
      drop: Drop
    ) => {
      if (
        !currentUserId ||
        replyLoadingId
      ) {
        return;
      }

      if (
        drop.author_id ===
        currentUserId
      ) {
        return;
      }

      try {
        setReplyLoadingId(
          drop.id
        );

        /*
         * Сначала ищем существующий conversation
         * для этого Drop и этой пары.
         */

        const {
          data:
            existingConversation,
          error:
            existingError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .select('id')
            .eq(
              'drop_id',
              drop.id
            )
            .eq(
              'author_id',
              drop.author_id
            )
            .eq(
              'participant_id',
              currentUserId
            )
            .maybeSingle();

        if (
          existingError
        ) {
          console.error(
            'FIND REPLY CONVERSATION ERROR:',
            existingError
          );

          Alert.alert(
            'Error',
            'Could not open this conversation.'
          );

          return;
        }

        if (
          existingConversation
        ) {
          router.push(
            `/chat/${existingConversation.id}`
          );

          return;
        }

        /*
         * Conversation ещё нет —
         * создаём независимый Reply-chat.
         */

        const {
          data:
            newConversation,
          error:
            createError,
        } =
          await supabase
            .from(
              'conversations'
            )
            .insert({
              drop_id:
                drop.id,

              join_request_id:
                null,

              author_id:
                drop.author_id,

              participant_id:
                currentUserId,

              source:
                'reply',
            })
            .select('id')
            .single();

        if (
          createError
        ) {
          console.error(
            'CREATE REPLY CONVERSATION ERROR:',
            createError
          );

          /*
           * На случай, если между SELECT и INSERT
           * conversation уже успел появиться,
           * ещё раз пытаемся его найти.
           */

          const {
            data:
              fallbackConversation,
          } =
            await supabase
              .from(
                'conversations'
              )
              .select('id')
              .eq(
                'drop_id',
                drop.id
              )
              .eq(
                'author_id',
                drop.author_id
              )
              .eq(
                'participant_id',
                currentUserId
              )
              .maybeSingle();

          if (
            fallbackConversation
          ) {
            router.push(
              `/chat/${fallbackConversation.id}`
            );

            return;
          }

          Alert.alert(
            'Error',
            'Could not start a Reply conversation.'
          );

          return;
        }

        router.push(
          `/chat/${newConversation.id}`
        );
      } finally {
        setReplyLoadingId(
          null
        );
      }
    };

  const openProfile = (
    drop: Drop
  ) => {
    if (
      drop.author_id ===
      currentUserId
    ) {
      router.push(
        '/profile'
      );

      return;
    }

    const username =
      drop.profiles
        ?.username;

    if (!username) {
      return;
    }

    router.push(
      `/user/${username}`
    );
  };

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
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
      <View
        style={
          styles.header
        }
      >
        <Text
          style={styles.logo}
        >
          DROP
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.push(
              '/create'
            )
          }
        >
          <Text
            style={
              styles.headerButton
            }
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              loadDrops(
                true
              )
            }
            tintColor="#FFFFFF"
          />
        }
      >
        {drops.length ===
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
              Nothing dropped yet.
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Be the first.
            </Text>
          </View>
        ) : (
          drops.map(
            (drop) => {
              const displayName =
                drop
                  .profiles
                  ?.display_name ||
                'Unnamed user';

              const username =
                drop
                  .profiles
                  ?.username;

              const avatarLetter =
                displayName
                  .charAt(0)
                  .toUpperCase();

              const isOwnDrop =
                drop.author_id ===
                currentUserId;

              const time =
                formatDropTime(
                  drop.created_at
                );

              const location =
                drop.city ||
                drop
                  .profiles
                  ?.city;

              const joinStatus =
                joinStatuses[
                  drop.id
                ] ?? 'none';

              const pendingCount =
                pendingCounts[
                  drop.id
                ] ?? 0;

              const isLiked =
                likedDropIds.has(
                  drop.id
                );

              const likeCount =
                likeCounts[
                  drop.id
                ] ?? 0;

              return (
                <View
                  key={
                    drop.id
                  }
                  style={
                    styles.drop
                  }
                >
                  <Pressable
                    style={
                      styles.userRow
                    }
                    onPress={() =>
                      openProfile(
                        drop
                      )
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
                        {
                          avatarLetter
                        }
                      </Text>
                    </View>

                    <View>
                      <Text
                        style={
                          styles.name
                        }
                      >
                        {
                          displayName
                        }
                      </Text>

                      <Text
                        style={
                          styles.username
                        }
                      >
                        {username
                          ? `@${username}`
                          : ''}
                        {' · '}
                        {time}
                      </Text>
                    </View>
                  </Pressable>

                  <Text
                    style={
                      styles.dropText
                    }
                  >
                    {
                      drop.text
                    }
                  </Text>

                  {!!location && (
                    <Text
                      style={
                        styles.meta
                      }
                    >
                      {
                        location
                      }
                    </Text>
                  )}

                  {!isOwnDrop && (
                    <View
                      style={
                        styles.actions
                      }
                    >
                      {drop.join_enabled && (
                        <TouchableOpacity
                          style={[
                            styles.joinButton,

                            joinStatus ===
                              'pending' &&
                              styles.requestedButton,

                            joinStatus ===
                              'accepted' &&
                              styles.acceptedButton,
                          ]}
                          disabled={
                            joinLoadingId ===
                              drop.id ||
                            joinStatus ===
                              'accepted'
                          }
                          onPress={() =>
                            handleJoin(
                              drop
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.joinText,

                              joinStatus !==
                                'none' &&
                                styles.requestedText,
                            ]}
                          >
                            {joinLoadingId ===
                            drop.id
                              ? '...'
                              : joinStatus ===
                                  'pending'
                                ? 'Requested'
                                : joinStatus ===
                                    'accepted'
                                  ? 'Joined'
                                  : joinStatus ===
                                      'declined'
                                    ? 'Join again'
                                    : 'Join'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {drop.interested_enabled && (
                        <TouchableOpacity
                          disabled={
                            likeLoadingId ===
                            drop.id
                          }
                          onPress={() =>
                            handleLike(
                              drop
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.secondaryAction,

                              isLiked &&
                                styles.likedAction,
                            ]}
                          >
                            {likeLoadingId ===
                            drop.id
                              ? '...'
                              : isLiked
                                ? `♥ ${likeCount}`
                                : `♡ ${likeCount}`}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {drop.reply_enabled && (
                        <TouchableOpacity
                          disabled={
                            replyLoadingId ===
                            drop.id
                          }
                          onPress={() =>
                            handleReply(
                              drop
                            )
                          }
                        >
                          <Text
                            style={
                              styles.secondaryAction
                            }
                          >
                            {replyLoadingId ===
                            drop.id
                              ? '...'
                              : 'Reply'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {isOwnDrop && (
                    <>
                      <View
                        style={
                          styles.ownDropRow
                        }
                      >
                        <Text
                          style={
                            styles.ownDrop
                          }
                        >
                          Your Drop
                        </Text>

                        <Text
                          style={
                            styles.ownLikeCount
                          }
                        >
                          ♥{' '}
                          {
                            likeCount
                          }
                        </Text>
                      </View>

                      {pendingCount >
                        0 && (
                        <TouchableOpacity
                          style={
                            styles.requestsButton
                          }
                          onPress={() =>
                            router.push(
                              {
                                pathname:
                                  '/requests',

                                params:
                                  {
                                    dropId:
                                      drop.id,
                                  },
                              }
                            )
                          }
                        >
                          <Text
                            style={
                              styles.requestsText
                            }
                          >
                            {
                              pendingCount
                            }{' '}
                            {pendingCount ===
                            1
                              ? 'request'
                              : 'requests'}
                            {'  →'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            }
          )
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
      alignItems:
        'center',
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
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    logo: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 3,
    },

    headerButton: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '300',
    },

    drop: {
      paddingHorizontal: 20,
      paddingVertical: 22,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
    },

    userRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#222222',
      alignItems:
        'center',
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
      fontSize: 15,
      fontWeight: '600',
    },

    username: {
      color: '#666666',
      fontSize: 13,
      marginTop: 2,
    },

    dropText: {
      color: '#FFFFFF',
      fontSize: 19,
      lineHeight: 27,
      marginTop: 18,
    },

    meta: {
      color: '#777777',
      fontSize: 13,
      marginTop: 10,
    },

    actions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 22,
      marginTop: 18,
    },

    joinButton: {
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
    },

    requestedButton: {
      backgroundColor:
        '#222222',
      borderWidth: 1,
      borderColor:
        '#555555',
    },

    acceptedButton: {
      backgroundColor:
        '#222222',
      borderWidth: 1,
      borderColor:
        '#444444',
    },

    joinText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },

    requestedText: {
      color: '#FFFFFF',
    },

    secondaryAction: {
      color: '#888888',
      fontSize: 14,
    },

    likedAction: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    ownDropRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 14,
      marginTop: 14,
    },

    ownDrop: {
      color: '#555555',
      fontSize: 12,
    },

    ownLikeCount: {
      color: '#777777',
      fontSize: 12,
    },

    requestsButton: {
      marginTop: 12,
      alignSelf:
        'flex-start',
    },

    requestsText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },

    emptyContainer: {
      paddingHorizontal: 20,
      paddingTop: 60,
      alignItems:
        'center',
    },

    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },

    emptySubtitle: {
      color: '#555555',
      fontSize: 14,
      marginTop: 6,
    },
  });