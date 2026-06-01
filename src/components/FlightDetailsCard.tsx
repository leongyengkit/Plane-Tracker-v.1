import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Flight } from '../data/mockFlights';
import './FlightDetailsCard.css';

interface FlightDetailsCardProps {
  flight: Flight;
}

// Great-circle interpolation (Slerp on the sphere) with International Date Line wrapping
const interpolateGreatCircle = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number
) => {
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  
  let rLng1 = (lng1 * Math.PI) / 180;
  let rLng2 = (lng2 * Math.PI) / 180;
  
  // Handle crossing the Antimeridian (180th meridian)
  const diffLng = lng2 - lng1;
  if (diffLng > 180) {
    rLng1 += 2 * Math.PI;
  } else if (diffLng < -180) {
    rLng2 += 2 * Math.PI;
  }
  
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((rLat1 - rLat2) / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin((rLng1 - rLng2) / 2) ** 2
  ));
  
  if (d === 0) return { lat: lat1, lng: lng1 };
  
  const a = Math.sin((1 - t) * d) / Math.sin(d);
  const b = Math.sin(t * d) / Math.sin(d);
  
  const x = a * Math.cos(rLat1) * Math.cos(rLng1) + b * Math.cos(rLat2) * Math.cos(rLng2);
  const y = a * Math.cos(rLat1) * Math.sin(rLng1) + b * Math.cos(rLat2) * Math.sin(rLng2);
  const z = a * Math.sin(rLat1) + b * Math.sin(rLat2);
  
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
  let lng = (Math.atan2(y, x) * 180) / Math.PI;
  
  // Normalize longitude back to [-180, 180]
  lng = (((lng + 180) % 360) + 360) % 360 - 180;
  
  return { lat, lng };
};

// Generate full path points along the great-circle
const getGreatCirclePoints = (
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numPoints: number = 100
) => {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    points.push(interpolateGreatCircle(start.lat, start.lng, end.lat, end.lng, i / numPoints));
  }
  return points;
};

// Split path points into separate polyline segments when crossing the antimeridian
const splitPathAtAntimeridian = (coords: { lat: number; lng: number }[]) => {
  const segments: [number, number][][] = [[]];
  for (let i = 0; i < coords.length; i++) {
    const current = coords[i];
    if (i > 0) {
      const prev = coords[i - 1];
      if (Math.abs(current.lng - prev.lng) > 180) {
        segments.push([]); // Start new segment
      }
    }
    segments[segments.length - 1].push([current.lat, current.lng]);
  }
  return segments;
};

// Custom Leaflet DivIcon factory for airports
const airportIcon = (code: string, color: string) => {
  return L.divIcon({
    className: 'custom-airport-marker',
    html: `
      <div class="airport-marker-content">
        <span class="airport-marker-dot" style="background-color: ${color}; box-shadow: 0 0 8px ${color};"></span>
        <span class="airport-marker-text" style="color: ${color};">${code}</span>
      </div>
    `,
    iconSize: [60, 20],
    iconAnchor: [6, 10]
  });
};

// Custom Leaflet DivIcon factory for the plane
const planeIcon = (angle: number, isLive: boolean) => {
  const planeColor = isLive ? '#8b5cf6' : 'var(--text-secondary)'; // Use purple for plane marker if live
  const pulseClass = isLive ? 'plane-marker-pulse active' : 'plane-marker-pulse';
  return L.divIcon({
    className: 'custom-plane-marker',
    html: `
      <div class="plane-marker-container">
        <div class="${pulseClass}" style="border-color: ${planeColor};"></div>
        <div class="plane-icon-wrapper" style="transform: rotate(${angle}deg); color: ${planeColor};">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

export const FlightDetailsCard: React.FC<FlightDetailsCardProps> = ({ flight }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Keep persistent references to map layers to update them smoothly without recreating
  const depMarkerRef = useRef<L.Marker | null>(null);
  const arrMarkerRef = useRef<L.Marker | null>(null);
  const planeMarkerRef = useRef<L.Marker | null>(null);
  const traveledPolylinesRef = useRef<L.Polyline[]>([]);
  const remainingPolylinesRef = useRef<L.Polyline[]>([]);

  // Live ADS-B coordinates state
  const [liveData, setLiveData] = useState<{
    lat: number;
    lng: number;
    altitude: number | null;
    heading: number;
    speed: number | null;
    isLive: boolean;
    loading: boolean;
  }>({
    lat: 0,
    lng: 0,
    altitude: null,
    heading: 0,
    speed: null,
    isLive: false,
    loading: true
  });

  // Time formatting with parsed GMT Offset
  const formatTimeWithGmtOffset = (timeIso: string, timezoneLabel: string) => {
    const parsed = parseISO(timeIso);
    const timeStr = format(parsed, 'hh:mm a');
    
    let offsetStr = 'GMT+0';
    if (!timeIso.endsWith('Z')) {
      const match = timeIso.match(/([+-]\d{2}):?(\d{2})$/);
      if (match) {
        const [_, hours, minutes] = match;
        const hoursNum = parseInt(hours, 10);
        const sign = hoursNum >= 0 ? '+' : '';
        const minsStr = minutes !== '00' ? `:${minutes}` : '';
        offsetStr = `GMT${sign}${hoursNum}${minsStr}`;
      }
    }
    
    return {
      time: timeStr,
      label: `${timezoneLabel} (${offsetStr})`
    };
  };

  const depTimeInfo = formatTimeWithGmtOffset(flight.departure.time, flight.departure.timezone);
  const arrTimeInfo = formatTimeWithGmtOffset(flight.arrival.time, flight.arrival.timezone);

  // Effect to handle Live ADS-B queries from OpenSky Network
  useEffect(() => {
    let active = true;
    setLiveData(prev => ({ ...prev, loading: true, isLive: false }));

    const fetchLiveADSB = async () => {
      try {
        const response = await fetch(`https://opensky-network.org/api/states/all?icao24=${flight.icao24}`);
        const data = await response.json();
        
        if (!active) return;

        if (data && data.states && data.states.length > 0) {
          const state = data.states[0];
          const lng = state[5];
          const lat = state[6];
          const alt = state[7]; // meters
          const heading = state[10] || 0; // heading degrees
          const speed = state[9] ? Math.round(state[9] * 1.94384) : null; // meters/sec -> knots

          if (lat !== null && lng !== null) {
            setLiveData({
              lat,
              lng,
              altitude: alt ? Math.round(alt * 3.28084) : null, // meters -> feet
              heading,
              speed,
              isLive: true,
              loading: false
            });
            return;
          }
        }
      } catch (error) {
        console.error("OpenSky API fetch error, using simulator:", error);
      }

      // Fallback if plane is offline/grounded
      if (active) {
        setLiveData({
          lat: 0,
          lng: 0,
          altitude: null,
          heading: 0,
          speed: null,
          isLive: false,
          loading: false
        });
      }
    };

    fetchLiveADSB();
    const interval = setInterval(fetchLiveADSB, 30000); // refresh every 30s

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [flight]);

  // Effect 1: Initialize Leaflet Map and Setup Flight Route (Only runs when flight changes)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Build map instance if missing
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true
      }).setView([0, 0], 2);

      // CartoDB Voyager tiles show blue water and yellow/beige land with major cities labeled
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;

    // Clear old route layers to build fresh ones for the new flight
    if (depMarkerRef.current) map.removeLayer(depMarkerRef.current);
    if (arrMarkerRef.current) map.removeLayer(arrMarkerRef.current);
    if (planeMarkerRef.current) map.removeLayer(planeMarkerRef.current);
    
    traveledPolylinesRef.current.forEach(p => map.removeLayer(p));
    remainingPolylinesRef.current.forEach(p => map.removeLayer(p));
    
    depMarkerRef.current = null;
    arrMarkerRef.current = null;
    planeMarkerRef.current = null;
    traveledPolylinesRef.current = [];
    remainingPolylinesRef.current = [];

    const dep = flight.departure.coordinates;
    const arr = flight.arrival.coordinates;

    // Draw departure and arrival markers
    depMarkerRef.current = L.marker([dep.lat, dep.lng], {
      icon: airportIcon(flight.departure.code, '#8b5cf6') // Purple theme for origin
    }).addTo(map);

    arrMarkerRef.current = L.marker([arr.lat, arr.lng], {
      icon: airportIcon(flight.arrival.code, '#ef4444') // Red theme for destination
    }).addTo(map);

    // Initial Camera Fit Bounds (ONLY called on flight select)
    const bounds = L.latLngBounds([dep.lat, dep.lng], [arr.lat, arr.lng]);
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 6
    });

  }, [flight]);

  // Effect 2: Update Plane marker and Flight path lines (Runs on flight change and liveData updates)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const dep = flight.departure.coordinates;
    const arr = flight.arrival.coordinates;

    // 1. Calculate path points
    const pathPoints = getGreatCirclePoints(dep, arr, 100);

    // 2. Determine plane coords & heading
    let planeCoords = { lat: 0, lng: 0 };
    let currentProgress = flight.progress;
    let planeHeading = 0;
    const isLiveActive = liveData.isLive;

    if (isLiveActive) {
      planeCoords = { lat: liveData.lat, lng: liveData.lng };
      planeHeading = liveData.heading;
    } else {
      // Offline fallback: place plane on path based on hardcoded progress
      const idx = Math.floor(currentProgress * (pathPoints.length - 1));
      planeCoords = pathPoints[idx] || dep;

      // Compute heading from the next path segment
      const pPrev = pathPoints[Math.max(0, idx - 1)] || dep;
      const pNext = pathPoints[Math.min(pathPoints.length - 1, idx + 1)] || arr;
      planeHeading = Math.atan2(pNext.lng - pPrev.lng, pNext.lat - pPrev.lat) * 180 / Math.PI;
    }

    // 3. Find closest segment index to split the great-circle path
    let closestIndex = 0;
    let minDist = Infinity;
    for (let i = 0; i < pathPoints.length; i++) {
      const dLat = pathPoints[i].lat - planeCoords.lat;
      let dLng = pathPoints[i].lng - planeCoords.lng;
      if (dLng > 180) dLng -= 360;
      else if (dLng < -180) dLng += 360;

      const d = dLat * dLat + dLng * dLng;
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    }

    // 4. Draw Traveled Path (Solid Purple Polyline)
    traveledPolylinesRef.current.forEach(p => map.removeLayer(p));
    traveledPolylinesRef.current = [];

    const traveledCoords = pathPoints.slice(0, closestIndex + 1);
    traveledCoords.push(planeCoords); // snap line directly to aircraft

    const traveledSegments = splitPathAtAntimeridian(traveledCoords);
    traveledSegments.forEach(seg => {
      const poly = L.polyline(seg, {
        color: '#8b5cf6', // Solid purple for past path
        weight: 4,
        opacity: 0.9
      }).addTo(map);
      traveledPolylinesRef.current.push(poly);
    });

    // 5. Draw Projected Path (Dotted Red Polyline)
    remainingPolylinesRef.current.forEach(p => map.removeLayer(p));
    remainingPolylinesRef.current = [];

    const remainingCoords = [planeCoords, ...pathPoints.slice(closestIndex)];
    const remainingSegments = splitPathAtAntimeridian(remainingCoords);
    remainingSegments.forEach(seg => {
      const poly = L.polyline(seg, {
        color: '#ef4444', // Dotted red for remaining path
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.95
      }).addTo(map);
      remainingPolylinesRef.current.push(poly);
    });

    // 6. Update or Create Plane Marker
    if (planeMarkerRef.current) {
      planeMarkerRef.current.setLatLng([planeCoords.lat, planeCoords.lng]);
      planeMarkerRef.current.setIcon(planeIcon(planeHeading, isLiveActive));
    } else {
      planeMarkerRef.current = L.marker([planeCoords.lat, planeCoords.lng], {
        icon: planeIcon(planeHeading, isLiveActive)
      }).addTo(map);
    }

    // Force Plane Marker to stay layered on top of airport indicators
    planeMarkerRef.current.setZIndexOffset(1000);

  }, [flight, liveData]);

  // Map Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="card-container">
      <div className="card-content">
        {/* Card Header */}
        <div className="card-header">
          <div className="airline-info">
            <div className="airline-logo-placeholder"></div>
            <div className="airline-name">
              {flight.airline} <span>|</span> {flight.flightNumber}
            </div>
          </div>
          <div className="flight-status-wrapper">
            <div className="flight-status" style={{ color: flight.statusColor }}>
              <div className="status-dot" style={{ backgroundColor: flight.statusColor }}></div>
              {flight.status}
            </div>
          </div>
        </div>

        {/* Flight Details Row */}
        <div className="flight-info-row">
          {/* Departure block */}
          <div className="info-block departure">
            <div className="label">DEPARTURE</div>
            <div className="city-name">{flight.departure.city}</div>
            <div className="airport-info">
              <span className="airport-code">{flight.departure.code}</span>
              <span className="airport-name">{flight.departure.airport}</span>
            </div>
            <div className="time-info">
              <span className="time">{depTimeInfo.time}</span>
              <span className="timezone">{depTimeInfo.label}</span>
            </div>
            <div className="terminal-info">
              Terminal {flight.departure.terminal} | Gate {flight.departure.gate}
            </div>
          </div>

          {/* Quick stats in center */}
          <div className="info-block stats-center">
            <div className="stat-item">
              <span className="stat-label">DURATION</span>
              <span className="stat-val">{flight.flightDuration}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">STATUS MESSAGE</span>
              <span className="stat-val status-msg">{flight.flightStatusMessage}</span>
            </div>
          </div>

          {/* Arrival block */}
          <div className="info-block arrival">
            <div className="label">ARRIVAL</div>
            <div className="city-name">{flight.arrival.city}</div>
            <div className="airport-info">
              <span className="airport-code">{flight.arrival.code}</span>
              <span className="airport-name">{flight.arrival.airport}</span>
            </div>
            <div className="time-info">
              <span className="time">{arrTimeInfo.time}</span>
              <span className="timezone">{arrTimeInfo.label}</span>
            </div>
            <div className="terminal-info">
              Terminal {flight.arrival.terminal} | Gate {flight.arrival.gate}
            </div>
          </div>
        </div>

        {/* Live Map Section */}
        <div className="flight-map-container">
          <div className="map-header-row">
            <div className="map-title">LIVE FLIGHT TRAJECTORY</div>
            <div className={`adsb-status-badge ${liveData.isLive ? 'live' : 'simulated'}`}>
              {liveData.loading ? (
                <span>QUERING ADS-B FEED...</span>
              ) : liveData.isLive ? (
                <>
                  <span className="live-pulse-dot"></span>
                  <span>LIVE ADS-B ACTIVE</span>
                </>
              ) : (
                <span>SIMULATED ROUTE</span>
              )}
            </div>
          </div>

          {/* Interactive Leaflet Map Div */}
          <div className="leaflet-map-wrapper">
            <div id="flight-leaflet-map" ref={mapContainerRef}></div>
          </div>

          {/* Telemetry panel (visible if live tracking data is resolved) */}
          {liveData.isLive && (
            <div className="telemetry-panel">
              <div className="telemetry-item">
                <span className="telemetry-label">ALTITUDE</span>
                <span className="telemetry-value">
                  {liveData.altitude ? `${liveData.altitude.toLocaleString()} FT` : 'N/A'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">SPEED</span>
                <span className="telemetry-value">
                  {liveData.speed ? `${liveData.speed} KTS` : 'N/A'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">HEADING</span>
                <span className="telemetry-value">{liveData.heading}°</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">COORDINATES</span>
                <span className="telemetry-value text-mono">
                  {liveData.lat.toFixed(4)}°, {liveData.lng.toFixed(4)}°
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
