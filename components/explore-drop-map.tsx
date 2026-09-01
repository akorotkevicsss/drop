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

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

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
  region: MapRegion;
  onOpenCluster: (region: MapRegion) => void;
};

type PreviewProps = {
  drops: ExploreMapDrop[];
  selectedDropId: string | null;
  onOpenDrop: (dropId: string) => void;
};

type MapNode =
  | {
      kind: 'place';
      key: string;
      latitude: number;
      longitude: number;
      count: 1;
      drop: ExploreMapDrop;
    }
  | {
      kind: 'area';
      key: string;
      latitude: number;
      longitude: number;
      count: number;
      group: AreaGroup;
    };

type ClusterNode = {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  nodes: MapNode[];
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

function buildMapNodes(
  drops: ExploreMapDrop[]
): MapNode[] {
  const mappable = getMappableDrops(drops);

  const places: MapNode[] =
    mappable
      .filter((drop) => drop.location_type !== 'area')
      .map((drop) => ({
        kind: 'place' as const,
        key: `place:${drop.id}`,
        latitude: drop.location_lat as number,
        longitude: drop.location_lng as number,
        count: 1 as const,
        drop,
      }));

  const areas: MapNode[] =
    getAreaGroups(mappable).map((group) => ({
      kind: 'area' as const,
      key: group.key,
      latitude: group.latitude,
      longitude: group.longitude,
      count: group.drops.length,
      group,
    }));

  return [...places, ...areas];
}

/**
 * Screen-space grid clustering.
 *
 * Crucially, Area nodes carry their REAL Drop count.
 * Purvciems with 5 Drops therefore contributes 5 to a remote cluster,
 * while a Place contributes 1.
 *
 * At close zoom (longitudeDelta <= 0.22) we keep the existing UI:
 * Places stay individual and Areas stay grouped with their approximate circle.
 */
function clusterNodes(
  nodes: MapNode[],
  region: MapRegion
): ClusterNode[] {
  if (region.longitudeDelta <= 0.22) {
    return nodes.map((node) => ({
      key: `single:${node.key}`,
      latitude: node.latitude,
      longitude: node.longitude,
      count: node.count,
      nodes: [node],
    }));
  }

  // Cell size grows naturally as the visible map gets wider.
  // ~8 cells across the viewport gives a readable density map.
  const lngCell = Math.max(
    region.longitudeDelta / 8,
    0.025
  );
  const latCell = Math.max(
    region.latitudeDelta / 8,
    0.018
  );

  const buckets = new Map<
    string,
    {
      nodes: MapNode[];
      weightedLat: number;
      weightedLng: number;
      count: number;
    }
  >();

  for (const node of nodes) {
    const x = Math.floor(node.longitude / lngCell);
    const y = Math.floor(node.latitude / latCell);
    const key = `${x}:${y}`;

    const current = buckets.get(key) ?? {
      nodes: [],
      weightedLat: 0,
      weightedLng: 0,
      count: 0,
    };

    current.nodes.push(node);
    current.weightedLat += node.latitude * node.count;
    current.weightedLng += node.longitude * node.count;
    current.count += node.count;

    buckets.set(key, current);
  }

  return Array.from(buckets.entries()).map(
    ([key, bucket]) => ({
      key: `cluster:${key}`,
      latitude:
        bucket.weightedLat / bucket.count,
      longitude:
        bucket.weightedLng / bucket.count,
      count: bucket.count,
      nodes: bucket.nodes,
    })
  );
}

function clusterExpansionRegion(
  cluster: ClusterNode
): MapRegion {
  const latitudes =
    cluster.nodes.map((node) => node.latitude);
  const longitudes =
    cluster.nodes.map((node) => node.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  // Same-coordinate nodes (e.g. one Area group) still get a useful zoom.
  const latitudeDelta = Math.max(
    (maxLat - minLat) * 2.2,
    0.08
  );

  const longitudeDelta = Math.max(
    (maxLng - minLng) * 2.2,
    0.08
  );

  return {
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

export function DropMapMarkers({
  drops,
  selectedDropId,
  onSelectDrop,
  region,
  onOpenCluster,
}: MarkerProps) {
  if (!Marker) return null;

  const mappableDrops = getMappableDrops(drops);
  const selectedArea =
    findAreaGroupForDrop(
      mappableDrops,
      selectedDropId
    );

  const clusters =
    clusterNodes(
      buildMapNodes(mappableDrops),
      region
    );

  return (
    <>
      {clusters.map((cluster) => {
        const node =
          cluster.nodes.length === 1
            ? cluster.nodes[0]
            : null;

        const isRemoteCluster =
          region.longitudeDelta > 0.22 &&
          (
            cluster.nodes.length > 1 ||
            cluster.count > 1
          );

        if (isRemoteCluster) {
          return (
            <Marker
              key={cluster.key}
              coordinate={{
                latitude: cluster.latitude,
                longitude: cluster.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={150}
              tracksViewChanges={false}
              stopPropagation
              onPress={(event: any) => {
                event?.stopPropagation?.();
                onSelectDrop(null);
                onOpenCluster(
                  clusterExpansionRegion(cluster)
                );
              }}
            >
              <View
                pointerEvents="none"
                style={styles.clusterMarker}
              >
                <Text
                  pointerEvents="none"
                  style={styles.clusterMarkerCount}
                >
                  {cluster.count > 999
                    ? '999+'
                    : cluster.count}
                </Text>
              </View>
            </Marker>
          );
        }

        if (!node) return null;

        if (node.kind === 'place') {
          const selected =
            selectedDropId === node.drop.id;

          return (
            <Marker
              key={node.key}
              coordinate={{
                latitude: node.latitude,
                longitude: node.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={selected ? 100 : 60}
              tracksViewChanges
              stopPropagation
              onPress={(event: any) => {
                event?.stopPropagation?.();
                onSelectDrop(node.drop.id);
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
        }

        const group = node.group;
        const selected =
          selectedArea?.key === group.key;

        const selectionId =
          group.drops[0]?.id ?? null;

        if (!selectionId) return null;

        return (
          <View key={node.key}>
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
                  {group.drops.length > 99
                    ? '99+'
                    : group.drops.length}
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
            <View style={styles.previewLocationWrap}>
              <Text
                numberOfLines={1}
                style={styles.previewLocation}
              >
                {areaGroup.name}
              </Text>

              <Text style={styles.previewAreaHint}>
                APPROXIMATE AREA
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {count}
              </Text>
            </View>
          </View>

          <Text style={styles.areaTitle}>
            {count}{' '}
            {count === 1 ? 'Drop' : 'Drops'}{' '}
            in {areaGroup.name}
          </Text>

          <Text
            style={styles.previewOpenArea}
            onPress={() => {
              router.push({
                pathname: '/area-drops',
                params: {
                  areaKey: areaGroup.key,
                  areaName: areaGroup.name,
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

  clusterMarker: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 11,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DropColors.wine,
    borderWidth: 3,
    borderColor: DropColors.warmWhite,
  },

  clusterMarkerCount: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 13,
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