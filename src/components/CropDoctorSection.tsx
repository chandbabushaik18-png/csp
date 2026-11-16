import React, { useState } from 'react';
import {
  Camera,
  AlertCircle,
  Sparkles,
  Plane,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { FarmProfile, Language, LeafDiagnosisResult } from '../types';
import { translations } from '../translations';

interface CropDoctorSectionProps {
  currentLang: Language;
  farm: FarmProfile;
  onBookDrone: () => void;
  onOpenAssistant: (query?: string) => void;
}

export const CropDoctorSection: React.FC<CropDoctorSectionProps> = ({
  currentLang,
  farm,
  onBookDrone,
  onOpenAssistant,
}) => {
  const t = translations[currentLang];

  const [selectedCrop, setSelectedCrop] = useState(farm.currentCrop || 'Chilli');
  const [symptomsText, setSymptomsText] = useState(
    'Upward leaf curling with silvery undersides on young flush'
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    '/src/assets/images/organic_harvest_produce_1794070591544.jpg'
  );
  const [imageBase64, setImageBase64] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<LeafDiagnosisResult | null>({
    diseaseName: 'Black Thrips & Chilli Leaf Curl Complex (నల్ల తామర పురుగు & బొబ్బర తెగులు)',
    diseaseNameTe: 'నల్ల తామర పురుగు మరియు బొబ్బర తెగులు',
    confidencePercent: 94,
    severity: 'Moderate',
    symptoms:
      'Upward cupping of leaf margins, silvery bronzing on leaf undersides, and stunted inter-nodal elongation.',
    organicRemedy:
      'Spray 10,000 ppm Azadirachtin (Neem oil) @ 5ml/liter + Pongamia oil @ 3ml/liter with 1g detergent per 10L early morning.',
    chemicalRemedy:
      'Spray Spinetoram 11.7% SC (Delegate) @ 0.9ml/liter or Fipronil 40% + Imidacloprid 40% WG (Police) @ 1g/2 liters of water.',
    preventiveMeasures:
      'Install 25 blue sticky traps and 15 yellow sticky traps per acre to intercept winged thrips and whiteflies.',
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRunDiagnosis = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/doctor/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64 || imagePreview,
          crop: selectedCrop,
          symptomsText,
          language: currentLang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDiagnosis(data.diagnosis);
      } else {
        setErrorMsg('Unable to complete vision diagnosis. Please verify image or try again.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error while connecting to Vision Pathology service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header Panel */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold text-[#4D966B] tracking-wide">
            Computer Vision Pathology · ANGRAU Protocols
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
            {t.doctorTitle}
          </h2>
          <p className="text-sm text-[#5D665E] mt-2 leading-relaxed">{t.doctorSub}</p>
        </div>
      </div>

      {/* Main Diagnosis Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload & Form Column */}
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-6 space-y-5">
          <h3 className="text-base font-bold text-[#202820] font-display">
            Crop Foliage Image & Field Symptoms
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Affected Crop
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] px-3.5 py-2.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            >
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
              Observed Foliage Symptoms
            </label>
            <textarea
              rows={3}
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder="e.g. Leaf edges curling upward, small black insects under leaves, yellow lesions..."
              className="w-full text-xs font-medium bg-white/75 border border-[#174C36]/15 rounded-[14px] p-3.5 text-[#202820] focus:bg-white focus:outline-[#174C36]"
            />
          </div>

          {/* Photo Preview & Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-[#202820] mb-1.5">
              Upload Leaf / Plant Photo
            </label>
            <div className="border-2 border-dashed border-[#4D966B]/35 rounded-[20px] p-4 text-center bg-white/45 hover:bg-white/75 transition-colors relative">
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Uploaded crop foliage sample"
                    className="max-h-48 w-full mx-auto rounded-[14px] object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-xs text-[#4D966B] font-semibold flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Click anywhere on photo to replace image</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 space-y-2">
                  <Camera className="w-8 h-8 text-[#174C36] mx-auto" />
                  <div className="text-xs font-semibold text-[#202820]">
                    Click to snap photo or select file
                  </div>
                  <div className="text-[11px] text-[#858D86]">
                    Supports JPG, PNG, WebP from mobile camera
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Upload leaf image for diagnosis"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50/80 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleRunDiagnosis}
            disabled={loading}
            className="w-full py-3 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-[#DDEDE2] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Plant Pathology...' : 'Run AI Pathology Diagnosis'}</span>
          </button>
        </div>

        {/* Diagnostic Report Column */}
        <div className="lg:col-span-7">
          {diagnosis && (
            <div className="glass-panel rounded-[24px] p-6 sm:p-8 space-y-6">
              {/* Diagnosis Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#174C36]/10">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#4D966B] font-semibold">
                    <span>Identified Disease / Pest</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#174C36]">
                      {diagnosis.confidencePercent}% Confidence
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-800">Severity: {diagnosis.severity}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#202820] font-display mt-1.5">
                    {diagnosis.diseaseName}
                  </h3>
                </div>

                <div className="px-3.5 py-2.5 bg-[#DDEDE2]/65 rounded-[14px] text-right shrink-0">
                  <div className="text-[11px] text-[#5D665E] font-medium">Diagnostic Engine</div>
                  <div className="text-xs font-bold text-[#174C36]">ANGRAU & Gemini Vision</div>
                </div>
              </div>

              {/* Symptoms Description */}
              <div className="p-4 bg-white/60 rounded-[18px] border border-white/80 text-xs space-y-1.5">
                <div className="font-bold text-[#202820]">Observed Pathological Symptoms</div>
                <p className="text-[#5D665E] leading-relaxed">{diagnosis.symptoms}</p>
              </div>

              {/* Remedies Dual Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-[18px] bg-[#DDEDE2]/45 border border-[#4D966B]/20 space-y-1.5">
                  <div className="font-bold text-[#174C36] flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-4 h-4 text-[#4D966B]" />
                    <span>Biological / Organic Remedy</span>
                  </div>
                  <p className="text-[#202820] leading-relaxed">{diagnosis.organicRemedy}</p>
                </div>

                <div className="p-4 rounded-[18px] bg-amber-50/75 border border-amber-200/80 space-y-1.5">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                    <span>Chemical Intervention Dosage</span>
                  </div>
                  <p className="text-amber-950 leading-relaxed">{diagnosis.chemicalRemedy}</p>
                </div>
              </div>

              {/* Preventive Measures */}
              <div className="p-4 rounded-[18px] bg-white/60 border border-white/80 text-xs space-y-1">
                <div className="font-bold text-[#202820]">Field Sanitation & Prevention</div>
                <p className="text-[#5D665E] leading-relaxed">{diagnosis.preventiveMeasures}</p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#174C36]/10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() =>
                    onOpenAssistant(
                      `Give me step by step spray mixing instructions for ${diagnosis.diseaseName}`
                    )
                  }
                  className="text-xs font-semibold text-[#174C36] hover:text-[#4D966B] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[#4D966B]" />
                  <span>Ask Rythu Nestham for mixing guide</span>
                </button>

                <button
                  type="button"
                  onClick={onBookDrone}
                  className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Plane className="w-4 h-4" />
                  <span>Book Drone for this Spray</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
