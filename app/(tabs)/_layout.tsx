import { Tabs } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type MembershipRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type MessageRow = {
  conversation_id: string;
  sender_id: string;
  created_at: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

const isJwtIssuedAtFutureError = (
  error: unknown
) => {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
  };

  return (
    candidate.code === 'PGRST303' &&
    candidate.message
      ?.toLowerCase()
      .includes('jwt issued at future') ===
      true
  );
};

export default function TabLayout() {
  const colorScheme =
    useColorScheme();

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    activityUnreadCount,
    setActivityUnreadCount,
  ] =
    useState(0);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(null);

  const loadActivityUnreadCount =
    useCallback(
      async (
        suppliedUserId?: string
      ) => {
        const userId =
          suppliedUserId ??
          currentUserId;

        if (!userId) {
          setActivityUnreadCount(
            0
          );
          return;
        }

          let {
            count,
            error,
          } =
            await supabase
              .from(
                'notifications'
              )
              .select('*', {
                count: 'exact',
                head: true,
              })
              .eq(
                'user_id',
                userId
              )
              .is(
                'read_at',
                null
              );

          if (
            isJwtIssuedAtFutureError(
              error
            )
          ) {
            await sleep(1200);

            const retryResult =
              await supabase
                .from(
                  'notifications'
                )
                .select('*', {
                  count: 'exact',
                  head: true,
                })
                .eq(
                  'user_id',
                  userId
                )
                .is(
                  'read_at',
                  null
                );

            count =
              retryResult.count;

            error =
              retryResult.error;
          }

        if (error) {
          console.error(
            'ACTIVITY BADGE ERROR:',
            error
          );

          return;
        }

        setActivityUnreadCount(
          count ?? 0
        );
      },
      [
        currentUserId,
      ]
    );

  const loadUnreadCount =
    useCallback(
      async (
        suppliedUserId?: string
      ) => {
        const userId =
          suppliedUserId ??
          currentUserId;

        if (!userId) {
          setUnreadCount(0);
          return;
        }

        try {
          /*
           * Messages 2.0:
           * conversation_members — единый источник membership
           * и last_read_at.
           */

          let {
            data:
              membershipData,
            error:
              membershipError,
          } =
            await supabase
              .from(
                'conversation_members'
              )
              .select(`
                conversation_id,
                last_read_at
              `)
              .eq(
                'user_id',
                userId
              )
              .is(
                'left_at',
                null
              );

          if (
            isJwtIssuedAtFutureError(
              membershipError
            )
          ) {
            await sleep(1200);

            const retryResult =
              await supabase
                .from(
                  'conversation_members'
                )
                .select(`
                  conversation_id,
                  last_read_at
                `)
                .eq(
                  'user_id',
                  userId
                )
                .is(
                  'left_at',
                  null
                );

            membershipData =
              retryResult.data;

            membershipError =
              retryResult.error;
          }

          if (
            membershipError
          ) {
            console.error(
              'BADGE MEMBERSHIPS ERROR:',
              membershipError
            );

            return;
          }

          const memberships =
            (
              membershipData ??
              []
            ) as MembershipRow[];

          if (
            memberships.length ===
            0
          ) {
            setUnreadCount(0);
            return;
          }

          const conversationIds =
            memberships.map(
              (membership) =>
                membership.conversation_id
            );

          /*
           * Считаем только входящие сообщения.
           */

          const {
            data:
              messageData,
            error:
              messageError,
          } =
            await supabase
              .from(
                'messages'
              )
              .select(`
                conversation_id,
                sender_id,
                created_at
              `)
              .in(
                'conversation_id',
                conversationIds
              )
              .neq(
                'sender_id',
                userId
              )
              .is(
                'deleted_for_everyone_at',
                null
              );

          if (
            messageError
          ) {
            console.error(
              'BADGE MESSAGES ERROR:',
              messageError
            );

            return;
          }

          const messages =
            (
              messageData ??
              []
            ) as MessageRow[];

          let nextUnreadCount =
            0;

          messages.forEach(
            (
              message
            ) => {
              const membership =
                memberships.find(
                  (
                    item
                  ) =>
                    item.conversation_id ===
                    message.conversation_id
                );

              if (
                !membership
              ) {
                return;
              }

              /*
               * null = пользователь ещё не читал conversation.
               */
              if (
                !membership.last_read_at
              ) {
                nextUnreadCount +=
                  1;

                return;
              }

              const messageTime =
                new Date(
                  message.created_at
                ).getTime();

              const lastReadTime =
                new Date(
                  membership.last_read_at
                ).getTime();

              if (
                messageTime >
                lastReadTime
              ) {
                nextUnreadCount +=
                  1;
              }
            }
          );

          setUnreadCount(
            nextUnreadCount
          );
        } catch (
          error
        ) {
          console.error(
            'LOAD UNREAD COUNT ERROR:',
            error
          );
        }
      },
      [
        currentUserId,
      ]
    );

  /*
   * Получаем текущего user.
   */

  useEffect(() => {
    const initialize =
      async () => {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          setCurrentUserId(
            null
          );

          setUnreadCount(
            0
          );

          return;
        }

        setCurrentUserId(
          user.id
        );

        await Promise.all([
          loadUnreadCount(
            user.id
          ),

          loadActivityUnreadCount(
            user.id
          ),
        ]);
      };

    initialize();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session
        ) => {
          const userId =
            session?.user
              .id ??
            null;

          setCurrentUserId(
            userId
          );

          if (
            userId
          ) {
            loadUnreadCount(
              userId
            );

            loadActivityUnreadCount(
              userId
            );
          } else {
            setUnreadCount(
              0
            );

            setActivityUnreadCount(
              0
            );
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /*
   * Realtime:
   *
   * новое сообщение -> пересчитать badge
   *
   * открыл чат / last_read_at обновился
   * -> пересчитать badge
   */

  useEffect(() => {
    if (
      !currentUserId
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `tab-unread-${currentUserId}`
        )
        .on(
          'postgres_changes',
          {
            event:
              'INSERT',
            schema:
              'public',
            table:
              'messages',
          },
          (
            payload
          ) => {
            const message =
              payload.new as {
                sender_id:
                  string;
              };

            /*
             * Собственное отправленное
             * сообщение badge не увеличивает.
             */

            if (
              message.sender_id !==
              currentUserId
            ) {
              loadUnreadCount();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event:
              '*',
            schema:
              'public',
            table:
              'conversation_members',
            filter:
              `user_id=eq.${currentUserId}`,
          },
          () => {
            loadUnreadCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'notifications',
            filter:
              `user_id=eq.${currentUserId}`,
          },
          () => {
            loadActivityUnreadCount();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    currentUserId,
    loadUnreadCount,
    loadActivityUnreadCount,
  ]);

  return (
    <Tabs
      initialRouteName="explore"
      screenOptions={{
        headerShown:
          false,

        tabBarButton:
          HapticTab,

        tabBarActiveTintColor:
          Colors[
            colorScheme ??
              'light'
          ].tabIconSelected,

        tabBarInactiveTintColor:
          Colors[
            colorScheme ??
              'light'
          ].tabIconDefault,

        tabBarStyle: {
          backgroundColor:
            Colors[
              colorScheme ??
                'light'
            ].background,

          borderTopColor:
            '#444444',

          borderTopWidth:
            0.5,
        },

        tabBarLabelStyle: {
          fontFamily:
            'FiraSans_400Regular',

          fontSize:
            11,
        },

        tabBarBadgeStyle: {
          backgroundColor:
            '#7D0D0D',

          color:
            '#FFF2E4',

          fontFamily:
            'FiraSans_600SemiBold',

          fontSize:
            10,
        },
      }}
    >
      {/*
       * EXPLORE
       *
       * Main discovery surface.
       * Find/Search will be moved
       * inside Explore.
       */}
      <Tabs.Screen
        name="explore"
        options={{
          title:
            'Explore',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={24}
              name="safari.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      {/*
       * FIND
       *
       * Keep the route alive,
       * but remove it from navbar.
       * Later it becomes part
       * of Explore.
       */}
      <Tabs.Screen
        name="find"
        options={{
          href: null,
        }}
      />

      {/*
       * DROPS
       */}
      <Tabs.Screen
        name="index"
        options={{
          title:
            'Drops',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={24}
              name="house.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      {/*
       * MESSAGES
       *
       * Existing inbox route,
       * new user-facing name.
       */}
      <Tabs.Screen
        name="inbox"
        options={{
          title:
            'Messages',

          tabBarBadge:
            unreadCount >
            0
              ? unreadCount >
                9
                ? '9+'
                : unreadCount
              : undefined,

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={24}
              name="message.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      {/*
       * ACTIVITY
       *
       * Route stays alive.
       * It no longer occupies
       * a navbar position.
       *
       * Next step:
       * Drops -> bell -> Activity.
       */}
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
        }}
      />

      {/*
       * PROFILE
       */}
      <Tabs.Screen
        name="profile"
        options={{
          title:
            'Profile',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={24}
              name="person.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      {/*
       * CREATE DROP
       *
       * Action route,
       * never a navbar destination.
       */}
      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}