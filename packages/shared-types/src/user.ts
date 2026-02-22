export type UserRole = 'user' | 'developer' | 'admin';

export interface User {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  totalScans: number;
  verifiedTrees: number;
  pendingObservations: number;
  treesOnCooldown: number;
  contributionStreak: number;
  neighborhoodsContributed: number;
}
