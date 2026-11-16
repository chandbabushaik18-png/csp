import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Sun,
  CloudRain,
  Calculator,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { FarmProfile, IotDeviceStatus, Language, WaterAdvisoryData } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface WaterManagementSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  iotStatus?: IotDeviceStatus | null;
  onOpenAssistant: (query?: string) => void;
}

export const WaterManagementSection: React.FC<WaterManagementSectionProps> = ({
  currentLang,
  farm,
  iotStatus,
  onOpenAssistant,
}) => {
  const t = translations[currentLang];

  const [selectedCrop, setSelectedCrop] = useState<string>(farm.currentCrop || 'Chilli');
  const [selectedStage, setSelectedStage] = useState<string>(
    farm.cropStage || 'Mid-Season (Flowering/Fruiting)'
  );
  const [selectedIrrigation, setSelectedIrrigation] = useState<string>(
    farm.irrigationMethod || 'Drip'
  );
  const [soilType, setSoilType] = useState<string>(farm.soilType || 'Black Cotton Soil');
  const [pumpMotorHp, setPumpMotorHp] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waterData, setWaterData] = useState<WaterAdvisoryData | null>(null);

  const iotConnected = Boolean(iotStatus?.connected && iotStatus.latestTelemetry);
  const liveMoisture = iotConnected ? iotStatus!.latestTelemetry!.soilMoisturePercent : undefined;

  const pumpFlowRates: Record<number, number> = {
    3: 18000,
    5: 30000,
    7.5: 45000,
    10: 60000,
  };
  const activeFlowRate = pumpFlowRates[pumpMotorHp] || 30000;

  const fetchWaterAdvisory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await safeFetchJson<any>('/api/water-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: selectedCrop,
          cropStage: selectedStage,
          soilType,
          irrigationMethod: selectedIrrigation,
          areaAcres: farm.areaAcres,
          lat: farm.center[0],
          lon: farm.center[1],
          pumpFlowRateLph: activeFlowRate,
          soilMoisturePercent: liveMoisture,
        }),
      });

      const data = res.data;
      if (!res.ok || !data?.success) {
        setWaterData(null);
        setErrorMsg(
          data?.error || `Failed to retrieve evapotranspiration budget (HTTP ${res.status}).`
        );
        return;
      }

      setWaterData(data);
    } catch (e: any) {
      setWaterData(null);
      setErrorMsg(e?.message || 'Network error while calculating FAO-56 water advisory.');
    } finally {
      setLoading(false);
    }
  }, [
    selectedCrop,
    selectedStage,
    soilType,
    selectedIrrigation,
    farm.areaAcres,
    farm.center,
    activeFlowRate,
    liveMoisture,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWaterAdvisory();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchWaterAdvisory]);

  const moistureZoneLabel = !iotConnected
    ? 'ESP32 Probe Not Connected'
    : liveMoisture! < 30
    ? 'Severe Moisture Deficit — Immediate Drip Run'
    : liveMoisture! < 50
    ? 'Moderate Root-Zone Depletion — Standard Schedule'
    : liveMoisture! < 75
    ? 'Optimal Soil Moisture — Reduced Pumping'
    : 'Field Capacity / Saturated — Skip Irrigation';

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Controls Glass Card */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                FAO-56 Penman-Monteith Hydrology
              </span>
              {waterData?.provenance && <DataProvenanceBadge provenance={waterData.provenance} />}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.waterTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
              {t.waterSub}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchWaterAdvisory}
            disabled={loading}
            className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[12px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Recalculating...' : 'Recalculate Budget'}</span>
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-7 pt-6 border-t border-[#174C36]/10 text-xs">
          <div>
            <label className="block font-semibold text-[#5D665E] mb-1.5">Cultivated Crop</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full font-medium bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2.5 text-[#202820] focus:outline-none"
            >
              <option value="Chilli">Red Chilli (మిరప)</option>
              <option value="Paddy">Paddy Rice (వరి)</option>
              <option value="Cotton">Bt Cotton (పత్తి)</option>
              <option value="Maize">Hybrid Maize (మొక్కజొన్న)</option>
              <option value="Groundnut">Groundnut (వేరుశనగ)</option>
              <option value="Tomato">Tomato (టమోటా)</option>
              <option value="Turmeric">Turmeric (పసుపు)</option>
              <option value="Sugarcane">Sugarcane (చెరకు)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#5D665E] mb-1.5">Growth Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full font-medium bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2.5 text-[#202820] focus:outline-none"
            >
              <option value="Initial (Germination)">Initial / Germination</option>
              <option value="Vegetative (Tillering/Branching)">Vegetative Growth</option>
              <option value="Mid-Season (Flowering/Fruiting)">Mid-Season Flowering</option>
              <option value="Late-Season (Ripening/Harvest)">Late-Season Ripening</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#5D665E] mb-1.5">Irrigation System</label>
            <select
              value={selectedIrrigation}
              onChange={(e) => setSelectedIrrigation(e.target.value)}
              className="w-full font-medium bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2.5 text-[#202820] focus:outline-none"
            >
              <option value="Drip">Drip (90% Efficiency)</option>
              <option value="Sprinkler">Sprinkler (75% Efficiency)</option>
              <option value="Flood / Furrow">Flood / Furrow (50% Eff.)</option>
              <option value="Rainfed">Rainfed / Dryland</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#5D665E] mb-1.5">Soil Profile</label>
            <select
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full font-medium bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2.5 text-[#202820] focus:outline-none"
            >
              <option value="Black Cotton Soil">Black Cotton Soil (High retention)</option>
              <option value="Red Sandy Loam">Red Sandy Loam (Fast drainage)</option>
              <option value="Alluvial Soil">Alluvial River Loam</option>
              <option value="Heavy Clay">Heavy Clay Loam</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#5D665E] mb-1.5">Pump Capacity</label>
            <select
              value={pumpMotorHp}
              onChange={(e) => setPumpMotorHp(Number(e.target.value))}
              className="w-full font-medium bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2.5 text-[#202820] focus:outline-none"
            >
              <option value={3}>3 HP Motor (~18,000 L/hr)</option>
              <option value={5}>5 HP Motor (~30,000 L/hr)</option>
              <option value={7.5}>7.5 HP Motor (~45,000 L/hr)</option>
              <option value={10}>10 HP Motor (~60,000 L/hr)</option>
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-[22px] p-5 border border-amber-300/70 bg-amber-50/75 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-3 text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Water Advisory Unavailable</div>
              <p className="text-amber-900 mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchWaterAdvisory}
            className="px-4 py-2 bg-[#174C36] text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Hardware Probe Status + Hydrological Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
                <Cpu className="w-4 h-4 text-[#4D966B]" />
                <span>Physical Soil Moisture Sensor</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                  iotConnected
                    ? 'bg-[#DDEDE2] text-[#174C36]'
                    : 'bg-white/85 text-[#5D665E] border border-[#858D86]/25'
                }`}
              >
                {iotConnected ? 'LIVE DATA' : 'NO DATA'}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-6">
              <div className="relative w-24 h-44 rounded-[20px] bg-white/70 border border-[#174C36]/15 overflow-hidden shrink-0 shadow-inner flex flex-col justify-end">
                {iotConnected && liveMoisture !== undefined && (
                  <div
                    className="relative w-full transition-all duration-500 ease-out"
                    style={{
                      height: `${liveMoisture}%`,
                      background: 'linear-gradient(180deg, #4D966B 0%, #174C36 100%)',
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-mono font-extrabold text-sm text-[#202820] bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-2xs">
                    {iotConnected ? `${liveMoisture}%` : 'NO DATA'}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3 text-xs">
                <div>
                  <div className="text-[11px] font-semibold text-[#858D86] uppercase tracking-wider">
                    Root-Zone Sensor Status
                  </div>
                  <div className="text-base font-bold text-[#174C36] font-display mt-0.5">
                    {moistureZoneLabel}
                  </div>
                </div>

                {iotConnected ? (
                  <div className="p-3 rounded-xl bg-[#DDEDE2]/70 text-[#174C36] flex items-center gap-2">
                    <Cpu className="w-4 h-4 shrink-0" />
                    <span>
                      Reading directly from connected ESP32 node ({iotStatus?.latestTelemetry?.deviceId}).
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/75 border border-[#174C36]/10 text-[#5D665E] leading-relaxed">
                    ESP32 soil probe is not connected. Irrigation demand is computed purely from Open-Meteo reference evapotranspiration (ET0), crop coefficient (Kc), and rainfall forecasts.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Equation & Key Hydrological Outputs */}
        <div className="lg:col-span-7 space-y-5">
          {waterData && (
            <>
              <div className="glass-panel rounded-[24px] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#174C36]/10 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#174C36]">
                    <Calculator className="w-4 h-4 text-[#4D966B]" />
                    <span>FAO-56 Water Balance Derivation</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#858D86]">
                    {farm.center[0].toFixed(3)}°N, {farm.center[1].toFixed(3)}°E
                    {waterData.soilMoistureAdjustmentFactor !== undefined
                      ? ` · Probe Mult ×${waterData.soilMoistureAdjustmentFactor}`
                      : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-white">
                    <div className="text-[#858D86] text-[10px]">1. Open-Meteo ET0</div>
                    <div className="text-lg font-bold text-[#202820] mt-1">{waterData.et0_mm} mm</div>
                    <div className="text-[10px] text-[#4D966B]">NWP Model</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-white">
                    <div className="text-[#858D86] text-[10px]">2. Crop Kc</div>
                    <div className="text-lg font-bold text-[#202820] mt-1">{waterData.kc}</div>
                    <div className="text-[10px] text-[#4D966B]">{selectedCrop.split('(')[0]}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-white">
                    <div className="text-[#858D86] text-[10px]">3. Crop ETc</div>
                    <div className="text-lg font-bold text-[#174C36] mt-1">{waterData.etc_mm} mm</div>
                    <div className="text-[10px] text-[#858D86]">Kc × ET0</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#DDEDE2]/80 border border-[#4D966B]/20">
                    <div className="text-[#174C36] text-[10px]">4. Gross Need</div>
                    <div className="text-lg font-bold text-[#174C36] mt-1">
                      {waterData.grossWaterNeed_mm} mm
                    </div>
                    <div className="text-[10px] text-[#4D966B]">
                      Eff. {waterData.irrigationEfficiencyPercent}%
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#DDEDE2]/55 border border-[#4D966B]/15 flex items-start gap-3 text-xs text-[#202820]">
                  <Droplets className="w-5 h-5 text-[#174C36] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {currentLang === 'te' ? waterData.recommendationTextTe : waterData.recommendationText}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-panel rounded-[20px] p-5">
                  <div className="text-xs font-semibold text-[#858D86]">Daily Water / Acre</div>
                  <div className="text-2xl font-extrabold text-[#202820] font-display tabular-nums mt-1">
                    {waterData.dailyLitersPerAcre.toLocaleString('en-IN')} L
                  </div>
                  <div className="text-[11px] font-mono text-[#4D966B] mt-1">
                    {waterData.grossWaterNeed_mm} mm/day
                  </div>
                </div>

                <div className="glass-panel rounded-[20px] p-5">
                  <div className="text-xs font-semibold text-[#858D86]">
                    Total Farm Volume ({farm.areaAcres} Ac)
                  </div>
                  <div className="text-2xl font-extrabold text-[#174C36] font-display tabular-nums mt-1">
                    {waterData.totalDailyLitersFarm.toLocaleString('en-IN')} L
                  </div>
                  <div className="text-[11px] font-mono text-[#858D86] mt-1">
                    7d: {waterData.weeklyLitersFarm.toLocaleString('en-IN')} L
                  </div>
                </div>

                <div className="glass-panel rounded-[20px] p-5">
                  <div className="text-xs font-semibold text-[#858D86]">Pump Duration ({pumpMotorHp} HP)</div>
                  <div className="text-2xl font-extrabold text-[#202820] font-display tabular-nums mt-1">
                    {waterData.pumpingHoursDaily} Hrs
                  </div>
                  <div className="text-[11px] font-mono text-[#4D966B] mt-1">
                    {waterData.nextIrrigationDate}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 7-Day Rain-Adjusted Irrigation Calendar */}
      {waterData && (
        <div className="glass-panel rounded-[24px] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#202820] font-display">
                7-Day Rain-Adjusted Irrigation Schedule
              </h3>
              <p className="text-xs text-[#858D86] mt-0.5">
                Effective precipitation calculated using the USDA Soil Conservation Service model over Open-Meteo 7-day precipitation forecasts.
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#174C36] bg-[#DDEDE2] px-3 py-1 rounded-xl font-semibold">
              Synced with Open-Meteo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
            {waterData.weeklySchedule.map((s, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-[18px] border text-center flex flex-col justify-between text-xs transition-all ${
                  s.rainMm >= 4
                    ? 'bg-sky-50/80 border-sky-200'
                    : 'bg-white/80 border-white hover:border-[#4D966B]/40'
                }`}
              >
                <div>
                  <div className="font-bold text-[#202820]">
                    {currentLang === 'te' ? s.dayTe : s.day}
                  </div>
                  <div className="text-[11px] text-[#858D86] mt-0.5 font-mono">{s.date}</div>
                  <div className="my-3 flex justify-center">
                    {s.rainMm >= 4 ? (
                      <CloudRain className="w-6 h-6 text-sky-600" />
                    ) : (
                      <Sun className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#174C36]/10">
                  {s.rainMm >= 4 ? (
                    <div>
                      <span className="font-bold text-sky-900 block">{s.rainMm} mm Rain</span>
                      <span className="text-[10px] text-sky-700 font-medium">Pause Pump</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold text-[#202820] block tabular-nums">{s.waterMm} mm</span>
                      <span className="text-[10px] text-[#858D86] block tabular-nums font-mono">
                        {s.litersPerAcre.toLocaleString('en-IN')} L/Ac
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-[#174C36]/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {waterData.waterSavingTips.map((tip, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/75 border border-white flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#4D966B] shrink-0 mt-0.5" />
                <span className="text-[#5D665E] leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() =>
                onOpenAssistant(`How should I schedule drip irrigation for ${selectedCrop} in ${farm.district}?`)
              }
              className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#4D966B]" />
              <span>Ask Rythu Nestham about Irrigation Scheduling</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
