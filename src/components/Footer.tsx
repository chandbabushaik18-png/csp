import React from 'react';
import { Sprout, Phone, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

interface FooterProps {
  currentLang: Language;
  onNavigateTab: (tab: string) => void;
  onOpenAssistant: () => void;
}

export const Footer: React.FC<FooterProps> = ({ currentLang, onNavigateTab, onOpenAssistant }) => {
  const t = translations[currentLang];

  return (
    <footer className="mt-12 border-t border-[#174C36]/10 bg-white/55 backdrop-blur-xl py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#174C36]/10 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#174C36] flex items-center justify-center text-white shadow-xs">
                <Sprout className="w-4 h-4" />
              </div>
              <span className="text-base font-bold font-display tracking-tight text-[#202820]">
                FarmersNeed
              </span>
            </div>
            <p className="text-[#858D86] leading-relaxed">
              Precision agriculture intelligence combining Copernicus Sentinel-2 remote sensing, hyper-local weather telemetry, FAO-56 water budgeting, and bilingual agronomy.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-[#202820] uppercase tracking-wider text-[11px]">
              Intelligence
            </div>
            <ul className="space-y-1.5 text-[#5D665E]">
              <li>
                <button type="button" onClick={() => onNavigateTab('location')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  Satellite Farm Map & GPS
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigateTab('satellite')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  Crop Intelligence (NDVI / NDWI)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigateTab('water')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  Water & Irrigation Budget
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigateTab('doctor')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  AI Leaf Pathology Doctor
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-[#202820] uppercase tracking-wider text-[11px]">
              Services & Markets
            </div>
            <ul className="space-y-1.5 text-[#5D665E]">
              <li>
                <button type="button" onClick={() => onNavigateTab('drone')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  DGCA Drone Spraying
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigateTab('iot')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  ESP32 IoT Hardware Node
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigateTab('market')} className="hover:text-[#174C36] transition-colors cursor-pointer">
                  Live APMC Mandi Prices
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenAssistant} className="hover:text-[#174C36] font-semibold text-[#174C36] transition-colors cursor-pointer">
                  రైతు నేస్తం AI Advisor
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="font-bold text-[#202820] uppercase tracking-wider text-[11px]">
              Farmer Helpline
            </div>
            <div className="p-3.5 rounded-2xl bg-[#DDEDE2]/65 border border-[#4D966B]/20 space-y-1">
              <div className="flex items-center gap-1.5 text-[#174C36] font-semibold">
                <Phone className="w-3.5 h-3.5" />
                <span>Kisan Call Centre</span>
              </div>
              <div className="text-base font-bold text-[#174C36] font-mono">1800-180-1551</div>
              <div className="text-[11px] text-[#5D665E]">Toll-Free Agronomy Support</div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#858D86]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4D966B]" />
              <span>ANGRAU & ICAR Scientific Standards</span>
            </div>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#858D86] gap-3">
          <div>{t.footerCopyright}</div>
          <div>Designed for precision farming across India</div>
        </div>
      </div>
    </footer>
  );
};
