import React from 'react';
import { Polygon } from 'react-native-maps';
import type { ZoneStatus, ZoneFeature } from '@urban-pulse/shared-types';

interface ZoneOverlayProps {
  features: ZoneFeature[];
  onZonePress?: (zoneId: string) => void;
}

const STATUS_COLORS: Record<ZoneStatus, { fill: string; stroke: string }> = {
  active: { fill: 'rgba(45, 106, 79, 0.15)', stroke: 'rgba(45, 106, 79, 0.8)' },
  completed: { fill: 'rgba(59, 130, 246, 0.10)', stroke: 'rgba(59, 130, 246, 0.7)' },
  upcoming: { fill: 'rgba(233, 196, 106, 0.10)', stroke: 'rgba(233, 196, 106, 0.7)' },
  paused: { fill: 'rgba(173, 181, 189, 0.10)', stroke: 'rgba(173, 181, 189, 0.7)' },
};

function coordinatesToLatLng(coords: number[][]) {
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export function ZoneOverlay({ features, onZonePress }: ZoneOverlayProps) {
  return (
    <>
      {features.map((feature) => {
        const status = feature.properties.status as ZoneStatus;
        const zoneColors = STATUS_COLORS[status] || STATUS_COLORS.paused;
        const geom = feature.geometry as any;

        if (geom.type === 'MultiPolygon') {
          return (geom.coordinates as number[][][][]).map((polygon: number[][][], pIdx: number) =>
            polygon.map((ring: number[][], rIdx: number) => (
              <Polygon
                key={`${feature.id}-${pIdx}-${rIdx}`}
                coordinates={coordinatesToLatLng(ring)}
                fillColor={zoneColors.fill}
                strokeColor={zoneColors.stroke}
                strokeWidth={2}
                tappable={!!onZonePress}
                onPress={() => onZonePress?.(feature.properties.id)}
              />
            ))
          );
        }

        if (geom.type === 'Polygon') {
          return (geom.coordinates as number[][][]).map((ring: number[][], rIdx: number) => (
            <Polygon
              key={`${feature.id}-${rIdx}`}
              coordinates={coordinatesToLatLng(ring)}
              fillColor={zoneColors.fill}
              strokeColor={zoneColors.stroke}
              strokeWidth={2}
              tappable={!!onZonePress}
              onPress={() => onZonePress?.(feature.properties.id)}
            />
          ));
        }

        return null;
      })}
    </>
  );
}

// Bounty overlay with gold/amber styling
interface BountyOverlayProps {
  bounties: Array<{
    id: string;
    geometry: any;
    bountyAmountCents: number;
  }>;
  onBountyPress?: (bountyId: string) => void;
}

const BOUNTY_COLORS = {
  fill: 'rgba(212, 160, 23, 0.15)',
  stroke: 'rgba(212, 160, 23, 0.85)',
};

export function BountyOverlay({ bounties, onBountyPress }: BountyOverlayProps) {
  return (
    <>
      {bounties.map((bounty) => {
        const geom = bounty.geometry;
        if (!geom) return null;

        if (geom.type === 'MultiPolygon') {
          return (geom.coordinates as number[][][][]).map((polygon: number[][][], pIdx: number) =>
            polygon.map((ring: number[][], rIdx: number) => (
              <Polygon
                key={`bounty-${bounty.id}-${pIdx}-${rIdx}`}
                coordinates={coordinatesToLatLng(ring)}
                fillColor={BOUNTY_COLORS.fill}
                strokeColor={BOUNTY_COLORS.stroke}
                strokeWidth={3}
                tappable={!!onBountyPress}
                onPress={() => onBountyPress?.(bounty.id)}
              />
            ))
          );
        }

        if (geom.type === 'Polygon') {
          return (geom.coordinates as number[][][]).map((ring: number[][], rIdx: number) => (
            <Polygon
              key={`bounty-${bounty.id}-${rIdx}`}
              coordinates={coordinatesToLatLng(ring)}
              fillColor={BOUNTY_COLORS.fill}
              strokeColor={BOUNTY_COLORS.stroke}
              strokeWidth={3}
              tappable={!!onBountyPress}
              onPress={() => onBountyPress?.(bounty.id)}
            />
          ));
        }

        return null;
      })}
    </>
  );
}
