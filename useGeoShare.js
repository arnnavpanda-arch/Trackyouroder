import { useEffect, useRef, useState, useCallback } from 'react';
import { getResilientDeviceLocation } from '../utils/geoHelper';
import { api } from '../services/api';

/**
 * Hook for agents to share real-time exact GPS location.
 * Uses getResilientDeviceLocation (3-tier cascade: WiFi/network, hardware GPS, IP fallback)
 * so it NEVER gets stuck on POSITION_UNAVAILABLE or fake simulations.
 */
export default function useGeoShare(orderId, socket, order = null, intervalMs = 3000) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [pos, setPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [isExact, setIsExact] = useState(false);
  const last = useRef(null);

  // Broadcast function
  const emitLocation = useCallback(
    (coords, exact = true, acc = null) => {
      if (!coords || !socket || !orderId) return;
      socket.emit('agentLocation', {
        orderId,
        lat: coords.lat,
        lng: coords.lng,
        isExact: exact,
        accuracy: acc,
        ts: Date.now(),
      });
      // Also persist to database
      api.updateOrderLocation(orderId, {
        agentLoc: {
          lat: coords.lat,
          lng: coords.lng,
          isExact: exact,
          accuracy: acc,
        },
      }).catch(() => {});
    },
    [socket, orderId]
  );

  // Manual one-click exact GPS refresh
  const refreshExactFix = useCallback(async () => {
    setErr('Acquiring real device location…');
    try {
      const realLoc = await getResilientDeviceLocation();
      const coords = { lat: realLoc.lat, lng: realLoc.lng };
      last.current = coords;
      setPos(coords);
      setAccuracy(realLoc.accuracy || 20);
      setIsExact(true);
      setErr('');
      emitLocation(coords, true, realLoc.accuracy || 20);
    } catch (e) {
      setErr(`GPS notice: ${e.message || 'Unable to get location fix'}`);
    }
  }, [emitLocation]);

  useEffect(() => {
    if (!on || !orderId) return;

    let watchId = null;
    let broadcastTimer = null;
    let isCancelled = false;

    // 1. Immediately capture agent's real device location
    getResilientDeviceLocation()
      .then((realLoc) => {
        if (isCancelled) return;
        const coords = { lat: realLoc.lat, lng: realLoc.lng };
        last.current = coords;
        setPos(coords);
        setAccuracy(realLoc.accuracy || 20);
        setIsExact(true);
        setErr('');
        emitLocation(coords, true, realLoc.accuracy || 20);
      })
      .catch((e) => {
        if (isCancelled) return;
        console.warn('Initial device location notice:', e.message);
      });

    // 2. Watch position continuously using standard browser geolocation
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            if (isCancelled) return;
            const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
            const acc = p.coords.accuracy || null;
            last.current = coords;
            setPos(coords);
            setAccuracy(acc);
            setIsExact(true);
            setErr('');
            emitLocation(coords, true, acc);
          },
          (e) => {
            if (isCancelled) return;
            console.warn(`Geolocation watch notice (${e.message || e.code})`);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      } catch (err) {
        console.warn('Failed to start watchPosition:', err);
      }
    }

    // 3. Regular interval broadcast of live position
    broadcastTimer = setInterval(() => {
      if (last.current) {
        emitLocation(last.current, true, accuracy);
      } else {
        getResilientDeviceLocation()
          .then((l) => {
            if (isCancelled) return;
            const coords = { lat: l.lat, lng: l.lng };
            last.current = coords;
            setPos(coords);
            emitLocation(coords, true, l.accuracy);
          })
          .catch(() => {});
      }
    }, intervalMs);

    return () => {
      isCancelled = true;
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (broadcastTimer) clearInterval(broadcastTimer);
    };
  }, [on, orderId, intervalMs, emitLocation]);

  return {
    on,
    err,
    pos,
    accuracy,
    isExact,
    isSimulated: false,
    refreshExactFix,
    toggle: (v) => {
      setErr('');
      setOn(v);
    },
  };
}
