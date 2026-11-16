import React, { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import {
  Satellite,
  Camera,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Info,
  AlertTriangle,
  MapPin,
  Calendar,
  Layers,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { FarmProfile, GeeStatusResponse, Language, SatelliteAnalysis, SentinelScene } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface SatelliteIntelligenceSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  onNavigateLocation: () => void;
  onAnalysisUpdate?: (analysis: SatelliteAnalysis) => void;
  onOpenDoctor: () => void;
}

type OverlayMode = 'ndvi' | 'ndwi' | 'evi' | 'trueColor' | 'none';

function getDefaultDates() {
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 86400000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export const SatelliteIntelligenceSection: React.FC<SatelliteIntelligenceSectionProps> = ({
  currentLang,
  farm,
  onNavigateLocation,
  onAnalysisUpdate,
  onOpenDoctor,
}) => {
  const t = translations[currentLang];
  const initialDates = getDefaultDates();

  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [maxCloudCover, setMaxCloudCover] = useState<number>(20);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [satelliteData, setSatelliteData] = useState<SatelliteAnalysis | null>(null);
  const [availableScenes, setAvailableScenes] = useState<SentinelScene[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [geeStatus, setGeeStatus] = useState<GeeStatusResponse | null>(null);
  const [checkingGee, setCheckingGee] = useState(false);

  const [overlayMode, setOverlayMode] = useState<OverlayMode>('ndvi');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.78);
  const [showPipelineInfo, setShowPipelineInfo] = useState(false);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const boundaryLayerRef = useRef<L.Layer | null>(null);
  const geeTileLayerRef = useRef<L.TileLayer | null>(null);

  const checkGeeConnection = useCallback(async () => {
    setCheckingGee(true);
    try {
      const res = await safeFetchJson<GeeStatusResponse>('/api/satellite/gee-status');
      if (res.ok && res.data) {
        setGeeStatus(res.data);
      }
    } catch (e) {
      console.warn('Could not check GEE status:', e);
    } finally {
      setCheckingGee(false);
    }
  }, []);

  const runSatelliteAnalysis = useCallback(
    async (sceneOverride?: string | null) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const analyzeRes = await safeFetchJson<SatelliteAnalysis>('/api/satellite/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            farmId: farm.id,
            center: farm.center,
            polygon: farm.boundary,
            areaAcres: farm.areaAcres,
            crop: farm.currentCrop,
            startDate,
            endDate,
            maxCloudCover,
            selectedSceneId: sceneOverride || undefined,
          }),
        });

        const analyzeJson = analyzeRes.data;

        if (!analyzeRes.ok && analyzeJson?.integrityState === 'UNAVAILABLE') {
          setErrorMsg(
            (analyzeJson as any).error ||
              analyzeJson.message ||
              'Sentinel-2 satellite service is currently unavailable.'
          );
          if (analyzeJson) setSatelliteData(analyzeJson);
          setAvailableScenes([]);
          return;
        }

        if (analyzeJson) {
          setSatelliteData(analyzeJson);
          onAnalysisUpdate?.(analyzeJson);
          const scenes = analyzeJson.recentScenes || [];
          setAvailableScenes(scenes);
          if (!sceneOverride) {
            setSelectedSceneId(analyzeJson.sceneId || scenes[0]?.id || null);
          }
        } else if (!analyzeRes.ok) {
          setErrorMsg('Sentinel-2 satellite service returned an unexpected response.');
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Network error while querying Sentinel-2 imagery.');
      } finally {
        setLoading(false);
      }
    },
    [farm.id, farm.center, farm.boundary, farm.areaAcres, farm.currentCrop, startDate, endDate, maxCloudCover, onAnalysisUpdate]
  );

  useEffect(() => {
    checkGeeConnection();
    runSatelliteAnalysis(null);
  }, [farm.id, farm.center[0], farm.center[1], farm.boundary.length]);

  // Initialize interactive Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: farm.center,
      zoom: 16,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Base Imagery &copy; Esri, Maxar | Sentinel-2 &copy; Copernicus/ESA via Google Earth Engine',
        maxZoom: 19,
      }
    ).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      boundaryLayerRef.current = null;
      geeTileLayerRef.current = null;
    };
  }, []);

  // Render farm polygon boundary or parcel center marker on Leaflet map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    if (farm.boundary && farm.boundary.length >= 3) {
      const poly = L.polygon(farm.boundary, {
        color: '#ffffff',
        weight: 2.5,
        dashArray: '6 4',
        fillColor: '#4D966B',
        fillOpacity: satelliteData?.tileUrls ? 0.06 : 0.22,
      }).addTo(map);
      boundaryLayerRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [36, 36], maxZoom: 17 });
    } else {
      const radiusMeters = Math.max(
        100,
        Math.round(Math.sqrt(((farm.areaAcres || 1) * 4046.85642) / Math.PI))
      );
      const circle = L.circle(farm.center, {
        radius: radiusMeters,
        color: '#ffffff',
        weight: 2,
        dashArray: '5 5',
        fillColor: '#4D966B',
        fillOpacity: satelliteData?.tileUrls ? 0.06 : 0.2,
      }).addTo(map);
      boundaryLayerRef.current = circle;
      map.setView(farm.center, 16);
    }
  }, [farm.center, farm.boundary, farm.areaAcres, satelliteData?.tileUrls]);

  // Apply or update GEE raster TileLayer (NDVI, NDWI, EVI, or True Color)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geeTileLayerRef.current) {
      map.removeLayer(geeTileLayerRef.current);
      geeTileLayerRef.current = null;
    }

    if (!satelliteData?.tileUrls || overlayMode === 'none') return;

    const url =
      overlayMode === 'ndvi'
        ? satelliteData.tileUrls.ndvi
        : overlayMode === 'ndwi'
        ? satelliteData.tileUrls.ndwi
        : overlayMode === 'evi'
        ? satelliteData.tileUrls.evi
        : satelliteData.tileUrls.trueColor;

    if (url) {
      const layer = L.tileLayer(url, {
        opacity: overlayOpacity,
        maxZoom: 19,
      }).addTo(map);
      geeTileLayerRef.current = layer;
    }
  }, [satelliteData?.tileUrls, overlayMode, overlayOpacity]);

  const activeScene =
    availableScenes.find((s) => s.id === (selectedSceneId || satelliteData?.sceneId)) || null;
  const activeSceneId = activeScene?.id || satelliteData?.sceneId || null;
  const activeDate = activeScene?.acquisitionDate || satelliteData?.acquisitionDate || null;
  const activeCloud =
    activeScene?.cloudCoveragePercent ?? satelliteData?.cloudCoveragePercent ?? null;
  const activeSun = activeScene?.sunElevationDeg ?? satelliteData?.sunElevationDeg ?? null;
  const activePreviewUrl = activeScene?.previewUrl || satelliteData?.previewUrl || null;
  const hasPolygon = Boolean(farm.boundary && farm.boundary.length >= 3);
  const effectiveGeeStatus =
    geeStatus?.status || satelliteData?.geeStatus || 'CREDENTIALS_MISSING';
  const geeReady = Boolean(
    effectiveGeeStatus === 'READY' &&
      (satelliteData ? satelliteData.pixelAnalysisSupported : true)
  );

  const trendPoints = satelliteData?.historicalTrend || [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header + 5-Step Workflow & Date/Cloud Controls */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                COPERNICUS/S2_SR_HARMONIZED · Google Earth Engine
              </span>

              {/* Explicit Live GEE Connection Badge */}
              <button
                type="button"
                onClick={checkGeeConnection}
                disabled={checkingGee}
                title={
                  geeStatus?.message ||
                  geeStatus?.error ||
                  'Click to verify live Google Earth Engine connection'
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  effectiveGeeStatus === 'READY'
                    ? 'bg-[#DDEDE2] text-[#174C36] border-[#4D966B]/40'
                    : effectiveGeeStatus === 'AUTH_OR_API_ERROR'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white/85 text-[#5D665E] border-[#858D86]/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    checkingGee
                      ? 'bg-[#4D966B] animate-pulse'
                      : effectiveGeeStatus === 'READY'
                      ? 'bg-[#174C36]'
                      : effectiveGeeStatus === 'AUTH_OR_API_ERROR'
                      ? 'bg-amber-500'
                      : 'bg-[#858D86]'
                  }`}
                />
                <span>
                  {checkingGee
                    ? 'GEE: CHECKING...'
                    : effectiveGeeStatus === 'READY'
                    ? `GEE: READY${geeStatus?.projectId ? ` · ${geeStatus.projectId}` : ''}`
                    : geeStatus?.invalidFormat
                    ? 'GEE: INVALID KEY JSON'
                    : effectiveGeeStatus === 'AUTH_OR_API_ERROR'
                    ? 'GEE: AUTH ERROR'
                    : 'GEE: SETUP NEEDED'}
                </span>
              </button>

              {satelliteData?.provenance && (
                <DataProvenanceBadge
                  provenance={satelliteData.provenance}
                  integrityState={satelliteData.integrityState}
                />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.satelliteTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
              Analyze Sentinel-2 Level-2A surface-reflectance imagery over your exact farm boundary and date range to compute QA60+SCL cloud-masked NDVI, NDWI, EVI, and SAVI maps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => runSatelliteAnalysis(selectedSceneId)}
            disabled={loading}
            className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[12px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start md:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Sentinel-2...' : 'Run Satellite Analysis'}</span>
          </button>
        </div>

        {/* Boundary + Date Range + Cloud Cover Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5 border-t border-[#174C36]/10 text-xs">
          <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                1. Farm Boundary
              </div>
              <div className="font-bold text-[#202820] truncate mt-0.5">
                {hasPolygon ? `Drawn Polygon (${farm.boundary.length} pts)` : `Center Buffer (${farm.areaAcres} Ac)`}
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateLocation}
              className="px-2.5 py-1.5 rounded-xl bg-[#DDEDE2] hover:bg-[#c8e4d1] text-[#174C36] font-semibold text-[11px] shrink-0 cursor-pointer flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              <span>{hasPolygon ? 'Edit' : 'Draw'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#858D86] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#4D966B]" />
              <span>2. Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono font-semibold text-[#202820] focus:outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#858D86] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#4D966B]" />
              <span>3. End Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono font-semibold text-[#202820] focus:outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
              4. Max Cloud Cover
            </label>
            <select
              value={maxCloudCover}
              onChange={(e) => setMaxCloudCover(Number(e.target.value))}
              className="mt-1 w-full bg-transparent font-mono font-semibold text-[#202820] focus:outline-none"
            >
              <option value={20}>&lt; 20% (Strict Clear · Recommended)</option>
              <option value={35}>&lt; 35% (Balanced)</option>
              <option value={50}>&lt; 50% (Standard)</option>
              <option value={80}>&lt; 80% (Include Cloudy)</option>
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Satellite Service Error</div>
              <p className="mt-0.5 text-amber-900">{errorMsg}</p>
            </div>
          </div>
        )}

        {activeSceneId && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-[#174C36]/10 text-xs">
            <div>
              <div className="text-[#858D86] text-[11px]">Collection / Platform</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5">
                {satelliteData?.platform || 'Sentinel-2'}
              </div>
              <div className="text-[10px] text-[#858D86] font-mono">S2_SR_HARMONIZED</div>
            </div>
            <div>
              <div className="text-[#858D86] text-[11px]">Acquisition Date</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5">{activeDate}</div>
              <div className="text-[10px] text-[#858D86] font-mono truncate" title={activeSceneId}>
                {activeSceneId}
              </div>
            </div>
            <div>
              <div className="text-[#858D86] text-[11px]">Cloud Cover</div>
              <div className="text-sm font-bold text-[#174C36] mt-0.5 font-mono">
                {activeCloud !== null ? `${activeCloud}%` : '--'}
              </div>
              <div className="text-[10px] text-[#4D966B]">Scene Property</div>
            </div>
            <div>
              <div className="text-[#858D86] text-[11px]">Sun Elevation</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5 font-mono">
                {activeSun !== null ? `${activeSun}°` : '--'}
              </div>
              <div className="text-[10px] text-[#858D86]">Solar Geometry</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[#858D86] text-[11px]">Select Scene</div>
              {availableScenes.length > 0 ? (
                <select
                  value={activeSceneId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedSceneId(nextId);
                    runSatelliteAnalysis(nextId);
                  }}
                  className="mt-1 w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-semibold text-[#202820] focus:outline-none"
                >
                  {availableScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.acquisitionDate} ({s.cloudCoveragePercent}% cloud)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-[#858D86] mt-0.5">No scenes</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Split: Interactive Farm Boundary + GEE Overlay Map | Pixel Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Farm Map with GEE NDVI/NDWI Raster Overlay */}
        <div className="lg:col-span-7 glass-panel rounded-[24px] p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#174C36]" />
              <h3 className="text-base font-bold text-[#202820] font-display">
                Farm Boundary & Sentinel-2 Map Layer
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white/75 border border-[#174C36]/10 p-1 rounded-xl text-[11px]">
              {(
                [
                  { id: 'ndvi', label: 'NDVI' },
                  { id: 'ndwi', label: 'NDWI' },
                  { id: 'evi', label: 'EVI' },
                  { id: 'trueColor', label: 'True Color' },
                  { id: 'none', label: 'Boundary Only' },
                ] as const
              ).map((m) => {
                const disabled =
                  m.id !== 'none' &&
                  (!satelliteData?.tileUrls ||
                    (m.id === 'evi' && !satelliteData.tileUrls.evi));
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setOverlayMode(m.id)}
                    title={
                      disabled
                        ? 'Connect Google Earth Engine credentials to display computed Sentinel-2 raster tiles'
                        : undefined
                    }
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      overlayMode === m.id && !disabled
                        ? 'bg-[#174C36] text-white'
                        : 'text-[#5D665E] hover:text-[#202820]'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative h-80 sm:h-96 rounded-[20px] overflow-hidden border border-white/80 bg-[#142017]">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {loading && (
              <div className="absolute inset-0 z-30 bg-[#142017]/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-[#A6D1B8]" />
                <span className="font-mono font-semibold tracking-wide">
                  Querying COPERNICUS/S2_SR_HARMONIZED...
                </span>
              </div>
            )}

            {/* Legend / Status Overlay on Map */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="glass-dark-overlay text-white font-mono text-[11px] px-3 py-1.5 rounded-xl pointer-events-auto">
                {geeReady && satelliteData?.tileUrls && overlayMode !== 'none' ? (
                  <span>
                    GEE {overlayMode.toUpperCase()} Layer · {activeDate}
                  </span>
                ) : (
                  <span>
                    {hasPolygon ? 'Drawn Farm Polygon' : 'Estimated Parcel Buffer'} ·{' '}
                    {farm.center[0].toFixed(4)}°N, {farm.center[1].toFixed(4)}°E
                  </span>
                )}
              </div>

              {geeReady && satelliteData?.tileUrls && overlayMode !== 'none' && (
                <div className="glass-dark-overlay text-white text-[10px] px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-auto">
                  <span className="font-mono">Opacity</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-20 accent-[#4D966B]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Active Raster Color Ramp or Quicklook Note */}
          {geeReady && (overlayMode === 'ndvi' || overlayMode === 'ndwi' || overlayMode === 'evi') ? (
            <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-semibold text-[#202820]">
                {overlayMode === 'ndvi'
                  ? 'NDVI Scale (Vegetation Vigor: 0.00 to +0.85)'
                  : overlayMode === 'evi'
                  ? 'EVI Scale (Enhanced Canopy Index: 0.00 to +0.85)'
                  : 'NDWI Scale (Canopy / Surface Moisture: -0.60 to +0.50)'}
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#5D665E]">
                <span>Low</span>
                <div
                  className="w-32 h-2.5 rounded-full"
                  style={{
                    background:
                      overlayMode === 'ndvi' || overlayMode === 'evi'
                        ? 'linear-gradient(to right, #8B4513, #D97706, #EAB308, #84CC16, #15803D, #064E3B)'
                        : 'linear-gradient(to right, #92400E, #F59E0B, #D1FAE5, #38BDF8, #0284C7)',
                  }}
                />
                <span>High</span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10 text-[11px] text-[#5D665E] flex items-start gap-3">
              {activePreviewUrl ? (
                <a
                  href={activePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 block w-16 h-16 rounded-xl overflow-hidden border border-[#174C36]/20 bg-[#142017]"
                  title="Open full-resolution ESA Sentinel-2 L2A Quicklook"
                >
                  <img
                    src={activePreviewUrl}
                    alt="Sentinel-2 Quicklook"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <Info className="w-4 h-4 text-[#4D966B] shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">
                {activePreviewUrl ? (
                  <>
                    Live ESA Copernicus STAC quicklook loaded for <strong>{activeDate}</strong> ({activeCloud}% cloud).{' '}
                    <a
                      href={activePreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#174C36] font-semibold underline inline-flex items-center gap-0.5"
                    >
                      <span>Open Full Quicklook</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    — fix Google Earth Engine JSON key to overlay computed 10m NDVI/NDWI/EVI pixel tiles directly on the map.
                  </>
                ) : (
                  'Base imagery displays your farm boundary. Pixel-level NDVI/NDWI/EVI map tiles activate once Google Earth Engine authentication is configured on the server.'
                )}
              </span>
            </div>
          )}
        </div>

        {/* Right: Pixel NDVI/NDWI/EVI/SAVI Statistics + GEE Integration Status */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-[24px] p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#202820] font-display">
                Pixel-Level Spectral Statistics
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                  geeReady && satelliteData?.meanNdvi !== null
                    ? 'bg-[#DDEDE2] text-[#174C36] border-[#4D966B]/30'
                    : effectiveGeeStatus === 'AUTH_OR_API_ERROR'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-white/85 text-[#5D665E] border-[#858D86]/25'
                }`}
              >
                {geeReady && satelliteData?.meanNdvi !== null
                  ? 'LIVE DATA'
                  : effectiveGeeStatus === 'AUTH_OR_API_ERROR'
                  ? 'UNAVAILABLE'
                  : 'NO DATA'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-white/75 border border-[#174C36]/10">
                <div className="text-xs font-semibold text-[#5D665E]">Mean NDVI</div>
                <div className="text-2xl font-extrabold text-[#174C36] font-display mt-1 tabular-nums">
                  {satelliteData?.meanNdvi !== null && satelliteData?.meanNdvi !== undefined
                    ? satelliteData.meanNdvi.toFixed(3)
                    : 'No Data'}
                </div>
                <div className="text-[10px] text-[#858D86] mt-1 font-mono">
                  {typeof satelliteData?.minNdvi === 'number' && typeof satelliteData?.maxNdvi === 'number'
                    ? `Min ${satelliteData.minNdvi.toFixed(2)} · Max ${satelliteData.maxNdvi.toFixed(2)}${
                        typeof satelliteData?.stdDevNdvi === 'number' ? ` · σ ${satelliteData.stdDevNdvi.toFixed(2)}` : ''
                      }`
                    : '(B8 - B4) / (B8 + B4)'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/75 border border-[#174C36]/10">
                <div className="text-xs font-semibold text-[#5D665E]">Mean NDWI</div>
                <div className="text-2xl font-extrabold text-[#202820] font-display mt-1 tabular-nums">
                  {satelliteData?.meanNdwi !== null && satelliteData?.meanNdwi !== undefined
                    ? satelliteData.meanNdwi.toFixed(3)
                    : 'No Data'}
                </div>
                <div className="text-[10px] text-[#858D86] mt-1 font-mono">
                  {typeof satelliteData?.minNdwi === 'number' && typeof satelliteData?.maxNdwi === 'number'
                    ? `Min ${satelliteData.minNdwi.toFixed(2)} · Max ${satelliteData.maxNdwi.toFixed(2)}${
                        typeof satelliteData?.stdDevNdwi === 'number' ? ` · σ ${satelliteData.stdDevNdwi.toFixed(2)}` : ''
                      }`
                    : '(B3 - B8) / (B3 + B8)'}
                </div>
              </div>
            </div>

            {(satelliteData?.meanEvi !== null && satelliteData?.meanEvi !== undefined) ||
            (satelliteData?.meanSavi !== null && satelliteData?.meanSavi !== undefined) ? (
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10">
                  <div className="text-[11px] font-semibold text-[#5D665E]">Mean EVI</div>
                  <div className="text-lg font-extrabold text-[#174C36] font-display mt-0.5 tabular-nums">
                    {typeof satelliteData?.meanEvi === 'number' ? satelliteData.meanEvi.toFixed(3) : '--'}
                  </div>
                  <div className="text-[10px] text-[#858D86] font-mono">
                    {typeof satelliteData?.stdDevEvi === 'number'
                      ? `σ ${satelliteData.stdDevEvi.toFixed(2)} · Canopy Index`
                      : 'Enhanced Vegetation'}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#174C36]/10">
                  <div className="text-[11px] font-semibold text-[#5D665E]">Mean SAVI</div>
                  <div className="text-lg font-extrabold text-[#202820] font-display mt-0.5 tabular-nums">
                    {typeof satelliteData?.meanSavi === 'number' ? satelliteData.meanSavi.toFixed(3) : '--'}
                  </div>
                  <div className="text-[10px] text-[#858D86] font-mono">
                    {typeof satelliteData?.stdDevSavi === 'number'
                      ? `σ ${satelliteData.stdDevSavi.toFixed(2)} · Soil-Adjusted`
                      : 'Soil-Adjusted Vigor'}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Real GEE Area Classification Breakdown OR Actionable Setup Diagnostics */}
            {satelliteData?.areaBreakdown ? (
              <div className="space-y-3 pt-2 border-t border-[#174C36]/10 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#202820]">
                    {satelliteData.healthClassification || 'Parcel Pixel Classification'}
                  </span>
                  <span className="font-mono text-[11px] text-[#5D665E]">
                    {satelliteData.validPixelCount?.toLocaleString('en-IN')} px (10m)
                  </span>
                </div>

                <div className="w-full h-3 rounded-full overflow-hidden flex bg-[#174C36]/10">
                  <div
                    style={{ width: `${satelliteData.areaBreakdown.healthyVegetationPercent}%` }}
                    className="bg-[#174C36]"
                    title="Dense Healthy Canopy"
                  />
                  <div
                    style={{ width: `${satelliteData.areaBreakdown.moderateVegetationPercent}%` }}
                    className="bg-[#4D966B]"
                    title="Moderate Vegetation"
                  />
                  <div
                    style={{ width: `${satelliteData.areaBreakdown.cropStressPercent}%` }}
                    className="bg-amber-400"
                    title="Sparse / Low Vigor"
                  />
                  <div
                    style={{ width: `${satelliteData.areaBreakdown.bareSoilPercent}%` }}
                    className="bg-stone-400"
                    title="Bare Soil"
                  />
                  <div
                    style={{ width: `${satelliteData.areaBreakdown.waterBodiesPercent}%` }}
                    className="bg-sky-500"
                    title="Water / High Moisture"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#5D665E]">
                  <div>Dense Canopy: <strong className="text-[#174C36]">{satelliteData.areaBreakdown.healthyVegetationPercent}%</strong></div>
                  <div>Moderate Crop: <strong>{satelliteData.areaBreakdown.moderateVegetationPercent}%</strong></div>
                  <div>Sparse / Stress: <strong className="text-amber-700">{satelliteData.areaBreakdown.cropStressPercent}%</strong></div>
                  <div>Bare Soil: <strong>{satelliteData.areaBreakdown.bareSoilPercent}%</strong></div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/75 border border-[#174C36]/10 text-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-[#202820] flex items-center gap-1.5">
                    {geeStatus?.ready ? (
                      <CheckCircle2 className="w-4 h-4 text-[#174C36]" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                    )}
                    <span>Google Earth Engine Connection</span>
                  </div>
                  <button
                    type="button"
                    onClick={checkGeeConnection}
                    disabled={checkingGee}
                    className="text-[11px] font-semibold text-[#174C36] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {checkingGee ? 'Checking...' : 'Test Connection'}
                  </button>
                </div>

                {(geeStatus?.status === 'AUTH_OR_API_ERROR' || satelliteData?.geeError) && (
                  <p className="text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                    <strong>Earth Engine Diagnostic:</strong>{' '}
                    {geeStatus?.error || satelliteData?.geeError}
                  </p>
                )}

                <div className="text-[#5D665E] space-y-2 leading-relaxed">
                  {geeStatus?.projectId && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-[#DDEDE2]/60 text-[#174C36] font-mono text-[11px]">
                      Active GEE Project ID: <strong>{geeStatus.projectId}</strong>
                    </div>
                  )}
                  {geeStatus?.missingVars && geeStatus.missingVars.length > 0 && (
                    <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 font-mono text-[11px]">
                      Missing: {geeStatus.missingVars.join(', ')}
                    </div>
                  )}
                  <p className="font-semibold text-[#202820] text-[11px]">
                    How to fix Google Earth Engine (<span className="font-mono">COPERNICUS/S2_SR_HARMONIZED</span>):
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>
                      Open <strong>Google Cloud Console → IAM &amp; Admin → Service Accounts</strong> for project{' '}
                      <span className="font-mono">{geeStatus?.projectId || 'your Earth Engine project'}</span>.
                    </li>
                    <li>
                      Select your Service Account → <strong>Keys → Add Key → Create new key → JSON</strong> to download the <span className="font-mono">.json</span> file.
                    </li>
                    <li>
                      Copy the <strong>entire JSON file text</strong> (starting with{' '}
                      <span className="font-mono">{'{"type":"service_account",...}'}</span> — not just the Key ID) into{' '}
                      <span className="font-mono font-semibold">GEE_SERVICE_ACCOUNT_JSON</span> in Secrets, and click <strong>Test Connection</strong>.
                    </li>
                    <li>
                      Confirm <span className="font-mono">earthengine.googleapis.com</span> is enabled and the project is registered at{' '}
                      <span className="font-mono">code.earthengine.google.com/register</span>.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel rounded-[24px] p-6 bg-[#DDEDE2]/45 space-y-3 text-xs">
            <div className="font-bold text-[#174C36] flex items-center gap-2 text-sm font-display">
              <Camera className="w-4 h-4 text-[#4D966B]" />
              <span>Ground-Truth with AI Crop Doctor</span>
            </div>
            <p className="text-[#5D665E] leading-relaxed">
              Combine satellite passes with close-up leaf photography in your field to inspect visible pest or disease symptoms with Gemini Vision AI.
            </p>
            <button
              type="button"
              onClick={onOpenDoctor}
              className="w-full py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open AI Crop Doctor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Real 9-Month GEE NDVI & NDWI Time Series Chart */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#202820] font-display flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#174C36]" />
              <span>COPERNICUS/S2_SR_HARMONIZED 9-Month Time Series</span>
            </h3>
            <p className="text-xs text-[#858D86]">
              {trendPoints.length >= 2
                ? `Monthly cloud-masked (QA60 + SCL) mean NDVI, NDWI & EVI across ${trendPoints.length} months ending ${endDate}.`
                : 'Historical multi-month crop vigor (NDVI) and moisture (NDWI) trend activates with Google Earth Engine.'}
            </p>
          </div>
          {trendPoints.length >= 2 && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#174C36] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#174C36]" /> NDVI
              </span>
              <span className="flex items-center gap-1.5 text-sky-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> NDWI
              </span>
              {trendPoints.some((p) => typeof p.evi === 'number') && (
                <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> EVI
                </span>
              )}
            </div>
          )}
        </div>

        {trendPoints.length >= 2 ? (
          <div className="space-y-3">
            {hoveredTrendIdx !== null && trendPoints[hoveredTrendIdx] && (
              <div className="px-3.5 py-2 rounded-xl bg-white/80 border border-[#174C36]/10 text-xs font-mono flex flex-wrap items-center gap-4 text-[#202820]">
                <span className="font-bold text-[#174C36]">{trendPoints[hoveredTrendIdx].date}</span>
                <span>NDVI: <strong>{trendPoints[hoveredTrendIdx].ndvi.toFixed(3)}</strong></span>
                <span>NDWI: <strong>{trendPoints[hoveredTrendIdx].ndwi.toFixed(3)}</strong></span>
                {typeof trendPoints[hoveredTrendIdx].evi === 'number' && (
                  <span>EVI: <strong>{trendPoints[hoveredTrendIdx].evi!.toFixed(3)}</strong></span>
                )}
                <span className="text-[#858D86]">Avg Cloud: {trendPoints[hoveredTrendIdx].cloudPercent}%</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <svg viewBox="0 0 640 190" className="w-full h-48 min-w-[480px]">
                {[0, 0.25, 0.5, 0.75, 1].map((v) => {
                  const y = 148 - v * 120;
                  return (
                    <g key={v}>
                      <line x1="45" y1={y} x2="615" y2={y} stroke="rgba(23,76,54,0.1)" strokeDasharray="3 3" />
                      <text x="8" y={y + 4} fontSize="10" fill="#858D86" fontFamily="monospace">
                        {v.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* EVI Path (if available) */}
                {trendPoints.some((p) => typeof p.evi === 'number') && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.75"
                    strokeDasharray="2 3"
                    points={trendPoints
                      .map((pt, idx) => {
                        const x = 65 + (idx / Math.max(1, trendPoints.length - 1)) * 530;
                        const y = 148 - Math.max(0, Math.min(1, pt.evi ?? 0)) * 120;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* NDVI Path */}
                <polyline
                  fill="none"
                  stroke="#174C36"
                  strokeWidth="2.5"
                  points={trendPoints
                    .map((pt, idx) => {
                      const x = 65 + (idx / Math.max(1, trendPoints.length - 1)) * 530;
                      const y = 148 - Math.max(0, Math.min(1, pt.ndvi)) * 120;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* NDWI Path */}
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  points={trendPoints
                    .map((pt, idx) => {
                      const x = 65 + (idx / Math.max(1, trendPoints.length - 1)) * 530;
                      const clamped = Math.max(-0.5, Math.min(0.5, pt.ndwi)) + 0.5;
                      const y = 148 - clamped * 120;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {trendPoints.map((pt, idx) => {
                  const x = 65 + (idx / Math.max(1, trendPoints.length - 1)) * 530;
                  const yNdvi = 148 - Math.max(0, Math.min(1, pt.ndvi)) * 120;
                  const yNdwi = 148 - (Math.max(-0.5, Math.min(0.5, pt.ndwi)) + 0.5) * 120;
                  const isHovered = hoveredTrendIdx === idx;
                  return (
                    <g
                      key={pt.date + idx}
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onMouseLeave={() => setHoveredTrendIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle cx={x} cy={yNdwi} r={isHovered ? 4.5 : 3} fill="#0284c7" stroke="#fff" strokeWidth="1" />
                      <circle cx={x} cy={yNdvi} r={isHovered ? 6 : 4} fill="#174C36" stroke="#fff" strokeWidth="1.5" />
                      <text x={x} y="172" textAnchor="middle" fontSize="10" fill="#5D665E">
                        {pt.date}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-white/65 border border-[#174C36]/10 text-xs text-[#5D665E] flex items-center justify-between gap-4">
            <span>
              {loading
                ? 'Computing 9-month COPERNICUS/S2_SR_HARMONIZED historical composites...'
                : geeReady
                ? 'Not enough cloud-free Sentinel-2 acquisitions in the past 9 months for a continuous trend curve.'
                : 'Configure GEE_PROJECT_ID and GEE_SERVICE_ACCOUNT_JSON in AI Studio Secrets to plot live 9-month NDVI, NDWI, and EVI curves.'}
            </span>
          </div>
        )}
      </div>

      {/* Sentinel-2 Scenes Catalog Table */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#202820] font-display">
              Sentinel-2 Overpass Scenes ({startDate} to {endDate})
            </h3>
            <p className="text-xs text-[#858D86] mt-0.5">
              Click any row to compute or inspect metrics for ({farm.center[0].toFixed(3)}°N, {farm.center[1].toFixed(3)}°E).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPipelineInfo(!showPipelineInfo)}
            className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1 cursor-pointer"
          >
            <span>Earth Engine Dataset Specs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {showPipelineInfo && (
          <div className="p-4 bg-white/75 rounded-2xl border border-[#174C36]/10 text-xs text-[#5D665E] space-y-1">
            <div>
              <strong>Dataset ID:</strong> <span className="font-mono text-[#174C36]">COPERNICUS/S2_SR_HARMONIZED</span> (Harmonized Sentinel-2 Level-2A Surface Reflectance, nominal 5-day revisit).
            </div>
            <div>
              <strong>Cloud Masking & Indices:</strong> Applies <span className="font-mono">QA60</span> (bits 10 & 11) + <span className="font-mono">SCL</span> cloud/shadow filtering, then computes <span className="font-mono">NDVI = (B8 - B4)/(B8 + B4)</span>, <span className="font-mono">NDWI = (B3 - B8)/(B3 + B8)</span>, <span className="font-mono">EVI</span>, and <span className="font-mono">SAVI</span> at 10m resolution over your parcel polygon.
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#174C36]/10 text-[11px] font-bold text-[#858D86] uppercase tracking-wider">
                <th className="py-2.5 px-3">Scene Identifier</th>
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Acquisition</th>
                <th className="py-2.5 px-3">Cloud</th>
                <th className="py-2.5 px-3">Sun Elev.</th>
                <th className="py-2.5 px-3">Tile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#174C36]/10 font-mono text-[11px]">
              {availableScenes.length > 0 ? (
                availableScenes.map((s) => {
                  const isSelected = activeSceneId === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        setSelectedSceneId(s.id);
                        runSatelliteAnalysis(s.id);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#DDEDE2]/65' : 'hover:bg-white/60'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#202820] truncate max-w-[240px]">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-3 text-[#5D665E]">{s.platform}</td>
                      <td className="py-2.5 px-3 text-[#202820] font-sans">{s.acquisitionDate}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                            s.cloudCoveragePercent < 15
                              ? 'bg-[#DDEDE2] text-[#174C36]'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {s.cloudCoveragePercent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#5D665E]">
                        {s.sunElevationDeg !== null ? `${s.sunElevationDeg}°` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-[#5D665E]">{s.tileId}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#858D86] font-sans">
                    {loading
                      ? 'Querying Sentinel-2 satellite catalog...'
                      : 'No satellite observation available for the selected date range.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
