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
  Asset,
} from 'expo-asset';

import {
  Stack,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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


void SplashScreen.preventAutoHideAsync();


const STARTUP_MIN_DURATION_MS =
  4000;

const STARTUP_ASSETS = [
  require('../img/droplogofull_transparent.png'),
  require('../img/navbarcompass_transparent.png'),
  require('../img/logodrop_transparent.png'),
  require('../img/messageslogo_transparent.png'),
  require('../img/profilelogo_transparent.png'),
];


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

  const [
    assetsLoaded,
    setAssetsLoaded,
  ] =
    useState(false);

  const [
    minimumStartupTimePassed,
    setMinimumStartupTimePassed,
  ] =
    useState(false);

  const [
    nativeSplashHidden,
    setNativeSplashHidden,
  ] =
    useState(false);

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
    let active =
      true;

    void Asset
      .loadAsync(
        STARTUP_ASSETS
      )
      .catch(
        (error) => {
          console.warn(
            'STARTUP ASSET PRELOAD ERROR:',
            error
          );
        }
      )
      .finally(
        () => {
          if (active) {
            setAssetsLoaded(
              true
            );
          }
        }
      );

    const timer =
      setTimeout(
        () => {
          if (active) {
            setMinimumStartupTimePassed(
              true
            );
          }
        },
        STARTUP_MIN_DURATION_MS
      );

    return () => {
      active =
        false;

      clearTimeout(
        timer
      );
    };
  }, []);

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

  const startupReady =
    fontsLoaded &&
    assetsLoaded &&
    !loading;

  useEffect(() => {
    if (
      !fontsLoaded ||
      !assetsLoaded ||
      nativeSplashHidden
    ) {
      return;
    }

    void SplashScreen
      .hideAsync()
      .then(
        () => {
          setNativeSplashHidden(
            true
          );
        }
      )
      .catch(
        (error) => {
          console.warn(
            'SPLASH HIDE ERROR:',
            error
          );

          setNativeSplashHidden(
            true
          );
        }
      );
  }, [
    assetsLoaded,
    fontsLoaded,
    nativeSplashHidden,
  ]);

  if (
    !nativeSplashHidden
  ) {
    return null;
  }

  if (
    !startupReady ||
    !minimumStartupTimePassed
  ) {
    return (
      <StartupScreen />
    );
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


function StartupScreen() {
  return (
    <View
      style={
        styles.startupScreen
      }
    >
      <View
        style={
          styles.brandBlock
        }
      >
        <Image
          source={
            require('../img/droplogofull.png')
          }
          style={
            styles.logo
          }
          resizeMode="contain"
        />

        <Text
          style={
            styles.tagline
          }
        >
          intent over reaction
        </Text>
      </View>

      <ActivityIndicator
        size="small"
        color="#FFF2E4"
        style={
          styles.loader
        }
      />
    </View>
  );
}


const styles =
  StyleSheet.create({
    startupScreen: {
      flex: 1,
      backgroundColor:
        '#0C0C0C',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    brandBlock: {
      width: '100%',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 36,
    },

    logo: {
      width: 340,
      height: 180,
    },

    tagline: {
      marginTop: -15,
      color:
        '#FFF2E4',
      fontFamily:
        'FiraSans_400Regular',
      fontSize: 17,
      letterSpacing: 0.5,
    },

    loader: {
      position:
        'absolute',
      bottom: 92,
    },
  });
