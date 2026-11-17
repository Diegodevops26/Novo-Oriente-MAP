export type PlaceCategory = 'tourist' | 'commercial' | 'food' | 'lodging';

export type SubCategoryFilter =
  | 'all'
  | 'tourist_nature'
  | 'tourist_heritage'
  | 'food_restaurant'
  | 'food_snack'
  | 'lodging_inn'
  | 'commercial_center'
  | 'commercial_market';

export interface PhotoAttribution {
  displayName: string;
  uri: string | null;
}

export interface PlaceReviewItem {
  rating: number | null;
  text: string | null;
  authorName: string | null;
  authorUri: string | null;
  relativePublishTime: string | null;
}

export interface DiscoveredPlace {
  id: string;
  place: google.maps.places.Place;
  displayName: string;
  category: PlaceCategory;
  subCategory: Exclude<SubCategoryFilter, 'all'>;
  categoryLabel: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  briefDescription: string;
  editorialSummary: string | null;
  photoUri: string | null;
  photoAttributions: PhotoAttribution[];
  googleMapsURI: string | null;
  nationalPhoneNumber: string | null;
  websiteURI: string | null;
  weekdayDescriptions: string[];
  reviews: PlaceReviewItem[];
  detailsLoaded: boolean;
}

export interface CityAnchor {
  name: string;
  formattedAddress: string;
  center: google.maps.LatLngLiteral;
  viewport: google.maps.LatLngBounds | null;
}

export interface RouteSummary {
  destinationId: string;
  destinationName: string;
  originLabel: string;
  travelMode: 'DRIVING' | 'WALKING';
  distanceMeters: number;
  durationMillis: number;
}
