import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushData = {
  type?: string;
  dropId?: string;
  conversationId?: string;
  messageId?: string;
};

export async function registerPushNotificationsAsync(
  userId: string
) {
  if (Platform.OS === 'web') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      'default',
      {
        name: 'Drop notifications',
        importance:
          Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#7D0D0D',
        sound: 'default',
      }
    );
  }

  const current =
    await Notifications.getPermissionsAsync();

  let status = current.status;

  if (status !== 'granted') {
    const requested =
      await Notifications.requestPermissionsAsync();

    status = requested.status;
  }

  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn(
      'PUSH: EAS projectId is missing.'
    );
    return null;
  }

  try {
    const expoPushToken = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    const { error } = await supabase.rpc(
      'register_push_token',
      {
        p_token: expoPushToken,
        p_platform: Platform.OS,
      }
    );

    if (error) {
      console.error(
        'REGISTER PUSH TOKEN ERROR:',
        error
      );
      return null;
    }

    return expoPushToken;
  } catch (error) {
    console.error(
      'GET EXPO PUSH TOKEN ERROR:',
      error
    );
    return null;
  }
}

export async function unregisterCurrentPushToken() {
  if (Platform.OS === 'web') {
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return;
  }

  try {
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    await supabase.rpc(
      'unregister_push_token',
      {
        p_token: token,
      }
    );
  } catch (error) {
    console.warn(
      'UNREGISTER PUSH TOKEN ERROR:',
      error
    );
  }
}

function openPushData(
  data: PushData
) {
  if (
    data.conversationId
  ) {
    router.push(
      `/chat/${data.conversationId}` as any
    );
    return;
  }

  if (
    data.dropId
  ) {
    router.push({
      pathname: '/drop/[id]',
      params: {
        id: data.dropId,
      },
    } as any);
  }
}

export function installPushResponseListener() {
  const initialResponsePromise =
    Notifications.getLastNotificationResponseAsync();

  void initialResponsePromise.then(
    (response) => {
      if (!response) {
        return;
      }

      openPushData(
        response.notification.request.content
          .data as PushData
      );
    }
  );

  const subscription =
    Notifications.addNotificationResponseReceivedListener(
      (response) => {
        openPushData(
          response.notification.request.content
            .data as PushData
        );
      }
    );

  return () => {
    subscription.remove();
  };
}