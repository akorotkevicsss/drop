import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useEffect,
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

import { DropFeedMeta } from '@/components/drop-feed-meta';
import { DropRatingPicker } from '@/components/drop-rating-picker';
import { HeartIcon } from '@/components/icons/HeartIcon';
import Ionicons from '@expo/vector-icons/Ionicons';


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
  event_end_time: string | null;
  status: 'active' | 'ended' | 'cancelled';
  join_enabled: boolean;
  interested_enabled: boolean;
  reply_enabled: boolean;
  comments_enabled: boolean;
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
  reconfirmation_required: boolean | null;
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

function isJoinOpen(drop: Drop) {
  if (drop.status !== 'active') {
    return false;
  }

  if (drop.event_end_time && new Date(drop.event_end_time).getTime() <= Date.now()) {
    return false;
  }

  if (!drop.join_enabled) {
    return false;
  }

  if (!drop.join_until) {
    return true;
  }

  return (
    new Date(drop.join_until).getTime() >
    Date.now()
  );
}

function formatJoinTimer(
  joinUntil: string | null
) {
  if (!joinUntil) {
    return null;
  }

  const difference =
    new Date(joinUntil).getTime() -
    Date.now();

  if (difference <= 0) {
    return 'Join closed';
  }

  const minutes = Math.ceil(
    difference / (1000 * 60)
  );

  if (minutes < 60) {
    return `Join · ${minutes}m left`;
  }

  const hours = Math.ceil(
    minutes / 60
  );

  return `Join · ${hours}h left`;
}

export default function HomeScreen() {
  const [drops, setDrops] =
    useState<Drop[]>([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [
    activityUnreadCount,
    setActivityUnreadCount,
  ] = useState(0);

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
    commentCounts,
    setCommentCounts,
  ] = useState<
    Record<string, number>
  >({});

  const [
    myRatings,
    setMyRatings,
  ] = useState<
    Record<string, number>
  >({});

  const [
    averageRatings,
    setAverageRatings,
  ] = useState<
    Record<string, number>
  >({});

  const [
    ratingDropId,
    setRatingDropId,
  ] = useState<string | null>(
    null
  );

  const [
    ratingValue,
    setRatingValue,
  ] = useState(5);

  const [
    ratingSaving,
    setRatingSaving,
  ] = useState(false);

  const [
    reconfirmationRequired,
    setReconfirmationRequired,
  ] = useState<
    Record<string, boolean>
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

  const [
    deleteLoadingId,
    setDeleteLoadingId,
  ] = useState<string | null>(
    null
  );

  const loadActivityUnreadCount =
    useCallback(
      async (
        suppliedUserId?: string
      ) => {
        const userId =
          suppliedUserId ??
          currentUserId;

        if (!userId) {
          setActivityUnreadCount(
            0
          );
          return;
        }

        const {
          count,
          error,
        } =
          await supabase
            .from(
              'notifications'
            )
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'user_id',
              userId
            )
            .is(
              'read_at',
              null
            );

        if (error) {
          console.warn(
            'ACTIVITY BADGE ERROR:',
            error
          );
          return;
        }

        setActivityUnreadCount(
          count ?? 0
        );
      },
      [
        currentUserId,
      ]
    );

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

      await loadActivityUnreadCount(
        user.id
      );

      const {
        data: followingData,
        error: followingError,
      } =
        await supabase
          .from('follows')
          .select(
            'following_id'
          )
          .eq(
            'follower_id',
            user.id
          );

      if (followingError) {
        console.error(
          'LOAD FOLLOWING ERROR:',
          followingError
        );

        Alert.alert(
          'Error',
          'Could not load your Following feed.'
        );

        return;
      }

      const feedAuthorIds = [
        user.id,
        ...(
          followingData ?? []
        ).map(
          (follow) =>
            follow.following_id
        ),
      ];

      const {
        data,
        error,
      } =
        await supabase
          .from('drops')
          .select(`
            id,
            author_id,
            text,
            city,
            event_time,
            event_end_time,
            status,
            join_enabled,
            interested_enabled,
            reply_enabled,
            comments_enabled,
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
          .in(
            'author_id',
            feedAuthorIds
          )
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
        (
          data ?? []
        ) as unknown as Drop[];

      setDrops(
        loadedDrops
      );

      const {
        data: allLikes,
        error: allLikesError,
      } =
        await supabase
          .from('drop_likes')
          .select(
            'drop_id, user_id'
          );

      if (!allLikesError) {
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
      } else {
        console.error(
          'LOAD LIKES ERROR:',
          allLikesError
        );
      }

      const {
        data: allComments,
        error: allCommentsError,
      } =
        await supabase
          .from('drop_comments')
          .select('drop_id')
          .is('deleted_at', null);

      if (!allCommentsError) {
        const nextCommentCounts:
          Record<string, number> = {};

        (allComments ?? []).forEach(
          (comment) => {
            nextCommentCounts[
              comment.drop_id
            ] =
              (
                nextCommentCounts[
                  comment.drop_id
                ] ?? 0
              ) + 1;
          }
        );

        setCommentCounts(
          nextCommentCounts
        );
      } else {
        console.error(
          'LOAD COMMENT COUNTS ERROR:',
          allCommentsError
        );
      }

      const {
        data: myRequests,
        error: myRequestsError,
      } =
        await supabase
          .from(
            'join_requests'
          )
          .select(
            'drop_id, status, reconfirmation_required'
          )
          .eq(
            'user_id',
            user.id
          );

      if (!myRequestsError) {
        const nextStatuses:
          Record<
            string,
            JoinStatus
          > = {};

        (
          (
            myRequests ??
            []
          ) as MyJoinRequest[]
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

        const nextReconfirmation:
          Record<string, boolean> = {};

        (
          (
            myRequests ??
            []
          ) as MyJoinRequest[]
        ).forEach(
          (request) => {
            nextReconfirmation[
              request.drop_id
            ] =
              request.reconfirmation_required ===
              true;
          }
        );

        setReconfirmationRequired(
          nextReconfirmation
        );

      } else {
        console.error(
          'MY JOIN REQUESTS ERROR:',
          myRequestsError
        );
      }

      const {
        data: myRatingRows,
        error: myRatingsError,
      } =
        await supabase
          .from('drop_ratings')
          .select('drop_id,rating')
          .eq('user_id', user.id);

      if (myRatingsError) {
        console.error(
          'MY RATINGS ERROR:',
          myRatingsError
        );
      } else {
        const nextRatings:
          Record<string, number> = {};

        (
          myRatingRows ?? []
        ).forEach(
          (row) => {
            nextRatings[
              row.drop_id
            ] = Number(
              row.rating
            );
          }
        );

        setMyRatings(
          nextRatings
        );
      }

      const {
        data: allRatingRows,
        error: allRatingsError,
      } =
        await supabase
          .from('drop_ratings')
          .select('drop_id,rating');

      if (allRatingsError) {
        console.error(
          'DROP RATING AVERAGES ERROR:',
          allRatingsError
        );
      } else {
        const totals:
          Record<string, number> = {};
        const counts:
          Record<string, number> = {};

        (
          allRatingRows ?? []
        ).forEach(
          (row) => {
            totals[row.drop_id] =
              (
                totals[
                  row.drop_id
                ] ?? 0
              ) +
              Number(
                row.rating
              );

            counts[row.drop_id] =
              (
                counts[
                  row.drop_id
                ] ?? 0
              ) + 1;
          }
        );

        const averages:
          Record<string, number> = {};

        Object.keys(
          totals
        ).forEach(
          (dropId) => {
            averages[dropId] =
              Math.round(
                (
                  totals[dropId] /
                  counts[dropId]
                ) * 10
              ) / 10;
          }
        );

        setAverageRatings(
          averages
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

        if (!pendingError) {
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
        } else {
          console.error(
            'PENDING COUNTS ERROR:',
            pendingError
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
      setLoading(false);
      setRefreshing(false);
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

  useEffect(() => {
    if (
      !currentUserId
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `home-activity-badge-${currentUserId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema:
              'public',
            table:
              'notifications',
            filter:
              `user_id=eq.${currentUserId}`,
          },
          () => {
            loadActivityUnreadCount();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    currentUserId,
    loadActivityUnreadCount,
  ]);

  const openRating =
    (drop: Drop) => {
      setRatingDropId(
        drop.id
      );

      setRatingValue(
        myRatings[
          drop.id
        ] ?? 5
      );
    };

  const saveRating =
    async () => {
      if (
        !ratingDropId ||
        ratingSaving
      ) {
        return;
      }

      try {
        setRatingSaving(
          true
        );

        const {
          error,
        } =
          await supabase.rpc(
            'rate_ended_drop',
            {
              p_drop_id:
                ratingDropId,
              p_rating:
                ratingValue,
            }
          );

        if (error) {
          throw error;
        }

        setMyRatings(
          (current) => ({
            ...current,
            [ratingDropId]:
              ratingValue,
          })
        );

        setRatingDropId(
          null
        );
      } catch (error) {
        console.error(
          'RATE DROP ERROR:',
          error
        );

        Alert.alert(
          'Rate',
          'Could not save your rate.'
        );
      } finally {
        setRatingSaving(
          false
        );
      }
    };

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
                    await supabase.rpc(
                      'decline_drop_reschedule',
                      {
                        p_drop_id:
                          drop.id,
                      }
                    );

          if (error) {
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

        if (
          currentStatus ===
          'accepted'
        ) {
          if (
            !reconfirmationRequired[
              drop.id
            ]
          ) {
            return;
          }

          Alert.alert(
            'Date changed',
            'The organizer changed the date. Can you still go?',
            [
              {
                text: "Can't go",
                style: 'destructive',
                onPress: async () => {
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
                    Alert.alert(
                      'Error',
                      'Could not update your participation.'
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

                  setReconfirmationRequired(
                    (current) => ({
                      ...current,
                      [drop.id]:
                        false,
                    })
                  );
                },
              },
              {
                text: 'Confirm',
                onPress: async () => {
                  const {
                    error,
                  } =
                    await supabase.rpc(
                      'confirm_drop_reschedule',
                      {
                        p_drop_id:
                          drop.id,
                      }
                    );

                  if (error) {
                    Alert.alert(
                      'Error',
                      'Could not confirm your participation.'
                    );
                    return;
                  }

                  setReconfirmationRequired(
                    (current) => ({
                      ...current,
                      [drop.id]:
                        false,
                    })
                  );
                },
              },
            ]
          );

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

          if (deleteError) {
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
          string | null = null;

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

        if (existingError) {
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

          if (createError) {
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
                .limit(1);

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
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
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

                  if (error) {
                    Alert.alert(
                      'Error',
                      'Could not delete this Drop.'
                    );

                    return;
                  }

                  setDrops(
                    (current) =>
                      current.filter(
                        (item) =>
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
          styles.header
        }
      >
        <View
          style={
            styles.headerTextBlock
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            Drops
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            See Drops from people you follow.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push(
              '/activity'
            )
          }
          hitSlop={10}
          style={({ pressed }) => [
            styles.activityButton,
            pressed &&
              styles.iconButtonPressed,
          ]}
        >
          <IconSymbol
            name="bell.fill"
            size={21}
            color={
              DropColors.warmWhite
            }
          />
          {activityUnreadCount >
            0 && (
            <View
              style={
                styles.activityBadge
              }
            >
              <Text
                style={
                  styles.activityBadgeText
                }
              >
                {activityUnreadCount >
                99
                  ? '99+'
                  : activityUnreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

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
              DropColors.warmWhite
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
              Your Following feed is quiet.
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Follow people to bring their Drops here, or post your own.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.emptyExplore,
                pressed &&
                  styles.iconButtonPressed,
              ]}
              onPress={() =>
                router.push(
                  '/explore'
                )
              }
            >
              <Text
                style={
                  styles.emptyExploreText
                }
              >
                Explore Drops
              </Text>
            </Pressable>
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
                drop
                  .profiles
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
                ] ?? 'none';

              const needsReconfirmation =
                reconfirmationRequired[
                  drop.id
                ] === true;


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


              const commentCount =

                commentCounts[

                  drop.id

                ] ?? 0;

              const joinOpen =
                isJoinOpen(
                  drop
                );

              const averageRating =
                averageRatings[
                  drop.id
                ];

              const joinTimerLabel =
                formatJoinTimer(
                  drop.join_until
                );

              return (
                  <View
                    key={drop.id}
                    style={[
                      styles.drop,
                      isOwnDrop &&
                        styles.ownDropBackground,
                    ]}
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
                      <UserAvatar
                        uri={
                          drop.profiles
                            ?.avatar_url
                        }
                        name={
                          displayName
                        }
                        size={40}
                      />
                    </View>

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

                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/drop/[id]', params: { id: drop.id } } as any)
                    }
                  >
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

                  <DropFeedMeta
                    eventTime={drop.event_time}
                    eventEndTime={drop.event_end_time}
                    status={drop.status}
                    location={location}
                    ageRestriction={drop.age_restriction}
                    joinLimit={drop.join_limit}
                  />

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

                  </Pressable>
                  {(!isOwnDrop ||
                    drop.status === 'ended') && (
                    <View
                      style={
                        styles.actions
                      }
                    >
                      {drop.status === 'ended' ? (
                        !isOwnDrop &&
                        joinStatus === 'accepted' ? (
                          <TouchableOpacity
                            style={[
                              styles.joinButton,
                              styles.acceptedButton,
                            ]}
                            activeOpacity={0.72}
                            onPress={() =>
                              openRating(
                                drop
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.joinText,
                                styles.requestedText,
                              ]}
                            >
                              {myRatings[
                                drop.id
                              ] !== undefined
                                ? `★ ${myRatings[
                                    drop.id
                                  ].toFixed(1)}`
                                : 'Rate'}
                            </Text>
                          </TouchableOpacity>
                        ) : averageRating !== undefined ? (
                          <View
                            style={[
                              styles.joinButton,
                              styles.acceptedButton,
                            ]}
                          >
                            <Text
                              style={[
                                styles.joinText,
                                styles.requestedText,
                              ]}
                            >
                              ★ {averageRating.toFixed(1)}
                            </Text>
                          </View>
                        ) : null
                      ) : null}

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
                              'accepted' &&
                            !needsReconfirmation
                          }
                          activeOpacity={0.72}
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
                                  ? needsReconfirmation
                                    ? 'Confirm'
                                    : 'Joined'
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
                          {likeLoadingId ===
                          drop.id ? (
                            <Text
                              style={
                                styles.secondaryAction
                              }
                            >
                              ...
                            </Text>
                          ) : (
                            <View
                              style={
                                styles.likeActionContent
                              }
                            >
                              <HeartIcon
                                liked={isLiked}
                                size={20}
                              />

                              <Text
                                style={[
                                  styles.secondaryAction,
                                  isLiked &&
                                    styles.likedAction,
                                ]}
                              >
                                {likeCount}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: '/drop/[id]/comments',
                            params: { id: drop.id },
                          } as any)
                        }
                      >
                        <Text
                          style={
                            styles.secondaryAction
                          }
                        >
                          {'Comments ' + commentCount}
                        </Text>
                      </TouchableOpacity>

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

                        <View
                          style={
                            styles.ownLikeContent
                          }
                        >
                          <HeartIcon
                            liked
                            size={20}
                          />

                          <Text
                            style={
                              styles.ownLikeCount
                            }
                          >
                            {likeCount}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/drop/[id]/comments',
                              params: { id: drop.id },
                            } as any)
                          }
                          hitSlop={10}
                        >
                          <Text
                            style={
                              styles.ownCommentText
                            }
                          >
                            {'Comments ' + commentCount}
                          </Text>
                        </Pressable>

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
                          hitSlop={10}
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
                            {pendingCount}{' '}
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

      <DropRatingPicker
        visible={
          ratingDropId !==
          null
        }
        value={
          ratingValue
        }
        saving={
          ratingSaving
        }
        onChange={
          setRatingValue
        }
        onClose={() =>
          setRatingDropId(
            null
          )
        }
        onSave={
          saveRating
        }
      />

      <Pressable
        onPress={() =>
          router.push('/create')
        }
        style={({ pressed }) => [
          styles.floatingCreateButton,
          pressed &&
            styles.iconButtonPressed,
        ]}
      >
        <Ionicons
          name="add"
          size={28}
          color={DropColors.warmWhite}
        />
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

    loadingContainer: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      minHeight: 128,
      paddingTop: 52,
      paddingHorizontal: 18,
      paddingBottom: 18,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },

    headerTextBlock: {
      flex: 1,
      paddingRight: 16,
    },

    headerTitle: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.light,
      fontSize: 30,
      lineHeight: 36,
    },

    headerSubtitle: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },

    activityButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityBadge: {
      position: 'absolute',
      top: -3,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor:
        DropColors.wine,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityBadgeText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 9,
      lineHeight: 11,
      textAlign: 'center',
    },

    iconButtonPressed: {
      opacity: 0.62,
    },

    feedContent: {
      paddingBottom: 88,
    },

    drop: {
      paddingHorizontal: 18,
      paddingVertical: 17,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    ownDropBackground: {
      backgroundColor: '#151515',
    },


    userRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        DropColors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    authorText: {
      flexShrink: 1,
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
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 1,
    },

    dropText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 17,
      lineHeight: 23,
      marginTop: 14,
    },

    dropVisual: {
      minHeight: 176,
      marginTop: 14,
      borderRadius: 16,
      overflow: 'hidden',
      justifyContent:
        'center',
    },

    dropVisualImage: {
      borderRadius: 16,
    },

    dropVisualOverlay: {
      minHeight: 176,
      paddingHorizontal: 18,
      paddingVertical: 18,
      backgroundColor:
        'rgba(0,0,0,0.75)',
      justifyContent:
        'center',
    },

    dropVisualText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 18,
      lineHeight: 25,
      textShadowColor:
        'rgba(0,0,0,0.38)',
      textShadowOffset: {
        width: 0,
        height: 1,
      },
      textShadowRadius: 3,
    },

    dropDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 7,
    },

    detailMeta: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    attachedImage: {
      width: '100%',
      aspectRatio: 4 / 3,
      marginTop: 12,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor:
        DropColors.surface,
    },

    attachedImageRadius: {
      borderRadius: 16,
    },

    meta: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      marginTop: 8,
    },

    joinTimerMeta: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      marginTop: 6,
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
      gap: 18,
      marginTop: 14,
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
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    acceptedButton: {
      backgroundColor:
        DropColors.surface,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    joinText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
    },

    requestedText: {
      color:
        DropColors.warmWhite,
    },

    likeActionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    ownLikeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    secondaryAction: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
    },

    likedAction: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
    },

    ownDropRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
      marginTop: 12,
    },

    ownDrop: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    ownLikeCount: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
    },

    deleteDropButton: {
      marginLeft: 'auto',
    },

    ownCommentText: {

      color: DropColors.textSecondary,

      fontFamily: DropTypography.regular,

      fontSize: 11,

    },


    deleteDropText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    requestsButton: {
      marginTop: 10,
      alignSelf:
        'flex-start',
    },

    requestsText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    floatingCreateButton: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      zIndex: 20,
      elevation: 6,
    },
});