// Road-wise routing utility using OSRM with Google Directions fallback and in-memory cache

const routeCache = new Map();

/**
 * Calculates straight-line distance in km (Haversine formula)
 */
export function haversineKm(p1, p2) {
  if (!p1 || !p2) return 0;
  const lat1 = Number(p1.lat || p1[0]);
  const lng1 = Number(p1.lng || p1[1]);
  const lat2 = Number(p2.lat || p2[0]);
  const lng2 = Number(p2.lng || p2[1]);
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return 0;

  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetches turn-by-turn road route coordinates between two points.
 * Returns { coordinates: [[lat, lng], ...], distanceKm, durationMins, summary }
 */
export async function getRoadRoute(origin, destination) {
  if (!origin || !destination) return null;
  const oLat = Number(origin.lat ?? origin[0]);
  const oLng = Number(origin.lng ?? origin[1]);
  const dLat = Number(destination.lat ?? destination[0]);
  const dLng = Number(destination.lng ?? destination[1]);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) return null;

  // Key with 4 decimal places (~11 meters) to allow route caching and avoid thrashing on micro-jitter
  const cacheKey = `${oLng.toFixed(4)},${oLat.toFixed(4)};${dLng.toFixed(4)},${dLat.toFixed(4)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  // 1. Try OSRM driving engine (returns exact road/street turn-by-turn geometry)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        // OSRM coordinates are [lng, lat]. Convert to [lat, lng] for MapView and Google Maps!
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const distKm = (route.distance / 1000).toFixed(1);
        const mins = Math.max(1, Math.round(route.duration / 60));
        const summary = route.legs?.[0]?.summary || 'Road Route';

        const result = {
          coordinates,
          distanceKm: distKm,
          durationMins: mins,
          summary,
          isRoadRoute: true,
        };
        routeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('OSRM routing fetch failed, falling back:', err);
  }

  // 2. Fallback calculation if offline
  const straightKm = haversineKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  const estimatedRoadKm = (straightKm * 1.3).toFixed(1); // average road detour factor ~1.3
  const estimatedMins = Math.max(1, Math.round(straightKm * 3)); // average 20km/h city speed

  const result = {
    coordinates: [
      [oLat, oLng],
      [dLat, dLng],
    ],
    distanceKm: estimatedRoadKm,
    durationMins: estimatedMins,
    summary: 'Estimated Route',
    isRoadRoute: false,
  };
  return result;
}
