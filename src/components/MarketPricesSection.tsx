import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { Language, MarketPrice, DataProvenance } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface MarketPricesSectionProps {
  currentLang: Language;
  prices: MarketPrice[];
  loading?: boolean;
  unavailableMessage?: string | null;
  onRetry?: () => void;
}

export const MarketPricesSection: React.FC<MarketPricesSectionProps> = ({
  currentLang,
  prices,
  loading = false,
  unavailableMessage,
  onRetry,
}) => {
  const t = translations[currentLang];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'up' | 'msp-above'>('all');

  const filteredPrices = prices.filter((p) => {
    const matchesSearch =
      p.commodity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.market.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedFilter === 'up') return p.trend === 'up';
    if (selectedFilter === 'msp-above') return typeof p.msp === 'number' && p.modalPrice >= p.msp;
    return true;
  });

  const marketProvenance: DataProvenance =
    prices[0]?.provenance || {
      integrityState: 'UNAVAILABLE',
      classification: 'UNAVAILABLE',
      source: 'Live APMC Mandi Feed (Agmarknet / Grounded Market Search)',
      timestamp: new Date().toISOString(),
      isRealTime: false,
      notes:
        unavailableMessage ||
        'Live APMC market data is currently unavailable.',
    };

  const groundingSources =
    prices[0]?.groundingSources || marketProvenance.groundingSources || [];

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[#4D966B] tracking-wide">
                APMC & Mandi Market Intelligence
              </span>
              <DataProvenanceBadge provenance={marketProvenance} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.marketTitle}
            </h2>
            <p className="text-sm text-[#5D665E] mt-1 max-w-2xl">{t.marketSub}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {prices.length > 0 && (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#858D86] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search crop or mandi..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white/75 border border-[#174C36]/15 rounded-[14px] text-xs font-medium text-[#202820] focus:bg-white focus:outline-[#174C36] w-full sm:w-52"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white/65 border border-white/80 p-1 rounded-[14px]">
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedFilter === 'all'
                        ? 'bg-[#174C36] text-white shadow-2xs'
                        : 'text-[#5D665E] hover:text-[#202820]'
                    }`}
                  >
                    All Crops
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('up')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedFilter === 'up'
                        ? 'bg-[#174C36] text-white shadow-2xs'
                        : 'text-[#5D665E] hover:text-[#202820]'
                    }`}
                  >
                    Gaining
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('msp-above')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedFilter === 'msp-above'
                        ? 'bg-[#174C36] text-white shadow-2xs'
                        : 'text-[#5D665E] hover:text-[#202820]'
                    }`}
                  >
                    Above MSP
                  </button>
                </div>
              </>
            )}

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="px-3.5 py-2 bg-[#174C36] hover:bg-[#113A29] text-white text-xs font-semibold rounded-[12px] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh Quotes'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Commodity Prices Content or Honest UNAVAILABLE State */}
        <div className="mt-7 overflow-x-auto">
          {prices.length === 0 ? (
            <div className="p-8 rounded-[20px] bg-amber-50/75 border border-amber-200/80 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-700 mx-auto" />
              <div className="text-sm font-bold text-[#202820]">
                {loading ? 'Fetching live APMC mandi quotes...' : 'Market data currently unavailable.'}
              </div>
              <p className="text-xs text-[#5D665E] max-w-lg mx-auto leading-relaxed">
                {unavailableMessage ||
                  'Live Agmarknet / APMC market quotes are temporarily unreachable. Click retry to query fresh grounded market prices.'}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={loading}
                  className="px-4 py-2 bg-[#174C36] hover:bg-[#113A29] text-white text-xs font-semibold rounded-[12px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Loading...' : 'Retry Market Feed'}</span>
                </button>
              )}
            </div>
          ) : filteredPrices.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-white/45 rounded-[20px]">
              <div className="text-sm font-semibold text-[#202820]">
                No commodities matched your current filter
              </div>
              <p className="text-xs text-[#858D86]">
                Reset your search query or filter criteria to inspect all APMC yard rates.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedFilter('all');
                }}
                className="px-4 py-2 bg-[#174C36] text-white text-xs font-semibold rounded-[12px] cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#174C36]/12 text-[#858D86] font-semibold text-[11px]">
                  <th className="pb-3 pl-2">Commodity & Variety</th>
                  <th className="pb-3">Primary Mandi</th>
                  <th className="pb-3 text-right">Modal Rate</th>
                  <th className="pb-3 text-right">Min – Max Range</th>
                  <th className="pb-3 text-right">Govt MSP</th>
                  <th className="pb-3 text-right">Daily Shift</th>
                  <th className="pb-3 text-right pr-2">Arrivals / Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#174C36]/8">
                {filteredPrices.map((item) => (
                  <tr key={item.cropKey} className="hover:bg-white/55 transition-colors">
                    <td className="py-3.5 pl-2 font-semibold text-[#202820]">
                      <div>{item.commodity}</div>
                    </td>
                    <td className="py-3.5 text-[#5D665E]">{item.market}</td>
                    <td className="py-3.5 text-right font-extrabold text-[#202820] font-mono tabular-nums text-sm">
                      ₹{item.modalPrice.toLocaleString('en-IN')}
                      <span className="text-[11px] font-normal text-[#858D86] block">/ Quintal</span>
                    </td>
                    <td className="py-3.5 text-right font-medium text-[#5D665E] font-mono tabular-nums">
                      ₹{item.minPrice.toLocaleString('en-IN')} – ₹{item.maxPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 text-right text-[#5D665E] font-mono tabular-nums">
                      {typeof item.msp === 'number' ? `₹${item.msp.toLocaleString('en-IN')}` : 'N/A'}
                    </td>
                    <td className="py-3.5 text-right font-semibold font-mono tabular-nums">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                          item.trend === 'up'
                            ? 'text-[#174C36] bg-[#DDEDE2]'
                            : item.trend === 'down'
                            ? 'text-red-700 bg-red-100/80'
                            : 'text-[#5D665E] bg-white/70'
                        }`}
                      >
                        {item.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                        {item.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                        {item.trend === 'stable' && <Minus className="w-3.5 h-3.5" />}
                        <span>{item.change}</span>
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-2 text-[#5D665E] font-mono tabular-nums">
                      {item.arrivals || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-[#174C36]/10 flex flex-col gap-3 text-xs text-[#858D86]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Source: {marketProvenance.source}</span>
            <span className="font-semibold text-[#174C36]">
              {prices.length > 0 ? `${prices.length} Records Loaded` : 'Feed Unavailable'}
            </span>
          </div>
          {groundingSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-[#5D665E]">Verified Web Sources:</span>
              {groundingSources.slice(0, 5).map((src) => (
                <a
                  key={src.uri}
                  href={src.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/75 border border-[#174C36]/15 text-[#174C36] hover:bg-[#DDEDE2] transition-colors"
                >
                  <span className="truncate max-w-[180px]">{src.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
