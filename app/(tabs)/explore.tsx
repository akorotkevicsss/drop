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
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ExplorePeopleSearch } from '@/components/explore-people-search';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type DropAuthor = {
  username: string | null;
  display_name: string | null;
  city: string | null;
  avatar_url: string | null;
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
  join_until: string | null;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
  location_text: string | null;
  join_limit: number | null;
  age_restriction: string | null;
  deleted_at: string | null;
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

function formatDropTime(
  createdAt: string
) {
  const created =
    new Date(
      createdAt
    );

  const difference =
    Date.now() -
    created.getTime();

  const minutes =
    Math.floor(
      difference /
        60000
    );

  if (
    minutes <
    1
  ) {
    return 'now';
  }

  if (
    minutes <
    60
  ) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes /
        60
    );

  if (
    hours <
    24
  ) {
    return `${hours}h`;
  }

  return `${Math.floor(
    hours /
      24
  )}d`;
}

function isJoinOpen(
  drop: Drop
) {
  if (
    !drop.join_enabled
  ) {
    return false;
  }

  if (
    !drop.join_until
  ) {
    return true;
  }

  return (
    new Date(
      drop.join_until
    ).getTime() >
    Date.now()
  );
}

function formatJoinTimer(
  joinUntil:
    string | null
) {
  if (
    !joinUntil
  ) {
    return null;
  }

  const difference =
    new Date(
      joinUntil
    ).getTime() -
    Date.now();

  if (
    difference <=
    0
  ) {
    return 'Join closed';
  }

  const minutes =
    Math.ceil(
      difference /
        60000
    );

  if (
    minutes <
    60
  ) {
    return `Join · ${minutes}m left`;
  }

  return `Join · ${Math.ceil(
    minutes /
      60
  )}h left`;
}

export default function ExploreScreen() {
  const [
    mode,
    setMode,
  ] =
    useState<
      'feed' |
      'search' |
      'map'
    >(
      'feed'
    );

  const [
    drops,
    setDrops,
  ] =
    useState<
      Drop[]
    >([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    joinStatuses,
    setJoinStatuses,
  ] =
    useState<
      Record<
        string,
        JoinStatus
      >
    >({});

  const [
    pendingCounts,
    setPendingCounts,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

  const [
    likedDropIds,
    setLikedDropIds,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    likeCounts,
    setLikeCounts,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

  const [
    joinLoadingId,
    setJoinLoadingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    likeLoadingId,
    setLikeLoadingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    replyLoadingId,
    setReplyLoadingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    deleteLoadingId,
    setDeleteLoadingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const loadDrops =
    async (
      manualRefresh =
        false
    ) => {
      try {
        if (
          manualRefresh
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

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
          data:
            followingData,
          error:
            followingError,
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
          followingError
        ) {
          console.error(
            'EXPLORE FOLLOWING ERROR:',
            followingError
          );

          Alert.alert(
            'Error',
            'Could not load Explore.'
          );
          return;
        }

        const excludedAuthorIds =
          new Set<
            string
          >([
            user.id,
            ...(
              followingData ??
              []
            ).map(
              (
                follow
              ) =>
                follow.following_id
            ),
          ]);

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'drops'
            )
            .select(`
              id,
              author_id,
              text,
              city,
              event_time,
              join_enabled,
              interested_enabled,
              reply_enabled,
              join_until,
              background_color,
              image_path,
              attached_image_path,
              location_text,
              join_limit,
              age_restriction,
              deleted_at,
              created_at,
              profiles!drops_author_id_fkey (
                username,
                display_name,
                city,
                avatar_url
              )
            `)
            .is(
              'deleted_at',
              null
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            );

        if (
          error
        ) {
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
          (
            data ??
            []
          ) as unknown as
            Drop[];

        const discoveryDrops =
          loadedDrops.filter(
            (
              drop
            ) =>
              !excludedAuthorIds.has(
                drop.author_id
              )
          );

        setDrops(
          discoveryDrops
        );

        const {
          data:
            allLikes,
          error:
            allLikesError,
        } =
          await supabase
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
            new Set<
              string
            >();

          const nextLikeCounts:
            Record<
              string,
              number
            > = {};

          (
            allLikes ??
            []
          ).forEach(
            (
              like
            ) => {
              nextLikeCounts[
                like.drop_id
              ] =
                (
                  nextLikeCounts[
                    like.drop_id
                  ] ??
                  0
                ) +
                1;

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
        } =
          await supabase
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
            (
              myRequests ??
              []
            ) as
              MyJoinRequest[]
          ).forEach(
            (
              request
            ) => {
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
          discoveryDrops
            .filter(
              (
                drop
              ) =>
                drop.author_id ===
                user.id
            )
            .map(
              (
                drop
              ) =>
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
                      request.drop_id
                    ] ??
                    0
                  ) +
                  1;
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

        if (
          isLiked
        ) {
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

          if (
            error
          ) {
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
                    ] ??
                    0
                  ) -
                    1
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

        if (
          error
        ) {
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
                ] ??
                0
              ) +
              1,
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
        ] ??
        'none';

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

          if (
            error
          ) {
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

        if (
          error
        ) {
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
        replyLoadingId ||
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
          string | null =
            null;

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
            .limit(
              1
            );

        if (
          existingError
        ) {
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
            const {
              data:
                fallbackConversations,
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
                .limit(
                  1
                );

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

        if (
          !conversationId
        ) {
          return;
        }

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
          eventError &&
          eventError.code !==
            '23505'
        ) {
          Alert.alert(
            'Error',
            'Could not attach this Drop to the conversation.'
          );
          return;
        }

        router.push(
          `/chat/${conversationId}`
        );
      } catch (
        error
      ) {
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

  const handleDeleteDrop =
    (
      drop: Drop
    ) => {
      if (
        drop.author_id !==
          currentUserId ||
        deleteLoadingId
      ) {
        return;
      }

      Alert.alert(
        'Delete Drop?',
        'The Drop will disappear from profiles and feeds. Existing chats will stay available.',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Delete',
            style:
              'destructive',
            onPress:
              async () => {
                try {
                  setDeleteLoadingId(
                    drop.id
                  );

                  const {
                    error,
                  } =
                    await supabase.rpc(
                      'delete_own_drop',
                      {
                        target_drop_id:
                          drop.id,
                      }
                    );

                  if (
                    error
                  ) {
                    Alert.alert(
                      'Error',
                      'Could not delete this Drop.'
                    );
                    return;
                  }

                  setDrops(
                    (
                      current
                    ) =>
                      current.filter(
                        (
                          item
                        ) =>
                          item.id !==
                          drop.id
                      )
                  );
                } finally {
                  setDeleteLoadingId(
                    null
                  );
                }
              },
          },
        ]
      );
    };

  const openProfile =
    (
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

      if (
        !username
      ) {
        return;
      }

      router.push(
        `/user/${username}`
      );
    };

  if (
    loading
  ) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
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
          styles.exploreHeader
        }
      >
        <View
          style={
            styles.exploreTitleRow
          }
        >
          <View
            style={
              styles.exploreTitleBlock
            }
          >
            <Text
              style={
                styles.exploreTitle
              }
            >
              Explore
            </Text>

            <Text
              style={
                styles.exploreSubtitle
              }
            >
              Discover people and Drops around you.
            </Text>
          </View>
        </View>

        <View
          style={
            styles.exploreTabs
          }
        >
          <Pressable
            onPress={() =>
              setMode(
                'feed'
              )
            }
            style={
              styles.exploreTab
            }
          >
            <Text
              style={[
                styles.exploreTabText,
                mode ===
                  'feed' &&
                  styles.exploreTabTextActive,
              ]}
            >
              Feed
            </Text>

            <View
              style={[
                styles.exploreTabLine,
                mode ===
                  'feed' &&
                  styles.exploreTabLineActive,
              ]}
            />
          </Pressable>

          <View
            style={
              styles.exploreTabDivider
            }
          />

          <Pressable
            onPress={() =>
              setMode(
                'map'
              )
            }
            style={
              styles.exploreTab
            }
          >
            <Text
              style={[
                styles.exploreTabText,
                mode ===
                  'map' &&
                  styles.exploreTabTextActive,
              ]}
            >
              Map
            </Text>

            <View
              style={[
                styles.exploreTabLine,
                mode ===
                  'map' &&
                  styles.exploreTabLineActive,
              ]}
            />
          </Pressable>
        </View>
      </View>

      {mode ===
        'feed' && (
        <ScrollView
          contentContainerStyle={
            styles.feedContent
          }
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
              tintColor={
                DropColors.wine
              }
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
                Nothing new to explore.
              </Text>

              <Text
                style={
                  styles.emptySubtitle
                }
              >
                You can still find people directly and follow them.
              </Text>

              <Pressable
                onPress={() =>
                  setMode(
                    'search'
                  )
                }
                style={
                  styles.emptyFindLink
                }
              >
                <Text
                  style={
                    styles.emptyFindText
                  }
                >
                  Find people →
                </Text>
              </Pressable>
            </View>
          ) : (
            drops.map(
              (
                drop
              ) => {
                const displayName =
                  drop.profiles
                    ?.display_name ||
                  'Unnamed user';

                const username =
                  drop.profiles
                    ?.username;

                const isOwnDrop =
                  drop.author_id ===
                  currentUserId;

                const time =
                  formatDropTime(
                    drop.created_at
                  );

                const location =
                  drop.location_text ||
                  drop.city ||
                  drop.profiles
                    ?.city;

                const imageUrl =
                  drop.image_path
                    ? supabase.storage
                        .from(
                          'drop-images'
                        )
                        .getPublicUrl(
                          drop.image_path
                        ).data.publicUrl
                    : null;

                const attachedImageUrl =
                  drop.attached_image_path
                    ? supabase.storage
                        .from(
                          'drop-images'
                        )
                        .getPublicUrl(
                          drop.attached_image_path
                        ).data.publicUrl
                    : null;

                const hasBackground =
                  !!drop.background_color ||
                  !!imageUrl;

                const joinStatus =
                  joinStatuses[
                    drop.id
                  ] ??
                  'none';

                const pendingCount =
                  pendingCounts[
                    drop.id
                  ] ??
                  0;

                const isLiked =
                  likedDropIds.has(
                    drop.id
                  );

                const likeCount =
                  likeCounts[
                    drop.id
                  ] ??
                  0;

                const joinOpen =
                  isJoinOpen(
                    drop
                  );

                const joinTimerLabel =
                  formatJoinTimer(
                    drop.join_until
                  );

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
                      <UserAvatar
                        uri={
                          drop.profiles
                            ?.avatar_url
                        }
                        name={
                          displayName
                        }
                        size={
                          44
                        }
                      />

                      <View
                        style={
                          styles.authorText
                        }
                      >
                        <Text
                          style={
                            styles.name
                          }
                        >
                          {displayName}
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

                    {hasBackground ? (
                      imageUrl ? (
                        <ImageBackground
                          source={{
                            uri:
                              imageUrl,
                          }}
                          style={
                            styles.dropVisual
                          }
                          imageStyle={
                            styles.dropVisualImage
                          }
                        >
                          <View
                            style={
                              styles.dropVisualOverlay
                            }
                          >
                            <Text
                              style={
                                styles.dropVisualText
                              }
                            >
                              {drop.text}
                            </Text>
                          </View>
                        </ImageBackground>
                      ) : (
                        <View
                          style={[
                            styles.dropVisual,
                            {
                              backgroundColor:
                                drop.background_color ??
                                DropColors.surface,
                            },
                          ]}
                        >
                          <Text
                            style={
                              styles.dropVisualText
                            }
                          >
                            {drop.text}
                          </Text>
                        </View>
                      )
                    ) : (
                      <Text
                        style={
                          styles.dropText
                        }
                      >
                        {drop.text}
                      </Text>
                    )}

                    {!!attachedImageUrl && (
                      <ImageBackground
                        source={{
                          uri:
                            attachedImageUrl,
                        }}
                        style={
                          styles.attachedImage
                        }
                        imageStyle={
                          styles.attachedImageRadius
                        }
                      />
                    )}

                    {!!location && (
                      <Text
                        style={
                          styles.meta
                        }
                      >
                        {location}
                      </Text>
                    )}

                    {(drop.age_restriction &&
                      drop.age_restriction !==
                        'everyone') ||
                    drop.join_limit ? (
                      <View
                        style={
                          styles.dropDetailsRow
                        }
                      >
                        {drop.age_restriction &&
                          drop.age_restriction !==
                            'everyone' && (
                            <Text
                              style={
                                styles.detailMeta
                              }
                            >
                              {drop.age_restriction ===
                              'under16'
                                ? 'Under 16'
                                : drop.age_restriction}
                            </Text>
                          )}

                        {!!drop.join_limit && (
                          <Text
                            style={
                              styles.detailMeta
                            }
                          >
                            Join limit · {drop.join_limit}
                          </Text>
                        )}
                      </View>
                    ) : null}

                    {!!joinTimerLabel && (
                      <Text
                        style={[
                          styles.joinTimerMeta,
                          !joinOpen &&
                            styles.joinTimerClosed,
                        ]}
                      >
                        {joinTimerLabel}
                      </Text>
                    )}

                    {!isOwnDrop && (
                      <View
                        style={
                          styles.actions
                        }
                      >
                        {joinOpen && (
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
                              style={
                                styles.joinText
                              }
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
                            ♥ {likeCount}
                          </Text>

                          <Pressable
                            onPress={() =>
                              handleDeleteDrop(
                                drop
                              )
                            }
                            disabled={
                              deleteLoadingId ===
                              drop.id
                            }
                            style={
                              styles.deleteDropButton
                            }
                          >
                            <Text
                              style={
                                styles.deleteDropText
                              }
                            >
                              {deleteLoadingId ===
                              drop.id
                                ? '...'
                                : 'Delete'}
                            </Text>
                          </Pressable>
                        </View>

                        {pendingCount >
                          0 && (
                          <TouchableOpacity
                            style={
                              styles.requestsButton
                            }
                            onPress={() =>
                              router.push({
                                pathname:
                                  '/requests',
                                params: {
                                  dropId:
                                    drop.id,
                                },
                              })
                            }
                          >
                            <Text
                              style={
                                styles.requestsText
                              }
                            >
                              {pendingCount}{' '}
                              {pendingCount ===
                              1
                                ? 'request'
                                : 'requests'}
                              {' →'}
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
      )}

      {mode ===
        'search' && (
        <ExplorePeopleSearch
          onBack={() =>
            setMode(
              'feed'
            )
          }
        />
      )}

      {mode ===
        'map' && (
        <View
          style={
            styles.mapPlaceholder
          }
        >
          <Text
            style={
              styles.mapPlaceholderTitle
            }
          >
            Map
          </Text>

          <Text
            style={
              styles.mapPlaceholderText
            }
          >
            Nearby Drops will appear here.
          </Text>
        </View>
      )}

      {mode !==
        'search' && (
        <Pressable
          onPress={() =>
            setMode(
              'search'
            )
          }
          style={({ pressed }) => [
            styles.floatingFindButton,
            pressed &&
              styles.floatingFindButtonPressed,
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={
              22
            }
            color={
              DropColors.warmWhite
            }
          />
        </Pressable>
      )}
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

    loadingContainer: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    exploreHeader: {
      paddingTop:
        52,
      paddingHorizontal:
        18,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    exploreTitleRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
    },

    exploreTitleBlock: {
      flex: 1,
      paddingRight:
        16,
    },

    exploreTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize:
        30,
    },

    exploreSubtitle: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        12,
      marginTop:
        3,
    },

    exploreTabs: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
      marginTop:
        22,
    },

    exploreTab: {
      flex: 1,
      minHeight:
        42,
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      paddingBottom:
        11,
    },

    exploreTabText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        14,
    },

    exploreTabTextActive: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
    },

    exploreTabLine: {
      position:
        'absolute',
      left: 18,
      right: 18,
      bottom: 0,
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        'transparent',
    },

    exploreTabLineActive: {
      height: 1,
      backgroundColor:
        DropColors.wine,
    },

    exploreTabDivider: {
      width:
        StyleSheet.hairlineWidth,
      height: 20,
      alignSelf:
        'center',
      marginBottom:
        10,
      backgroundColor:
        DropColors.border,
    },

    feedContent: {
      paddingBottom:
        88,
    },

    drop: {
      paddingHorizontal:
        18,
      paddingVertical:
        17,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    userRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    authorText: {
      marginLeft:
        12,
      flexShrink:
        1,
    },

    name: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        15,
    },

    username: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        13,
      marginTop:
        2,
    },

    dropText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize:
        17,
      lineHeight:
        23,
      marginTop:
        14,
    },

    dropVisual: {
      minHeight:
        176,
      marginTop:
        14,
      borderRadius:
        16,
      overflow:
        'hidden',
      justifyContent:
        'center',
    },

    dropVisualImage: {
      borderRadius:
        16,
    },

    dropVisualOverlay: {
      minHeight:
        176,
      paddingHorizontal:
        18,
      paddingVertical:
        18,
      backgroundColor:
        'rgba(0,0,0,0.70)',
      justifyContent:
        'center',
    },

    dropVisualText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        18,
      lineHeight:
        25,
      textShadowColor:
        'rgba(0,0,0,0.38)',
      textShadowOffset: {
        width: 0,
        height: 1,
      },
      textShadowRadius:
        3,
    },

    attachedImage: {
      width:
        '100%',
      aspectRatio:
        4 / 3,
      marginTop:
        12,
      borderRadius:
        16,
      overflow:
        'hidden',
      backgroundColor:
        DropColors.surface,
    },

    attachedImageRadius: {
      borderRadius:
        16,
    },

    meta: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        12,
      marginTop:
        8,
    },

    dropDetailsRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        10,
      marginTop:
        7,
    },

    detailMeta: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize:
        11,
    },

    joinTimerMeta: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        11,
      marginTop:
        6,
    },

    joinTimerClosed: {
      color:
        DropColors.textMuted,
    },

    actions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 20,
      marginTop: 16,
    },

    joinButton: {
      width: 112,
      height: 40,
      backgroundColor:
        DropColors.wine,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    requestedButton: {
      backgroundColor:
        DropColors.surface,
      borderWidth:
        1,
      borderColor:
        DropColors.border,
    },

    acceptedButton: {
      backgroundColor:
        DropColors.surface,
      borderWidth:
        1,
      borderColor:
        DropColors.border,
    },

    joinText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
      textAlign: 'center',
    },

    secondaryAction: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
      lineHeight: 20,
    },

    likedAction: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
    },

    ownDropRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 16,
      marginTop: 16,
      minHeight: 32,
    },

    ownDrop: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    ownLikeCount: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    deleteDropButton: {
      marginLeft: 'auto',
      minHeight: 32,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },

    deleteDropText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    requestsButton: {
      marginTop:
        12,
      alignSelf:
        'flex-start',
    },

    requestsText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
    },

    mapPlaceholder: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
    },

    mapPlaceholderTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        17,
    },

    mapPlaceholderText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        13,
      marginTop:
        6,
      textAlign:
        'center',
    },

    floatingFindButton: {
      position:
        'absolute',
      right: 18,
      bottom: 18,
      width: 46,
      height: 46,
      borderRadius:
        23,
      backgroundColor:
        DropColors.wine,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      zIndex:
        20,
      elevation:
        6,
    },

    floatingFindButtonPressed: {
      opacity:
        0.72,
      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    emptyContainer: {
      paddingHorizontal:
        20,
      paddingTop:
        56,
      alignItems:
        'center',
    },

    emptyFindLink: {
      marginTop:
        20,
      paddingVertical:
        6,
      paddingHorizontal:
        4,
    },

    emptyFindText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        14,
    },

    emptyTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        17,
    },

    emptySubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize:
        14,
      marginTop:
        6,
      textAlign:
        'center',
    },
  });