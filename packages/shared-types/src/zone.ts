export type ZoneType = 'zip_code' | 'street_corridor';
export type ZoneStatus = 'active' | 'completed' | 'paused' | 'upcoming';
export type ContractStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Contract {
  id: string;
  municipalityName: string;
  contractName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  totalBudget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractZone {
  id: string;
  contractId: string;
  zoneType: ZoneType;
  zoneIdentifier: string;
  displayName: string;
  bufferMeters: number;
  startCrossStreet: string | null;
  endCrossStreet: string | null;
  corridorName: string | null;
  status: ZoneStatus;
  progressPercentage: number;
  treeTargetCount: number | null;
  treesMappedCount: number;
  createdAt: string;
  updatedAt: string;
}

// GeoJSON types for zone API responses (inline to avoid @types/geojson dep)
export interface ZoneGeoJsonProperties extends ContractZone {
  contractName?: string;
  municipalityName?: string;
}

export interface ZoneGeometry {
  type: string;
  coordinates: unknown;
}

export interface ZoneFeature {
  type: 'Feature';
  id: string;
  geometry: ZoneGeometry;
  properties: ZoneGeoJsonProperties;
}

export interface ZoneFeatureCollection {
  type: 'FeatureCollection';
  features: ZoneFeature[];
}

export interface ZoneSummary {
  id: string;
  contractId: string;
  zoneType: ZoneType;
  zoneIdentifier: string;
  displayName: string;
  status: ZoneStatus;
  progressPercentage: number;
  treeTargetCount: number | null;
  treesMappedCount: number;
  contractName: string;
}
