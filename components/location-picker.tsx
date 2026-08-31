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

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const AREA_TYPES = new Set([
  'neighborhood',
  'locality',
  'place',
  'district',
  'region',
]);

function featureToResult(feature: MapboxFeature): SearchResult | null {
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  const properties = feature.properties ?? {};
  const name = properties.name_preferred || properties.name || 'Location';
  const subtitle = properties.full_address || properties.place_formatted || '';

  return {
    id: properties.mapbox_id || feature.id || `${longitude}:${latitude}:${name}`,
    name,
    subtitle,
    featureType: properties.feature_type || '',
    longitude,
    latitude,
  };
}

async function geocode(
  query: string,
  permanent: boolean,
  limit = 8
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    limit: String(limit),
    language: 'en',
  });

  if (permanent) {
    params.set('permanent', 'true');
  }

  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Mapbox request failed (${response.status})`);
  }

  const data = await response.json();

  return (data.features ?? [])
    .map(featureToResult)
    .filter((item: SearchResult | null): item is SearchResult => !!item);
}

export function LocationPicker({
  visible,
  value,
  onClose,
  onChange,
}: Props) {
  const [mode, setMode] = useState<DropLocationType>(value?.type ?? 'place');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setMode(value?.type ?? 'place');
    setQuery('');
    setResults([]);
    setErrorText('');
  }, [visible, value]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!MAPBOX_TOKEN) {
        setErrorText('Mapbox token is missing in .env');
        return;
      }

      try {
        setSearching(true);
        setErrorText('');

        const nextResults = await geocode(trimmed, false);

        if (!cancelled) {
          setResults(nextResults);
        }
      } catch (error) {
        console.warn('MAPBOX LOCATION SEARCH WARNING:', error);

        if (!cancelled) {
          setResults([]);
          setErrorText('Could not search locations.');
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  const filteredResults = useMemo(() => {
    if (mode === 'area') {
      const areaResults = results.filter((result) =>
        AREA_TYPES.has(result.featureType)
      );

      return areaResults.length > 0 ? areaResults : results;
    }

    return results;
  }, [mode, results]);

  const chooseResult = async (result: SearchResult) => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setErrorText('');

      // Search suggestions are temporary. Re-geocode the chosen result once
      // with permanent=true before persisting coordinates in Supabase.
      const permanentQuery = [result.name, result.subtitle]
        .filter(Boolean)
        .join(', ');

      const permanentResults = await geocode(permanentQuery, true, 1);
      const permanentResult = permanentResults[0] ?? result;

      onChange({
        type: mode,
        name: result.name,
        address: mode === 'place' ? (result.subtitle || null) : null,
        latitude: permanentResult.latitude,
        longitude: permanentResult.longitude,
        radiusM: mode === 'area' ? 1200 : null,
        providerId: permanentResult.id || result.id || null,
      });

      onClose();
    } catch (error) {
      console.warn('MAPBOX LOCATION SAVE WARNING:', error);
      setErrorText('Could not save this location. Try again.');
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerSide} onPress={onClose}>
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>

          <Text style={styles.title}>Location</Text>

          <View style={styles.headerSide} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.sectionLabel}>PRECISION</Text>

          <Pressable
            style={[styles.modeRow, mode === 'place' && styles.modeRowActive]}
            onPress={() => setMode('place')}
          >
            <View style={styles.modeCopy}>
              <Text style={styles.rowTitle}>Place</Text>
              <Text style={styles.rowSubtitle}>
                Show the exact venue, address or meeting point.
              </Text>
            </View>
            <View style={[styles.radio, mode === 'place' && styles.radioActive]} />
          </Pressable>

          <Pressable
            style={[styles.modeRow, mode === 'area' && styles.modeRowActive]}
            onPress={() => setMode('area')}
          >
            <View style={styles.modeCopy}>
              <Text style={styles.rowTitle}>Area</Text>
              <Text style={styles.rowSubtitle}>
                Show only a district or general area for more privacy.
              </Text>
            </View>
            <View style={[styles.radio, mode === 'area' && styles.radioActive]} />
          </Pressable>

          <Text style={styles.sectionLabel}>SEARCH</Text>

          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color={DropColors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={mode === 'area' ? 'Search area or district' : 'Search place or address'}
              placeholderTextColor={DropColors.textMuted}
              selectionColor={DropColors.wine}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {searching && <ActivityIndicator size="small" color={DropColors.warmWhite} />}
          </View>

          {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

          {filteredResults.map((result) => (
            <Pressable
              key={result.id}
              style={styles.resultRow}
              onPress={() => chooseResult(result)}
              disabled={saving}
            >
              <View style={styles.resultIcon}>
                <MaterialIcons
                  name={mode === 'area' ? 'location-city' : 'place'}
                  size={18}
                  color={DropColors.warmWhite}
                />
              </View>

              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {result.name}
                </Text>
                {!!result.subtitle && (
                  <Text style={styles.resultSubtitle} numberOfLines={2}>
                    {result.subtitle}
                  </Text>
                )}
              </View>

              <MaterialIcons
                name="chevron-right"
                size={20}
                color={DropColors.textMuted}
              />
            </Pressable>
          ))}

          {query.trim().length >= 2 &&
            !searching &&
            filteredResults.length === 0 &&
            !errorText && (
              <Text style={styles.emptyText}>No locations found.</Text>
            )}

          {!!value && (
            <>
              <Text style={styles.sectionLabel}>CURRENT</Text>
              <View style={styles.currentRow}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>{value.name}</Text>
                  <Text style={styles.resultSubtitle}>
                    {value.type === 'area'
                      ? 'Approximate area'
                      : value.address || 'Exact place'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    onChange(null);
                    onClose();
                  }}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>

        {saving && (
          <View style={styles.savingOverlay} pointerEvents="auto">
            <ActivityIndicator color={DropColors.warmWhite} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DropColors.graphite,
  },
  header: {
    paddingTop: 52,
    minHeight: 96,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  headerSide: {
    width: 70,
  },
  headerAction: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  title: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.semibold,
    fontSize: 16,
  },
  content: {
    paddingBottom: 64,
  },
  sectionLabel: {
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 18,
    color: DropColors.textMuted,
    fontFamily: DropTypography.medium,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  modeRow: {
    minHeight: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  modeRowActive: {
    backgroundColor: '#151515',
  },
  modeCopy: {
    flex: 1,
    paddingRight: 14,
  },
  rowTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  rowSubtitle: {
    marginTop: 3,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 10,
    lineHeight: 14,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DropColors.textMuted,
  },
  radioActive: {
    borderWidth: 5,
    borderColor: DropColors.wine,
  },
  searchRow: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  searchInput: {
    flex: 1,
    color: DropColors.warmWhite,
    fontFamily: DropTypography.regular,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: DropColors.warmWhite,
    fontFamily: DropTypography.medium,
    fontSize: 13,
  },
  resultSubtitle: {
    marginTop: 3,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DropColors.border,
  },
  removeText: {
    color: DropColors.textSecondary,
    fontFamily: DropTypography.medium,
    fontSize: 11,
  },
  errorText: {
    paddingHorizontal: 18,
    paddingTop: 12,
    color: DropColors.textSecondary,
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },
  emptyText: {
    paddingHorizontal: 18,
    paddingTop: 18,
    color: DropColors.textMuted,
    fontFamily: DropTypography.regular,
    fontSize: 11,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,12,0.55)',
  },
});