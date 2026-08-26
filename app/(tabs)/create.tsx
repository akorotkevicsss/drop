import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import {
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
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type JoinTimer =
  | 'none'
  | '1h'
  | '3h'
  | '6h'
  | '12h'
  | '24h';

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
    imageUri,
    setImageUri,
  ] =
    useState<
      string | null
    >(null);

  const [
    imageBase64,
    setImageBase64,
  ] =
    useState<
      string | null
    >(null);

  const [
    imageMimeType,
    setImageMimeType,
  ] =
    useState<
      string | null
    >(null);

  const [
    locationText,
    setLocationText,
  ] = useState('');

  const [
    joinLimitText,
    setJoinLimitText,
  ] = useState('');

  const [
    ageRestriction,
    setAgeRestriction,
  ] =
    useState<AgeRestriction>(
      'everyone'
    );

  const [
    showMoreOptions,
    setShowMoreOptions,
  ] = useState(false);

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
        setImageUri(
          null
        );
        setImageBase64(
          null
        );
        setImageMimeType(
          null
        );
        setLocationText(
          ''
        );
        setJoinLimitText(
          ''
        );
        setAgeRestriction(
          'everyone'
        );
        setShowMoreOptions(
          false
        );
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

  const handlePickImage =
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

      setImageUri(
        asset.uri
      );

      setImageBase64(
        asset.base64 ??
          null
      );

      setImageMimeType(
        asset.mimeType ??
          'image/jpeg'
      );
    };

  const removeImage =
    () => {
      setImageUri(
        null
      );
      setImageBase64(
        null
      );
      setImageMimeType(
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
      userId: string
    ) => {
      if (
        !imageBase64
      ) {
        return null;
      }

      const extension =
        imageMimeType ===
        'image/png'
          ? 'png'
          : imageMimeType ===
              'image/webp'
            ? 'webp'
            : 'jpg';

      const path =
        `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}.${extension}`;

      const arrayBuffer =
        base64ToArrayBuffer(
          imageBase64
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
                imageMimeType ??
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

        let imagePath:
          string | null =
            null;

        if (
          imageUri
        ) {
          if (
            !imageBase64
          ) {
            Alert.alert(
              'Image error',
              'Could not prepare this image for upload. Please choose it again.'
            );

            return;
          }

          imagePath =
            await uploadDropImage(
              user.id
            );
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
                imagePath,

              location_text:
                locationText
                  .trim() ||
                null,

              join_limit:
                joinEnabled
                  ? parsedJoinLimit
                  : null,

              age_restriction:
                ageRestriction,
            });

        if (
          error
        ) {
          if (
            imagePath
          ) {
            await supabase.storage
              .from(
                'drop-images'
              )
              .remove([
                imagePath,
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

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : 'height'
      }
    >
      <Pressable
        style={
          styles.screen
        }
        onPress={
          Keyboard.dismiss
        }
      >
        <View
          style={
            styles.header
          }
        >
          <TouchableOpacity
            onPress={
              handleCancel
            }
            disabled={
              loading
            }
            activeOpacity={
              0.65
            }
          >
            <Text
              style={
                styles.cancelButton
              }
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text
            style={
              styles.title
            }
          >
            New Drop
          </Text>

          <TouchableOpacity
            onPress={
              handleDrop
            }
            disabled={
              disabled
            }
            activeOpacity={
              0.75
            }
            style={[
              styles.dropButton,
              disabled &&
                styles.dropButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.dropButtonText
              }
            >
              {loading
                ? '...'
                : 'Drop'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingDefaults ? (
          <View
            style={
              styles.loadingDefaults
            }
          >
            <ActivityIndicator
              color={
                DropColors.warmWhite
              }
            />
          </View>
        ) : (
          <ScrollView
            style={
              styles.scroll
            }
            contentContainerStyle={
              styles.content
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={
              false
            }
          >
            {!backgroundColor && !imageUri ? (
              <View
                style={
                  styles.plainComposer
                }
              >
                <TextInput
                  style={
                    styles.plainInput
                  }
                  placeholder="What do you want to do?"
                  placeholderTextColor={
                    DropColors.textMuted
                  }
                  value={
                    text
                  }
                  onChangeText={
                    setText
                  }
                  multiline
                  autoFocus
                  maxLength={
                    280
                  }
                  editable={
                    !loading
                  }
                  selectionColor={
                    DropColors.wine
                  }
                />

                <Text
                  style={
                    styles.counter
                  }
                >
                  {text.length}/280
                </Text>
              </View>
            ) : imageUri ? (
              <View
                style={
                  styles.backgroundPreviewWrap
                }
              >
                <ImageBackground
                  source={{
                    uri:
                      imageUri,
                  }}
                  style={
                    styles.backgroundImage
                  }
                  imageStyle={
                    styles.backgroundImageRadius
                  }
                >
                  <View
                    style={
                      styles.backgroundImageOverlay
                    }
                  >
                    <TextInput
                      style={
                        styles.backgroundInput
                      }
                      placeholder="What do you want to do?"
                      placeholderTextColor="rgba(255,242,228,0.62)"
                      value={
                        text
                      }
                      onChangeText={
                        setText
                      }
                      multiline
                      autoFocus
                      maxLength={280}
                      editable={
                        !loading
                      }
                      selectionColor={
                        DropColors.warmWhite
                      }
                    />

                    <Text
                      style={
                        styles.backgroundCounter
                      }
                    >
                      {text.length}/280
                    </Text>
                  </View>
                </ImageBackground>

                <Pressable
                  onPress={
                    removeImage
                  }
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.removeBackgroundButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.removeImageText
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.colorBackgroundComposer,
                  {
                    backgroundColor:
                      backgroundColor ??
                      DropColors.surface,
                  },
                ]}
              >
                <TextInput
                  style={
                    styles.backgroundInput
                  }
                  placeholder="What do you want to do?"
                  placeholderTextColor="rgba(255,242,228,0.52)"
                  value={text}
                  onChangeText={
                    setText
                  }
                  multiline
                  autoFocus
                  maxLength={280}
                  editable={
                    !loading
                  }
                  selectionColor={
                    DropColors.warmWhite
                  }
                />

                <Text
                  style={
                    styles.backgroundCounter
                  }
                >
                  {text.length}/280
                </Text>
              </View>
            )}

            <View
              style={
                styles.quickActions
              }
            >
              <Pressable
                onPress={
                  handlePickImage
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.attachButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="attach-file"
                  size={22}
                  color={
                    imageUri
                      ? DropColors.warmWhite
                      : DropColors.textSecondary
                  }
                />
              </Pressable>
            </View>

            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionLabel
                }
              >
                BACKGROUND
              </Text>

              <View
                style={
                  styles.backgroundRow
                }
              >
                {BACKGROUND_OPTIONS.map(
                  (
                    option
                  ) => {
                    const selected =
                      !imageUri &&
                      backgroundColor ===
                        option.value;

                    return (
                      <Pressable
                        key={
                          option.label
                        }
                        onPress={() => {
                          removeImage();
                          setBackgroundColor(
                            option.value
                          );
                        }}
                        style={({ pressed }) => [
                          styles.backgroundOption,
                          {
                            backgroundColor:
                              option.swatch,
                          },
                          selected &&
                            styles.backgroundOptionSelected,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        {option.value ===
                          null && (
                          <View
                            style={
                              styles.noBackgroundMark
                            }
                          />
                        )}

                        {selected && (
                          <View
                            style={
                              styles.backgroundSelectedDot
                            }
                          />
                        )}
                      </Pressable>
                    );
                  }
                )}

                <Pressable
                  onPress={
                    handlePickImage
                  }
                  style={({ pressed }) => [
                    styles.customBackgroundOption,
                    imageUri &&
                      styles.backgroundOptionSelected,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {imageUri ? (
                    <ImageBackground
                      source={{
                        uri:
                          imageUri,
                      }}
                      style={
                        styles.customBackgroundThumbnail
                      }
                      imageStyle={{
                        borderRadius:
                          21,
                      }}
                    />
                  ) : (
                    <MaterialIcons
                      name="add-photo-alternate"
                      size={20}
                      color={
                        DropColors.textSecondary
                      }
                    />
                  )}
                </Pressable>
              </View>

              <Text
                style={
                  styles.backgroundHelp
                }
              >
                No background keeps the Drop as plain text. Choose a color or use Custom to place text over a photo.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setShowMoreOptions(
                  (
                    current
                  ) =>
                    !current
                )
              }
              style={({ pressed }) => [
                styles.moreOptionsButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View>
                <Text
                  style={
                    styles.moreOptionsTitle
                  }
                >
                  More options
                </Text>

                <Text
                  style={
                    styles.moreOptionsSubtitle
                  }
                >
                  Location, Join limit, age and interactions
                </Text>
              </View>

              <Text
                style={
                  styles.moreOptionsChevron
                }
              >
                {showMoreOptions
                  ? '−'
                  : '+'}
              </Text>
            </Pressable>

            {showMoreOptions && (
              <View
                style={
                  styles.advanced
                }
              >
                <View
                  style={
                    styles.section
                  }
                >
                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    LOCATION
                  </Text>

                  <TextInput
                    value={
                      locationText
                    }
                    onChangeText={
                      setLocationText
                    }
                    placeholder="e.g. Old Riga, Esplanāde, home"
                    placeholderTextColor={
                      DropColors.textMuted
                    }
                    style={
                      styles.singleLineInput
                    }
                    maxLength={
                      80
                    }
                    editable={
                      !loading
                    }
                    selectionColor={
                      DropColors.wine
                    }
                  />
                </View>

                <View
                  style={
                    styles.section
                  }
                >
                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    AGE
                  </Text>

                  <View
                    style={
                      styles.chipRow
                    }
                  >
                    {AGE_OPTIONS.map(
                      (
                        option
                      ) => {
                        const selected =
                          ageRestriction ===
                          option.value;

                        return (
                          <Pressable
                            key={
                              option.value
                            }
                            onPress={() =>
                              setAgeRestriction(
                                option.value
                              )
                            }
                            style={[
                              styles.chip,
                              selected &&
                                styles.chipSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                selected &&
                                  styles.chipTextSelected,
                              ]}
                            >
                              {
                                option.label
                              }
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                </View>

                <View
                  style={
                    styles.section
                  }
                >
                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    INTERACTIONS
                  </Text>

                  <View
                    style={
                      styles.optionCard
                    }
                  >
                    <View
                      style={
                        styles.optionRow
                      }
                    >
                      <View
                        style={
                          styles.optionText
                        }
                      >
                        <Text
                          style={
                            styles.optionName
                          }
                        >
                          Join
                        </Text>

                        <Text
                          style={
                            styles.optionDescription
                          }
                        >
                          People can request to join this Drop.
                        </Text>
                      </View>

                      <Switch
                        value={
                          joinEnabled
                        }
                        onValueChange={
                          setJoinEnabled
                        }
                        disabled={
                          loading
                        }
                        trackColor={{
                          false:
                            DropColors.border,
                          true:
                            DropColors.wine,
                        }}
                        thumbColor={
                          DropColors.warmWhite
                        }
                      />
                    </View>

                    <View
                      style={[
                        styles.optionRow,
                        styles.optionRowBorder,
                      ]}
                    >
                      <View
                        style={
                          styles.optionText
                        }
                      >
                        <Text
                          style={
                            styles.optionName
                          }
                        >
                          Reply
                        </Text>

                        <Text
                          style={
                            styles.optionDescription
                          }
                        >
                          People can reply to this Drop in DM.
                        </Text>
                      </View>

                      <Switch
                        value={
                          replyEnabled
                        }
                        onValueChange={
                          setReplyEnabled
                        }
                        disabled={
                          loading
                        }
                        trackColor={{
                          false:
                            DropColors.border,
                          true:
                            DropColors.wine,
                        }}
                        thumbColor={
                          DropColors.warmWhite
                        }
                      />
                    </View>
                  </View>
                </View>

                {joinEnabled && (
                  <>
                    <View
                      style={
                        styles.section
                      }
                    >
                      <Text
                        style={
                          styles.sectionLabel
                        }
                      >
                        JOIN LIMIT
                      </Text>

                      <TextInput
                        value={
                          joinLimitText
                        }
                        onChangeText={(
                          value
                        ) =>
                          setJoinLimitText(
                            value.replace(
                              /[^0-9]/g,
                              ''
                            )
                          )
                        }
                        placeholder="No limit"
                        placeholderTextColor={
                          DropColors.textMuted
                        }
                        style={
                          styles.singleLineInput
                        }
                        keyboardType="number-pad"
                        maxLength={
                          4
                        }
                        editable={
                          !loading
                        }
                        selectionColor={
                          DropColors.wine
                        }
                      />

                      <Text
                        style={
                          styles.helpText
                        }
                      >
                        Leave empty for unlimited Join requests.
                      </Text>
                    </View>

                    <View
                      style={
                        styles.section
                      }
                    >
                      <Text
                        style={
                          styles.sectionLabel
                        }
                      >
                        JOIN TIMER
                      </Text>

                      <View
                        style={
                          styles.chipRow
                        }
                      >
                        {JOIN_TIMER_OPTIONS.map(
                          (
                            option
                          ) => {
                            const selected =
                              joinTimer ===
                              option.value;

                            return (
                              <Pressable
                                key={
                                  option.value
                                }
                                onPress={() =>
                                  setJoinTimer(
                                    option.value
                                  )
                                }
                                style={[
                                  styles.chip,
                                  selected &&
                                    styles.chipSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    selected &&
                                      styles.chipTextSelected,
                                  ]}
                                >
                                  {
                                    option.label
                                  }
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>

                      <Text
                        style={
                          styles.helpText
                        }
                      >
                        Join closes automatically when the timer ends.
                      </Text>
                    </View>
                  </>
                )}

                <Text
                  style={
                    styles.defaultsHelp
                  }
                >
                  Join and Reply start from your Settings defaults. Changes here only affect this Drop.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </Pressable>
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
        'rgba(0,0,0,0.70)',
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

    removeImageText: {
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
  });