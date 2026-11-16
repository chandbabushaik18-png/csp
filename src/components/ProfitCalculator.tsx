import React, { useState, useEffect } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Language, ProfitResponse, RecommendedCrop } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface ProfitCalculatorProps {
  currentLang: Language;
  initialCrop?: RecommendedCrop | null;
  initialAcres?: number;
  onBookDrone: () => void;
}

const CHART_COLORS = ['#174C36', '#4D966B', '#6FA886', '#94C2A6', '#B9DAC5', '#D6E8DC'];

export const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({
  currentLang,
  initialCrop,
  initialAcres = 2,
  onBookDrone,
}) => {
  const t = translations[currentLang];

  const [crop, setCrop] = useState(initialCrop ? initialCrop.name : 'Red Chilli (Guntur Hot)');
  const [acres, setAcres] = useState(initialAcres || 2);
  const [seedCost, setSeedCost] = useState(6500);
  const [fertilizerCost, setFertilizerCost] = useState(14000);
  const [pesticideCost, setPesticideCost] = useState(16000);
  const [labourCost, setLabourCost] = useState(22000);
  const [machineryCost, setMachineryCost] = useState(6500);
  const [irrigationCost, setIrrigationCost] = useState(3000);
  const [expectedYieldQuintals, setExpectedYieldQuintals] = useState(22);
  const [expectedPricePerQuintal, setExpectedPricePerQuintal] = useState(18500);

  const [profitData, setProfitData] = useState<ProfitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const applyPreset = (preset: string) => {
    setCrop(preset);
    if (preset.includes('Chilli')) {
      setSeedCost(6500);
      setFertilizerCost(14000);
      setPesticideCost(16000);
      setLabourCost(22000);
      setMachineryCost(6500);
      setIrrigationCost(3000);
      setExpectedYieldQuintals(22);
      setExpectedPricePerQuintal(18500);
    } else if (preset.includes('Paddy')) {
      setSeedCost(2800);
      setFertilizerCost(6500);
      setPesticideCost(4500);
      setLabourCost(10500);
      setMachineryCost(5000);
      setIrrigationCost(2000);
      setExpectedYieldQuintals(30);
      setExpectedPricePerQuintal(2450);
    } else if (preset.includes('Cotton')) {
      setSeedCost(3200);
      setFertilizerCost(7500);
      setPesticideCost(6500);
      setLabourCost(12500);
      setMachineryCost(4500);
      setIrrigationCost(2500);
      setExpectedYieldQuintals(14);
      setExpectedPricePerQuintal(7450);
    } else if (preset.includes('Groundnut')) {
      setSeedCost(4800);
      setFertilizerCost(5500);
      setPesticideCost(3500);
      setLabourCost(8500);
      setMachineryCost(4000);
      setIrrigationCost(2000);
      setExpectedYieldQuintals(16);
      setExpectedPricePerQuintal(6700);
    }
  };

  const calculateProfit = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson<ProfitResponse>('/api/profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop,
          acres,
          seedCost,
          fertilizerCost,
          pesticideCost,
          labourCost,
          machineryCost,
          irrigationCost,
          expectedYieldQuintals,
          expectedPricePerQuintal,
        }),
      });
      if (res.ok && res.data) {
        setProfitData(res.data);
      }
    } catch (e) {
      console.error('Profit calculation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateProfit();
  }, [
    crop,
    acres,
    seedCost,
    fertilizerCost,
    pesticideCost,
    labourCost,
    machineryCost,
    irrigationCost,
    expectedYieldQuintals,
    expectedPricePerQuintal,
  ]);

  // Compute SVG donut arc geometry
  const donutSegments = (() => {
    if (!profitData?.breakdown?.length) return [];
    const total = profitData.breakdown.reduce((acc, b) => acc + b.percent, 0) || 100;
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offsetAcc = 0;

    return profitData.breakdown.map((item, idx) => {
      const fraction = item.percent / total;
      const strokeLength = fraction * circumference;
      const dashOffset = -offsetAcc;
      offsetAcc += strokeLength;
      return {
        ...item,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        strokeLength,
        circumference,
        dashOffset,
      };
    });
  })();

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Input Sheet */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[#4D966B] tracking-wide">
                Financial Viability Modeling
              </span>
              {profitData?.provenance && <DataProvenanceBadge provenance={profitData.provenance} />}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.calculateProfitTitle}
            </h2>
            <p className="text-sm text-[#5D665E] mt-1 max-w-2xl">{t.calculateProfitSub}</p>
          </div>

          {/* Crop Presets */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-white/65 border border-white/80 rounded-[14px]">
            {['Red Chilli', 'Paddy', 'Cotton', 'Groundnut'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  crop.includes(p)
                    ? 'bg-[#174C36] text-white shadow-2xs'
                    : 'text-[#5D665E] hover:text-[#202820]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7 pt-6 border-t border-[#174C36]/10">
          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">Crop Name</label>
            <input
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Land Holding (Acres)
            </label>
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={acres}
              onChange={(e) => setAcres(Number(e.target.value))}
              className="w-full text-xs font-mono tabular-nums font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Exp. Yield / Acre (Qtl)
            </label>
            <input
              type="number"
              value={expectedYieldQuintals}
              onChange={(e) => setExpectedYieldQuintals(Number(e.target.value))}
              className="w-full text-xs font-mono tabular-nums font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Market Price (₹ / Qtl)
            </label>
            <input
              type="number"
              value={expectedPricePerQuintal}
              onChange={(e) => setExpectedPricePerQuintal(Number(e.target.value))}
              className="w-full text-xs font-mono tabular-nums font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>
        </div>

        {/* Cost Breakdown Inputs */}
        <div className="mt-6 pt-6 border-t border-[#174C36]/10">
          <div className="text-xs font-bold text-[#202820] mb-3">
            Input Costs per Acre (రూపాయలలో ఎకరా ఖర్చులు)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Seeds (విత్తనాలు)', val: seedCost, set: setSeedCost },
              { label: 'Fertilizer (ఎరువులు)', val: fertilizerCost, set: setFertilizerCost },
              { label: 'Pesticide (పురుగు మందులు)', val: pesticideCost, set: setPesticideCost },
              { label: 'Labour (కూలీలు)', val: labourCost, set: setLabourCost },
              { label: 'Machinery (ట్రాక్టర్)', val: machineryCost, set: setMachineryCost },
              { label: 'Irrigation / Power', val: irrigationCost, set: setIrrigationCost },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-[11px] text-[#5D665E] mb-1 truncate">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={field.val}
                  onChange={(e) => field.set(Number(e.target.value))}
                  className="w-full text-xs bg-white/75 border border-[#174C36]/15 rounded-[12px] px-2.5 py-2 font-mono tabular-nums text-[#202820] focus:bg-white focus:outline-[#174C36]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !profitData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="glass-panel rounded-[22px] p-6 h-28 skeleton-glass" />
          ))}
        </div>
      )}

      {/* Results Overview */}
      {profitData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel rounded-[22px] p-6">
              <div className="text-xs font-semibold text-[#858D86]">Total Cultivation Investment</div>
              <div className="text-2xl font-bold text-[#202820] font-display tabular-nums mt-1">
                ₹{profitData.summary.totalInvestment.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-[#5D665E] font-mono tabular-nums mt-1">
                ₹{profitData.summary.costPerAcre.toLocaleString('en-IN')} / acre
              </div>
            </div>

            <div className="glass-panel rounded-[22px] p-6">
              <div className="text-xs font-semibold text-[#858D86]">Gross Crop Revenue</div>
              <div className="text-2xl font-bold text-[#202820] font-display tabular-nums mt-1">
                ₹{profitData.summary.grossRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-[#5D665E] font-mono tabular-nums mt-1">
                {acres * expectedYieldQuintals} Quintals Total Yield
              </div>
            </div>

            <div className="bg-[#174C36] text-white rounded-[22px] p-6 shadow-md">
              <div className="text-xs font-semibold text-[#DDEDE2]">Net Estimated Profit</div>
              <div className="text-3xl font-extrabold font-display tabular-nums mt-1 text-white">
                ₹{profitData.summary.netProfit.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-[#DDEDE2] font-mono tabular-nums mt-1">
                ₹{profitData.summary.profitPerAcre.toLocaleString('en-IN')} / acre net gain
              </div>
            </div>

            <div className="glass-panel rounded-[22px] p-6">
              <div className="text-xs font-semibold text-[#858D86]">Return on Investment (ROI)</div>
              <div className="text-2xl font-bold text-[#174C36] font-display tabular-nums mt-1">
                {profitData.summary.roiPercentage}%
              </div>
              <div className="text-xs text-[#5D665E] font-mono tabular-nums mt-1">
                Break-even: ₹{profitData.summary.breakEvenPrice}/Qtl
              </div>
            </div>
          </div>

          {/* Breakdown Visualization & Cost Optimization */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Expenditure Distribution + SVG Donut Chart */}
            <div className="lg:col-span-7 glass-panel rounded-[24px] p-6">
              <h3 className="text-base font-bold text-[#202820] font-display">
                Expenditure Distribution Analysis
              </h3>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Donut Chart */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                      <circle
                        cx="70"
                        cy="70"
                        r="54"
                        fill="transparent"
                        stroke="rgba(23, 76, 54, 0.08)"
                        strokeWidth="16"
                      />
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.category}
                          cx="70"
                          cy="70"
                          r="54"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="16"
                          strokeDasharray={`${seg.strokeLength} ${seg.circumference}`}
                          strokeDashoffset={seg.dashOffset}
                        />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-[#858D86]">Cost/Ac</span>
                      <span className="text-sm font-bold text-[#202820] font-mono tabular-nums">
                        ₹{Math.round(profitData.summary.costPerAcre / 1000)}k
                      </span>
                    </div>
                  </div>
                </div>

                {/* Distribution Bars */}
                <div className="sm:col-span-7 space-y-3.5">
                  {profitData.breakdown.map((item, idx) => (
                    <div key={item.category} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium gap-2">
                        <span className="text-[#202820] truncate flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="truncate">{item.category}</span>
                        </span>
                        <span className="font-semibold text-[#202820] font-mono tabular-nums shrink-0">
                          ₹{item.amount.toLocaleString('en-IN')} ({item.percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#174C36]/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, item.percent)}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Planning Notes */}
            <div className="lg:col-span-5 glass-panel rounded-[24px] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-[#202820] font-display">
                  Budgeting & Input Planning Notes
                </h3>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="p-4 bg-[#DDEDE2]/45 rounded-[18px] border border-[#4D966B]/20">
                    <div className="font-bold text-[#174C36] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#4D966B]" />
                      <span>User-Editable Financial Assumptions</span>
                    </div>
                    <div className="text-[#202820] mt-1 leading-relaxed">
                      Totals are calculated directly from the input costs, expected yield, and price values you enter above. Adjust each line item to match local mandi rates and input bills.
                    </div>
                  </div>

                  <div className="p-4 bg-white/60 rounded-[18px] border border-white/80">
                    <div className="font-semibold text-[#202820]">Precision Input Scheduling</div>
                    <div className="text-[#5D665E] mt-1 leading-relaxed">
                      Split-application of urea, soil-test-based potash/phosphorus dosing, and timely pest scouting help avoid unnecessary chemical expenditure.
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onBookDrone}
                className="mt-6 w-full py-3 bg-[#174C36] hover:bg-[#113A29] text-white text-xs font-semibold rounded-[14px] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Request Spraying Service Quote</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
