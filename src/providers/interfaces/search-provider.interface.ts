export interface SearchQueryOptions {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  query?: string;
  propertyType?: string;
  connectorType?: string;
  minPrice?: number;
  maxPrice?: number;
  minPowerKw?: number;
  amenities?: string[];
  nearbyTags?: string[];
  minRating?: number;
  page?: number;
  limit?: number;
  sortBy?: 'distance' | 'price' | 'rating' | 'newest' | 'speed';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ISearchProvider<T = any> {
  search(options: SearchQueryOptions): Promise<SearchResult<T>>;
  indexListing(listing: T): Promise<void>;
  updateListing(listingId: string, updates: Partial<T>): Promise<void>;
  removeListing(listingId: string): Promise<void>;
}
