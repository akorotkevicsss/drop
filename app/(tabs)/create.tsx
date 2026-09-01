import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  Tabs,
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { DropDateTimePicker } from '@/components/drop-date-time-picker';
import {
  LocationPicker,
  type DropLocationValue,
} from '@/components/location-picker';
import { PhotoEditor } from '@/components/photo-editor';

import { DropComposerPreview } from '@/components/drop-composer-preview';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

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

type JoinTimer =
  | 'none'
  | '1h'
  | '3h'
  | '6h'
  | '12h'
  | '24h';

type JoinMode = 'request' | 'free' | 'invite_only';

type AgeRestriction =
  | 'everyone'
  | 'under16'
  | '16+'
  | '18+'
  | '21+';

type BackgroundOption = {
  value: string | null;
  label: string;
  swatch: string;
};

const JOIN_TIMER_OPTIONS: {
  value: JoinTimer;
  label: string;
}[] = [
    {
      value: 'none',
      label: 'No limit',
    },
    {
      value: '1h',
      label: '1h',
    },
    {
      value: '3h',
      label: '3h',
    },
    {
      value: '6h',
      label: '6h',
    },
    {
      value: '12h',
      label: '12h',
    },
    {
      value: '24h',
      label: '24h',
    },
  ];

const AGE_OPTIONS: {
  value: AgeRestriction;
  label: string;
}[] = [
    {
      value: 'everyone',
      label: 'Everyone',
    },
    {
      value: 'under16',
      label: 'Under 16',
    },
    {
      value: '16+',
      label: '16+',
    },
    {
      value: '18+',
      label: '18+',
    },
    {
      value: '21+',
      label: '21+',
    },
  ];

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    value: null,
    label: 'None',
    swatch: DropColors.graphite,
  },
  {
    value: '#171111',
    label: 'Smoke',
    swatch: '#171111',
  },
  {
    value: '#241516',
    label: 'Wine',
    swatch: '#241516',
  },
  {
    value: '#151824',
    label: 'Midnight',
    swatch: '#151824',
  },
  {
    value: '#171E19',
    label: 'Forest',
    swatch: '#171E19',
  },
];

function getJoinUntil(
  timer: JoinTimer
) {
  if (
    timer === 'none'
  ) {
    return null;
  }

  const hours =
    Number(
      timer.replace(
        'h',
        ''
      )
    );

  return new Date(
    Date.now() +
    hours *
    60 *
    60 *
    1000
  ).toISOString();
}

function base64ToArrayBuffer(
  base64: string
) {
  const binaryString =
    globalThis.atob(
      base64
    );

  const bytes =
    new Uint8Array(
      binaryString.length
    );

  for (
    let index = 0;
    index <
    binaryString.length;
    index += 1
  ) {
    bytes[index] =
      binaryString.charCodeAt(
        index
      );
  }

  return bytes.buffer;
}


function FieldRow({
    label,
    value,
    placeholder,
    onPress,
    onChangeText,
    keyboardType = 'default',
    multiline = false,
    optional = false,
    suffix = '',
  }: any) {
  return (
    <Pressable
      style={[
        styles.v3FieldRow,
        multiline && styles.v3FieldRowMultiline,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.v3FieldLabel}>{label}</Text>

      {onChangeText ? (
        <View style={styles.v3InputWrap}>
          {multiline && !value && (
            <Text
              pointerEvents="none"
              style={styles.v3MultilinePlaceholder}
            >
              {placeholder}
            </Text>
          )}

          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={multiline ? '' : placeholder}
            placeholderTextColor={DropColors.textMuted}
            keyboardType={keyboardType}
            multiline={multiline}
            style={[
              styles.v3FieldInput,
              multiline && styles.v3FieldInputMultiline,
            ]}
            selectionColor={DropColors.wine}
          />

          {!!value && !!suffix && (
            <Text style={styles.v3Suffix}>{suffix}</Text>
          )}
        </View>
      ) : (
        <View style={styles.v3ValueWrap}>
          <Text
            style={[
              styles.v3FieldValue,
              !value && styles.v3Placeholder,
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>

          {optional && (
            <Text style={styles.v3Optional}>OPTIONAL</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function SelectToggleRow({
    title,
    subtitle,
    value,
    onPress,
  }: {
    title: string;
    subtitle: string;
    value: boolean;
    onPress: () => void;
  }) {
  return (
    <Pressable
      style={[
        styles.v3ModeRow,
        value && styles.v3ModeRowActive,
      ]}
      onPress={onPress}
    >
      <View style={styles.v3ModeCopy}>
        <Text style={styles.v3RowTitle}>{title}</Text>
        <Text style={styles.v3RowSubtitle}>{subtitle}</Text>
      </View>

      <View
        style={[
          styles.v3Radio,
          value && styles.v3RadioActive,
        ]}
      />
    </Pressable>
  );
}

export default function CreateScreen() {
  const [
    text,
    setText,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingDefaults,
    setLoadingDefaults,
  ] = useState(true);

  const [
    joinEnabled,
    setJoinEnabled,
  ] = useState(true);

  const [
    replyEnabled,
    setReplyEnabled,
  ] = useState(true);

  const [
    joinTimer,
    setJoinTimer,
  ] =
    useState<JoinTimer>(
      'none'
    );

  const [
    backgroundColor,
    setBackgroundColor,
  ] =
    useState<
      string | null
    >(null);

  const [
    backgroundImageUri,
    setBackgroundImageUri,
  ] =
    useState<
      string | null
    >(null);

  const [
    backgroundImageBase64,
    setBackgroundImageBase64,
  ] =
    useState<
      string | null
    >(null);

  const [
    backgroundImageMimeType,
    setBackgroundImageMimeType,
  ] =
    useState<
      string | null
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
    location,
    setLocation,
  ] = useState<DropLocationValue | null>(null);

  const [
    locationPickerOpen,
    setLocationPickerOpen,
  ] = useState(false);

  const [
    joinLimitText,
    setJoinLimitText,
  ] = useState('');

  const [ageRestriction, setAgeRestriction] = useState('');

  const [
    showMoreOptions,
    setShowMoreOptions,
  ] = useState(false);

  const [eventStart, setEventStart] = useState<Date | null>(null);
  const [eventEnd, setEventEnd] = useState<Date | null>(null);
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);
  const [joinMode, setJoinMode] = useState<JoinMode>('request');
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [dressCode, setDressCode] = useState('');
  const [priceText, setPriceText] = useState('');
  const [languageText, setLanguageText] = useState('');
  const [conditions, setConditions] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false);

  const loadDefaults =
    async () => {
      try {
        setLoadingDefaults(
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
          Alert.alert(
            'Error',
            'Could not find the current user.'
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
              default_join_enabled,
              default_reply_enabled
            `)
            .eq(
              'id',
              user.id
            )
            .single();

        if (
          error
        ) {
          console.error(
            'LOAD DROP DEFAULTS ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not load your Drop defaults.'
          );

          return;
        }

        setJoinEnabled(
          data.default_join_enabled ??
          true
        );

        setReplyEnabled(
          data.default_reply_enabled ??
          true
        );
      } finally {
        setLoadingDefaults(
          false
        );
      }
    };

  const resetComposer =
    useCallback(
      () => {
        setText('');
        setJoinTimer(
          'none'
        );
        setBackgroundColor(
          null
        );
        setBackgroundImageUri(
          null
        );
        setBackgroundImageBase64(
          null
        );
        setBackgroundImageMimeType(
          null
        );
        setPendingImage(
          null
        );
        setPendingVideo(
          null
        );
        setPhotoEditorSource(
          null
        );
        setLocation(null);
        setLocationPickerOpen(false);
        setJoinLimitText(
          ''
        );
        setAgeRestriction('');
        setShowMoreOptions(false);
        setEventStart(null);
        setEventEnd(null);
        setDatePicker(null);
        setJoinMode('request');
        setCommentsEnabled(false);
        setRatingEnabled(false);
        setDressCode('');
        setPriceText('');
        setLanguageText('');
        setConditions('');
        setHashtags('');
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        resetComposer();
        loadDefaults();

        return () => {
          Keyboard.dismiss();
        };
      },
      [
        resetComposer,
      ]
    )
  );

  const handleCancel =
    () => {
      Keyboard.dismiss();
      resetComposer();
      router.replace('/');
    };

  const handlePickBackgroundImage =
    async () => {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Photo access required',
          'Allow photo access to attach an image to your Drop.'
        );

        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes:
              [
                'images',
              ],
            allowsEditing:
              true,
            aspect:
              [
                4,
                5,
              ],
            quality:
              0.8,
            base64:
              true,
          });

      if (
        result.canceled
      ) {
        return;
      }

      const asset =
        result.assets[0];

      if (
        !asset
      ) {
        return;
      }

      setBackgroundColor(
        null
      );

      setBackgroundImageUri(
        asset.uri
      );

      setBackgroundImageBase64(
        asset.base64 ??
        null
      );

      setBackgroundImageMimeType(
        asset.mimeType ??
        'image/jpeg'
      );
    };

  const removeBackgroundImage =
    () => {
      setBackgroundImageUri(
        null
      );
      setBackgroundImageBase64(
        null
      );
      setBackgroundImageMimeType(
        null
      );
    };

  const handlePickAttachmentMedia =
    async () => {
      if (
        loading
      ) {
        return;
      }

      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

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
        await ImagePicker
          .launchImageLibraryAsync({
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

  const removeAttachmentMedia =
    () => {
      setPendingImage(
        null
      );

      setPendingVideo(
        null
      );

      setPhotoEditorSource(
        null
      );
    };

  const parsedJoinLimit =
    useMemo(
      () => {
        const trimmed =
          joinLimitText.trim();

        if (
          !trimmed
        ) {
          return null;
        }

        const value =
          Number.parseInt(
            trimmed,
            10
          );

        if (
          !Number.isFinite(
            value
          ) ||
          value <= 0
        ) {
          return null;
        }

        return value;
      },
      [
        joinLimitText,
      ]
    );

  const uploadDropImage =
    async (
      userId: string,
      base64: string,
      mimeType: string | null,
      kind: 'background' | 'attachment'
    ) => {
      const extension =
        mimeType ===
          'image/png'
          ? 'png'
          : mimeType ===
            'image/webp'
            ? 'webp'
            : 'jpg';

      const path =
        `${userId}/${kind}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}.${extension}`;

      const arrayBuffer =
        base64ToArrayBuffer(
          base64
        );

      const {
        error,
      } =
        await supabase.storage
          .from(
            'drop-images'
          )
          .upload(
            path,
            arrayBuffer,
            {
              contentType:
                mimeType ??
                'image/jpeg',
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

  const uploadDropAttachmentFile =
    async ({
      bucket,
      path,
      uri,
      contentType,
    }: {
      bucket:
      'drop-images' |
      'drop-videos';
      path: string;
      uri: string;
      contentType: string;
    }) => {
      const file =
        new File(
          uri
        );

      const arrayBuffer =
        await file.arrayBuffer();

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


  const handleDrop =
    async () => {
      const trimmedText =
        text.trim();

      if (
        !trimmedText ||
        loading ||
        loadingDefaults
      ) {
        return;
      }

      if (
        joinLimitText.trim() &&
        parsedJoinLimit ===
        null
      ) {
        Alert.alert(
          'Invalid Join limit',
          'Enter a positive number or leave the field empty.'
        );

        return;
      }

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
          Alert.alert(
            'Error',
            'Could not find the current user.'
          );

          return;
        }

        let backgroundImagePath:
          string | null =
          null;

        let attachmentImagePath:
          string | null =
          null;

        let attachmentVideoPath:
          string | null =
          null;

        if (
          backgroundImageUri
        ) {
          if (
            !backgroundImageBase64
          ) {
            Alert.alert(
              'Image error',
              'Could not prepare the background image. Please choose it again.'
            );

            return;
          }

          backgroundImagePath =
            await uploadDropImage(
              user.id,
              backgroundImageBase64,
              backgroundImageMimeType,
              'background'
            );
        }

        if (
          pendingVideo
        ) {
          const file =
            new File(
              pendingVideo.uri
            );

          const extension =
            (
              file.extension ||
              '.mp4'
            ).replace(
              '.',
              ''
            );

          attachmentVideoPath =
            await uploadDropAttachmentFile({
              bucket:
                'drop-videos',
              path:
                `${user.id}/attachment-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 9)}.${extension}`,
              uri:
                pendingVideo.uri,
              contentType:
                pendingVideo.mimeType,
            });
        } else if (
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

          attachmentImagePath =
            await uploadDropAttachmentFile({
              bucket:
                'drop-images',
              path:
                `${user.id}/attachment-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 9)}.${extension}`,
              uri:
                pendingImage.uri,
              contentType:
                pendingImage.mimeType,
            });
        }

        const {
          error,
        } =
          await supabase
            .from(
              'drops'
            )
            .insert({
              author_id:
                user.id,

              text:
                trimmedText,

              event_time: eventStart ? eventStart.toISOString() : null,
              event_end_time: eventEnd ? eventEnd.toISOString() : null,
              status: 'active',
              comments_enabled: commentsEnabled,
              rating_enabled: ratingEnabled,
              dress_code: dressCode.trim() || null,
              price_text: priceText.trim() || null,
              language_text: languageText.trim() || null,
              conditions: conditions.trim() || null,
              hashtags: hashtags.trim() ? hashtags.trim().split(/\s+/).map((tag) => tag.replace(/^#/, '').toLowerCase()).filter(Boolean) : [],
              join_mode: joinEnabled ? joinMode : 'request',

              join_enabled:
                joinEnabled,

              join_until:
                joinEnabled
                  ? getJoinUntil(
                    joinTimer
                  )
                  : null,

              interested_enabled:
                true,

              reply_enabled:
                replyEnabled,

              background_color:
                backgroundColor,

              image_path:
                backgroundImagePath,

              attached_image_path:
                attachmentImagePath,

              attached_video_path:
                attachmentVideoPath,

              location_text:
                location?.name ??
                null,

              location_type:
                location?.type ??
                null,

              location_name:
                location?.name ??
                null,

              location_address:
                location?.address ??
                null,

              location_lat:
                location?.latitude ??
                null,

              location_lng:
                location?.longitude ??
                null,

              location_radius_m:
                location?.radiusM ??
                null,

              location_provider_id:
                location?.providerId ??
                null,

              join_limit:
                joinEnabled
                  ? parsedJoinLimit
                  : null,

              age_restriction:
                ageRestriction.trim() ? `${ageRestriction.trim()}+` : null,
            });

        if (
          error
        ) {
          const uploadedImagePaths = [
            backgroundImagePath,
            attachmentImagePath,
          ].filter(
            (
              path
            ): path is string =>
              !!path
          );

          if (
            uploadedImagePaths.length >
            0
          ) {
            await supabase.storage
              .from(
                'drop-images'
              )
              .remove(
                uploadedImagePaths
              );
          }

          if (
            attachmentVideoPath
          ) {
            await supabase.storage
              .from(
                'drop-videos'
              )
              .remove([
                attachmentVideoPath,
              ]);
          }

          console.error(
            'CREATE DROP ERROR:',
            error
          );

          Alert.alert(
            'Could not create Drop',
            error.message
          );

          return;
        }

        resetComposer();
        Keyboard.dismiss();

        router.replace(
          '/'
        );
      } catch (
      error
      ) {
        console.error(
          'CREATE DROP ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Something went wrong while creating your Drop.'
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const disabled =
    !text.trim() ||
    loading ||
    loadingDefaults;

  const formatDate = (value: Date | null) => value
    ? value.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';


  return (
    <>
      <Tabs.Screen
        options={{
          tabBarStyle: {
            display: 'none',
          },
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.v3Screen}>
        <View style={styles.v3Header}>
          <Pressable onPress={handleCancel} disabled={loading} style={styles.v3HeaderSide}><Text style={styles.v3Cancel}>Cancel</Text></Pressable>
          <Text style={styles.v3HeaderTitle}>New Drop</Text>
          <Pressable onPress={handleDrop} disabled={disabled} style={styles.v3HeaderSide}><Text style={[styles.v3Save, disabled && { opacity: 0.35 }]}>{loading ? '...' : 'Drop'}</Text></Pressable>
        </View>

        {loadingDefaults ? <View style={styles.loadingDefaults}><ActivityIndicator color={DropColors.warmWhite} /></View> : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.v3Content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <Text style={styles.v3SectionLabel}>DROP</Text>
            <DropComposerPreview
              value={text}
              onChangeText={setText}
              backgroundColor={backgroundColor}
              maxLength={280}
              autoFocus
            />

            {(pendingImage || pendingVideo) && (
              <View style={styles.v3MediaState}>
                <MaterialIcons name={pendingVideo ? 'videocam' : 'image'} size={20} color={DropColors.warmWhite} />
                <Text style={styles.v3MediaText}>{pendingVideo ? 'Video attached' : 'Photo attached'}</Text>
                <Pressable onPress={removeAttachmentMedia} hitSlop={8}><Text style={styles.v3Remove}>×</Text></Pressable>
              </View>
            )}
            <Pressable style={styles.v3ActionRow} onPress={handlePickAttachmentMedia}>
              <View><Text style={styles.v3RowTitle}>Media</Text><Text style={styles.v3RowSubtitle}>Attach a photo or video</Text></View>
              <MaterialIcons name="attach-file" size={21} color={DropColors.warmWhite} />
            </Pressable>

            <Text style={styles.v3SectionLabel}>APPEARANCE</Text>
            <View style={styles.v3BackgroundRow}>
              {BACKGROUND_OPTIONS.map((option) => {
                const selected = !backgroundImageUri && backgroundColor === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      removeBackgroundImage();
                      setBackgroundColor(option.value);
                    }}
                    style={[
                      styles.v3BackgroundOption,
                      { backgroundColor: option.swatch },
                      selected && styles.v3BackgroundSelected,
                    ]}
                  />
                );
              })}
              <Pressable
                onPress={handlePickBackgroundImage}
                style={[
                  styles.v3BackgroundOption,
                  styles.v3CustomBackground,
                  !!backgroundImageUri && styles.v3BackgroundSelected,
                ]}
              >
                <MaterialIcons name="add-photo-alternate" size={19} color={DropColors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.v3Help}>
              Background is optional and only changes the visual presentation of the Drop.
            </Text>

            <Pressable
              style={styles.v3AdditionalHeader}
              onPress={() => setAdditionalOptionsOpen((value) => !value)}
            >
              <Text style={styles.v3AdditionalTitle}>Additional options</Text>
              <MaterialIcons
                name={additionalOptionsOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={DropColors.warmWhite}
              />
            </Pressable>

            {additionalOptionsOpen && (
              <View>
                <Text style={styles.v3SectionLabel}>WHEN</Text>
                <FieldRow
                  label="Starts"
                  value={formatDate(eventStart)}
                  placeholder="Add date & time"
                  onPress={() => setDatePicker('start')}
                />
                <FieldRow
                  label="Ends"
                  value={formatDate(eventEnd)}
                  placeholder="Add date & time"
                  onPress={() => setDatePicker('end')}
                />

                <Text style={styles.v3SectionLabel}>LOCATION</Text>
                <FieldRow
                  label="Location"
                  value={location?.name ?? ''}
                  placeholder="Add location"
                  onPress={() => setLocationPickerOpen(true)}
                  optional
                />

                <Text style={styles.v3SectionLabel}>AGE</Text>
                <FieldRow
                  label="Age"
                  value={ageRestriction}
                  placeholder="Optional"
                  keyboardType="number-pad"
                  onChangeText={(value: string) =>
                    setAgeRestriction(value.replace(/[^0-9]/g, '').slice(0, 2))
                  }
                  suffix="+"
                />

                <Text style={styles.v3SectionLabel}>EVENT DETAILS</Text>
                <FieldRow
                  label="Dress code"
                  value={dressCode}
                  placeholder="Optional"
                  onChangeText={setDressCode}
                />
                <FieldRow
                  label="Price"
                  value={priceText}
                  placeholder="Optional"
                  onChangeText={setPriceText}
                />
                <FieldRow
                  label="Language"
                  value={languageText}
                  placeholder="Optional"
                  onChangeText={setLanguageText}
                />
                <FieldRow
                  label="Conditions"
                  value={conditions}
                  placeholder="Optional"
                  onChangeText={setConditions}
                  multiline
                />
                <FieldRow
                  label="Hashtags"
                  value={hashtags}
                  placeholder="#riga #rave · optional"
                  onChangeText={setHashtags}
                />

                <Text style={styles.v3SectionLabel}>PARTICIPATION</Text>
                <SelectToggleRow
                  title="Join"
                  subtitle="Allow people to participate in this Drop."
                  value={joinEnabled}
                  onPress={() => setJoinEnabled((value) => !value)}
                />
                {joinEnabled && (
                  <>
                    <View style={styles.v3ModeBox}>
                      {([
                        ['request', 'Request to join', 'Organizer approves each request.'],
                        ['free', 'Free join', 'People join immediately without approval.'],
                        ['invite_only', 'Invite only', 'Only organizer invitations can add people.'],
                      ] as const).map(([value, title, subtitle]) => (
                        <Pressable
                          key={value}
                          style={[
                            styles.v3ModeRow,
                            joinMode === value && styles.v3ModeRowActive,
                          ]}
                          onPress={() => setJoinMode(value)}
                        >
                          <View style={styles.v3ModeCopy}>
                            <Text style={styles.v3RowTitle}>{title}</Text>
                            <Text style={styles.v3RowSubtitle}>{subtitle}</Text>
                          </View>
                          <View
                            style={[
                              styles.v3Radio,
                              joinMode === value && styles.v3RadioActive,
                            ]}
                          />
                        </Pressable>
                      ))}
                    </View>
                    <FieldRow
                      label="Capacity"
                      value={joinLimitText}
                      placeholder="Unlimited"
                      keyboardType="number-pad"
                      onChangeText={(value: string) =>
                        setJoinLimitText(value.replace(/[^0-9]/g, ''))
                      }
                    />
                  </>
                )}
                <SelectToggleRow
                  title="Reply"
                  subtitle="Allow people to reply privately to this Drop."
                  value={replyEnabled}
                  onPress={() => setReplyEnabled((value) => !value)}
                />
                <SelectToggleRow
                  title="Comments"
                  subtitle="Public questions and discussion under the Drop."
                  value={commentsEnabled}
                  onPress={() => setCommentsEnabled((value) => !value)}
                />
                <SelectToggleRow
                  title="Event rating"
                  subtitle="Participants can rate this Drop after it ends."
                  value={ratingEnabled}
                  onPress={() => setRatingEnabled((value) => !value)}
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <LocationPicker
        visible={locationPickerOpen}
        value={location}
        onClose={() => setLocationPickerOpen(false)}
        onChange={setLocation}
      />

      <DropDateTimePicker
        visible={datePicker !== null}
        title={datePicker === 'end' ? 'Drop ends' : 'Drop starts'}
        value={datePicker === 'end' ? eventEnd : eventStart}
        minimumDate={datePicker === 'end' ? (eventStart ?? new Date()) : new Date()}
        onClose={() => setDatePicker(null)}
        onConfirm={(date) => {
          if (datePicker === 'end') {
            if (eventStart && date <= eventStart) { Alert.alert('End time', 'End time must be later than start time.'); return; }
            setEventEnd(date);
          } else {
            setEventStart(date);
            if (eventEnd && eventEnd <= date) setEventEnd(null);
          }
          setDatePicker(null);
        }}
      />


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
      </KeyboardAvoidingView>
    </>
  );
}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    screen: {
      flex: 1,
    },

    header: {
      paddingTop: 52,
      paddingHorizontal: 18,
      paddingBottom: 13,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    cancelButton: {
      minWidth: 62,
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

    dropButton: {
      minWidth: 62,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor:
        DropColors.wine,
      alignItems: 'center',
    },

    dropButtonDisabled: {
      opacity: 0.32,
    },

    dropButtonText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    loadingDefaults: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingBottom: 44,
    },

    plainComposer: {
      marginHorizontal: 18,
      marginTop: 18,
      minHeight: 150,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    plainInput: {
      minHeight: 130,
      paddingTop: 8,
      paddingHorizontal: 0,
      paddingBottom: 8,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 20,
      lineHeight: 27,
      textAlignVertical:
        'top',
    },

    colorBackgroundComposer: {
      marginHorizontal: 18,
      marginTop: 18,
      minHeight: 210,
      borderRadius: 18,
      overflow: 'hidden',
      justifyContent:
        'space-between',
    },

    backgroundPreviewWrap: {
      marginHorizontal: 18,
      marginTop: 18,
      minHeight: 260,
      borderRadius: 18,
      overflow: 'hidden',
      position: 'relative',
    },

    backgroundImage: {
      width: '100%',
      minHeight: 260,
    },

    backgroundImageRadius: {
      borderRadius: 18,
    },

    backgroundImageOverlay: {
      flex: 1,
      minHeight: 260,
      backgroundColor:
        'rgba(0,0,0,0.28)',
      justifyContent:
        'space-between',
    },

    backgroundInput: {
      minHeight: 170,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 21,
      lineHeight: 29,
      textAlignVertical:
        'top',
      textShadowColor:
        'rgba(0,0,0,0.35)',
      textShadowOffset: {
        width: 0,
        height: 1,
      },
      textShadowRadius: 3,
    },

    counter: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      textAlign: 'right',
      paddingBottom: 10,
    },

    backgroundCounter: {
      color:
        'rgba(255,242,228,0.70)',
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      textAlign: 'right',
      paddingHorizontal: 14,
      paddingBottom: 12,
    },

    removeBackgroundButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        'rgba(12,12,12,0.78)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    removeBackgroundImageText: {
      color:
        DropColors.warmWhite,
      fontSize: 24,
      lineHeight: 26,
      fontWeight: '300',
    },

    quickActions: {
      marginHorizontal: 18,
      marginTop: 10,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    attachButton: {
      width: 36,
      height: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    mediaAttachmentRow: {
      marginHorizontal: 18,
      marginTop: 12,
      minHeight: 72,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 15,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      backgroundColor:
        DropColors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    pendingVideoIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        DropColors.graphite,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    mediaAttachmentText: {
      flex: 1,
    },

    mediaAttachmentTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    mediaAttachmentSubtitle: {
      marginTop: 3,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    mediaRemoveButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },

    attachmentPreviewWrap: {
      marginHorizontal: 18,
      marginTop: 10,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor:
        DropColors.surface,
    },

    attachmentPreview: {
      width: '100%',
      aspectRatio: 4 / 3,
    },

    attachmentPreviewImage: {
      borderRadius: 16,
    },

    removeAttachmentButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        'rgba(12,12,12,0.78)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    section: {
      marginHorizontal: 18,
      marginTop: 20,
    },

    sectionLabel: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.semibold,
      fontSize: 10,
      letterSpacing: 1.35,
      marginBottom: 9,
    },

    backgroundRow: {
      flexDirection:
        'row',
      gap: 11,
    },

    backgroundOption: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    backgroundOptionSelected: {
      borderColor:
        DropColors.warmWhite,
      borderWidth: 2,
    },

    customBackgroundOption: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },

    customBackgroundThumbnail: {
      width: 42,
      height: 42,
    },

    noBackgroundMark: {
      position: 'absolute',
      width: 24,
      height: 1,
      backgroundColor:
        DropColors.textMuted,
      transform: [
        {
          rotate: '-45deg',
        },
      ],
    },

    backgroundHelp: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 9,
      maxWidth: 330,
    },

    backgroundSelectedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        DropColors.warmWhite,
    },

    v2Section: {
      marginTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: DropColors.border,
      paddingBottom: 8,
    },
    v2DateRow: {
      minHeight: 54,
      paddingHorizontal: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    v2DateLabel: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontSize: 13,
    },
    v2DateValue: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 13,
    },
    v2DatePlaceholder: {
      color: DropColors.textMuted,
    },

    moreOptionsButton: {
      marginHorizontal: 18,
      marginTop: 22,
      paddingVertical: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    moreOptionsTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    moreOptionsSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      marginTop: 3,
    },

    moreOptionsChevron: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.light,
      fontSize: 24,
    },

    advanced: {
      paddingBottom: 12,
    },

    singleLineInput: {
      minHeight: 46,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 14,
      paddingVertical: 10,
    },

    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    chip: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    chipSelected: {
      backgroundColor:
        DropColors.wine,
      borderColor:
        DropColors.wine,
    },

    chipText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 12,
    },

    chipTextSelected: {
      color:
        DropColors.warmWhite,
    },

    optionCard: {
      backgroundColor:
        DropColors.surface,
      borderRadius: 15,
      overflow: 'hidden',
    },

    optionRow: {
      minHeight: 68,
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
    },

    optionRowBorder: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
    },

    optionText: {
      flex: 1,
      paddingRight: 14,
    },

    optionName: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 14,
    },

    optionDescription: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },

    helpText: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 7,
    },

    defaultsHelp: {
      marginHorizontal: 18,
      marginTop: 18,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
    },

    pressed: {
      opacity: 0.65,
    },

    v3Screen: {
      flex: 1,
      backgroundColor: DropColors.graphite,
    },
    v3Header: {
      paddingTop: 52,
      minHeight: 96,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3HeaderSide: {
      width: 70,
    },
    v3Cancel: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.medium,
      fontSize: 13,
    },
    v3Save: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 13,
      textAlign: 'right',
    },
    v3HeaderTitle: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.semibold,
      fontSize: 16,
    },
    v3Content: {
      paddingBottom: 64,
    },
    v3SectionLabel: {
      marginTop: 0,
      paddingTop: 18,
      paddingBottom: 8,
      paddingHorizontal: 18,
      color: DropColors.textMuted,
      fontFamily: DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.2,
    },
    v3ComposerBox: {
      position: 'relative',
      minHeight: 144,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3ComposerBoxBackground: {
      marginHorizontal: 18,
      borderRadius: 18,
      overflow: 'hidden',
      borderBottomWidth: 0,
    },
   v3MainInput: {
      minHeight: 144,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 32,
      color: DropColors.warmWhite,
      fontFamily: DropTypography.regular,
      fontSize: 20,
      lineHeight: 27,
      textAlign: 'center',
      textAlignVertical: 'top',
    },
    v3Counter: {
      position: 'absolute',
      right: 18,
      bottom: 10,
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 10,
      textAlign: 'right',
    },
    v3FieldRow: {
      minHeight: 58,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3FieldRowMultiline: {
      minHeight: 82,
      alignItems: 'center',
    },
    v3FieldLabel: {
      width: 92,
      color: DropColors.textSecondary,
      fontFamily: DropTypography.regular,
      fontSize: 12,
    },
    v3FieldInput: {
      flex: 1,
      minWidth: 0,
      color: DropColors.warmWhite,
      fontFamily: DropTypography.regular,
      fontSize: 13,
      paddingVertical: 10,
      textAlign: 'right',
    },
    v3FieldInputMultiline: {
      minHeight: 64,
      paddingVertical: 0,
      textAlign: 'right',
      textAlignVertical: 'center',
    },
    v3MultilinePlaceholder: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      textAlignVertical: 'center',
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 13,
      includeFontPadding: false,
    },
    v3FieldValue: {
      flex: 1,
      color: DropColors.warmWhite,
      fontFamily: DropTypography.regular,
      fontSize: 13,
      textAlign: 'right',
    },
    v3Placeholder: {
      color: DropColors.textMuted,
    },
    v3InputWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    v3ValueWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 14,
    },
    v3Optional: {
      color: DropColors.textMuted,
      fontFamily: DropTypography.medium,
      fontSize: 9,
      letterSpacing: 0.8,
    },
    v3Suffix: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 13,
      marginLeft: 2,
    },
    v3SwitchRow: {
      minHeight: 72,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3ModeBox: {
    },
    v3ModeRow: {
      minHeight: 66,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3ModeRowActive: {
      backgroundColor: '#151515',
    },
    v3ModeCopy: {
      flex: 1,
      paddingRight: 14,
    },
    v3RowTitle: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 13,
    },
    v3RowSubtitle: {
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 3,
    },
    v3Radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: DropColors.textMuted,
    },
    v3RadioActive: {
      borderWidth: 5,
      borderColor: DropColors.wine,
    },
    v3AdditionalHeader: {
      minHeight: 62,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: DropColors.border,
    },
    v3AdditionalTitle: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 13,
    },
    v3ActionRow: {
      minHeight: 64,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3MediaState: {
      minHeight: 52,
      paddingHorizontal: 18,
      backgroundColor: '#151515',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3MediaText: {
      flex: 1,
      color: DropColors.warmWhite,
      fontFamily: DropTypography.regular,
      fontSize: 12,
    },
    v3Remove: {
      color: DropColors.textMuted,
      fontSize: 20,
    },
    v3AgeRow: {
      minHeight: 70,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DropColors.border,
    },
    v3AgeOptions: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 6,
      flexWrap: 'wrap',
    },
    v3AgeChip: {
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: DropColors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    v3AgeChipActive: {
      backgroundColor: DropColors.wine,
      borderColor: DropColors.wine,
    },
    v3AgeText: {
      color: DropColors.textSecondary,
      fontFamily: DropTypography.medium,
      fontSize: 10,
    },
    v3AgeTextActive: {
      color: DropColors.warmWhite,
    },
    v3BackgroundRow: {
      paddingHorizontal: 18,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    v3BackgroundOption: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: DropColors.border,
    },
    v3BackgroundSelected: {
      borderWidth: 2,
      borderColor: DropColors.warmWhite,
    },
    v3CustomBackground: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#151515',
    },
    v3Help: {
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 10,
      lineHeight: 15,
      paddingHorizontal: 18,
      marginTop: 10,
    },
});