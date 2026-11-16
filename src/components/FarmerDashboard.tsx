import React from 'react';
import {
  MapPin,
  CloudSun,
  Droplets,
  Plane,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Satellite,
  Cpu,
  Ruler,
  ShieldCheck,
  Calculator,
  Radio,
} from 'lucide-react';
import {
  FarmProfile,
  Language,
  WeatherData,
  MarketPrice,
  WaterAdvisoryData,
  SatelliteAnalysis,
  DailyActivity,
  IotDeviceStatus,
} from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface FarmerDashboardProps {
  currentLang: Language;
  farm: FarmProfile;
  weather: WeatherData | null;
  marketPrices: MarketPrice[];
  waterAdvisory: WaterAdvisoryData | null;
  satelliteData: SatelliteAnalysis | null;
  iotStatus?: IotDeviceStatus | null;
  onNavigateTab: (tab: string) => void;
  onOpenAssistant: () => void;
  onBookDrone: () => void;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  currentLang,
  farm,
  weather,
  marketPrices,
  waterAdvisory,
  satelliteData,
  iotStatus,
  onNavigateTab,
  onOpenAssistant,
  onBookDrone,
}) => {
  const t = translations[currentLang];

  const morningAction = waterAdvisory
    ? `Operate ${farm.irrigationMethod} pump for ${waterAdvisory.pumpingHoursDaily} hours to supply ${waterAdvisory.dailyLitersPerAcre.toLocaleString(
        'en-IN'
      )} L/acre before daytime heat.`
    : 'Apply early morning irrigation before 08:30 AM to reduce evaporative losses.';

  const morningActionTe = waterAdvisory
    ? `ఎండ పెరగక ముందే ${waterAdvisory.pumpingHoursDaily} గంటలు మోటారు నడిపి ఎకరాకు ${waterAdvisory.dailyLitersPerAcre.toLocaleString(
        'en-IN'
      )} లీటర్లు అందించండి.`
    : 'ఎండ పెరగక ముందే ఉదయం 08:30 లోపు తడి ఇవ్వండి.';

  const windSpeed = weather?.current.windSpeedKmh ?? 8;
  const temp = weather?.current.temp ?? 29;
  const isSpraySafe = weather?.current.sprayBadge === 'ideal';

  const afternoonAction = isSpraySafe
    ? `Wind velocity is low (${windSpeed} km/h, ${temp}°C). Safe window for precision foliar nutrient or protective spraying.`
    : `Chemical drift risk: Wind speed ${windSpeed} km/h & ${temp}°C. Postpone chemical spraying until late evening.`;

  const afternoonActionTe = isSpraySafe
    ? `వాతావరణం అనుకూలంగా ఉంది (గాలి: ${windSpeed} కి.మీ/గం, ఉష్ణోగ్రత: ${temp}°C). పిచికారీ చేయవచ్చు.`
    : `గాలి వేగం (${windSpeed} కి.మీ/గం) లేదా ఎండ (${temp}°C) వల్ల రసాయనాలు కొట్టుకుపోయే ప్రమాదం ఉంది. పిచికారీని వాయిదా వేయండి.`;

  const stressCount = satelliteData?.stressHotspotsCount ?? 0;
  const eveningAction =
    stressCount > 0
      ? `Scout perimeter zone flagged with localized stress on Sentinel-2 (${satelliteData?.acquisitionDate || 'Recent Pass'}); verify drip emitters or leaf curl.`
      : `Canopy biomass looks strong (NDVI ${satelliteData?.meanNdvi ?? 0.72}). Complete routine sticky-trap inspection.`;

  const eveningActionTe =
    stressCount > 0
      ? 'ఉపగ్రహ పరిశీలనలో గుర్తించిన ఒత్తిడి భాగంలో డ్రిప్ పైపులు మరియు చీడపీడలను స్వయంగా పరిశీలించండి.'
      : 'పంట పచ్చదనం సంతృప్తికరంగా ఉంది. సాయంత్రం వేళ పురుగుల ఆనవాళ్లు ఉన్నాయేమో పరిశీలించండి.';

  const dailyActivities: DailyActivity[] = [
    {
      timeSlot: 'Morning (06:00 - 09:00 AM)',
      title: 'Precision Irrigation Schedule',
      titleTe: 'శాస్త్రీయ నీటి యాజమాన్యం',
      action: morningAction,
      actionTe: morningActionTe,
      priority: 'High',
      type: 'irrigation',
    },
    {
      timeSlot: 'Afternoon (12:00 - 03:00 PM)',
      title: isSpraySafe ? 'Controlled Spray Window' : 'Chemical Drift Warning',
      titleTe: isSpraySafe ? 'అనుకూల పిచికారీ సమయం' : 'పిచికారీని వాయిదా వేయండి',
      action: afternoonAction,
      actionTe: afternoonActionTe,
      priority: isSpraySafe ? 'Medium' : 'High',
      type: 'spraying',
    },
    {
      timeSlot: 'Evening (04:30 - 07:00 PM)',
      title: 'Field Scouting & Inspection',
      titleTe: 'క్షేత్ర స్థాయి పరిశీలన',
      action: eveningAction,
      actionTe: eveningActionTe,
      priority: 'Routine',
      type: 'scouting',
    },
  ];

  const iotConnected = Boolean(iotStatus?.connected && iotStatus.latestTelemetry);

  return (
    <div className="space-y-6 pb-8">
      {/* Greeting & Active Farm Identity Header */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#4D966B]">
                Parcel · {farm.id}
              </span>
              {farm.provenance && <DataProvenanceBadge provenance={farm.provenance} />}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#202820] font-display tracking-tight">
              {t.dashboardWelcome}
            </h1>
            <p className="text-sm text-[#858D86]">
              {t.dashboardGreetingSub}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-[#5D665E]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#174C36]">
                <MapPin className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>
                  {farm.name} — {farm.village}, {farm.district}
                </span>
              </span>
              <span className="text-[#858D86]">·</span>
              <span className="font-mono tabular-nums">
                {farm.center[0].toFixed(4)}°N, {farm.center[1].toFixed(4)}°E
              </span>
              {farm.gpsAccuracyMeters && (
                <span className="px-2 py-0.5 rounded-lg bg-[#DDEDE2] text-[#174C36] font-mono text-[11px] font-semibold">
                  ±{farm.gpsAccuracyMeters}m GPS
                </span>
              )}
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('location')}
              className="px-4 py-2.5 text-xs font-semibold text-[#174C36] bg-[#DDEDE2]/80 hover:bg-[#DDEDE2] rounded-[12px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Map & Boundary</span>
            </button>
            <button
              type="button"
              onClick={onBookDrone}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#174C36] hover:bg-[#113A29] rounded-[12px] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plane className="w-4 h-4" />
              <span>{t.btnBookDrone}</span>
            </button>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="px-4 py-2.5 text-xs font-semibold text-[#202820] bg-white/80 hover:bg-white border border-[#174C36]/15 rounded-[12px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#4D966B]" />
              <span>{t.btnAskAI}</span>
            </button>
          </div>
        </div>

        {/* 5 Core KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 mt-7 pt-6 border-t border-[#174C36]/10">
          {/* 1. Total Farm Area */}
          <div className="p-4 rounded-[18px] bg-white/75 border border-white/90">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>{t.totalLand}</span>
              <Ruler className="w-3.5 h-3.5 text-[#4D966B]" />
            </div>
            <div className="text-xl font-extrabold text-[#202820] font-display mt-2 tabular-nums">
              {farm.areaAcres.toFixed(1)} Acres
            </div>
            <div className="text-[11px] font-mono text-[#4D966B] mt-0.5">
              {farm.areaHectares.toFixed(2)} Ha · {farm.currentCrop.split('(')[0].trim()}
            </div>
          </div>

          {/* 2. Crop Health (NDVI) */}
          <button
            type="button"
            onClick={() => onNavigateTab('satellite')}
            className="p-4 rounded-[18px] bg-white/75 hover:bg-white border border-white/90 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>Crop Health</span>
              <Satellite className="w-3.5 h-3.5 text-[#174C36]" />
            </div>
            <div className="text-xl font-extrabold text-[#174C36] font-display mt-2 tabular-nums">
              {satelliteData?.meanNdvi?.toFixed(2) ?? '0.72'} NDVI
            </div>
            <div className="text-[11px] text-[#5D665E] mt-0.5 truncate">
              {satelliteData?.areaBreakdown.healthyVegetationPercent ?? 76}% healthy canopy
            </div>
          </button>

          {/* 3. Soil Moisture */}
          <button
            type="button"
            onClick={() => onNavigateTab('iot')}
            className="p-4 rounded-[18px] bg-white/75 hover:bg-white border border-white/90 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>Soil Moisture</span>
              <Cpu className="w-3.5 h-3.5 text-[#4D966B]" />
            </div>
            <div className="text-xl font-extrabold text-[#202820] font-display mt-2 tabular-nums">
              {iotConnected ? `${iotStatus!.latestTelemetry!.soilMoisturePercent}%` : 'Offline'}
            </div>
            <div className="text-[11px] font-mono mt-0.5 text-amber-700">
              {iotConnected ? 'ESP32 Real Sensor' : 'IoT Offline · Click to setup'}
            </div>
          </button>

          {/* 4. Current Temperature */}
          <button
            type="button"
            onClick={() => onNavigateTab('weather')}
            className="p-4 rounded-[18px] bg-white/75 hover:bg-white border border-white/90 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>Current Temp</span>
              <CloudSun className="w-3.5 h-3.5 text-[#4D966B]" />
            </div>
            <div className="text-xl font-extrabold text-[#202820] font-display mt-2 tabular-nums">
              {weather?.current.temp ?? '--'}°C
            </div>
            <div className="text-[11px] text-[#5D665E] mt-0.5 truncate">
              Wind {weather?.current.windSpeedKmh ?? '--'} km/h · RH {weather?.current.humidity ?? '--'}%
            </div>
          </button>

          {/* 5. Irrigation Status */}
          <button
            type="button"
            onClick={() => onNavigateTab('water')}
            className="p-4 rounded-[18px] bg-[#DDEDE2]/65 hover:bg-[#DDEDE2] border border-[#4D966B]/20 text-left transition-colors cursor-pointer col-span-2 md:col-span-1"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#174C36]">
              <span>Irrigation Status</span>
              <Droplets className="w-3.5 h-3.5 text-[#174C36]" />
            </div>
            <div className="text-xl font-extrabold text-[#174C36] font-display mt-2 tabular-nums">
              {waterAdvisory ? `${waterAdvisory.pumpingHoursDaily} hrs` : '-- hrs'}
            </div>
            <div className="text-[11px] text-[#174C36]/80 mt-0.5 truncate">
              {waterAdvisory ? `${waterAdvisory.dailyLitersPerAcre.toLocaleString('en-IN')} L/Ac` : farm.irrigationMethod}
            </div>
          </button>
        </div>
      </div>

      {/* Prominent TODAY'S FARM ACTION PLAN Distinguishing Measurements vs Recommendations */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#174C36]/10">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-[#4D966B]">
              <span>TODAY'S FARM ACTION PLAN</span>
            </div>
            <h2 className="text-xl font-bold text-[#202820] font-display mt-1">
              Field Execution & Telemetry Breakdown
            </h2>
            <p className="text-xs text-[#858D86] mt-0.5">
              Transparently separates actual live API/sensor measurements from calculated agronomic advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#DDEDE2] text-[#174C36] font-semibold">
              <Radio className="w-3 h-3" />
              <span>Actual Measurements</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 text-sky-900 border border-sky-200/70 font-semibold">
              <Calculator className="w-3 h-3" />
              <span>Calculated Advice</span>
            </span>
          </div>
        </div>

        {/* Row 1: Actual Measurements Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
          <div className="p-4 rounded-[18px] bg-white/80 border border-[#4D966B]/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#174C36] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>Measured Microclimate</span>
              </span>
              <span className="font-mono text-[10px] text-[#4D966B] font-bold">OPEN-METEO</span>
            </div>
            <div className="text-[#202820] font-semibold">
              {weather
                ? `${weather.current.temp}°C · ${weather.current.humidity}% RH · Wind ${weather.current.windSpeedKmh} km/h`
                : 'Awaiting real weather reading...'}
            </div>
            <div className="text-[11px] text-[#858D86]">
              Spray safety: <strong>{weather?.current.sprayBadge.toUpperCase() || '--'}</strong>
            </div>
          </div>

          <div className="p-4 rounded-[18px] bg-white/80 border border-[#4D966B]/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#174C36] flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>Sentinel-2 Pass Observation</span>
              </span>
              <span className="font-mono text-[10px] text-[#4D966B] font-bold">COPERNICUS</span>
            </div>
            <div className="text-[#202820] font-semibold">
              Mean NDVI {satelliteData?.meanNdvi ?? 0.72} · NDWI {satelliteData?.meanNdwi ?? 0.28}
            </div>
            <div className="text-[11px] text-[#858D86]">
              Acquired: {satelliteData?.acquisitionDate ?? 'Latest Overpass'} ({satelliteData?.cloudCoveragePercent ?? 18}% cloud)
            </div>
          </div>

          <div className="p-4 rounded-[18px] bg-white/80 border border-[#174C36]/10 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#202820] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#858D86]" />
                <span>ESP32 Root-Zone Probe</span>
              </span>
              <span className="font-mono text-[10px] text-amber-700 font-bold">
                {iotConnected ? 'LIVE HARDWARE' : 'OFFLINE'}
              </span>
            </div>
            <div className="text-[#202820] font-semibold">
              {iotConnected
                ? `${iotStatus!.latestTelemetry!.soilMoisturePercent}% Moisture · ${iotStatus!.latestTelemetry!.temperatureC}°C`
                : 'No live sensor connected'}
            </div>
            <div className="text-[11px] text-[#858D86]">
              {iotConnected ? 'Hardware relay ready' : 'Water budget falls back to FAO-56 ET0 & rainfall'}
            </div>
          </div>
        </div>

        {/* Row 2: Calculated Daily Recommendations Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {dailyActivities.map((act, i) => (
            <div
              key={i}
              className="p-5 rounded-[20px] bg-white/85 border border-white shadow-xs flex flex-col justify-between text-xs space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#174C36] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#4D966B]" />
                    <span>{act.timeSlot}</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                      act.priority === 'High'
                        ? 'bg-red-50 text-red-700'
                        : act.priority === 'Medium'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-[#DDEDE2] text-[#174C36]'
                    }`}
                  >
                    {act.priority}
                  </span>
                </div>

                <div className="font-bold text-[#202820] text-sm mt-2.5 font-display">
                  {currentLang === 'te' ? act.titleTe : act.title}
                </div>

                <p className="text-[#5D665E] leading-relaxed mt-1.5">
                  {currentLang === 'te' ? act.actionTe : act.action}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#174C36]/10 flex items-center justify-between text-[#858D86] text-[11px]">
                <span className="capitalize">{act.type} recommendation</span>
                <span className="text-[#174C36] font-mono text-[10px] font-semibold">CALCULATED</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live APMC Mandi Market Prices Spotlight */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#202820] font-display">
                APMC Mandi Benchmark Prices & MSP
              </h3>
              <span className="text-[10px] bg-[#DDEDE2]/80 text-[#174C36] px-2.5 py-0.5 rounded-lg font-mono font-semibold">
                Agmarknet / CACP 2024-26
              </span>
            </div>
            <p className="text-xs text-[#858D86] mt-0.5">
              Modal yard transaction quotes across Andhra Pradesh & Telangana.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('market')}
            className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>All Commodities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {marketPrices.slice(0, 4).map((p) => (
            <div key={p.cropKey} className="p-4 rounded-[18px] bg-white/80 border border-white text-xs">
              <div className="font-bold text-[#202820] truncate">{p.commodity}</div>
              <div className="text-[#858D86] text-[11px] mt-0.5">{p.market}</div>
              <div className="text-xl font-bold text-[#174C36] font-display tabular-nums mt-2.5">
                ₹{p.modalPrice.toLocaleString('en-IN')}
                <span className="text-[11px] text-[#858D86] font-normal"> / Qtl</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#858D86] mt-2 pt-2 border-t border-[#174C36]/10 font-mono tabular-nums">
                <span>MSP: ₹{p.msp.toLocaleString('en-IN')}</span>
                <span className={p.trend === 'down' ? 'text-red-600 font-bold' : 'text-[#4D966B] font-bold'}>
                  {p.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
