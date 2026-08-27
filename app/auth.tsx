import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleAuth = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password.trim()) {
      Alert.alert('Missing data', 'Enter email and password.');
      return;
    }

    try {
      setLoading(true);

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) {
          Alert.alert('Sign up error', error.message);
          return;
        }

        if (!data.session) {
          Alert.alert(
            'Account created',
            'Your account was created successfully. Sign in to continue.'
          );
          setMode('signin');
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert('Sign in error', error.message);
        return;
      }

      if (!data.session) {
        Alert.alert('Sign in error', 'No session was returned.');
      }
    } catch (error) {
      console.error('AUTH ERROR:', error);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.top}>
        <Text style={styles.logo}>DROP</Text>
        <Text style={styles.micro}>INTENT OVER REACTION.</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>
          {mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
        </Text>

        <Text style={styles.title}>
          {mode === 'signin'
            ? 'Pick up where you left off.'
            : 'Start with an intention.'}
        </Text>

        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={DropColors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={DropColors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleAuth}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() =>
              setMode((current) =>
                current === 'signin' ? 'signup' : 'signin'
              )
            }
            disabled={loading}
            hitSlop={10}
          >
            <Text style={styles.switchText}>
              {mode === 'signin' ? 'Create account' : 'I have an account'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.arrowButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={DropColors.warmWhite} />
            ) : (
              <Ionicons name="arrow-forward" size={28} color={DropColors.warmWhite} />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
    paddingHorizontal: 26,
  },
  top: {
    paddingTop: 58,
  },
  logo: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 19,
    letterSpacing: 4,
  },
  micro: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    marginTop: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 70,
  },
  eyebrow: {
    color: DropColors.wine,
    fontFamily: DropTypography.bold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 14,
  },
  title: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 34,
    lineHeight: 39,
    maxWidth: 330,
    marginBottom: 34,
  },
  fields: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  input: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 16,
    minHeight: 58,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  actionRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchText: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 14,
  },
  arrowButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: DropColors.wine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});