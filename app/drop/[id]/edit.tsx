import { DropDateTimePicker } from '@/components/drop-date-time-picker';
import {
  LocationPicker,
  type DropLocationValue,
} from '@/components/location-picker';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

type JoinMode = 'request' | 'free' | 'invite_only';

const MODES: {
  value: JoinMode;
  label: string;
  subtitle: string;
}[] = [
  {
    value: 'request',
    label: 'Request to join',
    subtitle: 'Organizer approves each request.',
  },
  {
    value: 'free',
    label: 'Free join',
    subtitle: 'People join immediately without approval.',
  },
  {
    value: 'invite_only',
    label: 'Invite only',
    subtitle: 'Only organizer invitations can add people.',
  },
];

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}

function locationLabel(location: DropLocationValue | null) {
  if (!location) {
    return '';
  }

  return location.name || location.address || '';
}

export default function EditDropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState('');
  const [eventStart, setEventStart] = useState<Date | null>(null);
  const [eventEnd, setEventEnd] = useState<Date | null>(null);
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);

  const [location, setLocation] = useState<DropLocationValue | null>(null);
  const [legacyLocationText, setLegacyLocationText] = useState('');
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const [age, setAge] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [price, setPrice] = useState('');
  const [language, setLanguage] = useState('');
  const [conditions, setConditions] = useState('');
  const [hashtags, setHashtags] = useState('');

  const [joinEnabled, setJoinEnabled] = useState(true);
  const [joinMode, setJoinMode] = useState<JoinMode>('request');
  const [capacity, setCapacity] = useState('');
  const [replyEnabled, setReplyEnabled] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user ?? null;

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from('drops')
          .select(`
            text,
            event_time,
            event_end_time,
            location_text,
            location_type,
            location_name,
            location_address,
            location_lat,
            location_lng,
            location_radius_m,
            location_provider_id,
            age_restriction,
            join_limit,
            join_enabled,
            join_mode,
            reply_enabled,
            comments_enabled,
            rating_enabled,
            dress_code,
            conditions,
            price_text,
            language_text,
            hashtags
          `)
          .eq('id', id)
          .eq('author_id', user.id)
          .maybeSingle();

        if (error || !data) {
          throw error ?? new Error('Drop not found');
        }

        if (cancelled) {
          return;
        }

        setText(data.text ?? '');
        setEventStart(data.event_time ? new Date(data.event_time) : null);
        setEventEnd(data.event_end_time ? new Date(data.event_end_time) : null);

        const hasDropLocationValue =
          (data.location_type === 'place' || data.location_type === 'area') &&
          typeof data.location_lat === 'number' &&
          typeof data.location_lng === 'number';

        if (hasDropLocationValue) {
          setLocation({
            type: data.location_type,
            name: data.location_name ?? data.location_text ?? '',
            address: data.location_address ?? '',
            latitude: data.location_lat,
            longitude: data.location_lng,
            radiusM:
              data.location_type === 'area'
                ? data.location_radius_m ?? 1200
                : null,
            providerId: data.location_provider_id ?? null,
          });
          setLegacyLocationText('');
        } else {
          setLocation(null);
          setLegacyLocationText(data.location_text ?? '');
        }

        setAge(
          String(data.age_restriction ?? '')
            .replace(/\+$/, '')
            .replace(/\D/g, '')
            .slice(0, 2)
        );
        setDressCode(data.dress_code ?? '');
        setPrice(data.price_text ?? '');
        setLanguage(data.language_text ?? '');
        setConditions(data.conditions ?? '');
        setHashtags(
          (data.hashtags ?? [])
            .map((tag: string) => `#${tag.replace(/^#/, '')}`)
            .join(' ')
        );
        setJoinEnabled(data.join_enabled ?? true);
        setJoinMode((data.join_mode as JoinMode) ?? 'request');
        setCapacity(data.join_limit ? String(data.join_limit) : '');
        setReplyEnabled(data.reply_enabled ?? true);
        setCommentsEnabled(data.comments_enabled ?? false);
        setRatingEnabled(data.rating_enabled ?? false);
      } catch (error) {
        console.error('LOAD EDIT DROP ERROR:', error);

        if (!cancelled) {
          Alert.alert('Error', 'Could not load this Drop.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const parsedCapacity = useMemo(() => {
    if (!capacity.trim()) {
      return null;
    }

    const value = Number(capacity);

    return Number.isInteger(value) && value > 0 ? value : undefined;
  }, [capacity]);

  const save = async () => {
    if (!id || saving || !text.trim()) {
      return;
    }

    if (parsedCapacity === undefined) {
      Alert.alert(
        'Capacity',
        'Enter a positive number or leave the field empty.'
      );
      return;
    }

    if (eventStart && eventEnd && eventEnd <= eventStart) {
      Alert.alert('End time', 'End time must be later than start time.');
      return;
    }

    try {
      setSaving(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (!user) {
        return;
      }

      const normalizedTags = hashtags
        .split(/[\s,]+/)
        .map((item) =>
          item
            .trim()
            .replace(/^#/, '')
            .toLowerCase()
        )
        .filter(Boolean)
        .slice(0, 10);

      const displayLocation = location
        ? locationLabel(location)
        : legacyLocationText.trim();

      const { error } = await supabase
        .from('drops')
        .update({
          text: text.trim(),
          event_time: eventStart?.toISOString() ?? null,
          event_end_time: eventEnd?.toISOString() ?? null,

          location_text: displayLocation || null,
          location_type: location?.type ?? null,
          location_name: location?.name || null,
          location_address: location?.address || null,
          location_lat: location?.latitude ?? null,
          location_lng: location?.longitude ?? null,
          location_radius_m:
            location?.type === 'area'
              ? location.radiusM ?? 1200
              : null,
          location_provider_id: location?.providerId ?? null,

          age_restriction: age.trim() ? `${age.trim()}+` : null,
          dress_code: dressCode.trim() || null,
          price_text: price.trim() || null,
          language_text: language.trim() || null,
          conditions: conditions.trim() || null,
          hashtags: normalizedTags,
          join_enabled: joinEnabled,
          join_mode: joinEnabled ? joinMode : 'request',
          join_limit: joinEnabled ? parsedCapacity : null,
          reply_enabled: replyEnabled,
          comments_enabled: commentsEnabled,
          rating_enabled: ratingEnabled,
        })
        .eq('id', id)
        .eq('author_id', user.id);

      if (error) {
        throw error;
      }

      router.back();
    } catch (error) {
      console.error('EDIT DROP ERROR:', error);
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={DropColors.warmWhite} />
      </View>
    );
  }

  const displayedLocation = location
    ? locationLabel(location)
    : legacyLocationText;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Edit Drop</Text>

        <Pressable
          onPress={save}
          disabled={saving}
          style={styles.headerSide}
        >
          <Text style={styles.save}>
            {saving ? '...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>DROP</Text>

        <View style={styles.composerBox}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={280}
            style={styles.mainInput}
            selectionColor={DropColors.wine}
          />

          <Text style={styles.counter}>
            {text.length}/280
          </Text>
        </View>

        <Text style={styles.sectionLabel}>WHEN</Text>

        <DateField
          label="Starts"
          value={formatDate(eventStart)}
          placeholder="Add date & time"
          onPress={() => setDatePicker('start')}
        />

        <DateField
          label="Ends"
          value={formatDate(eventEnd)}
          placeholder="Add date & time"
          onPress={() => setDatePicker('end')}
        />

        <Text style={styles.sectionLabel}>LOCATION</Text>

        <Pressable
          style={styles.fieldRow}
          onPress={() => setLocationPickerVisible(true)}
        >
          <Text style={styles.fieldLabel}>Location</Text>

          <View style={styles.locationValueWrap}>
            <View style={styles.locationCopy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.fieldValue,
                  !displayedLocation && styles.placeholder,
                ]}
              >
                {displayedLocation || 'Optional'}
              </Text>

              {!!location && (
                <Text style={styles.locationType}>
                  {location.type === 'area'
                    ? 'AREA · APPROXIMATE'
                    : 'PLACE · EXACT'}
                </Text>
              )}

              {!location && !!legacyLocationText && (
                <Text style={styles.locationType}>
                  LEGACY LOCATION · SELECT TO UPDATE
                </Text>
              )}
            </View>

            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>AGE</Text>

        <Field
          label="Age"
          value={age}
          onChangeText={(value) =>
            setAge(
              value
                .replace(/[^0-9]/g, '')
                .slice(0, 2)
            )
          }
          placeholder="Optional"
          keyboardType="number-pad"
          suffix="+"
        />

        <Text style={styles.sectionLabel}>EVENT DETAILS</Text>

        <Field
          label="Dress code"
          value={dressCode}
          onChangeText={setDressCode}
          placeholder="Optional"
        />

        <Field
          label="Price"
          value={price}
          onChangeText={setPrice}
          placeholder="Optional"
        />

        <Field
          label="Language"
          value={language}
          onChangeText={setLanguage}
          placeholder="Optional"
        />

        <Field
          label="Conditions"
          value={conditions}
          onChangeText={setConditions}
          placeholder="Optional"
          multiline
        />

        <Field
          label="Hashtags"
          value={hashtags}
          onChangeText={setHashtags}
          placeholder="#riga #rave · optional"
        />

        <Text style={styles.sectionLabel}>PARTICIPATION</Text>

        <SelectToggleRow
          title="Join"
          subtitle="Allow people to participate in this Drop."
          value={joinEnabled}
          onPress={() => setJoinEnabled((value) => !value)}
        />

        {joinEnabled && (
          <>
            <View>
              {MODES.map((mode) => (
                <Pressable
                  key={mode.value}
                  style={[
                    styles.modeRow,
                    joinMode === mode.value && styles.modeRowActive,
                  ]}
                  onPress={() => setJoinMode(mode.value)}
                >
                  <View style={styles.modeCopy}>
                    <Text style={styles.rowTitle}>
                      {mode.label}
                    </Text>

                    <Text style={styles.rowSubtitle}>
                      {mode.subtitle}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radio,
                      joinMode === mode.value && styles.radioActive,
                    ]}
                  />
                </Pressable>
              ))}
            </View>

            <Field
              label="Capacity"
              value={capacity}
              onChangeText={(value) =>
                setCapacity(value.replace(/[^0-9]/g, ''))
              }
              placeholder="Unlimited"
              keyboardType="number-pad"
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
      </ScrollView>

      <DropDateTimePicker
        visible={datePicker !== null}
        title={datePicker === 'end' ? 'Drop ends' : 'Drop starts'}
        value={datePicker === 'end' ? eventEnd : eventStart}
        minimumDate={
          datePicker === 'end'
            ? eventStart ?? new Date()
            : new Date()
        }
        onClose={() => setDatePicker(null)}
        onConfirm={(date) => {
          if (datePicker === 'end') {
            if (eventStart && date <= eventStart) {
              Alert.alert(
                'End time',
                'End time must be later than start time.'
              );
              return;
            }

            setEventEnd(date);
          } else {
            setEventStart(date);

            if (eventEnd && eventEnd <= date) {
              setEventEnd(null);
            }
          }

          setDatePicker(null);
        }}
      />

      <LocationPicker
        visible={locationPickerVisible}
        value={location}
        onChange={(nextLocation) => {
          setLocation(nextLocation);
          setLegacyLocationText('');
        }}
        onClose={() => {
          setLocationPickerVisible(false);
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
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
  suffix?: string;
}) {
  return (
    <View
      style={[
        styles.fieldRow,
        multiline && styles.fieldRowMultiline,
      ]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.inputWrap}>
        {multiline && !value && (
          <Text
            pointerEvents="none"
            style={styles.multilinePlaceholder}
          >
            {placeholder}
          </Text>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={multiline ? '' : placeholder}
          placeholderTextColor={DropColors.textMuted}
          style={[
            styles.fieldInput,
            multiline && styles.fieldInputMultiline,
          ]}
          multiline={multiline}
          keyboardType={keyboardType}
          selectionColor={DropColors.wine}
        />

        {!!value && !!suffix && (
          <Text style={styles.suffix}>{suffix}</Text>
        )}
      </View>
    </View>
  );
}

function DateField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.fieldRow}
      onPress={onPress}
    >
      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={styles.valueWrap}>
        <Text
          numberOfLines={1}
          style={[
            styles.fieldValue,
            !value && styles.placeholder,
          ]}
        >
          {value || placeholder}
        </Text>
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
  subtitle: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.modeRow,
        value && styles.modeRowActive,
      ]}
      onPress={onPress}
    >
      <View style={styles.modeCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <View
        style={[
          styles.radio,
          value && styles.radioActive,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },
  center: {
    flex: 1,
    backgroundColor: DropColors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 52,
    minHeight: 96,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  headerSide: {
    width: 70,
  },
  cancel: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  save: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
    textAlign: 'right',
  },
  headerTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
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
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  composerBox: {
    position: 'relative',
    minHeight: 144,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  mainInput: {
    minHeight: 144,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 20,
    lineHeight: 27,
    textAlignVertical: 'top',
  },
  counter: {
    position: 'absolute',
    right: 18,
    bottom: 10,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
    textAlign: 'right',
  },
  fieldRow: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  fieldRowMultiline: {
    minHeight: 82,
    alignItems: 'center',
  },
  fieldLabel: {
    width: 92,
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 12,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 13,
    paddingVertical: 10,
    textAlign: 'right',
  },
  fieldInputMultiline: {
    minHeight: 64,
    paddingVertical: 0,
    textAlign: 'right',
    textAlignVertical: 'center',
  },
  multilinePlaceholder: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -8 }],
    lineHeight: 16,
    textAlignVertical: 'center',
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 13,
    includeFontPadding: false,
  },
  suffix: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
    marginLeft: 2,
  },
  valueWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  locationValueWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  fieldValue: {
    flexShrink: 1,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 13,
    textAlign: 'right',
  },
  locationType: {
    marginTop: 3,
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  chevron: {
    marginLeft: 10,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 22,
    lineHeight: 24,
  },
  placeholder: {
    color: DropColors.textMuted,
  },
  modeRow: {
    minHeight: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  modeRowActive: {
    backgroundColor: '#151515',
  },
  modeCopy: {
    flex: 1,
    paddingRight: 14,
  },
  rowTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  rowSubtitle: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DropColors.textMuted,
  },
  radioActive: {
    borderWidth: 5,
    borderColor: DropColors.wine,
  },
});