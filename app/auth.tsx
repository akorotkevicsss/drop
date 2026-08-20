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

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleAuth = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password.trim()) {
      Alert.alert(
        'Missing data',
        'Enter email and password.'
      );
      return;
    }

    try {
      setLoading(true);

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        console.log('SIGN UP ERROR:', error);
        console.log('SIGN UP SESSION:', data.session);
        console.log('SIGN UP USER:', data.user);

        if (error) {
          Alert.alert(
            'Sign up error',
            error.message
          );
          return;
        }

        if (!data.session) {
          Alert.alert(
            'Account created',
            'Your account was created successfully. Try signing in.'
          );

          setMode('signin');
        }

        return;
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      console.log('SIGN IN ERROR:', error);
      console.log('SIGN IN SESSION:', data.session);
      console.log('SIGN IN USER:', data.user);

      if (error) {
        Alert.alert(
          'Sign in error',
          error.message
        );
        return;
      }

      if (!data.session) {
        Alert.alert(
          'Sign in error',
          'No session was returned.'
        );
      }

      // Никакого router.replace().
      // RootLayout сам увидит новую session
      // и отправит пользователя куда нужно.
    } catch (error) {
      console.error('AUTH ERROR:', error);

      Alert.alert(
        'Error',
        'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) =>
      current === 'signin'
        ? 'signup'
        : 'signin'
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View style={styles.content}>
        <Text style={styles.logo}>
          DROP
        </Text>

        <Text style={styles.subtitle}>
          Intent over reaction.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666666"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666666"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleAuth}
        />

        <TouchableOpacity
          style={[
            styles.mainButton,
            loading && styles.mainButtonDisabled,
          ]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.mainButtonText}>
            {loading
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={switchMode}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {mode === 'signin'
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
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
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },

  subtitle: {
    color: '#666666',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 44,
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

  mainButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },

  mainButtonDisabled: {
    opacity: 0.5,
  },

  mainButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },

  switchButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },

  switchText: {
    color: '#777777',
    fontSize: 14,
  },
});