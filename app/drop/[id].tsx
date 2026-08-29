import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { PhotoEditor } from '@/components/photo-editor';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { getScreenCache, patchScreenCache } from '@/lib/tab-screen-cache';

type Conversation = {
  id: string;
  author_id: string | null;
  participant_id: string | null;
  conversation_type:
    | 'direct'
    | 'group';
  title: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type ConversationMember = {
  user_id: string;
};

type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'voice';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  message_type: MessageType;
  media_path: string | null;
  voice_duration_ms: number | null;
  reply_to_message_id: string | null;
  deleted_for_everyone_at: string | null;
  edited_at: string | null;
  created_at: string;
};

type ConversationEvent = {
  id: string;
  conversation_id: string;
  actor_id: string;
  drop_id: string | null;
  event_type:
    | 'join'
    | 'reply';
  drop_text_snapshot: string | null;
  created_at: string;
};

type TimelineItem =
  | {
      type: 'message';
      created_at: string;
      data: Message;
    }
  | {
      type: 'event';
      created_at: string;
      data: ConversationEvent;
    };

type PendingImage = {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
};

type PendingVideo = {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
};

type EditorSource = {
  uri: string;
  width: number;
  height: number;
};

function formatMessageTime(
  dateString: string
) {
  return new Date(
    dateString
  ).toLocaleTimeString(
    undefined,
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  );
}

function formatVoiceDuration(
  milliseconds:
    number | null
) {
  const totalSeconds =
    Math.max(
      0,
      Math.round(
        (
          milliseconds ??
          0
        ) / 1000
      )
    );

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    totalSeconds % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(
      2,
      '0'
    )}`;
}

function base64ToArrayBuffer(
  base64: string
) {
  const binary =
    globalThis.atob(
      base64
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index <
    binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      );
  }

  return bytes.buffer;
}

type ActiveVoicePlayback = {
  messageId: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  setRate: (rate: number) => void;
};

function VoicePlayer({
  url,
  durationMs,
  mine,
  messageId,
  onPlaybackState,
  onBeforePlay,
  activeMessageId,
  selectionMode,
  onLongSelect,
}: {
  url: string;
  durationMs:
    number | null;
  mine: boolean;
  messageId: string;
  onPlaybackState: (
    state:
      ActiveVoicePlayback
  ) => void;
  onBeforePlay: (
    messageId: string
  ) => void;
  activeMessageId:
    string | null;
  selectionMode: boolean;
  onLongSelect: () => void;
}) {
  const player =
    useAudioPlayer(
      url,
      {
        updateInterval:
          100,
      }
    );

  const status =
    useAudioPlayerStatus(
      player
    );

  const progress =
    status.duration >
    0
      ? Math.min(
          1,
          status.currentTime /
            status.duration
        )
      : 0;

  const [
    playbackRate,
    setPlaybackRate,
  ] =
    useState(1);

  const [
    waveformWidth,
    setWaveformWidth,
  ] =
    useState(1);

  const togglePlayback =
    () => {
      if (
        status.playing
      ) {
        player.pause();
      } else {
        onBeforePlay(
          messageId
        );

        if (
          status.currentTime >=
            status.duration &&
          status.duration >
            0
        ) {
          player.seekTo(0);
        }

        player.play();
      }
    };

  const seekVoice =
    (seconds: number) => {
      player.seekTo(
        Math.max(
          0,
          Math.min(
            seconds,
            status.duration ||
              seconds
          )
        )
      );
    };

  const changeRate =
    (rate: number) => {
      setPlaybackRate(rate);
      player.setPlaybackRate(
        rate
      );
    };

  useEffect(
    () => {
      if (
        status.playing ||
        status.currentTime >
          0
      ) {
        onPlaybackState({
          messageId,
          currentTime:
            status.currentTime,
          duration:
            status.duration ||
            (
              durationMs ??
              0
            ) /
              1000,
          playing:
            status.playing,
          rate:
            playbackRate,
          toggle:
            togglePlayback,
          seekTo:
            seekVoice,
          setRate:
            changeRate,
        });
      }
    },
    [
      status.currentTime,
      status.duration,
      status.playing,
      playbackRate,
    ]
  );

  useEffect(
    () => {
      if (
        activeMessageId !==
          messageId &&
        status.playing
      ) {
        try {
          player.pause();
        } catch (
          error
        ) {
          console.warn(
            'PAUSE PREVIOUS VOICE ERROR:',
            error
          );
        }
      }
    },
    [
      activeMessageId,
      messageId,
      status.playing,
    ]
  );

  return (
    <View
      style={
        styles.voiceRow
      }
    >
      <Pressable
        style={[
          styles.voicePlayButton,
          mine &&
            styles.voicePlayButtonMine,
        ]}
        delayLongPress={140}
        onLongPress={
          onLongSelect
        }
        onPress={() => {
          if (
            selectionMode
          ) {
            return;
          }

          togglePlayback();
        }}
      >
        <MaterialIcons
          name={
            status.playing
              ? 'pause'
              : 'play-arrow'
          }
          size={20}
          color={
            DropColors.warmWhite
          }
        />
      </Pressable>

      <View
        style={
          styles.voiceBars
        }
        onLayout={(
          event
        ) =>
          setWaveformWidth(
            Math.max(
              1,
              event.nativeEvent.layout.width
            )
          )
        }
        onStartShouldSetResponder={() =>
          !selectionMode
        }
        onStartShouldSetResponderCapture={() =>
          !selectionMode
        }
        onMoveShouldSetResponder={() =>
          !selectionMode
        }
        onMoveShouldSetResponderCapture={() =>
          !selectionMode
        }
        onResponderTerminationRequest={() =>
          false
        }
        onResponderGrant={(
          event
        ) => {
          if (
            !selectionMode &&
            status.duration >
              0
          ) {
            const ratio =
              Math.max(
                0,
                Math.min(
                  1,
                  event.nativeEvent.locationX /
                    waveformWidth
                )
              );

            seekVoice(
              ratio *
                status.duration
            );
          }
        }}
        onResponderMove={(
          event
        ) => {
          if (
            !selectionMode &&
            status.duration >
              0
          ) {
            const ratio =
              Math.max(
                0,
                Math.min(
                  1,
                  event.nativeEvent.locationX /
                    waveformWidth
                )
              );

            seekVoice(
              ratio *
                status.duration
            );
          }
        }}
      >
        {Array.from({
          length: 28,
        }).map(
          (
            _,
            index
          ) => {
            const active =
              index /
                27 <=
              progress;

            return (
              <View
                key={
                  index
                }
                style={[
                  styles.voiceBar,
                  {
                    height:
                      6 +
                      (
                        (
                          index *
                          7
                        ) %
                        14
                      ),
                    opacity:
                      active
                        ? 1
                        : 0.38,
                  },
                ]}
              />
            );
          }
        )}
      </View>

      <Text
        style={
          styles.voiceDuration
        }
      >
        {formatVoiceDuration(
          durationMs
        )}
      </Text>
    </View>
  );
}

function VideoPreview({
  url,
  onOpen,
}: {
  url: string;
  onOpen: () => void;
}) {
  const player =
    useVideoPlayer(
      url,
      (
        instance
      ) => {
        try {
          instance.pause();
        } catch {
          // Preview stays paused.
        }
      }
    );

  return (
    <Pressable
      onPress={
        onOpen
      }
      style={
        styles.videoPreview
      }
    >
      <View
        pointerEvents="none"
        style={
          StyleSheet.absoluteFillObject
        }
      >
        <VideoView
          player={
            player
          }
          style={
            StyleSheet.absoluteFillObject
          }
          nativeControls={
            false
          }
          allowsFullscreen={
            false
          }
          contentFit="contain"
        />
      </View>

      <View
        pointerEvents="none"
        style={
          styles.videoPreviewPlay
        }
      >
        <MaterialIcons
          name="play-arrow"
          size={34}
          color={
            DropColors.warmWhite
          }
        />
      </View>
    </Pressable>
  );
}

function FullscreenVideo({
  url,
}: {
  url: string;
}) {
  const player =
    useVideoPlayer(
      url,
      (
        instance
      ) => {
        try {
          instance.play();
        } catch (
          error
        ) {
          console.warn(
            'VIDEO AUTOPLAY ERROR:',
            error
          );
        }
      }
    );

  useEffect(
    () => {
      return () => {
        try {
          player.pause();
        } catch {
          // Player can already be released while modal closes.
        }
      };
    },
    [
      player,
    ]
  );

  return (
    <VideoView
      player={
        player
      }
      style={
        styles.fullscreenVideo
      }
      nativeControls
      allowsFullscreen={
        false
      }
      contentFit="contain"
    />
  );
}

function SwipeMessage({
  children,
  onReply,
  disabled,
}: {
  children:
    React.ReactNode;
  onReply: () => void;
  disabled?: boolean;
}) {
  const translateX =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const triggered =
    useRef(false);

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _,
            gesture
          ) =>
            !disabled &&
            gesture.dx >
              1 &&
            Math.abs(
              gesture.dx
            ) >
              Math.abs(
                gesture.dy
              ) *
                1.05,

          onPanResponderMove: (
            _,
            gesture
          ) => {
            const value =
              Math.max(
                0,
                Math.min(
                  58,
                  gesture.dx
                )
              );

            translateX.setValue(
              value
            );

            if (
              value >=
                12 &&
              !triggered.current
            ) {
              triggered.current =
                true;
            }
          },

          onPanResponderRelease:
            (
              _,
              gesture
            ) => {
              if (
                gesture.dx >=
                12
              ) {
                onReply();
              }

              triggered.current =
                false;

              Animated.spring(
                translateX,
                {
                  toValue: 0,
                  useNativeDriver:
                    true,
                }
              ).start();
            },

          onPanResponderTerminate:
            () => {
              triggered.current =
                false;

              Animated.spring(
                translateX,
                {
                  toValue: 0,
                  useNativeDriver:
                    true,
                }
              ).start();
            },
        }),
      [
        disabled,
        onReply,
        translateX,
      ]
    );

  return (
    <View
      style={
        styles.swipeContainer
      }
    >
      <Animated.View
        style={[
          styles.replyReveal,
          {
            opacity:
              translateX.interpolate({
                inputRange: [
                  0,
                  8,
                  24,
                ],
                outputRange: [
                  0,
                  0.35,
                  1,
                ],
                extrapolate:
                  'clamp',
              }),
          },
        ]}
      >
        <MaterialIcons
          name="reply"
          size={20}
          color={
            DropColors.wine
          }
        />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [
            {
              translateX,
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}


type ChatCache = {
  conversation: Conversation | null;
  currentUserId: string | null;
  profiles: Profile[];
  messages: Message[];
  events: ConversationEvent[];
  hiddenMessageIds: string[];
  imageAspectRatios: Record<string, number>;
};

export default function ChatScreen() {
  const {
    id,
  } =
    useLocalSearchParams<{
      id: string;
    }>();

  const cacheKey =
    id
      ? `chat:${id}`
      : '';

  const cached =
    cacheKey
      ? getScreenCache<ChatCache>(
          cacheKey
        )
      : null;

  const loadChatInFlightRef =
    useRef(false);

  const scrollRef =
    useRef<ScrollView>(
      null
    );

  const [
    text,
    setText,
  ] =
    useState('');

  const [
    conversation,
    setConversation,
  ] =
    useState<Conversation | null>(
      cached?.conversation ?? null
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(
      cached?.currentUserId ?? null
    );

  const [
    profiles,
    setProfiles,
  ] =
    useState<
      Profile[]
    >(
      cached?.profiles ?? []
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      Message[]
    >(
      cached?.messages ?? []
    );

  const [
    events,
    setEvents,
  ] =
    useState<
      ConversationEvent[]
    >(
      cached?.events ?? []
    );

  const [
    hiddenMessageIds,
    setHiddenMessageIds,
  ] =
    useState<
      Set<string>
    >(
      new Set(
        cached?.hiddenMessageIds ?? []
      )
    );

  const [
    replyingTo,
    setReplyingTo,
  ] =
    useState<
      Message | null
    >(null);

  const [
    pendingImage,
    setPendingImage,
  ] =
    useState<
      PendingImage | null
    >(null);

  const [
    pendingVideo,
    setPendingVideo,
  ] =
    useState<
      PendingVideo | null
    >(null);

  const [
    photoEditorSource,
    setPhotoEditorSource,
  ] =
    useState<
      EditorSource | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(!cached);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    otherUserLastReadAt,
    setOtherUserLastReadAt,
  ] =
    useState<
      string | null
    >(null);

  const [
    selectedMessageIds,
    setSelectedMessageIds,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    selectionMode,
    setSelectionMode,
  ] =
    useState(false);

  const [
    deleteModalVisible,
    setDeleteModalVisible,
  ] =
    useState(false);

  const [
    deleteForEveryone,
    setDeleteForEveryone,
  ] =
    useState(false);

  const [
    activeMessageMenuId,
    setActiveMessageMenuId,
  ] =
    useState<
      string | null
    >(null);

  const [
    photoViewerUrl,
    setPhotoViewerUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    videoViewerUrl,
    setVideoViewerUrl,
  ] =
    useState<
      string | null
    >(null);

  useEffect(
    () => {
      if (
        !videoViewerUrl
      ) {
        return;
      }

      ScreenOrientation.unlockAsync()
        .catch(
          (
            error
          ) => {
            console.warn(
              'VIDEO ORIENTATION UNLOCK ERROR:',
              error
            );
          }
        );

      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(
          (
            error
          ) => {
            console.warn(
              'VIDEO ORIENTATION RESTORE ERROR:',
              error
            );
          }
        );
      };
    },
    [
      videoViewerUrl,
    ]
  );

  const [
    photoViewerAspectRatio,
    setPhotoViewerAspectRatio,
  ] =
    useState(1);

  const [
    imageAspectRatios,
    setImageAspectRatios,
  ] =
    useState<
      Record<
        string,
        number
      >
    >(
      cached?.imageAspectRatios ?? {}
    );

  useEffect(
    () => {
      if (!id) {
        return;
      }

      patchScreenCache<ChatCache>(
        `chat:${id}`,
        {
          imageAspectRatios,
        }
      );
    },
    [
      id,
      imageAspectRatios,
    ]
  );


  useEffect(
    () => {
      const imageUrls =
        messages
          .filter(
            (message) =>
              message.message_type ===
                'image' &&
              !!message.media_path &&
              !message.deleted_for_everyone_at
          )
          .slice(-16)
          .map(
            (message) =>
              supabase.storage
                .from(
                  'message-images'
                )
                .getPublicUrl(
                  message.media_path as string
                ).data.publicUrl
          );

      if (
        imageUrls.length >
        0
      ) {
        void ExpoImage.prefetch(
          imageUrls,
          'memory-disk'
        );
      }
    },
    [
      messages,
    ]
  );

  const pendingImageRatiosRef =
    useRef<
      Record<
        string,
        number
      >
    >({});

  const imageRatioFlushTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const queueImageAspectRatio =
    (
      messageId: string,
      ratio: number
    ) => {
      pendingImageRatiosRef.current[
        messageId
      ] = ratio;

      if (
        imageRatioFlushTimerRef.current
      ) {
        return;
      }

      imageRatioFlushTimerRef.current =
        setTimeout(
          () => {
            imageRatioFlushTimerRef.current =
              null;

            const pending = {
              ...pendingImageRatiosRef.current,
            };

            pendingImageRatiosRef.current =
              {};

            setImageAspectRatios(
              (
                current
              ) => {
                let changed =
                  false;

                const next = {
                  ...current,
                };

                Object.entries(
                  pending
                ).forEach(
                  ([
                    key,
                    nextRatio,
                  ]) => {
                    const currentRatio =
                      current[
                        key
                      ];

                    if (
                      currentRatio &&
                      Math.abs(
                        currentRatio -
                          nextRatio
                      ) <
                        0.001
                    ) {
                      return;
                    }

                    next[
                      key
                    ] =
                      nextRatio;
                    changed =
                      true;
                  }
                );

                if (
                  !changed
                ) {
                  return current;
                }

                if (id) {
                  patchScreenCache<ChatCache>(
                    `chat:${id}`,
                    {
                      imageAspectRatios:
                        next,
                    }
                  );
                }

                return next;
              }
            );
          },
          24
        );
    };

  useEffect(
    () => {
      return () => {
        if (
          imageRatioFlushTimerRef.current
        ) {
          clearTimeout(
            imageRatioFlushTimerRef.current
          );
        }
      };
    },
    []
  );

  const messageBubbleRefs =
    useRef<
      Record<
        string,
        View | null
      >
    >({});

  const [
    messageMenuAnchor,
    setMessageMenuAnchor,
  ] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [
    messageMenuSize,
    setMessageMenuSize,
  ] = useState({
    width: 230,
    height: 0,
  });

  const [
    editingMessageId,
    setEditingMessageId,
  ] =
    useState<
      string | null
    >(null);

  const [
    recordingLocked,
    setRecordingLocked,
  ] =
    useState(false);

  const [
    activeVoice,
    setActiveVoice,
  ] =
    useState<
      ActiveVoicePlayback | null
    >(null);

  const [
    activeVoiceId,
    setActiveVoiceId,
  ] =
    useState<
      string | null
    >(null);

  const activateVoiceBeforePlay =
    (
      nextMessageId: string
    ) => {
      if (
        activeVoiceId !==
          nextMessageId
      ) {
        setActiveVoice(
          null
        );
        setActiveVoiceId(
          nextMessageId
        );
      }
    };

  const recordHoldTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const recordingStartedRef =
    useRef(false);

  const recordingLockedRef =
    useRef(false);

  const recordStartYRef =
    useRef<number | null>(
      null
    );

  const audioRecorder =
    useAudioRecorder(
      RecordingPresets.HIGH_QUALITY
    );

  const recorderState =
    useAudioRecorderState(
      audioRecorder,
      250
    );

  useEffect(
    () => {
      loadChat();
    },
    [
      id,
    ]
  );

  useEffect(
    () => {
      if (
        !conversation?.id ||
        !currentUserId
      ) {
        return;
      }

      const messageChannel =
        supabase
          .channel(
            `messages-v2-${conversation.id}`
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema:
                'public',
              table:
                'messages',
              filter:
                `conversation_id=eq.${conversation.id}`,
            },
            () => {
              loadMessages(
                conversation.id
              );

              markConversationRead(
                conversation.id,
                currentUserId
              );
            }
          )
          .subscribe();

      const eventChannel =
        supabase
          .channel(
            `events-v2-${conversation.id}`
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema:
                'public',
              table:
                'conversation_events',
              filter:
                `conversation_id=eq.${conversation.id}`,
            },
            () => {
              loadEvents(
                conversation.id
              );
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          messageChannel
        );

        supabase.removeChannel(
          eventChannel
        );
      };
    },
    [
      conversation?.id,
      currentUserId,
    ]
  );

  useEffect(
    () => {
      if (
        messages.length >
        0
      ) {
        scrollToBottom(
          false
        );
      }
    },
    [
      messages.length,
    ]
  );


  useEffect(
    () => {
      if (
        !conversation?.id ||
        conversation.conversation_type !==
          'direct' ||
        !currentUserId
      ) {
        return;
      }

      const otherUserId =
        conversation.author_id ===
        currentUserId
          ? conversation.participant_id
          : conversation.author_id;

      if (!otherUserId) {
        return;
      }

      const loadReadState =
        async () => {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                'conversation_members'
              )
              .select(
                'last_read_at'
              )
              .eq(
                'conversation_id',
                conversation.id
              )
              .eq(
                'user_id',
                otherUserId
              )
              .maybeSingle();

          if (error) {
            console.error(
              'LOAD OTHER MEMBER READ ERROR:',
              error
            );
            return;
          }

          setOtherUserLastReadAt(
            data?.last_read_at ??
              null
          );
        };

      loadReadState();

      const channel =
        supabase
          .channel(
            `member-read-${conversation.id}-${otherUserId}`
          )
          .on(
            'postgres_changes',
            {
              event:
                'UPDATE',
              schema:
                'public',
              table:
                'conversation_members',
              filter:
                `conversation_id=eq.${conversation.id}`,
            },
            (
              payload
            ) => {
              const row =
                payload.new as {
                  user_id?: string;
                  last_read_at?: string | null;
                };

              if (
                row.user_id !==
                otherUserId
              ) {
                return;
              }

              setOtherUserLastReadAt(
                row.last_read_at ??
                  null
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
      conversation?.id,
      conversation?.conversation_type,
      conversation?.author_id,
      conversation?.participant_id,
      currentUserId,
    ]
  );


  const conversationProfiles =
    useMemo(
      () => {
        if (
          !currentUserId
        ) {
          return [];
        }

        return profiles.filter(
          (profile) =>
            profile.id !==
            currentUserId
        );
      },
      [
        profiles,
        currentUserId,
      ]
    );

  const directOtherUser =
    conversation
      ?.conversation_type ===
      'direct'
      ? conversationProfiles[0] ??
        null
      : null;

  const headerTitle =
    conversation
      ?.conversation_type ===
      'group'
      ? conversation.title ||
        conversationProfiles
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
          ) ||
        'Group'
      : directOtherUser
          ?.display_name ||
        directOtherUser
          ?.username ||
        'Messages';

  const headerSubtitle =
    conversation
      ?.conversation_type ===
      'group'
      ? `${profiles.length} members`
      : directOtherUser
          ?.username
        ? `@${directOtherUser.username}`
        : '';

  const timeline =
    useMemo<
      TimelineItem[]
    >(
      () => {
        const messageItems =
          messages
            .filter(
              (message) =>
                !hiddenMessageIds.has(
                  message.id
                ) &&
                !message.deleted_for_everyone_at
            )
            .map(
              (
                message
              ): TimelineItem => ({
                type:
                  'message',
                created_at:
                  message.created_at,
                data:
                  message,
              })
            );

        const eventItems =
          events.map(
            (
              event
            ): TimelineItem => ({
              type:
                'event',
              created_at:
                event.created_at,
              data:
                event,
            })
          );

        return [
          ...messageItems,
          ...eventItems,
        ].sort(
          (a, b) =>
            new Date(
              a.created_at
            ).getTime() -
            new Date(
              b.created_at
            ).getTime()
        );
      },
      [
        messages,
        events,
        hiddenMessageIds,
      ]
    );

  const messageMap =
    useMemo(
      () =>
        new Map(
          messages.map(
            (message) => [
              message.id,
              message,
            ]
          )
        ),
      [
        messages,
      ]
    );

  const activeMessageMenuMessage =
    activeMessageMenuId
      ? messageMap.get(
          activeMessageMenuId
        ) ?? null
      : null;

  const scrollToBottom =
    (
      animated = true
    ) => {
      setTimeout(
        () => {
          scrollRef.current?.scrollToEnd(
            {
              animated,
            }
          );
        },
        90
      );
    };

  const loadChat =
    async () => {
      if (
        !id ||
        loadChatInFlightRef.current
      ) {
        return;
      }

      loadChatInFlightRef.current =
        true;

      const existingCache =
        getScreenCache<ChatCache>(
          `chat:${id}`
        );

      if (!existingCache) {
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

        const user =
          session?.user ??
          null;

        if (!user) {
          return;
        }

        setCurrentUserId(
          user.id
        );

        patchScreenCache<ChatCache>(
          `chat:${id}`,
          {
            currentUserId:
              user.id,
          }
        );

        /*
         * Do not build the chat sequentially.
         * Conversation, membership, messages, events and hidden-message state
         * can all start at the same time because we already know the id.
         */
        const conversationPromise =
          supabase
            .from(
              'conversations'
            )
            .select(`
              id,
              author_id,
              participant_id,
              conversation_type,
              title
            `)
            .eq(
              'id',
              id
            )
            .maybeSingle();

        const membersPromise =
          supabase
            .from(
              'conversation_members'
            )
            .select(
              'user_id'
            )
            .eq(
              'conversation_id',
              id
            )
            .is(
              'left_at',
              null
            );

        const chatDataPromise =
          Promise.all([
            loadMessages(
              id
            ),
            loadEvents(
              id
            ),
            loadHiddenMessages(
              user.id
            ),
            markConversationRead(
              id,
              user.id
            ),
            markConversationNotificationsRead(
              id,
              user.id
            ),
          ]);

        const [
          conversationResult,
          membersResult,
        ] =
          await Promise.all([
            conversationPromise,
            membersPromise,
          ]);

        const {
          data:
            conversationData,
          error:
            conversationError,
        } =
          conversationResult;

        if (
          conversationError ||
          !conversationData
        ) {
          console.error(
            'LOAD CHAT CONVERSATION ERROR:',
            conversationError
          );
          return;
        }

        const {
          data:
            memberData,
          error:
            memberError,
        } =
          membersResult;

        if (
          memberError
        ) {
          console.error(
            'LOAD CHAT MEMBERS ERROR:',
            memberError
          );
          return;
        }

        const members =
          (
            memberData ??
            []
          ) as ConversationMember[];

        const isMember =
          members.some(
            (member) =>
              member.user_id ===
              user.id
          );

        if (
          !isMember
        ) {
          Alert.alert(
            'Chat unavailable',
            'You are not a member of this conversation.'
          );
          router.back();
          return;
        }

        const nextConversation =
          conversationData as Conversation;

        setConversation(
          nextConversation
        );

        patchScreenCache<ChatCache>(
          `chat:${id}`,
          {
            conversation:
              nextConversation,
          }
        );

        const memberIds =
          members.map(
            (member) =>
              member.user_id
          );

        if (
          memberIds.length >
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
              .select(`
                id,
                username,
                display_name,
                avatar_url
              `)
              .in(
                'id',
                memberIds
              );

          if (
            profileError
          ) {
            console.error(
              'LOAD CHAT PROFILES ERROR:',
              profileError
            );
          } else {
            const nextProfiles =
              (
                profileData ??
                []
              ) as Profile[];

            setProfiles(
              nextProfiles
            );

            patchScreenCache<ChatCache>(
              `chat:${id}`,
              {
                profiles:
                  nextProfiles,
              }
            );
          }
        }

        /*
         * Header + membership are enough to render the screen.
         * Messages/events continue resolving without keeping a first-open
         * fullscreen spinner on screen.
         */
        setLoading(
          false
        );

        await chatDataPromise;
      } finally {
        loadChatInFlightRef.current =
          false;

        setLoading(
          false
        );
      }
    };

  const loadMessages =
    async (
      conversationId: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'messages'
          )
          .select(`
            id,
            conversation_id,
            sender_id,
            text,
            message_type,
            media_path,
            voice_duration_ms,
            reply_to_message_id,
            deleted_for_everyone_at,
            edited_at,
            created_at
          `)
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          );

      if (
        error
      ) {
        console.error(
          'LOAD MESSAGES V2 ERROR:',
          error
        );
        return;
      }

      const loadedMessages =
        (
          data ??
          []
        ) as Message[];

      /*
       * Render text/history immediately.
       * Image.getSize used to block the entire initial chat load until every
       * remote image had reported its dimensions. In a group chat this could
       * add several seconds.
       */
      setMessages(
        loadedMessages
      );

      if (id) {
        patchScreenCache<ChatCache>(
          `chat:${id}`,
          {
            messages:
              loadedMessages,
          }
        );
      }

      /*
       * Do not probe remote image dimensions here.
       *
       * React Native Image.getSize() performs its own remote request/cache
       * path. With several photos in a group chat that means the same media
       * can be requested once by getSize and again by expo-image.
       * expo-image onLoad is now the single source of image dimensions.
       */
    };

  const loadEvents =
    async (
      conversationId: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'conversation_events'
          )
          .select(`
            id,
            conversation_id,
            actor_id,
            drop_id,
            event_type,
            drop_text_snapshot,
            created_at
          `)
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          );

      if (
        error
      ) {
        console.error(
          'LOAD EVENTS V2 ERROR:',
          error
        );
        return;
      }

      const nextEvents =
        (
          data ??
          []
        ) as ConversationEvent[];

      setEvents(
        nextEvents
      );

      if (id) {
        patchScreenCache<ChatCache>(
          `chat:${id}`,
          {
            events:
              nextEvents,
          }
        );
      }
    };

  const loadHiddenMessages =
    async (
      userId: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'message_hidden_for'
          )
          .select(
            'message_id'
          )
          .eq(
            'user_id',
            userId
          );

      if (
        error
      ) {
        console.error(
          'LOAD HIDDEN MESSAGES ERROR:',
          error
        );
        return;
      }

      const nextHiddenIds =
        (
          data ??
          []
        ).map(
          (row) =>
            row.message_id
        );

      setHiddenMessageIds(
        new Set(
          nextHiddenIds
        )
      );

      if (id) {
        patchScreenCache<ChatCache>(
          `chat:${id}`,
          {
            hiddenMessageIds:
              nextHiddenIds,
          }
        );
      }
    };

      const markConversationRead =
    async (
      conversationId: string,
      userId?: string
    ) => {
      const effectiveUserId =
        userId ??
        currentUserId;

      if (!effectiveUserId) {
        return;
      }

      const {
        error,
      } =
        await supabase
          .from(
            'conversation_members'
          )
          .update({
            last_read_at:
              new Date().toISOString(),
          })
          .eq(
            'conversation_id',
            conversationId
          )
          .eq(
            'user_id',
            effectiveUserId
          );

      if (error) {
        console.error(
          'MARK MEMBER READ ERROR:',
          error
        );
      }
    };

  const markConversationNotificationsRead =
    async (
      conversationId: string,
      userId: string
    ) => {
      await supabase
        .from(
          'notifications'
        )
        .update({
          read_at:
            new Date().toISOString(),
        })
        .eq(
          'user_id',
          userId
        )
        .eq(
          'conversation_id',
          conversationId
        )
        .is(
          'read_at',
          null
        );
    };

  const uploadArrayBuffer =
    async ({
      bucket,
      path,
      arrayBuffer,
      contentType,
    }: {
      bucket: string;
      path: string;
      arrayBuffer: ArrayBuffer;
      contentType: string;
    }) => {
      const {
        error,
      } =
        await supabase.storage
          .from(
            bucket
          )
          .upload(
            path,
            arrayBuffer,
            {
              contentType,
              upsert:
                false,
            }
          );

      if (
        error
      ) {
        throw error;
      }

      return path;
    };

  const handlePickMedia =
    async () => {
      if (
        sending ||
        recorderState.isRecording ||
        editingMessageId
      ) {
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Media access required',
          'Allow access to your photo and video library.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [
            'images',
            'videos',
          ],
          allowsEditing:
            false,
          quality:
            1,
          base64:
            false,
        });

      if (
        result.canceled
      ) {
        return;
      }

      const asset =
        result.assets[0];

      if (
        !asset?.uri
      ) {
        return;
      }

      const isVideo =
        asset.type ===
          'video' ||
        asset.mimeType
          ?.toLowerCase()
          .startsWith(
            'video/'
          );

      if (
        isVideo
      ) {
        const file =
          new File(
            asset.uri
          );

        const fileSize =
          asset.fileSize ??
          file.size ??
          0;

        const maxBytes =
          50 *
          1024 *
          1024;

        if (
          fileSize >
          maxBytes
        ) {
          Alert.alert(
            'Video is too large',
            'Choose a video up to 50 MB.'
          );
          return;
        }

        setPendingImage(
          null
        );

        setPhotoEditorSource(
          null
        );

        setPendingVideo({
          uri:
            asset.uri,
          mimeType:
            asset.mimeType ??
            file.type ??
            'video/mp4',
          fileName:
            asset.fileName ??
            `video-${Date.now()}.mp4`,
          fileSize,
        });

        return;
      }

      setPendingVideo(
        null
      );

      setPhotoEditorSource({
        uri:
          asset.uri,
        width:
          asset.width ||
          1,
        height:
          asset.height ||
          1,
      });
    };

  const openMessageMenu =
    (
      message: Message
    ) => {
      if (
        message.deleted_for_everyone_at
      ) {
        return;
      }

      const bubble =
        messageBubbleRefs.current[
          message.id
        ];

      if (!bubble) {
        return;
      }

      bubble.measureInWindow(
        (
          x,
          y,
          width,
          height
        ) => {
          setMessageMenuAnchor({
            x,
            y,
            width,
            height,
          });
          setActiveMessageMenuId(
            message.id
          );
        }
      );
    };

  const handleMessageReply =
    (
      message: Message
    ) => {
      setReplyingTo(
        message
      );
      setPendingImage(
        null
      );
      setPendingVideo(
        null
      );
      setEditingMessageId(
        null
      );
      setActiveMessageMenuId(
        null
      );
    };

  const handleMessageCopy =
    async (
      message: Message
    ) => {
      if (
        !message.text
      ) {
        return;
      }

      await Clipboard.setStringAsync(
        message.text
      );

      setActiveMessageMenuId(
        null
      );
    };

  const handleMessageEdit =
    (
      message: Message
    ) => {
      if (
        message.sender_id !==
          currentUserId ||
        message.message_type !==
          'text' ||
        !message.text
      ) {
        return;
      }

      setEditingMessageId(
        message.id
      );
      setText(
        message.text
      );
      setReplyingTo(
        null
      );
      setPendingImage(
        null
      );
      setPendingVideo(
        null
      );
      setActiveMessageMenuId(
        null
      );
    };

  const handleMessageDelete =
    (
      message: Message
    ) => {
      setSelectedMessageIds(
        new Set([
          message.id,
        ])
      );
      setDeleteForEveryone(
        false
      );
      setSelectionMode(
        false
      );
      setActiveMessageMenuId(
        null
      );
      setDeleteModalVisible(
        true
      );
    };

  const handleMessageSelect =
    (
      message: Message
    ) => {
      setActiveMessageMenuId(
        null
      );
      setSelectedMessageIds(
        new Set([
          message.id,
        ])
      );
      setSelectionMode(
        true
      );
    };

  const saveEditedMessage =
    async () => {
      if (
        !editingMessageId ||
        !currentUserId ||
        !conversation
      ) {
        return false;
      }

      const trimmed =
        text.trim();

      if (
        !trimmed
      ) {
        return false;
      }

      const {
        error,
      } =
        await supabase.rpc(
          'edit_own_message',
          {
            target_message_id:
              editingMessageId,
            new_text:
              trimmed,
          }
        );

      if (
        error
      ) {
        console.error(
          'EDIT MESSAGE ERROR:',
          error
        );

        Alert.alert(
          'Error',
          error.message
        );

        return false;
      }

      setEditingMessageId(
        null
      );
      setText('');

      await loadMessages(
        conversation.id
      );

      return true;
    };

  const insertMessage =
    async ({
      messageType,
      mediaPath = null,
      voiceDurationMs = null,
    }: {
      messageType: MessageType;
      mediaPath?: string | null;
      voiceDurationMs?: number | null;
    }) => {
      if (
        !conversation ||
        !currentUserId
      ) {
        return false;
      }

      const trimmed =
        text.trim();

      const {
        error,
      } =
        await supabase
          .from(
            'messages'
          )
          .insert({
            conversation_id:
              conversation.id,
            sender_id:
              currentUserId,
            text:
              trimmed,
            message_type:
              messageType,
            media_path:
              mediaPath,
            voice_duration_ms:
              voiceDurationMs,
            reply_to_message_id:
              replyingTo?.id ??
              null,
          });

      if (
        error
      ) {
        console.error(
          'SEND MESSAGE V2 ERROR:',
          error
        );

        Alert.alert(
          'Error',
          error.message
        );
        return false;
      }

      setText('');
      setReplyingTo(
        null
      );

      await markConversationRead(
        conversation.id
      );

      return true;
    };

  const handleSend =
    async () => {
      if (
        sending ||
        !conversation ||
        !currentUserId
      ) {
        return;
      }

      if (
        !text.trim() &&
        !pendingImage &&
        !pendingVideo
      ) {
        return;
      }

      try {
        setSending(
          true
        );

        if (
          editingMessageId
        ) {
          await saveEditedMessage();
          return;
        }

        if (
          pendingVideo
        ) {
          const file =
            new File(
              pendingVideo.uri
            );

          const arrayBuffer =
            await file.arrayBuffer();

          const extension =
            (
              file.extension ||
              '.mp4'
            ).replace(
              '.',
              ''
            );

          const path =
            `${currentUserId}/${conversation.id}/${Date.now()}.${extension}`;

          await uploadArrayBuffer({
            bucket:
              'message-videos',
            path,
            arrayBuffer,
            contentType:
              pendingVideo.mimeType,
          });

          const success =
            await insertMessage({
              messageType:
                'video',
              mediaPath:
                path,
            });

          if (
            success
          ) {
            setPendingVideo(
              null
            );
          }

          return;
        }

        if (
          pendingImage
        ) {
          const extension =
            pendingImage.mimeType ===
            'image/png'
              ? 'png'
              : pendingImage.mimeType ===
                  'image/webp'
                ? 'webp'
                : 'jpg';

          const path =
            `${currentUserId}/${conversation.id}/${Date.now()}.${extension}`;

          await uploadArrayBuffer({
            bucket:
              'message-images',
            path,
            arrayBuffer:
              await new File(
                pendingImage.uri
              ).arrayBuffer(),
            contentType:
              pendingImage.mimeType,
          });

          const success =
            await insertMessage({
              messageType:
                'image',
              mediaPath:
                path,
            });

          if (
            success
          ) {
            setPendingImage(
              null
            );
          }

          return;
        }

        await insertMessage({
          messageType:
            'text',
        });
      } finally {
        setSending(
          false
        );
      }
    };

  const startRecording =
    async () => {
      if (
        !currentUserId ||
        !conversation
      ) {
        return;
      }

      try {
        const permission =
          await AudioModule.requestRecordingPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            'Microphone access required',
            'Allow microphone access to record voice messages.'
          );
          return;
        }

        await setAudioModeAsync({
          allowsRecording:
            true,
          playsInSilentMode:
            true,
        });

        await audioRecorder.prepareToRecordAsync();

        audioRecorder.record();

        recordingStartedRef.current =
          true;
      } catch (
        error
      ) {
        console.error(
          'START RECORDING ERROR:',
          error
        );

        Alert.alert(
          'Recording error',
          'Could not start recording.'
        );
      }
    };

  const stopAndSendRecording =
    async () => {
      if (
        !currentUserId ||
        !conversation ||
        !recorderState.isRecording
      ) {
        return;
      }

      try {
        setSending(
          true
        );

        const durationMs =
          recorderState.durationMillis;

        await audioRecorder.stop();

        const uri =
          audioRecorder.uri;

        if (!uri) {
          throw new Error(
            'Recording URI is missing.'
          );
        }

        const file =
          new File(
            uri
          );

        const arrayBuffer =
          await file.arrayBuffer();

        const extension =
          file.extension ||
          '.m4a';

        const path =
          `${currentUserId}/${conversation.id}/${Date.now()}${extension}`;

        await uploadArrayBuffer({
          bucket:
            'message-voice',
          path,
          arrayBuffer,
          contentType:
            file.type ||
            'audio/mp4',
        });

        await insertMessage({
          messageType:
            'voice',
          mediaPath:
            path,
          voiceDurationMs:
            durationMs,
        });

        await setAudioModeAsync({
          allowsRecording:
            false,
          playsInSilentMode:
            true,
        });
      } catch (
        error
      ) {
        console.error(
          'STOP RECORDING ERROR:',
          error
        );

        Alert.alert(
          'Recording error',
          'Could not send this voice message.'
        );
      } finally {
        recordingStartedRef.current =
          false;
        recordingLockedRef.current =
          false;
        recordStartYRef.current =
          null;
        setRecordingLocked(
          false
        );
        setSending(
          false
        );
      }
    };

  const beginRecordHold =
    (
      pageY: number
    ) => {
      if (
        sending ||
        text.trim() ||
        pendingImage ||
        pendingVideo
      ) {
        return;
      }

      recordingLockedRef.current =
        false;
      recordStartYRef.current =
        pageY;
      setRecordingLocked(
        false
      );

      recordHoldTimer.current =
        setTimeout(
          () => {
            startRecording();
          },
          180
        );
    };

  const moveRecordHold =
    (
      pageY: number
    ) => {
      if (
        !recordingStartedRef.current ||
        recordingLockedRef.current
      ) {
        return;
      }

      const startY =
        recordStartYRef.current;

      if (
        startY !==
          null &&
        pageY -
          startY <=
          -54
      ) {
        recordingLockedRef.current =
          true;
        setRecordingLocked(
          true
        );
      }
    };

  const endRecordHold =
    async () => {
      if (
        recordHoldTimer.current
      ) {
        clearTimeout(
          recordHoldTimer.current
        );
        recordHoldTimer.current =
          null;
      }

      if (
        !recordingStartedRef.current
      ) {
        recordStartYRef.current =
          null;
        return;
      }

      if (
        recordingLockedRef.current
      ) {
        return;
      }

      await stopAndSendRecording();
    };

  const hideMessagesForMe =
    async (
      targetMessages:
        Message[]
    ) => {
      if (
        !currentUserId ||
        targetMessages.length ===
          0
      ) {
        return;
      }

      const rows =
        targetMessages.map(
          (message) => ({
            message_id:
              message.id,
            user_id:
              currentUserId,
          })
        );

      const {
        error,
      } =
        await supabase
          .from(
            'message_hidden_for'
          )
          .upsert(
            rows,
            {
              onConflict:
                'message_id,user_id',
            }
          );

      if (
        error
      ) {
        Alert.alert(
          'Error',
          'Could not delete the selected messages.'
        );
        return;
      }

      setHiddenMessageIds(
        (current) => {
          const next =
            new Set(
              current
            );

          targetMessages.forEach(
            (message) =>
              next.add(
                message.id
              )
          );

          return next;
        }
      );
    };

  const deleteMessagesForEveryone =
    async (
      targetMessages:
        Message[]
    ) => {
      for (
        const message of
        targetMessages
      ) {
        const {
          error,
        } =
          await supabase.rpc(
            'delete_message_for_everyone',
            {
              target_message_id:
                message.id,
            }
          );

        if (
          error
        ) {
          Alert.alert(
            'Error',
            error.message
          );
          return false;
        }

        if (
          message.media_path &&
          message.sender_id ===
            currentUserId
        ) {
          const bucket =
            message.message_type ===
            'voice'
              ? 'message-voice'
              : message.message_type ===
                  'video'
                ? 'message-videos'
                : 'message-images';

          await supabase.storage
            .from(
              bucket
            )
            .remove([
              message.media_path,
            ]);
        }
      }

      if (
        conversation
      ) {
        await loadMessages(
          conversation.id
        );
      }

      return true;
    };

  const toggleMessageSelection =
    (
      messageId: string
    ) => {
      setSelectedMessageIds(
        (current) => {
          const next =
            new Set(
              current
            );

          if (
            next.has(
              messageId
            )
          ) {
            next.delete(
              messageId
            );
          } else {
            next.add(
              messageId
            );
          }

          return next;
        }
      );
    };

  const clearMessageSelection =
    () => {
      setSelectedMessageIds(
        new Set()
      );
      setSelectionMode(
        false
      );
      setDeleteForEveryone(
        false
      );
      setDeleteModalVisible(
        false
      );
    };

  const confirmDelete =
    async () => {
      const targets =
        messages.filter(
          (message) =>
            selectedMessageIds.has(
              message.id
            )
        );

      if (
        targets.length ===
        0
      ) {
        clearMessageSelection();
        return;
      }

      setDeleteModalVisible(
        false
      );

      if (
        deleteForEveryone
      ) {
        const success =
          await deleteMessagesForEveryone(
            targets
          );

        if (
          !success
        ) {
          return;
        }
      } else {
        await hideMessagesForMe(
          targets
        );
      }

      clearMessageSelection();
    };

  const profileById =
    (
      userId: string
    ) =>
      profiles.find(
        (profile) =>
          profile.id ===
          userId
      ) ??
      null;

  const renderReplyPreview =
    (
      replyId:
        string | null
    ) => {
      if (
        !replyId
      ) {
        return null;
      }

      const original =
        messageMap.get(
          replyId
        );

      if (
        !original ||
        original.deleted_for_everyone_at
      ) {
        return (
          <View
            style={
              styles.replyQuote
            }
          >
            <Text
              style={
                styles.replyQuoteText
              }
            >
              Message unavailable
            </Text>
          </View>
        );
      }

      const sender =
        profileById(
          original.sender_id
        );

      const label =
        original.sender_id ===
        currentUserId
          ? 'You'
          : sender
              ?.display_name ||
            sender?.username ||
            'User';

      let preview =
        original.text;

      if (
        original.message_type ===
        'image'
      ) {
        preview =
          original.text ||
          'Photo';
      }

      if (
        original.message_type ===
        'voice'
      ) {
        preview =
          'Voice message';
      }

      if (
        original.message_type ===
        'video'
      ) {
        preview =
          original.text ||
          'Video';
      }

      return (
        <View
          style={
            styles.replyQuote
          }
        >
          <Text
            style={
              styles.replyQuoteName
            }
          >
            {label}
          </Text>

          <Text
            style={
              styles.replyQuoteText
            }
            numberOfLines={
              1
            }
          >
            {preview}
          </Text>
        </View>
      );
    };

  if (
    loading &&
    !conversation
  ) {
    return (
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
    );
  }

  const screen =
    Dimensions.get(
      'window'
    );

  const menuGap = 8;
  const menuMargin = 12;
  const menuWidth =
    messageMenuSize.width ||
    230;
  const menuHeight =
    messageMenuSize.height ||
    220;

  const menuLeft =
    messageMenuAnchor
      ? Math.min(
          Math.max(
            menuMargin,
            messageMenuAnchor.x
          ),
          screen.width -
            menuWidth -
            menuMargin
        )
      : menuMargin;

  const spaceBelow =
    messageMenuAnchor
      ? screen.height -
        (
          messageMenuAnchor.y +
          messageMenuAnchor.height
        )
      : 0;

  const menuTop =
    messageMenuAnchor
      ? spaceBelow >=
        menuHeight +
          menuGap +
          menuMargin
        ? messageMenuAnchor.y +
          messageMenuAnchor.height +
          menuGap
        : Math.max(
            menuMargin,
            messageMenuAnchor.y -
              menuHeight -
              menuGap
          )
      : menuMargin;


  const viewerMaxWidth =
    screen.width * 0.94;

  const viewerMaxHeight =
    screen.height * 0.82;

  let viewerImageWidth =
    viewerMaxWidth;

  let viewerImageHeight =
    viewerImageWidth /
    Math.max(
      photoViewerAspectRatio,
      0.01
    );

  if (
    viewerImageHeight >
    viewerMaxHeight
  ) {
    viewerImageHeight =
      viewerMaxHeight;
    viewerImageWidth =
      viewerImageHeight *
      Math.max(
        photoViewerAspectRatio,
        0.01
      );
  }

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
      keyboardVerticalOffset={
        Platform.OS ===
        'ios'
          ? 0
          : 0
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
        {selectionMode ? (
          <>
            <Pressable
              hitSlop={10}
              onPress={
                clearMessageSelection
              }
              style={
                styles.backButton
              }
            >
              <MaterialIcons
                name="close"
                size={24}
                color={
                  DropColors.warmWhite
                }
              />
            </Pressable>

            <Text
              style={
                styles.selectionCount
              }
            >
              {selectedMessageIds.size >
              0
                ? selectedMessageIds.size
                : 'Select'}
            </Text>

            <Pressable
              hitSlop={10}
              disabled={
                selectedMessageIds.size ===
                0
              }
              onPress={() =>
                setDeleteModalVisible(
                  true
                )
              }
              style={[
                styles.selectionTrash,
                selectedMessageIds.size ===
                  0 &&
                  styles.selectionTrashDisabled,
              ]}
            >
              <MaterialIcons
                name="delete-outline"
                size={23}
                color={
                  selectedMessageIds.size ===
                  0
                    ? DropColors.textMuted
                    : DropColors.warmWhite
                }
              />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              hitSlop={10}
              onPress={() =>
                router.back()
              }
              style={
                styles.backButton
              }
            >
          <MaterialIcons
            name="chevron-left"
            size={28}
            color={
              DropColors.warmWhite
            }
          />
        </Pressable>

        {conversation
          ?.conversation_type ===
        'direct' ? (
          <UserAvatar
            uri={
              directOtherUser
                ?.avatar_url ??
              null
            }
            name={
              headerTitle
            }
            size={38}
          />
        ) : (
          <View
            style={
              styles.groupHeaderAvatar
            }
          >
            <Text
              style={
                styles.groupHeaderAvatarText
              }
            >
              {headerTitle
                .slice(
                  0,
                  1
                )
                .toUpperCase()}
            </Text>
          </View>
        )}

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.headerTitle
            }
            numberOfLines={
              1
            }
          >
            {headerTitle}
          </Text>

          {!!headerSubtitle && (
            <Text
              style={
                styles.headerSubtitle
              }
              numberOfLines={
                1
              }
            >
              {headerSubtitle}
            </Text>
          )}
        </View>
          </>
        )}
      </View>

      {activeVoice && (
        <View
          style={
            styles.topVoicePlayer
          }
        >
          <Pressable
            onPress={
              activeVoice.toggle
            }
            hitSlop={8}
            style={
              styles.topVoicePlay
            }
          >
            <MaterialIcons
              name={
                activeVoice.playing
                  ? 'pause'
                  : 'play-arrow'
              }
              size={19}
              color={
                DropColors.warmWhite
              }
            />
          </Pressable>

          <Text
            style={
              styles.topVoiceTime
            }
          >
            {`${formatVoiceDuration(
              activeVoice.currentTime *
                1000
            )} / ${formatVoiceDuration(
              activeVoice.duration *
                1000
            )}`}
          </Text>

          <Pressable
            style={
              styles.topVoiceTrack
            }
            onPress={(
              event
            ) => {
              const width =
                event.nativeEvent
                  .locationX;
              const ratio =
                Math.max(
                  0,
                  Math.min(
                    1,
                    width /
                      180
                  )
                );
              activeVoice.seekTo(
                ratio *
                  activeVoice.duration
              );
            }}
          >
            <View
              style={[
                styles.topVoiceProgress,
                {
                  width:
                    `${Math.min(
                      100,
                      activeVoice.duration >
                      0
                        ? (
                            activeVoice.currentTime /
                            activeVoice.duration
                          ) *
                          100
                        : 0
                    )}%`,
                },
              ]}
            />
            <View
              style={[
                styles.topVoiceThumb,
                {
                  left:
                    `${Math.min(
                      96,
                      activeVoice.duration >
                      0
                        ? (
                            activeVoice.currentTime /
                            activeVoice.duration
                          ) *
                          100
                        : 0
                    )}%`,
                },
              ]}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              const rates =
                [
                  1,
                  1.5,
                  2,
                ];
              const index =
                rates.indexOf(
                  activeVoice.rate
                );
              activeVoice.setRate(
                rates[
                  (
                    index +
                    1
                  ) %
                    rates.length
                ]
              );
            }}
            style={
              styles.topVoiceSpeed
            }
          >
            <Text
              style={
                styles.topVoiceSpeedText
              }
            >
              {`${activeVoice.rate}x`}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={
          styles.chatBody
        }
        onPress={
          Keyboard.dismiss
        }
      >
        <ScrollView
          ref={
            scrollRef
          }
          style={
            styles.scroll
          }
          contentContainerStyle={
            styles.timeline
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="on-drag"
          onTouchStart={() => {
            Keyboard.dismiss();
          }}
          onContentSizeChange={() =>
            scrollToBottom(
              false
            )
          }
        >
          {timeline.map(
            (
              item
            ) => {
              if (
                item.type ===
                'event'
              ) {
                return (
                  <View
                    key={
                      `event-${item.data.id}`
                    }
                    style={
                      styles.event
                    }
                  >
                    <View
                      style={
                        styles.eventTitleRow
                      }
                    >
                      <View
                        style={
                          styles.eventLine
                        }
                      />

                      <Text
                        style={
                          styles.eventText
                        }
                      >
                        {item.data.event_type ===
                        'join'
                          ? 'Joined a Drop'
                          : 'Replied to a Drop'}
                      </Text>

                      <View
                        style={
                          styles.eventLine
                        }
                      />
                    </View>

                    {!!item.data
                      .drop_text_snapshot && (
                      <Text
                        style={
                          styles.eventSnapshot
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {
                          item.data
                            .drop_text_snapshot
                        }
                      </Text>
                    )}
                  </View>
                );
              }

              const message =
                item.data;

              const mine =
                message.sender_id ===
                currentUserId;

              const sender =
                profileById(
                  message.sender_id
                );

              const mediaUrl =
                message.media_path
                  ? supabase.storage
                      .from(
                        message.message_type ===
                        'voice'
                          ? 'message-voice'
                          : message.message_type ===
                              'video'
                            ? 'message-videos'
                            : 'message-images'
                      )
                      .getPublicUrl(
                        message.media_path
                      ).data.publicUrl
                  : null;

              const deleted =
                !!message.deleted_for_everyone_at;

              return (
                <SwipeMessage
                  key={
                    message.id
                  }
                  disabled={
                    deleted ||
                    selectionMode
                  }
                  onReply={() =>
                    handleMessageReply(
                      message
                    )
                  }
                >
                  <Pressable
                    onLongPress={() => {
                      if (
                        deleted
                      ) {
                        return;
                      }

                      if (
                        selectionMode
                      ) {
                        toggleMessageSelection(
                          message.id
                        );
                        return;
                      }

                      openMessageMenu(
                        message
                      );
                    }}
                    onPress={() => {
                      if (
                        deleted
                      ) {
                        return;
                      }

                      if (
                        selectionMode
                      ) {
                        toggleMessageSelection(
                          message.id
                        );
                        return;
                      }

                      if (
                        message.message_type ===
                          'image' &&
                        mediaUrl
                      ) {
                        setPhotoViewerAspectRatio(
                          imageAspectRatios[
                            message.id
                          ] ??
                            1
                        );
                        setPhotoViewerUrl(
                          mediaUrl
                        );
                      }

                      if (
                        message.message_type ===
                          'video' &&
                        mediaUrl
                      ) {
                        setVideoViewerUrl(
                          mediaUrl
                        );
                      }
                    }}
                    delayLongPress={
                      260
                    }
                    hitSlop={{
                      top: 6,
                      bottom: 6,
                      left: 6,
                      right: 6,
                    }}
                    style={[
                      styles.messageRow,
                      selectionMode &&
                        styles.messageRowSelectionMode,
                      mine
                        ? styles.messageRowMine
                        : styles.messageRowOther,

                    ]}
                  >
                    {selectionMode && (
                      <Pressable
                        onPress={() =>
                          toggleMessageSelection(
                            message.id
                          )
                        }
                        hitSlop={8}
                        style={[
                          styles.selectionCheckbox,
                          selectedMessageIds.has(
                            message.id
                          ) &&
                            styles.selectionCheckboxActive,
                        ]}
                      >
                        {selectedMessageIds.has(
                          message.id
                        ) && (
                          <MaterialIcons
                            name="check"
                            size={15}
                            color={
                              DropColors.warmWhite
                            }
                          />
                        )}
                      </Pressable>
                    )}

                    {conversation
                      ?.conversation_type ===
                      'group' &&
                      !mine && (
                        <View
                          style={
                            styles.messageAvatar
                          }
                        >
                          <UserAvatar
                            uri={
                              sender
                                ?.avatar_url ??
                              null
                            }
                            name={
                              sender
                                ?.display_name ||
                              sender
                                ?.username ||
                              'User'
                            }
                            size={28}
                          />
                        </View>
                      )}

                    {message.message_type ===
                      'image' &&
                    mediaUrl &&
                    !deleted ? (
                      <View
                        ref={(node) => {
                          messageBubbleRefs.current[
                            message.id
                          ] = node;
                        }}
                        collapsable={false}
                        style={[
                          styles.photoMessageContainer,
                          mine
                            ? styles.photoMessageContainerMine
                            : styles.photoMessageContainerOther,
                          selectionMode &&
                            selectedMessageIds.has(
                              message.id
                            ) &&
                            (mine
                              ? styles.photoMessageSelectedMine
                              : styles.photoMessageSelectedOther),
                        ]}
                      >
                        <Pressable
                          onPress={() => {
                            if (
                              selectionMode
                            ) {
                              toggleMessageSelection(
                                message.id
                              );
                              return;
                            }

                            setPhotoViewerAspectRatio(
                              imageAspectRatios[
                                message.id
                              ] ??
                                1
                            );
                            setPhotoViewerUrl(
                              mediaUrl
                            );
                          }}
                          onLongPress={() => {
                            if (
                              selectionMode
                            ) {
                              toggleMessageSelection(
                                message.id
                              );
                              return;
                            }

                            openMessageMenu(
                              message
                            );
                          }}
                          delayLongPress={260}
                        >
                          <ExpoImage
                            source={{
                              uri:
                                mediaUrl,
                            }}
                            style={[
                              styles.messageImage,
                              {
                                aspectRatio:
                                  imageAspectRatios[
                                    message.id
                                  ] ??
                                  1,
                              },
                            ]}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                            transition={0}
                            recyclingKey={
                              message.id
                            }
                            onLoad={(event) => {
                              const {
                                width,
                                height,
                              } =
                                event.nativeEvent.source;

                              if (
                                width >
                                  0 &&
                                height >
                                  0
                              ) {
                                queueImageAspectRatio(
                                  message.id,
                                  width /
                                    height
                                );
                              }
                            }}
                          />


                        </Pressable>

                        {!!message.text && (
                          <Text
                            style={[
                              styles.photoCaption,
                              mine
                                ? styles.photoCaptionMine
                                : styles.photoCaptionOther,
                            ]}
                          >
                            {message.text}
                          </Text>
                        )}

                        <View
                          style={
                            styles.photoBubbleMetaRow
                          }
                        >
                          <Text
                            style={
                              styles.photoMetaText
                            }
                          >
                            {formatMessageTime(
                              message.created_at
                            )}
                          </Text>

                          {mine && (
                            <Text
                              style={
                                styles.photoMetaText
                              }
                            >
                              {conversation
                                ?.conversation_type ===
                                'direct' &&
                              otherUserLastReadAt &&
                              new Date(
                                otherUserLastReadAt
                              ).getTime() >=
                                new Date(
                                  message.created_at
                                ).getTime()
                                ? '✓✓'
                                : '✓'}
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : (
                    <View
                      style={[
                        styles.messageColumn,
                        mine
                          ? styles.messageColumnMine
                          : styles.messageColumnOther,
                      ]}
                    >
                      <View
                        ref={(node) => {
                          messageBubbleRefs.current[
                            message.id
                          ] = node;
                        }}
                        collapsable={false}
                        style={[
                          styles.bubble,
                        mine
                          ? styles.bubbleMine
                          : styles.bubbleOther,
                        selectionMode &&
                          selectedMessageIds.has(
                            message.id
                          ) &&
                          (mine
                            ? styles.bubbleMineSelected
                            : styles.bubbleOtherSelected),
                        deleted &&
                          styles.bubbleDeleted,
                      ]}
                    >
                      {conversation
                        ?.conversation_type ===
                        'group' &&
                        !mine && (
                          <Text
                            style={
                              styles.senderName
                            }
                          >
                            {sender
                              ?.display_name ||
                              sender
                                ?.username ||
                              'User'}
                          </Text>
                        )}

                      {renderReplyPreview(
                        message.reply_to_message_id
                      )}

                      {deleted ? (
                        <Text
                          style={
                            styles.deletedText
                          }
                        >
                          Message deleted
                        </Text>
                      ) : (
                        <>

                          {message.message_type ===
                            'video' &&
                            mediaUrl && (
                              <VideoPreview
                                url={
                                  mediaUrl
                                }
                                onOpen={() =>
                                  setVideoViewerUrl(
                                    mediaUrl
                                  )
                                }
                              />
                            )}

                          {message.message_type ===
                            'voice' &&
                            mediaUrl && (
                              <VoicePlayer
                                url={
                                  mediaUrl
                                }
                                durationMs={
                                  message.voice_duration_ms
                                }
                                mine={
                                  mine
                                }
                                messageId={
                                  message.id
                                }
                                onPlaybackState={(
                                  state
                                ) => {
                                  if (
                                    activeVoiceId ===
                                    state.messageId
                                  ) {
                                    setActiveVoice(
                                      state
                                    );
                                  }
                                }}
                                onBeforePlay={
                                  activateVoiceBeforePlay
                                }
                                activeMessageId={
                                  activeVoiceId
                                }
                                selectionMode={
                                  selectionMode
                                }
                                onLongSelect={() =>
                                  openMessageMenu(
                                    message
                                  )
                                }
                              />
                            )}

                          {!!message.text && (
                            <Text
                              style={
                                styles.messageText
                              }
                            >
                              {
                                message.text
                              }
                            </Text>
                          )}
                        </>
                      )}

                      <View
                        style={
                          styles.messageMetaRow
                        }
                      >
                        {!!message.edited_at && (
                          <Text
                            style={
                              styles.editedLabel
                            }
                          >
                            edited
                          </Text>
                        )}

                        <Text
                          style={
                            styles.messageTime
                          }
                        >
                          {formatMessageTime(
                            message.created_at
                          )}
                        </Text>

                        {mine &&
                          !deleted && (
                            <Text
                              style={
                                styles.readReceipt
                              }
                            >
                              {conversation
                                ?.conversation_type ===
                                'direct' &&
                              otherUserLastReadAt &&
                              new Date(
                                otherUserLastReadAt
                              ).getTime() >=
                                new Date(
                                  message.created_at
                                ).getTime()
                                ? '✓✓'
                                : '✓'}
                            </Text>
                          )}
                      </View>

                      </View>
                    </View>
                    )}
                  </Pressable>
                </SwipeMessage>
              );
            }
          )}
        </ScrollView>

        {!!replyingTo && (
          <View
            style={
              styles.replyComposer
            }
          >
            <View
              style={
                styles.replyComposerLine
              }
            />

            <View
              style={
                styles.replyComposerText
              }
            >
              <Text
                style={
                  styles.replyComposerTitle
                }
              >
                Replying to{' '}
                {replyingTo.sender_id ===
                currentUserId
                  ? 'yourself'
                  : profileById(
                      replyingTo.sender_id
                    )?.display_name ||
                    profileById(
                      replyingTo.sender_id
                    )?.username ||
                    'message'}
              </Text>

              <Text
                style={
                  styles.replyComposerPreview
                }
                numberOfLines={
                  1
                }
              >
                {replyingTo.message_type ===
                'voice'
                  ? 'Voice message'
                  : replyingTo.message_type ===
                      'video'
                    ? replyingTo.text ||
                      'Video'
                    : replyingTo.message_type ===
                        'image'
                      ? replyingTo.text ||
                        'Photo'
                      : replyingTo.text}
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              onPress={() =>
                setReplyingTo(
                  null
                )
              }
            >
              <MaterialIcons
                name="close"
                size={20}
                color={
                  DropColors.textSecondary
                }
              />
            </Pressable>
          </View>
        )}

        {!!pendingVideo && (
          <View
            style={
              styles.pendingImageRow
            }
          >
            <View
              style={
                styles.pendingVideoIcon
              }
            >
              <MaterialIcons
                name="videocam"
                size={24}
                color={
                  DropColors.warmWhite
                }
              />
            </View>

            <View
              style={
                styles.pendingImageText
              }
            >
              <Text
                style={
                  styles.pendingImageTitle
                }
              >
                Video attached
              </Text>

              <Text
                style={
                  styles.pendingImageSubtitle
                }
              >
                {(pendingVideo.fileSize /
                  1024 /
                  1024).toFixed(1)} MB · max 50 MB
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              onPress={() =>
                setPendingVideo(
                  null
                )
              }
            >
              <MaterialIcons
                name="close"
                size={20}
                color={
                  DropColors.textSecondary
                }
              />
            </Pressable>
          </View>
        )}

        {!!pendingImage && (
          <View
            style={
              styles.pendingImageRow
            }
          >
            <Image
              source={{
                uri:
                  pendingImage.uri,
              }}
              style={
                styles.pendingImage
              }
            />

            <View
              style={
                styles.pendingImageText
              }
            >
              <Text
                style={
                  styles.pendingImageTitle
                }
              >
                Photo attached
              </Text>

              <Text
                style={
                  styles.pendingImageSubtitle
                }
              >
                Add a caption or send it now.
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              onPress={() =>
                setPendingImage(
                  null
                )
              }
            >
              <MaterialIcons
                name="close"
                size={20}
                color={
                  DropColors.textSecondary
                }
              />
            </Pressable>
          </View>
        )}

        <View
          style={
            styles.composer
          }
        >
          <Pressable
            onPress={
              handlePickMedia
            }
            disabled={
              sending ||
              recorderState.isRecording ||
              !!editingMessageId
            }
            hitSlop={8}
            style={
              styles.composerIcon
            }
          >
            <MaterialIcons
              name="attach-file"
              size={22}
              color={
                pendingImage ||
                pendingVideo
                  ? DropColors.warmWhite
                  : DropColors.textSecondary
              }
            />
          </Pressable>

          <TextInput
            value={
              text
            }
            onChangeText={
              setText
            }
            style={[
              styles.input,
              recorderState.isRecording &&
                styles.inputRecording,
            ]}
            placeholder={
              recorderState.isRecording
                ? `Recording · ${formatVoiceDuration(
                    recorderState.durationMillis
                  )}`
                : 'Message'
            }
            placeholderTextColor={
              recorderState.isRecording
                ? DropColors.warmWhite
                : DropColors.textMuted
            }
            multiline
            editable={
              !sending &&
              !recorderState.isRecording
            }
            selectionColor={
              DropColors.warmWhite
            }
          />

          {text.trim() ||
          pendingImage ||
          pendingVideo ? (
            <Pressable
              onPress={
                handleSend
              }
              disabled={
                sending
              }
              hitSlop={8}
              style={
                styles.sendButton
              }
            >
              <MaterialIcons
                name="arrow-upward"
                size={20}
                color={
                  DropColors.warmWhite
                }
              />
            </Pressable>
          ) : recordingLocked ? (
            <Pressable
              onPress={
                stopAndSendRecording
              }
              disabled={
                sending
              }
              hitSlop={8}
              style={[
                styles.micButton,
                styles.micButtonRecording,
              ]}
            >
              <MaterialIcons
                name="stop"
                size={21}
                color={
                  DropColors.warmWhite
                }
              />
            </Pressable>
          ) : (
            <View
              style={
                styles.micHoldWrap
              }
            >
              {recorderState.isRecording &&
                !recordingLocked && (
                <View
                  pointerEvents="none"
                  style={
                    styles.micLockAbove
                  }
                >
                  <MaterialIcons
                    name="lock-open"
                    size={18}
                    color={
                      DropColors.warmWhite
                    }
                  />
                </View>
              )}

              <View
              onStartShouldSetResponder={() =>
                !sending
              }
              onMoveShouldSetResponder={() =>
                true
              }
              onResponderGrant={(
                event
              ) =>
                beginRecordHold(
                  event.nativeEvent.pageY
                )
              }
              onResponderMove={(
                event
              ) =>
                moveRecordHold(
                  event.nativeEvent.pageY
                )
              }
              onResponderRelease={
                endRecordHold
              }
              onResponderTerminate={
                endRecordHold
              }
              style={[
                styles.micButton,
                recorderState.isRecording &&
                  styles.micButtonRecording,
              ]}
            >
              <MaterialIcons
                name="mic"
                size={21}
                color={
                  DropColors.warmWhite
                }
              />
              </View>
            </View>
          )}
        </View>
      </Pressable>

      <Modal
        visible={
          !!photoEditorSource
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          setPhotoEditorSource(
            null
          )
        }
      >
        {!!photoEditorSource && (
          <PhotoEditor
            uri={
              photoEditorSource.uri
            }
            width={
              photoEditorSource.width
            }
            height={
              photoEditorSource.height
            }
            onCancel={() =>
              setPhotoEditorSource(
                null
              )
            }
            onDone={(result) => {
              setPendingVideo(
                null
              );
              setPendingImage({
                uri:
                  result.uri,
                mimeType:
                  result.mimeType,
                width:
                  result.width,
                height:
                  result.height,
              });
              setPhotoEditorSource(
                null
              );
            }}
          />
        )}
      </Modal>

      <Modal
        visible={
          !!videoViewerUrl
        }
        transparent
        animationType="fade"
        supportedOrientations={[
          'portrait',
          'portrait-upside-down',
          'landscape',
          'landscape-left',
          'landscape-right',
        ]}
        onRequestClose={() =>
          setVideoViewerUrl(
            null
          )
        }
      >
        <Pressable
          style={
            styles.videoViewerBackdrop
          }
          onPress={() =>
            setVideoViewerUrl(
              null
            )
          }
        >
          <Pressable
            hitSlop={12}
            style={
              styles.photoViewerClose
            }
            onPress={(event) => {
              event.stopPropagation();
              setVideoViewerUrl(
                null
              );
            }}
          >
            <MaterialIcons
              name="close"
              size={30}
              color={
                DropColors.warmWhite
              }
            />
          </Pressable>

          {!!videoViewerUrl && (
            <Pressable
              style={
                styles.fullscreenVideoFrame
              }
              onPress={(event) => {
                event.stopPropagation();
              }}
            >
              <FullscreenVideo
                url={
                  videoViewerUrl
                }
              />
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal
        visible={
          !!photoViewerUrl
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPhotoViewerUrl(
            null
          )
        }
      >
        <Pressable
          style={
            styles.photoViewerBackdrop
          }
          onPress={() =>
            setPhotoViewerUrl(
              null
            )
          }
        >
          <Pressable
            hitSlop={12}
            style={
              styles.photoViewerClose
            }
            onPress={(event) => {
              event.stopPropagation();
              setPhotoViewerUrl(
                null
              );
            }}
          >
            <MaterialIcons
              name="close"
              size={30}
              color={
                DropColors.warmWhite
              }
            />
          </Pressable>

          {!!photoViewerUrl && (
            <Pressable
              style={[
                styles.photoViewerImagePressable,
                {
                  width:
                    viewerImageWidth,
                  height:
                    viewerImageHeight,
                },
              ]}
              onPress={(event) => {
                event.stopPropagation();
              }}
            >
              <ExpoImage
                source={{
                  uri:
                    photoViewerUrl,
                }}
                style={
                  styles.photoViewerImage
                }
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal
        visible={
          !!activeMessageMenuMessage &&
          !selectionMode
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setActiveMessageMenuId(
            null
          )
        }
      >
        <Pressable
          style={
            styles.messageMenuBackdrop
          }
          onPress={() =>
            setActiveMessageMenuId(
              null
            )
          }
        >
          {activeMessageMenuMessage && (
            <Pressable
              onLayout={(event) => {
                const {
                  width,
                  height,
                } =
                  event.nativeEvent.layout;

                if (
                  width !==
                    messageMenuSize.width ||
                  height !==
                    messageMenuSize.height
                ) {
                  setMessageMenuSize({
                    width,
                    height,
                  });
                }
              }}
              style={[
                styles.messageActionMenu,
                {
                  left: menuLeft,
                  top: menuTop,
                },
              ]}
              onPress={() => {}}
            >
              <Pressable
                style={
                  styles.messageActionItem
                }
                onPress={() =>
                  handleMessageReply(
                    activeMessageMenuMessage
                  )
                }
              >
                <MaterialIcons
                  name="reply"
                  size={18}
                  color={
                    DropColors.warmWhite
                  }
                />
                <Text
                  style={
                    styles.messageActionText
                  }
                >
                  Reply
                </Text>
              </Pressable>

              {!!activeMessageMenuMessage.text && (
                <Pressable
                  style={
                    styles.messageActionItem
                  }
                  onPress={() =>
                    handleMessageCopy(
                      activeMessageMenuMessage
                    )
                  }
                >
                  <MaterialIcons
                    name="content-copy"
                    size={17}
                    color={
                      DropColors.warmWhite
                    }
                  />
                  <Text
                    style={
                      styles.messageActionText
                    }
                  >
                    Copy
                  </Text>
                </Pressable>
              )}

              {activeMessageMenuMessage.sender_id ===
                currentUserId &&
                activeMessageMenuMessage.message_type ===
                  'text' &&
                !!activeMessageMenuMessage.text && (
                  <Pressable
                    style={
                      styles.messageActionItem
                    }
                    onPress={() =>
                      handleMessageEdit(
                        activeMessageMenuMessage
                      )
                    }
                  >
                    <MaterialIcons
                      name="edit"
                      size={18}
                      color={
                        DropColors.warmWhite
                      }
                    />
                    <Text
                      style={
                        styles.messageActionText
                      }
                    >
                      Edit
                    </Text>
                  </Pressable>
                )}

              <Pressable
                style={
                  styles.messageActionItem
                }
                onPress={() =>
                  handleMessageDelete(
                    activeMessageMenuMessage
                  )
                }
              >
                <MaterialIcons
                  name="delete-outline"
                  size={19}
                  color={
                    DropColors.warmWhite
                  }
                />
                <Text
                  style={
                    styles.messageActionText
                  }
                >
                  Delete
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.messageActionItem
                }
                onPress={() =>
                  handleMessageSelect(
                    activeMessageMenuMessage
                  )
                }
              >
                <MaterialIcons
                  name="check-box-outline-blank"
                  size={19}
                  color={
                    DropColors.warmWhite
                  }
                />
                <Text
                  style={
                    styles.messageActionText
                  }
                >
                  Select
                </Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal
        visible={
          deleteModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDeleteModalVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.modalBackdrop
          }
          onPress={() =>
            setDeleteModalVisible(
              false
            )
          }
        >
          <Pressable
            style={
              styles.deleteModalCompact
            }
            onPress={() => {}}
          >
            <Text
              style={
                styles.deleteModalTitle
              }
            >
              Delete {selectedMessageIds.size}{' '}
              {selectedMessageIds.size ===
              1
                ? 'message'
                : 'messages'}?
            </Text>

            <Pressable
              style={
                styles.deleteEveryoneCompact
              }
              onPress={() =>
                setDeleteForEveryone(
                  (current) =>
                    !current
                )
              }
            >
              <View
                style={[
                  styles.compactCheckbox,
                  deleteForEveryone &&
                    styles.compactCheckboxActive,
                ]}
              >
                {deleteForEveryone && (
                  <MaterialIcons
                    name="check"
                    size={15}
                    color={
                      DropColors.warmWhite
                    }
                  />
                )}
              </View>

              <Text
                style={
                  styles.deleteEveryoneCompactText
                }
              >
                Delete for everyone
              </Text>
            </Pressable>

            <View
              style={
                styles.deleteActions
              }
            >
              <Pressable
                style={
                  styles.deleteActionCancel
                }
                onPress={() => {
                  setDeleteModalVisible(
                    false
                  );

                  if (
                    !selectionMode
                  ) {
                    setSelectedMessageIds(
                      new Set()
                    );
                  }
                }}
              >
                <Text
                  style={
                    styles.deleteCancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.deleteActionConfirm
                }
                onPress={
                  confirmDelete
                }
              >
                <Text
                  style={
                    styles.deleteConfirmText
                  }
                >
                  Delete
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

    loading: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 48,
      paddingHorizontal: 12,
      paddingBottom: 10,
      minHeight: 92,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },

    backButton: {
      width: 34,
      height: 38,
      alignItems: 'flex-start',
      justifyContent:
        'center',
      marginRight: 5,
    },

    groupHeaderAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        DropColors.surface,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    groupHeaderAvatarText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 15,
    },

    headerText: {
      flex: 1,
      marginLeft: 10,
    },

    selectionCount: {
      flex: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
      marginLeft: 8,
    },

    selectionTrash: {
      width: 42,
      height: 38,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    selectionTrashDisabled: {
      opacity: 0.45,
    },

    headerTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 15,
    },

    headerSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      marginTop: 1,
    },

    topVoicePlayer: {
      height: 42,
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        DropColors.graphite,
    },

    topVoicePlay: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 8,
    },

    topVoiceTime: {
      width: 66,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
    },

    topVoiceProgress: {
      position: 'absolute',
      left: 0,
      height: 2,
      borderRadius: 1,
      backgroundColor:
        DropColors.warmWhite,
    },

    topVoiceTrack: {
      flex: 1,
      height: 22,
      justifyContent:
        'center',
      position: 'relative',
      marginHorizontal: 8,
      borderBottomWidth: 2,
      borderBottomColor:
        DropColors.border,
    },

    topVoiceThumb: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        DropColors.warmWhite,
      marginLeft: -4,
      top: 7,
    },

    topVoiceSpeed: {
      minWidth: 38,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        DropColors.surface,
      marginLeft: 4,
    },

    topVoiceSpeedText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 11,
    },

    chatBody: {
      flex: 1,
    },

    scroll: {
      flex: 1,
    },

    timeline: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 14,
    },

    event: {
      alignSelf: 'stretch',
      marginVertical: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor:
        'transparent',
    },

    eventTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },

    eventLine: {
      flex: 1,
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        DropColors.border,
    },

    eventText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
      textAlign: 'center',
      marginHorizontal: 10,
    },

    eventSnapshot: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'center',
      marginTop: 3,
    },

    swipeContainer: {
      position: 'relative',
    },

    replyReveal: {
      position: 'absolute',
      left: 10,
      top: 0,
      bottom: 0,
      width: 40,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    messageRow: {
      width: '100%',
      flexDirection: 'row',
      marginVertical: 3,
      alignItems: 'flex-end',
    },

    messageRowSelectionMode: {
      paddingLeft: 44,
    },

    messageRowMine: {
      justifyContent:
        'flex-end',
    },

    messageRowOther: {
      justifyContent:
        'flex-start',
    },

    messageColumn: {
      maxWidth: '78%',
      flexShrink: 1,
    },

    messageColumnMine: {
      alignItems: 'flex-end',
    },

    messageColumnOther: {
      alignItems: 'flex-start',
    },

    selectionCheckbox: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      width: 26,
      height: 26,
      borderRadius: 7,
      borderWidth: 1,
      borderColor:
        DropColors.textMuted,
      backgroundColor:
        'transparent',
      alignItems: 'center',
      justifyContent:
        'center',
      zIndex: 20,
    },

    selectionCheckboxActive: {
      backgroundColor:
        DropColors.wine,
      borderColor:
        DropColors.warmWhite,
    },

    messageAvatar: {
      marginRight: 6,
      marginBottom: 2,
    },

    bubble: {
      maxWidth: '100%',
      minWidth: 70,
      paddingHorizontal: 12,
      paddingTop: 9,
      paddingBottom: 6,
      borderRadius: 17,
    },

    bubbleMine: {
      backgroundColor:
        DropColors.wine,
      borderBottomRightRadius:
        5,
    },

    bubbleOther: {
      backgroundColor:
        DropColors.surface,
      borderBottomLeftRadius:
        5,
    },

    bubbleMineSelected: {
      backgroundColor:
        '#A52A32',
    },

    bubbleOtherSelected: {
      backgroundColor:
        '#5A5A5A',
    },

    bubbleDeleted: {
      opacity: 0.72,
    },

    senderName: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 11,
      marginBottom: 4,
    },

    messageText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 16,
      lineHeight: 22,
    },

    messageMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'flex-end',
      gap: 4,
      marginTop: 4,
    },

    messageTime: {
      color:
        'rgba(255,242,228,0.52)',
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
      textAlign: 'right',
    },

      readReceipt: {
        color: 'rgba(255,242,228,0.82)',
        fontFamily: DropTypography.medium,
        fontSize: 13,
        lineHeight: 14,
        letterSpacing: -2,
      },

    editedLabel: {
      color:
        'rgba(255,242,228,0.58)',
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 12,
    },

    messageMenuBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.12)',
    },

    messageActionMenu: {
      position: 'absolute',
      width: 230,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor:
        DropColors.surface,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      elevation: 24,
      shadowColor: '#000',
      shadowOpacity: 0.32,
      shadowRadius: 18,
      shadowOffset: {
        width: 0,
        height: 8,
      },
    },

    messageActionMenuMine: {
      alignSelf: 'center',
    },

    messageActionMenuOther: {
      alignSelf: 'center',
    },

    messageActionItem: {
      minHeight: 34,
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },

    messageActionText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
    },

    deletedText: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      fontStyle: 'italic',
    },

    photoMessageContainer: {
      width: 270,
      maxWidth: '82%',
      borderRadius: 14,
      overflow: 'hidden',
      padding: 6,
    },

    photoMessageContainerMine: {
      backgroundColor:
        DropColors.wine,
    },

    photoMessageContainerOther: {
      backgroundColor:
        DropColors.surfaceElevated,
    },

    photoMessageSelectedMine: {
      opacity: 0.92,
      borderWidth: 2,
      borderColor:
        '#A52A32',
    },

    photoMessageSelectedOther: {
      opacity: 0.92,
      borderWidth: 2,
      borderColor:
        '#6A6A6A',
    },

    videoPreview: {
      width: 270,
      maxWidth: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 7,
      backgroundColor:
        '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },

    videoPreviewPlay: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        'rgba(0,0,0,0.52)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    videoViewerBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.86)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },

    fullscreenVideoFrame: {
      width: '100%',
      height: '100%',
      alignSelf: 'center',
      backgroundColor:
        '#000',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },

    fullscreenVideo: {
      width: '100%',
      height: '100%',
      backgroundColor:
        '#000',
    },

    messageImage: {
      width: '100%',
      maxHeight: 360,
      borderRadius: 14,
      backgroundColor:
        'transparent',
    },

    photoBubbleMetaRow: {
      minHeight: 14,
      marginTop: 3,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 2,
    },

    photoMetaText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      lineHeight: 12,
    },

    photoCaption: {
      marginTop: 7,
      paddingHorizontal: 3,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 15,
      lineHeight: 20,
    },

    photoCaptionMine: {
      textAlign: 'left',
    },

    photoCaptionOther: {
      textAlign: 'left',
    },

    photoViewerBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.86)',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 14,
      paddingVertical: 52,
    },

    photoViewerImagePressable: {
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
    },

    photoViewerImage: {
      width: '100%',
      height: '100%',
    },

    photoViewerClose: {
      position: 'absolute',
      top: 58,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        'rgba(20,20,20,0.72)',
      alignItems: 'center',
      justifyContent:
        'center',
      zIndex: 20,
    },

    replyQuote: {
      borderLeftWidth: 2,
      borderLeftColor:
        DropColors.warmWhite,
      paddingLeft: 7,
      marginBottom: 7,
      opacity: 0.82,
    },

    replyQuoteName: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 10,
    },

    replyQuoteText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      marginTop: 1,
    },

    voiceRow: {
      width: 270,
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
    },

    voicePlayButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        DropColors.surfaceElevated,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    voicePlayButtonMine: {
      backgroundColor:
        'rgba(255,255,255,0.16)',
    },

    voiceBars: {
      flex: 1,
      height: 32,
      marginLeft: 9,
      marginRight: 7,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      position: 'relative',
    },

    voiceBar: {
      width: 2,
      borderRadius: 1,
      backgroundColor:
        DropColors.warmWhite,
    },

    voiceDuration: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
    },

    replyComposer: {
      minHeight: 55,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        DropColors.graphite,
    },

    replyComposerLine: {
      width: 2,
      height: 34,
      borderRadius: 1,
      backgroundColor:
        DropColors.wine,
      marginRight: 9,
    },

    replyComposerText: {
      flex: 1,
      marginRight: 10,
    },

    replyComposerTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
    },

    replyComposerPreview: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      marginTop: 2,
    },

    pendingImageRow: {
      minHeight: 68,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },

    pendingImage: {
      width: 48,
      height: 48,
      borderRadius: 9,
    },

    pendingVideoIcon: {
      width: 52,
      height: 52,
      borderRadius: 10,
      backgroundColor:
        DropColors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    pendingImageText: {
      flex: 1,
      marginLeft: 10,
    },

    pendingImageTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },

    pendingImageSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      marginTop: 2,
    },

    recordingStatus: {
      minHeight: 58,
      marginHorizontal: 10,
      marginBottom: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        DropColors.warmWhite,
    },

    recordingStatusDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        DropColors.wine,
      marginRight: 10,
    },

    recordingStatusTextWrap: {
      flex: 1,
    },

    recordingStatusText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
      lineHeight: 21,
    },

    recordingStatusHint: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
      marginTop: 2,
      opacity: 0.72,
    },

    micHoldWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    micLockAbove: {
      position: 'absolute',
      bottom: 52,
      width: 28,
      height: 34,
      alignItems: 'center',
      justifyContent:
        'center',
      zIndex: 5,
    },

    lockedStopButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent:
        'center',
      marginLeft: 8,
    },

    composer: {
      minHeight: 68,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 18
          : 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor:
        DropColors.graphite,
    },

    composerIcon: {
      width: 36,
      height: 40,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      marginHorizontal: 5,
      borderRadius: 20,
      backgroundColor:
        DropColors.surface,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 14,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 9,
      textAlignVertical:
        'center',
    },

    inputRecording: {
      backgroundColor:
        '#3A3532',
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
    },

    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    micButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        DropColors.surface,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    micButtonRecording: {
      backgroundColor:
        DropColors.wine,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.68)',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 24,
    },

    deleteModalCompact: {
      width: '100%',
      maxWidth: 330,
      borderRadius: 16,
      backgroundColor:
        DropColors.surface,
      padding: 16,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    deleteEveryoneCompact: {
      minHeight: 44,
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },

    compactCheckbox: {
      width: 21,
      height: 21,
      borderRadius: 6,
      borderWidth: 1,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    compactCheckboxActive: {
      backgroundColor:
        DropColors.wine,
      borderColor:
        DropColors.wine,
    },

    deleteEveryoneCompactText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    deleteActions: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent:
        'flex-end',
      gap: 10,
    },

    deleteActionCancel: {
      minHeight: 38,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    deleteActionConfirm: {
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    deleteModal: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 18,
      backgroundColor:
        DropColors.surface,
      padding: 18,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    deleteModalTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 17,
    },

    deleteModalSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 5,
    },

    deleteEveryoneRow: {
      marginTop: 18,
      paddingVertical: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },

    deleteEveryoneText: {
      flex: 1,
      paddingRight: 14,
    },

    deleteEveryoneTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    deleteEveryoneSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    deleteConfirm: {
      minHeight: 44,
      marginTop: 16,
      borderRadius: 14,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    deleteConfirmText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 13,
    },

    deleteCancel: {
      minHeight: 42,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    deleteCancelText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },
  });