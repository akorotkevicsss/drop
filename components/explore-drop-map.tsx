import * as ReactNativeMaps from 'react-native-maps';

import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    DropColors,
    DropTypography,
} from '@/constants/theme';

const Marker =
  (ReactNativeMaps as any).Marker ??
  (ReactNativeMaps as any).default?.Marker;

const Circle =
  (ReactNativeMaps as any).Circle ??
  (ReactNativeMaps as any).default?.Circle;

export type ExploreMapDrop = {
  id: string;
  text: string;
  status: 'active' | 'ended' | 'cancelled';
  event_end_time: string | null;
  location_text: string | null;
  location_type: 'place' | 'area' | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_m: number | null;
  location_provider_id?: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    city: string | null;
    avatar_url: string | null;
  } | null;
};

export type AreaGroup = {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  drops: ExploreMapDrop[];
};

type MarkerProps = {
  drops: ExploreMapDrop[];
  selectedDropId: string | null;
  selectedAreaKey?: string | null;
  onSelectDrop: (dropId: string | null) => void;
  onSelectArea?: (areaKey: string | null) => void;
};

type PreviewProps = {
  drops: ExploreMapDrop[];
  selectedDropId: string | null;
  selectedAreaKey?: string | null;
  onOpenDrop: (dropId: string) => void;
  onOpenArea?: (group: AreaGroup) => void;
};

function normalizeAreaName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isMappableDrop(drop: ExploreMapDrop) {
  if (drop.status !== 'active') return false;

  if (
    typeof drop.location_lat !== 'number' ||
    typeof drop.location_lng !== 'number'
  ) {
    return false;
  }

  if (
    drop.event_end_time &&
    new Date(drop.event_end_time).getTime() <= Date.now()
  ) {
    return false;
  }

  return true;
}

export function getMappableDrops<T extends ExploreMapDrop>(
  drops: T[]
) {
  return drops.filter(isMappableDrop);
}

export function getAreaGroups(
  drops: ExploreMapDrop[]
): AreaGroup[] {
  const groups = new Map<string, AreaGroup>();

  for (const drop of getMappableDrops(drops)) {
    if (drop.location_type !== 'area') continue;

    const name =
      drop.location_name ||
      drop.location_text ||
      'Area';

    // Prefer provider id. Fallback to normalized name so legacy Riga drops still group.
    const key =
      drop.location_provider_id ||
      `area:${normalizeAreaName(name)}`;

    const existing = groups.get(key);

    if (existing) {
      existing.drops.push(drop);
      continue;
    }

    groups.set(key, {
      key,
      name,
      latitude: drop.location_lat as number,
      longitude: drop.location_lng as number,
      radiusM:
        typeof drop.location_radius_m === 'number' &&
        drop.location_radius_m > 0
          ? drop.location_radius_m
          : 1600,
      drops: [drop],
    });
  }

  return Array.from(groups.values());
}

export function DropMapMarkers({
  drops,
  selectedDropId,
  selectedAreaKey = null,
  onSelectDrop,
  onSelectArea,
}: MarkerProps) {
  if (!Marker) return null;

  const mappableDrops = getMappableDrops(drops);
  const placeDrops = mappableDrops.filter(
    (drop) => drop.location_type !== 'area'
  );
  const areaGroups = getAreaGroups(mappableDrops);

  return (
    <>
      {placeDrops.map((drop) => {
        const selected = selectedDropId === drop.id;

        return (
          <Marker
            key={drop.id}
            coordinate={{
              latitude: drop.location_lat as number,
              longitude: drop.location_lng as number,
            }}
            tracksViewChanges
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={selected ? 100 : 60}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              onSelectArea?.(null);
              onSelectDrop(drop.id);
            }}
          >
            <View
              style={[
                styles.placeMarker,
                selected && styles.placeMarkerSelected,
              ]}
            />
          </Marker>
        );
      })}

      {areaGroups.map((group) => {
        const selected = selectedAreaKey === group.key;
        const count = group.drops.length;

        return (
          <View key={group.key}>
            {Circle ? (
              <Circle
                center={{
                  latitude: group.latitude,
                  longitude: group.longitude,
                }}
                radius={group.radiusM}
                fillColor={
                  selected
                    ? 'rgba(125,13,13,0.16)'
                    : 'rgba(125,13,13,0.09)'
                }
                strokeColor={
                  selected
                    ? 'rgba(125,13,13,0.72)'
                    : 'rgba(125,13,13,0.42)'
                }
                strokeWidth={selected ? 2 : 1}
                zIndex={1}
                tappable
                onPress={(event: any) => {
                  event?.stopPropagation?.();
                  onSelectDrop(null);
                  onSelectArea?.(group.key);
                }}
              />
            ) : null}

            <Marker
            key={group.key}
            coordinate={{
              latitude: group.latitude,
              longitude: group.longitude,
            }}
            tracksViewChanges
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={selected ? 110 : 80}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              onSelectDrop(null);
              onSelectArea?.(group.key);
            }}
          >
            <Pressable
              onPress={() => {
                onSelectDrop(null);
                onSelectArea?.(group.key);
              }}
              hitSlop={12}
              style={[
                styles.areaMarker,
                selected && styles.areaMarkerSelected,
              ]}
            >
              <Text style={styles.areaMarkerCount}>
                {count > 99 ? '99+' : count}
              </Text>
            </Pressable>
          </Marker>
          </View>
        );
      })}
    </>
  );
}

export function DropMapPreview({
  drops,
  selectedDropId,
  selectedAreaKey = null,
  onOpenDrop,
  onOpenArea,
}: PreviewProps) {
  const mappableDrops = getMappableDrops(drops);

  if (selectedAreaKey) {
    const group =
      getAreaGroups(mappableDrops).find(
        (item) => item.key === selectedAreaKey
      ) ?? null;

    if (!group) return null;

    const count = group.drops.length;

    return (
      <View pointerEvents="box-none" style={styles.previewLayer}>
        <View style={styles.preview}>
          <View style={styles.previewTopRow}>
            <View style={styles.previewLocationWrap}>
              <Text numberOfLines={1} style={styles.previewLocation}>
                {group.name}
              </Text>
              <Text style={styles.previewAreaHint}>
                AREA
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {count}
              </Text>
            </View>
          </View>

          <Text style={styles.areaTitle}>
            {count} {count === 1 ? 'Drop' : 'Drops'} in {group.name}
          </Text>

          <Pressable
            style={styles.viewAreaButton}
            onPress={() => onOpenArea?.(group)}
          >
            <Text style={styles.viewAreaButtonText}>
              View Drops →
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const selectedDrop =
    mappableDrops.find(
      (drop) => drop.id === selectedDropId
    ) ?? null;

  if (!selectedDrop) return null;

  const locationLabel =
    selectedDrop.location_name ||
    selectedDrop.location_text ||
    'Drop';

  const authorLabel =
    selectedDrop.profiles?.display_name ||
    selectedDrop.profiles?.username ||
    'Drop';

  return (
    <View pointerEvents="box-none" style={styles.previewLayer}>
      <Pressable
        style={styles.preview}
        onPress={() => onOpenDrop(selectedDrop.id)}
      >
        <Text numberOfLines={1} style={styles.previewLocation}>
          {locationLabel}
        </Text>

        <Text numberOfLines={2} style={styles.previewText}>
          {selectedDrop.text}
        </Text>

        <View style={styles.previewBottomRow}>
          <Text numberOfLines={1} style={styles.previewAuthor}>
            {authorLabel}
          </Text>
          <Text style={styles.previewOpen}>
            View Drop →
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  placeMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DropColors.wine,
    borderWidth: 3,
    borderColor: DropColors.warmWhite,
  },
  placeMarkerSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 4,
  },
  areaMarker: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 9,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DropColors.wine,
    borderWidth: 2,
    borderColor: DropColors.warmWhite,
  },
  areaMarkerSelected: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  areaMarkerCount: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 12,
  },
  previewLayer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 86,
  },
  preview: {
    minHeight: 118,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: DropColors.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DropColors.border,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewLocationWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewLocation: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  previewAreaHint: {
    marginTop: 2,
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125,13,13,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125,13,13,0.65)',
  },
  countBadgeText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 12,
  },
  areaTitle: {
    marginTop: 10,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 17,
    lineHeight: 22,
  },
  viewAreaButton: {
    alignSelf: 'flex-end',
    marginTop: 14,
    paddingVertical: 5,
  },
  viewAreaButtonText: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 12,
  },
  previewText: {
    marginTop: 8,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 16,
    lineHeight: 21,
  },
  previewBottomRow: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewAuthor: {
    flex: 1,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
  },
  previewOpen: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
});