import type {
  Session,
} from '@supabase/supabase-js';

import {
  Stack,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  AppGateContext,
} from '@/contexts/app-gate-context';

import {
  supabase,
} from '@/lib/supabase';

export default function RootLayout() {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    hasProfile,
    setHasProfile,
  ] =
    useState<
      boolean | null
    >(null);

  const [
    onboardingCompleted,
    setOnboardingCompleted,
  ] =
    useState<
      boolean | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const checkProfile =
    useCallback(
      async (
        currentSession:
          Session | null
      ) => {
        if (!currentSession) {
          setHasProfile(
            null
          );

          setOnboardingCompleted(
            null
          );

          setLoading(
            false
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
              id,
              onboarding_completed
            `)
            .eq(
              'id',
              currentSession
                .user.id
            )
            .maybeSingle();

        if (error) {
          console.error(
            'PROFILE CHECK ERROR:',
            error
          );

          setHasProfile(
            false
          );

          setOnboardingCompleted(
            null
          );

          setLoading(
            false
          );

          return;
        }

        setHasProfile(
          !!data
        );

        setOnboardingCompleted(
          data
            ? data
                .onboarding_completed ===
              true
            : null
        );

        setLoading(
          false
        );
      },
      []
    );

  const refreshProfileGate =
    useCallback(
      async () => {
        setLoading(
          true
        );

        const {
          data,
        } =
          await supabase.auth.getSession();

        await checkProfile(
          data.session
        );
      },
      [
        checkProfile,
      ]
    );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(
        async ({
          data,
        }) => {
          setSession(
            data.session
          );

          await checkProfile(
            data.session
          );
        }
      );

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {
          setSession(
            newSession
          );

          setLoading(
            true
          );

          checkProfile(
            newSession
          );
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, [
    checkProfile,
  ]);

  if (loading) {
    return null;
  }

  return (
    <AppGateContext.Provider
      value={{
        refreshProfileGate,
      }}
    >
      <Stack
        screenOptions={{
          headerShown:
            false,
        }}
      >
        <Stack.Protected
          guard={
            !session
          }
        >
          <Stack.Screen
            name="auth"
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            !!session &&
            hasProfile ===
              false
          }
        >
          <Stack.Screen
            name="create-profile"
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            !!session &&
            hasProfile ===
              true &&
            onboardingCompleted ===
              false
          }
        >
          <Stack.Screen
            name="onboarding"
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            !!session &&
            hasProfile ===
              true &&
            onboardingCompleted ===
              true
          }
        >
          <Stack.Screen
            name="(tabs)"
          />

          <Stack.Screen
            name="edit-profile"
          />

          <Stack.Screen
            name="settings"
          />

          <Stack.Screen
            name="connections/[type]"
          />

          <Stack.Screen
            name="chat/[id]"
          />

          <Stack.Screen
            name="user/[username]"
          />

          <Stack.Screen
            name="requests"
          />
        </Stack.Protected>
      </Stack>
    </AppGateContext.Provider>
  );
}