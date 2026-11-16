/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SidebarNavigation,
  TopGlassBar,
  MobileBottomDock,
  getNavGroup,
} from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FarmerDashboard } from './components/FarmerDashboard';
import { FarmMapSection } from './components/FarmMapSection';
import { WaterManagementSection } from './components/WaterManagementSection';
import { SatelliteIntelligenceSection } from './components/SatelliteIntelligenceSection';
import { CropDoctorSection } from './components/CropDoctorSection';
import { CropRecommender } from './components/CropRecommender';
import { ProfitCalculator } from './components/ProfitCalculator';
import { WeatherAdvisory } from './components/WeatherAdvisory';
import { DroneBookingSection } from './components/DroneBookingSection';
import { IotHardwareSection } from './components/IotHardwareSection';
import { MarketPricesSection } from './components/MarketPricesSection';
import { LabourNetwork } from './components/LabourNetwork';
import { CommunityForum } from './components/CommunityForum';
import { AgriAssistantModal } from './components/AgriAssistantModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { safeFetchJson } from './utils/safeFetchJson';

import {
  AppNotification,
  DroneBooking,
  FarmProfile,
  IotDeviceStatus,
  Language,
  MarketPrice,
  RecommendedCrop,
  SatelliteAnalysis,
  ToastMessage,
  WaterAdvisoryData,
  WeatherData,
} from './types';
import { translations } from './translations';
import {
  Sprout,
  TrendingUp,
  CloudSun,
  ArrowRight,
  Sparkles,
  MapPin,
  Droplets,
  Satellite,
  Camera,
  LayoutGrid,
  Plane,
  Users,
  DollarSign,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

const DEFAULT_FARM: FarmProfile = {
  id: 'farm-default',
  name: 'Primary Farm Plot',
  center: [16.3067, 80.4365],
  boundary: [],
  areaAcres: 1.0,
  areaHectares: 0.4,
  village: 'Guntur Region',
  mandal: 'Guntur',
  district: 'Guntur',
  state: 'Andhra Pradesh',
  soilType: 'Black Cotton Soil (నల్లరేగడి నేల)',
  soilPh: 7.2,
  currentCrop: 'Chilli (మిర్చి)',
  cropStage: 'Mid-Season (Flowering/Fruiting)',
  irrigationMethod: 'Drip',
  waterSource: 'Borewell',
  lastUpdated: new Date().toISOString(),
  provenance: {
    integrityState: 'NO_DATA',
    classification: 'NO_DATA',
    source: 'Default Regional Coordinates (Select GPS or Map Location)',
    timestamp: new Date().toISOString(),
    isRealTime: false,
    locationLabel: 'Guntur Region, Guntur',
  },
};

const LEGACY_DEMO_FARM_IDS = new Set(['farm-001', 'farm-002', 'farm-003']);

function isLegacyDemoFarm(farm: any): boolean {
  if (!farm || typeof farm !== 'object') return true;
  if (LEGACY_DEMO_FARM_IDS.has(farm.id)) return true;
  if (farm.name === 'Venkata Subba Rao Farmland') return true;
  return false;
}

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<string>('home');

  const [currentFarm, setCurrentFarm] = useState<FarmProfile>(() => {
    try {
      const stored = localStorage.getItem('fn_current_farm');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!isLegacyDemoFarm(parsed)) return parsed;
      }
      return DEFAULT_FARM;
    } catch {
      return DEFAULT_FARM;
    }
  });

  const [savedFarms, setSavedFarms] = useState<FarmProfile[]>(() => {
    try {
      const stored = localStorage.getItem('fn_saved_farms');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((f) => !isLegacyDemoFarm(f));
          if (cleaned.length > 0) return cleaned;
        }
      }
      return [DEFAULT_FARM];
    } catch {
      return [DEFAULT_FARM];
    }
  });

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [marketMessage, setMarketMessage] = useState<string | null>(null);

  const [waterAdvisory, setWaterAdvisory] = useState<WaterAdvisoryData | null>(null);
  const [waterError, setWaterError] = useState<string | null>(null);

  const [satelliteData, setSatelliteData] = useState<SatelliteAnalysis | null>(null);
  const [iotStatus, setIotStatus] = useState<IotDeviceStatus | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState('');

  const [selectedCropForProfit, setSelectedCropForProfit] = useState<RecommendedCrop | null>(null);
  const [selectedAcresForProfit, setSelectedAcresForProfit] = useState<number>(
    currentFarm.areaAcres || 1
  );

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const t = translations[currentLang];

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    (
      title: string,
      description?: string,
      variant: 'success' | 'info' | 'warning' | 'error' = 'info'
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4500);
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem('fn_current_farm', JSON.stringify(currentFarm));
    } catch (e) {
      console.warn('Could not save farm to localStorage', e);
    }
  }, [currentFarm]);

  useEffect(() => {
    try {
      localStorage.setItem('fn_saved_farms', JSON.stringify(savedFarms));
    } catch (e) {
      console.warn('Could not save farms list to localStorage', e);
    }
  }, [savedFarms]);

  const loadWeather = useCallback(
    async (district?: string, lat?: number, lon?: number) => {
      const targetLat = lat ?? currentFarm.center?.[0];
      const targetLon = lon ?? currentFarm.center?.[1];
      const targetCity = district || currentFarm.village || currentFarm.district || '';

      if (!Number.isFinite(targetLat) || !Number.isFinite(targetLon)) {
        setWeatherError('Valid farm latitude and longitude are required before fetching weather.');
        return;
      }

      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const url = `/api/weather?lat=${encodeURIComponent(String(targetLat))}&lon=${encodeURIComponent(
          String(targetLon)
        )}&city=${encodeURIComponent(targetCity)}`;
        const { ok, status, data } = await safeFetchJson<WeatherData & { error?: string }>(url);

        if (!ok || !data?.success) {
          setWeatherData(null);
          setWeatherError(data?.error || `Unable to retrieve weather forecast (HTTP ${status}).`);
          return;
        }
        setWeatherData(data);
        setWeatherError(null);
      } catch (err: any) {
        setWeatherData(null);
        setWeatherError(err?.message || 'Network error while connecting to weather service.');
      } finally {
        setWeatherLoading(false);
      }
    },
    [currentFarm.center, currentFarm.village, currentFarm.district]
  );

  const loadWaterAdvisory = useCallback(
    async (farm: FarmProfile, connectedMoisture?: number) => {
      setWaterError(null);
      try {
        const { ok, status, data } = await safeFetchJson<WaterAdvisoryData & { error?: string }>(
          '/api/water-advisory',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              crop: farm.currentCrop,
              cropStage: farm.cropStage,
              soilType: farm.soilType,
              irrigationMethod: farm.irrigationMethod,
              areaAcres: farm.areaAcres,
              lat: farm.center[0],
              lon: farm.center[1],
              soilMoisturePercent: connectedMoisture,
            }),
          }
        );
        if (!ok || !data?.success) {
          setWaterAdvisory(null);
          setWaterError(data?.error || `Water calculation unavailable (HTTP ${status}).`);
          return;
        }
        setWaterAdvisory(data);
      } catch (err: any) {
        setWaterAdvisory(null);
        setWaterError(err?.message || 'Network error while fetching water advisory.');
      }
    },
    []
  );

  const loadSatelliteData = useCallback(async (farm: FarmProfile) => {
    try {
      const { data } = await safeFetchJson<SatelliteAnalysis>('/api/satellite/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: farm.id,
          polygon: farm.boundary,
          center: farm.center,
          crop: farm.currentCrop,
          areaAcres: farm.areaAcres,
        }),
      });
      if (data) {
        setSatelliteData(data);
      }
    } catch {
      // Handled gracefully inside SatelliteIntelligenceSection
    }
  }, []);

  const [marketLoading, setMarketLoading] = useState(false);

  const loadMarketPrices = useCallback(async (forceRefresh = false) => {
    setMarketLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFarm.district) params.set('district', currentFarm.district);
      if (currentFarm.state) params.set('state', currentFarm.state);
      if (forceRefresh) params.set('refresh', 'true');

      const { ok, data } = await safeFetchJson<{
        success?: boolean;
        prices?: MarketPrice[];
        message?: string;
      }>(`/api/market-prices?${params.toString()}`);
      if (ok && data?.success && Array.isArray(data.prices)) {
        setMarketPrices(data.prices);
        setMarketMessage(null);
      } else {
        setMarketPrices([]);
        setMarketMessage(data?.message || 'Market data currently unavailable.');
      }
    } catch {
      setMarketPrices([]);
      setMarketMessage('Market data currently unavailable due to network error.');
    } finally {
      setMarketLoading(false);
    }
  }, [currentFarm.district, currentFarm.state]);

  const refreshIotStatus = useCallback(async () => {
    try {
      const { ok, data } = await safeFetchJson<IotDeviceStatus>('/api/iot/status');
      if (ok && data) {
        setIotStatus(data);
      } else {
        setIotStatus((prev) =>
          prev || {
            connected: false,
            integrityState: 'NO_DATA',
            lastHeartbeat: null,
            timeoutSeconds: 60,
            pumpRelayActive: false,
            latestTelemetry: null,
            telemetryHistory: [],
            provenance: {
              integrityState: 'NO_DATA',
              classification: 'NO_DATA',
              source: 'ESP32 Hardware Gateway',
              timestamp: new Date().toISOString(),
              isRealTime: false,
              notes: 'ESP32 hardware gateway did not return JSON telemetry.',
            },
          }
        );
      }
    } catch {
      // Transient network errors keep existing disconnected state without crashing console
    }
  }, []);

  // Fetch farm-dependent feeds on startup and whenever selected farm or coordinates change
  useEffect(() => {
    const label = currentFarm.village || currentFarm.district;
    loadWeather(label, currentFarm.center[0], currentFarm.center[1]);
    loadWaterAdvisory(
      currentFarm,
      iotStatus?.connected ? iotStatus.latestTelemetry?.soilMoisturePercent : undefined
    );
    loadSatelliteData(currentFarm);
    setSelectedAcresForProfit(currentFarm.areaAcres || 1);
  }, [
    currentFarm.id,
    currentFarm.center[0],
    currentFarm.center[1],
    currentFarm.boundary.length,
    currentFarm.currentCrop,
    currentFarm.areaAcres,
    currentFarm.irrigationMethod,
  ]);

  // Periodic weather refresh every 10 minutes + initial market/IoT checks
  useEffect(() => {
    loadMarketPrices();
    refreshIotStatus();
    const iotTimer = setInterval(refreshIotStatus, 15000);
    const weatherTimer = setInterval(() => {
      loadWeather(currentFarm.village || currentFarm.district, currentFarm.center[0], currentFarm.center[1]);
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(iotTimer);
      clearInterval(weatherTimer);
    };
  }, [loadMarketPrices, refreshIotStatus, loadWeather, currentFarm.village, currentFarm.district, currentFarm.center]);

  const notifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];

    if (weatherData?.current.sprayBadge && weatherData.current.sprayBadge !== 'ideal') {
      list.push({
        id: `spray-${weatherData.current.sprayBadge}`,
        title: 'Spraying Window Caution',
        titleTe: 'పిచికారీ హెచ్చరిక',
        message: `${weatherData.current.sprayCondition} (Wind ${weatherData.current.windSpeedKmh} km/h).`,
        messageTe: `గాలి వేగం ${weatherData.current.windSpeedKmh} కి.మీ/గం ఉండటం వల్ల మందు పిచికారీని వాయిదా వేయండి.`,
        severity: weatherData.current.sprayBadge === 'poor' ? 'critical' : 'warning',
        category: 'weather',
        timestamp: weatherData.lastUpdated,
        targetTab: 'weather',
      });
    }

    const rainNext = weatherData?.forecast?.[0]?.rainChance ?? 0;
    if (rainNext > 50) {
      list.push({
        id: 'rain-forecast-high',
        title: `Rain Expected (${rainNext}% Chance)`,
        titleTe: `వర్ష సూచన (${rainNext}%)`,
        message: 'Delay fertilizer top-dressing and verify pump schedule.',
        messageTe: 'వర్షం పడే అవకాశం ఉన్నందున ఎరువులు మరియు నీటి తడిని వాయిదా వేయండి.',
        severity: 'warning',
        category: 'water',
        timestamp: weatherData?.lastUpdated || new Date().toISOString(),
        targetTab: 'water',
      });
    }

    if (iotStatus && !iotStatus.connected) {
      list.push({
        id: 'iot-offline',
        title: 'ESP32 Sensor Not Connected',
        titleTe: 'IoT సెన్సార్ కనెక్ట్ కాలేదు',
        message: 'No live soil moisture telemetry received on /api/iot/telemetry.',
        messageTe: 'లైవ్ సెన్సార్ డేటా అందుబాటులో లేదు.',
        severity: 'info',
        category: 'iot',
        timestamp: new Date().toISOString(),
        targetTab: 'iot',
      });
    }

    return list.map((item) => ({
      ...item,
      read: readNotificationIds.includes(item.id),
    }));
  }, [weatherData, iotStatus, readNotificationIds]);

  const handleMarkAllNotificationsRead = () => {
    setReadNotificationIds(notifications.map((n) => n.id));
  };

  const navigateTab = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      addToast(
        'Geolocation Unavailable',
        'Your browser does not support device GPS hardware access.',
        'error'
      );
      return;
    }

    addToast('Locating Farm Coordinates', 'Requesting GNSS location lock...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let village = 'GPS Coordinates';
        let mandal = currentFarm.mandal;
        let district = currentFarm.district;
        let state = currentFarm.state;
        let fullAddress: string | undefined;

        try {
          const { ok, data } = await safeFetchJson<any>(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`
          );
          if (ok && data) {
            if (data.village) village = data.village;
            if (data.mandal) mandal = data.mandal;
            if (data.district) district = data.district;
            if (data.state) state = data.state;
            if (data.displayName) fullAddress = data.displayName;
          }
        } catch (e) {
          console.warn('Reverse geocode failed:', e);
        }

        const updatedFarm: FarmProfile = {
          ...currentFarm,
          center: [latitude, longitude],
          name: fullAddress
            ? `${village} Plot`
            : `GPS Plot (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          village,
          mandal,
          district,
          state,
          fullAddress,
          gpsAccuracyMeters: Math.round(accuracy),
          lastUpdated: new Date().toISOString(),
          provenance: {
            integrityState: 'LIVE_DATA',
            classification: 'REAL_GPS_DATA',
            source: `Device Geolocation Hardware (±${Math.round(accuracy)}m)`,
            timestamp: new Date().toISOString(),
            isRealTime: true,
            locationLabel: `${village}, ${district}`,
            notes: 'Obtained via browser Geolocation API.',
          },
        };
        setCurrentFarm(updatedFarm);
        addToast(
          'GPS Lock Acquired',
          `Centered on ${village}, ${district} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          'success'
        );
      },
      () => {
        addToast(
          'Location Access Declined',
          'Allow browser location permission or search your village manually on the farm map.',
          'warning'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSelectFarm = (farm: FarmProfile) => {
    setCurrentFarm(farm);
    addToast('Selected Farm Location', `${farm.name} (${farm.village || farm.district}) loaded.`, 'success');
  };

  const handleSaveFarm = (farm: FarmProfile) => {
    setCurrentFarm(farm);
    setSavedFarms((prev) => {
      const existingIdx = prev.findIndex((f) => f.id === farm.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = farm;
        return updated;
      }
      return [farm, ...prev];
    });
    addToast('Farm Boundary Saved', `${farm.areaAcres.toFixed(2)} acres saved to browser storage.`, 'success');
  };

  const handleOpenAssistant = (query?: string) => {
    setAssistantInitialQuery(query || '');
    setIsAssistantOpen(true);
  };

  const handleSimulateCropProfit = (crop: RecommendedCrop, acres: number) => {
    setSelectedCropForProfit(crop);
    setSelectedAcresForProfit(acres);
    navigateTab('profit');
  };

  const handleDroneBooked = (booking: DroneBooking) => {
    addToast(
      'Drone Request Logged',
      `${booking.serviceType} requested for ${booking.date} (${booking.timeSlot}).`,
      'success'
    );
  };

  const overviewModules = [
    {
      id: 'dashboard',
      title: 'Farm Operations Cockpit',
      titleTe: 'ప్రధాన పొలం డాష్‌బోర్డ్',
      desc: 'Unified weather forecast, Sentinel-2 overpass status, water budget, and IoT node telemetry.',
      icon: LayoutGrid,
      meta: 'My Farm',
    },
    {
      id: 'location',
      title: 'Satellite Parcel Mapping',
      titleTe: 'పొలం మ్యాప్ & సరిహద్దు',
      desc: 'Search villages via OpenStreetMap, lock device GPS, and compute geodesic boundary acreage.',
      icon: MapPin,
      meta: 'WGS84 GIS',
    },
    {
      id: 'satellite',
      title: 'Copernicus Sentinel-2 Catalog',
      titleTe: 'శాటిలైట్ ఇంటెలిజెన్స్',
      desc: 'Query real AWS Earth-Search STAC passes, acquisition dates, cloud cover, and quicklook views.',
      icon: Satellite,
      meta: 'Periodic Pass',
    },
    {
      id: 'water',
      title: 'FAO-56 Water & Irrigation',
      titleTe: 'శాస్త్రీయ నీటి యాజమాన్యం',
      desc: 'Calculate crop evapotranspiration (ETc) from live Open-Meteo ET0 and rainfall forecasts.',
      icon: Droplets,
      meta: 'ETc Hydrology',
    },
    {
      id: 'doctor',
      title: 'AI Crop Doctor',
      titleTe: 'AI పంట వైద్యుడు',
      desc: 'Upload your own crop foliage photograph for multimodal Gemini Vision analysis.',
      icon: Camera,
      meta: 'Gemini Vision',
    },
    {
      id: 'weather',
      title: 'Open-Meteo Weather Forecast',
      titleTe: 'వాతావరణం & పిచికారీ విండో',
      desc: 'Model-based hourly and 7-day numerical forecast for wind, humidity, rain risk, and spraying.',
      icon: CloudSun,
      meta: 'NWP Model',
    },
  ];

  // Segmented Sub-Navigation Tabs matching the 8-item hierarchy
  const navGroup = getNavGroup(activeTab);
  const subNavMap: Record<string, Array<{ id: string; label: string; icon: React.ElementType }>> = {
    dashboard: [
      { id: 'dashboard', label: t.navDashboard, icon: LayoutGrid },
      { id: 'location', label: t.navLocation, icon: MapPin },
    ],
    doctor: [
      { id: 'doctor', label: t.navDoctor, icon: Camera },
      { id: 'crops', label: t.navCrops, icon: Sprout },
    ],
    drone: [
      { id: 'drone', label: t.navDrone, icon: Plane },
      { id: 'market', label: t.navMarket, icon: TrendingUp },
      { id: 'profit', label: t.navProfit, icon: DollarSign },
      { id: 'labour', label: t.navLabour, icon: Users },
      { id: 'community', label: t.navCommunity, icon: MessageSquare },
    ],
  };

  const activeSubTabs = subNavMap[navGroup];

  const assistantFarmContext = useMemo(
    () => ({
      ...currentFarm,
      weatherTemp: weatherData?.current.temp,
      weatherCondition: weatherData?.current.description,
      weatherWind: weatherData?.current.windSpeedKmh,
      dailyLitersPerAcre: waterAdvisory?.dailyLitersPerAcre,
    }),
    [currentFarm, weatherData, waterAdvisory]
  );

  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#202820] relative">
      {/* Subtle Ambient Mint Mesh Glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[440px] -z-10"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% -10%, rgba(221, 237, 226, 0.85) 0%, rgba(245, 246, 243, 0) 75%)',
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="max-w-[1460px] mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-start gap-5 pb-24 lg:pb-6">
        {/* Desktop Floating Glass Sidebar */}
        <SidebarNavigation
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
          activeTab={activeTab}
          onSelectTab={navigateTab}
          onOpenAssistant={() => handleOpenAssistant()}
          currentFarm={currentFarm}
          savedFarms={savedFarms}
          onSelectFarm={handleSelectFarm}
          onUseGps={handleUseGps}
          notifications={notifications}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          iotStatus={iotStatus}
        />

        {/* Main Glass Workspace Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <TopGlassBar
            currentLang={currentLang}
            onLanguageChange={setCurrentLang}
            activeTab={activeTab}
            onSelectTab={navigateTab}
            onOpenAssistant={() => handleOpenAssistant()}
            currentFarm={currentFarm}
            savedFarms={savedFarms}
            onSelectFarm={handleSelectFarm}
            onUseGps={handleUseGps}
            notifications={notifications}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            iotStatus={iotStatus}
          />

          <main className="flex-1 mt-5 space-y-6">
            {/* Grouped Module Segmented Sub-Navigation */}
            {activeSubTabs && activeTab !== 'home' && (
              <div className="glass-panel rounded-[18px] p-1.5 inline-flex flex-wrap items-center gap-1">
                {activeSubTabs.map((sub) => {
                  const Icon = sub.icon;
                  const active = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTab(sub.id)}
                      className={`px-3.5 py-2 rounded-[13px] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#174C36] text-white shadow-xs'
                          : 'text-[#5D665E] hover:text-[#202820] hover:bg-white/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#DDEDE2]' : 'text-[#4D966B]'}`} />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* 1. OVERVIEW */}
                {activeTab === 'home' && (
                  <div className="space-y-10">
                    <HeroSection
                      currentLang={currentLang}
                      farm={currentFarm}
                      weather={weatherData}
                      weatherLoading={weatherLoading}
                      weatherError={weatherError}
                      onRetryWeather={() =>
                        loadWeather(
                          currentFarm.village || currentFarm.district,
                          currentFarm.center[0],
                          currentFarm.center[1]
                        )
                      }
                      satelliteData={satelliteData}
                      iotStatus={iotStatus}
                      onExplore={navigateTab}
                      onOpenAssistant={() => handleOpenAssistant()}
                    />

                    {/* Curated Bento Module Grid */}
                    <section className="space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-1">
                        <div>
                          <div className="text-xs font-semibold text-[#4D966B] tracking-wide">
                            Integrated Precision Agriculture Suite
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
                            {t.sectionServices}
                          </h2>
                          <p className="text-sm text-[#5D665E] mt-1 max-w-2xl">
                            {t.sectionServicesSub}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => navigateTab('location')}
                            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#174C36] hover:bg-[#113A29] rounded-[14px] transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Select Farm Location</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateTab('drone')}
                            className="px-4 py-2.5 text-xs font-semibold text-[#174C36] glass-panel hover:bg-white rounded-[14px] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <span>Farm Services</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {overviewModules.map((mod) => {
                          const Icon = mod.icon;
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              onClick={() => navigateTab(mod.id)}
                              className="group glass-panel rounded-[24px] p-6 text-left hover:bg-white/90 transition-all cursor-pointer flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className="w-11 h-11 rounded-[16px] bg-[#DDEDE2]/80 text-[#174C36] flex items-center justify-center group-hover:bg-[#174C36] group-hover:text-white transition-colors">
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <span className="text-[11px] font-mono font-semibold text-[#4D966B]">
                                    {mod.meta}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold text-[#202820] font-display mt-5">
                                  {currentLang === 'te' ? mod.titleTe : mod.title}
                                </h3>
                                <p className="text-xs text-[#5D665E] mt-2 leading-relaxed">
                                  {mod.desc}
                                </p>
                              </div>

                              <div className="mt-5 pt-3.5 border-t border-[#174C36]/10 flex items-center justify-between text-xs font-semibold text-[#174C36]">
                                <span>Open Module</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Data Integrity Principles + Rythu Nestham AI Card */}
                    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                      <div className="lg:col-span-7 bg-[#174C36] text-white rounded-[26px] p-7 sm:p-9 flex flex-col justify-between shadow-lg">
                        <div className="space-y-4">
                          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#DDEDE2] tracking-wide">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Data Integrity & Source Transparency</span>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold font-display text-white">
                            Every signal is labeled with its exact origin.
                          </h3>
                          <p className="text-xs sm:text-sm text-[#E9F2EC] leading-relaxed">
                            FarmersNeed separates live external retrievals from offline hardware and unconfigured feeds—with zero fabricated metrics or placeholder scores.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-white/15 text-xs">
                          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                            <div className="font-mono font-bold text-[#DDEDE2]">LIVE DATA</div>
                            <p className="text-[11px] text-white/80 mt-1">
                              Active Open-Meteo models, STAC catalog scenes, or connected ESP32 nodes.
                            </p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                            <div className="font-mono font-bold text-amber-200">UNAVAILABLE</div>
                            <p className="text-[11px] text-white/80 mt-1">
                              Upstream failure, timeout, or missing API keys (such as Agmarknet).
                            </p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                            <div className="font-mono font-bold text-white/90">NO DATA</div>
                            <p className="text-[11px] text-white/80 mt-1">
                              Disconnected hardware probes, empty logs, or uncomputed raster metrics.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5 glass-panel rounded-[26px] p-7 sm:p-9 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-[16px] bg-[#DDEDE2] text-[#174C36] flex items-center justify-center">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <h3 className="text-xl font-bold text-[#202820] font-display">
                            Rythu Nestham AI Advisor
                          </h3>
                          <p className="text-xs sm:text-sm text-[#5D665E] leading-relaxed">
                            Ask questions in Telugu or English grounded in your selected farm coordinates, crop stage, Open-Meteo weather forecast, and FAO-56 water calculations.
                          </p>
                        </div>

                        <div className="pt-6 flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAssistant()}
                            className="px-5 py-3 bg-[#174C36] hover:bg-[#113A29] text-white text-xs font-semibold rounded-[14px] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4 text-[#DDEDE2]" />
                            <span>{t.btnAskAI}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateTab('iot')}
                            className="px-4 py-3 bg-white/75 hover:bg-white text-[#174C36] border border-[#174C36]/15 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer"
                          >
                            IoT Console
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* 2. MY FARM: DASHBOARD */}
                {activeTab === 'dashboard' &&
                  (weatherLoading && !weatherData ? (
                    <div className="space-y-5">
                      <div className="glass-panel rounded-[24px] p-8 h-32 skeleton-glass" />
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div key={n} className="glass-panel rounded-[20px] p-5 h-28 skeleton-glass" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <FarmerDashboard
                      currentLang={currentLang}
                      farm={currentFarm}
                      weather={weatherData}
                      weatherError={weatherError}
                      onRetryWeather={() =>
                        loadWeather(
                          currentFarm.village || currentFarm.district,
                          currentFarm.center[0],
                          currentFarm.center[1]
                        )
                      }
                      marketPrices={marketPrices}
                      marketMessage={marketMessage}
                      waterAdvisory={waterAdvisory}
                      satelliteData={satelliteData}
                      iotStatus={iotStatus}
                      onNavigateTab={navigateTab}
                      onOpenAssistant={() => handleOpenAssistant()}
                      onBookDrone={() => navigateTab('drone')}
                    />
                  ))}

                {/* 3. MY FARM: LOCATION MAP */}
                {activeTab === 'location' && (
                  <FarmMapSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    savedFarms={savedFarms}
                    onSelectFarm={handleSelectFarm}
                    onSaveFarm={handleSaveFarm}
                  />
                )}

                {/* 4. CROP INTELLIGENCE: AI CROP DOCTOR */}
                {activeTab === 'doctor' && (
                  <CropDoctorSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    onBookDrone={() => navigateTab('drone')}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 5. CROP INTELLIGENCE: CROP PLANNER */}
                {activeTab === 'crops' && (
                  <CropRecommender
                    currentLang={currentLang}
                    farm={currentFarm}
                    onSimulateCropProfit={handleSimulateCropProfit}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 6. SATELLITE INTELLIGENCE */}
                {activeTab === 'satellite' && (
                  <SatelliteIntelligenceSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    onNavigateLocation={() => navigateTab('location')}
                    onAnalysisUpdate={setSatelliteData}
                    onOpenDoctor={() => navigateTab('doctor')}
                  />
                )}

                {/* 7. WATER MANAGEMENT */}
                {activeTab === 'water' && (
                  <WaterManagementSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    iotStatus={iotStatus}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 8. WEATHER */}
                {activeTab === 'weather' && (
                  <WeatherAdvisory
                    currentLang={currentLang}
                    farm={currentFarm}
                    weather={weatherData}
                    loading={weatherLoading}
                    error={weatherError}
                    onRefreshLocation={() =>
                      loadWeather(
                        currentFarm.village || currentFarm.district,
                        currentFarm.center[0],
                        currentFarm.center[1]
                      )
                    }
                    onUseGps={handleUseGps}
                  />
                )}

                {/* 9. FARM SERVICES: DRONE BOOKING */}
                {activeTab === 'drone' && (
                  <DroneBookingSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    onBookingSuccess={handleDroneBooked}
                  />
                )}

                {/* 10. FARM SERVICES: MARKET PRICES */}
                {activeTab === 'market' && (
                  <MarketPricesSection
                    currentLang={currentLang}
                    prices={marketPrices}
                    loading={marketLoading}
                    unavailableMessage={marketMessage}
                    onRetry={() => loadMarketPrices(true)}
                  />
                )}

                {/* 11. FARM SERVICES: PROFIT CALCULATOR */}
                {activeTab === 'profit' && (
                  <ProfitCalculator
                    currentLang={currentLang}
                    initialCrop={selectedCropForProfit}
                    initialAcres={selectedAcresForProfit}
                    onBookDrone={() => navigateTab('drone')}
                  />
                )}

                {/* 12. FARM SERVICES: LABOUR NETWORK */}
                {activeTab === 'labour' && <LabourNetwork currentLang={currentLang} />}

                {/* 13. FARM SERVICES: COMMUNITY FORUM */}
                {activeTab === 'community' && <CommunityForum currentLang={currentLang} />}

                {/* 14. IOT MONITORING */}
                {activeTab === 'iot' && (
                  <IotHardwareSection
                    currentLang={currentLang}
                    iotStatus={iotStatus}
                    onRefreshStatus={refreshIotStatus}
                    onNotify={addToast}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <Footer
            currentLang={currentLang}
            onNavigateTab={navigateTab}
            onOpenAssistant={() => handleOpenAssistant()}
          />
        </div>
      </div>

      {/* Mobile Floating Bottom Dock */}
      <MobileBottomDock
        activeTab={activeTab}
        onSelectTab={navigateTab}
        currentLang={currentLang}
      />

      {/* Rythu Nestham AI Agronomic Assistant Modal */}
      <AgriAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentLang={currentLang}
        initialQuery={assistantInitialQuery}
        farmContext={assistantFarmContext}
      />
    </div>
  );
}
