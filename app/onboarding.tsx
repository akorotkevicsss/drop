import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DropColors, DropTypography } from '@/constants/theme';
import { useAppGate } from '@/contexts/app-gate-context';
import { supabase } from '@/lib/supabase';

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  example: string;
};

const STEPS: Step[] = [
  {
    eyebrow: 'DISCOVER',
    title: 'See what people want to do.',
    body:
      'Explore shows Drops from people outside your Following feed. Find is only for searching people.',
    example: 'Coffee in Old Riga after work?',
  },
  {
    eyebrow: 'CONNECT',
    title: 'Follow, Reply or Join.',
    body:
      'Follow someone to bring their Drops into your home feed. Reply starts your shared DM. Join asks to take part.',
    example: 'One person. One conversation.',
  },
  {
    eyebrow: 'DROP',
    title: 'Post an intention, not a performance.',
    body:
      'Use the + on Drops when you want to do something. Choose whether people can Join or Reply, then let the interaction happen.',
    example: 'Intent over reaction.',
  },
];

const WIDTH = Dimensions.get('window').width;

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { refreshProfileGate } = useAppGate();

  const completeOnboarding = async () => {
    if (loading) return;

    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Error', 'Could not find your account.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('COMPLETE ONBOARDING ERROR:', error);
        Alert.alert('Error', 'Could not finish onboarding.');
        return;
      }

      await refreshProfileGate();
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const onMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const next = Math.round(
      event.nativeEvent.contentOffset.x / WIDTH
    );
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.logo}>DROP</Text>
        <Text style={styles.counter}>
          {stepIndex + 1}/{STEPS.length}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.pager}
      >
        {STEPS.map((step, index) => (
          <View key={step.eyebrow} style={styles.page}>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>{step.eyebrow}</Text>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.body}>{step.body}</Text>

              <View style={styles.example}>
                <Text style={styles.exampleText}>{step.example}</Text>
              </View>
            </View>

            {index < STEPS.length - 1 ? (
              <View style={styles.swipeHint}>
                <Text style={styles.swipeText}>SWIPE TO CONTINUE</Text>
                <Text style={styles.swipeArrow}>→</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.pressed,
                  loading && styles.disabled,
                ]}
                onPress={completeOnboarding}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={DropColors.warmWhite} />
                ) : (
                  <Text style={styles.startText}>Start</Text>
                )}
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === stepIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },
  top: {
    paddingTop: 58,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  logo: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.bold,
    fontSize: 19,
    letterSpacing: 4,
  },
  counter: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },
  pager: { flex: 1 },
  page: {
    width: WIDTH,
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 86,
  },
  copy: {
    marginTop: 'auto',
    marginBottom: 'auto',
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
    maxWidth: 340,
  },
  body: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 20,
    maxWidth: 340,
  },
  example: {
    marginTop: 30,
    borderLeftWidth: 1,
    borderLeftColor: DropColors.wine,
    paddingLeft: 16,
    paddingVertical: 4,
  },
  exampleText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 14,
  },
  swipeHint: {
    position: 'absolute',
    right: 26,
    bottom: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swipeText: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  swipeArrow: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 24,
  },
  startButton: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DropColors.wine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 15,
  },
  dots: {
    position: 'absolute',
    left: 26,
    bottom: 42,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: DropColors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: DropColors.warmWhite,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});