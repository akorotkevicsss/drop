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

type ConversationRow = {
  id: string;
  author_id: string;
  participant_id: string;
};

type ReadRow = {
  conversation_id: string;
  last_read_at: string;
};

type MessageRow = {
  conversation_id: string;
  sender_id: string;
  created_at: string;
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

        const {
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
           * RLS должен вернуть только conversations,
           * участником которых является текущий user.
           */

          const {
            data:
              conversationData,
            error:
              conversationError,
          } =
            await supabase
              .from(
                'conversations'
              )
              .select(`
                id,
                author_id,
                participant_id
              `);

          if (
            conversationError
          ) {
            console.error(
              'BADGE CONVERSATIONS ERROR:',
              conversationError
            );

            return;
          }

          const conversations =
            (
              conversationData ??
              []
            ) as ConversationRow[];

          if (
            conversations.length ===
            0
          ) {
            setUnreadCount(0);
            return;
          }

          const conversationIds =
            conversations.map(
              (
                conversation
              ) =>
                conversation.id
            );

          /*
           * Берём last_read_at текущего пользователя.
           */

          const {
            data:
              readData,
            error:
              readError,
          } =
            await supabase
              .from(
                'conversation_reads'
              )
              .select(`
                conversation_id,
                last_read_at
              `)
              .eq(
                'user_id',
                userId
              )
              .in(
                'conversation_id',
                conversationIds
              );

          if (
            readError
          ) {
            console.error(
              'BADGE READS ERROR:',
              readError
            );

            return;
          }

          const reads =
            (
              readData ??
              []
            ) as ReadRow[];

          /*
           * Берём входящие messages.
           * Собственные сообщения unread не считаем.
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
              const readState =
                reads.find(
                  (
                    read
                  ) =>
                    read.conversation_id ===
                    message.conversation_id
                );

              /*
               * Если пользователь ещё никогда
               * не открывал этот DM —
               * входящее сообщение unread.
               */

              if (
                !readState
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
                  readState.last_read_at
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
              'conversation_reads',
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
      screenOptions={{
        tabBarActiveTintColor:
          Colors[
            colorScheme ??
              'light'
          ].tint,

        headerShown:
          false,

        tabBarButton:
          HapticTab,

        tabBarStyle: {
          backgroundColor:
            '#000000',

          borderTopColor:
            '#1A1A1A',
        },

        tabBarInactiveTintColor:
          '#666666',

        tabBarBadgeStyle: {
          backgroundColor:
            '#FFFFFF',

          color:
            '#000000',

          fontSize:
            10,

          fontWeight:
            '700',
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title:
            'Explore',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={28}
              name="sparkles"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="find"
        options={{
          title:
            'Find',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={28}
              name="magnifyingglass"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title:
            'Drops',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={28}
              name="house.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="inbox"
        options={{
          title:
            'Inbox',

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
              size={28}
              name="message.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title:
            'Activity',

          tabBarBadge:
            activityUnreadCount >
            0
              ? activityUnreadCount >
                9
                ? '9+'
                : activityUnreadCount
              : undefined,

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={28}
              name="bell.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title:
            'Profile',

          tabBarIcon: ({
            color,
          }) => (
            <IconSymbol
              size={28}
              name="person.fill"
              color={
                color
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}