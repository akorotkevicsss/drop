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
  location_provider_id: string | null;
  event_end_time: string | null;
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
            location_provider_id,
            event_end_time,
            created_at,
            profiles!drops_author_id_fkey (
              username,
              display_name
            )
          `)
          .eq('status', 'active')
          .eq('location_type', 'area')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        const normalizeArea = (
          value: string | null | undefined
        ) =>
          (value ?? '')
            .trim()
            .toLocaleLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');

        const targetName =
          normalizeArea(areaName);

        const now =
          Date.now();

        const matchingDrops =
          (
            (data ?? []) as unknown as AreaDrop[]
          ).filter((drop) => {
            if (
              drop.event_end_time &&
              new Date(
                drop.event_end_time
              ).getTime() <= now
            ) {
              return false;
            }

            const sameProvider =
              !!areaKey &&
              drop.location_provider_id ===
                areaKey;

            const sameName =
              !!targetName &&
              normalizeArea(
                drop.location_name ||
                  drop.location_text
              ) === targetName;

            return (
              sameProvider ||
              sameName
            );
          });

        if (!cancelled) {
          setDrops(
            matchingDrops
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
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/drop/[id]',
                      params: {
                        id: drop.id,
                      },
                    } as any)
                  }
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.author}>
                      {author}
                    </Text>

                    <Text style={styles.dropText}>
                      {drop.text}
                    </Text>
                  </View>

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
    paddingBottom: 44,
  },
  row: {
    minHeight: 112,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
    backgroundColor: DropColors.graphite,
  },
  rowPressed: {
    opacity: 0.68,
  },
  rowContent: {
    paddingRight: 96,
  },
  author: {
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  dropText: {
    marginTop: 9,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 18,
    lineHeight: 24,
  },
  open: {
    position: 'absolute',
    right: 18,
    bottom: 18,
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