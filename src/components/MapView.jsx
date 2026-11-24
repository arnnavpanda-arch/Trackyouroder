import { useEffect, useRef, useState, useCallback } from 'react';
import { getRoadRoute } from '../utils/routing';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBP8VFAuzKqFeiRg77Jg7razxXYMWKpu94';
const COL = {
  pickup: '#1e293b',
  drop: '#16a34a',
  agent: '#e8212f',
  user: '#0284c7',
};

const ICONS = {
  pickup: '📦',
  drop: '🏠',
  agent: '🛵',
  user: '📍',
};

let loader;
const load = () =>
  loader ||
  (loader = new Promise((res, rej) => {
    if (window.google?.maps) return res();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=geometry`;
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  }));

/**
 * Creates SVG data URI marker icons for Google Maps
 */
function createMarkerIcon(type) {
  const color = COL[type] || '#2563eb';
  const emoji = ICONS[type] || '📍';
  const isAgent = type === 'agent';
  const size = isAgent ? 46 : 40;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
    </defs>
    <path d="M ${size / 2} ${size + 6} L ${size / 2 - 6} ${size - 4} Q ${size / 2} ${size} ${size / 2 + 6} ${size - 4} Z" fill="${color}" filter="url(#shadow)"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${color}" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
    <text x="50%" y="${size / 2 + 6}" font-size="${isAgent ? 19 : 17}" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: window.google?.maps ? new window.google.maps.Size(size, size + 8) : null,
    anchor: window.google?.maps ? new window.google.maps.Point(size / 2, size + 6) : null,
  };
}

/**
 * markers: [{ id, lat, lng, type: 'pickup'|'drop'|'agent'|'user', label, title, address, phone, details, accuracy, isExact }]
 * route: [[lat, lng], ...]
 */
export default function MapView({ markers = [], route = [], height = 400, onRouteInfo }) {
  const [mode, setMode] = useState(KEY ? 'loading' : 'fallback');
  const box = useRef(null);
  const map = useRef(null);
  const objs = useRef({});
  const circles = useRef({});
  const infoWindow = useRef(null);
  const casingLine = useRef(null);
  const mainLine = useRef(null);
  const fit = useRef('');
  const [roadPath, setRoadPath] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Recenter map bounds on all markers
  const fitBoundsToAll = useCallback(() => {
    if (!map.current || !markers.length) return;
    const g = window.google?.maps;
    if (!g) return;

    if (markers.length === 1) {
      map.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      map.current.setZoom(15);
      return;
    }

    const bounds = new g.LatLngBounds();
    markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
    if (roadPath.length > 1) {
      roadPath.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    }
    map.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [markers, roadPath]);

  // Initialize Google Maps
  useEffect(() => {
    if (!KEY) {
      setMode('fallback');
      return;
    }
    let dead = false;
    load()
      .then(() => {
        if (dead || map.current) return;
        const initialCenter = markers.length > 0
          ? { lat: markers[0].lat, lng: markers[0].lng }
          : (route.length > 0 ? { lat: route[0][0], lng: route[0][1] } : { lat: 28.6139, lng: 77.2090 });

        map.current = new window.google.maps.Map(box.current, {
          center: initialCenter,
          zoom: markers.length ? 14 : 12,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          ],
        });
        infoWindow.current = new window.google.maps.InfoWindow();
        setMode('google');

        // Immediately fit bounds to real markers if present
        if (markers.length > 0) {
          setTimeout(fitBoundsToAll, 100);
        }
      })
      .catch((err) => {
        console.warn('Google Maps load error:', err);
        if (!dead) setMode('fallback');
      });
    return () => {
      dead = true;
    };
  }, []);

  // Compute road-wise route points whenever route changes
  useEffect(() => {
    let dead = false;
    if (!route || route.length < 2) {
      setRoadPath([]);
      return;
    }

    if (route.length > 2) {
      // Already has detailed road points
      setRoadPath(route);
      return;
    }

    // Two endpoints: fetch actual road-wise turns
    const origin = { lat: route[0][0], lng: route[0][1] };
    const destination = { lat: route[1][0], lng: route[1][1] };

    getRoadRoute(origin, destination).then((result) => {
      if (dead || !result) return;
      if (result.coordinates && result.coordinates.length > 1) {
        setRoadPath(result.coordinates);
      } else {
        setRoadPath(route);
      }
      if (onRouteInfo) {
        onRouteInfo(result);
      }
    });

    return () => {
      dead = true;
    };
  }, [route, onRouteInfo]);

  // Update Google Maps markers & polylines
  useEffect(() => {
    if (mode !== 'google' || !map.current) return;
    const g = window.google.maps;
    const seen = new Set();

    markers
      .filter((m) => m && m.lat != null && m.lng != null && !isNaN(Number(m.lat)) && !isNaN(Number(m.lng)))
      .forEach((m) => {
        seen.add(m.id);
        const latNum = Number(m.lat);
        const lngNum = Number(m.lng);
        const pos = { lat: latNum, lng: lngNum };
        const icon = createMarkerIcon(m.type);

        let markerObj = objs.current[m.id];
        if (markerObj) {
          markerObj.setPosition(pos);
          markerObj.setIcon(icon);
        } else {
          markerObj = new g.Marker({
            map: map.current,
            position: pos,
            title: m.label || m.title,
            icon,
            animation: m.type === 'agent' ? g.Animation.DROP : undefined,
          });

          // Add interactive InfoWindow on click
          markerObj.addListener('click', () => {
            setSelectedMarker(m);
            const content = `
              <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 4px; min-width: 220px; max-width: 300px; line-height: 1.4;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="font-size: 22px;">${ICONS[m.type] || '📍'}</span>
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${m.title || m.label}</div>
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${COL[m.type] || '#2563eb'};">
                      ${m.type === 'agent' ? '🛵 Exact Courier Location' : m.type === 'drop' ? '🏠 Customer Drop Destination' : m.type === 'user' ? '📍 Your Current Live GPS' : '📦 Pickup Point'}
                    </div>
                  </div>
                </div>
                ${m.address ? `<div style="font-size: 11px; color: #475569; margin-bottom: 4px; background: #f8fafc; padding: 4px 6px; border-radius: 4px; border-left: 3px solid ${COL[m.type] || '#cbd5e1'};">📍 ${m.address}</div>` : ''}
                ${m.details ? `<div style="font-size: 11px; color: #1e293b; font-weight: 600; margin-bottom: 3px;">ℹ️ ${m.details}</div>` : ''}
                ${m.phone ? `<div style="font-size: 11px; color: #15803d; font-weight: 600;">📞 ${m.phone}</div>` : ''}
                <div style="font-size: 10px; font-family: monospace; color: #0f172a; background: #eff6ff; padding: 3px 6px; border-radius: 4px; margin-top: 5px; font-weight: 700;">
                  Exact GPS: ${latNum.toFixed(6)}, ${lngNum.toFixed(6)}
                </div>
                ${m.accuracy ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">GPS Accuracy: ±${Math.round(m.accuracy)} meters</div>` : ''}
              </div>
            `;
          infoWindow.current.setContent(content);
          infoWindow.current.open(map.current, markerObj);
        });

        objs.current[m.id] = markerObj;
      }

      // Accuracy radius circle on GPS
      if (m.accuracy && (m.type === 'agent' || m.type === 'user')) {
        if (!circles.current[m.id]) {
          circles.current[m.id] = new g.Circle({
            map: map.current,
            center: pos,
            radius: Math.max(15, m.accuracy),
            strokeColor: COL[m.type] || '#2563eb',
            strokeOpacity: 0.5,
            strokeWeight: 1.5,
            fillColor: COL[m.type] || '#2563eb',
            fillOpacity: 0.1,
          });
        } else {
          circles.current[m.id].setCenter(pos);
          circles.current[m.id].setRadius(Math.max(15, m.accuracy));
        }
      }
    });

    // Remove deleted markers & circles
    Object.keys(objs.current).forEach((k) => {
      if (!seen.has(k)) {
        objs.current[k].setMap(null);
        delete objs.current[k];
        if (circles.current[k]) {
          circles.current[k].setMap(null);
          delete circles.current[k];
        }
      }
    });

    // Draw Road Polyline
    const activePath = roadPath.length > 1 ? roadPath : route;
    const pathKey = activePath.map((r) => r.join()).join('|') + markers.map((m) => `${m.id}-${Number(m.lat || 0).toFixed(4)}-${Number(m.lng || 0).toFixed(4)}`).join();

    if (pathKey !== fit.current && activePath.length > 1) {
      fit.current = pathKey;
      const gPath = activePath.map(([lat, lng]) => ({ lat, lng }));

      // Clean up previous lines
      casingLine.current?.setMap(null);
      mainLine.current?.setMap(null);

      // Casing line (thick underlay for road feel)
      casingLine.current = new g.Polyline({
        map: map.current,
        path: gPath,
        strokeColor: '#1d4ed8',
        strokeOpacity: 0.35,
        strokeWeight: 7,
      });

      // Main vibrant road line
      mainLine.current = new g.Polyline({
        map: map.current,
        path: gPath,
        strokeColor: '#2563eb',
        strokeOpacity: 0.95,
        strokeWeight: 4.5,
      });

      // Also attempt Google Directions if roadPath had only 2 points
      if (activePath.length === 2 && g.DirectionsService) {
        new g.DirectionsService().route(
          { origin: gPath[0], destination: gPath[gPath.length - 1], travelMode: 'DRIVING' },
          (r, s) => {
            if (s === 'OK' && r.routes?.[0]?.overview_path) {
              const overview = r.routes[0].overview_path;
              casingLine.current?.setPath(overview);
              mainLine.current?.setPath(overview);
            }
          }
        );
      }

      // Fit bounds to show both Agent and Customer exactly
      fitBoundsToAll();
    } else if (markers.length > 0) {
      fitBoundsToAll();
    }
  }, [mode, markers, route, roadPath, fitBoundsToAll]);

  if (mode === 'fallback') {
    return <Fallback markers={markers} route={roadPath.length ? roadPath : route} height={height} />;
  }

  return (
    <div className="map" style={{ height }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {mode === 'loading' && <div className="map-note">Loading interactive exact GPS map…</div>}
      <div className="map-road-indicator">
        <span>🛣️ Road-Wise Navigation · Exact Locations</span>
      </div>
      <button
        type="button"
        className="map-recenter-btn"
        onClick={fitBoundsToAll}
        title="Recenter on Agent & User exact locations"
      >
        🎯 Recenter
      </button>
    </div>
  );
}

function Fallback({ markers, route, height }) {
  const [activePin, setActivePin] = useState(null);

  const pts = [...markers, ...route.map(([lat, lng]) => ({ lat, lng }))];
  if (!pts.length) {
    return (
      <div className="map grid-bg" style={{ height }}>
        <div className="map-note center">No active deliveries to show</div>
      </div>
    );
  }

  const la = pts.map((p) => p.lat);
  const lo = pts.map((p) => p.lng);
  const a0 = Math.min(...la),
    a1 = Math.max(...la),
    o0 = Math.min(...lo),
    o1 = Math.max(...lo);

  const at = (lat, lng) => ({
    x: 8 + ((lng - o0) / (o1 - o0 || 0.0001)) * 84,
    y: 8 + (1 - (lat - a0) / (a1 - a0 || 0.0001)) * 84,
  });

  const polylinePoints = route
    .map(([lat, lng]) => {
      const p = at(lat, lng);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <div className="map grid-bg" style={{ height }} onClick={() => setActivePin(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Road casing */}
        <polyline points={polylinePoints} className="road-casing" />
        {/* Road active line */}
        <polyline points={polylinePoints} className="road-active" />
      </svg>

      {/* Markers */}
      {markers.map((m) => {
        const p = at(m.lat, m.lng);
        const isSelected = activePin?.id === m.id;

        return (
          <div
            key={m.id}
            className={`pin ${m.type} ${isSelected ? 'active' : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePin(m);
            }}
          >
            <span className="pin-symbol">{ICONS[m.type] || '📍'}</span>
            <label className="pin-label">{m.label}</label>

            {isSelected && (
              <div className="pin-popup">
                <div className="popup-badge">{ICONS[m.type]} {m.title || m.label}</div>
                {m.address && <div className="popup-addr">📍 {m.address}</div>}
                {m.details && <div className="popup-det">{m.details}</div>}
                {m.phone && <div className="popup-phone">📞 {m.phone}</div>}
                <div className="popup-gps">Exact GPS: {Number(m.lat || 0).toFixed(6)}, {Number(m.lng || 0).toFixed(6)}</div>
              </div>
            )}
          </div>
        );
      })}

      <div className="map-road-indicator">
        <span>🛣️ Road-Wise Route ({route.length > 2 ? `${route.length} Waypoints` : 'Exact Route'})</span>
      </div>
      <div className="map-note">Interactive exact map · Click markers for details</div>
    </div>
  );
}
