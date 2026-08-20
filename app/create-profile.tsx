import { useState } from 'react';

import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function CreateProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateProfile = async () => {
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();
    const cleanCity = city.trim();

    if (!cleanName || !cleanUsername) {
      Alert.alert(
        'Missing data',
        'Name and username are required.'
      );
      return;
    }

    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      Alert.alert(
        'Invalid username',
        'Use only lowercase letters, numbers, dots and underscores.'
      );
      return;
    }

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

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: cleanUsername,
          display_name: cleanName,
          bio: cleanBio,
          city: cleanCity,
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert(
            'Username taken',
            'This username is already in use.'
          );
          return;
        }

        console.error('CREATE PROFILE ERROR:', error);

        Alert.alert(
          'Error',
          error.message
        );

        return;
      }

      Alert.alert(
        'Profile created',
        'Your DROP profile is ready.'
      );

      // Временный способ заставить RootLayout
      // заново проверить наличие профиля.
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        await supabase.auth.refreshSession();
      }
    } catch (error) {
      console.error('PROFILE ERROR:', error);

      Alert.alert(
        'Error',
        'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>
          DROP
        </Text>

        <Text style={styles.title}>
          Create your profile
        </Text>

        <Text style={styles.subtitle}>
          This is how people will see you.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#666666"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#666666"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />

        <TextInput
          style={[
            styles.input,
            styles.bioInput,
          ]}
          placeholder="Bio"
          placeholderTextColor="#666666"
          multiline
          value={bio}
          onChangeText={setBio}
        />

        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor="#666666"
          value={city}
          onChangeText={setCity}
        />

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleCreateProfile}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Creating...'
              : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 5,
    marginBottom: 28,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    color: '#666666',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 30,
  },

  input: {
    backgroundColor: '#151515',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
  },

  bioInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
});