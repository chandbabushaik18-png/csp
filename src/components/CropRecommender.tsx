import React, { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { Language, RecommendationResponse, RecommendedCrop, FarmProfile } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface CropRecommenderProps {
  currentLang: Language;
  farm?: FarmProfile;
  onSimulateCropProfit: (crop: RecommendedCrop, acres: number) => void;
  onOpenAssistant: (query?: string) => void;
}

export const CropRecommender: React.FC<CropRecommenderProps> = ({
  currentLang,
  farm,
  onSimulateCropProfit,
  onOpenAssistant,
}) => {
  const t = translations[currentLang];

  const [season, setSeason] = useState('Rabi');
  const [soilType, setSoilType] = useState(
    farm?.soilType || 'Black Cotton Soil (నల్లరేగడి)'
  );
  const [irrigation, setIrrigation] = useState('Borewell / Drip (బోరు / డ్రిప్)');
  const [landSizeAcres, setLandSizeAcres] = useState(farm?.areaAcres || 3);
  const [district, setDistrict] = useState(farm?.district || 'Guntur');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  useEffect(() => {
    if (farm) {
      if (farm.district) setDistrict(farm.district);
      if (farm.areaAcres) setLandSizeAcres(farm.areaAcres);
      if (farm.soilType) {
        const st = farm.soilType.toLowerCase();
        if (st.includes('black') || st.includes('నల్ల')) {
          setSoilType('Black Cotton Soil (నల్లరేగడి)');
        } else if (st.includes('red') || st.includes('ఎర్ర')) {
          setSoilType('Red Sandy Loam (ఎర్ర నేలలు)');
        } else if (st.includes('alluvial') || st.includes('ఒండ్రు')) {
          setSoilType('Alluvial River Soil (ఒండ్రు నేలలు)');
        } else if (st.includes('clay') || st.includes('బంక')) {
          setSoilType('Heavy Clay (బంకమట్టి నేల)');
        }
      }
      if (farm.irrigationMethod) {
        const im = farm.irrigationMethod.toLowerCase();
        if (im.includes('drip') || im.includes('borewell')) {
          setIrrigation('Borewell / Drip (బోరు / డ్రిప్)');
        } else if (im.includes('canal')) {
          setIrrigation('Canal Irrigation (కాలువ నీరు)');
        } else if (im.includes('rain')) {
          setIrrigation('Rainfed / Dryland (వర్షాధార సాగు)');
        }
      }
    }
  }, [farm?.id, farm?.district, farm?.soilType, farm?.irrigationMethod, farm?.areaAcres]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await safeFetchJson<any>('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          soilType,
          irrigation,
          landSizeAcres,
          district,
          village: farm?.village,
        }),
      });
      const data = res.data;
      if (res.ok && data?.success) {
        setResult(data);
      } else {
        setErrorMsg(data?.error || `Failed to load recommendations (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      setErrorMsg('Network error while contacting agronomic planning service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [district, soilType, irrigation, landSizeAcres, season]);

  const soilOptions = [
    'Black Cotton Soil (నల్లరేగడి)',
    'Red Sandy Loam (ఎర్ర నేలలు)',
    'Alluvial River Soil (ఒండ్రు నేలలు)',
    'Heavy Clay (బంకమట్టి నేల)',
    'Sandy Coastal Soil (ఇసుక నేలలు)',
  ];

  const irrigationOptions = [
    'Borewell / Drip (బోరు / డ్రిప్)',
    'Canal Irrigation (కాలువ నీరు)',
    'Rainfed / Dryland (వర్షాధార సాగు)',
    'Tank / Well (చెరువు / బావి)',
  ];

  const baseDistricts = [
    'Guntur',
    'Warangal',
    'Hanamkonda',
    'Kurnool',
    'Khammam',
    'Nalgonda',
    'Anantapur',
    'Krishna',
    'Prakasam',
    'West Godavari',
    'Karimnagar',
  ];
  const districtOptions =
    farm?.district && !baseDistricts.includes(farm.district)
      ? [farm.district, ...baseDistricts]
      : baseDistricts;

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Input Matrix */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-[#4D966B] tracking-wide">
              Precision Agronomy Engine
            </span>
            {result?.provenance && <DataProvenanceBadge provenance={result.provenance} />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
            {t.recommenderTitle}
          </h2>
          <p className="text-sm text-[#5D665E] mt-2 leading-relaxed">{t.recommenderSub}</p>
        </div>

        {/* Input Parameters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-7 pt-6 border-t border-[#174C36]/10">
          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">{t.district}</label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:outline-[#174C36] focus:bg-white"
            >
              {districtOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">{t.season}</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:outline-[#174C36] focus:bg-white"
            >
              <option value="Rabi">Rabi (రబీ - శీతాకాలం)</option>
              <option value="Kharif">Kharif (ఖరీఫ్ - వర్షాకాలం)</option>
              <option value="Zaid">Zaid (జాయద్ - వేసవి)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">{t.soilType}</label>
            <select
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:outline-[#174C36] focus:bg-white"
            >
              {soilOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              {t.irrigationType}
            </label>
            <select
              value={irrigation}
              onChange={(e) => setIrrigation(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:outline-[#174C36] focus:bg-white"
            >
              {irrigationOptions.map((irr) => (
                <option key={irr} value={irr}>
                  {irr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">{t.landSize}</label>
            <input
              type="number"
              min="0.5"
              max="50"
              step="0.5"
              value={landSizeAcres}
              onChange={(e) => setLandSizeAcres(Number(e.target.value))}
              className="w-full text-xs font-mono tabular-nums font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3 py-2.5 text-[#202820] focus:outline-[#174C36] focus:bg-white"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={loading}
            className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white text-xs font-semibold rounded-[14px] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating Agronomy...' : 'Update Recommendations'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="glass-panel rounded-[20px] p-4 bg-red-50/80 border border-red-200 text-xs text-red-900 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !result && (
        <div className="glass-panel rounded-[24px] p-8 space-y-4">
          <div className="h-6 w-64 rounded-lg skeleton-glass" />
          <div className="h-24 w-full rounded-2xl skeleton-glass" />
        </div>
      )}

      {/* Advisory Result Narrative */}
      {result && (
        <div className="glass-panel rounded-[20px] p-5 bg-[#DDEDE2]/45 border border-[#4D966B]/20 flex items-start gap-3.5">
          <Sparkles className="w-5 h-5 text-[#174C36] shrink-0 mt-0.5" />
          <div className="text-sm text-[#202820] leading-relaxed">
            <span className="font-bold text-[#174C36]">Agronomist Recommendation: </span>
            {currentLang === 'te' ? result.summaryTe : result.summary}
          </div>
        </div>
      )}

      {/* Primary Recommended Crop */}
      {result?.primaryRecommendation && (
        <div className="glass-panel-elevated rounded-[26px] p-6 sm:p-8 border border-[#4D966B]/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#4D966B] font-semibold">
                <span>Top Recommended Crop (అత్యుత్తమ ఎంపిక)</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#174C36] font-bold">
                  {result.primaryRecommendation.suitabilityScore}% Suitability Match
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#202820] font-display">
                {result.primaryRecommendation.name}
              </h3>
              <div className="text-base font-semibold text-[#174C36]">
                {result.primaryRecommendation.nameTe}
              </div>
              <div className="text-xs text-[#5D665E]">
                High-yielding variety:{' '}
                <span className="font-semibold text-[#202820]">
                  {result.primaryRecommendation.variety}
                </span>
              </div>
            </div>

            {/* Net Profit Spotlight */}
            <div className="p-5 bg-[#174C36] text-white rounded-[20px] text-right min-w-[240px] shadow-md">
              <div className="text-xs text-[#DDEDE2] font-medium">
                Estimated Net Profit ({landSizeAcres} Acres)
              </div>
              <div className="text-3xl font-extrabold font-display tabular-nums mt-1">
                ₹{result.primaryRecommendation.totalNetProfit.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-[#DDEDE2] mt-1 font-mono tabular-nums">
                {result.primaryRecommendation.roiPercentage}% Projected ROI
              </div>
            </div>
          </div>

          {/* Metric Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-7 pt-6 border-t border-[#174C36]/10 text-xs">
            <div>
              <div className="text-[#858D86]">Crop Duration</div>
              <div className="text-sm font-bold text-[#202820] font-mono tabular-nums mt-0.5">
                {result.primaryRecommendation.durationDays} Days
              </div>
              <div className="text-[#5D665E] mt-0.5">
                {result.primaryRecommendation.bestSowingWindow}
              </div>
            </div>

            <div>
              <div className="text-[#858D86]">Expected Yield / Acre</div>
              <div className="text-sm font-bold text-[#202820] font-mono tabular-nums mt-0.5">
                {result.primaryRecommendation.expectedYieldPerAcreQuintals} Quintals
              </div>
              <div className="text-[#5D665E] mt-0.5 font-mono tabular-nums">
                Total: ~{result.primaryRecommendation.expectedYieldPerAcreQuintals * landSizeAcres} Qtl
              </div>
            </div>

            <div>
              <div className="text-[#858D86]">Reference Planning Rate</div>
              <div className="text-sm font-bold text-[#202820] font-mono tabular-nums mt-0.5">
                ₹{result.primaryRecommendation.expectedPricePerQuintal.toLocaleString('en-IN')} / Qtl
              </div>
              <div className="text-[#4D966B] mt-0.5 font-medium">Planning Estimate (Not live APMC)</div>
            </div>

            <div>
              <div className="text-[#858D86]">Water Requirement</div>
              <div className="text-sm font-bold text-[#202820] mt-0.5">
                {result.primaryRecommendation.waterRequirement}
              </div>
              <div className="text-[#5D665E] mt-0.5">
                {result.primaryRecommendation.waterRequirementTe}
              </div>
            </div>
          </div>

          {/* Agronomic Guidance & Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#174C36]/10 text-xs">
            <div className="p-4 bg-white/60 rounded-[16px] border border-white/80">
              <div className="font-semibold text-[#202820] mb-1">Soil Suitability Rationale</div>
              <div className="text-[#5D665E] leading-relaxed">
                {currentLang === 'te'
                  ? result.primaryRecommendation.soilSuitabilityReasonTe
                  : result.primaryRecommendation.soilSuitabilityReason}
              </div>
            </div>

            <div className="p-4 bg-amber-50/75 rounded-[16px] border border-amber-200/70">
              <div className="font-semibold text-amber-950 mb-1">Key Risks & Pest Management</div>
              <div className="text-amber-900 leading-relaxed">
                {currentLang === 'te'
                  ? result.primaryRecommendation.risksTe
                  : result.primaryRecommendation.risks}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#174C36]/10">
            <button
              type="button"
              onClick={() =>
                onOpenAssistant(
                  `Tell me how to grow ${result.primaryRecommendation.name} in ${district} with highest yield`
                )
              }
              className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#4D966B]" />
              <span>Ask AI Advisor for step-by-step fertilizer plan</span>
            </button>

            <button
              type="button"
              onClick={() => onSimulateCropProfit(result.primaryRecommendation, landSizeAcres)}
              className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Simulate Detailed Economics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alternative Crops Grid */}
      {result?.alternatives && result.alternatives.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#202820] font-display px-1">
            Alternative Suitable Crops for Comparison
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {result.alternatives.map((crop) => (
              <div
                key={crop.cropKey}
                className="glass-panel rounded-[22px] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#5D665E]">
                    <span className="font-mono tabular-nums">{crop.durationDays} Days</span>
                    <span className="font-mono font-bold text-[#174C36] tabular-nums">
                      {crop.suitabilityScore}% Match
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-[#202820] font-display mt-2">{crop.name}</h4>
                  <div className="text-xs font-semibold text-[#4D966B]">{crop.nameTe}</div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-[#174C36]/10">
                      <span className="text-[#858D86]">Exp. Yield</span>
                      <span className="font-semibold text-[#202820] font-mono tabular-nums">
                        {crop.expectedYieldPerAcreQuintals} Qtl / Ac
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#174C36]/10">
                      <span className="text-[#858D86]">Market Rate</span>
                      <span className="font-semibold text-[#202820] font-mono tabular-nums">
                        ₹{crop.expectedPricePerQuintal.toLocaleString('en-IN')} / Qtl
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#174C36]/10">
                      <span className="text-[#858D86]">Est. Net Profit</span>
                      <span className="font-bold text-[#174C36] font-mono tabular-nums">
                        ₹{crop.totalNetProfit.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSimulateCropProfit(crop, landSizeAcres)}
                  className="mt-6 w-full py-2.5 px-3 text-xs font-semibold text-[#174C36] bg-[#DDEDE2]/65 hover:bg-[#DDEDE2] rounded-[12px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Analyze Profit & Costs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
