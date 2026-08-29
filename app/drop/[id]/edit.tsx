import { DropDateTimePicker } from '@/components/drop-date-time-picker';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import {
  getScreenCache,
  setScreenCache,
} from '@/lib/tab-screen-cache';
import {
  Stack,
  router,
  useLocalSearchParams,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type JoinMode =
  | 'request'
  | 'free'
  | 'invite_only';

type EditDropCache = {
  text: string;
  eventStartIso: string | null;
  eventEndIso: string | null;
  location: string;
  age: string;
  dressCode: string;
  price: string;
  language: string;
  conditions: string;
  hashtags: string;
  joinEnabled: boolean;
  joinMode: JoinMode;
  capacity: string;
  replyEnabled: boolean;
  commentsEnabled: boolean;
  ratingEnabled: boolean;
};

const MODES: {
  value: JoinMode;
  label: string;
  subtitle: string;
}[] = [
  {
    value: 'request',
    label: 'Request to join',
    subtitle:
      'Organizer approves each request.',
  },
  {
    value: 'free',
    label: 'Free join',
    subtitle:
      'People join immediately without approval.',
  },
  {
    value:
      'invite_only',
    label:
      'Invite only',
    subtitle:
      'Only organizer invitations can add people.',
  },
];

function formatDate(
  value: Date | null
) {
  return value
    ? value.toLocaleString(
        'en-GB',
        {
          day: 'numeric',
          month: 'short',
          hour:
            '2-digit',
          minute:
            '2-digit',
        }
      )
    : '';
}

export default function EditDropScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const cacheKey =
    id
      ? `edit-drop:${id}`
      : '';

  const cached =
    cacheKey
      ? getScreenCache<EditDropCache>(
          cacheKey
        )
      : null;

  const [
    loading,
    setLoading,
  ] =
    useState(!cached);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    text,
    setText,
  ] =
    useState(
      cached?.text ?? ''
    );

  const [
    eventStart,
    setEventStart,
  ] =
    useState<Date | null>(
      cached?.eventStartIso
        ? new Date(
            cached.eventStartIso
          )
        : null
    );

  const [
    eventEnd,
    setEventEnd,
  ] =
    useState<Date | null>(
      cached?.eventEndIso
        ? new Date(
            cached.eventEndIso
          )
        : null
    );

  const [
    datePicker,
    setDatePicker,
  ] =
    useState<
      | 'start'
      | 'end'
      | null
    >(null);

  const [
    location,
    setLocation,
  ] =
    useState(
      cached?.location ??
        ''
    );

  const [
    age,
    setAge,
  ] =
    useState(
      cached?.age ?? ''
    );

  const [
    dressCode,
    setDressCode,
  ] =
    useState(
      cached?.dressCode ??
        ''
    );

  const [
    price,
    setPrice,
  ] =
    useState(
      cached?.price ?? ''
    );

  const [
    language,
    setLanguage,
  ] =
    useState(
      cached?.language ??
        ''
    );

  const [
    conditions,
    setConditions,
  ] =
    useState(
      cached?.conditions ??
        ''
    );

  const [
    hashtags,
    setHashtags,
  ] =
    useState(
      cached?.hashtags ??
        ''
    );

  const [
    joinEnabled,
    setJoinEnabled,
  ] =
    useState(
      cached?.joinEnabled ??
        true
    );

  const [
    joinMode,
    setJoinMode,
  ] =
    useState<JoinMode>(
      cached?.joinMode ??
        'request'
    );

  const [
    capacity,
    setCapacity,
  ] =
    useState(
      cached?.capacity ??
        ''
    );

  const [
    replyEnabled,
    setReplyEnabled,
  ] =
    useState(
      cached?.replyEnabled ??
        true
    );

  const [
    commentsEnabled,
    setCommentsEnabled,
  ] =
    useState(
      cached?.commentsEnabled ??
        false
    );

  const [
    ratingEnabled,
    setRatingEnabled,
  ] =
    useState(
      cached?.ratingEnabled ??
        false
    );

  const loadInFlight =
    useRef(false);

  const applyCache =
    (
      next:
        EditDropCache
    ) => {
      setText(
        next.text
      );

      setEventStart(
        next.eventStartIso
          ? new Date(
              next.eventStartIso
            )
          : null
      );

      setEventEnd(
        next.eventEndIso
          ? new Date(
              next.eventEndIso
            )
          : null
      );

      setLocation(
        next.location
      );
      setAge(next.age);
      setDressCode(
        next.dressCode
      );
      setPrice(
        next.price
      );
      setLanguage(
        next.language
      );
      setConditions(
        next.conditions
      );
      setHashtags(
        next.hashtags
      );
      setJoinEnabled(
        next.joinEnabled
      );
      setJoinMode(
        next.joinMode
      );
      setCapacity(
        next.capacity
      );
      setReplyEnabled(
        next.replyEnabled
      );
      setCommentsEnabled(
        next.commentsEnabled
      );
      setRatingEnabled(
        next.ratingEnabled
      );
    };

  const writeCache =
    (
      next:
        EditDropCache
    ) => {
      if (cacheKey) {
        setScreenCache<EditDropCache>(
          cacheKey,
          next
        );
      }
    };

  useEffect(() => {
    const load =
      async () => {
        if (
          !id ||
          loadInFlight.current
        ) {
          return;
        }

        loadInFlight.current =
          true;

        const existing =
          getScreenCache<EditDropCache>(
            `edit-drop:${id}`
          );

        if (existing) {
          applyCache(
            existing
          );
          setLoading(
            false
          );
        } else {
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

          const {
            data,
            error,
          } =
            await supabase
              .from('drops')
              .select(
                'text,event_time,event_end_time,location_text,age_restriction,join_limit,join_enabled,join_mode,reply_enabled,comments_enabled,rating_enabled,dress_code,conditions,price_text,language_text,hashtags'
              )
              .eq(
                'id',
                id
              )
              .eq(
                'author_id',
                user.id
              )
              .maybeSingle();

          if (
            error ||
            !data
          ) {
            if (!existing) {
              Alert.alert(
                'Error',
                'Could not load this Drop.'
              );
            }

            return;
          }

          const next:
            EditDropCache = {
              text:
                data.text ??
                '',
              eventStartIso:
                data.event_time ??
                null,
              eventEndIso:
                data.event_end_time ??
                null,
              location:
                data.location_text ??
                '',
              age:
                String(
                  data.age_restriction ??
                    ''
                )
                  .replace(
                    /\+$/,
                    ''
                  )
                  .replace(
                    /\D/g,
                    ''
                  )
                  .slice(
                    0,
                    2
                  ),
              dressCode:
                data.dress_code ??
                '',
              price:
                data.price_text ??
                '',
              language:
                data.language_text ??
                '',
              conditions:
                data.conditions ??
                '',
              hashtags:
                (
                  data.hashtags ??
                  []
                )
                  .map(
                    (
                      tag:
                        string
                    ) =>
                      `#${tag.replace(/^#/, '')}`
                  )
                  .join(
                    ' '
                  ),
              joinEnabled:
                data.join_enabled ??
                true,
              joinMode:
                (
                  data.join_mode as JoinMode
                ) ??
                'request',
              capacity:
                data.join_limit
                  ? String(
                      data.join_limit
                    )
                  : '',
              replyEnabled:
                data.reply_enabled ??
                true,
              commentsEnabled:
                data.comments_enabled ??
                false,
              ratingEnabled:
                data.rating_enabled ??
                false,
            };

          applyCache(
            next
          );
          writeCache(
            next
          );
        } finally {
          loadInFlight.current =
            false;
          setLoading(
            false
          );
        }
      };

    void load();
  }, [id]);

  const parsedCapacity =
    useMemo(() => {
      if (
        !capacity.trim()
      ) {
        return null;
      }

      const value =
        Number(
          capacity
        );

      return (
        Number.isInteger(
          value
        ) &&
        value > 0
          ? value
          : undefined
      );
    }, [
      capacity,
    ]);

  const currentCache =
    (): EditDropCache => ({
      text:
        text.trim(),
      eventStartIso:
        eventStart?.toISOString() ??
        null,
      eventEndIso:
        eventEnd?.toISOString() ??
        null,
      location:
        location.trim(),
      age:
        age.trim(),
      dressCode:
        dressCode.trim(),
      price:
        price.trim(),
      language:
        language.trim(),
      conditions:
        conditions.trim(),
      hashtags,
      joinEnabled,
      joinMode,
      capacity,
      replyEnabled,
      commentsEnabled,
      ratingEnabled,
    });

  const save =
    async () => {
      if (
        !id ||
        saving ||
        !text.trim()
      ) {
        return;
      }

      if (
        parsedCapacity ===
        undefined
      ) {
        Alert.alert(
          'Capacity',
          'Enter a positive number or leave the field empty.'
        );
        return;
      }

      if (
        eventStart &&
        eventEnd &&
        eventEnd <=
          eventStart
      ) {
        Alert.alert(
          'End time',
          'End time must be later than start time.'
        );
        return;
      }

      try {
        setSaving(true);

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

        const normalizedTags =
          hashtags
            .split(
              /[\s,]+/
            )
            .map(
              (item) =>
                item
                  .trim()
                  .replace(
                    /^#/,
                    ''
                  )
                  .toLowerCase()
            )
            .filter(
              Boolean
            )
            .slice(
              0,
              10
            );

        const {
          error,
        } =
          await supabase
            .from('drops')
            .update({
              text:
                text.trim(),
              event_time:
                eventStart?.toISOString() ??
                null,
              event_end_time:
                eventEnd?.toISOString() ??
                null,
              location_text:
                location.trim() ||
                null,
              age_restriction:
                age.trim()
                  ? `${age.trim()}+`
                  : null,
              dress_code:
                dressCode.trim() ||
                null,
              price_text:
                price.trim() ||
                null,
              language_text:
                language.trim() ||
                null,
              conditions:
                conditions.trim() ||
                null,
              hashtags:
                normalizedTags,
              join_enabled:
                joinEnabled,
              join_mode:
                joinEnabled
                  ? joinMode
                  : 'request',
              join_limit:
                joinEnabled
                  ? parsedCapacity
                  : null,
              reply_enabled:
                replyEnabled,
              comments_enabled:
                commentsEnabled,
              rating_enabled:
                ratingEnabled,
            })
            .eq(
              'id',
              id
            )
            .eq(
              'author_id',
              user.id
            );

        if (error) {
          throw error;
        }

        writeCache(
          currentCache()
        );

        router.back();
      } catch (error) {
        console.error(
          'EDIT DROP ERROR:',
          error
        );

        Alert.alert(
          'Error',
          'Could not save changes.'
        );
      } finally {
        setSaving(false);
      }
    };

  if (
    loading &&
    !cached
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
          style={
            styles.headerSide
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
            styles.headerTitle
          }
        >
          Edit Drop
        </Text>

        <Pressable
          onPress={
            save
          }
          disabled={
            saving
          }
          style={
            styles.headerSide
          }
        >
          <Text
            style={
              styles.save
            }
          >
            {saving
              ? '...'
              : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={
            styles.sectionLabel
          }
        >
          DROP
        </Text>

        <View
          style={
            styles.composerBox
          }
        >
          <TextInput
            value={
              text
            }
            onChangeText={
              setText
            }
            multiline
            maxLength={
              280
            }
            style={
              styles.mainInput
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

        <Text
          style={
            styles.sectionLabel
          }
        >
          WHEN
        </Text>

        <DateField
          label="Starts"
          value={
            formatDate(
              eventStart
            )
          }
          placeholder="Add date & time"
          onPress={() =>
            setDatePicker(
              'start'
            )
          }
        />

        <DateField
          label="Ends"
          value={
            formatDate(
              eventEnd
            )
          }
          placeholder="Add date & time"
          onPress={() =>
            setDatePicker(
              'end'
            )
          }
        />

        <Text
          style={
            styles.sectionLabel
          }
        >
          LOCATION
        </Text>

        <Field
          label="Location"
          value={
            location
          }
          onChangeText={
            setLocation
          }
          placeholder="Optional"
        />

        <Text
          style={
            styles.sectionLabel
          }
        >
          AGE
        </Text>

        <Field
          label="Age"
          value={age}
          onChangeText={(
            value
          ) =>
            setAge(
              value
                .replace(
                  /[^0-9]/g,
                  ''
                )
                .slice(
                  0,
                  2
                )
            )
          }
          placeholder="Optional"
          keyboardType="number-pad"
          suffix="+"
        />

        <Text
          style={
            styles.sectionLabel
          }
        >
          EVENT DETAILS
        </Text>

        <Field
          label="Dress code"
          value={
            dressCode
          }
          onChangeText={
            setDressCode
          }
          placeholder="Optional"
        />

        <Field
          label="Price"
          value={
            price
          }
          onChangeText={
            setPrice
          }
          placeholder="Optional"
        />

        <Field
          label="Language"
          value={
            language
          }
          onChangeText={
            setLanguage
          }
          placeholder="Optional"
        />

        <Field
          label="Conditions"
          value={
            conditions
          }
          onChangeText={
            setConditions
          }
          placeholder="Optional"
          multiline
        />

        <Field
          label="Hashtags"
          value={
            hashtags
          }
          onChangeText={
            setHashtags
          }
          placeholder="#riga #rave · optional"
        />

        <Text
          style={
            styles.sectionLabel
          }
        >
          PARTICIPATION
        </Text>

        <SelectToggleRow
          title="Join"
          subtitle="Allow people to participate in this Drop."
          value={
            joinEnabled
          }
          onPress={() =>
            setJoinEnabled(
              (value) =>
                !value
            )
          }
        />

        {joinEnabled && (
          <>
            <View
              style={
                styles.modeBox
              }
            >
              {MODES.map(
                (mode) => (
                  <Pressable
                    key={
                      mode.value
                    }
                    style={[
                      styles.modeRow,
                      joinMode ===
                        mode.value &&
                        styles.modeRowActive,
                    ]}
                    onPress={() =>
                      setJoinMode(
                        mode.value
                      )
                    }
                  >
                    <View
                      style={
                        styles.modeCopy
                      }
                    >
                      <Text
                        style={
                          styles.rowTitle
                        }
                      >
                        {
                          mode.label
                        }
                      </Text>

                      <Text
                        style={
                          styles.rowSubtitle
                        }
                      >
                        {
                          mode.subtitle
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        joinMode ===
                          mode.value &&
                          styles.radioActive,
                      ]}
                    />
                  </Pressable>
                )
              )}
            </View>

            <Field
              label="Capacity"
              value={
                capacity
              }
              onChangeText={(
                value
              ) =>
                setCapacity(
                  value.replace(
                    /[^0-9]/g,
                    ''
                  )
                )
              }
              placeholder="Unlimited"
              keyboardType="number-pad"
            />
          </>
        )}

        <SelectToggleRow
          title="Reply"
          subtitle="Allow people to reply privately to this Drop."
          value={
            replyEnabled
          }
          onPress={() =>
            setReplyEnabled(
              (value) =>
                !value
            )
          }
        />

        <SelectToggleRow
          title="Comments"
          subtitle="Public questions and discussion under the Drop."
          value={
            commentsEnabled
          }
          onPress={() =>
            setCommentsEnabled(
              (value) =>
                !value
            )
          }
        />

        <SelectToggleRow
          title="Event rating"
          subtitle="Participants can rate this Drop after it ends."
          value={
            ratingEnabled
          }
          onPress={() =>
            setRatingEnabled(
              (value) =>
                !value
            )
          }
        />
      </ScrollView>

      <DropDateTimePicker
        visible={
          datePicker !==
          null
        }
        title={
          datePicker ===
          'end'
            ? 'Drop ends'
            : 'Drop starts'
        }
        value={
          datePicker ===
          'end'
            ? eventEnd
            : eventStart
        }
        minimumDate={
          datePicker ===
          'end'
            ? eventStart ??
              new Date()
            : new Date()
        }
        onClose={() =>
          setDatePicker(
            null
          )
        }
        onConfirm={(
          date
        ) => {
          if (
            datePicker ===
            'end'
          ) {
            if (
              eventStart &&
              date <=
                eventStart
            ) {
              Alert.alert(
                'End time',
                'End time must be later than start time.'
              );
              return;
            }

            setEventEnd(
              date
            );
          } else {
            setEventStart(
              date
            );

            if (
              eventEnd &&
              eventEnd <=
                date
            ) {
              setEventEnd(
                null
              );
            }
          }

          setDatePicker(
            null
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  suffix = '',
}: {
  label: string;
  value: string;
  onChangeText:
    (
      value: string
    ) => void;
  placeholder:
    string;
  multiline?: boolean;
  keyboardType?:
    | 'default'
    | 'number-pad';
  suffix?: string;
}) {
  return (
    <View
      style={[
        styles.fieldRow,
        multiline &&
          styles.fieldRowMultiline,
      ]}
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.inputWrap
        }
      >
        {multiline &&
          !value && (
          <Text
            pointerEvents="none"
            style={
              styles.multilinePlaceholder
            }
          >
            {
              placeholder
            }
          </Text>
        )}

        <TextInput
          value={value}
          onChangeText={
            onChangeText
          }
          placeholder={
            multiline
              ? ''
              : placeholder
          }
          placeholderTextColor={
            DropColors.textMuted
          }
          style={[
            styles.fieldInput,
            multiline &&
              styles.fieldInputMultiline,
          ]}
          multiline={
            multiline
          }
          keyboardType={
            keyboardType
          }
          selectionColor={
            DropColors.wine
          }
        />

        {!!value &&
          !!suffix && (
          <Text
            style={
              styles.suffix
            }
          >
            {suffix}
          </Text>
        )}
      </View>
    </View>
  );
}

function DateField({
  label,
  value,
  placeholder,
  optional = false,
  onPress,
}: {
  label: string;
  value: string;
  placeholder:
    string;
  optional?: boolean;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      style={
        styles.fieldRow
      }
      onPress={onPress}
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.valueWrap
        }
      >
        <Text
          numberOfLines={
            1
          }
          style={[
            styles.fieldValue,
            !value &&
              styles.placeholder,
          ]}
        >
          {value ||
            placeholder}
        </Text>

        {optional && (
          <Text
            style={
              styles.optional
            }
          >
            OPTIONAL
          </Text>
        )}
      </View>
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
  subtitle:
    string;
  value: boolean;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      style={[
        styles.modeRow,
        value &&
          styles.modeRowActive,
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.modeCopy
        }
      >
        <Text
          style={
            styles.rowTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.rowSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          value &&
            styles.radioActive,
        ]}
      />
    </Pressable>
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
      backgroundColor:
        DropColors.graphite,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 52,
      minHeight: 96,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    headerSide: {
      width: 70,
    },

    cancel: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    save: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
      textAlign:
        'right',
    },

    headerTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 16,
    },

    content: {
      paddingBottom: 64,
    },

    sectionLabel: {
      marginTop: 0,
      paddingTop: 18,
      paddingBottom: 8,
      paddingHorizontal: 18,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.2,
    },

    composerBox: {
      position:
        'relative',
      minHeight: 144,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    mainInput: {
      minHeight: 144,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 32,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 20,
      lineHeight: 27,
      textAlignVertical:
        'top',
    },

    counter: {
      position:
        'absolute',
      right: 18,
      bottom: 10,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      textAlign:
        'right',
    },

    fieldRow: {
      minHeight: 58,
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

    fieldRowMultiline: {
      minHeight: 82,
      alignItems:
        'center',
    },

    fieldLabel: {
      width: 92,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
    },

    inputWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
    },

    fieldInput: {
      flex: 1,
      minWidth: 0,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      paddingVertical: 10,
      textAlign:
        'right',
    },

    fieldInputMultiline: {
      minHeight: 64,
      paddingVertical: 0,
      textAlign:
        'right',
      textAlignVertical:
        'center',
    },

    multilinePlaceholder: {
      position:
        'absolute',
      right: 0,
      top: '50%',
      transform: [
        {
          translateY:
            -8,
        },
      ],
      lineHeight: 16,
      textAlignVertical:
        'center',
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      includeFontPadding:
        false,
    },

    suffix: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
      marginLeft: 2,
    },

    valueWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      gap: 14,
    },

    fieldValue: {
      flexShrink: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      textAlign:
        'right',
    },

    placeholder: {
      color:
        DropColors.textMuted,
    },

    optional: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 9,
      letterSpacing: 0.8,
    },

    switchRow: {
      minHeight: 72,
      paddingHorizontal: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    modeBox: {},

    modeRow: {
      minHeight: 66,
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

    modeRowActive: {
      backgroundColor:
        '#151515',
    },

    modeCopy: {
      flex: 1,
      paddingRight: 14,
    },

    rowTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    rowSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 3,
    },

    radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        DropColors.textMuted,
    },

    radioActive: {
      borderWidth: 5,
      borderColor:
        DropColors.wine,
    },
  });
