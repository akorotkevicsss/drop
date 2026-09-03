import type {
  Session,
} from '@supabase/supabase-js';

import {
  FiraSans_300Light,
  FiraSans_400Regular,
  FiraSans_500Medium,
  FiraSans_600SemiBold,
  FiraSans_700Bold,
  useFonts,
} from '@expo-google-fonts/fira-sans';

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
  installPushResponseListener,
  registerPushNotificationsAsync,
} from '@/lib/push-notifications';

import {
  supabase,
} from '@/lib/supabase';


export default function RootLayout() {
  const [
    fontsLoaded,
  ] =
    useFonts({
      FiraSans_300Light,
      FiraSans_400Regular,
      FiraSans_500Medium,
      FiraSans_600SemiBold,
      FiraSans_700Bold,
    });

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

        const loadProfile =
          async () => {
            return await supabase
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
          };

        let {
          data,
          error,
        } =
          await loadProfile();

        if (
          error?.code ===
            'PGRST303' &&
          error.message
            ?.toLowerCase()
            .includes(
              'jwt issued at future'
            )
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1200
              )
          );

          const retryResult =
            await loadProfile();

          data =
            retryResult.data;

          error =
            retryResult.error;
        }

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
    return installPushResponseListener();
  }, []);

  useEffect(() => {
    const userId =
      session?.user.id;

    if (!userId) {
      return;
    }

    void registerPushNotificationsAsync(
      userId
    );
  }, [
    session?.user.id,
  ]);

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

  if (
    loading ||
    !fontsLoaded
  ) {
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
          animation:
            'ios_from_right',
          gestureEnabled:
            true,
          contentStyle: {
            backgroundColor:
              '#0B0B0B',
          },
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

          <Stack.Screen
            name="new-message"
          />

          <Stack.Screen
            name="drop/[id]"
          />

          <Stack.Screen
            name="drop/[id]/comments"
          />

          <Stack.Screen
            name="drop/[id]/participants"
          />

          <Stack.Screen
            name="drop/[id]/rates"
          />

          <Stack.Screen
            name="drop/[id]/manage"
          />

          <Stack.Screen
            name="drop/[id]/edit"
          />
        </Stack.Protected>
      </Stack>
    </AppGateContext.Provider>
  );
}
