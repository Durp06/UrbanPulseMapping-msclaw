export type VerificationTier =
  | 'unverified'
  | 'ai_verified'
  | 'community_verified'
  | 'expert_verified';

export type ObservationStatus =
  | 'pending_upload'
  | 'pending_ai'
  | 'pending_review'
  | 'verified'
  | 'rejected';

export type PhotoType =
  | 'full_tree_angle1'
  | 'full_tree_angle2'
  | 'bark_closeup';

export type ConditionRating = 'good' | 'fair' | 'poor' | 'dead';

export type LocationType = 'street_tree' | 'park' | 'median' | 'row';

export type SiteType = 'tree_lawn' | 'cutout' | 'open_ground' | 'planter';

export type MaintenanceFlag = 'prune' | 'remove' | 'none';

export interface TrunkDefects {
  cavity: boolean;
  crack: boolean;
  lean: boolean;
}

export interface Tree {
  id: string;
  latitude: number;
  longitude: number;
  speciesCommon: string | null;
  speciesScientific: string | null;
  speciesConfidence: number | null;
  healthStatus: string | null;
  healthConfidence: number | null;
  estimatedDbhCm: number | null;
  estimatedHeightM: number | null;
  observationCount: number;
  uniqueObserverCount: number;
  lastObservedAt: string | null;
  cooldownUntil: string | null;
  verificationTier: VerificationTier;
  contractZoneId: string | null;
  // Level 1 inspection fields
  conditionRating: ConditionRating | null;
  heightEstimateM: number | null;
  canopySpreadM: number | null;
  crownDieback: boolean | null;
  trunkDefects: TrunkDefects | null;
  locationType: LocationType | null;
  nearestAddress: string | null;
  siteType: SiteType | null;
  overheadUtilityConflict: boolean | null;
  maintenanceFlag: MaintenanceFlag | null;
  sidewalkDamage: boolean | null;
  vacantPlantingSite: boolean;
  landUseType: string | null;
  mulchSoilCondition: string | null;
  riskFlag: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionData {
  conditionRating?: ConditionRating;
  crownDieback?: boolean;
  trunkDefects?: TrunkDefects;
  riskFlag?: boolean;
  maintenanceFlag?: MaintenanceFlag;
  locationType?: LocationType;
  siteType?: SiteType;
  overheadUtilityConflict?: boolean;
  sidewalkDamage?: boolean;
  mulchSoilCondition?: string;
  nearestAddress?: string;
}

export interface Observation {
  id: string;
  treeId: string | null;
  userId: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  status: ObservationStatus;
  aiSpeciesResult: string | null;
  aiHealthResult: string | null;
  aiMeasurementResult: string | null;
  notes: string | null;
  // Level 1 inspection fields
  conditionRating: string | null;
  heightEstimateM: number | null;
  canopySpreadM: number | null;
  crownDieback: boolean | null;
  trunkDefects: TrunkDefects | null;
  locationType: string | null;
  siteType: string | null;
  overheadUtilityConflict: boolean | null;
  maintenanceFlag: string | null;
  sidewalkDamage: boolean | null;
  mulchSoilCondition: string | null;
  riskFlag: boolean | null;
  nearestAddress: string | null;
  photos?: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  observationId: string;
  photoType: PhotoType;
  storageKey: string;
  storageUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  capturedAt: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  createdAt: string;
}

export interface AISpeciesResult {
  common: string;
  scientific: string;
  confidence: number;
}

export interface AIHealthResult {
  status: string;
  confidence: number;
  issues: string[];
}

export interface AIMeasurementResult {
  dbhCm: number;
  heightM: number;
}

export interface AIResult {
  species: AISpeciesResult | null;
  health: AIHealthResult | null;
  measurements: AIMeasurementResult | null;
}
