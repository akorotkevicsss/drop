import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function CreateScreen() {
  const [text, setText] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [
    loadingDefaults,
    setLoadingDefaults,
  ] =
    useState(true);

  const [
    joinEnabled,
    setJoinEnabled,
  ] =
    useState(true);

  const [
    replyEnabled,
    setReplyEnabled,
  ] =
    useState(true);

  const loadDefaults =
    async () => {
      try {
        setLoadingDefaults(
          true
        );

        const {
          data: { user },
          error: userError,
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
            'LOAD DROP DEFAULTS ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not load your Drop defaults.'
          );

          return;
        }

        setJoinEnabled(
          data.default_join_enabled ??
            true
        );

        setReplyEnabled(
          data.default_reply_enabled ??
            true
        );
      } finally {
        setLoadingDefaults(
          false
        );
      }
    };

  useFocusEffect(
    useCallback(() => {
      loadDefaults();

      return () => {
        setText('');
        Keyboard.dismiss();
      };
    }, [])
  );

  const handleCancel = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleDrop =
    async () => {
      const trimmedText =
        text.trim();

      if (
        !trimmedText ||
        loading ||
        loadingDefaults
      ) {
        return;
      }

      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
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
          error,
        } =
          await supabase
            .from(
              'drops'
            )
            .insert({
              author_id:
                user.id,

              text:
                trimmedText,

              join_enabled:
                joinEnabled,

              /*
               * Like is always available
               * in the Alpha.
               */
              interested_enabled:
                true,

              reply_enabled:
                replyEnabled,
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

  const disabled =
    !text.trim() ||
    loading ||
    loadingDefaults;

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
      <Pressable
        style={
          styles.screen
        }
        onPress={
          Keyboard.dismiss
        }
      >
        <View
          style={
            styles.header
          }
        >
          <TouchableOpacity
            onPress={
              handleCancel
            }
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.cancelButton
              }
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text
            style={
              styles.title
            }
          >
            New Drop
          </Text>

          <TouchableOpacity
            onPress={
              handleDrop
            }
            disabled={
              disabled
            }
            style={[
              styles.dropButton,
              disabled &&
                styles.dropButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.dropButtonText
              }
            >
              {loading
                ? '...'
                : 'Drop'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingDefaults ? (
          <View
            style={
              styles.loadingDefaults
            }
          >
            <ActivityIndicator />
          </View>
        ) : (
          <View
            style={
              styles.content
            }
          >
            <TextInput
              style={
                styles.input
              }
              placeholder="What do you want to do?"
              placeholderTextColor="#555555"
              value={
                text
              }
              onChangeText={
                setText
              }
              multiline
              autoFocus
              maxLength={280}
              editable={
                !loading
              }
            />

            <Text
              style={
                styles.counter
              }
            >
              {text.length}/280
            </Text>

            <View
              style={
                styles.options
              }
            >
              <Text
                style={
                  styles.optionsTitle
                }
              >
                INTERACTIONS
              </Text>

              <View
                style={
                  styles.optionCard
                }
              >
                <View
                  style={
                    styles.optionRow
                  }
                >
                  <View
                    style={
                      styles.optionText
                    }
                  >
                    <Text
                      style={
                        styles.optionName
                      }
                    >
                      Join
                    </Text>

                    <Text
                      style={
                        styles.optionDescription
                      }
                    >
                      People can request to join this Drop.
                    </Text>
                  </View>

                  <Switch
                    value={
                      joinEnabled
                    }
                    onValueChange={
                      setJoinEnabled
                    }
                    disabled={
                      loading
                    }
                  />
                </View>

                <View
                  style={[
                    styles.optionRow,
                    styles.optionRowBorder,
                  ]}
                >
                  <View
                    style={
                      styles.optionText
                    }
                  >
                    <Text
                      style={
                        styles.optionName
                      }
                    >
                      Reply
                    </Text>

                    <Text
                      style={
                        styles.optionDescription
                      }
                    >
                      People can reply to this Drop in DM.
                    </Text>
                  </View>

                  <Switch
                    value={
                      replyEnabled
                    }
                    onValueChange={
                      setReplyEnabled
                    }
                    disabled={
                      loading
                    }
                  />
                </View>
              </View>

              <Text
                style={
                  styles.optionsHelp
                }
              >
                These values start from your Settings defaults. Changes here only affect this Drop.
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    screen: {
      flex: 1,
    },

    header: {
      paddingTop: 60,
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
      backgroundColor:
        '#FFFFFF',
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

    loadingDefaults: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
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
      textAlignVertical:
        'top',
    },

    counter: {
      color: '#555555',
      fontSize: 13,
      textAlign: 'right',
      paddingHorizontal: 20,
    },

    options: {
      marginTop: 28,
    },

    optionsTitle: {
      color: '#555555',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginHorizontal: 20,
      marginBottom: 9,
    },

    optionCard: {
      marginHorizontal: 20,
      borderRadius: 14,
      backgroundColor:
        '#151515',
      overflow: 'hidden',
    },

    optionRow: {
      minHeight: 70,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },

    optionRowBorder: {
      borderTopWidth: 1,
      borderTopColor:
        '#242424',
    },

    optionText: {
      flex: 1,
      paddingRight: 14,
    },

    optionName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    optionDescription: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    optionsHelp: {
      color: '#555555',
      fontSize: 12,
      lineHeight: 17,
      marginHorizontal: 20,
      marginTop: 9,
    },
  });