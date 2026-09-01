import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DropColors, DropTypography } from '@/constants/theme';

export type DropLocationType = 'place' | 'area';

export type DropLocationValue = {
  type: DropLocationType;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusM: number | null;
  providerId: string | null;
};

type MapboxFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
    };
  };
};

type SearchResult = {
  id: string;
  name: string;
  subtitle: string;
  featureType: string;
  longitude: number;
  latitude: number;
};

type Props = {
  visible: boolean;
  value: DropLocationValue | null;
  onClose: () => void;
  onChange: (value: DropLocationValue | null) => void;
};

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

type LocalArea = {
  name: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  radiusM: number;
};

const LOCAL_RIGA_AREAS: LocalArea[] = [
  { name: 'Purvciems', aliases: ['purvciems', 'пурвциемс'], latitude: 56.9580, longitude: 24.1770, radiusM: 1800 },
  { name: 'Centrs', aliases: ['centrs', 'centre', 'center', 'центр'], latitude: 56.9547, longitude: 24.1131, radiusM: 1800 },
  { name: 'Vecrīga', aliases: ['vecriga', 'vecrīga', 'old riga', 'old town', 'старая рига'], latitude: 56.9496, longitude: 24.1052, radiusM: 900 },
  { name: 'Teika', aliases: ['teika', 'тейка'], latitude: 56.9750, longitude: 24.1660, radiusM: 1500 },
  { name: 'Mežaparks', aliases: ['mezaparks', 'mežaparks', 'межапарк'], latitude: 57.0050, longitude: 24.1510, radiusM: 1800 },
  { name: 'Āgenskalns', aliases: ['agenskalns', 'āgenskalns', 'агенскалнс'], latitude: 56.9360, longitude: 24.0710, radiusM: 1800 },
  { name: 'Imanta', aliases: ['imanta', 'иманта'], latitude: 56.9600, longitude: 24.0170, radiusM: 2200 },
  { name: 'Iļģuciems', aliases: ['ilguciems', 'iļģuciems', 'ильгюциемс'], latitude: 56.9730, longitude: 24.0660, radiusM: 1700 },
  { name: 'Zolitūde', aliases: ['zolitude', 'zolitūde', 'золитуде'], latitude: 56.9430, longitude: 24.0100, radiusM: 1600 },
  { name: 'Pļavnieki', aliases: ['plavnieki', 'pļavnieki', 'плавниеки'], latitude: 56.9390, longitude: 24.1990, radiusM: 1800 },
  { name: 'Dārzciems', aliases: ['darzciems', 'dārzciems', 'дарзциемс'], latitude: 56.9300, longitude: 24.1640, radiusM: 1600 },
  { name: 'Ķengarags', aliases: ['kengarags', 'ķengarags', 'кенгарагс'], latitude: 56.9100, longitude: 24.1850, radiusM: 2300 },
  { name: 'Sarkandaugava', aliases: ['sarkandaugava', 'саркандаугава'], latitude: 56.9950, longitude: 24.1210, radiusM: 1800 },
  { name: 'Jugla', aliases: ['jugla', 'югла'], latitude: 56.9870, longitude: 24.2440, radiusM: 2200 },
  { name: 'Ziepniekkalns', aliases: ['ziepniekkalns', 'зиепниеккалнс'], latitude: 56.9000, longitude: 24.1000, radiusM: 2200 },
  { name: 'Bolderāja', aliases: ['bolderaja', 'bolderāja', 'болдерая'], latitude: 57.0310, longitude: 24.0550, radiusM: 2200 },
  { name: 'Daugavgrīva', aliases: ['daugavgriva', 'daugavgrīva', 'даугавгрива'], latitude: 57.0430, longitude: 24.0360, radiusM: 1800 },
];

function localAreaResults(query: string): SearchResult[] {
  const needle = normalizeText(query);
  if (needle.length < 2) return [];

  return LOCAL_RIGA_AREAS
    .filter((area) =>
      [area.name, ...area.aliases].some((alias) =>
        normalizeText(alias).includes(needle)
      )
    )
    .map((area) => ({
      id: `drop-area:riga:${normalizeText(area.name).replace(/\s+/g, '-')}`,
      name: area.name,
      subtitle: 'Riga, Latvia',
      featureType: 'neighborhood',
      longitude: area.longitude,
      latitude: area.latitude,
    }));
}

function localAreaRadius(result: SearchResult) {
  const match = LOCAL_RIGA_AREAS.find(
    (area) => normalizeText(area.name) === normalizeText(result.name)
  );
  return match?.radiusM ?? null;
}

const AREA_TYPES = new Set([
  'neighborhood',
  'locality',
  'place',
  'city',
  'district',
  'region',
]);

function featureToResult(
  feature: MapboxFeature
): SearchResult | null {
  const geometryCoordinates =
    feature.geometry?.coordinates;

  const propertyLongitude =
    feature.properties?.coordinates?.longitude;

  const propertyLatitude =
    feature.properties?.coordinates?.latitude;

  const longitude =
    geometryCoordinates?.[0] ??
    propertyLongitude;

  const latitude =
    geometryCoordinates?.[1] ??
    propertyLatitude;

  if (
    typeof longitude !== 'number' ||
    typeof latitude !== 'number'
  ) {
    return null;
  }

  const properties =
    feature.properties ?? {};

  const name =
    properties.name_preferred ||
    properties.name ||
    'Location';

  const subtitle =
    properties.full_address ||
    properties.place_formatted ||
    '';

  return {
    id:
      properties.mapbox_id ||
      feature.id ||
      `${longitude}:${latitude}:${name}`,
    name,
    subtitle,
    featureType:
      properties.feature_type || '',
    longitude,
    latitude,
  };
}

function normalizeText(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function distanceMeters(
  a: SearchResult,
  b: SearchResult
) {
  const earthRadiusM = 6371000;

  const lat1 =
    (a.latitude * Math.PI) / 180;

  const lat2 =
    (b.latitude * Math.PI) / 180;

  const deltaLat =
    ((b.latitude - a.latitude) * Math.PI) / 180;

  const deltaLng =
    ((b.longitude - a.longitude) * Math.PI) / 180;

  const sinLat =
    Math.sin(deltaLat / 2);

  const sinLng =
    Math.sin(deltaLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h)
    );

  return earthRadiusM * c;
}

function pickPermanentMatch(
  temporaryResult: SearchResult,
  permanentResults: SearchResult[],
  mode: DropLocationType
) {
  if (
    permanentResults.length === 0
  ) {
    return null;
  }

  const temporaryName =
    normalizeText(
      temporaryResult.name
    );

  const compatibleResults =
    permanentResults.filter(
      (candidate) => {
        if (
          mode === 'area' &&
          !AREA_TYPES.has(
            candidate.featureType
          )
        ) {
          return false;
        }

        const candidateName =
          normalizeText(
            candidate.name
          );

        const sameName =
          candidateName ===
          temporaryName;

        const sameType =
          mode === 'area'
            ? AREA_TYPES.has(
                candidate.featureType
              )
            : (
                !temporaryResult.featureType ||
                !candidate.featureType ||
                candidate.featureType ===
                  temporaryResult.featureType
              );

        return (
          sameName &&
          sameType
        );
      }
    );

  if (
    compatibleResults.length === 0
  ) {
    return null;
  }

  const sorted =
    [...compatibleResults].sort(
      (a, b) =>
        distanceMeters(
          temporaryResult,
          a
        ) -
        distanceMeters(
          temporaryResult,
          b
        )
    );

  const best =
    sorted[0];

  const maxDistanceM =
    mode === 'area'
      ? 30000
      : 3000;

  if (
    distanceMeters(
      temporaryResult,
      best
    ) >
    maxDistanceM
  ) {
    return null;
  }

  return best;
}

async function geocode(
  query: string,
  permanent: boolean,
  limit = 8,
  proximity?: {
    longitude: number;
    latitude: number;
  },
  types?: string
): Promise<SearchResult[]> {
  const params =
    new URLSearchParams({
      q: query,
      access_token:
        MAPBOX_TOKEN,
      autocomplete: 'true',
      limit: String(limit),
      language: 'lv,en',
      country: 'lv',
    });

  if (proximity) {
    params.set(
      'proximity',
      `${proximity.longitude},${proximity.latitude}`
    );
  }

  if (types) {
    params.set(
      'types',
      types
    );
  }

  if (permanent) {
    params.set(
      'permanent',
      'true'
    );
  }

  const response =
    await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      `Mapbox request failed (${response.status})`
    );
  }

  const data =
    await response.json();

  return (
    data.features ?? []
  )
    .map(
      featureToResult
    )
    .filter(
      (
        item: SearchResult | null
      ): item is SearchResult =>
        !!item
    );
}


async function searchAreas(
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  const areaTypes =
    'neighborhood,locality,place,district,region';

  const searchBoxParams =
    new URLSearchParams({
      q: query,
      access_token:
        MAPBOX_TOKEN,
      limit: String(limit),
      language: 'lv,en',
      country: 'LV',
      types:
        'neighborhood,locality,place,city,district,region',
      near: 'Riga, Latvia',
    });

  const searchBoxPromise =
    fetch(
      `https://api.mapbox.com/search/searchbox/v1/forward?${searchBoxParams.toString()}`
    )
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }

        const data =
          await response.json();

        return (
          data.features ?? []
        )
          .map(
            featureToResult
          )
          .filter(
            (
              item: SearchResult | null
            ): item is SearchResult =>
              !!item &&
              AREA_TYPES.has(
                item.featureType
              )
          );
      })
      .catch(() => []);

  const geocodingPromise =
    geocode(
      `${query}, Latvia`,
      false,
      limit,
      undefined,
      areaTypes
    ).catch(() => []);

  const [
    searchBoxResults,
    geocodingResults,
  ] =
    await Promise.all([
      searchBoxPromise,
      geocodingPromise,
    ]);

  const combined = [
    ...localAreaResults(query),
    ...searchBoxResults,
    ...geocodingResults,
  ];

  const unique =
    new Map<
      string,
      SearchResult
    >();

  for (
    const result of combined
  ) {
    const key =
      [
        normalizeText(
          result.name
        ),
        result.featureType,
        result.latitude.toFixed(
          3
        ),
        result.longitude.toFixed(
          3
        ),
      ].join('|');

    if (
      !unique.has(key)
    ) {
      unique.set(
        key,
        result
      );
    }
  }

  return Array.from(
    unique.values()
  ).slice(
    0,
    limit
  );
}

export function LocationPicker({
  visible,
  value,
  onClose,
  onChange,
}: Props) {
  const [
    mode,
    setMode,
  ] =
    useState<DropLocationType>(
      value?.type ??
        'place'
    );

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    results,
    setResults,
  ] =
    useState<SearchResult[]>(
      []
    );

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorText,
    setErrorText,
  ] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setMode(
      value?.type ??
        'place'
    );

    setQuery('');
    setResults([]);
    setErrorText('');
  }, [
    visible,
    value,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const trimmed =
      query.trim();

    if (
      trimmed.length < 2
    ) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled =
      false;

    const timer =
      setTimeout(
        async () => {
          if (
            !MAPBOX_TOKEN
          ) {
            setErrorText(
              'Mapbox token is missing in .env'
            );

            return;
          }

          try {
            setSearching(true);
            setErrorText('');

            const nextResults =
              mode === 'area'
                ? await searchAreas(
                    trimmed
                  )
                : await geocode(
                    trimmed,
                    false
                  );

            if (
              !cancelled
            ) {
              setResults(
                nextResults
              );
            }
          } catch (error) {
            console.warn(
              'MAPBOX LOCATION SEARCH WARNING:',
              error
            );

            if (
              !cancelled
            ) {
              setResults([]);
              setErrorText(
                'Could not search locations.'
              );
            }
          } finally {
            if (
              !cancelled
            ) {
              setSearching(false);
            }
          }
        },
        350
      );

    return () => {
      cancelled =
        true;

      clearTimeout(
        timer
      );
    };
  }, [
    query,
    visible,
    mode,
  ]);

  const filteredResults =
    useMemo(
      () => results,
      [results]
    );

  const chooseResult =
    async (
      result: SearchResult
    ) => {
      if (saving) {
        return;
      }

      if (
        mode === 'area' &&
        !AREA_TYPES.has(
          result.featureType
        )
      ) {
        setErrorText(
          'Choose a district, locality, city or region for Area.'
        );

        return;
      }

      try {
        setSaving(true);
        setErrorText('');

        if (
          mode === 'area' &&
          result.id.startsWith('drop-area:')
        ) {
          onChange({
            type: 'area',
            name: result.name,
            address: null,
            latitude: result.latitude,
            longitude: result.longitude,
            radiusM: localAreaRadius(result) ?? 1600,
            providerId: result.id,
          });

          onClose();
          return;
        }

        const permanentQuery =
          [
            result.name,
            result.subtitle,
          ]
            .filter(Boolean)
            .join(', ');

        const permanentResults =
          await geocode(
            permanentQuery,
            true,
            8,
            {
              longitude:
                result.longitude,
              latitude:
                result.latitude,
            },
            mode === 'area'
              ? 'neighborhood,locality,place,district,region'
              : undefined
          );

        let permanentResult =
          pickPermanentMatch(
            result,
            permanentResults,
            mode
          );

        if (
          !permanentResult &&
          mode === 'area'
        ) {
          const compatible =
            permanentResults
              .filter(
                (candidate) =>
                  AREA_TYPES.has(
                    candidate.featureType
                  )
              )
              .sort(
                (a, b) =>
                  distanceMeters(
                    result,
                    a
                  ) -
                  distanceMeters(
                    result,
                    b
                  )
              );

          const nearest =
            compatible[0] ??
            null;

          if (
            nearest &&
            distanceMeters(
              result,
              nearest
            ) <= 12000
          ) {
            permanentResult =
              nearest;
          }
        }

        if (
          !permanentResult
        ) {
          throw new Error(
            'Could not verify the selected Mapbox location.'
          );
        }

        onChange({
          type: mode,
          name:
            mode === 'area'
              ? result.name
              : permanentResult.name,
          address:
            mode === 'place'
              ? (
                  permanentResult.subtitle ||
                  result.subtitle ||
                  null
                )
              : null,
          latitude:
            permanentResult.latitude,
          longitude:
            permanentResult.longitude,
          radiusM:
            mode === 'area'
              ? 1200
              : null,
          providerId:
            permanentResult.id ||
            result.id ||
            null,
        });

        onClose();
      } catch (error) {
        console.warn(
          'MAPBOX LOCATION SAVE WARNING:',
          error
        );

        setErrorText(
          'Could not verify this location. Please choose it again from the results.'
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={
              styles.headerSide
            }
            onPress={
              onClose
            }
          >
            <Text
              style={
                styles.headerAction
              }
            >
              Cancel
            </Text>
          </Pressable>

          <Text
            style={
              styles.title
            }
          >
            Location
          </Text>

          <View
            style={
              styles.headerSide
            }
          />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          <Text
            style={
              styles.sectionLabel
            }
          >
            PRECISION
          </Text>

          <Pressable
            style={[
              styles.modeRow,
              mode ===
                'place' &&
                styles.modeRowActive,
            ]}
            onPress={() =>
              setMode(
                'place'
              )
            }
          >
            <View
              style={
                styles.modeCopy
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Place
              </Text>

              <Text
                style={
                  styles.rowSubtitle
                }
              >
                Show the exact venue, address or meeting point.
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                mode ===
                  'place' &&
                  styles.radioActive,
              ]}
            />
          </Pressable>

          <Pressable
            style={[
              styles.modeRow,
              mode ===
                'area' &&
                styles.modeRowActive,
            ]}
            onPress={() =>
              setMode(
                'area'
              )
            }
          >
            <View
              style={
                styles.modeCopy
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Area
              </Text>

              <Text
                style={
                  styles.rowSubtitle
                }
              >
                Show only a district or general area for more privacy.
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                mode ===
                  'area' &&
                  styles.radioActive,
              ]}
            />
          </Pressable>

          <Text
            style={
              styles.sectionLabel
            }
          >
            SEARCH
          </Text>

          <View
            style={
              styles.searchRow
            }
          >
            <MaterialIcons
              name="search"
              size={20}
              color={
                DropColors.textMuted
              }
            />

            <TextInput
              value={query}
              onChangeText={
                setQuery
              }
              placeholder={
                mode ===
                'area'
                  ? 'Search area or district'
                  : 'Search place or address'
              }
              placeholderTextColor={
                DropColors.textMuted
              }
              selectionColor={
                DropColors.wine
              }
              autoCapitalize="none"
              autoCorrect={
                false
              }
              style={
                styles.searchInput
              }
            />

            {searching && (
              <ActivityIndicator
                size="small"
                color={
                  DropColors.warmWhite
                }
              />
            )}
          </View>

          {!!errorText && (
            <Text
              style={
                styles.errorText
              }
            >
              {errorText}
            </Text>
          )}

          {filteredResults.map(
            (result) => (
              <Pressable
                key={
                  result.id
                }
                style={
                  styles.resultRow
                }
                onPress={() =>
                  chooseResult(
                    result
                  )
                }
                disabled={
                  saving
                }
              >
                <View
                  style={
                    styles.resultIcon
                  }
                >
                  <MaterialIcons
                    name={
                      mode ===
                      'area'
                        ? 'location-city'
                        : 'place'
                    }
                    size={18}
                    color={
                      DropColors.warmWhite
                    }
                  />
                </View>

                <View
                  style={
                    styles.resultCopy
                  }
                >
                  <Text
                    style={
                      styles.resultTitle
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {result.name}
                  </Text>

                  {!!result.subtitle && (
                    <Text
                      style={
                        styles.resultSubtitle
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {
                        result.subtitle
                      }
                    </Text>
                  )}
                </View>

                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={
                    DropColors.textMuted
                  }
                />
              </Pressable>
            )
          )}

          {query.trim()
            .length >= 2 &&
            !searching &&
            filteredResults
              .length === 0 &&
            !errorText && (
              <Text
                style={
                  styles.emptyText
                }
              >
                No locations found.
              </Text>
            )}

          {!!value && (
            <>
              <Text
                style={
                  styles.sectionLabel
                }
              >
                CURRENT
              </Text>

              <View
                style={
                  styles.currentRow
                }
              >
                <View
                  style={
                    styles.resultCopy
                  }
                >
                  <Text
                    style={
                      styles.resultTitle
                    }
                  >
                    {value.name}
                  </Text>

                  <Text
                    style={
                      styles.resultSubtitle
                    }
                  >
                    {value.type ===
                    'area'
                      ? 'Approximate area'
                      : value.address ||
                        'Exact place'}
                  </Text>
                </View>

                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    onChange(
                      null
                    );

                    onClose();
                  }}
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    Remove
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>

        {saving && (
          <View
            style={
              styles.savingOverlay
            }
            pointerEvents="auto"
          >
            <ActivityIndicator
              color={
                DropColors.warmWhite
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    header: {
      paddingTop: 52,
      minHeight: 96,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    headerSide: {
      width: 70,
    },

    headerAction: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.semibold,
      fontSize: 16,
    },

    content: {
      paddingBottom: 64,
    },

    sectionLabel: {
      paddingTop: 18,
      paddingBottom: 8,
      paddingHorizontal: 18,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.medium,
      fontSize: 10,
      letterSpacing: 1.2,
    },

    modeRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    modeRowActive: {
      backgroundColor:
        '#151515',
    },

    modeCopy: {
      flex: 1,
      paddingRight: 14,
    },

    rowTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    rowSubtitle: {
      marginTop: 3,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 14,
    },

    radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        DropColors.textMuted,
    },

    radioActive: {
      borderWidth: 5,
      borderColor:
        DropColors.wine,
    },

    searchRow: {
      minHeight: 58,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    searchInput: {
      flex: 1,
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.regular,
      fontSize: 13,
      paddingVertical: 10,
    },

    resultRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    resultIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#151515',
    },

    resultCopy: {
      flex: 1,
      minWidth: 0,
    },

    resultTitle: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize: 13,
    },

    resultSubtitle: {
      marginTop: 3,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 10,
      lineHeight: 14,
    },

    currentRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    removeText: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize: 11,
    },

    errorText: {
      paddingHorizontal: 18,
      paddingTop: 12,
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    emptyText: {
      paddingHorizontal: 18,
      paddingTop: 18,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize: 11,
    },

    savingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(12,12,12,0.55)',
    },
  });