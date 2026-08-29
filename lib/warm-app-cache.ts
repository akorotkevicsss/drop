import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

let warmPromise: Promise<void> | null = null;
let lastWarmAt = 0;

const WARM_TTL_MS = 15_000;
const CHAT_PREFETCH_LIMIT = 20;

async function warmProfile(userId: string) {
  await Promise.allSettled([
    supabase
      .from('profiles')
      .select('id, username, display_name, bio, city, avatar_url')
      .eq('id', userId)
      .single(),

    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),

    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),

    supabase
      .from('drops')
      .select(`
        id,
        text,
        city,
        location_text,
        event_time,
        event_end_time,
        status,
        rating_enabled,
        age_restriction,
        join_limit,
        created_at,
        background_color,
        image_path,
        attached_image_path
      `)
      .eq('author_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabase.rpc('get_profile_event_rating', {
      p_user_id: userId,
    }),
  ]);
}

async function warmActivity(userId: string) {
  await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
}

async function warmInboxAndChats(userId: string) {
  const { data: membershipData, error: membershipError } =
    await supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        user_id,
        last_read_at
      `)
      .eq('user_id', userId)
      .is('left_at', null);

  if (membershipError || !membershipData?.length) {
    return;
  }

  const conversationIds = membershipData
    .map((row) => row.conversation_id)
    .slice(0, CHAT_PREFETCH_LIMIT);

  const [
    conversationResult,
    allMembersResult,
    messageResult,
    eventResult,
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id,
        author_id,
        participant_id,
        conversation_type,
        title,
        created_by,
        is_request,
        created_at
      `)
      .in('id', conversationIds),

    supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        user_id,
        last_read_at
      `)
      .in('conversation_id', conversationIds)
      .is('left_at', null),

    supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        text,
        message_type,
        created_at
      `)
      .in('conversation_id', conversationIds)
      .is('deleted_for_everyone_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('conversation_events')
      .select(`
        conversation_id,
        event_type,
        drop_text_snapshot,
        created_at
      `)
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false }),
  ]);

  const allMembers = allMembersResult.data ?? [];
  const otherUserIds = [
    ...new Set(
      allMembers
        .filter((member) => member.user_id !== userId)
        .map((member) => member.user_id)
    ),
  ];

  if (otherUserIds.length > 0) {
    await supabase
      .from('profiles')
      .select(`
        id,
        username,
        display_name,
        avatar_url
      `)
      .in('id', otherUserIds);
  }

  // Prepare the route modules and the exact heavy data used when opening chats.
  await Promise.allSettled(
    conversationIds.map(async (conversationId) => {
      router.prefetch(`/chat/${conversationId}`);

      const conversation =
        conversationResult.data?.find(
          (item) => item.id === conversationId
        ) ?? null;

      const memberIds = allMembers
        .filter((item) => item.conversation_id === conversationId)
        .map((item) => item.user_id);

      await Promise.allSettled([
        supabase
          .from('conversations')
          .select(`
            id,
            author_id,
            participant_id,
            conversation_type,
            title
          `)
          .eq('id', conversationId)
          .maybeSingle(),

        supabase
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .is('left_at', null),

        memberIds.length > 0
          ? supabase
              .from('profiles')
              .select(`
                id,
                username,
                display_name,
                avatar_url
              `)
              .in('id', memberIds)
          : Promise.resolve(),

        supabase
          .from('messages')
          .select(`
            id,
            conversation_id,
            sender_id,
            text,
            message_type,
            media_path,
            voice_duration_ms,
            reply_to_message_id,
            deleted_for_everyone_at,
            edited_at,
            created_at
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),

        supabase
          .from('conversation_events')
          .select(`
            id,
            conversation_id,
            actor_id,
            drop_id,
            event_type,
            drop_text_snapshot,
            created_at
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),

        supabase
          .from('message_hidden_for')
          .select('message_id')
          .eq('user_id', userId),
      ]);

      void conversation;
    })
  );

  void messageResult;
  void eventResult;
}

export async function warmAppCache(force = false) {
  const now = Date.now();

  if (!force && now - lastWarmAt < WARM_TTL_MS) {
    return;
  }

  if (warmPromise) {
    return warmPromise;
  }

  warmPromise = (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await Promise.allSettled([
      warmProfile(user.id),
      warmActivity(user.id),
      warmInboxAndChats(user.id),
    ]);

    lastWarmAt = Date.now();
  })();

  try {
    await warmPromise;
  } finally {
    warmPromise = null;
  }
}
