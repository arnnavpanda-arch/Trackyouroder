// Resilient Geolocation & Map Link Helper
// Solves: "Position update is unavailable" error on laptops/desktops
// Supports: Browser GPS, Network WiFi positioning, IP Geolocation fallback, and Google Maps Link parsing

import { api } from '../services/api';

/**
 * Robustly acquires user's device location.
 * Uses a 3-tier cascade:
 * 1. Standard Network/WiFi browser geolocation (bypasses POSITION_UNAVAILABLE on PCs/Macs)
 * 2. High-accuracy GPS (for mobile phones with GPS hardware)
 * 3. IP Geolocation (zero permission prompt fallback, always works!)
 */
export async function getResilientDeviceLocation() {
  const tryBrowserGeo = (highAccuracy, timeoutMs, maxAge = 0) =>
    new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return reject(new Error('Geolocation not supported by this browser'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 20,
            source: highAccuracy ? 'satellite_gps' : 'browser_network',
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maxAge,
        }
      );
    });

  // Tier 1: Try High-Accuracy Hardware Satellite GPS FIRST (Gets real mobile/laptop GPS, NOT ISP city)
  try {
    const loc = await tryBrowserGeo(true, 8000, 0);
    return loc;
  } catch (err1) {
    console.warn('High-accuracy GPS attempt note:', err1.message);
  }

  // Tier 2: Try standard browser location (faster fallback if satellite fix is weak)
  try {
    const loc = await tryBrowserGeo(false, 4000, 5000);
    return loc;
  } catch (err2) {
    console.warn('Standard browser location attempt note:', err2.message);
  }

  throw new Error('Real device location unavailable. Please enable Location in browser/system settings or paste a Google Maps link.');
}

/**
 * Reverse geocodes coordinates to a readable address string using Nominatim
 */
/**
 * Reverse geocodes coordinates to a readable address string using Nominatim
 */
export async function reverseGeocodeCoords(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const data = await r.json();
      if (data?.display_name) {
        return data.display_name.split(',').slice(0, 4).join(',');
      }
    }
  } catch (e) {}
  return `Pinned Location (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)})`;
}

/**
 * Extracts coordinates from any text, URL, or data parameters
 */
export function extractCoordsFromString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const text = decodeURIComponent(raw.trim());

  // Pattern A: !3d<lat>!4d<lng> (Standard Google Maps pin / place marker)
  const d3d4 = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d3d4) {
    const lat = parseFloat(d3d4[1]);
    const lng = parseFloat(d3d4[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern B: !1d<lng>!2d<lat>
  const d1d2 = text.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
  if (d1d2) {
    const lng = parseFloat(d1d2[1]);
    const lat = parseFloat(d1d2[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern C: @<lat>,<lng>
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern D: ?q=lat,lng or ?query=lat,lng or ?ll=lat,lng or ?daddr=lat,lng or center=lat,lng
  const paramMatch = text.match(/(?:[?&]|\b)(?:q|query|ll|daddr|destination|center|loc:)=(-?\d+\.\d+)(?:,|%2C|\+)(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern E: /dir//lat,lng or /dir/lat,lng
  const dirMatch = text.match(/\/dir\/(?:[^\/]+\/)?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (dirMatch) {
    const lat = parseFloat(dirMatch[1]);
    const lng = parseFloat(dirMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern F: staticmap center=lat,lng
  const staticMapMatch = text.match(/staticmap\?[^"'>]*center=(-?\d+\.\d+)(?:,|%2C|\+)(-?\d+\.\d+)/i);
  if (staticMapMatch) {
    const lat = parseFloat(staticMapMatch[1]);
    const lng = parseFloat(staticMapMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Pattern G: Degrees Minutes Seconds (e.g. 20°17'45.8"N 85°49'28.3"E)
  const dmsMatch = text.match(/(\d+)°(\d+)'([\d.]+)"([NS])[\s+,]+(\d+)°(\d+)'([\d.]+)"([EW])/i);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lng = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
    return { lat, lng };
  }

  // Pattern H: Raw decimal coordinates "20.2960587, 85.8245398"
  const rawMatch = text.match(/(?:^|[^\d.-])(-?\d{1,3}\.\d+)\s*(?:,|\s+)\s*(-?\d{1,3}\.\d+)(?:[^\d.-]|$)/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Parses Google Maps URL, raw coordinates, or calls API to resolve short links
 */
export async function parseMapLinkOrAddress(text) {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();

  // 1. Instant direct client-side parsing (0ms round trip!)
  const direct = extractCoordsFromString(str);
  if (direct) {
    const address = await reverseGeocodeCoords(direct.lat, direct.lng);
    return { lat: direct.lat, lng: direct.lng, address };
  }

  // 2. Shortened link or complex link -> resolve via backend redirect handler
  if (str.includes('goo.gl') || str.includes('google.com/maps') || str.includes('http') || str.includes('maps')) {
    try {
      const res = await api.resolveLocation(str);
      if (res && res.lat != null && res.lng != null) {
        return {
          lat: Number(res.lat),
          lng: Number(res.lng),
          address: res.formattedAddress || (await reverseGeocodeCoords(res.lat, res.lng)),
        };
      }
    } catch (e) {
      console.warn('Backend resolve location notice:', e.message);
    }

    // Direct browser fallback to unshorten API if backend had any network glitch
    try {
      const unres = await fetch(`https://unshorten.me/json/${encodeURIComponent(str)}`, { signal: AbortSignal.timeout(3500) });
      if (unres.ok) {
        const undata = await unres.json();
        if (undata && undata.resolved_url) {
          const coords = extractCoordsFromString(undata.resolved_url);
          if (coords) {
            const address = await reverseGeocodeCoords(coords.lat, coords.lng);
            return { lat: coords.lat, lng: coords.lng, address };
          }
        }
      }
    } catch (e2) {}
  }

  return null;
}
