import type { Tree, Observation, Photo, PhotoType, AIResult } from './tree';
import type { User, UserStats } from './user';
import type { ZoneFeatureCollection, ZoneSummary, ContractZone, ZoneGeometry } from './zone';

// Trees
export interface GetTreesRequest {
  lat: number;
  lng: number;
  radius?: number;
  status?: string;
}

export interface GetTreesResponse {
  trees: Tree[];
  count: number;
}

export interface GetTreeResponse {
  tree: Tree;
  observations: Observation[];
}

export interface GetTreeObservationsResponse {
  observations: Observation[];
}

// Observations
export interface CreateObservationPhotoInput {
  photoType: PhotoType;
  storageKey: string;
}

export interface CreateObservationRequest {
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number;
  photos: CreateObservationPhotoInput[];
  notes?: string;
}

export interface CreateObservationResponse {
  observation: Observation;
  tree: Tree;
  isNewTree: boolean;
}

export interface GetObservationResponse {
  observation: Observation & { photos: Photo[] };
}

// Uploads
export interface PresignedUrlRequest {
  filename: string;
  contentType: string;
  photoType: PhotoType;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  storageKey: string;
}

// Users
export interface UpdateUserRequest {
  displayName?: string;
  avatarUrl?: string;
}

export interface GetUserResponse {
  user: User;
}

export interface GetUserStatsResponse extends UserStats {}

// AI Result (internal endpoint)
export interface AIResultRequest extends AIResult {}

// Health
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  db: 'connected' | 'error';
}

// Auth
export interface VerifyTokenResponse {
  user: User;
}

// Zones
export interface GetZonesResponse extends ZoneFeatureCollection {}

export interface GetZoneResponse {
  type: 'Feature';
  id: string;
  geometry: ZoneGeometry;
  properties: ContractZone & { contractName?: string; municipalityName?: string };
}

export interface GetZoneTreesResponse {
  trees: Tree[];
  total: number;
  page: number;
  limit: number;
}

export interface GetZonesSummaryResponse {
  zones: ZoneSummary[];
}

// Generic error
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
