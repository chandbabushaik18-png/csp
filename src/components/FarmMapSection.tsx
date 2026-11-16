import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Search,
  Navigation,
  Trash2,
  Check,
  Save,
  Square,
  AlertCircle,
  Undo2,
  Layers,
} from 'lucide-react';
import { FarmProfile, Language, DataProvenance } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface FarmMapSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  savedFarms: FarmProfile[];
  onSelectFarm: (farm: FarmProfile) => void;
  onSaveFarm: (farm: FarmProfile) => void;
}

type MapBaseMode = 'satellite' | 'streets';

export const FarmMapSection: React.FC<FarmMapSectionProps> = ({
  currentLang,
  farm,
  savedFarms,
  onSelectFarm,
  onSaveFarm,
}) => {
  const t = translations[currentLang];
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapBaseMode>('satellite');
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>(farm.boundary || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [farmNameInput, setFarmNameInput] = useState(farm.name);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(farm.gpsAccuracyMeters || null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const tileUrls = {
    satellite:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  const calculatePolygonArea = (
    coords: [number, number][]
  ): { acres: number; hectares: number; sqMeters: number } => {
    if (coords.length < 3) return { acres: 0, hectares: 0, sqMeters: 0 };
    const radius = 6378137;
    let area = 0;

    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];
      const lat1 = (p1[0] * Math.PI) / 180;
      const lat2 = (p2[0] * Math.PI) / 180;
      const lon1 = (p1[1] * Math.PI) / 180;
      const lon2 = (p2[1] * Math.PI) / 180;
      area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    const sqMeters = Math.abs((area * radius * radius) / 2);
    const hectares = sqMeters / 10000;
    const acres = sqMeters / 4046.85642;
    return {
      acres: Number(acres.toFixed(2)),
      hectares: Number(hectares.toFixed(2)),
      sqMeters: Math.round(sqMeters),
    };
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = farm.center || [16.3067, 80.4365];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseLayer = L.tileLayer(tileUrls.satellite, {
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = baseLayer;

    markersGroupRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setDrawnPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const baseUrl = activeLayer === 'streets' ? tileUrls.streets : tileUrls.satellite;
    const newLayer = L.tileLayer(baseUrl, {
      attribution: 'Map & Satellite Data &copy; OpenStreetMap, Esri, Maxar',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [activeLayer]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    if (drawnPoints.length > 0) {
      if (drawnPoints.length >= 3) {
        const poly = L.polygon(drawnPoints, {
          color: '#174C36',
          weight: 2.5,
          fillColor: '#4D966B',
          fillOpacity: 0.28,
        }).addTo(map);
        polygonLayerRef.current = poly;
      }

      drawnPoints.forEach((pt, index) => {
        const vertexIcon = L.divIcon({
          className: 'custom-vertex-pin',
          html: `<div style="background-color: #174C36; color: white; border: 2px solid #ffffff; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.35);">${
            index + 1
          }</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        if (markersGroupRef.current) {
          L.marker(pt, { icon: vertexIcon }).addTo(markersGroupRef.current);
        }
      });
    }
  }, [drawnPoints]);

  useEffect(() => {
    if (!mapInstanceRef.current || !farm.center) return;
    mapInstanceRef.current.setView(farm.center, 15);
    setDrawnPoints(farm.boundary || []);
    setFarmNameInput(farm.name);
  }, [farm.id, farm.center]);

  const handleGetGPS = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        setGpsAccuracy(accuracy);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);

          if (gpsAccuracyCircleRef.current) {
            mapInstanceRef.current.removeLayer(gpsAccuracyCircleRef.current);
          }

          const circle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.15,
            weight: 1.5,
          }).addTo(mapInstanceRef.current);
          gpsAccuracyCircleRef.current = circle;
        }

        try {
          const res = await safeFetchJson<any>(`/api/geocode/reverse?lat=${lat}&lon=${lng}`);
          if (res.ok && res.data) {
            const data = res.data;
            const gpsProvenance: DataProvenance = {
              integrityState: 'LIVE_DATA',
              classification: 'REAL_GPS_DATA',
              source: `Device Geolocation Hardware (±${accuracy}m accuracy)`,
              timestamp: new Date().toISOString(),
              isRealTime: true,
              locationLabel: `${data.village || 'GPS Location'}, ${data.district || ''}`,
              notes: 'Obtained via W3C Geolocation API.',
            };

            onSelectFarm({
              ...farm,
              center: [lat, lng],
              gpsAccuracyMeters: accuracy,
              village: data.village || 'GPS Location',
              mandal: data.mandal || '',
              district: data.district || farm.district,
              state: data.state || farm.state,
              fullAddress: data.displayName,
              lastUpdated: new Date().toISOString(),
              provenance: gpsProvenance,
            });
          } else {
            onSelectFarm({
              ...farm,
              center: [lat, lng],
              gpsAccuracyMeters: accuracy,
              lastUpdated: new Date().toISOString(),
            });
          }
        } catch {
          onSelectFarm({
            ...farm,
            center: [lat, lng],
            gpsAccuracyMeters: accuracy,
            lastUpdated: new Date().toISOString(),
          });
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Could not access GPS.';
        if (err.code === 1) {
          msg = 'GPS permission was denied. Click on the map or search your village below.';
        } else if (err.code === 2) {
          msg = 'GPS position unavailable. Ensure location services are enabled.';
        } else if (err.code === 3) {
          msg = 'GPS request timed out. Please retry or click on the map.';
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const resp = await safeFetchJson<any>(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`);
      const data = resp.data;
      if (resp.ok && data?.results) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setSearchError('No matching village or locality found in OpenStreetMap.');
        }
      } else {
        setSearchError(data?.error || 'Location search currently unavailable.');
      }
    } catch {
      setSearchError('Network error while querying OpenStreetMap Nominatim.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = result.lat;
    const lon = result.lon;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 16);
    }
    onSelectFarm({
      ...farm,
      center: [lat, lon],
      name: `${result.village || result.district || 'Selected'} Plot`,
      village: result.village || result.displayName?.split(',')[0] || '',
      mandal: result.mandal || '',
      district: result.district || farm.district,
      state: result.state || farm.state,
      fullAddress: result.displayName,
      lastUpdated: new Date().toISOString(),
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: 'OpenStreetMap Nominatim Geocoding',
        timestamp: new Date().toISOString(),
        isRealTime: true,
        locationLabel: `${result.village || ''}, ${result.district || ''}`,
      },
    });
    setSearchResults([]);
  };

  const handleUndoPoint = () => {
    setDrawnPoints((prev) => prev.slice(0, prev.length - 1));
  };

  const handleClearPoints = () => {
    setDrawnPoints([]);
    if (polygonLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(polygonLayerRef.current);
    }
  };

  const handleSaveFarmBoundary = () => {
    const area = calculatePolygonArea(drawnPoints);
    const updated: FarmProfile = {
      ...farm,
      name: farmNameInput || farm.name,
      boundary: drawnPoints,
      areaAcres: area.acres > 0 ? area.acres : farm.areaAcres,
      areaHectares: area.hectares > 0 ? area.hectares : farm.areaHectares,
      lastUpdated: new Date().toISOString(),
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'CALCULATED_DATA',
        source: 'WGS84 Geodesic Spherical Excess Polygon Calculation',
        timestamp: new Date().toISOString(),
        isRealTime: true,
        locationLabel: `${farm.village || farm.district}`,
        methodology: 'Spherical excess polygon area integration over WGS84 authalic sphere radius (6378137m).',
      },
    };
    onSaveFarm(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const calculatedArea = calculatePolygonArea(drawnPoints);

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Controls Glass Card */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                Geospatial Satellite GIS
              </span>
              {farm.provenance && <DataProvenanceBadge provenance={farm.provenance} />}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.navLocation}
            </h2>
            <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
              Detect device GPS, search your village via OpenStreetMap Nominatim, or click polygon vertices on high-resolution imagery to compute geodesic acreage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleGetGPS}
              disabled={gpsLoading}
              className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[12px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? 'Acquiring GPS...' : 'Detect My Current Location'}</span>
            </button>

            {drawnPoints.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleUndoPoint}
                  className="px-3.5 py-2.5 bg-white/80 hover:bg-white border border-[#174C36]/15 text-[#202820] rounded-[12px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearPoints}
                  className="px-3.5 py-2.5 bg-white/80 hover:bg-white border border-[#174C36]/15 text-[#202820] rounded-[12px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#858D86]" />
                  <span>{t.btnClearBoundary}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {gpsError && (
          <div className="mt-4 p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>GPS Notice:</strong> {gpsError}
            </div>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              className="text-amber-800 font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search & Saved Plot Switcher */}
        <div className="mt-6 pt-5 border-t border-[#174C36]/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative max-w-xl">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#858D86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search village, mandal, or town..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white/85 border border-[#174C36]/15 rounded-xl text-xs font-medium text-[#202820] focus:bg-white focus:outline-none focus:border-[#174C36]"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2.5 bg-[#4D966B] hover:bg-[#174C36] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError && <div className="text-[11px] text-amber-800 mt-1.5">{searchError}</div>}

            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 glass-panel-elevated rounded-2xl p-1.5 z-40 max-h-56 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#DDEDE2]/60 text-[#202820] flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate pr-2 font-medium">{res.displayName}</span>
                    <span className="text-[10px] text-[#858D86] shrink-0 font-mono">
                      {res.lat.toFixed(3)}, {res.lon.toFixed(3)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>

          {savedFarms.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#858D86] font-medium whitespace-nowrap">Saved Plots:</span>
              <select
                value={farm.id}
                onChange={(e) => {
                  const target = savedFarms.find((f) => f.id === e.target.value);
                  if (target) onSelectFarm(target);
                }}
                className="bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2 font-semibold text-[#202820] focus:outline-none text-xs"
              >
                {savedFarms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.areaAcres} Ac - {f.village || f.district})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map Container */}
      <div className="relative rounded-[26px] overflow-hidden border border-white/80 shadow-[0_20px_50px_-16px_rgba(23,76,54,0.16)] bg-[#142017]">
        {/* Base Map Layer Switcher */}
        <div className="absolute top-4 right-4 z-30 glass-panel-elevated rounded-[16px] p-1.5 flex items-center gap-1 text-xs">
          <span className="hidden md:inline-flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
            <Layers className="w-3 h-3" />
            <span>Base</span>
          </span>
          {(
            [
              { id: 'satellite', label: 'Satellite Imagery' },
              { id: 'streets', label: 'Street Map' },
            ] as const
          ).map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => setActiveLayer(layer.id)}
              className={`px-3 py-1.5 rounded-[11px] font-semibold transition-all cursor-pointer ${
                activeLayer === layer.id
                  ? 'bg-[#174C36] text-white shadow-xs'
                  : 'text-[#202820] hover:bg-white/60'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {/* Drawing Hint Pill */}
        <div className="absolute top-4 left-4 z-30 glass-dark-overlay text-white px-3.5 py-2 rounded-[14px] text-xs font-medium flex items-center gap-2 max-w-md">
          <Square className="w-3.5 h-3.5 text-[#DDEDE2] shrink-0" />
          <span className="truncate">
            Click map to plot boundary ({drawnPoints.length} vertices)
          </span>
          {gpsAccuracy && (
            <span className="hidden sm:inline bg-white/15 px-2 py-0.5 rounded-lg text-[10px] font-mono text-[#DDEDE2]">
              ±{gpsAccuracy}m GPS
            </span>
          )}
        </div>

        <div ref={mapContainerRef} className="w-full h-[520px] sm:h-[580px] z-10" />

        {/* Area Calculation Panel */}
        <div className="absolute bottom-4 left-4 z-30 glass-panel-elevated rounded-[20px] p-4 text-xs space-y-2 max-w-sm">
          <div className="flex items-center justify-between text-[#858D86] font-semibold uppercase tracking-wider text-[10px]">
            <span>Calculated Farm Area</span>
            <span className="text-[#174C36] font-bold font-mono">WGS84 Geodesic</span>
          </div>

          <div className="flex items-baseline gap-2.5">
            <div className="text-2xl font-extrabold text-[#174C36] font-display tabular-nums">
              {calculatedArea.acres > 0 ? calculatedArea.acres : farm.areaAcres} Acres
            </div>
            <div className="text-[#858D86] font-mono">
              ({calculatedArea.hectares > 0 ? calculatedArea.hectares : farm.areaHectares} Ha)
            </div>
          </div>

          <div className="text-[11px] text-[#5D665E] border-t border-[#174C36]/10 pt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#4D966B] shrink-0" />
              <span className="truncate">
                {farm.village ? `${farm.village}, ` : ''}
                {farm.district}
              </span>
            </span>
            <span className="font-mono text-[#858D86] text-[10px] shrink-0">
              {farm.center[0].toFixed(4)}, {farm.center[1].toFixed(4)}
            </span>
          </div>
        </div>

        {/* Save Farmland Dock */}
        <div className="absolute bottom-4 right-4 z-30 glass-panel-elevated rounded-[18px] p-2.5 flex items-center gap-2 text-xs">
          <input
            type="text"
            value={farmNameInput}
            onChange={(e) => setFarmNameInput(e.target.value)}
            placeholder="Plot name..."
            className="bg-white/90 border border-[#174C36]/15 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#202820] focus:outline-none w-40 sm:w-48"
          />
          <button
            type="button"
            onClick={handleSaveFarmBoundary}
            className="px-4 py-2 bg-[#174C36] hover:bg-[#113A29] text-white rounded-xl font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-[#DDEDE2]" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Saved' : 'Save Parcel'}</span>
          </button>
        </div>
      </div>

      {/* Parcel Metadata Strip */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-[#202820] font-display">
            Active Field Parameters
          </h3>
          <span className="text-xs font-mono text-[#858D86]">
            {farm.center[0].toFixed(5)}°N, {farm.center[1].toFixed(5)}°E
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-white/75 rounded-[16px] border border-white">
            <div className="text-[#858D86]">Selected Location</div>
            <div className="text-sm font-bold text-[#202820] mt-1">{farm.village || 'Coordinates Set'}</div>
            <div className="text-[#5D665E] mt-0.5">
              {farm.district}, {farm.state}
            </div>
          </div>

          <div className="p-4 bg-white/75 rounded-[16px] border border-white">
            <div className="text-[#858D86]">Cultivated Crop</div>
            <div className="text-sm font-bold text-[#174C36] mt-1">{farm.currentCrop}</div>
            <div className="text-[#5D665E] mt-0.5">{farm.cropStage}</div>
          </div>

          <div className="p-4 bg-white/75 rounded-[16px] border border-white">
            <div className="text-[#858D86]">Soil Profile</div>
            <div className="text-sm font-bold text-[#202820] mt-1 truncate">{farm.soilType}</div>
            <div className="text-[#5D665E] mt-0.5 font-mono">pH {farm.soilPh}</div>
          </div>

          <div className="p-4 bg-white/75 rounded-[16px] border border-white">
            <div className="text-[#858D86]">Water Infrastructure</div>
            <div className="text-sm font-bold text-[#202820] mt-1">{farm.irrigationMethod}</div>
            <div className="text-[#5D665E] mt-0.5">Source: {farm.waterSource}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
