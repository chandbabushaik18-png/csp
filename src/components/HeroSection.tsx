import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CloudSun,
  Satellite,
  Droplets,
  MapPin,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { FarmProfile, IotDeviceStatus, Language, SatelliteAnalysis, WeatherData } from '../types';
import { translations } from '../translations';

interface HeroSectionProps {
  currentLang: Language;
  farm?: FarmProfile;
  weather?: WeatherData | null;
  satelliteData?: SatelliteAnalysis | null;
  iotStatus?: IotDeviceStatus | null;
  onExplore: (tab: string) => void;
  onOpenAssistant: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentLang,
  farm,
  weather,
  satelliteData,
  iotStatus,
  onExplore,
  onOpenAssistant,
}) => {
  const t = translations[currentLang];

  const soilMoistureValue =
    iotStatus?.connected && iotStatus.latestTelemetry
      ? `${iotStatus.latestTelemetry.soilMoisturePercent}%`
      : 'Offline';

  const soilMoistureSub =
    iotStatus?.connected && iotStatus.latestTelemetry
      ? 'ESP32 Live Sensor'
      : 'IoT Offline · Simulation Ready';

  return (
    <section className="relative">
      {/* Main Apple-grade Aerial Farmland Canvas */}
      <div className="relative rounded-[28px] overflow-hidden min-h-[540px] lg:min-h-[580px] flex flex-col justify-between shadow-[0_24px_64px_-20px_rgba(23,76,54,0.28)] border border-white/60 bg-[#174C36]">
        {/* High-res Aerial Farmland Photography with subtle entrance scale */}
        <motion.img
          initial={{ scale: 1.04, opacity: 0.9 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          src="/src/assets/images/hero_aerial_farmland_1794838846985.jpg"
          alt="Aerial precision agriculture terraced farmland at sunrise"
          className="absolute inset-0 w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />

        {/* Editorial Atmospheric Gradient Overlay for crisp readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(16, 40, 29, 0.86) 0%, rgba(18, 48, 34, 0.62) 48%, rgba(16, 40, 29, 0.25) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-44 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(14, 34, 24, 0.72) 0%, rgba(14, 34, 24, 0) 100%)',
          }}
        />

        {/* Top Row: Subtle Tag & Verification */}
        <div className="relative z-10 p-6 sm:p-10 lg:p-12 pb-0 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2.5 text-xs font-medium text-white/90 bg-white/12 backdrop-blur-xl px-3.5 py-1.5 rounded-2xl border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 text-[#DDEDE2]" />
            <span>{t.heroTag}</span>
            <span className="text-white/40">·</span>
            <span className="text-[#DDEDE2] font-mono text-[11px]">Copernicus + Open-Meteo</span>
          </div>

          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/25 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#DDEDE2]" />
            <span>{t.btnAskAI}</span>
          </button>
        </div>

        {/* Center Editorial Headline & Primary Actions */}
        <div className="relative z-10 px-6 sm:px-10 lg:px-12 py-8 max-w-2xl space-y-5">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-white font-display tracking-tight leading-[1.06]"
          >
            {t.heroHeadline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm sm:text-base lg:text-[17px] text-[#E9F2EC] leading-relaxed max-w-xl font-normal"
          >
            {t.heroSubhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <button
              type="button"
              onClick={() => onExplore('dashboard')}
              className="px-6 py-3.5 text-sm font-semibold text-[#174C36] bg-white hover:bg-[#DDEDE2] rounded-[14px] transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span>Explore My Farm</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onExplore('satellite')}
              className="px-6 py-3.5 text-sm font-semibold text-white bg-white/14 hover:bg-white/22 backdrop-blur-xl border border-white/25 rounded-[14px] transition-all cursor-pointer"
            >
              Explore Intelligence
            </button>
          </motion.div>
        </div>

        {/* Bottom Floating Liquid Glass Telemetry Panels */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="relative z-10 p-6 sm:p-10 lg:px-12 lg:pb-10 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
        >
          {/* Panel 1: Current Weather */}
          <button
            type="button"
            onClick={() => onExplore('weather')}
            className="glass-dark-overlay rounded-[20px] p-4 text-left hover:bg-white/18 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
              <span className="flex items-center gap-1.5">
                <CloudSun className="w-3.5 h-3.5 text-[#DDEDE2]" />
                <span>Current Weather</span>
              </span>
              <span className="font-mono text-[10px] text-[#DDEDE2]/90">LIVE API</span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-display tabular-nums">
                {weather ? `${weather.current.temp}°C` : '--°C'}
              </span>
              <span className="text-xs text-white/80 truncate">
                {weather ? (currentLang === 'te' ? weather.current.descriptionTe : weather.current.condition) : 'Syncing...'}
              </span>
            </div>
            <div className="text-[11px] text-white/70 mt-1 font-mono tabular-nums">
              Wind {weather?.current.windSpeedKmh ?? '--'} km/h · RH {weather?.current.humidity ?? '--'}%
            </div>
          </button>

          {/* Panel 2: Crop Health */}
          <button
            type="button"
            onClick={() => onExplore('satellite')}
            className="glass-dark-overlay rounded-[20px] p-4 text-left hover:bg-white/18 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
              <span className="flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#DDEDE2]" />
                <span>Crop Health</span>
              </span>
              <span className="font-mono text-[10px] text-[#DDEDE2]/90">SENTINEL-2</span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-display tabular-nums">
                {satelliteData ? satelliteData.meanNdvi.toFixed(2) : '0.72'}
              </span>
              <span className="text-xs text-[#DDEDE2] font-medium">NDVI Index</span>
            </div>
            <div className="text-[11px] text-white/70 mt-1 truncate">
              {satelliteData
                ? `${satelliteData.areaBreakdown.healthyVegetationPercent}% vigorous canopy`
                : 'Copernicus 10m scan'}
            </div>
          </button>

          {/* Panel 3: Soil Moisture */}
          <button
            type="button"
            onClick={() => onExplore('iot')}
            className="glass-dark-overlay rounded-[20px] p-4 text-left hover:bg-white/18 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
              <span className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#DDEDE2]" />
                <span>Soil Moisture</span>
              </span>
              <span className="font-mono text-[10px] text-amber-200/95">
                {iotStatus?.connected ? 'ESP32 LIVE' : 'NO SENSOR'}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-display tabular-nums">
                {soilMoistureValue}
              </span>
              <span className="text-xs text-white/80 truncate">
                {iotStatus?.connected ? 'Root Zone' : 'Demo Slider Available'}
              </span>
            </div>
            <div className="text-[11px] text-white/70 mt-1 truncate">{soilMoistureSub}</div>
          </button>

          {/* Panel 4: Farm Location */}
          <button
            type="button"
            onClick={() => onExplore('location')}
            className="glass-dark-overlay rounded-[20px] p-4 text-left hover:bg-white/18 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#DDEDE2]" />
                <span>Farm Location</span>
              </span>
              <span className="font-mono text-[10px] text-[#DDEDE2]/90">
                {farm?.gpsAccuracyMeters ? `±${farm.gpsAccuracyMeters}m` : 'PARCEL'}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-lg font-bold text-white font-display truncate">
                {farm?.village || 'Pedavadlapudi'}
              </span>
            </div>
            <div className="text-[11px] text-white/70 mt-1 font-mono tabular-nums truncate">
              {farm ? `${farm.district} · ${farm.areaAcres.toFixed(1)} Ac` : 'Guntur · 3.2 Ac'}
            </div>
          </button>
        </motion.div>
      </div>
    </section>
  );
};
