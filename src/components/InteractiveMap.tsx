import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  BedDouble,
  Car,
  Clock,
  Coffee,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Footprints,
  Landmark,
  LocateFixed,
  MapPin,
  Mountain,
  Navigation,
  Phone,
  ShoppingBag,
  Star,
  Store,
  Utensils,
  X,
} from 'lucide-react';
import type {
  CityAnchor,
  DiscoveredPlace,
  PlaceCategory,
  RouteSummary,
  SubCategoryFilter,
} from '../types/places';
import {
  buildBriefDescription,
  checkAndDispatchQuotaError,
  extractPhotoInfo,
  extractReviews,
  formatDistance,
  formatDuration,
  getCategoryDisplayName,
  mapGooglePlaceToDiscovered,
  toLatLngLiteral,
} from '../utils/placeClassifier';
import {CategoryFilter, DirectorySidebar} from './DirectorySidebar';
import {PlacePhotoBanner} from './PlacePhotoBanner';

const PLACE_SEARCH_FIELDS = [
  'id',
  'displayName',
  'location',
  'formattedAddress',
  'primaryType',
  'primaryTypeDisplayName',
  'types',
  'rating',
  'userRatingCount',
  'editorialSummary',
  'photos',
  'googleMapsURI',
  'businessStatus',
];

function distanceKm(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface PlaceMarkerProps {
  item: DiscoveredPlace;
  isSelected: boolean;
  onSelect: (item: DiscoveredPlace) => void;
  onRegisterMarker: (
    id: string,
    marker: google.maps.marker.AdvancedMarkerElement | null
  ) => void;
}

function PlaceMarker({
  item,
  isSelected,
  onSelect,
  onRegisterMarker,
}: PlaceMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    onRegisterMarker(item.id, marker);
    return () => onRegisterMarker(item.id, null);
  }, [item.id, marker, onRegisterMarker]);

  const categoryPalette: Record<
    PlaceCategory,
    {bg: string; selectedBg: string; border: string}
  > = {
    tourist: {bg: '#0f766e', selectedBg: '#042f2e', border: '#115e59'},
    food: {bg: '#b45309', selectedBg: '#78350f', border: '#92400e'},
    lodging: {bg: '#9f1239', selectedBg: '#4c0519', border: '#881337'},
    commercial: {bg: '#1d4ed8', selectedBg: '#1e3a8a', border: '#1e40af'},
  };

  const palette = categoryPalette[item.category];
  const bg = isSelected ? palette.selectedBg : palette.bg;
  const borderColor = isSelected ? '#ffffff' : palette.border;

  const renderGlyph = () => {
    const iconClass = 'w-3.5 h-3.5 text-white';
    switch (item.subCategory) {
      case 'tourist_heritage':
        return <Landmark className={iconClass} />;
      case 'tourist_nature':
        return <Mountain className={iconClass} />;
      case 'food_snack':
        return <Coffee className={iconClass} />;
      case 'food_restaurant':
        return <Utensils className={iconClass} />;
      case 'lodging_inn':
        return <BedDouble className={iconClass} />;
      case 'commercial_market':
        return <Store className={iconClass} />;
      case 'commercial_center':
      default:
        return <ShoppingBag className={iconClass} />;
    }
  };

  return (
    <AdvancedMarker
      ref={markerRef}
      position={item.location}
      title={item.displayName}
      zIndex={isSelected ? 50 : item.category === 'tourist' ? 20 : 12}
      onClick={() => onSelect(item)}
    >
      <Pin
        background={bg}
        borderColor={borderColor}
        glyphColor="#ffffff"
        scale={isSelected ? 1.28 : 1.04}
      >
        {renderGlyph()}
      </Pin>
    </AdvancedMarker>
  );
}

interface InteractiveMapProps {
  requestedSection:
    | 'all'
    | 'tourist'
    | 'commercial'
    | 'food'
    | 'lodging'
    | 'locate'
    | 'reset';
  sectionTriggerNonce: number;
}

export function InteractiveMap({
  requestedSection,
  sectionTriggerNonce,
}: InteractiveMapProps) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [cityAnchor, setCityAnchor] = useState<CityAnchor | null>(null);
  const [placesDict, setPlacesDict] = useState<Record<string, DiscoveredPlace>>({});
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [visibleCategories, setVisibleCategories] = useState<
    Record<PlaceCategory, boolean>
  >({
    tourist: true,
    food: true,
    lodging: true,
    commercial: true,
  });
  const [subCategoryFilter, setSubCategoryFilter] =
    useState<SubCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid' | 'terrain'>(
    'roadmap'
  );

  // User geolocation (requested only on explicit user action)
  const [userLocation, setUserLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [geoStatusMessage, setGeoStatusMessage] = useState<string | null>(null);

  // Route state
  const [routeTarget, setRouteTarget] = useState<DiscoveredPlace | null>(null);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Marker instances registry (Record avoids global Map shadowing)
  const [markerInstances, setMarkerInstances] = useState<
    Record<string, google.maps.marker.AdvancedMarkerElement | null>
  >({});

  // Track which subcategory queries have already been executed this session
  const fetchedQueriesRef = useRef<Record<string, boolean>>({});

  const registerMarker = useCallback(
    (id: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      setMarkerInstances((prev) => {
        if (prev[id] === marker) return prev;
        if (!marker) {
          const copy = {...prev};
          delete copy[id];
          return copy;
        }
        return {...prev, [id]: marker};
      });
    },
    []
  );

  // Initial discovery of Novo Oriente de Minas - MG + Tourist & Commercial places
  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    async function loadCityAndHighlights() {
      if (!placesLib) return;
      setIsInitialLoading(true);
      setErrorMessage(null);

      try {
        const cityResponse = await placesLib.Place.searchByText({
          textQuery: 'Novo Oriente de Minas, MG, Brasil',
          fields: ['id', 'displayName', 'location', 'viewport', 'formattedAddress'],
          language: 'pt-BR',
          region: 'br',
          maxResultCount: 1,
        });

        if (cancelled) return;

        const cityPlace = cityResponse.places?.[0];
        const center = toLatLngLiteral(cityPlace?.location);

        if (!cityPlace || !center) {
          setErrorMessage(
            'Não foi possível localizar Novo Oriente de Minas no serviço de mapas.'
          );
          setIsInitialLoading(false);
          return;
        }

        const anchor: CityAnchor = {
          name: cityPlace.displayName || 'Novo Oriente de Minas',
          formattedAddress:
            cityPlace.formattedAddress || 'Novo Oriente de Minas - MG, Brasil',
          center,
          viewport: cityPlace.viewport ?? null,
        };
        setCityAnchor(anchor);

        const locationBias = anchor.viewport || center;

        const results = await Promise.allSettled([
          placesLib.Place.searchByText({
            textQuery:
              'pontos turísticos cachoeira igreja matriz praça parque Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 20,
          }),
          placesLib.Place.searchByText({
            textQuery: 'Lanchonete Quinta Geração Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 5,
          }),
          placesLib.Place.searchByText({
            textQuery:
              'lanchonete lanches pastelaria sorveteria padaria Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 20,
          }),
          placesLib.Place.searchByText({
            textQuery:
              'restaurante pizzaria churrascaria comida Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 20,
          }),
          placesLib.Place.searchNearby({
            fields: PLACE_SEARCH_FIELDS,
            locationRestriction: {center, radius: 5000},
            includedTypes: [
              'restaurant',
              'fast_food_restaurant',
              'cafe',
              'bakery',
              'meal_takeaway',
              'sandwich_shop',
              'ice_cream_shop',
              'bar',
            ],
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 20,
          }),
          placesLib.Place.searchByText({
            textQuery: 'pousada hotel hospedagem Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 15,
          }),
          placesLib.Place.searchByText({
            textQuery:
              'supermercado loja centro comercial banco farmácia comércio Novo Oriente de Minas MG',
            fields: PLACE_SEARCH_FIELDS,
            locationBias,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 20,
          }),
        ]);

        if (cancelled) return;

        const batchHints: {hint: PlaceCategory; maxKm: number}[] = [
          {hint: 'tourist', maxKm: 40},
          {hint: 'food', maxKm: 25},
          {hint: 'food', maxKm: 25},
          {hint: 'food', maxKm: 25},
          {hint: 'food', maxKm: 10},
          {hint: 'lodging', maxKm: 30},
          {hint: 'commercial', maxKm: 25},
        ];

        let anySuccess = false;
        const nextDict: Record<string, DiscoveredPlace> = {};

        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            anySuccess = true;
            const {hint, maxKm} = batchHints[idx];
            for (const p of res.value.places || []) {
              const mapped = mapGooglePlaceToDiscovered(p, hint);
              if (
                mapped &&
                mapped.id !== cityPlace.id &&
                !nextDict[mapped.id] &&
                distanceKm(center, mapped.location) <= maxKm
              ) {
                nextDict[mapped.id] = mapped;
              }
            }
          } else {
            checkAndDispatchQuotaError(res.reason);
          }
        });

        if (!anySuccess) {
          setErrorMessage(
            'Não foi possível carregar os pontos de Novo Oriente de Minas. Verifique a conexão ou cota do serviço.'
          );
        }

        setPlacesDict(nextDict);
        setIsInitialLoading(false);
      } catch (err) {
        if (cancelled) return;
        checkAndDispatchQuotaError(err);
        setErrorMessage(
          'Não foi possível carregar os pontos de Novo Oriente de Minas. Verifique a conexão ou cota do serviço.'
        );
        setIsInitialLoading(false);
      }
    }

    void loadCityAndHighlights();
    return () => {
      cancelled = true;
    };
  }, [placesLib]);

  // Fit bounds when cityAnchor loads
  useEffect(() => {
    if (!map || !cityAnchor) return;
    if (cityAnchor.viewport) {
      map.fitBounds(cityAnchor.viewport);
    } else {
      map.setCenter(cityAnchor.center);
      map.setZoom(14);
    }
  }, [map, cityAnchor]);

  // Handle top bar navigation triggers
  useEffect(() => {
    if (sectionTriggerNonce === 0) return;
    if (requestedSection === 'tourist') {
      setCategoryFilter('tourist');
      setVisibleCategories({
        tourist: true,
        food: false,
        lodging: false,
        commercial: false,
      });
      setSubCategoryFilter('all');
    } else if (requestedSection === 'food') {
      setCategoryFilter('food');
      setVisibleCategories({
        tourist: false,
        food: true,
        lodging: false,
        commercial: false,
      });
      setSubCategoryFilter('all');
    } else if (requestedSection === 'lodging') {
      setCategoryFilter('lodging');
      setVisibleCategories({
        tourist: false,
        food: false,
        lodging: true,
        commercial: false,
      });
      setSubCategoryFilter('all');
    } else if (requestedSection === 'commercial') {
      setCategoryFilter('commercial');
      setVisibleCategories({
        tourist: false,
        food: false,
        lodging: false,
        commercial: true,
      });
      setSubCategoryFilter('all');
    } else if (requestedSection === 'all') {
      setCategoryFilter('all');
      setVisibleCategories({
        tourist: true,
        food: true,
        lodging: true,
        commercial: true,
      });
      setSubCategoryFilter('all');
    } else if (requestedSection === 'reset' && map && cityAnchor) {
      setSelectedPlaceId(null);
      if (cityAnchor.viewport) {
        map.fitBounds(cityAnchor.viewport);
      } else {
        map.panTo(cityAnchor.center);
        map.setZoom(14);
      }
    } else if (requestedSection === 'locate') {
      handleLocateUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTriggerNonce, requestedSection]);

  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatusMessage('Geolocalização não suportada neste navegador.');
      return;
    }
    setGeoStatusMessage('Obtendo sua localização...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setGeoStatusMessage('Sua localização foi ativada para rotas.');
        if (map) {
          map.panTo(coords);
          if ((map.getZoom() ?? 14) < 14) {
            map.setZoom(15);
          }
        }
        setTimeout(() => setGeoStatusMessage(null), 4000);
      },
      () => {
        setGeoStatusMessage(
          'Permissão de localização negada. As rotas usarão o centro da cidade.'
        );
        setTimeout(() => setGeoStatusMessage(null), 4500);
      },
      {enableHighAccuracy: true, timeout: 8000}
    );
  }, [map]);

  const runTargetedSearch = useCallback(
    async (
      query: string,
      hintCategory?: PlaceCategory,
      selectFirst = false
    ) => {
      if (!placesLib || !cityAnchor) return;
      setIsSearching(true);
      setErrorMessage(null);
      try {
        const {places} = await placesLib.Place.searchByText({
          textQuery: `${query} Novo Oriente de Minas MG`,
          fields: PLACE_SEARCH_FIELDS,
          locationBias: cityAnchor.viewport || cityAnchor.center,
          language: 'pt-BR',
          region: 'br',
          maxResultCount: 20,
        });

        const added: DiscoveredPlace[] = [];
        setPlacesDict((prev) => {
          const next = {...prev};
          for (const p of places || []) {
            const mapped = mapGooglePlaceToDiscovered(p, hintCategory);
            if (
              mapped &&
              distanceKm(cityAnchor.center, mapped.location) <= 35
            ) {
              next[mapped.id] = prev[mapped.id]?.detailsLoaded
                ? prev[mapped.id]
                : mapped;
              added.push(next[mapped.id]);
            }
          }
          return next;
        });

        if (selectFirst && added.length > 0 && map) {
          const first = added[0];
          setVisibleCategories((prev) =>
            prev[first.category] ? prev : {...prev, [first.category]: true}
          );
          setCategoryFilter((prevCat) =>
            prevCat !== 'all' && prevCat !== first.category ? 'all' : prevCat
          );
          setSubCategoryFilter('all');
          setSelectedPlaceId(first.id);
          map.panTo(first.location);
          map.setZoom(16);
        }
      } catch (err) {
        checkAndDispatchQuotaError(err);
      } finally {
        setIsSearching(false);
      }
    },
    [placesLib, cityAnchor, map]
  );

  const handleSubCategorySelect = useCallback(
    (sub: SubCategoryFilter) => {
      setSubCategoryFilter(sub);
      if (sub === 'all') return;

      if (!fetchedQueriesRef.current[sub]) {
        fetchedQueriesRef.current[sub] = true;
        const queryMap: Record<
          Exclude<SubCategoryFilter, 'all'>,
          {q: string; cat: PlaceCategory}
        > = {
          tourist_nature: {q: 'cachoeira mirante parque natureza trilha', cat: 'tourist'},
          tourist_heritage: {q: 'igreja matriz paróquia capela praça histórica', cat: 'tourist'},
          food_restaurant: {q: 'restaurante pizzaria churrascaria comida caseira', cat: 'food'},
          food_snack: {q: 'lanchonete lanche pastelaria cafeteria sorveteria', cat: 'food'},
          lodging_inn: {q: 'pousada hotel hospedagem chalé', cat: 'lodging'},
          commercial_center: {q: 'loja centro comercial avenida comércio banco farmácia', cat: 'commercial'},
          commercial_market: {q: 'supermercado mercado mercearia hortifruti açougue', cat: 'commercial'},
        };
        const target = queryMap[sub];
        void runTargetedSearch(target.q, target.cat);
      }
    },
    [runTargetedSearch]
  );

  const handleSearchSubmit = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query) return;
      void runTargetedSearch(query, undefined, true);
    },
    [runTargetedSearch]
  );

  const handleCategoryFilterChange = useCallback((cat: CategoryFilter) => {
    setCategoryFilter(cat);
    setSubCategoryFilter('all');
    if (cat === 'all') {
      setVisibleCategories({
        tourist: true,
        food: true,
        lodging: true,
        commercial: true,
      });
    } else {
      setVisibleCategories({
        tourist: cat === 'tourist',
        food: cat === 'food',
        lodging: cat === 'lodging',
        commercial: cat === 'commercial',
      });
    }
  }, []);

  const handleToggleCategoryVisibility = useCallback(
    (category: PlaceCategory) => {
      setVisibleCategories((prev) => {
        const next = {...prev, [category]: !prev[category]};
        const keys: PlaceCategory[] = ['tourist', 'food', 'lodging', 'commercial'];
        const visibleKeys = keys.filter((k) => next[k]);

        if (visibleKeys.length === 1) {
          setCategoryFilter(visibleKeys[0]);
        } else {
          setCategoryFilter('all');
        }

        if (!next[category]) {
          setSubCategoryFilter((currentSub) => {
            if (currentSub.startsWith(`${category}_`)) {
              return 'all';
            }
            return currentSub;
          });
        }

        return next;
      });
    },
    []
  );

  const handleResetSearch = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter('all');
    setVisibleCategories({
      tourist: true,
      food: true,
      lodging: true,
      commercial: true,
    });
    setSubCategoryFilter('all');
    setErrorMessage(null);
    if (map && cityAnchor) {
      if (cityAnchor.viewport) {
        map.fitBounds(cityAnchor.viewport);
      } else {
        map.panTo(cityAnchor.center);
        map.setZoom(14);
      }
    }
  }, [map, cityAnchor]);

  // Select place -> focus map + load full Place details (reviews, openingHours, editorialSummary) once
  const handleSelectPlace = useCallback(
    async (item: DiscoveredPlace) => {
      setSelectedPlaceId(item.id);
      if (map) {
        map.panTo(item.location);
        if ((map.getZoom() ?? 14) < 15) {
          map.setZoom(16);
        }
      }

      if (!item.detailsLoaded) {
        try {
          await item.place.fetchFields({
            fields: [
              'editorialSummary',
              'openingHours',
              'nationalPhoneNumber',
              'reviews',
              'websiteURI',
              'photos',
            ],
          });

          const {photoUri, photoAttributions} = extractPhotoInfo(item.place);
          const editorialSummary = item.place.editorialSummary ?? null;
          const weekdayDescriptions =
            item.place.regularOpeningHours?.weekdayDescriptions ||
            item.place.openingHours?.weekdayDescriptions ||
            [];
          const reviews = extractReviews(item.place);

          setPlacesDict((prev) => {
            const existing = prev[item.id];
            if (!existing) return prev;
            return {
              ...prev,
              [item.id]: {
                ...existing,
                editorialSummary,
                briefDescription: buildBriefDescription(
                  item.place,
                  existing.categoryLabel,
                  existing.category
                ),
                photoUri: photoUri || existing.photoUri,
                photoAttributions:
                  photoAttributions.length > 0
                    ? photoAttributions
                    : existing.photoAttributions,
                nationalPhoneNumber:
                  item.place.nationalPhoneNumber ?? existing.nationalPhoneNumber,
                websiteURI: item.place.websiteURI ?? existing.websiteURI,
                weekdayDescriptions,
                reviews,
                detailsLoaded: true,
              },
            };
          });
        } catch (err) {
          checkAndDispatchQuotaError(err);
        }
      }
    },
    [map]
  );

  // Route calculation using modern Routes API JS SDK wrapper (Route.computeRoutes)
  const clearRoute = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRouteTarget(null);
    setRouteSummary(null);
    setRouteError(null);
  }, []);

  useEffect(() => {
    if (!routesLib || !map || !routeTarget || !cityAnchor) return;
    let cancelled = false;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRouteLoading(true);
    setRouteError(null);

    const originCoords = userLocation || cityAnchor.center;
    const originLabel = userLocation
      ? 'Sua localização atual'
      : 'Centro de Novo Oriente de Minas';

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: originCoords,
      destination: routeTarget.location,
      travelMode:
        travelMode === 'WALKING'
          ? routesLib.TravelMode.WALKING
          : routesLib.TravelMode.DRIVING,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    routesLib.Route.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        setRouteLoading(false);
        const primaryRoute = response.routes?.[0];
        if (!primaryRoute) {
          setRouteError('Não foi possível traçar uma rota para este local.');
          return;
        }

        const routeColor =
          routeTarget.category === 'tourist'
            ? '#0f766e'
            : routeTarget.category === 'food'
              ? '#b45309'
              : routeTarget.category === 'lodging'
                ? '#9f1239'
                : '#1d4ed8';

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: routeColor,
            strokeWeight: 6,
            strokeOpacity: 0.9,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        setRouteSummary({
          destinationId: routeTarget.id,
          destinationName: routeTarget.displayName,
          originLabel,
          travelMode,
          distanceMeters: primaryRoute.distanceMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setRouteLoading(false);
        checkAndDispatchQuotaError(err);
        setRouteError(
          'Não foi possível calcular a rota neste momento. Tente novamente.'
        );
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, routeTarget, travelMode, userLocation, cityAnchor]);

  const handleRequestRoute = useCallback(
    (item: DiscoveredPlace) => {
      void handleSelectPlace(item);
      setRouteTarget(item);
    },
    [handleSelectPlace]
  );

  const allPlaces = useMemo(() => Object.values(placesDict), [placesDict]);

  const counts = useMemo(
    () => ({
      all: allPlaces.length,
      tourist: allPlaces.filter((p) => p.category === 'tourist').length,
      food: allPlaces.filter((p) => p.category === 'food').length,
      lodging: allPlaces.filter((p) => p.category === 'lodging').length,
      commercial: allPlaces.filter((p) => p.category === 'commercial').length,
    }),
    [allPlaces]
  );

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPlaces
      .filter((item) => {
        if (!visibleCategories[item.category]) {
          return false;
        }
        if (categoryFilter !== 'all' && item.category !== categoryFilter) {
          return false;
        }
        if (
          subCategoryFilter !== 'all' &&
          item.subCategory !== subCategoryFilter
        ) {
          return false;
        }
        if (q) {
          const hay = `${item.displayName} ${item.categoryLabel} ${item.formattedAddress} ${item.briefDescription}`.toLowerCase();
          return hay.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return a.displayName.localeCompare(b.displayName, 'pt-BR');
      });
  }, [
    allPlaces,
    visibleCategories,
    categoryFilter,
    subCategoryFilter,
    searchQuery,
  ]);

  // Clear active InfoWindow if its category was hidden from the map legend
  useEffect(() => {
    if (!selectedPlaceId) return;
    const active = placesDict[selectedPlaceId];
    if (active && !visibleCategories[active.category]) {
      setSelectedPlaceId(null);
    }
  }, [selectedPlaceId, placesDict, visibleCategories]);

  const selectedPlace = selectedPlaceId ? placesDict[selectedPlaceId] ?? null : null;
  const selectedMarker = selectedPlaceId
    ? markerInstances[selectedPlaceId] ?? null
    : null;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[410px_1fr] min-h-0 h-[calc(100vh-64px)]">
      <div className="order-2 lg:order-1 min-h-[380px] lg:min-h-0 lg:h-full overflow-hidden">
        <DirectorySidebar
          places={filteredPlaces}
          selectedPlaceId={selectedPlaceId}
          categoryFilter={categoryFilter}
          subCategoryFilter={subCategoryFilter}
          searchQuery={searchQuery}
          isLoading={isInitialLoading}
          isSearching={isSearching}
          errorMessage={errorMessage}
          onCategoryChange={handleCategoryFilterChange}
          onSubCategorySelect={handleSubCategorySelect}
          onSearchSubmit={handleSearchSubmit}
          onResetSearch={handleResetSearch}
          onSelectPlace={(p) => void handleSelectPlace(p)}
          onRequestRoute={handleRequestRoute}
          counts={counts}
        />
      </div>

      <section
        aria-label="Mapa interativo de Novo Oriente de Minas"
        className="order-1 lg:order-2 relative w-full h-[52vh] min-h-[360px] lg:h-full bg-slate-100"
      >
        {!cityAnchor ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-100">
            {errorMessage ? (
              <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
                <p className="text-sm font-semibold text-slate-900">
                  {errorMessage}
                </p>
                <p className="text-xs text-slate-600">
                  Recarregue a página para tentar reconectar aos serviços do Google Maps.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Compass className="w-8 h-8 text-teal-700 mx-auto animate-spin" />
                <p className="text-sm font-medium text-slate-700">
                  Centralizando o mapa em Novo Oriente de Minas - MG...
                </p>
              </div>
            )}
          </div>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={cityAnchor.center}
            defaultZoom={14}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={true}
            fullscreenControl={true}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={() => setSelectedPlaceId(null)}
            style={{width: '100%', height: '100%'}}
          >
            {filteredPlaces.map((item) => (
              <PlaceMarker
                key={item.id}
                item={item}
                isSelected={item.id === selectedPlaceId}
                onSelect={(p) => void handleSelectPlace(p)}
                onRegisterMarker={registerMarker}
              />
            ))}

            {userLocation && (
              <AdvancedMarker
                position={userLocation}
                title="Sua localização atual"
              >
                <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-md" />
              </AdvancedMarker>
            )}

            {selectedPlace && selectedMarker && (
              <InfoWindow
                anchor={selectedMarker}
                maxWidth={330}
                onCloseClick={() => setSelectedPlaceId(null)}
              >
                <div className="w-[300px] sm:w-[320px] bg-white text-slate-900 font-sans">
                  <PlacePhotoBanner
                    photoUri={selectedPlace.photoUri}
                    attributions={selectedPlace.photoAttributions}
                    title={selectedPlace.displayName}
                    category={selectedPlace.category}
                    subCategory={selectedPlace.subCategory}
                    categoryLabel={selectedPlace.categoryLabel}
                    className="h-36 w-full"
                  />

                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className={`font-semibold ${
                            selectedPlace.category === 'tourist'
                              ? 'text-teal-700'
                              : selectedPlace.category === 'food'
                                ? 'text-amber-700'
                                : selectedPlace.category === 'lodging'
                                  ? 'text-rose-800'
                                  : 'text-blue-700'
                          }`}
                        >
                          {getCategoryDisplayName(selectedPlace.category)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">
                          {selectedPlace.categoryLabel}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
                        {selectedPlace.displayName}
                      </h3>

                      {selectedPlace.rating !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span className="font-semibold text-slate-800">
                            {selectedPlace.rating.toFixed(1).replace('.', ',')}
                          </span>
                          {selectedPlace.userRatingCount ? (
                            <span>
                              ({selectedPlace.userRatingCount} avaliações)
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {selectedPlace.briefDescription}
                    </p>

                    <div className="space-y-1 pt-1 border-t border-slate-100 text-xs text-slate-600">
                      <p className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{selectedPlace.formattedAddress}</span>
                      </p>
                      {selectedPlace.nationalPhoneNumber && (
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedPlace.nationalPhoneNumber}</span>
                        </p>
                      )}
                      {selectedPlace.weekdayDescriptions.length > 0 && (
                        <p className="flex items-start gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {selectedPlace.weekdayDescriptions[0]}
                          </span>
                        </p>
                      )}
                    </div>

                    {selectedPlace.reviews.length > 0 &&
                      selectedPlace.reviews[0].text && (
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                          <p className="italic line-clamp-2">
                            “{selectedPlace.reviews[0].text}”
                          </p>
                          {selectedPlace.reviews[0].authorName && (
                            <p className="text-slate-400 mt-0.5">
                              — {selectedPlace.reviews[0].authorName}
                            </p>
                          )}
                        </div>
                      )}

                    <div className="flex items-center gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleRequestRoute(selectedPlace)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          selectedPlace.category === 'tourist'
                            ? 'bg-teal-700 hover:bg-teal-800'
                            : selectedPlace.category === 'food'
                              ? 'bg-amber-700 hover:bg-amber-800'
                              : selectedPlace.category === 'lodging'
                                ? 'bg-rose-800 hover:bg-rose-900'
                                : 'bg-blue-700 hover:bg-blue-800'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Traçar rota
                      </button>

                      {selectedPlace.googleMapsURI && (
                        <a
                          href={selectedPlace.googleMapsURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Maps
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}

        {/* Top-left Map Type Switcher */}
        {cityAnchor && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm">
            {(
              [
                {id: 'roadmap', label: 'Mapa'},
                {id: 'hybrid', label: 'Satélite'},
                {id: 'terrain', label: 'Relevo'},
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMapTypeId(mode.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mapTypeId === mode.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}

        {/* Interactive Category Visibility Legend (Map Corner) */}
        {cityAnchor && (
          <div
            role="region"
            aria-label="Legenda interativa de categorias no mapa"
            className="absolute top-14 left-3 sm:top-3 sm:right-14 sm:left-auto z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm p-2.5 max-w-[calc(100%-1.5rem)] sm:w-64"
          >
            <div className="flex items-center justify-between gap-3 px-1 pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                Legenda do mapa
              </span>
              {(!visibleCategories.tourist ||
                !visibleCategories.food ||
                !visibleCategories.lodging ||
                !visibleCategories.commercial) && (
                <button
                  type="button"
                  onClick={() => handleCategoryFilterChange('all')}
                  className="text-[11px] font-medium text-teal-700 hover:text-teal-800 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Mostrar todas
                </button>
              )}
            </div>

            <div className="mt-1.5 grid grid-cols-2 sm:flex sm:flex-col gap-1.5">
              {(
                [
                  {
                    id: 'tourist',
                    label: 'Pontos Turísticos',
                    activeBox: 'bg-teal-50/70 border-teal-200 text-slate-900 hover:bg-teal-50',
                    swatch: 'bg-teal-700 border-teal-800',
                    eye: 'text-teal-700',
                  },
                  {
                    id: 'food',
                    label: 'Restaurantes e Lanchonetes',
                    activeBox: 'bg-amber-50/70 border-amber-200 text-slate-900 hover:bg-amber-50',
                    swatch: 'bg-amber-700 border-amber-800',
                    eye: 'text-amber-700',
                  },
                  {
                    id: 'lodging',
                    label: 'Pousadas',
                    activeBox: 'bg-rose-50/70 border-rose-200 text-slate-900 hover:bg-rose-50',
                    swatch: 'bg-rose-800 border-rose-900',
                    eye: 'text-rose-800',
                  },
                  {
                    id: 'commercial',
                    label: 'Áreas Comerciais',
                    activeBox: 'bg-blue-50/70 border-blue-200 text-slate-900 hover:bg-blue-50',
                    swatch: 'bg-blue-700 border-blue-800',
                    eye: 'text-blue-700',
                  },
                ] as const
              ).map((entry) => {
                const isVisible = visibleCategories[entry.id];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={isVisible}
                    onClick={() => handleToggleCategoryVisibility(entry.id)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer min-w-0 ${
                      isVisible
                        ? entry.activeBox
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className={`w-3 h-3 rounded-sm shrink-0 border ${
                          isVisible
                            ? entry.swatch
                            : 'bg-slate-200 border-slate-300'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-medium truncate">{entry.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums shrink-0">
                      <span className="font-mono text-[11px] text-slate-500">
                        {counts[entry.id]}
                      </span>
                      {isVisible ? (
                        <Eye className={`w-3.5 h-3.5 ${entry.eye}`} />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Geolocation notice toast */}
        {geoStatusMessage && (
          <div className="absolute top-44 sm:top-14 left-3 z-10 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-md">
            {geoStatusMessage}
          </div>
        )}

        {/* Active Route Overlay Card */}
        {(routeTarget || routeLoading || routeError) && (
          <div className="absolute bottom-4 left-3 right-3 sm:right-auto sm:w-[340px] z-10 bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">
                  Rota traçada
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {routeTarget?.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={clearRoute}
                aria-label="Limpar rota"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTravelMode('DRIVING')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  travelMode === 'DRIVING'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                Carro
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('WALKING')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  travelMode === 'WALKING'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                A pé
              </button>
              {!userLocation && (
                <button
                  type="button"
                  onClick={handleLocateUser}
                  title="Usar minha localização como origem"
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  GPS
                </button>
              )}
            </div>

            {routeLoading && (
              <p className="text-xs text-slate-600">Calculando melhor trajeto...</p>
            )}
            {routeError && (
              <p className="text-xs text-red-700 font-medium">{routeError}</p>
            )}
            {routeSummary && !routeLoading && !routeError && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 truncate max-w-[180px]">
                  Origem: {routeSummary.originLabel}
                </span>
                <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                  {formatDistance(routeSummary.distanceMeters)} ·{' '}
                  {formatDuration(routeSummary.durationMillis)}
                </span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
