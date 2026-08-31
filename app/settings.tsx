import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Visibility =
  | 'everyone'
  | 'mutuals'
  | 'nobody';

type SettingsProfile = {
  id: string;
  bio_visibility: Visibility;
  city_visibility: Visibility;
  show_followers: boolean;
  show_following: boolean;
  default_join_enabled: boolean;
  default_reply_enabled: boolean;
};

type RadioRowProps = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  showDivider?: boolean;
};

type ToggleDotRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
  showDivider?: boolean;
};

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  subtitle: string;
}[] = [
  {
    value: 'everyone',
    label: 'Everyone',
    subtitle: 'Visible to anyone who opens your profile.',
  },
  {
    value: 'mutuals',
    label: 'Mutuals',
    subtitle: 'Visible only to people you follow each other.',
  },
  {
    value: 'nobody',
    label: 'Nobody',
    subtitle: 'Keep this information private.',
  },
];

function RadioRow({
  title,
  subtitle,
  selected,
  onPress,
  disabled = false,
  showDivider = true,
}: RadioRowProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        showDivider &&
          styles.rowDivider,
        selected &&
          styles.optionRowSelected,
        pressed &&
          !disabled &&
          styles.rowPressed,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionTitle,
            selected &&
              styles.optionTitleSelected,
          ]}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text style={styles.optionSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      />
    </Pressable>
  );
}

function ToggleDotRow({
  title,
  subtitle,
  value,
  onPress,
  disabled = false,
  showDivider = true,
}: ToggleDotRowProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        showDivider &&
          styles.rowDivider,
        value &&
          styles.optionRowSelected,
        pressed &&
          !disabled &&
          styles.rowPressed,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionTitle,
            value &&
              styles.optionTitleSelected,
          ]}
        >
          {title}
        </Text>

        <Text style={styles.optionSubtitle}>
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          value &&
            styles.radioSelected,
        ]}
      />
    </Pressable>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>
        {eyebrow}
      </Text>

      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {!!subtitle && (
        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function VisibilityBlock({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: Visibility;
  onChange: (
    value: Visibility
  ) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>
          {title}
        </Text>

        <Text style={styles.cardValue}>
          {
            VISIBILITY_OPTIONS.find(
              (option) =>
                option.value ===
                value
            )?.label
          }
        </Text>
      </View>

      <View style={styles.cardOptions}>
        {VISIBILITY_OPTIONS.map(
          (
            option,
            index
          ) => (
            <RadioRow
              key={option.value}
              title={option.label}
              subtitle={option.subtitle}
              selected={
                value ===
                option.value
              }
              onPress={() =>
                onChange(
                  option.value
                )
              }
              disabled={disabled}
              showDivider={
                index !== 0
              }
            />
          )
        )}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const [
    original,
    setOriginal,
  ] =
    useState<SettingsProfile | null>(
      null
    );

  const [
    settings,
    setSettings,
  ] =
    useState<SettingsProfile | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  useEffect(
    () => {
      void loadSettings();
    },
    []
  );

  const loadSettings =
    async () => {
      try {
        setLoading(true);

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
              id,
              bio_visibility,
              city_visibility,
              show_followers,
              show_following,
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
            'LOAD SETTINGS ERROR:',
            error
          );

          Alert.alert(
            'Could not load settings',
            error.message
          );
          return;
        }

        const normalized:
          SettingsProfile =
          {
            id:
              data.id,
            bio_visibility:
              (
                data.bio_visibility ??
                'everyone'
              ) as Visibility,
            city_visibility:
              (
                data.city_visibility ??
                'everyone'
              ) as Visibility,
            show_followers:
              data.show_followers ??
              true,
            show_following:
              data.show_following ??
              true,
            default_join_enabled:
              data.default_join_enabled ??
              true,
            default_reply_enabled:
              data.default_reply_enabled ??
              true,
          };

        setOriginal(
          normalized
        );

        setSettings(
          normalized
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const hasChanges =
    useMemo(
      () => {
        if (
          !settings ||
          !original
        ) {
          return false;
        }

        return (
          settings.bio_visibility !==
            original.bio_visibility ||
          settings.city_visibility !==
            original.city_visibility ||
          settings.show_followers !==
            original.show_followers ||
          settings.show_following !==
            original.show_following ||
          settings.default_join_enabled !==
            original.default_join_enabled ||
          settings.default_reply_enabled !==
            original.default_reply_enabled
        );
      },
      [
        settings,
        original,
      ]
    );

  const updateSetting = <
    K extends
      keyof SettingsProfile,
  >(
    key: K,
    value:
      SettingsProfile[K]
  ) => {
    setSettings(
      (
        current
      ) =>
        current
          ? {
              ...current,
              [key]:
                value,
            }
          : current
    );
  };

  const handleSave =
    async () => {
      if (
        !settings ||
        !hasChanges ||
        saving
      ) {
        return;
      }

      try {
        setSaving(
          true
        );

        const {
          error,
        } =
          await supabase
            .from(
              'profiles'
            )
            .update({
              bio_visibility:
                settings.bio_visibility,
              city_visibility:
                settings.city_visibility,
              show_followers:
                settings.show_followers,
              show_following:
                settings.show_following,
              default_join_enabled:
                settings.default_join_enabled,
              default_reply_enabled:
                settings.default_reply_enabled,
            })
            .eq(
              'id',
              settings.id
            );

        if (
          error
        ) {
          Alert.alert(
            'Could not save settings',
            error.message
          );
          return;
        }

        setOriginal({
          ...settings,
        });

        Alert.alert(
          'Saved',
          'Your settings have been updated.'
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const handleBack =
    () => {
      if (
        !hasChanges ||
        saving
      ) {
        router.back();
        return;
      }

      Alert.alert(
        'Discard changes?',
        'You have unsaved settings.',
        [
          {
            text: 'Keep editing',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () =>
              router.back(),
          },
        ]
      );
    };

  const handleLogout =
    () => {
      Alert.alert(
        'Log out',
        'Are you sure you want to log out?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Log out',
            style: 'destructive',
            onPress:
              async () => {
                const {
                  error,
                } =
                  await supabase.auth.signOut();

                if (
                  error
                ) {
                  Alert.alert(
                    'Log out error',
                    error.message
                  );
                }
              },
          },
        ]
      );
    };

  if (
    loading ||
    !settings
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={
            DropColors.warmWhite
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={
            handleBack
          }
          hitSlop={12}
          style={
            styles.headerSide
          }
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={20}
            color={
              DropColors.warmWhite
            }
          />
        </Pressable>

        <Text style={styles.title}>
          Settings
        </Text>

        <View
          style={
            styles.headerSide
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <SectionHeader
          eyebrow="PROFILE"
          title="Your profile"
          subtitle="Profile details and what other people can see."
        />

        <Pressable
          style={({
            pressed,
          }) => [
            styles.navigationCard,
            pressed &&
              styles.rowPressed,
          ]}
          onPress={() =>
            router.push(
              '/edit-profile'
            )
          }
        >
          <View
            style={
              styles.navigationIcon
            }
          >
            <MaterialIcons
              name="person-outline"
              size={20}
              color={
                DropColors.warmWhite
              }
            />
          </View>

          <View
            style={
              styles.navigationCopy
            }
          >
            <Text
              style={
                styles.navigationTitle
              }
            >
              Edit profile
            </Text>

            <Text
              style={
                styles.navigationSubtitle
              }
            >
              Avatar, username, name,
              bio and city
            </Text>
          </View>

          <MaterialIcons
            name="chevron-right"
            size={24}
            color={
              DropColors.textMuted
            }
          />
        </Pressable>

        <SectionHeader
          eyebrow="PRIVACY"
          title="Profile visibility"
          subtitle="Choose exactly how much of your profile is public."
        />

        <VisibilityBlock
          title="Bio"
          value={
            settings.bio_visibility
          }
          onChange={(
            value
          ) =>
            updateSetting(
              'bio_visibility',
              value
            )
          }
          disabled={
            saving
          }
        />

        <View
          style={
            styles.cardGap
          }
        />

        <VisibilityBlock
          title="City"
          value={
            settings.city_visibility
          }
          onChange={(
            value
          ) =>
            updateSetting(
              'city_visibility',
              value
            )
          }
          disabled={
            saving
          }
        />

        <View
          style={
            styles.cardGap
          }
        />

        <View style={styles.card}>
          <View
            style={
              styles.cardHeading
            }
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              Connections
            </Text>

            <Text
              style={
                styles.cardValue
              }
            >
              Lists
            </Text>
          </View>

          <View
            style={
              styles.cardOptions
            }
          >
            <ToggleDotRow
              title="Followers list"
              subtitle="Allow people to open your followers list."
              value={
                settings.show_followers
              }
              onPress={() =>
                updateSetting(
                  'show_followers',
                  !settings.show_followers
                )
              }
              disabled={
                saving
              }
              showDivider={
                false
              }
            />

            <ToggleDotRow
              title="Following list"
              subtitle="Allow people to open your following list."
              value={
                settings.show_following
              }
              onPress={() =>
                updateSetting(
                  'show_following',
                  !settings.show_following
                )
              }
              disabled={
                saving
              }
            />
          </View>
        </View>

        <SectionHeader
          eyebrow="DROP DEFAULTS"
          title="New Drop behavior"
          subtitle="These choices become the starting state for every new Drop."
        />

        <View style={styles.card}>
          <View
            style={
              styles.cardHeading
            }
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              Interactions
            </Text>

            <Text
              style={
                styles.cardValue
              }
            >
              Defaults
            </Text>
          </View>

          <View
            style={
              styles.cardOptions
            }
          >
            <ToggleDotRow
              title="Join"
              subtitle="New Drops start with Join enabled."
              value={
                settings.default_join_enabled
              }
              onPress={() =>
                updateSetting(
                  'default_join_enabled',
                  !settings.default_join_enabled
                )
              }
              disabled={
                saving
              }
              showDivider={
                false
              }
            />

            <ToggleDotRow
              title="Reply"
              subtitle="New Drops start with Reply enabled."
              value={
                settings.default_reply_enabled
              }
              onPress={() =>
                updateSetting(
                  'default_reply_enabled',
                  !settings.default_reply_enabled
                )
              }
              disabled={
                saving
              }
            />
          </View>
        </View>

        <Pressable
          disabled={
            !hasChanges ||
            saving
          }
          onPress={
            handleSave
          }
          style={({
            pressed,
          }) => [
            styles.saveButton,
            (
              !hasChanges ||
              saving
            ) &&
              styles.saveButtonDisabled,
            pressed &&
              hasChanges &&
              !saving &&
              styles.saveButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.saveButtonText,
              !hasChanges &&
                styles.saveButtonTextDisabled,
            ]}
          >
            {saving
              ? 'Saving...'
              : 'Save changes'}
          </Text>

          <MaterialIcons
            name="arrow-forward"
            size={20}
            color={
              hasChanges
                ? DropColors.warmWhite
                : DropColors.textMuted
            }
          />
        </Pressable>

        <SectionHeader
          eyebrow="ACCOUNT"
          title="Account"
        />

        <Pressable
          style={({
            pressed,
          }) => [
            styles.logoutRow,
            pressed &&
              styles.rowPressed,
          ]}
          onPress={
            handleLogout
          }
        >
          <View>
            <Text
              style={
                styles.logoutTitle
              }
            >
              Log out
            </Text>

            <Text
              style={
                styles.logoutSubtitle
              }
            >
              Sign out of this account
              on this device.
            </Text>
          </View>

          <MaterialIcons
            name="logout"
            size={20}
            color={
              DropColors.wine
            }
          />
        </Pressable>

        <Text style={styles.footer}>
          DROP
        </Text>
      </ScrollView>
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
    center: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    header: {
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerSide: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.bold,
      fontSize: 18,
    },
    content: {
      paddingBottom: 64,
    },
    sectionHeader: {
      paddingTop: 30,
      paddingHorizontal: 22,
      paddingBottom: 12,
    },
    sectionEyebrow: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.bold,
      fontSize: 10,
      letterSpacing: 1.8,
      marginBottom: 8,
    },
    sectionTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 20,
      lineHeight: 24,
    },
    sectionSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 5,
      maxWidth: 330,
    },
    navigationCard: {
      minHeight: 78,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    navigationIcon: {
      width: 34,
      height: 34,
      alignItems: 'flex-start',
      justifyContent:
        'center',
    },
    navigationCopy: {
      flex: 1,
    },
    navigationTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 15,
    },
    navigationSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    card: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },
    cardGap: {
      height: 0,
    },
    cardHeading: {
      minHeight: 52,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },
    cardTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 14,
    },
    cardValue: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform:
        'uppercase',
    },
    cardOptions: {
      paddingHorizontal: 22,
    },
    fullBleedDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: DropColors.border,
      marginHorizontal: -22,
    },
    optionRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 12,
    },
    optionRowSelected: {
      backgroundColor:
        'rgba(125, 13, 13, 0.06)',
    },
    rowDivider: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      marginHorizontal: -22,
      paddingHorizontal: 22,
    },
    optionCopy: {
      flex: 1,
    },
    optionTitle: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 14,
    },
    optionTitleSelected: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
    },
    optionSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    radio: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor:
        DropColors.textMuted,
      backgroundColor:
        'transparent',
    },
    radioSelected: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 0,
      backgroundColor:
        DropColors.wine,
      marginHorizontal: 2,
    },
    rowPressed: {
      opacity: 0.72,
    },
    saveButton: {
      minHeight: 72,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      marginTop: 30,
      paddingHorizontal: 22,
      backgroundColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },
    saveButtonDisabled: {
      opacity: 0.62,
    },
    saveButtonPressed: {
      opacity: 0.84,
    },
    saveButtonText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 14,
    },
    saveButtonTextDisabled: {
      color:
        DropColors.textSecondary,
    },
    logoutRow: {
      minHeight: 72,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },
    logoutTitle: {
      color:
        DropColors.wine,
      fontFamily:
        DropTypography.semibold,
      fontSize: 14,
    },
    logoutSubtitle: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    footer: {
      textAlign: 'center',
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.bold,
      fontSize: 9,
      letterSpacing: 3,
      marginTop: 38,
      opacity: 0.42,
    },
  });
