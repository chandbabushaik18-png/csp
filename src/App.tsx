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
  Cpu,
  Users,
  DollarSign,
  MessageSquare,
} from 'lucide-react';

const INITIAL_FARM: FarmProfile = {
  id: 'farm-001',
  name: 'Venkata Subba Rao Farmland',
  center: [16.4258, 80.5614],
  boundary: [
    [16.427, 80.56],
    [16.4272, 80.563],
    [16.4245, 80.5632],
    [16.4243, 80.5602],
  ],
  areaAcres: 3.2,
  areaHectares: 1.3,
  village: 'Pedavadlapudi',
  mandal: 'Mangalagiri',
  district: 'Guntur',
  state: 'Andhra Pradesh',
  soilType: 'Black Cotton Soil (నల్లరేగడి నేల)',
  soilPh: 7.2,
  currentCrop: 'Chilli (మిర్చి - తేజ)',
  cropStage: 'Mid-Season (Flowering/Fruiting)',
  irrigationMethod: 'Drip',
  waterSource: 'Borewell',
  lastUpdated: new Date().toISOString(),
};

const SAMPLE_SAVED_FARMS: FarmProfile[] = [
  INITIAL_FARM,
  {
    id: 'farm-002',
    name: 'Tenali Paddy Plot 4B',
    center: [16.2435, 80.6401],
    boundary: [
      [16.2445, 80.639],
      [16.2447, 80.6415],
      [16.2425, 80.6418],
      [16.2423, 80.6392],
    ],
    areaAcres: 4.5,
    areaHectares: 1.82,
    village: 'Angalakuduru',
    mandal: 'Tenali',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    soilType: 'Alluvial Delta Soil (ఒండ్రు నేల)',
    soilPh: 6.8,
    currentCrop: 'Paddy (వరి - BPT 5204)',
    cropStage: 'Vegetative (Tillering/Branching)',
    irrigationMethod: 'Flood / Furrow',
    waterSource: 'Canal',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'farm-003',
    name: 'Warangal Cotton Field',
    center: [17.9689, 79.5941],
    boundary: [
      [17.97, 79.593],
      [17.9705, 79.596],
      [17.9675, 79.5962],
      [17.9672, 79.5932],
    ],
    areaAcres: 5.0,
    areaHectares: 2.02,
    village: 'Dharmasagar',
    mandal: 'Dharmasagar',
    district: 'Hanamkonda',
    state: 'Telangana',
    soilType: 'Red Sandy Loam (ఎర్ర నేల)',
    soilPh: 6.5,
    currentCrop: 'Cotton (ప్రత్తి - Bt-2)',
    cropStage: 'Mid-Season (Flowering/Fruiting)',
    irrigationMethod: 'Drip',
    waterSource: 'Borewell',
    lastUpdated: new Date().toISOString(),
  },
];

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<string>('home');

  const [currentFarm, setCurrentFarm] = useState<FarmProfile>(() => {
    try {
      const stored = localStorage.getItem('fn_current_farm');
      return stored ? JSON.parse(stored) : INITIAL_FARM;
    } catch {
      return INITIAL_FARM;
    }
  });

  const [savedFarms, setSavedFarms] = useState<FarmProfile[]>(() => {
    try {
      const stored = localStorage.getItem('fn_saved_farms');
      return stored ? JSON.parse(stored) : SAMPLE_SAVED_FARMS;
    } catch {
      return SAMPLE_SAVED_FARMS;
    }
  });

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [waterAdvisory, setWaterAdvisory] = useState<WaterAdvisoryData | null>(null);
  const [satelliteData, setSatelliteData] = useState<SatelliteAnalysis | null>(null);
  const [iotStatus, setIotStatus] = useState<IotDeviceStatus | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState('');

  const [selectedCropForProfit, setSelectedCropForProfit] = useState<RecommendedCrop | null>(null);
  const [selectedAcresForProfit, setSelectedAcresForProfit] = useState<number>(
    currentFarm.areaAcres || 3
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

  const loadWeather = async (district: string, lat?: number, lon?: number) => {
    setWeatherLoading(true);
    try {
      let url = `/api/weather?city=${encodeURIComponent(district)}`;
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch (err) {
      console.error('Failed to load weather:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  const loadWaterAdvisory = async (farm: FarmProfile) => {
    try {
      const res = await fetch('/api/water-advisory', {
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWaterAdvisory(data);
      }
    } catch (err) {
      console.error('Failed to load water advisory:', err);
    }
  };

  const loadSatelliteData = async (farm: FarmProfile) => {
    try {
      const res = await fetch('/api/satellite/analyze', {
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
      if (res.ok) {
        const data = await res.json();
        setSatelliteData(data);
      }
    } catch (err) {
      console.error('Failed to load satellite data:', err);
    }
  };

  const loadMarketPrices = async () => {
    try {
      const res = await fetch('/api/market-prices');
      if (res.ok) {
        const data = await res.json();
        setMarketPrices(data.prices || []);
      }
    } catch (err) {
      console.error('Failed to load market prices:', err);
    }
  };

  const refreshIotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/iot/status');
      if (res.ok) {
        const data = await res.json();
        setIotStatus(data);
      }
    } catch (err) {
      console.error('Failed to poll IoT hardware status:', err);
    }
  }, []);

  useEffect(() => {
    if (currentFarm) {
      loadWeather(currentFarm.district, currentFarm.center[0], currentFarm.center[1]);
      loadWaterAdvisory(currentFarm);
      loadSatelliteData(currentFarm);
      setSelectedAcresForProfit(currentFarm.areaAcres || 3);
    }
  }, [currentFarm.id, currentFarm.center[0], currentFarm.center[1], currentFarm.currentCrop]);

  useEffect(() => {
    loadMarketPrices();
    refreshIotStatus();
    const timer = setInterval(refreshIotStatus, 15000);
    return () => clearInterval(timer);
  }, [refreshIotStatus]);

  // Compute live actionable notifications from real weather, satellite, and IoT telemetry
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
        message: 'Delay fertilizer top-dressing and skip scheduled morning pump run.',
        messageTe: 'వర్షం పడే అవకాశం ఉన్నందున ఎరువులు మరియు నీటి తడిని వాయిదా వేయండి.',
        severity: 'warning',
        category: 'water',
        timestamp: weatherData?.lastUpdated || new Date().toISOString(),
        targetTab: 'water',
      });
    }

    if (satelliteData && satelliteData.stressHotspotsCount > 0) {
      list.push({
        id: `sat-stress-${satelliteData.sceneId}`,
        title: `${satelliteData.stressHotspotsCount} Localized Canopy Stress Zone`,
        titleTe: `${satelliteData.stressHotspotsCount} పంట ఒత్తిడి ప్రాంతాలు`,
        message: `Sentinel-2 NDVI (${satelliteData.meanNdvi.toFixed(2)}) detected mild edge stress on ${satelliteData.acquisitionDate}.`,
        messageTe: 'ఉపగ్రహ చిత్రాలలో పొలం అంచున పచ్చదనం తగ్గినట్లు గుర్తించబడింది.',
        severity: 'info',
        category: 'satellite',
        timestamp: satelliteData.acquisitionDate,
        targetTab: 'satellite',
      });
    }

    if (iotStatus && !iotStatus.connected) {
      list.push({
        id: 'iot-offline',
        title: 'ESP32 Field Node Offline',
        titleTe: 'IoT సెన్సార్ ఆఫ్‌లైన్‌లో ఉంది',
        message: 'No live soil moisture heartbeat received. Use Simulation Mode to test pump logic.',
        messageTe: 'లైవ్ సెన్సార్ డేటా లేదు. సిమ్యులేషన్ మోడ్‌తో పరీక్షించవచ్చు.',
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
  }, [weatherData, satelliteData, iotStatus, readNotificationIds]);

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

    addToast('Locating Farm Coordinates', 'Requesting high-accuracy GNSS lock...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let village = 'Current Farm GPS Location';
        let mandal = currentFarm.mandal;
        let district = currentFarm.district;
        let state = currentFarm.state;
        let fullAddress: string | undefined;

        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
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
            ? `${village} Farm`
            : `GPS Farmland (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          village,
          mandal,
          district,
          state,
          fullAddress,
          gpsAccuracyMeters: Math.round(accuracy),
          lastUpdated: new Date().toISOString(),
          provenance: {
            classification: 'REAL_GPS_DATA',
            source: `Device Geolocation Hardware (±${Math.round(accuracy)}m)`,
            timestamp: new Date().toISOString(),
            isRealTime: true,
            notes: 'Obtained via W3C Geolocation API with GNSS coordinates.',
          },
        };
        setCurrentFarm(updatedFarm);
        addToast(
          'GPS Lock Acquired',
          `Centered on ${village}, ${district} (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) ±${Math.round(accuracy)}m`,
          'success'
        );
      },
      (err) => {
        console.warn('Geolocation denied:', err);
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
    addToast('Switched Active Parcel', `${farm.name} (${farm.village}) loaded.`, 'success');
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
    addToast('Farm Boundary Saved', `${farm.areaAcres.toFixed(2)} acres saved to profile.`, 'success');
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
      'Drone Mission Scheduled',
      `${booking.serviceType} booked for ${booking.date} (${booking.timeSlot}).`,
      'success'
    );
  };

  // Curated 6-card Apple Bento Intelligence Overview (Drone & IoT reside cleanly under Farm Services)
  const overviewModules = [
    {
      id: 'dashboard',
      title: 'Farm Operations Overview',
      titleTe: 'ప్రధాన పొలం డాష్‌బోర్డ్',
      desc: 'Unified daily action plan combining irrigation schedules, spray safety, and APMC mandi rates.',
      icon: LayoutGrid,
      meta: 'Daily Cockpit',
    },
    {
      id: 'location',
      title: 'Satellite Parcel Mapping',
      titleTe: 'ఉపగ్రహ పొలం మ్యాప్ & సరిహద్దు',
      desc: 'Draw exact field boundaries on high-res imagery with geodesic acreage & NDVI zoning overlays.',
      icon: MapPin,
      meta: 'WGS84 GIS',
    },
    {
      id: 'satellite',
      title: 'Copernicus Sentinel-2 Analytics',
      titleTe: 'ఉపగ్రహ రిమోట్ సెన్సింగ్ (NDVI)',
      desc: '10m multispectral overpass scenes tracking NDVI vegetation vigor and NDWI canopy moisture.',
      icon: Satellite,
      meta: '10m Multispectral',
    },
    {
      id: 'water',
      title: 'FAO-56 Water & Irrigation',
      titleTe: 'శాస్త్రీయ నీటి యాజమాన్యం',
      desc: 'Evapotranspiration water budgeting with interactive root-zone moisture simulation and pump hours.',
      icon: Droplets,
      meta: 'ETc Hydrology',
    },
    {
      id: 'doctor',
      title: 'AI Crop Doctor & Advisor',
      titleTe: 'AI పంట వైద్యుడు & సిఫార్సులు',
      desc: 'Upload leaf photos for instant Gemini Vision disease pathology and bilingual ANGRAU remedies.',
      icon: Camera,
      meta: 'Multimodal AI',
    },
    {
      id: 'weather',
      title: 'Hyper-Local Weather & Spraying',
      titleTe: 'వాతావరణం & పిచికారీ విండో',
      desc: 'Hourly wind velocity, rain risk, and evapotranspiration windows from your farm coordinates.',
      icon: CloudSun,
      meta: 'Open-Meteo Live',
    },
  ];

  // Segmented Sub-Navigation Tabs for Grouped Sidebar Categories
  const navGroup = getNavGroup(activeTab);
  const subNavMap: Record<string, Array<{ id: string; label: string; icon: React.ElementType }>> = {
    dashboard: [
      { id: 'dashboard', label: t.navDashboard, icon: LayoutGrid },
      { id: 'location', label: t.navLocation, icon: MapPin },
    ],
    satellite: [
      { id: 'satellite', label: t.navSatellite, icon: Satellite },
      { id: 'doctor', label: t.navDoctor, icon: Camera },
      { id: 'crops', label: t.navCrops, icon: Sprout },
    ],
    drone: [
      { id: 'drone', label: t.navDrone, icon: Plane },
      { id: 'iot', label: t.navIot, icon: Cpu },
      { id: 'labour', label: t.navLabour, icon: Users },
    ],
    market: [
      { id: 'market', label: t.navMarket, icon: TrendingUp },
      { id: 'profit', label: t.btnCalculateProfit, icon: DollarSign },
      { id: 'community', label: t.navCommunity, icon: MessageSquare },
    ],
  };

  const activeSubTabs = subNavMap[navGroup];

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
                {/* 1. OVERVIEW / HOME */}
                {activeTab === 'home' && (
                  <div className="space-y-10">
                    <HeroSection
                      currentLang={currentLang}
                      farm={currentFarm}
                      weather={weatherData}
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
                            <span>Open Farm Map</span>
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

                    {/* Field Impact Proof & Rythu Nestham Consultation */}
                    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                      <div className="lg:col-span-7 bg-[#174C36] text-white rounded-[26px] p-7 sm:p-9 flex flex-col justify-between shadow-lg">
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-[#DDEDE2] tracking-wide">
                            Field Trial Evidence · Guntur District
                          </div>
                          <blockquote className="text-lg sm:text-xl font-medium leading-relaxed text-white">
                            “Switching from broadcast urea to FarmersNeed FAO-56 drip timing and drone spraying reduced my Chilli pesticide spend from ₹14,000 to ₹7,800 across 3.2 acres while lifting output by 4 quintals.”
                          </blockquote>
                        </div>

                        <div className="pt-6 mt-6 border-t border-white/15 flex items-center gap-4">
                          <img
                            src="/src/assets/images/farmer_portrait_progressive_1794070591328.jpg"
                            alt="Venkata Subba Rao, Chilli and Paddy Grower"
                            className="w-12 h-12 rounded-[14px] object-cover border border-white/30"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-bold text-sm text-white">Venkata Subba Rao</div>
                            <div className="text-xs text-[#DDEDE2]">
                              Progressive Farmer · Pedavadlapudi, Tenali Mandal
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5 glass-panel rounded-[26px] p-7 sm:p-9 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="w-11 h-11 rounded-[16px] bg-[#DDEDE2] text-[#174C36] flex items-center justify-center">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <h3 className="text-xl font-bold text-[#202820] font-display">
                            Rythu Nestham Bilingual Agronomist
                          </h3>
                          <p className="text-xs sm:text-sm text-[#5D665E] leading-relaxed">
                            Ask voice or text questions in Telugu or English with full awareness of your farm GPS, crop stage, live weather, and Sentinel-2 NDVI reading.
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
                      marketPrices={marketPrices}
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
                    satelliteData={satelliteData}
                    onSelectFarm={handleSelectFarm}
                    onSaveFarm={handleSaveFarm}
                  />
                )}

                {/* 4. CROP INTELLIGENCE: SATELLITE */}
                {activeTab === 'satellite' && (
                  <SatelliteIntelligenceSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    onOpenDoctor={() => navigateTab('doctor')}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 5. CROP INTELLIGENCE: CROP DOCTOR */}
                {activeTab === 'doctor' && (
                  <CropDoctorSection
                    currentLang={currentLang}
                    farm={currentFarm}
                    onBookDrone={() => navigateTab('drone')}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 6. CROP INTELLIGENCE: CROP RECOMMENDER */}
                {activeTab === 'crops' && (
                  <CropRecommender
                    currentLang={currentLang}
                    farm={currentFarm}
                    onSimulateCropProfit={handleSimulateCropProfit}
                    onOpenAssistant={handleOpenAssistant}
                  />
                )}

                {/* 7. WATER & IRRIGATION */}
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
                    weather={weatherData}
                    loading={weatherLoading}
                    onRefreshLocation={(district) =>
                      loadWeather(
                        district || currentFarm.district,
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
                    onBookingSuccess={handleDroneBooked}
                  />
                )}

                {/* 10. FARM SERVICES: IOT HARDWARE CONSOLE */}
                {activeTab === 'iot' && (
                  <IotHardwareSection
                    currentLang={currentLang}
                    iotStatus={iotStatus}
                    onRefreshStatus={refreshIotStatus}
                    onNotify={addToast}
                  />
                )}

                {/* 11. FARM SERVICES: LABOUR NETWORK */}
                {activeTab === 'labour' && <LabourNetwork currentLang={currentLang} />}

                {/* 12. MARKET & FINANCE: MANDI PRICES */}
                {activeTab === 'market' && (
                  <MarketPricesSection currentLang={currentLang} prices={marketPrices} />
                )}

                {/* 13. MARKET & FINANCE: PROFIT CALCULATOR */}
                {activeTab === 'profit' && (
                  <ProfitCalculator
                    currentLang={currentLang}
                    initialCrop={selectedCropForProfit}
                    initialAcres={selectedAcresForProfit}
                    onBookDrone={() => navigateTab('drone')}
                  />
                )}

                {/* 14. MARKET & FINANCE: COMMUNITY FORUM */}
                {activeTab === 'community' && <CommunityForum currentLang={currentLang} />}
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
        farmContext={currentFarm}
      />
    </div>
  );
}
