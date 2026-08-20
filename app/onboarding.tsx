import {
    router,
} from 'expo-router';

import {
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    useAppGate,
} from '@/contexts/app-gate-context';

import {
    supabase,
} from '@/lib/supabase';

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  example: string;
};

const STEPS: Step[] = [
  {
    eyebrow:
      'DISCOVER',
    title:
      'See what people want to do.',
    body:
      'Explore shows Drops from people outside your Following feed. Find is only for searching people.',
    example:
      'Coffee in Old Riga after work?',
  },
  {
    eyebrow:
      'CONNECT',
    title:
      'Follow, Reply or Join.',
    body:
      'Follow someone to bring their Drops into your home feed. Reply starts your shared DM. Join asks to take part.',
    example:
      'One person. One conversation.',
  },
  {
    eyebrow:
      'DROP',
    title:
      'Post an intention, not a performance.',
    body:
      'Use the + on Drops when you want to do something. Choose whether people can Join or Reply, then let the interaction happen.',
    example:
      'Intent over reaction.',
  },
];

export default function OnboardingScreen() {
  const [
    stepIndex,
    setStepIndex,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const {
    refreshProfileGate,
  } =
    useAppGate();

  const step =
    STEPS[
      stepIndex
    ];

  const isLast =
    stepIndex ===
    STEPS.length - 1;

  const completeOnboarding =
    async () => {
      if (loading) {
        return;
      }

      try {
        setLoading(
          true
        );

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
            'Could not find your account.'
          );

          return;
        }

        const {
          error,
        } =
          await supabase
            .from(
              'profiles'
            )
            .update({
              onboarding_completed:
                true,

              onboarding_completed_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              user.id
            );

        if (error) {
          console.error(
            'COMPLETE ONBOARDING ERROR:',
            error
          );

          Alert.alert(
            'Error',
            'Could not finish onboarding.'
          );

          return;
        }

        /*
         * RootLayout owns the route guards.
         * Refresh its profile state first,
         * then enter the application.
         */
        await refreshProfileGate();

        router.replace(
          '/(tabs)/index'
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const handleNext =
    () => {
      if (isLast) {
        completeOnboarding();
        return;
      }

      setStepIndex(
        (current) =>
          current + 1
      );
    };

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.top
        }
      >
        <Text
          style={
            styles.logo
          }
        >
          DROP
        </Text>

        <Text
          style={
            styles.counter
          }
        >
          {stepIndex + 1}
          /
          {STEPS.length}
        </Text>
      </View>

      <View
        style={
          styles.content
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          {step.eyebrow}
        </Text>

        <Text
          style={
            styles.title
          }
        >
          {step.title}
        </Text>

        <Text
          style={
            styles.body
          }
        >
          {step.body}
        </Text>

        <View
          style={
            styles.example
          }
        >
          <Text
            style={
              styles.exampleText
            }
          >
            {step.example}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.bottom
        }
      >
        <View
          style={
            styles.dots
          }
        >
          {STEPS.map(
            (
              _,
              index
            ) => (
              <View
                key={
                  index
                }
                style={[
                  styles.dot,

                  index ===
                    stepIndex &&
                    styles.dotActive,
                ]}
              />
            )
          )}
        </View>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.button,

            pressed &&
              styles.buttonPressed,
          ]}
          disabled={
            loading
          }
          onPress={
            handleNext
          }
        >
          {loading ? (
            <ActivityIndicator
              color="#000000"
            />
          ) : (
            <Text
              style={
                styles.buttonText
              }
            >
              {isLast
                ? 'Start dropping'
                : 'Continue'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#000000',
      paddingHorizontal:
        26,
    },

    top: {
      paddingTop: 56,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    logo: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight:
        '700',
      letterSpacing: 4,
    },

    counter: {
      color: '#555555',
      fontSize: 12,
    },

    content: {
      flex: 1,
      justifyContent:
        'center',
      paddingBottom: 30,
    },

    eyebrow: {
      color: '#666666',
      fontSize: 11,
      fontWeight:
        '700',
      letterSpacing: 2,
      marginBottom: 14,
    },

    title: {
      color: '#FFFFFF',
      fontSize: 34,
      lineHeight: 40,
      fontWeight:
        '700',
      maxWidth: 330,
    },

    body: {
      color: '#888888',
      fontSize: 16,
      lineHeight: 24,
      marginTop: 20,
      maxWidth: 340,
    },

    example: {
      marginTop: 32,
      borderLeftWidth: 1,
      borderLeftColor:
        '#444444',
      paddingLeft: 18,
      paddingVertical: 5,
    },

    exampleText: {
      color: '#D0D0D0',
      fontSize: 15,
      lineHeight: 21,
    },

    bottom: {
      paddingBottom: 42,
    },

    dots: {
      flexDirection:
        'row',
      gap: 7,
      marginBottom: 18,
    },

    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        '#333333',
    },

    dotActive: {
      width: 18,
      backgroundColor:
        '#FFFFFF',
    },

    button: {
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    buttonPressed: {
      opacity: 0.75,
    },

    buttonText: {
      color: '#000000',
      fontSize: 15,
      fontWeight:
        '600',
    },
  });