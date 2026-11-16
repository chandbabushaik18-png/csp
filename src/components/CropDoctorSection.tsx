import React, { useState } from 'react';
import {
  Camera,
  AlertCircle,
  Sparkles,
  Plane,
  ShieldCheck,
  Upload,
  Info,
  X,
  CheckCircle2,
} from 'lucide-react';
import { FarmProfile, Language, LeafDiagnosisResult } from '../types';
import { translations } from '../translations';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface CropDoctorSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  onBookDrone: () => void;
  onOpenAssistant: (query?: string) => void;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const CropDoctorSection: React.FC<CropDoctorSectionProps> = ({
  currentLang,
  farm,
  onBookDrone,
  onOpenAssistant,
}) => {
  const t = translations[currentLang];

  const [selectedCrop, setSelectedCrop] = useState(farm.currentCrop || '');
  const [symptomsText, setSymptomsText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<LeafDiagnosisResult | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous diagnosis & error immediately so stale results never remain on screen
    setDiagnosis(null);
    setErrorMsg(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMsg('Unsupported file format. Please upload a JPG, PNG, or WebP photograph.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg('Image exceeds 8 MB limit. Please upload a smaller photograph.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.onerror = () => {
      setErrorMsg('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageBase64('');
    setDiagnosis(null);
    setErrorMsg(null);
  };

  const handleRunDiagnosis = async () => {
    if (!imageBase64) {
      setErrorMsg('Please upload a clear crop or leaf photograph first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setDiagnosis(null);

    try {
      const res = await safeFetchJson<any>('/api/doctor/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          crop: selectedCrop,
          symptomsText,
          language: currentLang,
        }),
      });

      const data = res.data;
      if (!res.ok || !data?.success || !data?.diagnosis) {
        setErrorMsg(
          data?.error || `Crop Doctor service unavailable (HTTP ${res.status}). Please retry.`
        );
        return;
      }

      setDiagnosis(data.diagnosis);
    } catch {
      setErrorMsg('Network error while connecting to Gemini Vision analysis endpoint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header Panel */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#4D966B] tracking-wide font-mono uppercase">
              Gemini Multimodal Vision Analysis
            </span>
            {diagnosis?.provenance && <DataProvenanceBadge provenance={diagnosis.provenance} />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display">
            {t.doctorTitle}
          </h2>
          <p className="text-sm text-[#5D665E] leading-relaxed">{t.doctorSub}</p>
        </div>

        <div className="mt-4 p-3.5 rounded-2xl bg-white/70 border border-[#174C36]/10 flex items-start gap-2.5 text-xs text-[#5D665E]">
          <Info className="w-4 h-4 text-[#4D966B] shrink-0 mt-0.5" />
          <span>
            Powered by <strong>Gemini AI multimodal vision</strong> (not a custom-trained plant pathology classifier). Always verify severe outbreaks with a local agricultural extension officer.
          </span>
        </div>
      </div>

      {/* Main Diagnosis Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload & Form Column */}
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-6 space-y-5">
          <h3 className="text-base font-bold text-[#202820] font-display">
            Upload Foliage Photograph
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Crop Name (Optional — AI will attempt visual detection)
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                setDiagnosis(null);
                setErrorMsg(null);
              }}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3.5 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            >
              <option value="">Auto-detect from photo</option>
              <option value="Chilli">Red Chilli (మిరప)</option>
              <option value="Paddy">Paddy Rice (వరి)</option>
              <option value="Cotton">Cotton (పత్తి)</option>
              <option value="Tomato">Tomato (టమోటా)</option>
              <option value="Maize">Maize (మొక్కజొన్న)</option>
              <option value="Groundnut">Groundnut (వేరుశనగ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Observed Symptoms (Optional)
            </label>
            <textarea
              rows={3}
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder="Describe curling, spots, insects, or wilting you see in the field..."
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] p-3.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>

          {/* Photo Preview & Upload Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#202820]">
                Leaf / Plant Image (JPG, PNG, WebP · Max 8 MB)
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="text-[11px] font-semibold text-[#5D665E] hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-[#4D966B]/35 rounded-[20px] p-4 text-center bg-white/45 hover:bg-white/75 transition-colors relative">
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Uploaded crop leaf preview"
                    className="max-h-56 w-full mx-auto rounded-[14px] object-contain bg-black/5"
                  />
                  <div className="text-xs text-[#4D966B] font-semibold flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Click here to choose a different photograph</span>
                  </div>
                </div>
              ) : (
                <div className="py-10 space-y-2">
                  <Camera className="w-9 h-9 text-[#174C36] mx-auto" />
                  <div className="text-xs font-semibold text-[#202820]">
                    Click to select or capture a plant photo
                  </div>
                  <div className="text-[11px] text-[#858D86]">
                    Ensure good daylight and clear focus on the affected leaf
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Upload leaf image for Gemini Vision analysis"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-xs text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunDiagnosis}
            disabled={loading || !imageBase64}
            className="w-full py-3 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-4 h-4 text-[#DDEDE2] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Image with Gemini Vision...' : 'Analyze Uploaded Photo'}</span>
          </button>
        </div>

        {/* Diagnostic Report Column */}
        <div className="lg:col-span-7">
          {!diagnosis && !loading && (
            <div className="glass-panel rounded-[24px] p-10 text-center space-y-3">
              <Camera className="w-10 h-10 text-[#4D966B] mx-auto" />
              <div className="text-base font-bold text-[#202820] font-display">
                No Image Analyzed Yet
              </div>
              <p className="text-xs text-[#5D665E] max-w-md mx-auto leading-relaxed">
                Upload a clear photograph of a plant or leaf on the left and click <strong>Analyze Uploaded Photo</strong> to inspect visible symptoms with Gemini Vision AI.
              </p>
            </div>
          )}

          {loading && (
            <div className="glass-panel rounded-[24px] p-8 space-y-4">
              <div className="h-7 w-64 rounded-lg skeleton-glass" />
              <div className="h-24 w-full rounded-2xl skeleton-glass" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-28 rounded-2xl skeleton-glass" />
                <div className="h-28 rounded-2xl skeleton-glass" />
              </div>
            </div>
          )}

          {diagnosis && !loading && (
            <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-6">
              {/* Non-Plant or Unclear Image Alert */}
              {(!diagnosis.isPlantImage || !diagnosis.isClearImage || !diagnosis.identified) && (
                <div className="p-4 rounded-2xl bg-amber-50/85 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">
                      {!diagnosis.isPlantImage
                        ? 'Image Does Not Appear to Show a Plant or Leaf'
                        : !diagnosis.isClearImage
                        ? 'Image Clarity Insufficient for Reliable Visual Assessment'
                        : 'No Specific Pest or Disease Positively Identified'}
                    </div>
                    {diagnosis.clarityFeedback && (
                      <p className="text-amber-900 leading-relaxed">{diagnosis.clarityFeedback}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnosis Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#174C36]/10">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#4D966B] font-semibold">
                    <span>Crop: {diagnosis.detectedCrop || selectedCrop || 'Unspecified'}</span>
                    {diagnosis.confidencePercent !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-[#174C36]">
                          AI Estimate: ~{diagnosis.confidencePercent}%
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-800">Severity: {diagnosis.severity}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#202820] font-display mt-1.5">
                    {currentLang === 'te' && diagnosis.diseaseOrPestTe
                      ? diagnosis.diseaseOrPestTe
                      : diagnosis.diseaseOrPest}
                  </h3>
                </div>

                <div className="px-3.5 py-2.5 bg-[#DDEDE2]/65 rounded-[14px] text-right shrink-0">
                  <div className="text-[11px] text-[#5D665E] font-medium">Analysis Engine</div>
                  <div className="text-xs font-bold text-[#174C36]">
                    {diagnosis.engine || 'Gemini Vision AI'}
                  </div>
                </div>
              </div>

              {/* Visual Symptoms */}
              <div className="p-4 bg-white/60 rounded-[18px] border border-white/80 text-xs space-y-1.5">
                <div className="font-bold text-[#202820]">Visual Observations</div>
                <p className="text-[#5D665E] leading-relaxed">{diagnosis.visualSymptoms}</p>
              </div>

              {/* Next Steps */}
              {diagnosis.recommendedNextSteps && diagnosis.recommendedNextSteps.length > 0 && (
                <div className="p-4 bg-white/60 rounded-[18px] border border-white/80 text-xs space-y-2">
                  <div className="font-bold text-[#202820]">Recommended Next Steps</div>
                  <ul className="space-y-1.5 text-[#5D665E]">
                    {diagnosis.recommendedNextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4D966B] shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Remedies */}
              {(diagnosis.organicRemedy || diagnosis.chemicalRemedy) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {diagnosis.organicRemedy && (
                    <div className="p-4 rounded-[18px] bg-[#DDEDE2]/45 border border-[#4D966B]/20 space-y-1.5">
                      <div className="font-bold text-[#174C36] flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="w-4 h-4 text-[#4D966B]" />
                        <span>Biological / Organic Guidance</span>
                      </div>
                      <p className="text-[#202820] leading-relaxed">{diagnosis.organicRemedy}</p>
                    </div>
                  )}

                  {diagnosis.chemicalRemedy && (
                    <div className="p-4 rounded-[18px] bg-amber-50/75 border border-amber-200/80 space-y-1.5">
                      <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                        <span>Targeted Control Reference</span>
                      </div>
                      <p className="text-amber-950 leading-relaxed">{diagnosis.chemicalRemedy}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preventive Measures */}
              {diagnosis.preventiveMeasures && (
                <div className="p-4 rounded-[18px] bg-white/60 border border-white/80 text-xs space-y-1">
                  <div className="font-bold text-[#202820]">Field Sanitation & Prevention</div>
                  <p className="text-[#5D665E] leading-relaxed">{diagnosis.preventiveMeasures}</p>
                </div>
              )}

              {/* Action Row */}
              <div className="pt-4 border-t border-[#174C36]/10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() =>
                    onOpenAssistant(
                      `Discuss field management for "${diagnosis.diseaseOrPest}" observed in ${
                        diagnosis.detectedCrop || selectedCrop || 'my crop'
                      }`
                    )
                  }
                  className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[#4D966B]" />
                  <span>Ask Rythu Nestham for follow-up questions</span>
                </button>

                <button
                  type="button"
                  onClick={onBookDrone}
                  className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Plane className="w-4 h-4" />
                  <span>Request Drone Service</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
