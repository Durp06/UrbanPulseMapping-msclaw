"""Reverse geocoding utility using Nominatim API."""

import logging

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "UrbanPulseMapping/1.0"
TIMEOUT = 5.0


async def reverse_geocode(latitude: float, longitude: float) -> str:
    """Reverse geocode coordinates to a location string.

    Args:
        latitude: GPS latitude.
        longitude: GPS longitude.

    Returns:
        Location string like "Austin, Texas, US" or "unknown" on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                },
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            data = response.json()

        address = data.get("address", {})
        city = address.get("city") or address.get("town") or address.get("village") or ""
        state = address.get("state") or ""
        country_code = address.get("country_code", "").upper()

        parts = [p for p in [city, state, country_code] if p]
        if parts:
            return ", ".join(parts)
        return "unknown"

    except Exception:
        logger.exception("Reverse geocode failed for %.4f, %.4f", latitude, longitude)
        return "unknown"
