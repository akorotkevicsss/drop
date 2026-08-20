import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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

import { UserAvatar } from '@/components/user-avatar';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  city: string;
  username_changed_at: string | null;
  profile_changed_at: string | null;
  avatar_url: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function formatRemainingTime(ms: number) {
  if (ms <= 0) {
    return 'available now';
  }

  const totalMinutes = Math.ceil(ms / (60 * 1000));

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor(
    (totalMinutes % (60 * 24)) / 60
  );
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `in ${days}d ${hours}h`;
    }

    return `in ${days}d`;
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `in ${hours}h ${minutes}m`;
    }

    return `in ${hours}h`;
  }

  return `in ${minutes}m`;
}

export default function EditProfileScreen() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [username, setUsername] =
    useState('');

  const [displayName, setDisplayName] =
    useState('');

  const [bio, setBio] =
    useState('');

  const [city, setCity] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [avatarBusy, setAvatarBusy] =
    useState(false);

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Error',
          'Could not find the current user.'
        );

        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          bio,
          city,
          username_changed_at,
          profile_changed_at,
          avatar_url
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(
          'LOAD PROFILE ERROR:',
          error
        );

        Alert.alert(
          'Error',
          error.message
        );

        return;
      }

      setProfile(data);

      setUsername(
        data.username ?? ''
      );

      setDisplayName(
        data.display_name ?? ''
      );

      setBio(
        data.bio ?? ''
      );

      setCity(
        data.city ?? ''
      );
    } finally {
      setLoading(false);
    }
  };


  const getAvatarStoragePath = (
    avatarUrl: string | null
  ) => {
    if (!avatarUrl) {
      return null;
    }

    const marker =
      '/storage/v1/object/public/avatars/';

    const markerIndex =
      avatarUrl.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(
      avatarUrl.slice(
        markerIndex + marker.length
      )
    );
  };

  const handlePickAvatar = async () => {
    if (!profile || avatarBusy) {
      return;
    }

    try {
      setAvatarBusy(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access to choose a profile picture.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      const response = await fetch(
        asset.uri
      );

      const arrayBuffer =
        await response.arrayBuffer();

      const contentType =
        asset.mimeType || 'image/jpeg';

      const extension =
        contentType === 'image/png'
          ? 'png'
          : contentType === 'image/webp'
            ? 'webp'
            : 'jpg';

      const storagePath =
        `${profile.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('avatars')
          .upload(
            storagePath,
            arrayBuffer,
            {
              contentType,
              upsert: false,
            }
          );

      if (uploadError) {
        console.error(
          'AVATAR UPLOAD ERROR:',
          uploadError
        );

        Alert.alert(
          'Upload failed',
          uploadError.message
        );

        return;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('avatars')
          .getPublicUrl(storagePath);

      const newAvatarUrl =
        publicUrlData.publicUrl;

      const { error: profileError } =
        await supabase
          .from('profiles')
          .update({
            avatar_url: newAvatarUrl,
          })
          .eq('id', profile.id);

      if (profileError) {
        await supabase.storage
          .from('avatars')
          .remove([storagePath]);

        console.error(
          'AVATAR PROFILE UPDATE ERROR:',
          profileError
        );

        Alert.alert(
          'Could not save avatar',
          profileError.message
        );

        return;
      }

      const oldStoragePath =
        getAvatarStoragePath(
          profile.avatar_url
        );

      if (oldStoragePath) {
        const { error: deleteOldError } =
          await supabase.storage
            .from('avatars')
            .remove([oldStoragePath]);

        if (deleteOldError) {
          console.warn(
            'OLD AVATAR DELETE ERROR:',
            deleteOldError
          );
        }
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: newAvatarUrl,
            }
          : current
      );
    } catch (error) {
      console.error(
        'AVATAR PICK ERROR:',
        error
      );

      Alert.alert(
        'Avatar error',
        'Something went wrong while updating your profile picture.'
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (
      !profile?.avatar_url ||
      avatarBusy
    ) {
      return;
    }

    Alert.alert(
      'Remove profile picture',
      'Remove your current profile picture?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setAvatarBusy(true);

              const oldStoragePath =
                getAvatarStoragePath(
                  profile.avatar_url
                );

              const { error: updateError } =
                await supabase
                  .from('profiles')
                  .update({
                    avatar_url: null,
                  })
                  .eq('id', profile.id);

              if (updateError) {
                Alert.alert(
                  'Could not remove avatar',
                  updateError.message
                );

                return;
              }

              if (oldStoragePath) {
                const { error: removeError } =
                  await supabase.storage
                    .from('avatars')
                    .remove([oldStoragePath]);

                if (removeError) {
                  console.warn(
                    'AVATAR STORAGE REMOVE ERROR:',
                    removeError
                  );
                }
              }

              setProfile((current) =>
                current
                  ? {
                      ...current,
                      avatar_url: null,
                    }
                  : current
              );
            } finally {
              setAvatarBusy(false);
            }
          },
        },
      ]
    );
  };

  const usernameRemainingMs =
    useMemo(() => {
      if (!profile?.username_changed_at) {
        return 0;
      }

      const changedAt =
        new Date(
          profile.username_changed_at
        ).getTime();

      return Math.max(
        0,
        changedAt + WEEK_MS - now
      );
    }, [
      profile?.username_changed_at,
      now,
    ]);

  const profileRemainingMs =
    useMemo(() => {
      if (!profile?.profile_changed_at) {
        return 0;
      }

      const changedAt =
        new Date(
          profile.profile_changed_at
        ).getTime();

      return Math.max(
        0,
        changedAt + DAY_MS - now
      );
    }, [
      profile?.profile_changed_at,
      now,
    ]);

  const usernameLocked =
    usernameRemainingMs > 0;

  const profileLocked =
    profileRemainingMs > 0;

  const handleSave = async () => {
    if (!profile) {
      return;
    }

    const cleanUsername =
      username.trim().toLowerCase();

    const cleanDisplayName =
      displayName.trim();

    const cleanBio =
      bio.trim();

    const cleanCity =
      city.trim();

    if (
      !cleanUsername ||
      !cleanDisplayName
    ) {
      Alert.alert(
        'Missing data',
        'Name and username are required.'
      );

      return;
    }

    if (
      !/^[a-z0-9._]+$/.test(
        cleanUsername
      )
    ) {
      Alert.alert(
        'Invalid username',
        'Username can only contain lowercase letters, numbers, dots and underscores.'
      );

      return;
    }

    const usernameChanged =
      cleanUsername !==
      profile.username;

    const profileDetailsChanged =
      cleanDisplayName !==
        profile.display_name ||
      cleanBio !==
        profile.bio ||
      cleanCity !==
        profile.city;

    if (
      !usernameChanged &&
      !profileDetailsChanged
    ) {
      Alert.alert(
        'Nothing changed',
        'There is nothing to save.'
      );

      return;
    }

    if (
      usernameChanged &&
      usernameLocked
    ) {
      Alert.alert(
        'Username locked',
        `You can change your username again ${formatRemainingTime(
          usernameRemainingMs
        )}.`
      );

      return;
    }

    if (
      profileDetailsChanged &&
      profileLocked
    ) {
      Alert.alert(
        'Profile locked',
        `You can change your profile details again ${formatRemainingTime(
          profileRemainingMs
        )}.`
      );

      return;
    }

    try {
      setSaving(true);

      const updates: Record<
        string,
        string
      > = {};

      if (usernameChanged) {
        updates.username =
          cleanUsername;
      }

      if (profileDetailsChanged) {
        updates.display_name =
          cleanDisplayName;

        updates.bio =
          cleanBio;

        updates.city =
          cleanCity;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.error(
          'UPDATE PROFILE ERROR:',
          error
        );

        if (error.code === '23505') {
          Alert.alert(
            'Username taken',
            'This username is already in use.'
          );

          return;
        }

        Alert.alert(
          'Could not update profile',
          error.message
        );

        return;
      }

      Alert.alert(
        'Saved',
        'Your profile has been updated.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.back(),
          },
        ]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.back}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Edit profile
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>


        <View style={styles.avatarSection}>
          <UserAvatar
            uri={profile?.avatar_url}
            name={displayName || profile?.display_name}
            size={96}
          />

          <Pressable
            style={({ pressed }) => [
              styles.avatarAction,
              pressed && styles.avatarActionPressed,
            ]}
            onPress={handlePickAvatar}
            disabled={avatarBusy}
          >
            <Text style={styles.avatarActionText}>
              {avatarBusy
                ? 'Working...'
                : profile?.avatar_url
                  ? 'Change photo'
                  : 'Add photo'}
            </Text>
          </Pressable>

          {!!profile?.avatar_url && (
            <Pressable
              onPress={handleRemoveAvatar}
              disabled={avatarBusy}
            >
              <Text style={styles.removeAvatarText}>
                Remove photo
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.label}>
          USERNAME
        </Text>

        <TextInput
          style={[
            styles.input,
            usernameLocked &&
              styles.inputLocked,
          ]}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!usernameLocked}
        />

        <Text style={styles.help}>
          {usernameLocked
            ? `Username can be changed again ${formatRemainingTime(
                usernameRemainingMs
              )}.`
            : 'Username can be changed now.'}
        </Text>

        <Text style={styles.label}>
          NAME
        </Text>

        <TextInput
          style={[
            styles.input,
            profileLocked &&
              styles.inputLocked,
          ]}
          value={displayName}
          onChangeText={
            setDisplayName
          }
          editable={!profileLocked}
        />

        <Text style={styles.label}>
          BIO
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.bioInput,
            profileLocked &&
              styles.inputLocked,
          ]}
          value={bio}
          onChangeText={setBio}
          multiline
          editable={!profileLocked}
        />

        <Text style={styles.label}>
          CITY
        </Text>

        <TextInput
          style={[
            styles.input,
            profileLocked &&
              styles.inputLocked,
          ]}
          value={city}
          onChangeText={setCity}
          editable={!profileLocked}
        />

        <Text style={styles.help}>
          {profileLocked
            ? `Name, bio and city can be changed again ${formatRemainingTime(
                profileRemainingMs
              )}.`
            : 'Name, bio and city can be changed now.'}
        </Text>

        <Pressable
          style={[
            styles.saveButton,
            saving &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text
            style={
              styles.saveButtonText
            }
          >
            {saving
              ? 'Saving...'
              : 'Save changes'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loading: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingBottom: 40,
  },

  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
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



  avatarSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 4,
  },

  avatarAction: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
  },

  avatarActionPressed: {
    opacity: 0.65,
  },

  avatarActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  removeAvatarText: {
    color: '#FF5A5F',
    fontSize: 13,
    marginTop: 12,
  },

  label: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },

  input: {
    marginHorizontal: 20,
    backgroundColor: '#151515',
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },

  inputLocked: {
    opacity: 0.45,
  },

  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  help: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: 20,
    marginTop: 8,
  },

  saveButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 32,
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
});