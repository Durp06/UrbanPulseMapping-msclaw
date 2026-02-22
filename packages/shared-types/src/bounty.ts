export type BountyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'expired';
export type BountyClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface Bounty {
  id: string;
  creatorId: string;
  contractZoneId: string | null;
  title: string;
  description: string;
  zoneType: 'zip_code' | 'street_corridor';
  zoneIdentifier: string;
  bountyAmountCents: number;
  bonusThreshold: number | null;
  bonusAmountCents: number | null;
  totalBudgetCents: number;
  spentCents: number;
  status: BountyStatus;
  startsAt: string;
  expiresAt: string;
  treeTargetCount: number;
  treesCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface BountyWithGeometry extends Bounty {
  geometry: unknown;
}

export interface BountyClaim {
  id: string;
  bountyId: string;
  userId: string;
  treeId: string;
  observationId: string;
  amountCents: number;
  status: BountyClaimStatus;
  createdAt: string;
}

export interface BountyLeaderboardEntry {
  userId: string;
  displayName: string | null;
  treesCount: number;
  totalEarnedCents: number;
}

export interface UserEarnings {
  totalEarnedCents: number;
  pendingCents: number;
  bountyBreakdown: Array<{
    bountyId: string;
    bountyTitle: string;
    claimsCount: number;
    earnedCents: number;
    status: BountyClaimStatus;
  }>;
}
