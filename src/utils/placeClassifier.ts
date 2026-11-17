import type {
  DiscoveredPlace,
  PhotoAttribution,
  PlaceCategory,
  PlaceReviewItem,
  SubCategoryFilter,
} from '../types/places';

const TOURIST_TYPES = new Set([
  'tourist_attraction',
  'natural_feature',
  'park',
  'national_park',
  'state_park',
  'church',
  'place_of_worship',
  'catholic_church',
  'museum',
  'historical_landmark',
  'cultural_landmark',
  'monument',
  'hiking_area',
  'scenic_spot',
  'campground',
  'plaza',
  'town_square',
  'cultural_center',
  'art_gallery',
  'zoo',
]);

const TOURIST_KEYWORDS = [
  'cachoeira',
  'igreja',
  'matriz',
  'paróquia',
  'capela',
  'praça',
  'praca',
  'mirante',
  'serra',
  'parque',
  'monumento',
  'museu',
  'balneário',
  'balneario',
  'lago',
  'gruta',
  'pedra',
  'pico',
  'turístic',
  'turistic',
  'históric',
  'historic',
];

const HERITAGE_KEYWORDS = [
  'igreja',
  'matriz',
  'paróquia',
  'capela',
  'praça',
  'praca',
  'museu',
  'monumento',
  'históric',
  'historic',
  'cultural',
];

const LODGING_TYPES = new Set([
  'lodging',
  'hotel',
  'motel',
  'bed_and_breakfast',
  'guest_house',
  'hostel',
  'inn',
  'resort_hotel',
  'extended_stay_hotel',
  'farmstay',
  'cabin',
]);

const LODGING_KEYWORDS = [
  'pousada',
  'hotel',
  'hospedagem',
  'hospedaria',
  'chalé',
  'chale',
  'estância',
  'estancia',
  'dormitório',
  'dormitorio',
  'recanto',
];

const SNACK_TYPES = new Set([
  'cafe',
  'bakery',
  'bar',
  'meal_takeaway',
  'ice_cream_shop',
  'fast_food_restaurant',
  'sandwich_shop',
  'snack_bar',
  'coffee_shop',
  'hamburger_restaurant',
  'dessert_shop',
  'acai_shop',
  'juice_shop',
]);

const SNACK_KEYWORDS = [
  'lanchonete',
  'lanche',
  'lanches',
  'pastel',
  'pastelaria',
  'salgado',
  'açaí',
  'acai',
  'sorvete',
  'sorveteria',
  'padaria',
  'panificadora',
  'café',
  'cafe',
  'cafeteria',
  'hamburguer',
  'burger',
  'espetinho',
  'churrasquinho',
  'petiscaria',
  'trailer',
  'qui',
];

const RESTAURANT_TYPES = new Set([
  'restaurant',
  'brazilian_restaurant',
  'pizza_restaurant',
  'steak_house',
  'seafood_restaurant',
  'barbecue_restaurant',
  'buffet_restaurant',
  'diner',
]);

const RESTAURANT_KEYWORDS = [
  'restaurante',
  'pizzaria',
  'churrascaria',
  'cantina',
  'bistrô',
  'bistro',
  'self service',
  'marmitaria',
  'comida caseira',
  'cozinha',
];

const MARKET_TYPES = new Set([
  'supermarket',
  'grocery_store',
  'convenience_store',
  'butcher_shop',
  'market',
]);

const MARKET_KEYWORDS = [
  'supermercado',
  'mercado',
  'mercearia',
  'hortifruti',
  'empório',
  'emporio',
  'sacolão',
  'sacolao',
  'açougue',
  'acougue',
];

export function checkAndDispatchQuotaError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err ?? '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as {status?: unknown}).status
      : undefined;

  const isQuotaError =
    status === 429 ||
    status === 'OVER_QUERY_LIMIT' ||
    status === 'RESOURCE_EXHAUSTED' ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('OVER_QUERY_LIMIT') ||
    message.includes('OverQuotaMapError') ||
    message.includes('QuotaExceededError') ||
    message.includes('429');

  if (isQuotaError) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  return isQuotaError;
}

export function classifyPlace(
  place: google.maps.places.Place,
  hintCategory?: PlaceCategory
): {
  category: PlaceCategory;
  subCategory: Exclude<SubCategoryFilter, 'all'>;
  categoryLabel: string;
} {
  const nameLower = (place.displayName || '').toLowerCase();
  const typeLower = (place.primaryType || '').toLowerCase();
  const types = (place.types || []).map((t) => t.toLowerCase());

  const matchesLodging =
    LODGING_TYPES.has(typeLower) ||
    types.some((t) => LODGING_TYPES.has(t)) ||
    LODGING_KEYWORDS.some((kw) => nameLower.includes(kw));

  if (matchesLodging || (hintCategory === 'lodging' && !TOURIST_KEYWORDS.some((kw) => nameLower.includes(kw)))) {
    return {
      category: 'lodging',
      subCategory: 'lodging_inn',
      categoryLabel: place.primaryTypeDisplayName || 'Pousada e Hospedagem',
    };
  }

  const matchesSnack =
    SNACK_TYPES.has(typeLower) ||
    types.some((t) => SNACK_TYPES.has(t)) ||
    SNACK_KEYWORDS.some((kw) => nameLower.includes(kw));

  const matchesRestaurant =
    RESTAURANT_TYPES.has(typeLower) ||
    types.some((t) => RESTAURANT_TYPES.has(t)) ||
    RESTAURANT_KEYWORDS.some((kw) => nameLower.includes(kw));

  if (matchesSnack && !matchesRestaurant) {
    return {
      category: 'food',
      subCategory: 'food_snack',
      categoryLabel: place.primaryTypeDisplayName || 'Lanchonete e Café',
    };
  }

  if (matchesRestaurant || hintCategory === 'food') {
    const isSnackPrimary =
      SNACK_TYPES.has(typeLower) || SNACK_KEYWORDS.some((kw) => nameLower.includes(kw));
    return {
      category: 'food',
      subCategory: isSnackPrimary ? 'food_snack' : 'food_restaurant',
      categoryLabel:
        place.primaryTypeDisplayName ||
        (isSnackPrimary ? 'Lanchonete e Café' : 'Restaurante'),
    };
  }

  const matchesTouristType =
    TOURIST_TYPES.has(typeLower) || types.some((t) => TOURIST_TYPES.has(t));
  const matchesTouristKeyword = TOURIST_KEYWORDS.some((kw) =>
    nameLower.includes(kw)
  );

  const isTourist =
    hintCategory === 'tourist'
      ? !(
          types.includes('supermarket') ||
          types.includes('grocery_store') ||
          types.includes('store') ||
          types.includes('bank') ||
          types.includes('pharmacy')
        ) || matchesTouristKeyword
      : matchesTouristType || matchesTouristKeyword;

  if (isTourist) {
    const isHeritage =
      typeLower === 'church' ||
      typeLower === 'place_of_worship' ||
      typeLower === 'catholic_church' ||
      typeLower === 'museum' ||
      typeLower === 'historical_landmark' ||
      typeLower === 'plaza' ||
      types.includes('church') ||
      types.includes('place_of_worship') ||
      HERITAGE_KEYWORDS.some((kw) => nameLower.includes(kw));

    return {
      category: 'tourist',
      subCategory: isHeritage ? 'tourist_heritage' : 'tourist_nature',
      categoryLabel:
        place.primaryTypeDisplayName ||
        (isHeritage ? 'Patrimônio e Praça' : 'Ponto Turístico e Natureza'),
    };
  }

  const isMarket =
    MARKET_TYPES.has(typeLower) ||
    types.some((t) => MARKET_TYPES.has(t)) ||
    MARKET_KEYWORDS.some((kw) => nameLower.includes(kw));

  return {
    category: 'commercial',
    subCategory: isMarket ? 'commercial_market' : 'commercial_center',
    categoryLabel:
      place.primaryTypeDisplayName ||
      (isMarket ? 'Supermercado e Mercado' : 'Comércio e Serviços'),
  };
}

export function getCategoryDisplayName(category: PlaceCategory): string {
  switch (category) {
    case 'tourist':
      return 'Ponto Turístico';
    case 'food':
      return 'Gastronomia';
    case 'lodging':
      return 'Hospedagem';
    case 'commercial':
      return 'Área Comercial';
  }
}

export function buildBriefDescription(
  place: google.maps.places.Place,
  categoryLabel: string,
  category: PlaceCategory
): string {
  if (place.editorialSummary && place.editorialSummary.trim().length > 0) {
    return place.editorialSummary.trim();
  }

  const parts: string[] = [];
  if (category === 'tourist') {
    parts.push(`${categoryLabel} localizado em Novo Oriente de Minas (MG).`);
  } else if (category === 'lodging') {
    parts.push(`${categoryLabel} para hospedagem em Novo Oriente de Minas (MG).`);
  } else if (category === 'food') {
    parts.push(`${categoryLabel} atendendo em Novo Oriente de Minas (MG).`);
  } else {
    parts.push(`${categoryLabel} em atividade na região de Novo Oriente de Minas.`);
  }

  if (place.rating != null && place.userRatingCount != null && place.userRatingCount > 0) {
    parts.push(
      `Avaliado com ${place.rating.toFixed(1).replace('.', ',')} estrelas (${place.userRatingCount} avaliações).`
    );
  } else if (place.formattedAddress) {
    parts.push(`Endereço: ${place.formattedAddress}.`);
  }

  return parts.join(' ');
}

export function toLatLngLiteral(
  loc: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined
): google.maps.LatLngLiteral | null {
  if (!loc) return null;
  if (typeof (loc as google.maps.LatLng).lat === 'function') {
    const ll = loc as google.maps.LatLng;
    return {lat: ll.lat(), lng: ll.lng()};
  }
  const lit = loc as google.maps.LatLngLiteral;
  if (typeof lit.lat === 'number' && typeof lit.lng === 'number') {
    return {lat: lit.lat, lng: lit.lng};
  }
  return null;
}

export function extractPhotoInfo(place: google.maps.places.Place): {
  photoUri: string | null;
  photoAttributions: PhotoAttribution[];
} {
  if (!place.photos || place.photos.length === 0) {
    return {photoUri: null, photoAttributions: []};
  }
  const firstPhoto = place.photos[0];
  let photoUri: string | null = null;
  try {
    photoUri = firstPhoto.getURI({maxWidth: 640, maxHeight: 420});
  } catch {
    photoUri = null;
  }

  const photoAttributions: PhotoAttribution[] = (
    firstPhoto.authorAttributions || []
  ).map((attr) => ({
    displayName: attr.displayName || 'Contribuidor Google Maps',
    uri: attr.uri ?? null,
  }));

  return {photoUri, photoAttributions};
}

export function mapGooglePlaceToDiscovered(
  place: google.maps.places.Place,
  hintCategory?: PlaceCategory
): DiscoveredPlace | null {
  const coords = toLatLngLiteral(place.location);
  if (!coords || !place.id || !place.displayName) return null;

  const classification = classifyPlace(place, hintCategory);
  const {photoUri, photoAttributions} = extractPhotoInfo(place);
  const briefDescription = buildBriefDescription(
    place,
    classification.categoryLabel,
    classification.category
  );

  return {
    id: place.id,
    place,
    displayName: place.displayName,
    category: classification.category,
    subCategory: classification.subCategory,
    categoryLabel: classification.categoryLabel,
    formattedAddress: place.formattedAddress || 'Novo Oriente de Minas, MG',
    location: coords,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    businessStatus: place.businessStatus ?? null,
    briefDescription,
    editorialSummary: place.editorialSummary ?? null,
    photoUri,
    photoAttributions,
    googleMapsURI: place.googleMapsURI ?? null,
    nationalPhoneNumber: place.nationalPhoneNumber ?? null,
    websiteURI: place.websiteURI ?? null,
    weekdayDescriptions:
      place.regularOpeningHours?.weekdayDescriptions ||
      place.openingHours?.weekdayDescriptions ||
      [],
    reviews: extractReviews(place),
    detailsLoaded: false,
  };
}

export function extractReviews(place: google.maps.places.Place): PlaceReviewItem[] {
  if (!place.reviews || place.reviews.length === 0) return [];
  return place.reviews.slice(0, 2).map((rev) => ({
    rating: rev.rating ?? null,
    text: rev.text ?? null,
    authorName: rev.authorAttribution?.displayName ?? null,
    authorUri: rev.authorAttribution?.uri ?? null,
    relativePublishTime: rev.relativePublishTimeDescription ?? null,
  }));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(millis: number): string {
  const mins = Math.max(1, Math.round(millis / 60000));
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
}
