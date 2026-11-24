import dns from 'node:dns';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

dns.setDefaultResultOrder('ipv4first');
const execFileAsync = promisify(execFile);

// Geocoding and Reverse-Geocoding Utility using Nominatim / OpenStreetMap
// Converts any address string into real coordinates [lat, lng], and coordinates into real addresses.

const geocodeCache = new Map();

/**
 * Geocodes an address string to { lat: number, lng: number, formattedAddress: string }
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim().length < 2) {
    return null;
  }

  const query = address.trim();
  const cacheKey = query.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TrackoraDeliveryApp/1.0 (contact@trackora.com)',
        'Accept-Language': 'en',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const result = {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          formattedAddress: item.display_name,
        };
        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn(`[Geocoder] Geocoding failed for "${address}":`, err.message);
  }

  return null;
}

/**
 * Reverse geocodes coordinates { lat, lng } to formatted address string
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;

  const cacheKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'TrackoraDeliveryApp/1.0 (contact@trackora.com)',
        'Accept-Language': 'en',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        geocodeCache.set(cacheKey, data.display_name);
        return data.display_name;
      }
    }
  } catch (err) {
    console.warn(`[Geocoder] Reverse geocoding failed for ${lat},${lng}:`, err.message);
  }

  return null;
}

/**
 * Extracts coordinates from any text, URL, redirect header, or HTML string
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

  // Pattern G: Degrees Minutes Seconds (e.g. 20°17'45.8"N 85°49'28.3"E or 20°17'45.8"N+85°49'28.3"E)
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
 * Resolves a Google Maps link, coordinates string, or address string into { lat, lng, formattedAddress }
 */
export async function parseMapLinkOrAddress(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  // 1. Direct coordinate extraction from the raw input string
  const direct = extractCoordsFromString(str);
  if (direct) {
    const addr = await reverseGeocode(direct.lat, direct.lng);
    return {
      lat: direct.lat,
      lng: direct.lng,
      formattedAddress: addr || `Pinned Location (${direct.lat.toFixed(5)}, ${direct.lng.toFixed(5)})`,
    };
  }

  // Extract URL from input if mixed with accompanying text
  const urlMatch = str.match(/https?:\/\/[^\s"'<>]+/);
  const targetUrl = urlMatch ? urlMatch[0] : (str.startsWith('http') ? str : null);

  // 2. Shortened link or Google Maps web link resolution
  if (targetUrl) {
    // Strategy: Race multiple unshorteners concurrently (unshorten.me, curl effective url, fetch)
    const resolveShortLinkRace = async (url) => {
      const curlPromise = new Promise(async (resolve) => {
        try {
          const res = await execFileAsync('curl', ['-s', '-L', '-w', '%{url_effective}', '-o', '/dev/null', '--max-time', '6', url]);
          const out = (res.stdout || '').trim();
          if (out && out !== url) return resolve(out);
        } catch (e) {
          const out = (e.stdout || '').trim();
          if (out && out !== url) return resolve(out);
        }
        resolve(null);
      });

      const unshortenPromise = new Promise(async (resolve) => {
        try {
          const r = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) });
          if (r.ok) {
            const d = await r.json();
            if (d && d.resolved_url) return resolve(d.resolved_url);
          }
        } catch (e) {}
        resolve(null);
      });

      return await Promise.race([
        curlPromise.then((u) => u ? u : new Promise(() => {})),
        unshortenPromise.then((u) => u ? u : new Promise(() => {})),
        new Promise((r) => setTimeout(() => r(null), 4000)),
      ]);
    };

    const resolvedUrl = await resolveShortLinkRace(targetUrl);
    if (resolvedUrl) {
      const coords = extractCoordsFromString(resolvedUrl);
      if (coords) {
        const addr = await reverseGeocode(coords.lat, coords.lng);
        return {
          lat: coords.lat,
          lng: coords.lng,
          formattedAddress: addr || `Google Maps Pin (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`,
        };
      }
      const placeMatch = resolvedUrl.match(/\/place\/([^/@?#]+)/);
      if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
        const placeGeo = await geocodeAddress(placeName);
        if (placeGeo) return placeGeo;
      }
    }

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Step 2b: Try manual redirect to capture the 301/302 'Location' header via fetch
    try {
      const headResp = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: browserHeaders,
        signal: AbortSignal.timeout(3000),
      });

      const redirectHeader = headResp.headers.get('location');
      if (redirectHeader) {
        const coords = extractCoordsFromString(redirectHeader);
        if (coords) {
          const addr = await reverseGeocode(coords.lat, coords.lng);
          return {
            lat: coords.lat,
            lng: coords.lng,
            formattedAddress: addr || `Google Maps Pin (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`,
          };
        }
      }
    } catch (e1) {
      console.warn('[Geocoder] manual redirect note:', e1.message);
    }

    // Step 2c: Follow redirects fully and inspect both final URL and response HTML
    try {
      const fullResp = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: browserHeaders,
        signal: AbortSignal.timeout(4000),
      });

      const finalUrl = fullResp.url || '';
      const urlCoords = extractCoordsFromString(finalUrl);
      if (urlCoords) {
        const addr = await reverseGeocode(urlCoords.lat, urlCoords.lng);
        return {
          lat: urlCoords.lat,
          lng: urlCoords.lng,
          formattedAddress: addr || `Google Maps Pin (${urlCoords.lat.toFixed(5)}, ${urlCoords.lng.toFixed(5)})`,
        };
      }

      // Check HTML content for meta tags, og:url, og:image, or embedded coordinates
      const html = await fullResp.text();
      const htmlCoords = extractCoordsFromString(html);
      if (htmlCoords) {
        const addr = await reverseGeocode(htmlCoords.lat, htmlCoords.lng);
        return {
          lat: htmlCoords.lat,
          lng: htmlCoords.lng,
          formattedAddress: addr || `Google Maps Pin (${htmlCoords.lat.toFixed(5)}, ${htmlCoords.lng.toFixed(5)})`,
        };
      }

      // Check for place name in URL: /place/Place+Name/
      const placeMatch = finalUrl.match(/\/place\/([^/@?#]+)/);
      if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
        const placeGeo = await geocodeAddress(placeName);
        if (placeGeo) return placeGeo;
      }
    } catch (e2) {
      console.warn('[Geocoder] follow redirect error:', e2.message);
    }
  }

  // 3. Fallback: Check if there's a place name in the string itself
  const placeMatch = str.match(/\/place\/([^/@?#]+)/);
  if (placeMatch) {
    const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
    const placeGeo = await geocodeAddress(placeName);
    if (placeGeo) return placeGeo;
  }

  // 4. Fallback: regular forward geocoding
  return await geocodeAddress(str);
}
