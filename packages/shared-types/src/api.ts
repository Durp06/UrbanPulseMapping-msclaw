import type { Tree, Observation, Photo, PhotoType, AIResult } from './tree';
import type { User, UserStats, UserRole } from './user';
import type { ZoneFeatureCollection, ZoneSummary, ContractZone, ZoneGeometry } from './zone';
import type { Bounty, BountyWithGeometry, BountyClaim, BountyLeaderboardEntry, UserEarnings } from './bounty';

// Trees
export interface GetTreesRequest {
  lat: number;
  lng: number;
  radius?: number;
  status?: string;
  zoneId?: string;
  zoneType?: string;
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
  bountyClaim?: {
    bountyId: string;
    bountyTitle: string;
    amountCents: number;
  } | null;
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
  role?: UserRole;
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

// Bounties
export interface CreateBountyRequest {
  contractZoneId?: string;
  title: string;
  description: string;
  zoneType: 'zip_code' | 'street_corridor';
  zoneIdentifier: string;
  bountyAmountCents: number;
  bonusThreshold?: number;
  bonusAmountCents?: number;
  totalBudgetCents: number;
  startsAt: string;
  expiresAt: string;
  treeTargetCount: number;
}

export interface UpdateBountyRequest {
  title?: string;
  description?: string;
  bountyAmountCents?: number;
  bonusThreshold?: number;
  bonusAmountCents?: number;
  totalBudgetCents?: number;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'expired';
  startsAt?: string;
  expiresAt?: string;
  treeTargetCount?: number;
}

export interface GetBountiesResponse {
  bounties: BountyWithGeometry[];
}

export interface GetBountyResponse {
  bounty: BountyWithGeometry;
}

export interface GetBountyLeaderboardResponse {
  leaderboard: BountyLeaderboardEntry[];
}

export interface GetMyBountiesResponse {
  bounties: Bounty[];
}

export interface GetUserEarningsResponse extends UserEarnings {}

// Generic error
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
