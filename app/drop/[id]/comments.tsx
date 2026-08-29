import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DropFeedMeta } from '@/components/drop-feed-meta';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import {
  getScreenCache,
  setScreenCache,
} from '@/lib/tab-screen-cache';

type DropAuthor = {
  username: string | null;
  display_name: string | null;
  city: string | null;
  avatar_url: string | null;
};

type DropRow = {
  id: string;
  author_id: string;
  text: string;
  city: string | null;
  event_time: string | null;
  event_end_time: string | null;
  status:
    | 'active'
    | 'ended'
    | 'cancelled';
  comments_enabled: boolean;
  background_color: string | null;
  image_path: string | null;
  attached_image_path: string | null;
  location_text: string | null;
  join_limit: number | null;
  age_restriction: string | null;
  created_at: string;
  profiles: DropAuthor | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type CommentView =
  CommentRow & {
    profile:
      Profile | null;
  };

type CommentsCache = {
  drop: DropRow | null;
  comments: CommentView[];
  currentUserId:
    string | null;
};

function formatDropTime(
  createdAt: string
) {
  const difference =
    Date.now() -
    new Date(
      createdAt
    ).getTime();

  const minutes =
    Math.max(
      0,
      Math.floor(
        difference /
          60000
      )
    );

  if (
    minutes < 1
  ) {
    return 'now';
  }

  if (
    minutes < 60
  ) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (
    hours < 24
  ) {
    return `${hours}h`;
  }

  return `${Math.floor(
    hours / 24
  )}d`;
}

function formatCommentTime(
  createdAt: string
) {
  return new Date(
    createdAt
  ).toLocaleString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

export default function DropCommentsScreen() {
  const {
    id,
  } =
    useLocalSearchParams<{
      id: string;
    }>();

  const cacheKey =
    id
      ? `drop-comments:${id}`
      : '';

  const cached =
    cacheKey
      ? getScreenCache<CommentsCache>(
          cacheKey
        )
      : null;

  const [
    drop,
    setDrop,
  ] =
    useState<DropRow | null>(
      cached?.drop ??
        null
    );

  const [
    comments,
    setComments,
  ] =
    useState<
      CommentView[]
    >(
      cached?.comments ??
        []
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(
      cached?.currentUserId ??
        null
    );

  const [
    text,
    setText,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(
      !cached
    );

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const requestInFlight =
    useRef(false);

  const load =
    useCallback(
      async (
        showLoader =
          false
      ) => {
        if (
          !id ||
          requestInFlight.current
        ) {
          return;
        }

        requestInFlight.current =
          true;

        if (
          showLoader &&
          !getScreenCache<CommentsCache>(
            `drop-comments:${id}`
          )
        ) {
          setLoading(
            true
          );
        }

        try {
          const {
            data: {
              session,
            },
          } =
            await supabase.auth.getSession();

          const userId =
            session?.user.id ??
            null;

          setCurrentUserId(
            userId
          );

          const [
            dropResult,
            commentsResult,
          ] =
            await Promise.all([
              supabase
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
                  comments_enabled,
                  background_color,
                  image_path,
                  attached_image_path,
                  location_text,
                  join_limit,
                  age_restriction,
                  created_at,
                  profiles!drops_author_id_fkey (
                    username,
                    display_name,
                    city,
                    avatar_url
                  )
                `)
                .eq(
                  'id',
                  id
                )
                .is(
                  'deleted_at',
                  null
                )
                .maybeSingle(),

              supabase
                .from(
                  'drop_comments'
                )
                .select(
                  'id,user_id,text,created_at'
                )
                .eq(
                  'drop_id',
                  id
                )
                .is(
                  'deleted_at',
                  null
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      true,
                  }
                ),
            ]);

          if (
            dropResult.error ||
            !dropResult.data
          ) {
            setDrop(
              null
            );
            return;
          }

          if (
            commentsResult.error
          ) {
            throw commentsResult.error;
          }

          const nextDrop =
            dropResult.data as unknown as DropRow;

          const rows =
            (
              commentsResult.data ??
              []
            ) as CommentRow[];

          const userIds = [
            ...new Set(
              rows.map(
                (
                  comment
                ) =>
                  comment.user_id
              )
            ),
          ];

          let profiles:
            Profile[] = [];

          if (
            userIds.length >
            0
          ) {
            const {
              data:
                profileData,
              error:
                profileError,
            } =
              await supabase
                .from(
                  'profiles'
                )
                .select(
                  'id,username,display_name,avatar_url'
                )
                .in(
                  'id',
                  userIds
                );

            if (
              profileError
            ) {
              throw profileError;
            }

            profiles =
              (
                profileData ??
                []
              ) as Profile[];
          }

          const nextComments =
            rows.map(
              (
                comment
              ) => ({
                ...comment,
                profile:
                  profiles.find(
                    (
                      profile
                    ) =>
                      profile.id ===
                      comment.user_id
                  ) ??
                  null,
              })
            );

          setDrop(
            nextDrop
          );

          setComments(
            nextComments
          );

          setScreenCache<CommentsCache>(
            `drop-comments:${id}`,
            {
              drop:
                nextDrop,
              comments:
                nextComments,
              currentUserId:
                userId,
            }
          );
        } catch (
          error
        ) {
          console.error(
            'DROP COMMENTS LOAD ERROR:',
            error
          );

          if (
            !cached
          ) {
            Alert.alert(
              'Error',
              'Could not load comments.'
            );
          }
        } finally {
          requestInFlight.current =
            false;

          setLoading(
            false
          );
        }
      },
      [
        id,
      ]
    );

  useEffect(
    () => {
      load(
        !cached
      );
    },
    [
      id,
    ]
  );

  /*
   * Comments update live. A realtime event only triggers a silent refresh;
   * it never replaces the visible page with a loading screen.
   */
  useEffect(
    () => {
      if (
        !id
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            `drop-comments-${id}`
          )
          .on(
            'postgres_changes',
            {
              event:
                '*',
              schema:
                'public',
              table:
                'drop_comments',
              filter:
                `drop_id=eq.${id}`,
            },
            () => {
              load(
                false
              );
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          channel
        );
      };
    },
    [
      id,
      load,
    ]
  );

  const canComment =
    useMemo(
      () =>
        !!currentUserId &&
        !!drop
          ?.comments_enabled &&
        drop.status ===
          'active',
      [
        currentUserId,
        drop,
      ]
    );

  const sendComment =
    async () => {
      const value =
        text.trim();

      if (
        !id ||
        !currentUserId ||
        !canComment ||
        !value ||
        sending
      ) {
        return;
      }

      try {
        setSending(
          true
        );

        const {
          error,
        } =
          await supabase
            .from(
              'drop_comments'
            )
            .insert({
              drop_id:
                id,
              user_id:
                currentUserId,
              text:
                value,
            });

        if (
          error
        ) {
          throw error;
        }

        setText('');

        /*
         * Silent refresh. Realtime will usually arrive too, but this keeps
         * posting reliable even if the subscription reconnects.
         */
        await load(
          false
        );
      } catch (
        error
      ) {
        console.error(
          'SEND DROP COMMENT ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Could not post comment.'
        );
      } finally {
        setSending(
          false
        );
      }
    };

  if (
    loading &&
    !drop
  ) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />

        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
      </View>
    );
  }

  if (
    !drop
  ) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Stack.Screen
          options={{
            headerShown:
              false,
          }}
        />

        <Text
          style={
            styles.emptyTitle
          }
        >
          Drop unavailable.
        </Text>
      </View>
    );
  }

  const displayName =
    drop.profiles
      ?.display_name ||
    'Unnamed user';

  const username =
    drop.profiles
      ?.username;

  const location =
    drop.location_text ||
    drop.city ||
    drop.profiles?.city ||
    null;

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

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
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
            12
          }
        >
          <Text
            style={
              styles.back
            }
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Comments
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.dropCard
          }
        >
          <View
            style={
              styles.userRow
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
                40
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
                {username
                  ? ' · '
                  : ''}
                {formatDropTime(
                  drop.created_at
                )}
              </Text>
            </View>
          </View>

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
                    {
                      drop.text
                    }
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
                  {
                    drop.text
                  }
                </Text>
              </View>
            )
          ) : (
            <Text
              style={
                styles.dropText
              }
            >
              {
                drop.text
              }
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
            eventTime={
              drop.event_time
            }
            eventEndTime={
              drop.event_end_time
            }
            status={
              drop.status
            }
            location={
              location
            }
            ageRestriction={
              drop.age_restriction
            }
            joinLimit={
              drop.join_limit
            }
          />
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          COMMENTS · {
            comments.length
          }
        </Text>

        {comments.length ===
        0 ? (
          <View
            style={
              styles.emptyComments
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No comments yet.
            </Text>

            <Text
              style={
                styles.emptySubtitle
              }
            >
              Be the first to start the discussion.
            </Text>
          </View>
        ) : (
          comments.map(
            (
              comment
            ) => {
              const commentName =
                comment
                  .profile
                  ?.display_name ||
                comment
                  .profile
                  ?.username ||
                'User';

              return (
                <View
                  key={
                    comment.id
                  }
                  style={
                    styles.commentRow
                  }
                >
                  <UserAvatar
                    uri={
                      comment
                        .profile
                        ?.avatar_url
                    }
                    name={
                      commentName
                    }
                    size={
                      34
                    }
                  />

                  <View
                    style={
                      styles.commentBody
                    }
                  >
                    <View
                      style={
                        styles.commentHeader
                      }
                    >
                      <Text
                        style={
                          styles.commentName
                        }
                      >
                        {
                          commentName
                        }
                      </Text>

                      <Text
                        style={
                          styles.commentTime
                        }
                      >
                        {formatCommentTime(
                          comment.created_at
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.commentText
                      }
                    >
                      {
                        comment.text
                      }
                    </Text>
                  </View>
                </View>
              );
            }
          )
        )}
      </ScrollView>

      <View
        style={
          styles.composer
        }
      >
        {canComment ? (
          <>
            <TextInput
              value={
                text
              }
              onChangeText={
                setText
              }
              placeholder="Add a comment..."
              placeholderTextColor={
                DropColors.textMuted
              }
              selectionColor={
                DropColors.wine
              }
              style={
                styles.input
              }
              multiline
              maxLength={
                500
              }
            />

            <Pressable
              onPress={
                sendComment
              }
              disabled={
                !text.trim() ||
                sending
              }
              style={[
                styles.sendButton,
                (
                  !text.trim() ||
                  sending
                ) &&
                  styles.sendButtonDisabled,
              ]}
            >
              <Text
                style={
                  styles.sendText
                }
              >
                {sending
                  ? '...'
                  : 'Post'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text
            style={
              styles.commentsClosed
            }
          >
            {drop.comments_enabled
              ? 'Comments are closed for this Drop.'
              : 'Comments are disabled by the organizer.'}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },
    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        DropColors.graphite,
    },
    header: {
      paddingTop: 52,
      minHeight: 104,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },
    back: {
      width: 38,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.light,
      fontSize: 36,
      lineHeight: 38,
    },
    headerTitle: {
      flex: 1,
      textAlign:
        'center',
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 16,
    },
    headerSpacer: {
      width: 38,
    },
    content: {
      paddingBottom: 24,
    },
    dropCard: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
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
      marginBottom: 12,
    },
    authorText: {
      flex: 1,
      marginLeft: 10,
    },
    name: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },
    username: {
      marginTop: 2,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
    },
    dropText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 18,
      lineHeight: 25,
    },
    dropVisual: {
      minHeight: 190,
      borderRadius: 18,
      overflow:
        'hidden',
      justifyContent:
        'flex-end',
    },
    dropVisualImage: {
      borderRadius: 18,
    },
    dropVisualOverlay: {
      minHeight: 190,
      justifyContent:
        'flex-end',
      padding: 16,
      backgroundColor:
        'rgba(0,0,0,0.22)',
    },
    dropVisualText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 20,
      lineHeight: 27,
    },
    attachedImage: {
      height: 230,
      marginTop: 12,
    },
    attachedImageRadius: {
      borderRadius: 18,
    },
    sectionLabel: {
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 8,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.1,
    },
    commentRow: {
      paddingHorizontal: 18,
      paddingVertical: 13,
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },
    commentBody: {
      flex: 1,
      minWidth: 0,
      marginLeft: 10,
    },
    commentHeader: {
      flexDirection:
        'row',
      alignItems:
        'baseline',
      justifyContent:
        'space-between',
      gap: 12,
    },
    commentName: {
      flex: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },
    commentTime: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 9,
    },
    commentText: {
      marginTop: 4,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    emptyComments: {
      paddingHorizontal: 18,
      paddingVertical: 28,
    },
    emptyTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },
    emptySubtitle: {
      marginTop: 4,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 15,
    },
    composer: {
      minHeight: 66,
      paddingHorizontal: 14,
      paddingVertical: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      backgroundColor:
        DropColors.graphite,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      paddingHorizontal: 14,

      /*
       * A multiline iOS TextInput does not vertically center reliably.
       * Explicit top/bottom padding + lineHeight keeps the first line centered,
       * while still allowing the composer to grow for longer comments.
       */
      paddingTop: 12,
      paddingBottom: 10,
      borderRadius: 22,
      backgroundColor:
        DropColors.surface,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      lineHeight: 18,
      textAlignVertical:
        'top',
    },
    sendButton: {
      minWidth: 54,
      height: 44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sendButtonDisabled: {
      opacity: 0.38,
    },
    sendText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },
    commentsClosed: {
      flex: 1,
      paddingVertical: 8,
      textAlign:
        'center',
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },
  });
