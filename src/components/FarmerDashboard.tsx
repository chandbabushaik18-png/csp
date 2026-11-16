import React from 'react';
import {
  MapPin,
  CloudSun,
  Droplets,
  Plane,
  ArrowRight,
  Sparkles,
  Clock,
  Satellite,
  Cpu,
  Ruler,
  Calculator,
  Radio,
  AlertTriangle,
  RefreshCw,
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
  weatherError?: string | null;
  onRetryWeather?: () => void;
  marketPrices: MarketPrice[];
  marketMessage?: string | null;
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
  weatherError,
  onRetryWeather,
  marketPrices,
  marketMessage,
  waterAdvisory,
  satelliteData,
  iotStatus,
  onNavigateTab,
  onOpenAssistant,
  onBookDrone,
}) => {
  const t = translations[currentLang];
  const iotConnected = Boolean(iotStatus?.connected && iotStatus.latestTelemetry);
  const hasSatelliteScene = Boolean(satelliteData?.sceneId && satelliteData?.acquisitionDate);

  const morningAction = waterAdvisory
    ? `Operate ${farm.irrigationMethod} pump for ${waterAdvisory.pumpingHoursDaily} hours to supply ${waterAdvisory.dailyLitersPerAcre.toLocaleString(
        'en-IN'
      )} L/acre (calculated from Open-Meteo ET0 ${waterAdvisory.et0_mm} mm).`
    : 'Irrigation schedule awaits live Open-Meteo evapotranspiration retrieval for your coordinates.';

  const morningActionTe = waterAdvisory
    ? `Open-Meteo ET0 (${waterAdvisory.et0_mm} మి.మీ) ఆధారంగా ${waterAdvisory.pumpingHoursDaily} గంటలు మోటారు నడిపి ఎకరాకు ${waterAdvisory.dailyLitersPerAcre.toLocaleString(
        'en-IN'
      )} లీటర్లు అందించండి.`
    : 'నీటి లెక్కలు పొందడానికి వాతావరణ డేటా కోసం వేచి ఉంది.';

  const afternoonAction = weather
    ? weather.current.sprayBadge === 'ideal'
      ? `Model forecast shows low wind (${weather.current.windSpeedKmh} km/h, ${weather.current.temp}°C). Suitable window for foliar spraying.`
      : `Spraying caution: Forecast wind speed ${weather.current.windSpeedKmh} km/h & ${weather.current.temp}°C. Postpone chemical spraying.`
    : 'Weather forecast unavailable — verify local wind speed visually before spraying.';

  const afternoonActionTe = weather
    ? weather.current.sprayBadge === 'ideal'
      ? `గాలి వేగం తక్కువగా ఉంది (${weather.current.windSpeedKmh} కి.మీ/గం, ${weather.current.temp}°C). పిచికారీకి అనుకూలం.`
      : `గాలి వేగం (${weather.current.windSpeedKmh} కి.మీ/గం) లేదా ఉష్ణోగ్రత (${weather.current.temp}°C) వల్ల పిచికారీ వాయిదా వేయండి.`
    : 'వాతావరణ అంచనా అందుబాటులో లేదు — పిచికారీకి ముందు గాలిని పరిశీలించండి.';

  const eveningAction = hasSatelliteScene
    ? `Latest Sentinel-2 pass recorded on ${satelliteData!.acquisitionDate} (${satelliteData!.cloudCoveragePercent}% cloud cover). Inspect the field visually for pest or moisture stress.`
    : 'Walk field edges to inspect leaf undersides for thrips, mites, or moisture stress; capture clear leaf photos for AI Crop Doctor if needed.';

  const eveningActionTe = hasSatelliteScene
    ? `తాజా Sentinel-2 ఉపగ్రహ పాస్ (${satelliteData!.acquisitionDate}) నమోదైంది. పొలంలో ఆకుల అడుగు భాగాన్ని స్వయంగా పరిశీలించండి.`
    : 'సాయంత్రం పొలంలో ఆకులు మరియు చీడపీడలను స్వయంగా పరిశీలించండి.';

  const dailyActivities: DailyActivity[] = [
    {
      timeSlot: 'Morning (06:00 - 09:00 AM)',
      title: 'FAO-56 Irrigation Budget',
      titleTe: 'శాస్త్రీయ నీటి యాజమాన్యం',
      action: morningAction,
      actionTe: morningActionTe,
      priority: 'High',
      type: 'irrigation',
    },
    {
      timeSlot: 'Afternoon (12:00 - 03:00 PM)',
      title: weather?.current.sprayBadge === 'ideal' ? 'Spray Window Assessment' : 'Spray Drift Advisory',
      titleTe: weather?.current.sprayBadge === 'ideal' ? 'పిచికారీ అంచనా' : 'పిచికారీ హెచ్చరిక',
      action: afternoonAction,
      actionTe: afternoonActionTe,
      priority: weather?.current.sprayBadge === 'ideal' ? 'Medium' : 'High',
      type: 'spraying',
    },
    {
      timeSlot: 'Evening (04:30 - 07:00 PM)',
      title: 'Manual Field Scouting',
      titleTe: 'క్షేత్ర స్థాయి పరిశీలన',
      action: eveningAction,
      actionTe: eveningActionTe,
      priority: 'Routine',
      type: 'scouting',
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Farm Header & Core KPI Strip */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#4D966B]">
                Selected Plot · {farm.id}
              </span>
              {farm.provenance && <DataProvenanceBadge provenance={farm.provenance} />}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#202820] font-display tracking-tight">
              {t.dashboardWelcome}
            </h1>
            <p className="text-sm text-[#858D86]">{t.dashboardGreetingSub}</p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-[#5D665E]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#174C36]">
                <MapPin className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>
                  {farm.name} — {farm.village ? `${farm.village}, ` : ''}
                  {farm.district}
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
          {/* 1. Parcel Area */}
          <div className="p-4 rounded-[18px] bg-white/75 border border-white/90">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>{t.totalLand}</span>
              <Ruler className="w-3.5 h-3.5 text-[#4D966B]" />
            </div>
            <div className="text-xl font-extrabold text-[#202820] font-display mt-2 tabular-nums">
              {farm.areaAcres.toFixed(1)} Acres
            </div>
            <div className="text-[11px] font-mono text-[#4D966B] mt-0.5 truncate">
              {farm.areaHectares.toFixed(2)} Ha · {farm.currentCrop.split('(')[0].trim()}
            </div>
          </div>

          {/* 2. Sentinel-2 Satellite Pass */}
          <button
            type="button"
            onClick={() => onNavigateTab('satellite')}
            className="p-4 rounded-[18px] bg-white/75 hover:bg-white border border-white/90 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>Sentinel-2 Pass</span>
              <Satellite className="w-3.5 h-3.5 text-[#174C36]" />
            </div>
            <div className="text-lg font-extrabold text-[#174C36] font-display mt-2 tabular-nums truncate">
              {hasSatelliteScene ? satelliteData!.acquisitionDate : 'No Data'}
            </div>
            <div className="text-[11px] text-[#5D665E] mt-0.5 truncate">
              {hasSatelliteScene
                ? `${satelliteData!.cloudCoveragePercent}% cloud · ${
                    satelliteData!.meanNdvi !== null && satelliteData!.meanNdvi !== undefined
                      ? `NDVI ${satelliteData!.meanNdvi.toFixed(2)}`
                      : 'NDVI N/A'
                  }`
                : 'Open catalog to query'}
            </div>
          </button>

          {/* 3. Soil Moisture (ESP32) */}
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
              {iotConnected ? `${iotStatus!.latestTelemetry!.soilMoisturePercent}%` : 'No Data'}
            </div>
            <div className="text-[11px] font-mono mt-0.5 text-[#5D665E] truncate">
              {iotConnected ? 'ESP32 Live Sensor' : 'ESP32 Not Connected'}
            </div>
          </button>

          {/* 4. Weather Forecast */}
          <div className="p-4 rounded-[18px] bg-white/75 border border-white/90 text-left">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#858D86]">
              <span>Forecast Temp</span>
              <CloudSun className="w-3.5 h-3.5 text-[#4D966B]" />
            </div>
            {weatherError ? (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-bold text-amber-800">Unavailable</div>
                {onRetryWeather && (
                  <button
                    type="button"
                    onClick={onRetryWeather}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#174C36] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Weather</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('weather')}
                className="text-left w-full cursor-pointer"
              >
                <div className="text-xl font-extrabold text-[#202820] font-display mt-2 tabular-nums">
                  {weather ? `${weather.current.temp}°C` : '--'}
                </div>
                <div className="text-[11px] text-[#5D665E] mt-0.5 truncate">
                  {weather
                    ? `Wind ${weather.current.windSpeedKmh} km/h · RH ${weather.current.humidity}%`
                    : 'Loading Open-Meteo...'}
                </div>
              </button>
            )}
          </div>

          {/* 5. Irrigation Status */}
          <button
            type="button"
            onClick={() => onNavigateTab('water')}
            className="p-4 rounded-[18px] bg-[#DDEDE2]/65 hover:bg-[#DDEDE2] border border-[#4D966B]/20 text-left transition-colors cursor-pointer col-span-2 md:col-span-1"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#174C36]">
              <span>Water Budget</span>
              <Droplets className="w-3.5 h-3.5 text-[#174C36]" />
            </div>
            <div className="text-xl font-extrabold text-[#174C36] font-display mt-2 tabular-nums">
              {waterAdvisory ? `${waterAdvisory.pumpingHoursDaily} hrs` : 'No Data'}
            </div>
            <div className="text-[11px] text-[#174C36]/80 mt-0.5 truncate">
              {waterAdvisory
                ? `${waterAdvisory.dailyLitersPerAcre.toLocaleString('en-IN')} L/Ac`
                : farm.irrigationMethod}
            </div>
          </button>
        </div>
      </div>

      {/* Telemetry vs Calculated Breakdown */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#174C36]/10">
          <div>
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#4D966B]">
              DAILY OPERATIONS SUMMARY
            </div>
            <h2 className="text-xl font-bold text-[#202820] font-display mt-1">
              Data Source & Execution Breakdown
            </h2>
            <p className="text-xs text-[#858D86] mt-0.5">
              Separates model-based weather forecasts and periodic satellite scenes from calculated advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#DDEDE2] text-[#174C36] font-semibold">
              <Radio className="w-3 h-3" />
              <span>External APIs / Hardware</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 text-sky-900 border border-sky-200/70 font-semibold">
              <Calculator className="w-3 h-3" />
              <span>Calculated Formulas</span>
            </span>
          </div>
        </div>

        {/* Row 1: External Sources Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
          <div className="p-4 rounded-[18px] bg-white/80 border border-[#4D966B]/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#174C36] flex items-center gap-1.5">
                <CloudSun className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>Open-Meteo NWP Forecast</span>
              </span>
              <span className="font-mono text-[10px] text-[#4D966B] font-bold">
                {weatherError ? 'UNAVAILABLE' : weather ? 'LIVE DATA' : 'SYNCING'}
              </span>
            </div>
            {weatherError ? (
              <div className="text-amber-800 font-medium">{weatherError}</div>
            ) : (
              <>
                <div className="text-[#202820] font-semibold">
                  {weather
                    ? `${weather.current.temp}°C · ${weather.current.humidity}% RH · Wind ${weather.current.windSpeedKmh} km/h`
                    : 'Retrieving Open-Meteo model forecast...'}
                </div>
                <div className="text-[11px] text-[#858D86]">
                  Model estimate (not station sensor) · Spray:{' '}
                  <strong>{weather?.current.sprayBadge.toUpperCase() || '--'}</strong>
                </div>
              </>
            )}
          </div>

          <div className="p-4 rounded-[18px] bg-white/80 border border-[#4D966B]/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#174C36] flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#4D966B]" />
                <span>Copernicus Sentinel-2 Catalog</span>
              </span>
              <span className="font-mono text-[10px] text-[#4D966B] font-bold">
                {hasSatelliteScene ? 'LIVE DATA' : 'NO DATA'}
              </span>
            </div>
            <div className="text-[#202820] font-semibold">
              {hasSatelliteScene
                ? `Pass: ${satelliteData!.acquisitionDate} (${satelliteData!.cloudCoveragePercent}% cloud)`
                : 'No scene loaded for current parcel'}
            </div>
            <div className="text-[11px] text-[#858D86]">
              Pixel-level NDVI/NDWI computation: <span className="font-mono font-semibold">NO DATA</span>
            </div>
          </div>

          <div className="p-4 rounded-[18px] bg-white/80 border border-[#174C36]/10 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#202820] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#858D86]" />
                <span>ESP32 Soil Probe</span>
              </span>
              <span
                className={`font-mono text-[10px] font-bold ${
                  iotConnected ? 'text-[#174C36]' : 'text-[#858D86]'
                }`}
              >
                {iotConnected ? 'LIVE DATA' : 'NO DATA'}
              </span>
            </div>
            <div className="text-[#202820] font-semibold">
              {iotConnected
                ? `${iotStatus!.latestTelemetry!.soilMoisturePercent}% Moisture · ${iotStatus!.latestTelemetry!.temperatureC}°C`
                : 'ESP32 device is not connected'}
            </div>
            <div className="text-[11px] text-[#858D86]">
              {iotConnected
                ? `Last packet: ${new Date(iotStatus!.latestTelemetry!.receivedAt).toLocaleTimeString()}`
                : 'Water budget uses Open-Meteo ET0 & rainfall'}
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
                <span className="capitalize">{act.type} guidance</span>
                <span className="text-[#174C36] font-mono text-[10px] font-semibold">CALCULATED</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Prices Spotlight */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#202820] font-display">
                APMC Mandi Market Feed
              </h3>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-lg font-mono font-semibold ${
                  marketPrices.length > 0
                    ? 'bg-[#DDEDE2]/80 text-[#174C36]'
                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                {marketPrices.length > 0 ? 'LIVE DATA · Agmarknet' : 'UNAVAILABLE'}
              </span>
            </div>
            <p className="text-xs text-[#858D86] mt-0.5">
              Official APMC yard quotes retrieved from data.gov.in when API credentials are configured.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('market')}
            className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Open Market Prices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {marketPrices.length === 0 ? (
          <div className="mt-5 p-5 rounded-[18px] bg-amber-50/60 border border-amber-200/70 flex items-start gap-3 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Market data currently unavailable</div>
              <p className="text-amber-900 mt-0.5">
                {marketMessage || 'Agmarknet API credentials (DATA_GOV_API_KEY) are not configured on the server.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {marketPrices.slice(0, 4).map((p) => (
              <div key={p.cropKey} className="p-4 rounded-[18px] bg-white/80 border border-white text-xs">
                <div className="font-bold text-[#202820] truncate">{p.commodity}</div>
                <div className="text-[#858D86] text-[11px] mt-0.5 truncate">{p.market}</div>
                <div className="text-xl font-bold text-[#174C36] font-display tabular-nums mt-2.5">
                  ₹{p.modalPrice.toLocaleString('en-IN')}
                  <span className="text-[11px] text-[#858D86] font-normal"> / Qtl</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#858D86] mt-2 pt-2 border-t border-[#174C36]/10 font-mono tabular-nums">
                  <span>{p.msp ? `MSP: ₹${p.msp.toLocaleString('en-IN')}` : `As of ${p.asOfDate}`}</span>
                  <span className="font-bold text-[#4D966B]">{p.change}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
