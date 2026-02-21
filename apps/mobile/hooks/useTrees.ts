import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { GetTreesResponse } from '@urban-pulse/shared-types';

export function useTrees(
  lat: number | null,
  lng: number | null,
  radius: number = 500
) {
  return useQuery({
    queryKey: ['trees', lat, lng, radius],
    queryFn: () =>
      api.get<GetTreesResponse>('/trees', {
        lat: lat!,
        lng: lng!,
        radius,
      }),
    enabled: lat !== null && lng !== null,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
