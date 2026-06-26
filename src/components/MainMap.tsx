import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Hospital, Location } from '../types';
import { Navigation, MapPin, Search } from 'lucide-react';

interface MainMapProps {
  apiKey: string;
  patientLocation: Location;
  hospitals: Hospital[];
  selectedHospitalId?: string;
  onSelectHospital?: (hospitalId: string) => void;
  onHospitalsLoaded?: (hospitals: Hospital[]) => void;
  activeTab: 'intake' | 'decision' | 'transport';
  onLocationChange?: (location: Location) => void;
}

// Inner helper component to search for genuine hospitals via the Google Places API (New)
function PlaceSearchAndSync({ 
  patientLocation, 
  onHospitalsLoaded,
  setLoading
}: { 
  patientLocation: Location; 
  onHospitalsLoaded?: (hospitals: Hospital[]) => void;
  setLoading: (loading: boolean) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const hasSearched = useRef<string>('');

  useEffect(() => {
    if (!placesLib || !map || !patientLocation.latitude || !patientLocation.longitude) return;
    
    const searchKey = `${patientLocation.latitude.toFixed(4)},${patientLocation.longitude.toFixed(4)}`;
    if (hasSearched.current === searchKey) return;
    hasSearched.current = searchKey;

    setLoading(true);
    
    // Pan map to patient location
    map.panTo({ lat: patientLocation.latitude, lng: patientLocation.longitude });

    placesLib.Place.searchNearby({
      locationRestriction: {
        center: { lat: patientLocation.latitude, lng: patientLocation.longitude },
        radius: 20000 // 20km search radius (find nearby hospitals regardless of range)
      },
      includedTypes: ['hospital'],
      fields: ['id', 'displayName', 'location', 'formattedAddress'],
      maxResultCount: 12
    })
      .then(({ places }) => {
        if (places && places.length > 0 && onHospitalsLoaded) {
          const mappedHospitals: Hospital[] = places.map((place) => {
            const rawLat = place.location?.lat();
            const rawLng = place.location?.lng();
            
            // Randomly configure clinical readiness parameters for simulation
            const readiness = {
              icuBeds: Math.random() > 0.3,
              otReady: Math.random() > 0.4,
              ventilators: Math.random() > 0.2,
              cardiology: Math.random() > 0.5,
              neurology: Math.random() > 0.6,
              traumaTeam: Math.random() > 0.3
            };

            return {
              id: place.id || Math.random().toString(),
              name: place.displayName || 'Regional Medical Center',
              location: {
                latitude: rawLat || 0,
                longitude: rawLng || 0,
                address: place.formattedAddress || 'Nearby Hospital Address'
              },
              readiness,
              lastUpdated: new Date().toISOString()
            };
          });
          onHospitalsLoaded(mappedHospitals);
        }
      })
      .catch((err) => {
        console.error('Places API Search Error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [placesLib, map, patientLocation.latitude, patientLocation.longitude]);

  return null;
}

// Inner helper component to draw dynamic transit routing polylines
function LiveRouteDisplay({ 
  origin, 
  destination 
}: { 
  origin: { lat: number; lng: number }; 
  destination: { lat: number; lng: number };
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin.lat || !destination.lat) return;
    
    // Clear previous direction polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach(p => {
            p.setOptions({
              strokeColor: '#ef4444',
              strokeOpacity: 0.8,
              strokeWeight: 6,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;
          
          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      })
      .catch((err) => {
        console.error('Google Routes API computeRoutes Error:', err);
      });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
}

// The core wrapper rendering components within APIProvider context
interface MainMapInnerProps {
  patientLocation: Location;
  hospitals: Hospital[];
  selectedHospitalId?: string;
  onSelectHospital?: (hospitalId: string) => void;
  onHospitalsLoaded?: (hospitals: Hospital[]) => void;
  activeTab: 'intake' | 'decision' | 'transport';
  onLocationChange?: (location: Location) => void;
  isDemoMode?: boolean;
}

const MainMapInner: React.FC<MainMapInnerProps> = ({
  patientLocation,
  hospitals,
  selectedHospitalId,
  onSelectHospital,
  onHospitalsLoaded,
  activeTab,
  onLocationChange,
  isDemoMode = false
}) => {
  const map = isDemoMode ? null : useMap();
  const placesLib = isDemoMode ? null : useMapsLibrary('places');

  const [activeInfoWindowId, setActiveInfoWindowId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Local state for Demo Mode Radar simulator
  const [radarAngle, setRadarAngle] = useState(0);
  const [hoverInfoId, setHoverInfoId] = useState<string | null>(null);

  // Rotate simulator radar sweep
  useEffect(() => {
    if (!isDemoMode) return;
    let animId: number;
    const tick = () => {
      setRadarAngle(prev => (prev + 1.5) % 360);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isDemoMode]);

  // Handle automatic generation of simulated mock hospitals relative to patient coords when pinned
  useEffect(() => {
    if (isDemoMode && onHospitalsLoaded && patientLocation.latitude) {
      setIsScanning(true);
      const timer = setTimeout(() => {
        const hospitalsList = [
          { name: 'City Central Trauma Center', latOffset: 0.014, lngOffset: -0.016 },
          { name: 'Valley Memorial Health Annex', latOffset: -0.019, lngOffset: 0.024 },
          { name: 'St. Jude Cardiac & Emergency', latOffset: 0.022, lngOffset: 0.017 },
          { name: 'Northside Regional Infirmary', latOffset: -0.012, lngOffset: -0.028 }
        ];

        const mappedHospitals: Hospital[] = hospitalsList.map((h, i) => {
          const rawLat = patientLocation.latitude + h.latOffset;
          const rawLng = patientLocation.longitude + h.lngOffset;
          const readiness = {
            icuBeds: Math.random() > 0.3,
            otReady: Math.random() > 0.4,
            ventilators: Math.random() > 0.2,
            cardiology: Math.random() > 0.5,
            neurology: Math.random() > 0.6,
            traumaTeam: Math.random() > 0.3
          };

          return {
            id: `demo-hosp-${i}-${Date.now().toString().slice(-4)}`,
            name: h.name,
            location: {
              latitude: rawLat,
              longitude: rawLng,
              address: `${200 + Math.floor(Math.random() * 700)} Medical Pkwy`
            },
            readiness,
            lastUpdated: new Date().toISOString()
          };
        });

        onHospitalsLoaded(mappedHospitals);
        setIsScanning(false);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [isDemoMode, patientLocation.latitude, patientLocation.longitude]);

  // Pan map to patient location when it changes
  useEffect(() => {
    if (!isDemoMode && map && patientLocation.latitude && patientLocation.longitude) {
      map.panTo({ lat: patientLocation.latitude, lng: patientLocation.longitude });
    }
  }, [map, patientLocation.latitude, patientLocation.longitude, isDemoMode]);

  // Handle Location Search via Places API (New) Text Search
  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    setIsSearchingLocation(true);
    setLocationError(null);

    if (isDemoMode) {
      // Simulate fake coordinate lookup offline near previous station coordinates
      setTimeout(() => {
        if (onLocationChange) {
          const latOffset = (Math.random() - 0.5) * 0.05;
          const lngOffset = (Math.random() - 0.5) * 0.05;
          const searchLat = 13.7563 + latOffset;
          const searchLng = 100.5018 + lngOffset;
          onLocationChange({
            latitude: searchLat,
            longitude: searchLng,
            address: searchQuery
          });
        }
        setIsSearchingLocation(false);
      }, 600);
      return;
    }

    if (!placesLib || !map) return;

    placesLib.Place.searchByText({
      textQuery: searchQuery,
      fields: ['displayName', 'formattedAddress', 'location'],
      locationBias: map.getCenter(),
      maxResultCount: 1
    })
      .then(({ places }) => {
        if (places && places[0]) {
          const place = places[0];
          const lat = place.location?.lat();
          const lng = place.location?.lng();
          if (lat && lng && onLocationChange) {
            onLocationChange({
              latitude: lat,
              longitude: lng,
              address: place.formattedAddress || place.displayName || 'Searched Point'
            });
            map.setZoom(14);
          }
        } else {
          setLocationError('Address not found. Try entering a city or street name.');
        }
      })
      .catch((err) => {
        console.error('Location search error:', err);
        setLocationError('Could not process location search request.');
      })
      .finally(() => {
        setIsSearchingLocation(false);
      });
  };

  // Perform browser standard Geolocation with fallback visual alerts
  const handleLocateMe = () => {
    setIsSearchingLocation(true);
    setLocationError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const liveLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: 'My Location coordinates'
          };
          if (onLocationChange) {
            onLocationChange(liveLoc);
          }
          if (!isDemoMode && map) {
            map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            map.setZoom(15);
          }
          setIsSearchingLocation(false);
        },
        (err) => {
          console.warn('Geolocation issue:', err);
          if (isDemoMode) {
            // Offline/demo fallback if browser pop-up is closed or blocked
            if (onLocationChange) {
              onLocationChange({
                latitude: 13.7563,
                longitude: 100.5018,
                address: 'Central Station Simulator Hub (GPS Fallback)'
              });
            }
          } else {
            setLocationError('Could not get GPS. Please search your address manually.');
          }
          setIsSearchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      if (isDemoMode && onLocationChange) {
        onLocationChange({
          latitude: 13.7563,
          longitude: 100.5018,
          address: 'Central Station Simulator Hub'
        });
      } else {
        setLocationError('Geolocation not supported by browser.');
      }
      setIsSearchingLocation(false);
    }
  };

  // Click Map viewport to drop Emergency Dispatch Pin manually
  const handleMapClick = (e: any) => {
    if (activeTab === 'intake' && onLocationChange) {
      const latLng = e.detail?.latLng || e.latLng;
      if (latLng) {
        const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
        const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
        onLocationChange({
          latitude: lat,
          longitude: lng,
          address: `Pinned Spot (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        });
      }
    }
  };

  // Click handler wrapper for simulated SVG radar mode
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTab === 'intake' && onLocationChange) {
      const rect = e.currentTarget.getBoundingClientRect();
      // Translate screen pixel click coordinates to SVG viewBox coordinate system (0,0 to 800,320)
      const clickX = ((e.clientX - rect.left) / rect.width) * 800;
      const clickY = ((e.clientY - rect.top) / rect.height) * 320;
      
      const scaleY = 5500;
      const scaleX = 5500 * Math.cos(centerLat * Math.PI / 180);
      
      const dx = clickX - 400; // Center coordinate of width 800
      const dy = clickY - 160; // Center coordinate of height 320
      
      const clickLng = centerLng + (dx / scaleX);
      const clickLat = centerLat - (dy / scaleY);
      
      onLocationChange({
        latitude: clickLat,
        longitude: clickLng,
        address: `Pinned spot (${clickLat.toFixed(4)}, ${clickLng.toFixed(4)})`
      });
    }
  };

  const centerLat = patientLocation.latitude || 13.7563;
  const centerLng = patientLocation.longitude || 100.5018;
  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);

  // SVG Relative positioning scale function
  const getSvgCoords = (lat: number, lng: number) => {
    const scaleY = 5500;
    const scaleX = 5500 * Math.cos(centerLat * Math.PI / 180);
    
    const dx = (lng - centerLng) * scaleX;
    const dy = (centerLat - lat) * scaleY;
    
    return {
      x: 400 + dx,
      y: 160 + dy
    };
  };

  return (
    <div className="w-full bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Dynamic Header */}
      <div className="p-4 border-b border-border bg-theme-bg/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-ink">
            {isDemoMode ? 'CareLink Radar System (Offline Simulation)' : 'Google Live Location Bridge'}
          </span>
        </div>
        {(isScanning || isSearchingLocation) && (
          <span className="text-[10px] bg-accent/10 text-accent font-bold px-2 py-0.5 rounded animate-pulse">
            SCANNING AREA...
          </span>
        )}
      </div>

      {/* Embedded Search and Pinning Panel */}
      <div className="p-3 border-b border-border bg-theme-bg/10 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search address, state, or landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full text-xs bg-white border border-border rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-accent font-medium text-ink"
            />
            {isSearchingLocation && (
              <div className="absolute right-3 top-2.5 w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-3.5 py-2.5 bg-ink text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors hover:bg-ink/90 shrink-0 flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            Search
          </button>
          
          <button
            onClick={handleLocateMe}
            title="Locate Me"
            className="px-3 py-2 bg-white border border-border hover:border-accent text-accent rounded-xl transition-colors flex items-center justify-center shrink-0 shadow-sm"
          >
            <MapPin className="w-4 h-4 mr-1 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Locate</span>
          </button>
        </div>

        {locationError && (
          <div className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">
            ⚠️ {locationError}
          </div>
        )}
        
        {/* Help label */}
        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold px-1 gap-4">
          <span className="truncate">Type location above or click map viewport to set dispatch coordinate</span>
          {patientLocation.address && (
            <span className="text-emerald-700 truncate max-w-[200px] shrink-0 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded">
              📍 {patientLocation.address}
            </span>
          )}
        </div>
      </div>

      {/* Map Rendering Container */}
      <div className="relative w-full h-[320.5px]">
        {isDemoMode ? (
          <svg 
            className="w-full h-full bg-zinc-950 relative overflow-hidden select-none cursor-crosshair"
            viewBox="0 0 800 320"
            onClick={handleSvgClick}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(16, 185, 129, 0.05)" strokeWidth="1" />
              </pattern>
            </defs>
            
            {/* Base Grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Concentric radar range rings */}
            <circle cx="400" cy="160" r="50" fill="none" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" />
            <circle cx="400" cy="160" r="110" fill="none" stroke="rgba(16, 185, 129, 0.07)" strokeWidth="1" />
            <circle cx="400" cy="160" r="180" fill="none" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" strokeWidth="1" />
            
            {/* Coordinate crosshairs */}
            <line x1="400" y1="0" x2="400" y2="320" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" />
            <line x1="0" y1="160" x2="800" y2="160" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" />
            
            {/* Sweeping radar scanner laser line */}
            <line 
              x1="400" 
              y1="160" 
              x2={400 + 350 * Math.cos(radarAngle * Math.PI / 180)} 
              y2={160 + 350 * Math.sin(radarAngle * Math.PI / 180)} 
              stroke="rgba(16, 185, 129, 0.15)" 
              strokeWidth="2.5"
            />
            
            {/* Grid annotations */}
            <text x="410" y="50" fill="rgba(16, 185, 129, 0.35)" fontSize="7" className="font-mono">RANGE: 10 KM</text>
            <text x="410" y="100" fill="rgba(16, 185, 129, 0.35)" fontSize="7" className="font-mono">RANGE: 5 KM</text>
            <text x="410" y="150" fill="rgba(16, 185, 129, 0.35)" fontSize="7" className="font-mono">RANGE: 1 KM</text>
            
            {/* Patient Incident Beacon */}
            {patientLocation.latitude !== 0 && (
              <g transform="translate(400, 160)">
                <circle r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping opacity-70" />
                <circle r="7" fill="#ef4444" className="animate-pulse" />
                <circle r="3.5" fill="#ffffff" />
                
                <rect x="-35" y="-30" width="70" height="15" rx="3.5" fill="rgba(239, 68, 68, 0.95)" />
                <text y="-20" textAnchor="middle" fill="#ffffff" fontSize="7" className="font-sans font-black tracking-widest uppercase">PATIENT</text>
              </g>
            )}

            {/* Hospital simulated nodes */}
            {hospitals.map((hospital) => {
              const coords = getSvgCoords(hospital.location.latitude, hospital.location.longitude);
              const isSelected = hospital.id === selectedHospitalId;
              const isHovered = hoverInfoId === hospital.id;

              return (
                <g 
                  key={hospital.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectHospital) {
                      onSelectHospital(hospital.id);
                    }
                  }}
                  onMouseEnter={() => setHoverInfoId(hospital.id)}
                  onMouseLeave={() => setHoverInfoId(null)}
                >
                  {/* Transit path connecting selected hospital */}
                  {isSelected && (
                    <line 
                      x1="400" 
                      y1="160" 
                      x2={coords.x} 
                      y2={coords.y} 
                      stroke="#10b981" 
                      strokeWidth="2" 
                      strokeDasharray="4 3" 
                    />
                  )}

                  {/* Outer aura for selected or hovered hospital */}
                  {(isSelected || isHovered) && (
                    <circle 
                      cx={coords.x} 
                      cy={coords.y} 
                      r="12" 
                      fill="none" 
                      stroke={isSelected ? "#10b981" : "#3b82f6"} 
                      strokeWidth="1.5" 
                      className="animate-pulse"
                    />
                  )}

                  {/* Hospital Node Dot */}
                  <circle 
                    cx={coords.x} 
                    cy={coords.y} 
                    r={isSelected ? "7" : "5.5"} 
                    fill={isSelected ? "#10b981" : "#3b82f6"} 
                    stroke="#ffffff" 
                    strokeWidth="1.5"
                  />

                  {/* Label tag above pin */}
                  <text 
                    x={coords.x} 
                    y={coords.y - 12} 
                    textAnchor="middle" 
                    fill={isSelected ? "#10b981" : "#94a3b8"} 
                    fontSize="7.5" 
                    className="font-mono font-black uppercase drop-shadow-md tracking-wider pointer-events-none"
                  >
                    {hospital.name.split(' ').slice(0, 2).join(' ')}
                  </text>
                </g>
              );
            })}

            {/* SVG Interactive popover/tooltip overlay */}
            {hoverInfoId && (() => {
              const hoverHosp = hospitals.find(h => h.id === hoverInfoId);
              if (!hoverHosp) return null;
              const coords = getSvgCoords(hoverHosp.location.latitude, hoverHosp.location.longitude);
              
              const tX = coords.x > 400 ? coords.x - 200 : coords.x + 15;
              const tY = coords.y > 160 ? coords.y - 110 : coords.y + 15;
              
              return (
                <g transform={`translate(${tX}, ${tY})`} className="pointer-events-none transition-all duration-200">
                  <rect width="185" height="95" rx="8" fill="rgba(9, 9, 11, 0.95)" stroke="#3b82f6" strokeWidth="1" />
                  <text x="12" y="20" fill="#ffffff" fontSize="9.5" className="font-sans font-black tracking-wide">{hoverHosp.name}</text>
                  <text x="12" y="32" fill="#71717a" fontSize="7.5" className="font-mono font-bold truncate max-w-[160px]">{hoverHosp.location.address}</text>
                  
                  <line x1="12" y1="42" x2="173" y2="42" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text x="12" y="53" fill="#3b82f6" fontSize="7.5" className="font-mono font-extrabold tracking-wider">CLINICAL READINESS:</text>
                  
                  <circle cx="17" cy="65" r="3" fill={hoverHosp.readiness.icuBeds ? "#10b981" : "#ef4444"} />
                  <text x="25" y="68" fill="#f4f4f5" fontSize="7.5" className="font-sans font-bold">ICU {hoverHosp.readiness.icuBeds ? 'OK' : 'BUSY'}</text>
                  
                  <circle cx="95" cy="65" r="3" fill={hoverHosp.readiness.otReady ? "#10b981" : "#ef4444"} />
                  <text x="103" y="68" fill="#f4f4f5" fontSize="7.5" className="font-sans font-bold">O.R. {hoverHosp.readiness.otReady ? 'READY' : 'BUSY'}</text>
                  
                  <circle cx="17" cy="80" r="3" fill={hoverHosp.readiness.traumaTeam ? "#10b981" : "#ef4444"} />
                  <text x="25" y="83" fill="#f4f4f5" fontSize="7.5" className="font-sans font-bold">TRAUMA {hoverHosp.readiness.traumaTeam ? 'ACTIVE' : 'OFF'}</text>
                  
                  <circle cx="95" cy="80" r="3" fill={hoverHosp.readiness.ventilators ? "#10b981" : "#ef4444"} />
                  <text x="103" y="83" fill="#f4f4f5" fontSize="7.5" className="font-sans font-bold">VENTILATOR</text>
                </g>
              );
            })()}

            {/* Offline notification badge */}
            <rect x="12" y="12" width="220" height="18" rx="4" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" />
            <circle cx="22" cy="21" r="3" fill="#10b981" className="animate-pulse" />
            <text x="32" y="24" fill="#10b981" fontSize="7" className="font-mono font-black tracking-widest uppercase">OFFLINE DIGITAL DESK ACTIVE</text>
          </svg>
        ) : (
          <Map
            defaultCenter={{ lat: centerLat, lng: centerLng }}
            defaultZoom={12}
            mapId="DEMO_MAP_ID"
            gestureHandling="cooperative"
            disableDefaultUI={false}
            onClick={handleMapClick}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Sync Nearby Genuine Hospitals */}
            {!isDemoMode && activeTab === 'intake' && onHospitalsLoaded && (
              <PlaceSearchAndSync 
                patientLocation={patientLocation} 
                onHospitalsLoaded={onHospitalsLoaded}
                setLoading={setIsScanning}
              />
            )}

            {/* Patient Incident Marker */}
            {!isDemoMode && patientLocation.latitude !== 0 && (
              <AdvancedMarker position={{ lat: patientLocation.latitude, lng: patientLocation.longitude }}>
                <Pin background="#ef4444" glyphColor="#fff" borderColor="#b91c1c" scale={1.2}>
                  <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-45 pointer-events-none" />
                </Pin>
              </AdvancedMarker>
            )}

            {/* Hospital Markers */}
            {!isDemoMode && hospitals.map((hospital) => {
              if (!hospital.location.latitude) return null;
              const isSelected = hospital.id === selectedHospitalId;
              const isInfoOpen = activeInfoWindowId === hospital.id;

              return (
                <AdvancedMarker 
                  key={hospital.id} 
                  position={{ lat: hospital.location.latitude, lng: hospital.location.longitude }}
                  onClick={() => setActiveInfoWindowId(isInfoOpen ? null : hospital.id)}
                >
                  <Pin 
                    background={isSelected ? '#10b981' : '#4f46e5'} 
                    glyphColor="#fff" 
                    borderColor={isSelected ? '#047857' : '#3730a3'}
                  />
                </AdvancedMarker>
              );
            })}

            {/* Selected Hospital InfoWindow */}
            {!isDemoMode && hospitals.map((hospital) => {
              if (activeInfoWindowId !== hospital.id) return null;
              
              return (
                <InfoWindow 
                  key={`info-${hospital.id}`}
                  position={{ lat: hospital.location.latitude, lng: hospital.location.longitude }}
                  onCloseClick={() => setActiveInfoWindowId(null)}
                >
                  <div className="p-1 min-w-[180px] max-w-[240px] space-y-2">
                    <h4 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-1 mr-4">
                      {hospital.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {hospital.location.address || 'Detected Emergency Point'}
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-[9px] font-bold text-slate-700">
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${hospital.readiness.icuBeds ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        ICU BEDS
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${hospital.readiness.otReady ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        OR READY
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${hospital.readiness.traumaTeam ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        TRAUMA
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${hospital.readiness.ventilators ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        VENTILATOR
                      </div>
                    </div>

                    {onSelectHospital && activeTab !== 'transport' && (
                      <button
                        onClick={() => {
                          onSelectHospital(hospital.id);
                          setActiveInfoWindowId(null);
                        }}
                        className="w-full mt-2 py-1 text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors text-center"
                      >
                        Select & Route
                      </button>
                    )}
                  </div>
                </InfoWindow>
              );
            })}

            {/* Live Transit Route Display */}
            {!isDemoMode && patientLocation.latitude !== 0 && selectedHospital?.location?.latitude && (
              <LiveRouteDisplay
                origin={{ lat: patientLocation.latitude, lng: patientLocation.longitude }}
                destination={{ lat: selectedHospital.location.latitude, lng: selectedHospital.location.longitude }}
              />
            )}
          </Map>
        )}
      </div>
    </div>
  );
};

export const MainMap: React.FC<MainMapProps> = ({
  apiKey,
  patientLocation,
  hospitals,
  selectedHospitalId,
  onSelectHospital,
  onHospitalsLoaded,
  activeTab,
  onLocationChange
}) => {
  const isDemoMode = !apiKey || 
                     apiKey.includes('FakeKey') || 
                     apiKey.includes('YOUR_API') || 
                     apiKey.includes('YOUR_GOOGLE_MAPS') ||
                     apiKey.includes('BypassedKey');

  if (isDemoMode) {
    return (
      <MainMapInner
        patientLocation={patientLocation}
        hospitals={hospitals}
        selectedHospitalId={selectedHospitalId}
        onSelectHospital={onSelectHospital}
        onHospitalsLoaded={onHospitalsLoaded}
        activeTab={activeTab}
        onLocationChange={onLocationChange}
        isDemoMode={true}
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} version="weekly">
      <MainMapInner
        patientLocation={patientLocation}
        hospitals={hospitals}
        selectedHospitalId={selectedHospitalId}
        onSelectHospital={onSelectHospital}
        onHospitalsLoaded={onHospitalsLoaded}
        activeTab={activeTab}
        onLocationChange={onLocationChange}
        isDemoMode={false}
      />
    </APIProvider>
  );
};
