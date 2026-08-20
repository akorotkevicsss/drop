import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] =
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
    loading,
    setLoading,
  ] =
    useState(true);

  const checkProfile =
    async (
      currentSession:
        Session | null
    ) => {
      if (!currentSession) {
        setHasProfile(null);
        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from('profiles')
          .select('id')
          .eq(
            'id',
            currentSession.user.id
          )
          .maybeSingle();

      if (error) {
        console.error(
          'PROFILE CHECK ERROR:',
          error
        );

        setHasProfile(false);
        setLoading(false);
        return;
      }

      setHasProfile(
        !!data
      );

      setLoading(false);
    };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(
        ({ data }) => {
          setSession(
            data.session
          );

          checkProfile(
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

          setLoading(true);

          checkProfile(
            newSession
          );
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Protected
        guard={!session}
      >
        <Stack.Screen
          name="auth"
        />
      </Stack.Protected>

      <Stack.Protected
        guard={
          !!session &&
          hasProfile === false
        }
      >
        <Stack.Screen
          name="create-profile"
        />
      </Stack.Protected>

      <Stack.Protected
        guard={
          !!session &&
          hasProfile === true
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
  );
}