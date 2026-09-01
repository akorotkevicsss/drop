import { Tabs, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type MembershipRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type ConversationRow = {
  id: string;
  conversation_type: 'direct' | 'group';
  created_by: string | null;
  is_request: boolean;
};

type MessageRow = {
  conversation_id: string;
  sender_id: string;
  created_at: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isJwtIssuedAtFutureError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
  };

  return (
    candidate.code === 'PGRST303' &&
    candidate.message?.toLowerCase().includes('jwt issued at future') === true
  );
};

function formatBadge(count: number) {
  if (count <= 0) {
    return undefined;
  }

  return count > 99 ? '99+' : String(count);
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const [unreadCount, setUnreadCount] = useState(0);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadActivityUnreadCount = useCallback(
    async (suppliedUserId?: string) => {
      const userId = suppliedUserId ?? currentUserId;

      if (!userId) {
        setActivityUnreadCount(0);
        return;
      }

      let { count, error } = await supabase
        .from('notifications')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('user_id', userId)
        .is('read_at', null);

      if (isJwtIssuedAtFutureError(error)) {
        await sleep(1200);

        const retryResult = await supabase
          .from('notifications')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', userId)
          .is('read_at', null);

        count = retryResult.count;
        error = retryResult.error;
      }

      if (error) {
        console.warn('ACTIVITY BADGE ERROR:', error);
        return;
      }

      setActivityUnreadCount(count ?? 0);
    },
    [currentUserId]
  );

  const loadUnreadCount = useCallback(
    async (suppliedUserId?: string) => {
      const userId = suppliedUserId ?? currentUserId;

      if (!userId) {
        setUnreadCount(0);
        return;
      }

      try {
        let { data: membershipData, error: membershipError } = await supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            last_read_at
          `)
          .eq('user_id', userId)
          .is('left_at', null);

        if (isJwtIssuedAtFutureError(membershipError)) {
          await sleep(1200);

          const retryResult = await supabase
            .from('conversation_members')
            .select(`
              conversation_id,
              last_read_at
            `)
            .eq('user_id', userId)
            .is('left_at', null);

          membershipData = retryResult.data;
          membershipError = retryResult.error;
        }

        if (membershipError) {
          console.warn('BADGE MEMBERSHIPS ERROR:', membershipError);
          return;
        }

        const memberships = (membershipData ?? []) as MembershipRow[];

        if (memberships.length === 0) {
          setUnreadCount(0);
          return;
        }

        const conversationIds = memberships.map(
          (membership) => membership.conversation_id
        );

        const { data: conversationData, error: conversationError } =
          await supabase
            .from('conversations')
            .select(`
              id,
              conversation_type,
              created_by,
              is_request
            `)
            .in('id', conversationIds);

        if (conversationError) {
          console.warn('BADGE CONVERSATIONS ERROR:', conversationError);
          return;
        }

        const conversations = (conversationData ?? []) as ConversationRow[];

        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select(`
            conversation_id,
            sender_id,
            created_at
          `)
          .in('conversation_id', conversationIds)
          .is('deleted_for_everyone_at', null)
          .order('created_at', {
            ascending: false,
          });

        if (messageError) {
          console.warn('BADGE MESSAGES ERROR:', messageError);
          return;
        }

        const messages = (messageData ?? []) as MessageRow[];
        const latestByConversation = new Map<string, MessageRow>();

        messages.forEach((message) => {
          if (!latestByConversation.has(message.conversation_id)) {
            latestByConversation.set(message.conversation_id, message);
          }
        });

        let messagesUnread = 0;
        let groupsUnread = 0;
        let requestsPending = 0;

        conversations.forEach((conversation) => {
          const membership = memberships.find(
            (item) => item.conversation_id === conversation.id
          );

          if (!membership) {
            return;
          }

          const isIncomingRequest =
            conversation.conversation_type === 'direct' &&
            conversation.is_request &&
            conversation.created_by !== userId;

          if (isIncomingRequest) {
            requestsPending += 1;
            return;
          }

          const latestMessage = latestByConversation.get(conversation.id);

          if (!latestMessage || latestMessage.sender_id === userId) {
            return;
          }

          const unread =
            !membership.last_read_at ||
            new Date(latestMessage.created_at).getTime() >
              new Date(membership.last_read_at).getTime();

          if (!unread) {
            return;
          }

          if (conversation.conversation_type === 'group') {
            groupsUnread += 1;
          } else {
            messagesUnread += 1;
          }
        });

        setUnreadCount(messagesUnread + groupsUnread + requestsPending);
      } catch (error) {
        console.warn('LOAD UNREAD COUNT ERROR:', error);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setUnreadCount(0);
        return;
      }

      setCurrentUserId(user.id);

      await Promise.all([
        loadUnreadCount(user.id),
        loadActivityUnreadCount(user.id),
      ]);
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;

      setCurrentUserId(userId);

      if (userId) {
        loadUnreadCount(userId);
        loadActivityUnreadCount(userId);
      } else {
        setUnreadCount(0);
        setActivityUnreadCount(0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel = supabase
      .channel(
        `tab-unread-${currentUserId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
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
          table: 'conversation_members',
          filter: `user_id=eq.${currentUserId}`,
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
          table: 'conversations',
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
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          loadActivityUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    loadUnreadCount,
    loadActivityUnreadCount,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.prefetch('/settings');
      router.prefetch('/requests');
      router.prefetch('/edit-profile');
      router.prefetch('/new-message');
      router.prefetch('/(tabs)/create');
      router.prefetch('/(tabs)/activity');
    }, 80);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Tabs
      initialRouteName="explore"
      screenOptions={{
        headerShown: false,
        lazy: false,
        animation: 'none',
        tabBarButton: HapticTab,
        sceneStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background,
        },
        tabBarActiveTintColor:
          Colors[colorScheme ?? 'light'].tabIconSelected,
        tabBarInactiveTintColor:
          Colors[colorScheme ?? 'light'].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background,
          borderTopColor: '#444444',
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontFamily: 'FiraSans_400Regular',
          fontSize: 11,
        },
        tabBarBadgeStyle: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          backgroundColor: '#7D0D0D',
          color: '#FFF2E4',
          fontFamily: 'FiraSans_600SemiBold',
          fontSize: 9,
          lineHeight: 11,
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="safari.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="find"
        options={{
          href: null,
          animation: 'none',
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: 'Drops',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="house.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Messages',
          tabBarBadge: formatBadge(unreadCount),
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="message.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          href: null,
          animation: 'none',
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={24}
              name="person.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          href: null,
          animation: 'none',
        }}
      />
    </Tabs>
  );
}