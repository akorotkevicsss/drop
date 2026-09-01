import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { DropFeedMeta } from '@/components/drop-feed-meta';
import { DropRatingPicker } from '@/components/drop-rating-picker';
import { HeartIcon } from '@/components/icons/HeartIcon';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';

import {
  DropMapMarkers,
  DropMapPreview,
} from '@/components/explore-drop-map';
import { ExplorePeopleSearch } from '@/components/explore-people-search';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { primeDropSnapshot } from '@/store/drop-cache';
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
  rating_enabled: boolean;
  join_mode: 'request' | 'free' | 'invite_only';
  join_until: string | null;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
  location_text: string | null;
  location_type: 'place' | 'area' | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_m: number | null;
  location_provider_id: string | null;
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
  if (drop.status !== 'active') {
    return false;
  }

  if (drop.event_end_time && new Date(drop.event_end_time).getTime() <= Date.now()) {
    return false;
  }

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
  const hasLoadedOnce = useRef(false);

  const {
    map: openMapParam,
    focusDropId,
    lat: focusLat,
    lng: focusLng,
    locationType: focusLocationType,
    radius: focusRadius,
  } = useLocalSearchParams<{
    map?: string;
    focusDropId?: string;
    lat?: string;
    lng?: string;
    locationType?: 'place' | 'area';
    radius?: string;
  }>();

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

  const mapRef =
    useRef<MapView | null>(
      null
    );

  const [
    selectedMapDropId,
    setSelectedMapDropId,
  ] = useState<string | null>(
    null
  );

  const [
    mapRegion,
    setMapRegion,
  ] = useState({
    latitude: 56.9496,
    longitude: 24.1052,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  });
  useEffect(() => {
    if (
      openMapParam !== '1'
    ) {
      return;
    }

    const latitude =
      Number(focusLat);

    const longitude =
      Number(focusLng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    setMode('map');

    if (
      focusDropId
    ) {
      setSelectedMapDropId(
        focusDropId
      );
    }

    const radiusMeters =
      Number(focusRadius);

    const effectiveRadius =
      Number.isFinite(radiusMeters) &&
      radiusMeters > 0
        ? radiusMeters
        : 1200;

    const latitudeDelta =
      focusLocationType === 'area'
        ? Math.max(
            0.035,
            Math.min(
              0.18,
              effectiveRadius / 30000
            )
          )
        : 0.012;

    const longitudeDelta =
      latitudeDelta;

    const timer =
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta,
            longitudeDelta,
          },
          650
        );
      }, 300);

    return () => {
      clearTimeout(
        timer
      );
    };
  }, [
    openMapParam,
    focusDropId,
    focusLat,
    focusLng,
    focusLocationType,
    focusRadius,
  ]);

  const [
    addressSearchOpen,
    setAddressSearchOpen,
  ] = useState(false);

  const [
    addressQuery,
    setAddressQuery,
  ] = useState('');

  const [
    addressSearching,
    setAddressSearching,
  ] = useState(false);

  const [
    drops,
    setDrops,
  ] =
    useState<
      Drop[]
    >([]);

  const [
    mapDrops,
    setMapDrops,
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

  const openDrop = useCallback(
    (drop: Drop) => {
      primeDropSnapshot(drop.id, {
        drop: drop as unknown as Record<string, unknown>,
        author: drop.profiles
          ? {
              id: drop.author_id,
              username: drop.profiles.username,
              display_name: drop.profiles.display_name,
              avatar_url: drop.profiles.avatar_url,
            }
          : null,
        likeCount: likeCounts[drop.id] ?? 0,
        liked: likedDropIds.has(drop.id),
        joinStatus: joinStatuses[drop.id] ?? 'none',
      });

      router.push({
        pathname: '/drop/[id]',
        params: { id: drop.id },
      } as any);
    },
    [
      joinStatuses,
      likeCounts,
      likedDropIds,
    ]
  );

  const openDropLocationOnMap = useCallback(
    (drop: Drop) => {
      if (
        typeof drop.location_lat !== 'number' ||
        typeof drop.location_lng !== 'number'
      ) {
        return;
      }

      setMode('map');
      setSelectedMapDropId(
        drop.id
      );

      const radiusMeters =
        drop.location_radius_m ?? 1200;

      const latitudeDelta =
        drop.location_type === 'area'
          ? Math.max(
              0.035,
              Math.min(
                0.18,
                radiusMeters / 30000
              )
            )
          : 0.012;

      const timer =
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude:
                drop.location_lat as number,
              longitude:
                drop.location_lng as number,
              latitudeDelta,
              longitudeDelta:
                latitudeDelta,
            },
            650
          );
        }, 250);

      return () => {
        clearTimeout(
          timer
        );
      };
    },
    []
  );

  useEffect(() => {
    drops.slice(0, 10).forEach((drop) => {
      primeDropSnapshot(drop.id, {
        drop: drop as unknown as Record<string, unknown>,
        author: drop.profiles
          ? {
              id: drop.author_id,
              username: drop.profiles.username,
              display_name: drop.profiles.display_name,
              avatar_url: drop.profiles.avatar_url,
            }
          : null,
      });

      router.prefetch({
        pathname: '/drop/[id]',
        params: { id: drop.id },
      } as any);
    });
  }, [drops]);

  const loadDrops =
    async (
      manualRefresh = false,
      silentRefresh = false
    ) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else if (!silentRefresh) {
          setLoading(true);
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
            event_end_time,
            status,
              join_enabled,
              join_mode,
              interested_enabled,
              reply_enabled,
              comments_enabled,
            rating_enabled,
              join_until,
              background_color,
              image_path,
              attached_image_path,
              location_text,
              location_type,
              location_name,
              location_address,
              location_lat,
              location_lng,
              location_radius_m,
              location_provider_id,
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

        setMapDrops(
          loadedDrops
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
              'drop_id, status, reconfirmation_required'
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

  useEffect(() => {
    loadDrops().finally(() => {
      hasLoadedOnce.current = true;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        return;
      }

      loadDrops(false, true);
    }, [])
  );

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
          currentStatus === 'pending'
        ) {
          const { error } = await supabase
            .from('join_requests')
            .delete()
            .eq('drop_id', drop.id)
            .eq('user_id', currentUserId);

          if (error) {
            Alert.alert(
              'Error',
              'Could not cancel your request.'
            );
            return;
          }

          setJoinStatuses((current) => ({
            ...current,
            [drop.id]: 'none',
          }));
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

        if (drop.join_mode === 'invite_only') {
          Alert.alert(
            'Invite only',
            'This Drop is invite only.'
          );
          return;
        }

        const nextStatus: 'pending' | 'accepted' =
          drop.join_mode === 'free'
            ? 'accepted'
            : 'pending';

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
                nextStatus,
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
            [drop.id]: nextStatus,
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

  const handleAddressSearch =
    async () => {
      const query =
        addressQuery.trim();

      if (
        !query ||
        addressSearching
      ) {
        return;
      }

      try {
        setAddressSearching(
          true
        );

        const results =
          await Location.geocodeAsync(
            query
          );

        const firstResult =
          results[0];

        if (
          !firstResult
        ) {
          Alert.alert(
            'Address',
            'Could not find this address.'
          );
          return;
        }

        setAddressSearchOpen(
          false
        );

        mapRef.current?.animateToRegion(
          {
            latitude:
              firstResult.latitude,
            longitude:
              firstResult.longitude,
            latitudeDelta:
              0.012,
            longitudeDelta:
              0.012,
          },
          650
        );
      } catch (error) {
        console.error(
          'ADDRESS SEARCH ERROR:',
          error
        );

        Alert.alert(
          'Address',
          'Could not search for this address.'
        );
      } finally {
        setAddressSearching(
          false
        );
      }
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
                  drop.location_name ||
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

                const needsReconfirmation =
                  reconfirmationRequired[
                    drop.id
                  ] === true;


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
                      style={styles.drop}
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

                    <Pressable
                    onPress={() =>
                      openDrop(drop)
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
                          styles.dropVisualSolid,
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
                      onLocationPress={
                        typeof drop.location_lat === 'number' &&
                        typeof drop.location_lng === 'number'
                          ? () =>
                              openDropLocationOnMap(
                                drop
                              )
                          : null
                      }
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
                    drop.status === 'ended') &&
                    (
                      drop.status !== 'ended' ||
                      drop.rating_enabled
                    ) && (
                      <View
                        style={
                          styles.actions
                        }
                      >
                        {drop.status === 'ended' && drop.rating_enabled ? (
                          !isOwnDrop &&
                          joinStatus === 'accepted' ? (
                            <TouchableOpacity
                              style={[
                                styles.joinButton,
                                styles.acceptedButton,
                              ]}
                              onPress={() =>
                                openRating(
                                  drop
                                )
                              }
                            >
                              <Text
                                style={
                                  styles.joinText
                                }
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
                                style={
                                  styles.joinText
                                }
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
                                  liked={
                                    isLiked
                                  }
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
        <ExplorePeopleSearch />
      )}

      {mode ===
        'map' && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 56.9496,
              longitude: 24.1052,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
            showsCompass
            rotateEnabled
            pitchEnabled
            scrollEnabled
            zoomEnabled
            toolbarEnabled={false}
            onRegionChangeComplete={(nextRegion) => {
              setMapRegion(nextRegion);
            }}
            onPress={(event) => {
              if (
                event.nativeEvent.action &&
                event.nativeEvent.action !== 'press'
              ) {
                return;
              }

              setSelectedMapDropId(null);
            }}

          >
          <DropMapMarkers
            drops={mapDrops}
            selectedDropId={selectedMapDropId}
            onSelectDrop={setSelectedMapDropId}
            region={mapRegion}
            onOpenCluster={(nextRegion) => {
              setSelectedMapDropId(null);

              mapRef.current?.animateToRegion(
                nextRegion,
                450
              );
            }}
          />
          </MapView>

          <DropMapPreview
            drops={mapDrops}
            selectedDropId={selectedMapDropId}
            onOpenDrop={(dropId) => {
              const drop =
                mapDrops.find(
                  (item) =>
                    item.id ===
                    dropId
                );

              if (drop) {
                openDrop(drop);
              }
            }}
          />
        </View>
      )}

      {mode !==
        'search' && (
        <Pressable
          onPress={() => {
            if (
              mode ===
              'map'
            ) {
              setAddressSearchOpen(
                true
              );
              return;
            }

            setMode(
              'search'
            );
          }}
          style={({ pressed }) => [
            styles.floatingFindButton,
            pressed &&
              styles.floatingFindButtonPressed,
          ]}
        >
          <Ionicons
            name="search"
            size={26}
            color={DropColors.warmWhite}
          />
        </Pressable>
      )}
      <Modal
        visible={
          addressSearchOpen
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAddressSearchOpen(
            false
          )
        }
      >
        <Pressable
          style={styles.addressModalBackdrop}
          onPress={() =>
            setAddressSearchOpen(
              false
            )
          }
        >
          <Pressable
            style={styles.addressSearchCard}
            onPress={() => {}}
          >
            <Text
              style={styles.addressSearchTitle}
            >
              Search address
            </Text>

            <TextInput
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Street, city or place"
              placeholderTextColor={
                DropColors.textMuted
              }
              autoFocus
              returnKeyType="search"
              selectionColor={
                DropColors.wine
              }
              style={styles.addressSearchInput}
              onSubmitEditing={
                handleAddressSearch
              }
            />

            <View
              style={styles.addressSearchActions}
            >
              <Pressable
                onPress={() =>
                  setAddressSearchOpen(
                    false
                  )
                }
                style={styles.addressCancelButton}
              >
                <Text
                  style={styles.addressCancelText}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  handleAddressSearch
                }
                disabled={
                  addressSearching ||
                  !addressQuery.trim()
                }
                style={[
                  styles.addressSearchButton,
                  (
                    addressSearching ||
                    !addressQuery.trim()
                  ) &&
                    styles.addressSearchButtonDisabled,
                ]}
              >
                <Text
                  style={styles.addressSearchButtonText}
                >
                  {addressSearching
                    ? '...'
                    : 'Search'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
      minHeight: 128,
      paddingTop: 52,
      paddingHorizontal: 18,
      paddingBottom: 18,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      justifyContent: 'flex-end',
    },

    exploreTitleBlock: {
      flexShrink: 1,
    },

    exploreTitle: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.light,
      fontSize: 30,
      lineHeight: 36,
    },

    exploreSubtitle: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },

    exploreTabs: {
      height: 42,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    exploreTab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    exploreTabText: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontSize: 14,
    },

    exploreTabTextActive: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
    },

    exploreTabLine: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 0,
      height: 1,
      backgroundColor: 'transparent',
    },

    exploreTabLineActive: {
      backgroundColor: DropColors.wine,
    },

    exploreTabDivider: {
      width: StyleSheet.hairlineWidth,
      height: 20,
      alignSelf: 'center',
      backgroundColor: DropColors.border,
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

    dropVisualSolid: {
      paddingHorizontal: 18,
      paddingVertical: 18,
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
        'rgba(0,0,0,0.75)',
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
      gap:
        18,
      marginTop:
        14,
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
      lineHeight: 18,
      textAlign: 'center',
    },

    likeActionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    ownLikeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    secondaryAction: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        13,
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
      gap:
        14,
      marginTop:
        14,
    },

    ownDrop: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize:
        12,
    },

    ownLikeCount: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize:
        13,
    },

    deleteDropButton: {
      marginLeft:
        'auto',
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
      fontSize:
        12,
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
      fontSize:
        14,
    },

    mapContainer: {
      flex: 1,
      overflow: 'hidden',
    },

    map: {
      flex: 1,
    },

    addressModalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.62)',
      justifyContent:
        'flex-start',
      paddingTop: 112,
      paddingHorizontal: 18,
    },

    addressSearchCard: {
      backgroundColor:
        DropColors.surface,
      borderRadius: 18,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      padding: 16,
    },

    addressSearchTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 16,
      marginBottom: 12,
    },

    addressSearchInput: {
      height: 46,
      borderRadius: 14,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      backgroundColor:
        DropColors.graphite,
      paddingHorizontal: 14,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 15,
    },

    addressSearchActions: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },

    addressCancelButton: {
      minWidth: 86,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        DropColors.graphite,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    addressCancelText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    addressSearchButton: {
      minWidth: 96,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        DropColors.wine,
    },

    addressSearchButtonDisabled: {
      opacity: 0.45,
    },

    addressSearchButtonText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
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