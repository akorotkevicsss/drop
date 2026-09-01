import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    DropColors,
    DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type AreaDrop = {
  id: string;
  text: string;
  location_name: string | null;
  location_text: string | null;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
  } | null;
};

export default function AreaDropsScreen() {
  const {
    areaKey,
    areaName,
  } = useLocalSearchParams<{
    areaKey?: string;
    areaName?: string;
  }>();

  const [drops, setDrops] = useState<AreaDrop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from('drops')
          .select(`
            id,
            text,
            location_name,
            location_text,
            created_at,
            profiles (
              username,
              display_name
            )
          `)
          .eq('status', 'active')
          .eq('location_type', 'area')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (
          areaKey &&
          !areaKey.startsWith('area:')
        ) {
          query = query.eq(
            'location_provider_id',
            areaKey
          );
        } else if (areaName) {
          query = query.ilike(
            'location_name',
            areaName
          );
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setDrops(
            (data ?? []) as unknown as AreaDrop[]
          );
        }
      } catch (error) {
        console.warn(
          'AREA DROPS LOAD WARNING:',
          error
        );

        if (!cancelled) {
          setDrops([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [areaKey, areaName]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerSide}
          onPress={() => router.back()}
        >
          <Text style={styles.back}>
            Back
          </Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {areaName || 'Area'}
          </Text>
          <Text style={styles.subtitle}>
            {loading
              ? 'Loading Drops'
              : `${drops.length} ${drops.length === 1 ? 'Drop' : 'Drops'}`}
          </Text>
        </View>

        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={DropColors.warmWhite}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {drops.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No active Drops here
              </Text>
              <Text style={styles.emptyText}>
                This Area feed is only available from the map.
              </Text>
            </View>
          ) : (
            drops.map((drop) => {
              const author =
                drop.profiles?.display_name ||
                drop.profiles?.username ||
                'Drop';

              return (
                <Pressable
                  key={drop.id}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: '/drop/[id]',
                      params: {
                        id: drop.id,
                      },
                    } as any)
                  }
                >
                  <Text style={styles.author}>
                    {author}
                  </Text>

                  <Text style={styles.dropText}>
                    {drop.text}
                  </Text>

                  <Text style={styles.open}>
                    View Drop →
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },
  header: {
    paddingTop: 52,
    minHeight: 104,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  headerSide: {
    width: 64,
  },
  back: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    maxWidth: '100%',
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 17,
  },
  subtitle: {
    marginTop: 3,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingVertical: 14,
    paddingBottom: 44,
  },
  card: {
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: DropColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  author: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  dropText: {
    marginTop: 10,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  open: {
    marginTop: 16,
    alignSelf: 'flex-end',
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  empty: {
    paddingHorizontal: 28,
    paddingTop: 90,
    alignItems: 'center',
  },
  emptyTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 17,
  },
  emptyText: {
    marginTop: 8,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 12,
    textAlign: 'center',
  },
});