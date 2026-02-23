import { create } from 'zustand';
import type {
  User,
  UserRole,
  PhotoType,
  ConditionRating,
  LocationType,
  SiteType,
  MaintenanceFlag,
  TrunkDefects,
} from '@urban-pulse/shared-types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: { token: string; user: User }) => void;
  clearAuth: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: ({ token, user }) =>
    set({ token, user, isAuthenticated: true }),
  clearAuth: () =>
    set({ token: null, user: null, isAuthenticated: false }),
  updateUser: (data) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    })),
}));

interface ScanPhoto {
  uri: string;
  type: PhotoType;
}

interface BountyClaimInfo {
  bountyId: string;
  bountyTitle: string;
  amountCents: number;
}

interface InspectionState {
  conditionRating: ConditionRating | null;
  crownDieback: boolean | null;
  trunkDefects: TrunkDefects;
  riskFlag: boolean | null;
  maintenanceFlag: MaintenanceFlag | null;
  locationType: LocationType | null;
  siteType: SiteType | null;
  overheadUtilityConflict: boolean | null;
  sidewalkDamage: boolean | null;
  mulchSoilCondition: string;
  nearestAddress: string;
}

const defaultInspection: InspectionState = {
  conditionRating: null,
  crownDieback: null,
  trunkDefects: { cavity: false, crack: false, lean: false },
  riskFlag: null,
  maintenanceFlag: null,
  locationType: null,
  siteType: null,
  overheadUtilityConflict: null,
  sidewalkDamage: null,
  mulchSoilCondition: '',
  nearestAddress: '',
};

interface ScanState {
  photos: ScanPhoto[];
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  nearbyTreeId: string | null;
  notes: string;
  lastBountyClaim: BountyClaimInfo | null;
  inspection: InspectionState;
  addPhoto: (photo: ScanPhoto) => void;
  setLocation: (lat: number, lng: number, accuracy: number) => void;
  setNearbyTree: (treeId: string | null) => void;
  setNotes: (notes: string) => void;
  setLastBountyClaim: (claim: BountyClaimInfo | null) => void;
  setInspection: (data: Partial<InspectionState>) => void;
  reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  photos: [],
  latitude: null,
  longitude: null,
  gpsAccuracy: null,
  nearbyTreeId: null,
  notes: '',
  lastBountyClaim: null,
  inspection: { ...defaultInspection },
  addPhoto: (photo) =>
    set((state) => ({ photos: [...state.photos, photo] })),
  setLocation: (latitude, longitude, gpsAccuracy) =>
    set({ latitude, longitude, gpsAccuracy }),
  setNearbyTree: (nearbyTreeId) => set({ nearbyTreeId }),
  setNotes: (notes) => set({ notes }),
  setLastBountyClaim: (lastBountyClaim) => set({ lastBountyClaim }),
  setInspection: (data) =>
    set((state) => ({
      inspection: { ...state.inspection, ...data },
    })),
  reset: () =>
    set({
      photos: [],
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      nearbyTreeId: null,
      notes: '',
      lastBountyClaim: null,
      inspection: { ...defaultInspection },
    }),
}));
