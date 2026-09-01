import { Fragment } from 'react';

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
  profiles: {
    username: string | null;
    display_name: string | null;
    city: string | null;
    avatar_url: string | null;
  } | null;
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

function isMappableDrop(
  drop: ExploreMapDrop
) {
  if (drop.status !== 'active') {
    return false;
  }

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

function getAreaRadius(
  drop: ExploreMapDrop
) {
  const radius =
    drop.location_radius_m;

  if (
    typeof radius === 'number' &&
    Number.isFinite(radius) &&
    radius > 0
  ) {
    return radius;
  }

  return 1200;
}

export function getMappableDrops<
  T extends ExploreMapDrop
>(
  drops: T[]
) {
  return drops.filter(isMappableDrop);
}

export function DropMapMarkers({
  drops,
  selectedDropId,
  onSelectDrop,
}: MarkerProps) {
  if (!Marker) {
    return null;
  }

  const mappableDrops =
    getMappableDrops(drops);

  return (
    <>
      {mappableDrops.map((drop) => {
        const coordinate = {
          latitude:
            drop.location_lat as number,
          longitude:
            drop.location_lng as number,
        };

        const selected =
          selectedDropId === drop.id;

        const isArea =
          drop.location_type === 'area';

        const areaRadius =
          getAreaRadius(drop);

        return (
          <Fragment key={drop.id}>
            {isArea && Circle ? (
              <>
                <Circle
                  center={coordinate}
                  radius={areaRadius}
                  fillColor={
                    selected
                      ? 'rgba(125,13,13,0.16)'
                      : 'rgba(125,13,13,0.10)'
                  }
                  strokeColor={
                    selected
                      ? 'rgba(125,13,13,0.72)'
                      : 'rgba(125,13,13,0.40)'
                  }
                  strokeWidth={
                    selected
                      ? 2
                      : 1
                  }
                  zIndex={1}
                  tappable
                  onPress={(event: any) => {
                    event?.stopPropagation?.();
                    onSelectDrop(drop.id);
                  }}
                />

                {selected && (
                  <Circle
                    center={coordinate}
                    radius={areaRadius}
                    fillColor="rgba(125,13,13,0.16)"
                    strokeColor="rgba(125,13,13,0.72)"
                    strokeWidth={2}
                    zIndex={2}
                    tappable
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      onSelectDrop(drop.id);
                    }}
                  />
                )}
              </>
            ) : null}

            <Marker
              coordinate={coordinate}
              tracksViewChanges
              anchor={{
                x: 0.5,
                y: 0.5,
              }}
              zIndex={
                selected
                  ? 100
                  : isArea
                    ? 80
                    : 60
              }
              onPress={(event: any) => {
                event?.stopPropagation?.();
                onSelectDrop(drop.id);
              }}
            >
              <View
                style={[
                  styles.marker,
                  isArea &&
                    styles.areaMarker,
                  selected &&
                    styles.markerSelected,
                  selected &&
                    isArea &&
                    styles.areaMarkerSelected,
                ]}
              >
                {isArea ? (
                  <View
                    style={[
                      styles.areaMarkerInner,
                      selected &&
                        styles.areaMarkerInnerSelected,
                    ]}
                  />
                ) : null}
              </View>
            </Marker>
          </Fragment>
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
  const selectedDrop =
    getMappableDrops(drops).find(
      (drop) =>
        drop.id === selectedDropId
    ) ?? null;

  if (!selectedDrop) {
    return null;
  }

  const isArea =
    selectedDrop.location_type === 'area';

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
      <Pressable
        style={styles.preview}
        onPress={() =>
          onOpenDrop(selectedDrop.id)
        }
      >
        <View style={styles.previewTopRow}>
          <View style={styles.previewLocationWrap}>
            <Text
              numberOfLines={1}
              style={styles.previewLocation}
            >
              {locationLabel}
            </Text>

            {isArea && (
              <Text
                numberOfLines={1}
                style={styles.previewAreaHint}
              >
                Approximate area
              </Text>
            )}
          </View>

          <View
            style={[
              styles.previewTypeBadge,
              isArea &&
                styles.previewAreaBadge,
            ]}
          >
            <Text style={styles.previewType}>
              {isArea
                ? 'AREA'
                : 'PLACE'}
            </Text>
          </View>
        </View>

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
      </Pressable>
    </View>
  );
}

const styles =
  StyleSheet.create({
    marker: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor:
        DropColors.wine,
      borderWidth: 3,
      borderColor:
        DropColors.warmWhite,
    },

    markerSelected: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 4,
    },

    areaMarker: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        DropColors.warmWhite,
      borderWidth: 2,
      borderColor:
        DropColors.wine,
    },

    areaMarkerSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 3,
    },

    areaMarkerInner: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor:
        DropColors.wine,
    },

    areaMarkerInnerSelected: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
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
      backgroundColor:
        DropColors.graphite,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
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
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
    },

    previewAreaHint: {
      marginTop: 2,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 9,
    },

    previewTypeBadge: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    previewAreaBadge: {
      borderColor:
        'rgba(125,13,13,0.65)',
      backgroundColor:
        'rgba(125,13,13,0.12)',
    },

    previewType: {
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 8,
      letterSpacing: 0.8,
    },

    previewText: {
      marginTop: 8,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
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
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
    },

    previewOpen: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
    },
  });