import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  GetBountiesResponse,
  GetBountyResponse,
  GetBountyLeaderboardResponse,
  GetMyBountiesResponse,
  GetUserEarningsResponse,
  CreateBountyRequest,
  UpdateBountyRequest,
} from '@urban-pulse/shared-types';

export function useBounties() {
  return useQuery({
    queryKey: ['bounties'],
    queryFn: () => api.get<GetBountiesResponse>('/bounties'),
    staleTime: 60_000,
  });
}

export function useBounty(id: string | null) {
  return useQuery({
    queryKey: ['bounties', id],
    queryFn: () => api.get<GetBountyResponse>(`/bounties/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useBountyLeaderboard(id: string | null) {
  return useQuery({
    queryKey: ['bounties', id, 'leaderboard'],
    queryFn: () => api.get<GetBountyLeaderboardResponse>(`/bounties/${id}/leaderboard`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMyBounties() {
  return useQuery({
    queryKey: ['bounties', 'mine'],
    queryFn: () => api.get<GetMyBountiesResponse>('/bounties/mine'),
    staleTime: 30_000,
  });
}

export function useUserEarnings() {
  return useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.get<GetUserEarningsResponse>('/users/me/earnings'),
    staleTime: 30_000,
  });
}

export function useCreateBounty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBountyRequest) =>
      api.post<{ bounty: unknown }>('/bounties', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}

export function useUpdateBounty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBountyRequest }) =>
      api.patch<{ bounty: unknown }>(`/bounties/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}
