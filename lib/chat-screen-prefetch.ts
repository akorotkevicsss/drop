import { Image as ExpoImage } from 'expo-image';

import { supabase } from '@/lib/supabase';
import {
    getScreenCache,
    setScreenCache,
} from '@/lib/tab-screen-cache';

type Conversation = {
  id: string;
  author_id: string;
  participant_id: string | null;
  conversation_type: 'direct' | 'group';
  title: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type:
    | 'text'
    | 'image'
    | 'video'
    | 'voice';
  media_path: string | null;
  voice_duration_ms: number | null;
  reply_to_message_id: string | null;
  deleted_for_everyone_at: string | null;
  edited_at: string | null;
  created_at: string;
};

type ConversationEvent = {
  id: string;
  conversation_id: string;
  actor_id: string | null;
  drop_id: string | null;
  event_type: 'join' | 'reply';
  drop_text_snapshot: string | null;
  created_at: string;
};

export type ChatPrefetchCache = {
  conversation: Conversation | null;
  currentUserId: string | null;
  profiles: Profile[];
  messages: Message[];
  events: ConversationEvent[];
  hiddenMessageIds: string[];
  imageAspectRatios: Record<string, number>;
};

const inFlight =
  new Map<
    string,
    Promise<void>
  >();

async function prefetchMessageImages(
  messages: Message[]
) {
  const urls =
    messages
      .filter(
        (message) =>
          message.message_type ===
            'image' &&
          !!message.media_path &&
          !message.deleted_for_everyone_at
      )
      .slice(-16)
      .map(
        (message) =>
          supabase.storage
            .from(
              'message-images'
            )
            .getPublicUrl(
              message.media_path as string
            ).data.publicUrl
      );

  if (
    urls.length ===
    0
  ) {
    return;
  }

  try {
    await ExpoImage.prefetch(
      urls,
      'memory-disk'
    );
  } catch (
    error
  ) {
    console.warn(
      'CHAT IMAGE PREFETCH ERROR:',
      error
    );
  }
}

export async function warmChatScreenCache(
  conversationId: string,
  suppliedUserId?: string
) {
  const key =
    `chat:${conversationId}`;

  const cached =
    getScreenCache<ChatPrefetchCache>(
      key
    );

  if (
    cached?.conversation
  ) {
    /*
     * The structural chat cache may already be warm while the actual image
     * bytes are not. Always warm recent image media as a separate step.
     */
    await prefetchMessageImages(
      cached.messages ??
        []
    );
    return;
  }

  const existing =
    inFlight.get(
      conversationId
    );

  if (existing) {
    return existing;
  }

  const promise =
    (async () => {
      const userId =
        suppliedUserId ??
        (
          await supabase.auth.getSession()
        ).data.session?.user.id ??
        null;

      if (!userId) {
        return;
      }

      const [
        conversationResult,
        membersResult,
        messagesResult,
        eventsResult,
        hiddenResult,
      ] = await Promise.all([
        supabase
          .from('conversations')
          .select(`
            id,
            author_id,
            participant_id,
            conversation_type,
            title
          `)
          .eq(
            'id',
            conversationId
          )
          .maybeSingle(),

        supabase
          .from(
            'conversation_members'
          )
          .select(
            'user_id'
          )
          .eq(
            'conversation_id',
            conversationId
          )
          .is(
            'left_at',
            null
          ),

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
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          ),

        supabase
          .from(
            'conversation_events'
          )
          .select(`
            id,
            conversation_id,
            actor_id,
            drop_id,
            event_type,
            drop_text_snapshot,
            created_at
          `)
          .eq(
            'conversation_id',
            conversationId
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          ),

        supabase
          .from(
            'message_hidden_for'
          )
          .select(
            'message_id'
          )
          .eq(
            'user_id',
            userId
          ),
      ]);

      if (
        conversationResult.error ||
        !conversationResult.data ||
        membersResult.error
      ) {
        return;
      }

      const memberIds =
        (
          membersResult.data ??
          []
        ).map(
          (member) =>
            member.user_id
        );

      let profiles:
        Profile[] = [];

      if (
        memberIds.length >
        0
      ) {
        const {
          data,
        } =
          await supabase
            .from(
              'profiles'
            )
            .select(`
              id,
              username,
              display_name,
              avatar_url
            `)
            .in(
              'id',
              memberIds
            );

        profiles =
          (
            data ??
            []
          ) as Profile[];
      }

      const messages =
        (
          messagesResult.data ??
          []
        ) as Message[];

      setScreenCache<ChatPrefetchCache>(
        key,
        {
          conversation:
            conversationResult.data as Conversation,
          currentUserId:
            userId,
          profiles,
          messages,
          events:
            (
              eventsResult.data ??
              []
            ) as ConversationEvent[],
          hiddenMessageIds:
            (
              hiddenResult.data ??
              []
            ).map(
              (row) =>
                row.message_id
            ),
          imageAspectRatios:
            {},
        }
      );

      /*
       * Cache the actual image bytes, not only message metadata.
       * Manage Drop calls this before an existing group chat is opened.
       */
      await prefetchMessageImages(
        messages
      );
    })();

  inFlight.set(
    conversationId,
    promise
  );

  try {
    await promise;
  } finally {
    inFlight.delete(
      conversationId
    );
  }
}
