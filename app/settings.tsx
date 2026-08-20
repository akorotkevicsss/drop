import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';

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

type VisibilitySelectorProps = {
  value: Visibility;
  onChange: (
    value: Visibility
  ) => void;
  disabled?: boolean;
};

function VisibilitySelector({
  value,
  onChange,
  disabled = false,
}: VisibilitySelectorProps) {
  const options: {
    value: Visibility;
    label: string;
  }[] = [
    {
      value: 'everyone',
      label: 'Everyone',
    },
    {
      value: 'mutuals',
      label: 'Mutuals',
    },
    {
      value: 'nobody',
      label: 'Nobody',
    },
  ];

  return (
    <View style={styles.selector}>
      {options.map((option) => {
        const selected =
          value === option.value;

        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() =>
              onChange(
                option.value
              )
            }
            style={[
              styles.selectorOption,
              selected &&
                styles.selectorOptionSelected,
              disabled &&
                styles.controlDisabled,
            ]}
          >
            <Text
              style={[
                styles.selectorText,
                selected &&
                  styles.selectorTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
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
          .from('profiles')
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

      if (error) {
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

      const normalized: SettingsProfile = {
        id: data.id,

        bio_visibility:
          (data.bio_visibility ??
            'everyone') as Visibility,

        city_visibility:
          (data.city_visibility ??
            'everyone') as Visibility,

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
    } catch (error) {
      console.error(
        'SETTINGS LOAD ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Something went wrong while loading settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    useMemo(() => {
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
    }, [
      settings,
      original,
    ]);

  const updateSetting = <
    K extends keyof SettingsProfile,
  >(
    key: K,
    value:
      SettingsProfile[K]
  ) => {
    setSettings(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [key]: value,
        };
      }
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
        setSaving(true);

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

        if (error) {
          console.error(
            'SAVE SETTINGS ERROR:',
            error
          );

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
        setSaving(false);
      }
    };

  const handleBack = () => {
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

  const handleLogout = () => {
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
          onPress: async () => {
            const {
              error,
            } =
              await supabase.auth.signOut();

            if (error) {
              console.error(
                'LOGOUT ERROR:',
                error
              );

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
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator />
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
        <Pressable
          onPress={
            handleBack
          }
          hitSlop={10}
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
            styles.title
          }
        >
          Settings
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
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          PROFILE
        </Text>

        <Pressable
          style={
            styles.navigationRow
          }
          onPress={() =>
            router.push(
              '/edit-profile'
            )
          }
        >
          <View
            style={
              styles.rowTextContainer
            }
          >
            <Text
              style={
                styles.rowTitle
              }
            >
              Edit profile
            </Text>

            <Text
              style={
                styles.rowDescription
              }
            >
              Avatar, username, name, bio and city
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </Pressable>

        <Text
          style={
            styles.sectionTitle
          }
        >
          PROFILE PRIVACY
        </Text>

        <View
          style={
            styles.settingBlock
          }
        >
          <Text
            style={
              styles.settingTitle
            }
          >
            Bio
          </Text>

          <Text
            style={
              styles.settingDescription
            }
          >
            Choose who can see your bio.
          </Text>

          <VisibilitySelector
            value={
              settings.bio_visibility
            }
            onChange={(value) =>
              updateSetting(
                'bio_visibility',
                value
              )
            }
            disabled={
              saving
            }
          />
        </View>

        <View
          style={
            styles.settingBlock
          }
        >
          <Text
            style={
              styles.settingTitle
            }
          >
            City
          </Text>

          <Text
            style={
              styles.settingDescription
            }
          >
            Choose who can see your city.
          </Text>

          <VisibilitySelector
            value={
              settings.city_visibility
            }
            onChange={(value) =>
              updateSetting(
                'city_visibility',
                value
              )
            }
            disabled={
              saving
            }
          />
        </View>

        <View
          style={
            styles.switchGroup
          }
        >
          <View
            style={
              styles.switchRow
            }
          >
            <View
              style={
                styles.rowTextContainer
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Followers list
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Your follower count remains visible.
              </Text>
            </View>

            <Switch
              value={
                settings.show_followers
              }
              onValueChange={(value) =>
                updateSetting(
                  'show_followers',
                  value
                )
              }
              disabled={
                saving
              }
            />
          </View>

          <View
            style={[
              styles.switchRow,
              styles.switchRowBorder,
            ]}
          >
            <View
              style={
                styles.rowTextContainer
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Following list
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Your following count remains visible.
              </Text>
            </View>

            <Switch
              value={
                settings.show_following
              }
              onValueChange={(value) =>
                updateSetting(
                  'show_following',
                  value
                )
              }
              disabled={
                saving
              }
            />
          </View>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          DROP DEFAULTS
        </Text>

        <View
          style={
            styles.switchGroup
          }
        >
          <View
            style={
              styles.switchRow
            }
          >
            <View
              style={
                styles.rowTextContainer
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Join
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                New Drops start with Join enabled.
              </Text>
            </View>

            <Switch
              value={
                settings.default_join_enabled
              }
              onValueChange={(value) =>
                updateSetting(
                  'default_join_enabled',
                  value
                )
              }
              disabled={
                saving
              }
            />
          </View>

          <View
            style={[
              styles.switchRow,
              styles.switchRowBorder,
            ]}
          >
            <View
              style={
                styles.rowTextContainer
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Reply
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                New Drops start with Reply enabled.
              </Text>
            </View>

            <Switch
              value={
                settings.default_reply_enabled
              }
              onValueChange={(value) =>
                updateSetting(
                  'default_reply_enabled',
                  value
                )
              }
              disabled={
                saving
              }
            />
          </View>
        </View>

        <Text
          style={
            styles.defaultsNote
          }
        >
          You can still change Join and Reply individually before publishing each Drop.
        </Text>

        <Pressable
          style={[
            styles.saveButton,
            (
              !hasChanges ||
              saving
            ) &&
              styles.saveButtonDisabled,
          ]}
          onPress={
            handleSave
          }
          disabled={
            !hasChanges ||
            saving
          }
        >
          <Text
            style={
              styles.saveText
            }
          >
            {saving
              ? 'Saving...'
              : 'Save changes'}
          </Text>
        </Pressable>

        <Text
          style={
            styles.sectionTitle
          }
        >
          ACCOUNT
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed &&
              styles.logoutButtonPressed,
          ]}
          onPress={
            handleLogout
          }
        >
          <Text
            style={
              styles.logoutText
            }
          >
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    loadingContainer: {
      flex: 1,
      backgroundColor:
        '#000000',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1A1A1A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    back: {
      color: '#FFFFFF',
      fontSize: 40,
      fontWeight: '200',
      lineHeight: 40,
    },

    title: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },

    headerSpacer: {
      width: 24,
    },

    content: {
      paddingBottom: 50,
    },

    sectionTitle: {
      color: '#555555',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginHorizontal: 20,
      marginTop: 26,
      marginBottom: 9,
    },

    navigationRow: {
      marginHorizontal: 20,
      minHeight: 66,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor:
        '#151515',
      flexDirection: 'row',
      alignItems: 'center',
    },

    rowTextContainer: {
      flex: 1,
      paddingRight: 14,
    },

    rowTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    rowDescription: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    chevron: {
      color: '#666666',
      fontSize: 28,
      fontWeight: '200',
    },

    settingBlock: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 16,
      borderRadius: 14,
      backgroundColor:
        '#151515',
    },

    settingTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    settingDescription: {
      color: '#666666',
      fontSize: 12,
      marginTop: 4,
      marginBottom: 13,
    },

    selector: {
      flexDirection: 'row',
      backgroundColor:
        '#090909',
      borderRadius: 11,
      padding: 3,
      gap: 3,
    },

    selectorOption: {
      flex: 1,
      minHeight: 36,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    selectorOptionSelected: {
      backgroundColor:
        '#FFFFFF',
    },

    selectorText: {
      color: '#777777',
      fontSize: 12,
      fontWeight: '600',
    },

    selectorTextSelected: {
      color: '#000000',
    },

    controlDisabled: {
      opacity: 0.5,
    },

    switchGroup: {
      marginHorizontal: 20,
      borderRadius: 14,
      backgroundColor:
        '#151515',
      overflow: 'hidden',
    },

    switchRow: {
      minHeight: 70,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },

    switchRowBorder: {
      borderTopWidth: 1,
      borderTopColor:
        '#242424',
    },

    defaultsNote: {
      color: '#555555',
      fontSize: 12,
      lineHeight: 17,
      marginHorizontal: 20,
      marginTop: 9,
    },

    saveButton: {
      height: 46,
      marginHorizontal: 20,
      marginTop: 24,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveButtonDisabled: {
      opacity: 0.3,
    },

    saveText: {
      color: '#000000',
      fontSize: 15,
      fontWeight: '600',
    },

    logoutButton: {
      marginHorizontal: 20,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    logoutButtonPressed: {
      opacity: 0.6,
    },

    logoutText: {
      color: '#FF5A5F',
      fontSize: 15,
      fontWeight: '600',
    },
  });