import Ionicons from '@expo/vector-icons/Ionicons';
import {
    router,
    Stack,
    useFocusEffect,
    useLocalSearchParams,
} from 'expo-router';
import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type CommentProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  drop_id: string;
  user_id: string;
  parent_comment_id: string | null;
  text: string;
  created_at: string;
  profiles: CommentProfile | null;
};

type DropRow = {
  id: string;
  author_id: string;
  comments_enabled: boolean;
  status: 'active' | 'ended' | 'cancelled';
  event_end_time: string | null;
  text: string;
};

function formatCommentTime(value: string) {
  const time = new Date(value).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d`;
}

export default function DropCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dropId = String(id ?? '');

  const [drop, setDrop] = useState<DropRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!dropId) {
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);

      const { data: dropData, error: dropError } = await supabase
        .from('drops')
        .select(`
          id,
          author_id,
          comments_enabled,
          status,
          event_end_time,
          text
        `)
        .eq('id', dropId)
        .is('deleted_at', null)
        .single();

      if (dropError) {
        Alert.alert('Comments', 'Could not load this Drop.');
        return;
      }

      const loadedDrop = dropData as DropRow;
      setDrop(loadedDrop);

      if (!loadedDrop.comments_enabled) {
        setComments([]);
        return;
      }

      const { data: commentData, error: commentsError } = await supabase
        .from('drop_comments')
        .select(`
          id,
          drop_id,
          user_id,
          parent_comment_id,
          text,
          created_at,
          profiles!drop_comments_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('drop_id', dropId)
        .order('created_at', {
          ascending: true,
        });

      if (commentsError) {
        console.warn('LOAD COMMENTS ERROR:', commentsError);
        Alert.alert('Comments', 'Could not load comments.');
        return;
      }

      setComments((commentData ?? []) as unknown as CommentRow[]);
    } finally {
      setLoading(false);
    }
  }, [dropId]);

  useFocusEffect(
    useCallback(() => {
      loadComments();
    }, [loadComments])
  );

  const ended = useMemo(() => {
    if (!drop) {
      return false;
    }

    if (drop.status !== 'active') {
      return true;
    }

    if (!drop.event_end_time) {
      return false;
    }

    return new Date(drop.event_end_time).getTime() < Date.now();
  }, [drop]);

  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments]
  );

  const repliesFor = useCallback(
    (commentId: string) =>
      comments.filter(
        (comment) => comment.parent_comment_id === commentId
      ),
    [comments]
  );

  const canCompose =
    !!drop &&
    drop.comments_enabled &&
    !ended &&
    !!currentUserId;

  const sendComment = async () => {
    const trimmed = text.trim();

    if (!trimmed || !canCompose || sending || !currentUserId) {
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase
        .from('drop_comments')
        .insert({
          drop_id: dropId,
          user_id: currentUserId,
          parent_comment_id: replyTo?.id ?? null,
          text: trimmed,
        });

      if (error) {
        console.warn('SEND COMMENT ERROR:', error);
        Alert.alert('Comment', error.message || 'Could not post comment.');
        return;
      }

      setText('');
      setReplyTo(null);
      await loadComments();
    } finally {
      setSending(false);
    }
  };

  const deleteComment = (comment: CommentRow) => {
    const canDelete =
      comment.user_id === currentUserId ||
      drop?.author_id === currentUserId;

    if (!canDelete) {
      return;
    }

    Alert.alert(
      'Delete comment?',
      comment.parent_comment_id
        ? 'This reply will be removed.'
        : 'This comment and its replies will be removed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('drop_comments')
              .delete()
              .eq('id', comment.id);

            if (error) {
              Alert.alert('Comment', 'Could not delete this comment.');
              return;
            }

            if (replyTo?.id === comment.id) {
              setReplyTo(null);
            }

            await loadComments();
          },
        },
      ]
    );
  };

  const openProfile = (comment: CommentRow) => {
    const username = comment.profiles?.username;

    if (!username) {
      return;
    }

    router.push(`/user/${username}` as any);
  };

  const renderComment = (
    comment: CommentRow,
    isReply = false
  ) => {
    const profile = comment.profiles;
    const name =
      profile?.display_name ||
      profile?.username ||
      'User';
    const canDelete =
      comment.user_id === currentUserId ||
      drop?.author_id === currentUserId;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentRow,
          isReply && styles.replyRow,
        ]}
      >
        <Pressable
          onPress={() => openProfile(comment)}
          hitSlop={6}
        >
          <UserAvatar
            uri={profile?.avatar_url ?? null}
            name={name}
            size={isReply ? 30 : 36}
          />
        </Pressable>

        <View style={styles.commentBody}>
          <View style={styles.commentTopRow}>
            <Pressable onPress={() => openProfile(comment)}>
              <Text style={styles.commentAuthor}>
                {profile?.username
                  ? `@${profile.username}`
                  : name}
              </Text>
            </Pressable>

            <Text style={styles.commentTime}>
              {formatCommentTime(comment.created_at)}
            </Text>
          </View>

          <Text style={styles.commentText}>
            {comment.text}
          </Text>

          <View style={styles.commentActions}>
            {!isReply && canCompose && (
              <Pressable
                hitSlop={8}
                onPress={() => setReplyTo(comment)}
              >
                <Text style={styles.commentActionText}>Reply</Text>
              </Pressable>
            )}

            {canDelete && (
              <Pressable
                hitSlop={8}
                onPress={() => deleteComment(comment)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={DropColors.warmWhite}
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.title}>Comments</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {comments.length > 0
              ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`
              : 'Public discussion'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={DropColors.warmWhite} />
        </View>
      ) : !drop?.comments_enabled ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Comments are off.</Text>
          <Text style={styles.emptySubtitle}>
            The organizer disabled comments for this Drop.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {rootComments.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyTitle}>No comments yet.</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to start the discussion.
              </Text>
            </View>
          ) : (
            rootComments.map((comment) => (
              <View key={comment.id} style={styles.thread}>
                {renderComment(comment)}

                {repliesFor(comment.id).map((reply) =>
                  renderComment(reply, true)
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {drop?.comments_enabled && (
        <View style={styles.composerWrap}>
          {ended ? (
            <Text style={styles.endedText}>
              This Drop has ended. Comments are read-only.
            </Text>
          ) : replyTo ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to{' '}
                {replyTo.profiles?.username
                  ? `@${replyTo.profiles.username}`
                  : replyTo.profiles?.display_name || 'User'}
              </Text>

              <Pressable
                hitSlop={8}
                onPress={() => setReplyTo(null)}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={DropColors.textMuted}
                />
              </Pressable>
            </View>
          ) : null}

          {!ended && (
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor={DropColors.textMuted}
                style={styles.input}
                multiline
                maxLength={500}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  (!text.trim() || sending) && styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={!text.trim() || sending}
                onPress={sendComment}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={DropColors.warmWhite}
                />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },

  header: {
    minHeight: 104,
    paddingTop: 48,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  headerCopy: {
    flex: 1,
  },

  title: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.light,
    fontSize: 26,
    lineHeight: 30,
  },

  subtitle: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
    marginTop: 1,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
  },

  thread: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },

  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },

  replyRow: {
    marginLeft: 44,
  },

  commentBody: {
    flex: 1,
  },

  commentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  commentAuthor: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 12,
  },

  commentTime: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },

  commentText: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },

  commentActions: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 3,
  },

  commentActionText: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },

  deleteText: {
    color: DropColors.wine,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  emptyInline: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 15,
  },

  emptySubtitle: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },

  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DropColors.border,
    backgroundColor: DropColors.graphite,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
  },

  replyBanner: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
  },

  replyBannerText: {
    flex: 1,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },

  composer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
    borderRadius: 22,
    backgroundColor: DropColors.surface,
  },

  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 32,
    paddingTop: 7,
    paddingBottom: 6,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
    fontSize: 13,
    textAlignVertical: 'top',
  },

  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DropColors.wine,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  endedText: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 7,
  },

  pressed: {
    opacity: 0.66,
  },
});