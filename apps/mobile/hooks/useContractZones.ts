import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  GetZonesResponse,
  GetZonesSummaryResponse,
} from '@urban-pulse/shared-types';

export function useContractZones(options?: {
  status?: string;
  bounds?: string;
  contractId?: string;
}) {
  const params: Record<string, string | number> = {};
  if (options?.status) params.status = options.status;
  if (options?.bounds) params.bounds = options.bounds;
  if (options?.contractId) params.contract_id = options.contractId;

  return useQuery({
    queryKey: ['zones', params],
    queryFn: () => api.get<GetZonesResponse>('/zones', params),
    staleTime: 60_000, // 1 minute
  });
}

export function useZonesSummary() {
  return useQuery({
    queryKey: ['zones', 'summary'],
    queryFn: () => api.get<GetZonesSummaryResponse>('/zones/summary'),
    staleTime: 60_000,
  });
}
