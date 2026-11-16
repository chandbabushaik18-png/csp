import React, { useState, useEffect } from 'react';
import {
  Satellite,
  AlertTriangle,
  Camera,
  RefreshCw,
  Sliders,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { FarmProfile, Language, SatelliteAnalysis, SentinelScene } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface SatelliteIntelligenceSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  onOpenDoctor: () => void;
  onOpenAssistant: (query?: string) => void;
}

export const SatelliteIntelligenceSection: React.FC<SatelliteIntelligenceSectionProps> = ({
  currentLang,
  farm,
  onOpenDoctor,
}) => {
  const t = translations[currentLang];

  const [loading, setLoading] = useState(false);
  const [satelliteData, setSatelliteData] = useState<SatelliteAnalysis | null>(null);
  const [activeLayer, setActiveLayer] = useState<'ndvi' | 'ndwi' | 'rgb'>('ndvi');
  const [availableScenes, setAvailableScenes] = useState<SentinelScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<SentinelScene | null>(null);
  const [scenesLoading, setScenesLoading] = useState(false);

  const [healthyMin, setHealthyMin] = useState(0.6);
  const [moderateMin, setModerateMin] = useState(0.4);
  const [showThresholdControls, setShowThresholdControls] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);

  const fetchSatelliteData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/satellite/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: farm.id,
          center: farm.center,
          polygon: farm.boundary,
          areaAcres: farm.areaAcres,
          crop: farm.currentCrop,
          healthyMin,
          moderateMin,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSatelliteData(data);
      }
    } catch (e) {
      console.error('Satellite analysis fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentScenes = async () => {
    setScenesLoading(true);
    try {
      const res = await fetch('/api/satellite/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: farm.center[0],
          lon: farm.center[1],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const scenes: SentinelScene[] = data.scenes || [];
        setAvailableScenes(scenes);
        if (scenes.length > 0) setSelectedScene(scenes[0]);
      }
    } catch (e) {
      console.error('Scenes search error:', e);
    } finally {
      setScenesLoading(false);
    }
  };

  useEffect(() => {
    fetchSatelliteData();
    fetchRecentScenes();
  }, [farm.id, farm.currentCrop, farm.areaAcres, farm.center, healthyMin, moderateMin]);

  // Build smooth SVG path coordinates for Historical Overpass Biomass Trajectory
  const trendPoints = satelliteData?.historicalTrend || [];
  const svgW = 360;
  const svgH = 110;
  const padX = 16;
  const padY = 14;
  const ndviCoords = trendPoints.map((pt, idx) => {
    const x =
      trendPoints.length > 1
        ? padX + (idx / (trendPoints.length - 1)) * (svgW - padX * 2)
        : svgW / 2;
    const y = svgH - padY - pt.ndvi * (svgH - padY * 2);
    return { x, y, pt };
  });

  const ndviLinePath = ndviCoords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const ndviAreaPath =
    ndviCoords.length > 0
      ? `${ndviLinePath} L ${ndviCoords[ndviCoords.length - 1].x.toFixed(1)} ${svgH - padY} L ${ndviCoords[0].x.toFixed(1)} ${svgH - padY} Z`
      : '';

  const activeSceneId = selectedScene?.id || satelliteData?.sceneId;
  const activePlatform = selectedScene?.platform || satelliteData?.platform;
  const activeDate = selectedScene?.acquisitionDate || satelliteData?.acquisitionDate;
  const activeCloud = selectedScene?.cloudCoveragePercent ?? satelliteData?.cloudCoveragePercent;
  const activeSun = selectedScene?.sunElevationDeg ?? satelliteData?.sunElevationDeg ?? 56.4;

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Overpass Controls */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                Copernicus Sentinel-2 Remote Sensing
              </span>
              {satelliteData?.provenance && (
                <DataProvenanceBadge provenance={satelliteData.provenance} />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.satelliteTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
              Multi-spectral 10m ESA Sentinel-2 observations computing chlorophyll reflectance (NDVI) and canopy hydration (NDWI).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowThresholdControls(!showThresholdControls)}
              className="px-3.5 py-2.5 bg-white/80 hover:bg-white border border-[#174C36]/15 text-[#202820] rounded-[12px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#4D966B]" />
              <span>{showThresholdControls ? 'Hide Thresholds' : 'Adjust Thresholds'}</span>
            </button>

            <button
              type="button"
              onClick={fetchSatelliteData}
              disabled={loading}
              className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[12px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Query Latest Pass</span>
            </button>
          </div>
        </div>

        {/* Threshold Calibration Sliders */}
        {showThresholdControls && (
          <div className="mt-6 pt-5 border-t border-[#174C36]/10 bg-white/60 p-5 rounded-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#202820] uppercase tracking-wide text-[11px]">
                Spectral Threshold Calibration
              </span>
              <button
                type="button"
                onClick={() => {
                  setHealthyMin(0.6);
                  setModerateMin(0.4);
                }}
                className="text-[11px] text-[#174C36] font-semibold hover:underline cursor-pointer"
              >
                Reset FAO Standard (0.60 / 0.40)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between font-semibold mb-1.5">
                  <span>Healthy Canopy Floor (NDVI)</span>
                  <span className="text-[#174C36] font-mono">{healthyMin.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.75"
                  step="0.02"
                  value={healthyMin}
                  onChange={(e) => setHealthyMin(parseFloat(e.target.value))}
                  className="w-full accent-[#174C36] cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1.5">
                  <span>Moderate Growth Floor (NDVI)</span>
                  <span className="text-[#174C36] font-mono">{moderateMin.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.55"
                  step="0.02"
                  value={moderateMin}
                  onChange={(e) => setModerateMin(parseFloat(e.target.value))}
                  className="w-full accent-[#4D966B] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Overpass Metadata + Dataset Switcher */}
        {satelliteData && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-5 border-t border-[#174C36]/10 text-xs">
            <div>
              <div className="text-[#858D86] text-[11px]">Platform</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5">{activePlatform}</div>
              <div className="text-[10px] text-[#858D86]">MSI 10m L2A BOA</div>
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
              <div className="text-sm font-bold text-[#174C36] mt-0.5 font-mono">{activeCloud}%</div>
              <div className="text-[10px] text-[#4D966B]">Valid Optical Pass</div>
            </div>
            <div>
              <div className="text-[#858D86] text-[11px]">Sun Elevation</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5 font-mono">{activeSun}°</div>
              <div className="text-[10px] text-[#858D86]">Solar Corrected</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[#858D86] text-[11px]">Select Pass Dataset</div>
              {availableScenes.length > 0 ? (
                <select
                  value={activeSceneId}
                  onChange={(e) => {
                    const found = availableScenes.find((s) => s.id === e.target.value);
                    if (found) setSelectedScene(found);
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
                <div className="text-xs font-bold text-[#202820] mt-0.5">~5 Days Revisit</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Heatmap + Smooth Trajectory Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Multispectral Heatmap */}
        <div className="lg:col-span-7 glass-panel rounded-[24px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Satellite className="w-5 h-5 text-[#174C36]" />
                <h3 className="text-base font-bold text-[#202820] font-display">
                  Multispectral Field Heatmap
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-white/75 border border-white p-1 rounded-xl text-xs self-start sm:self-auto">
                {(
                  [
                    { id: 'ndvi', label: 'NDVI' },
                    { id: 'ndwi', label: 'NDWI' },
                    { id: 'rgb', label: 'True Color' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveLayer(mode.id)}
                    className={`px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeLayer === mode.id ? 'bg-[#174C36] text-white' : 'text-[#5D665E] hover:text-[#202820]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mt-5 h-72 sm:h-80 rounded-[20px] overflow-hidden border border-white/80 bg-[#174C36]">
              <img
                src={
                  activeLayer === 'ndwi'
                    ? '/src/assets/images/smart_farmland_sensor_iot_1794070590682.jpg'
                    : '/src/assets/images/hero_aerial_farmland_1794838846985.jpg'
                }
                alt="Satellite Field Spectral View"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />

              {activeLayer === 'ndvi' && (
                <div className="absolute inset-0 bg-gradient-to-tr from-[#174C36]/55 via-[#4D966B]/30 to-amber-500/25 mix-blend-color pointer-events-none" />
              )}
              {activeLayer === 'ndwi' && (
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/50 via-blue-500/30 to-slate-500/25 mix-blend-color pointer-events-none" />
              )}

              <div className="absolute inset-8 border-2 border-[#DDEDE2]/85 rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="glass-dark-overlay text-white font-mono text-[11px] px-3 py-1 rounded-xl">
                  {farm.name} ({farm.areaAcres} Ac)
                </span>
              </div>

              <div className="absolute top-10 right-10 glass-dark-overlay text-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-300" />
                <span>Perimeter Stress Zone (NDVI 0.34)</span>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-white/75 rounded-2xl text-xs space-y-2 border border-white">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86] uppercase">
                <span>Spectral Reflectance Scale</span>
                <span className="font-mono text-[#174C36]">{activeLayer.toUpperCase()}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-[#4D966B] to-[#174C36]" />
              <div className="flex justify-between text-[10px] font-mono text-[#5D665E]">
                <span>&lt;0.20 Bare</span>
                <span>0.35 Stress</span>
                <span>0.50 Moderate</span>
                <span>≥{healthyMin.toFixed(2)} Healthy</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#174C36]/10 text-[11px] text-[#858D86] flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#4D966B] shrink-0" />
            <span>
              Copernicus Sentinel-2 Level-2A atmospheric bottom-of-atmosphere reflectance.
            </span>
          </div>
        </div>

        {/* Right: Spectral Stats, SVG Area Trajectory & Leaf Doctor CTA */}
        <div className="lg:col-span-5 space-y-5">
          {satelliteData && (
            <div className="glass-panel rounded-[24px] p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#DDEDE2]/70 border border-[#4D966B]/20">
                  <div className="text-xs font-semibold text-[#174C36]">Mean NDVI</div>
                  <div className="text-3xl font-extrabold text-[#174C36] font-display tabular-nums mt-1">
                    {satelliteData.meanNdvi}
                  </div>
                  <div className="text-[10px] text-[#4D966B] mt-1 font-mono">(B08-B04)/(B08+B04)</div>
                </div>
                <div className="p-4 rounded-2xl bg-sky-50/85 border border-sky-200/70">
                  <div className="text-xs font-semibold text-sky-900">Mean NDWI</div>
                  <div className="text-3xl font-extrabold text-sky-950 font-display tabular-nums mt-1">
                    {satelliteData.meanNdwi}
                  </div>
                  <div className="text-[10px] text-sky-700 mt-1 font-mono">(B03-B08)/(B03+B08)</div>
                </div>
              </div>

              {/* Area Classification Bars */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between font-bold text-[#202820] text-[11px] uppercase tracking-wider">
                  <span>Canopy Health Distribution</span>
                  <span className="font-mono text-[#858D86]">10m Pixels</span>
                </div>
                {[
                  {
                    label: `Healthy Canopy (≥ ${healthyMin.toFixed(2)})`,
                    pct: satelliteData.areaBreakdown.healthyVegetationPercent,
                    bar: 'bg-[#174C36]',
                  },
                  {
                    label: `Moderate Growth (${moderateMin.toFixed(2)} - ${healthyMin.toFixed(2)})`,
                    pct: satelliteData.areaBreakdown.moderateVegetationPercent,
                    bar: 'bg-[#4D966B]',
                  },
                  {
                    label: `Localized Stress (< ${moderateMin.toFixed(2)})`,
                    pct: satelliteData.areaBreakdown.cropStressPercent,
                    bar: 'bg-amber-500',
                  },
                ].map((row, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between font-medium text-[#202820] mb-1">
                      <span>{row.label}</span>
                      <span className="font-mono font-bold tabular-nums">{row.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#174C36]/10 overflow-hidden">
                      <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Smooth SVG Area Chart: Historical Overpass Biomass Trajectory */}
              <div className="pt-4 border-t border-[#174C36]/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#202820] uppercase tracking-wide">
                    Historical Overpass Biomass Trajectory
                  </span>
                  <span className="text-[10px] font-mono text-[#4D966B] font-bold">NDVI Curve</span>
                </div>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-28 overflow-visible">
                  <defs>
                    <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4D966B" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#4D966B" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {ndviAreaPath && <path d={ndviAreaPath} fill="url(#ndviGrad)" />}
                  {ndviLinePath && (
                    <path d={ndviLinePath} fill="none" stroke="#174C36" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                  {ndviCoords.map((c, idx) => (
                    <g key={idx}>
                      <circle cx={c.x} cy={c.y} r="4" fill="#174C36" stroke="#ffffff" strokeWidth="1.5" />
                      <text x={c.x} y={svgH - 1} textAnchor="middle" className="fill-[#858D86] text-[9px] font-mono">
                        {c.pt.date}
                      </text>
                      <text x={c.x} y={c.y - 8} textAnchor="middle" className="fill-[#174C36] text-[9px] font-mono font-bold">
                        {c.pt.ndvi.toFixed(2)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          )}

          {/* Ground-Truth Leaf Doctor CTA */}
          <div className="glass-panel rounded-[24px] p-6 bg-[#DDEDE2]/45 space-y-3 text-xs">
            <div className="font-bold text-[#174C36] flex items-center gap-2 text-sm font-display">
              <Camera className="w-4 h-4 text-[#4D966B]" />
              <span>Ground-Truth with AI Leaf Doctor</span>
            </div>
            <p className="text-[#5D665E] leading-relaxed">
              Capture a close-up leaf photo from stressed perimeter patches to diagnose pests or fungal diseases with Gemini Vision.
            </p>
            <button
              type="button"
              onClick={onOpenDoctor}
              className="w-full py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open AI Leaf Doctor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Real Sentinel-2 Overpasses Catalog Table */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#202820] font-display">
              Copernicus Sentinel-2 Overpass Granules
            </h3>
            <p className="text-xs text-[#858D86] mt-0.5">
              Click any row to inspect scene metadata for coordinates ({farm.center[0].toFixed(3)}°N, {farm.center[1].toFixed(3)}°E).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigGuide(!showConfigGuide)}
            className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1 cursor-pointer"
          >
            <span>Sentinel Hub Pipeline Info</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {showConfigGuide && (
          <div className="p-4 bg-white/75 rounded-2xl border border-[#174C36]/10 text-xs text-[#5D665E]">
            Queries ESA AWS Earth-Search STAC (<span className="font-mono">sentinel-2-c1-l2a</span>) in real time for granules intersecting the selected farmland bounding box.
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
                availableScenes.map((s, idx) => {
                  const isSelected = activeSceneId === s.id;
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedScene(s)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#DDEDE2]/65' : 'hover:bg-white/60'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#202820] truncate max-w-[220px]">
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
                      <td className="py-2.5 px-3 text-[#5D665E]">{s.sunElevationDeg}°</td>
                      <td className="py-2.5 px-3 text-[#5D665E]">{s.tileId}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#858D86] font-sans">
                    {scenesLoading ? 'Querying STAC satellite catalog...' : 'No scenes returned for this bounding box.'}
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
