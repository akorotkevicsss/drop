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

import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Visibility = 'everyone' | 'mutuals' | 'nobody';

type SettingsProfile = {
  id: string;
  bio_visibility: Visibility;
  city_visibility: Visibility;
  show_followers: boolean;
  show_following: boolean;
  default_join_enabled: boolean;
  default_reply_enabled: boolean;
};

function VisibilitySelector({
  value,
  onChange,
  disabled = false,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
}) {
  const options: { value: Visibility; label: string }[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'mutuals', label: 'Mutuals' },
    { value: 'nobody', label: 'Nobody' },
  ];

  return (
    <View style={styles.selector}>
      {options.map((option, index) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.selectorOption,
              index > 0 && styles.selectorDivider,
            ]}
          >
            <Text
              style={[
                styles.selectorText,
                selected && styles.selectorTextSelected,
              ]}
            >
              {option.label}
            </Text>

            {selected && <View style={styles.selectedDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const [original, setOriginal] = useState<SettingsProfile | null>(null);
  const [settings, setSettings] = useState<SettingsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Could not find the current user.');
        return;
      }

      const { data, error } = await supabase
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
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('LOAD SETTINGS ERROR:', error);
        Alert.alert('Could not load settings', error.message);
        return;
      }

      const normalized: SettingsProfile = {
        id: data.id,
        bio_visibility: (data.bio_visibility ?? 'everyone') as Visibility,
        city_visibility: (data.city_visibility ?? 'everyone') as Visibility,
        show_followers: data.show_followers ?? true,
        show_following: data.show_following ?? true,
        default_join_enabled: data.default_join_enabled ?? true,
        default_reply_enabled: data.default_reply_enabled ?? true,
      };

      setOriginal(normalized);
      setSettings(normalized);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!settings || !original) return false;

    return (
      settings.bio_visibility !== original.bio_visibility ||
      settings.city_visibility !== original.city_visibility ||
      settings.show_followers !== original.show_followers ||
      settings.show_following !== original.show_following ||
      settings.default_join_enabled !== original.default_join_enabled ||
      settings.default_reply_enabled !== original.default_reply_enabled
    );
  }, [settings, original]);

  const updateSetting = <K extends keyof SettingsProfile>(
    key: K,
    value: SettingsProfile[K]
  ) => {
    setSettings((current) =>
      current ? { ...current, [key]: value } : current
    );
  };

  const handleSave = async () => {
    if (!settings || !hasChanges || saving) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          bio_visibility: settings.bio_visibility,
          city_visibility: settings.city_visibility,
          show_followers: settings.show_followers,
          show_following: settings.show_following,
          default_join_enabled: settings.default_join_enabled,
          default_reply_enabled: settings.default_reply_enabled,
        })
        .eq('id', settings.id);

      if (error) {
        Alert.alert('Could not save settings', error.message);
        return;
      }

      setOriginal({ ...settings });
      Alert.alert('Saved', 'Your settings have been updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (!hasChanges || saving) {
      router.back();
      return;
    }

    Alert.alert('Discard changes?', 'You have unsaved settings.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Log out error', error.message);
        },
      },
    ]);
  };

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={DropColors.warmWhite} />
      </View>
    );
  }

  const tint = DropColors.wine;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>PROFILE</Text>

        <Pressable
          style={styles.navigationRow}
          onPress={() => router.push('/edit-profile')}
        >
          <View>
            <Text style={styles.rowTitle}>Edit profile</Text>
            <Text style={styles.description}>
              Avatar, username, name, bio and city
            </Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <Text style={styles.section}>PROFILE PRIVACY</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Bio</Text>
          <Text style={styles.description}>Choose who can see your bio.</Text>
          <VisibilitySelector
            value={settings.bio_visibility}
            onChange={(value) => updateSetting('bio_visibility', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>City</Text>
          <Text style={styles.description}>Choose who can see your city.</Text>
          <VisibilitySelector
            value={settings.city_visibility}
            onChange={(value) => updateSetting('city_visibility', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.rows}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Followers list</Text>
              <Text style={styles.description}>
                Your follower count remains visible.
              </Text>
            </View>
            <Switch
              value={settings.show_followers}
              onValueChange={(value) =>
                updateSetting('show_followers', value)
              }
              trackColor={{ false: DropColors.surface, true: tint }}
              thumbColor={DropColors.warmWhite}
              disabled={saving}
            />
          </View>

          <View style={[styles.switchRow, styles.topLine]}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Following list</Text>
              <Text style={styles.description}>
                Your following count remains visible.
              </Text>
            </View>
            <Switch
              value={settings.show_following}
              onValueChange={(value) =>
                updateSetting('show_following', value)
              }
              trackColor={{ false: DropColors.surface, true: tint }}
              thumbColor={DropColors.warmWhite}
              disabled={saving}
            />
          </View>
        </View>

        <Text style={styles.section}>DROP DEFAULTS</Text>

        <View style={styles.rows}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Join</Text>
              <Text style={styles.description}>
                New Drops start with Join enabled.
              </Text>
            </View>
            <Switch
              value={settings.default_join_enabled}
              onValueChange={(value) =>
                updateSetting('default_join_enabled', value)
              }
              trackColor={{ false: DropColors.surface, true: tint }}
              thumbColor={DropColors.warmWhite}
              disabled={saving}
            />
          </View>

          <View style={[styles.switchRow, styles.topLine]}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Reply</Text>
              <Text style={styles.description}>
                New Drops start with Reply enabled.
              </Text>
            </View>
            <Switch
              value={settings.default_reply_enabled}
              onValueChange={(value) =>
                updateSetting('default_reply_enabled', value)
              }
              trackColor={{ false: DropColors.surface, true: tint }}
              thumbColor={DropColors.warmWhite}
              disabled={saving}
            />
          </View>
        </View>

        <Pressable
          style={[
            styles.save,
            (!hasChanges || saving) && styles.saveDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          <Text style={styles.saveText}>
            {saving ? 'Saving...' : 'Save changes'}
          </Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        <Text style={styles.section}>ACCOUNT</Text>

        <Pressable style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DropColors.graphite },
  center: {
    flex: 1,
    backgroundColor: DropColors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 38,
    lineHeight: 38,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 18,
  },
  headerSpacer: { width: 24 },
  content: { paddingBottom: 60 },
  section: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.bold,
    fontSize: 10,
    letterSpacing: 1.8,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 10,
  },
  navigationRow: {
    minHeight: 68,
    paddingHorizontal: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  block: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  blockTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 15,
  },
  rowTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 15,
  },
  description: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  selector: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  selectorOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DropColors.border,
  },
  selectorText: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 14,
  },
  selectorTextSelected: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
  },
  selectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DropColors.wine,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  switchRow: {
    minHeight: 72,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  topLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DropColors.border,
  },
  flex: { flex: 1 },
  save: {
    marginHorizontal: 22,
    marginTop: 30,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveDisabled: { opacity: 0.38 },
  saveText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 14,
  },
  chevron: {
    color: DropColors.wine,
    fontFamily: DropTypography.light,
    fontSize: 22,
  },
  logout: {
    marginHorizontal: 22,
    minHeight: 54,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  logoutText: {
    color: DropColors.wine,
    fontFamily: DropTypography.semibold,
    fontSize: 14,
  },
});