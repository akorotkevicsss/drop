import { router } from 'expo-router';
import { useState } from 'react';

import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function CreateScreen() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleDrop = async () => {
    const trimmedText = text.trim();

    if (!trimmedText || loading) {
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
        .from('drops')
        .insert({
          author_id: user.id,
          text: trimmedText,

          // Для Alpha пока всё разрешено по умолчанию.
          join_enabled: true,
          interested_enabled: true,
          reply_enabled: true,
        });

      if (error) {
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

      setText('');
      Keyboard.dismiss();

      router.back();
    } catch (error) {
      console.error(
        'CREATE DROP ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Something went wrong while creating your Drop.'
      );
    } finally {
      setLoading(false);
    }
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
      <Pressable
        style={styles.screen}
        onPress={Keyboard.dismiss}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButton}>
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            New Drop
          </Text>

          <TouchableOpacity
            onPress={handleDrop}
            disabled={!text.trim() || loading}
            style={[
              styles.dropButton,
              (!text.trim() || loading) &&
                styles.dropButtonDisabled,
            ]}
          >
            <Text style={styles.dropButtonText}>
              {loading ? '...' : 'Drop'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <TextInput
            style={styles.input}
            placeholder="What do you want to do?"
            placeholderTextColor="#555555"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={280}
            editable={!loading}
          />

          <Text style={styles.counter}>
            {text.length}/280
          </Text>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  screen: {
    flex: 1,
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cancelButton: {
    color: '#888888',
    fontSize: 15,
    fontWeight: '500',
    minWidth: 60,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  dropButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 62,
    alignItems: 'center',
  },

  dropButtonDisabled: {
    opacity: 0.3,
  },

  dropButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },

  content: {
    flex: 1,
  },

  input: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 32,
    paddingHorizontal: 20,
    paddingTop: 28,
    minHeight: 180,
    textAlignVertical: 'top',
  },

  counter: {
    color: '#555555',
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 20,
  },
});