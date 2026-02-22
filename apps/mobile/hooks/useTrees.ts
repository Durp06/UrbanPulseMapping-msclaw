import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { GetTreesResponse } from '@urban-pulse/shared-types';

export function useTrees(
  lat: number | null,
  lng: number | null,
  radius: number = 500,
  zoneId?: string,
  zoneType?: string
) {
  return useQuery({
    queryKey: ['trees', lat, lng, radius, zoneId, zoneType],
    queryFn: () => {
      const params: Record<string, string | number> = {
        lat: lat!,
        lng: lng!,
        radius,
      };
      if (zoneId) params.zoneId = zoneId;
      if (zoneType) params.zoneType = zoneType;
      return api.get<GetTreesResponse>('/trees', params);
    },
    enabled: lat !== null && lng !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
