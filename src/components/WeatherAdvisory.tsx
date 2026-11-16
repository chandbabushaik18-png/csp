import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CloudRain,
  Sun,
  Clock,
  Gauge,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { Language, WeatherData } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface WeatherAdvisoryProps {
  currentLang: Language;
  weather: WeatherData | null;
  loading: boolean;
  onRefreshLocation: (district?: string) => void;
  onUseGps: () => void;
}

export const WeatherAdvisory: React.FC<WeatherAdvisoryProps> = ({
  currentLang,
  weather,
  loading,
  onRefreshLocation,
  onUseGps,
}) => {
  const t = translations[currentLang];
  const [activeView, setActiveView] = useState<'hourly' | '7day'>('hourly');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState<number>(600);

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          onRefreshLocation();
          setLastRefreshedAt(new Date());
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onRefreshLocation]);

  const handleManualRefresh = () => {
    onRefreshLocation();
    setLastRefreshedAt(new Date());
    setAutoRefreshCountdown(600);
  };

  const getSprayBadgeClass = (badge?: string) => {
    if (badge === 'ideal') return 'bg-[#DDEDE2] text-[#174C36] border-[#4D966B]/30';
    if (badge === 'moderate') return 'bg-amber-100 text-amber-900 border-amber-300';
    return 'bg-red-100 text-red-900 border-red-300';
  };

  const minutesRemaining = Math.floor(autoRefreshCountdown / 60);
  const secondsRemaining = autoRefreshCountdown % 60;

  return (
    <div className="space-y-6 pb-8">
      {/* Main Current Microclimate Glass Panel */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                Hyper-Local Farm Meteorology
              </span>
              {weather?.provenance && <DataProvenanceBadge provenance={weather.provenance} />}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.weatherTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
              Real-time atmospheric telemetry and 7-day forecast from Open-Meteo numerical weather prediction for your farm coordinates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={loading}
              className="px-3.5 py-2.5 text-xs font-semibold text-[#202820] bg-white/80 hover:bg-white rounded-[12px] transition-colors border border-[#174C36]/15 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4D966B] ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Feed'}</span>
            </button>

            <button
              type="button"
              onClick={onUseGps}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#174C36] hover:bg-[#113A29] rounded-[12px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Detect Farm GPS</span>
            </button>
          </div>
        </div>

        {/* Timestamps & Coordinates */}
        <div className="mt-4 pt-4 border-t border-[#174C36]/10 flex flex-wrap items-center justify-between text-[11px] text-[#858D86] gap-2">
          <div className="flex items-center gap-2 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#4D966B]" />
            <span>Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>·</span>
            <span>Auto-sync in {minutesRemaining}m {secondsRemaining}s</span>
          </div>

          {weather?.location && (
            <div className="font-mono text-[#174C36] bg-[#DDEDE2]/75 px-2.5 py-1 rounded-xl font-semibold">
              {weather.location.lat.toFixed(4)}°N, {weather.location.lon.toFixed(4)}°E
            </div>
          )}
        </div>

        {weather ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 pt-6 border-t border-[#174C36]/10 items-center">
            <div className="lg:col-span-5 flex items-center gap-5">
              <div className="p-4 bg-[#DDEDE2] rounded-[22px] text-[#174C36]">
                <CloudSun className="w-14 h-14" />
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-extrabold text-[#202820] font-display tabular-nums">
                  {weather.current.temp}°C
                </div>
                <div className="text-sm font-semibold text-[#202820] mt-1 capitalize">
                  {currentLang === 'te' ? weather.current.descriptionTe : weather.current.description}
                </div>
                <div className="text-xs text-[#858D86] mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#4D966B]" />
                  <span>{weather.location.city}</span>
                  <span>·</span>
                  <span>Feels {weather.current.feelsLike}°C</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 p-5 rounded-[20px] bg-white/80 border border-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#858D86]">
                  Chemical & Spraying Safety Window
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${getSprayBadgeClass(weather.current.sprayBadge)}`}>
                  {weather.current.sprayBadge.toUpperCase()}
                </span>
              </div>

              <div className="text-base font-bold text-[#202820] flex items-center gap-2 font-display">
                {weather.current.sprayBadge === 'ideal' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#174C36] shrink-0" />
                ) : weather.current.sprayBadge === 'moderate' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{weather.current.sprayCondition}</span>
              </div>

              <p className="text-xs text-[#5D665E] leading-relaxed">
                {weather.current.sprayBadge === 'ideal'
                  ? `Low drift profile (${weather.current.windSpeedKmh} km/h wind, ${weather.current.rainProbability}% rain risk). Droplets adhere effectively.`
                  : `Elevated drift or wash-off risk (${weather.current.windSpeedKmh} km/h wind, ${weather.current.rainProbability}% rain chance). Postpone chemical spraying.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[#858D86] text-xs">
            {loading ? 'Retrieving live meteorology data...' : 'Click Detect Farm GPS above to sync weather.'}
          </div>
        )}

        {weather && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6 pt-6 border-t border-[#174C36]/10 text-xs">
            {[
              { icon: Droplets, label: 'Humidity', val: `${weather.current.humidity}%`, sub: 'Relative RH' },
              { icon: Wind, label: 'Wind Speed', val: `${weather.current.windSpeedKmh} km/h`, sub: `Dir ${weather.current.windDirectionDeg}°` },
              { icon: Gauge, label: 'Pressure', val: `${weather.current.pressure} hPa`, sub: 'Surface' },
              { icon: CloudRain, label: 'Rain Prob.', val: `${weather.current.rainProbability}%`, sub: `${weather.current.precipitationMm} mm ppt` },
              { icon: Sunrise, label: 'Sunrise', val: weather.current.sunrise, sub: 'AM Spray Start' },
              { icon: Sunset, label: 'Sunset', val: weather.current.sunset, sub: 'Evening Window' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="p-3.5 bg-white/80 rounded-[16px] border border-white">
                  <div className="text-[#858D86] flex items-center gap-1.5 text-[11px]">
                    <Icon className="w-3.5 h-3.5 text-[#4D966B]" />
                    <span>{item.label}</span>
                  </div>
                  <div className="text-base font-bold text-[#202820] tabular-nums mt-1 font-display">
                    {item.val}
                  </div>
                  <div className="text-[10px] text-[#858D86] mt-0.5 font-mono">{item.sub}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hourly & 7-Day Forecast Matrix */}
      {weather && (
        <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#202820] font-display">
                Precision Agricultural Forecast
              </h3>
              <p className="text-xs text-[#858D86] mt-0.5">
                ECMWF & NOAA GFS numerical weather assimilation.
              </p>
            </div>

            <div className="flex items-center bg-white/75 border border-white p-1 rounded-xl self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveView('hourly')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeView === 'hourly' ? 'bg-[#174C36] text-white' : 'text-[#5D665E]'
                }`}
              >
                24-Hour
              </button>
              <button
                type="button"
                onClick={() => setActiveView('7day')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeView === '7day' ? 'bg-[#174C36] text-white' : 'text-[#5D665E]'
                }`}
              >
                7-Day
              </button>
            </div>
          </div>

          {activeView === 'hourly' && weather.hourly && (
            <div className="overflow-x-auto pb-2">
              <div className="flex items-stretch gap-3 min-w-[700px]">
                {weather.hourly.slice(0, 12).map((h, idx) => (
                  <div
                    key={idx}
                    className="flex-1 p-3.5 rounded-[18px] border border-white bg-white/80 text-center flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-mono font-bold text-[#5D665E]">{h.time}</div>
                    <div className="my-2.5 flex justify-center">
                      {h.rainChance > 40 ? (
                        <CloudRain className="w-5 h-5 text-sky-600" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="text-base font-extrabold text-[#202820] font-display tabular-nums">
                      {h.temp}°C
                    </div>
                    <div className="text-[10px] text-sky-700 font-semibold mt-1">{h.rainChance}% Rain</div>
                    <div className="text-[10px] text-[#858D86] font-mono mt-0.5">{h.windSpeedKmh} km/h</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === '7day' && weather.forecast && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {weather.forecast.map((f, i) => (
                <div
                  key={i}
                  className="p-4 rounded-[18px] border border-white bg-white/80 text-center flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[#202820]">
                      {currentLang === 'te' ? f.dayTe : f.day}
                    </div>
                    <div className="text-[10px] text-[#858D86] font-mono mt-0.5">{f.date}</div>
                    <div className="my-3 flex justify-center">
                      {f.rainChance > 35 ? (
                        <CloudRain className="w-7 h-7 text-sky-600" />
                      ) : (
                        <Sun className="w-7 h-7 text-amber-500" />
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-[#5D665E] line-clamp-1">{f.condition}</div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#174C36]/10">
                    <div className="text-sm font-bold text-[#202820] font-display tabular-nums">
                      {f.tempMax}° / {f.tempMin}°
                    </div>
                    <div className="text-[11px] text-sky-700 font-semibold mt-1">
                      {f.rainChance}% ({f.rainfallMm}mm)
                    </div>
                    {f.et0_mm !== undefined && (
                      <div className="text-[10px] text-[#4D966B] font-mono mt-0.5 font-semibold">
                        ET0 {f.et0_mm}mm
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
