import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sprout,
  LayoutGrid,
  Compass,
  Satellite,
  Droplets,
  CloudSun,
  Wrench,
  Bell,
  MapPin,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  Check,
  Navigation,
  Cpu,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { AppNotification, FarmProfile, IotDeviceStatus, Language } from '../types';
import { translations } from '../translations';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAssistant: () => void;
  currentFarm: FarmProfile;
  savedFarms: FarmProfile[];
  onSelectFarm: (farm: FarmProfile) => void;
  onUseGps: () => void;
  notifications: AppNotification[];
  onMarkAllNotificationsRead: () => void;
  iotStatus: IotDeviceStatus | null;
}

export function getNavGroup(tab: string): string {
  if (tab === 'home') return 'home';
  if (tab === 'dashboard' || tab === 'location') return 'dashboard';
  if (tab === 'doctor' || tab === 'crops') return 'doctor';
  if (tab === 'satellite') return 'satellite';
  if (tab === 'water') return 'water';
  if (tab === 'weather') return 'weather';
  if (
    tab === 'drone' ||
    tab === 'market' ||
    tab === 'profit' ||
    tab === 'labour' ||
    tab === 'community'
  ) {
    return 'drone';
  }
  if (tab === 'iot') return 'iot';
  return 'home';
}

export const SidebarNavigation: React.FC<NavbarProps> = ({
  currentLang,
  activeTab,
  onSelectTab,
  onOpenAssistant,
  currentFarm,
  iotStatus,
}) => {
  const t = translations[currentLang];
  const currentGroup = getNavGroup(activeTab);

  // Clean 8-item Navigation Structure
  const navItems = [
    { id: 'home', label: t.navOverview, icon: Compass },
    { id: 'dashboard', label: t.navMyFarm, icon: LayoutGrid },
    { id: 'doctor', label: t.navCropIntel, icon: Sprout },
    { id: 'satellite', label: t.navSatellite, icon: Satellite },
    { id: 'water', label: t.navWater, icon: Droplets },
    { id: 'weather', label: t.navWeather, icon: CloudSun },
    { id: 'drone', label: t.navServices, icon: Wrench },
    { id: 'iot', label: t.navIot, icon: Cpu },
  ];

  const iotLive = Boolean(iotStatus?.connected);

  return (
    <aside className="hidden lg:flex flex-col w-[248px] shrink-0 sticky top-4 h-[calc(100vh-2rem)] glass-sidebar rounded-[26px] p-4 justify-between">
      <div className="space-y-6">
        {/* Brand Identity */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 px-2 py-1 text-left cursor-pointer group w-full"
        >
          <div className="w-10 h-10 rounded-[14px] bg-[#174C36] text-white flex items-center justify-center shadow-sm group-hover:bg-[#1e5f44] transition-colors shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-lg font-extrabold tracking-tight text-[#202820] font-display block leading-none">
              FarmersNeed
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-[#4D966B] uppercase block mt-1">
              Smart Agri Intel
            </span>
          </div>
        </button>

        {/* Primary Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentGroup === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-[13px] font-semibold transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-[#525B53] hover:text-[#202820] hover:bg-white/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktopSidebarActive"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-[#174C36] rounded-[14px] shadow-[0_6px_16px_-4px_rgba(23,76,54,0.35)]"
                  />
                )}
                <Icon
                  className={`w-4 h-4 relative z-10 shrink-0 ${
                    isActive ? 'text-[#DDEDE2]' : 'text-[#4D966B]'
                  }`}
                />
                <span className="relative z-10 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Workspace Widgets */}
      <div className="space-y-3 pt-4 border-t border-[#174C36]/10">
        {/* IoT Quick Status Pill */}
        <button
          type="button"
          onClick={() => onSelectTab('iot')}
          className="w-full px-3 py-2.5 rounded-[14px] bg-white/65 hover:bg-white border border-white/80 text-left transition-all cursor-pointer flex items-center justify-between text-xs"
        >
          <span className="flex items-center gap-2 font-semibold text-[#202820] truncate">
            <Cpu className="w-3.5 h-3.5 text-[#4D966B] shrink-0" />
            <span className="truncate">ESP32 Node</span>
          </span>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
              iotLive ? 'bg-[#DDEDE2] text-[#174C36]' : 'bg-white/90 text-[#5D665E] border border-[#858D86]/25'
            }`}
          >
            {iotLive ? 'LIVE DATA' : 'NO DATA'}
          </span>
        </button>

        {/* Active Farm Mini Card */}
        <button
          type="button"
          onClick={() => onSelectTab('location')}
          className="w-full p-3 rounded-[16px] bg-[#DDEDE2]/60 hover:bg-[#DDEDE2]/90 border border-[#4D966B]/15 text-left transition-colors cursor-pointer"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#4D966B]">
            Selected Location
          </div>
          <div className="text-xs font-bold text-[#202820] truncate mt-0.5">{currentFarm.name}</div>
          <div className="text-[11px] text-[#5D665E] font-mono mt-0.5 truncate">
            {currentFarm.areaAcres.toFixed(1)} Ac · {currentFarm.village || currentFarm.district}
          </div>
        </button>

        {/* Rythu Nestham AI Trigger */}
        <button
          type="button"
          onClick={onOpenAssistant}
          className="w-full py-2.5 px-3.5 rounded-[14px] bg-[#174C36]/95 hover:bg-[#174C36] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#DDEDE2]" />
          <span>రైతు నేస్తం AI</span>
        </button>
      </div>
    </aside>
  );
};

export const TopGlassBar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  activeTab,
  onSelectTab,
  onOpenAssistant,
  currentFarm,
  savedFarms,
  onSelectFarm,
  onUseGps,
  notifications,
  onMarkAllNotificationsRead,
}) => {
  const t = translations[currentLang];
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const mobileAllItems = [
    { id: 'home', label: t.navOverview, icon: Compass },
    { id: 'dashboard', label: t.navMyFarm, icon: LayoutGrid },
    { id: 'doctor', label: t.navCropIntel, icon: Sprout },
    { id: 'satellite', label: t.navSatellite, icon: Satellite },
    { id: 'water', label: t.navWater, icon: Droplets },
    { id: 'weather', label: t.navWeather, icon: CloudSun },
    { id: 'drone', label: t.navServices, icon: Wrench },
    { id: 'iot', label: t.navIot, icon: Cpu },
  ];

  return (
    <header className="sticky top-3 z-40">
      <div className="glass-panel rounded-[20px] px-3.5 sm:px-5 h-14 flex items-center justify-between gap-3">
        {/* Left: Mobile Brand + Current Location Context */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="lg:hidden flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#174C36] text-white flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-sm text-[#202820] hidden sm:inline">
              FarmersNeed
            </span>
          </button>

          {/* Farm Profile Switcher */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-white/90 text-xs transition-all cursor-pointer max-w-[240px] sm:max-w-xs"
            >
              <MapPin className="w-3.5 h-3.5 text-[#174C36] shrink-0" />
              <span className="font-semibold text-[#202820] truncate">
                {currentFarm.village || currentFarm.district}
              </span>
              <span className="hidden md:inline text-[#858D86] truncate">
                · {currentFarm.currentCrop.split('(')[0].trim()}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#858D86] shrink-0" />
            </button>

            {profileOpen && (
              <div className="absolute left-0 mt-2 w-72 glass-panel-elevated rounded-[20px] p-2.5 z-50">
                <div className="px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Farm Locations
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onUseGps();
                      setProfileOpen(false);
                    }}
                    className="text-[11px] font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Detect GPS</span>
                  </button>
                </div>
                <div className="space-y-1 mt-1">
                  {savedFarms.map((farm) => {
                    const selected = farm.id === currentFarm.id;
                    return (
                      <button
                        key={farm.id}
                        type="button"
                        onClick={() => {
                          onSelectFarm(farm);
                          setProfileOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          selected ? 'bg-[#174C36] text-white' : 'hover:bg-white/80 text-[#202820]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{farm.name}</div>
                          <div
                            className={`text-[10px] truncate ${
                              selected ? 'text-[#DDEDE2]' : 'text-[#858D86]'
                            }`}
                          >
                            {farm.village ? `${farm.village}, ` : ''}
                            {farm.district} · {farm.areaAcres.toFixed(1)} Ac
                          </div>
                        </div>
                        {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-[#174C36]/10">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('location');
                      setProfileOpen(false);
                    }}
                    className="w-full py-2 text-xs font-semibold text-[#174C36] hover:bg-[#DDEDE2]/60 rounded-xl transition-colors cursor-pointer"
                  >
                    Open Farm Map & Draw Boundary →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: GPS Quick Detect, Notifications Bell, Language Toggle, Mobile Drawer */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUseGps}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/75 hover:bg-white border border-white/90 text-xs font-semibold text-[#174C36] transition-all cursor-pointer"
            title="Detect current farm GPS coordinates"
          >
            <Navigation className="w-3.5 h-3.5 text-[#4D966B]" />
            <span>GPS</span>
          </button>

          {/* Notification Center */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-xl bg-white/75 hover:bg-white border border-white/90 text-[#202820] transition-colors cursor-pointer"
              aria-label="Open farm alerts and notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#174C36] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-panel-elevated rounded-[22px] p-3 z-50">
                <div className="px-2 py-1.5 flex items-center justify-between border-b border-[#174C36]/10 pb-2.5">
                  <span className="text-xs font-bold text-[#202820] font-display">
                    Farm Advisories & Status
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="text-[11px] font-semibold text-[#4D966B] hover:text-[#174C36] cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#858D86]">
                      No active weather or sensor alerts.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const SeverityIcon =
                        n.severity === 'critical' || n.severity === 'warning'
                          ? AlertTriangle
                          : n.severity === 'success'
                          ? CheckCircle2
                          : Info;
                      const badgeTone =
                        n.severity === 'critical'
                          ? 'text-red-700 bg-red-100'
                          : n.severity === 'warning'
                          ? 'text-amber-700 bg-amber-100'
                          : n.severity === 'success'
                          ? 'text-[#174C36] bg-[#DDEDE2]'
                          : 'text-[#4D966B] bg-[#DDEDE2]/70';

                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (n.targetTab) onSelectTab(n.targetTab);
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-2xl transition-colors flex items-start gap-2.5 text-xs cursor-pointer ${
                            n.read ? 'opacity-70 hover:bg-white/60' : 'bg-white/75 hover:bg-white'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${badgeTone}`}>
                            <SeverityIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[#202820] truncate">
                              {currentLang === 'te' ? n.titleTe : n.title}
                            </div>
                            <p className="text-[11px] text-[#5D665E] leading-snug mt-0.5">
                              {currentLang === 'te' ? n.messageTe : n.message}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <div className="flex items-center bg-white/70 p-0.5 rounded-xl border border-white/90">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-[9px] transition-all cursor-pointer ${
                currentLang === 'en' ? 'bg-[#174C36] text-white shadow-2xs' : 'text-[#525B53]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('te')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-[9px] transition-all cursor-pointer ${
                currentLang === 'te' ? 'bg-[#174C36] text-white shadow-2xs' : 'text-[#525B53]'
              }`}
            >
              తెలుగు
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-white/75 border border-white/90 text-[#202820] cursor-pointer"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 glass-panel-elevated rounded-[22px] p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mobileAllItems.map((item) => {
              const Icon = item.icon;
              const isActive = getNavGroup(activeTab) === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    isActive ? 'bg-[#174C36] text-white' : 'bg-white/75 text-[#202820]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenAssistant();
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 rounded-xl bg-[#174C36] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#DDEDE2]" />
            <span>రైతు నేస్తం AI Assistant</span>
          </button>
        </div>
      )}
    </header>
  );
};

export const MobileBottomDock: React.FC<{
  activeTab: string;
  onSelectTab: (tab: string) => void;
  currentLang: Language;
}> = ({ activeTab, onSelectTab, currentLang }) => {
  const t = translations[currentLang];
  const group = getNavGroup(activeTab);

  const items = [
    { id: 'home', label: t.navOverview, icon: Compass },
    { id: 'dashboard', label: t.navMyFarm, icon: LayoutGrid },
    { id: 'doctor', label: 'Crop AI', icon: Sprout },
    { id: 'weather', label: t.navWeather, icon: CloudSun },
    { id: 'drone', label: 'Services', icon: Wrench },
  ];

  return (
    <nav className="lg:hidden fixed bottom-3 inset-x-3 z-40 glass-panel-elevated rounded-[20px] px-2 py-1.5 flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const active = group === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
              active ? 'text-[#174C36] bg-[#DDEDE2]/80' : 'text-[#858D86]'
            }`}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
