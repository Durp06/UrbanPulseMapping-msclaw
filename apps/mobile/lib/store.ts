import { create } from 'zustand';
import type { User, PhotoType } from '@urban-pulse/shared-types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: { token: string; user: User }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: ({ token, user }) =>
    set({ token, user, isAuthenticated: true }),
  clearAuth: () =>
    set({ token: null, user: null, isAuthenticated: false }),
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

interface ScanState {
  photos: ScanPhoto[];
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  nearbyTreeId: string | null;
  notes: string;
  lastBountyClaim: BountyClaimInfo | null;
  addPhoto: (photo: ScanPhoto) => void;
  setLocation: (lat: number, lng: number, accuracy: number) => void;
  setNearbyTree: (treeId: string | null) => void;
  setNotes: (notes: string) => void;
  setLastBountyClaim: (claim: BountyClaimInfo | null) => void;
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
  addPhoto: (photo) =>
    set((state) => ({ photos: [...state.photos, photo] })),
  setLocation: (latitude, longitude, gpsAccuracy) =>
    set({ latitude, longitude, gpsAccuracy }),
  setNearbyTree: (nearbyTreeId) => set({ nearbyTreeId }),
  setNotes: (notes) => set({ notes }),
  setLastBountyClaim: (lastBountyClaim) => set({ lastBountyClaim }),
  reset: () =>
    set({
      photos: [],
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      nearbyTreeId: null,
      notes: '',
      lastBountyClaim: null,
    }),
}));
