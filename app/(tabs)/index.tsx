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

type ConversationRow = {
  id: string;
  author_id: string;
  participant_id: string;
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
  ] = useState<string | null>(null);

  const [
    joinStatuses,
    setJoinStatuses,
  ] = useState<
    Record<string, JoinStatus>
  >({});

  const [
    pendingCounts,
    setPendingCounts,
  ] = useState<
    Record<string, number>
  >({});

  const [
    likedDropIds,
    setLikedDropIds,
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    likeCounts,
    setLikeCounts,
  ] = useState<
    Record<string, number>
  >({});

  const [
    joinLoadingId,
    setJoinLoadingId,
  ] = useState<string | null>(
    null
  );

  const [
    likeLoadingId,
    setLikeLoadingId,
  ] = useState<string | null>(
    null
  );

  const [
    replyLoadingId,
    setReplyLoadingId,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

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

      /*
       * LOAD DROPS
       */

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
        (data ?? []) as unknown as Drop[];

      setDrops(
        loadedDrops
      );

      /*
       * LOAD LIKES
       */

      const {
        data: allLikes,
        error: allLikesError,
      } = await supabase
        .from('drop_likes')
        .select(
          'drop_id, user_id'
        );

      if (allLikesError) {
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

      /*
       * LOAD MY JOIN STATUSES
       */

      const {
        data: myRequests,
        error: myRequestsError,
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

      /*
       * LOAD PENDING COUNTS
       * FOR MY OWN DROPS
       */

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
          data: pendingRequests,
          error: pendingError,
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
            (request) => {
              counts[
                request.drop_id
              ] =
                (
                  counts[
                    request.drop_id
                  ] ?? 0
                ) + 1;
            }
          );

          setPendingCounts(
            counts
          );
        }
      }
    } catch (error) {
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

  /*
   * LIKE / UNLIKE
   */

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
            (current) => {
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
            (current) => ({
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
          (current) => {
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
          (current) => ({
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

  /*
   * JOIN / CANCEL JOIN
   */

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

        /*
         * CANCEL PENDING
         */

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
            (current) => ({
              ...current,

              [drop.id]:
                'none',
            })
          );

          return;
        }

        /*
         * ALREADY JOINED
         */

        if (
          currentStatus ===
          'accepted'
        ) {
          return;
        }

        /*
         * DECLINED BEFORE:
         * DELETE OLD ROW FIRST
         */

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
            console.error(
              'DELETE OLD JOIN ERROR:',
              deleteError
            );

            Alert.alert(
              'Error',
              'Could not send a new request.'
            );

            return;
          }
        }

        /*
         * CREATE JOIN REQUEST
         */

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
          (current) => ({
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

  /*
   * UNIFIED DM REPLY
   *
   * One user pair = one conversation.
   *
   * Drop is stored as a conversation event,
   * not as a separate chat.
   */

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

        let conversationId:
          string | null = null;

        /*
         * 1.
         * LOOK FOR EXISTING DM
         * IN BOTH DIRECTIONS
         */

        const {
          data:
            existingConversations,
          error:
            existingError,
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
            .or(
              `and(author_id.eq.${drop.author_id},participant_id.eq.${currentUserId}),and(author_id.eq.${currentUserId},participant_id.eq.${drop.author_id})`
            )
            .limit(1);

        if (
          existingError
        ) {
          console.error(
            'FIND DM ERROR:',
            existingError
          );

          Alert.alert(
            'Error',
            'Could not open this conversation.'
          );

          return;
        }

        const existingConversation =
          (
            existingConversations ??
            []
          )[0] as
            | ConversationRow
            | undefined;

        if (
          existingConversation
        ) {
          conversationId =
            existingConversation.id;
        }

        /*
         * 2.
         * CREATE DM IF THESE TWO USERS
         * HAVE NEVER TALKED BEFORE
         */

        if (
          !conversationId
        ) {
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
                /*
                 * Legacy field.
                 *
                 * We keep the first Drop here
                 * for now so the old chat UI
                 * does not break.
                 *
                 * Later [id].tsx will stop
                 * depending on conversations.drop_id.
                 */

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
              .select(
                'id'
              )
              .single();

          if (
            createError
          ) {
            console.error(
              'CREATE DM ERROR:',
              createError
            );

            /*
             * Race-condition protection.
             *
             * Unique pair index may have blocked
             * a duplicate DM that appeared
             * between SELECT and INSERT.
             */

            const {
              data:
                fallbackConversations,
              error:
                fallbackError,
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
                .or(
                  `and(author_id.eq.${drop.author_id},participant_id.eq.${currentUserId}),and(author_id.eq.${currentUserId},participant_id.eq.${drop.author_id})`
                )
                .limit(1);

            if (
              fallbackError
            ) {
              console.error(
                'FALLBACK DM ERROR:',
                fallbackError
              );
            }

            const fallbackConversation =
              (
                fallbackConversations ??
                []
              )[0] as
                | ConversationRow
                | undefined;

            if (
              !fallbackConversation
            ) {
              Alert.alert(
                'Error',
                'Could not start a conversation.'
              );

              return;
            }

            conversationId =
              fallbackConversation.id;
          } else {
            conversationId =
              newConversation.id;
          }
        }

        /*
         * SAFETY CHECK
         */

        if (
          !conversationId
        ) {
          Alert.alert(
            'Error',
            'Could not open this conversation.'
          );

          return;
        }

        /*
         * 3.
         * STORE DROP CONTEXT
         * INSIDE THE UNIFIED DM
         */

        const {
          error:
            eventError,
        } =
          await supabase
            .from(
              'conversation_events'
            )
            .insert({
              conversation_id:
                conversationId,

              actor_id:
                currentUserId,

              drop_id:
                drop.id,

              event_type:
                'reply',

              drop_text_snapshot:
                drop.text,
            });

        if (
          eventError
        ) {
          /*
           * 23505:
           * this exact Reply event
           * already exists.
           *
           * That's fine.
           * We simply reopen the DM.
           */

          if (
            eventError.code !==
            '23505'
          ) {
            console.error(
              'CREATE REPLY EVENT ERROR:',
              eventError
            );

            Alert.alert(
              'Error',
              'Could not attach this Drop to the conversation.'
            );

            return;
          }
        }

        /*
         * 4.
         * OPEN THE SINGLE DM
         */

        router.push(
          `/chat/${conversationId}`
        );
      } catch (error) {
        console.error(
          'REPLY ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Something went wrong.'
        );
      } finally {
        setReplyLoadingId(
          null
        );
      }
    };

  /*
   * PROFILE
   */

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