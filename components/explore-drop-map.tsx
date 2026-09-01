import { router } from 'expo-router';
import * as ReactNativeMaps from 'react-native-maps';

import {
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
  onSelectDrop: (dropId: string | null) => void;
};

type PreviewProps = {
  drops: ExploreMapDrop[];
  selectedDropId: string | null;
  onOpenDrop: (dropId: string) => void;
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

    // Group provider-backed Areas by provider id.
    // Legacy same-name Areas still group together.
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

function findAreaGroupForDrop(
  drops: ExploreMapDrop[],
  selectedDropId: string | null
) {
  if (!selectedDropId) return null;

  return (
    getAreaGroups(drops).find((group) =>
      group.drops.some(
        (drop) => drop.id === selectedDropId
      )
    ) ?? null
  );
}

export function DropMapMarkers({
  drops,
  selectedDropId,
  onSelectDrop,
}: MarkerProps) {
  if (!Marker) return null;

  const mappableDrops = getMappableDrops(drops);

  const placeDrops = mappableDrops.filter(
    (drop) => drop.location_type !== 'area'
  );

  const areaGroups = getAreaGroups(mappableDrops);

  const selectedArea =
    findAreaGroupForDrop(
      mappableDrops,
      selectedDropId
    );

  return (
    <>
      {placeDrops.map((drop) => {
        const selected =
          selectedDropId === drop.id;

        return (
          <Marker
            key={drop.id}
            coordinate={{
              latitude:
                drop.location_lat as number,
              longitude:
                drop.location_lng as number,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={selected ? 100 : 60}
            tracksViewChanges
            stopPropagation
            onPress={(event: any) => {
              event?.stopPropagation?.();
              onSelectDrop(drop.id);
            }}
          >
            <View
              pointerEvents="none"
              style={[
                styles.placeMarker,
                selected &&
                  styles.placeMarkerSelected,
              ]}
            />
          </Marker>
        );
      })}

      {areaGroups.map((group) => {
        const selected =
          selectedArea?.key === group.key;

        const count =
          group.drops.length;

        // Existing Explore already owns selectedMapDropId.
        // Use the first Drop id as the group's stable selection token.
        const selectionId =
          group.drops[0]?.id ?? null;

        if (!selectionId) return null;

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
                strokeWidth={
                  selected ? 2 : 1
                }
                zIndex={1}
                tappable
                onPress={(event: any) => {
                  event?.stopPropagation?.();
                  onSelectDrop(selectionId);
                }}
              />
            ) : null}

            <Marker
              coordinate={{
                latitude: group.latitude,
                longitude: group.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={selected ? 120 : 90}
              tracksViewChanges={false}
              stopPropagation
              onPress={(event: any) => {
                event?.stopPropagation?.();
                onSelectDrop(selectionId);
              }}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.areaMarker,
                  selected &&
                    styles.areaMarkerSelected,
                ]}
              >
                <Text
                  pointerEvents="none"
                  style={styles.areaMarkerCount}
                >
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
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
  onOpenDrop,
}: PreviewProps) {
  const mappableDrops =
    getMappableDrops(drops);

  const areaGroup =
    findAreaGroupForDrop(
      mappableDrops,
      selectedDropId
    );

  if (areaGroup) {
    const count =
      areaGroup.drops.length;

    return (
      <View
        pointerEvents="box-none"
        style={styles.previewLayer}
      >
        <View style={styles.preview}>
          <View style={styles.previewTopRow}>
            <View
              style={styles.previewLocationWrap}
            >
              <Text
                numberOfLines={1}
                style={styles.previewLocation}
              >
                {areaGroup.name}
              </Text>

              <Text
                style={styles.previewAreaHint}
              >
                APPROXIMATE AREA
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text
                style={styles.countBadgeText}
              >
                {count}
              </Text>
            </View>
          </View>

          <Text style={styles.areaTitle}>
            {count}{' '}
            {count === 1
              ? 'Drop'
              : 'Drops'}{' '}
            in {areaGroup.name}
          </Text>

          <Text
            style={styles.previewOpenArea}
            onPress={() => {
              router.push({
                pathname: '/area-drops',
                params: {
                  areaKey:
                    areaGroup.key,
                  areaName:
                    areaGroup.name,
                },
              } as any);
            }}
          >
            View Drops →
          </Text>
        </View>
      </View>
    );
  }

  const selectedDrop =
    mappableDrops.find(
      (drop) =>
        drop.id === selectedDropId
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
    <View
      pointerEvents="box-none"
      style={styles.previewLayer}
    >
      <View
        style={styles.preview}
        onTouchEnd={() =>
          onOpenDrop(selectedDrop.id)
        }
      >
        <Text
          numberOfLines={1}
          style={styles.previewLocation}
        >
          {locationLabel}
        </Text>

        <Text
          numberOfLines={2}
          style={styles.previewText}
        >
          {selectedDrop.text}
        </Text>

        <View style={styles.previewBottomRow}>
          <Text
            numberOfLines={1}
            style={styles.previewAuthor}
          >
            {authorLabel}
          </Text>

          <Text style={styles.previewOpen}>
            View Drop →
          </Text>
        </View>
      </View>
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
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DropColors.wine,
    borderWidth: 3,
    borderColor: DropColors.warmWhite,
  },

  areaMarkerSelected: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 4,
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
    letterSpacing: 0.7,
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

  previewOpenArea: {
    marginTop: 14,
    alignSelf: 'flex-end',
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