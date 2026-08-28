import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { DropColors, DropTypography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type DropCommentsPreviewProps = {
  dropId: string;
  enabled: boolean;
};

export function DropCommentsPreview({
  dropId,
  enabled,
}: DropCommentsPreviewProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!enabled) {
        if (mounted) setCount(0);
        return;
      }

      const { count: total } = await supabase
        .from('drop_comments')
        .select('id', { count: 'exact', head: true })
        .eq('drop_id', dropId)
        .is('deleted_at', null);

      if (mounted) {
        setCount(total ?? 0);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [dropId, enabled]);

  if (!enabled || count === 0) {
    return null;
  }

  return (
    <Pressable
      style={styles.container}
      onPress={() =>
        router.push({
          pathname: '/drop/[id]/comments',
          params: { id: dropId },
        } as any)
      }
    >
      <Text style={styles.text}>
        {count === 1 ? 'View 1 comment' : `View all ${count} comments`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  text: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },
});