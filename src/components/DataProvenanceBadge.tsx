import React, { useState } from 'react';
import { Radio, AlertTriangle, Info, X, Calculator } from 'lucide-react';
import { DataIntegrityState, DataProvenance } from '../types';

interface DataProvenanceBadgeProps {
  provenance?: DataProvenance;
  integrityState?: DataIntegrityState;
  size?: 'xs' | 'sm' | 'md';
  showModalOnClick?: boolean;
  className?: string;
}

export function resolveIntegrityState(
  provenance?: DataProvenance,
  explicit?: DataIntegrityState
): DataIntegrityState {
  if (explicit) return explicit;
  if (provenance?.integrityState) return provenance.integrityState;
  const cls = provenance?.classification;
  if (cls === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (cls === 'NO_DATA') return 'NO_DATA';
  return 'LIVE_DATA';
}

export const DataProvenanceBadge: React.FC<DataProvenanceBadgeProps> = ({
  provenance,
  integrityState,
  size = 'xs',
  showModalOnClick = true,
  className = '',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!provenance && !integrityState) return null;

  const state = resolveIntegrityState(provenance, integrityState);

  const getBadgeStyle = () => {
    switch (state) {
      case 'LIVE_DATA':
        return {
          bg: 'bg-[#DDEDE2]/85 text-[#174C36] border-[#4D966B]/30',
          dot: 'bg-[#4D966B]',
          icon: provenance?.classification === 'CALCULATED_DATA' ? Calculator : Radio,
          label: 'LIVE DATA',
        };
      case 'UNAVAILABLE':
        return {
          bg: 'bg-amber-50/90 text-amber-900 border-amber-300/70',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'UNAVAILABLE',
        };
      case 'NO_DATA':
      default:
        return {
          bg: 'bg-white/80 text-[#5D665E] border-[#858D86]/30',
          dot: 'bg-[#858D86]',
          icon: Info,
          label: 'NO DATA',
        };
    }
  };

  const style = getBadgeStyle();
  const Icon = style.icon;

  const sizeClasses = {
    xs: 'text-[10px] px-2.5 py-0.5 gap-1.5',
    sm: 'text-[11px] px-3 py-1 gap-1.5',
    md: 'text-xs px-3.5 py-1.5 gap-2',
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={() => showModalOnClick && setModalOpen(true)}
        className={`inline-flex items-center font-semibold rounded-xl border backdrop-blur-md tracking-tight transition-all ${style.bg} ${sizeClasses} ${
          showModalOnClick ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
        } ${className}`}
        title={`Data Status: ${style.label} — Click to inspect source & timestamps`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="font-mono uppercase">{style.label}</span>
        {provenance?.source && (
          <span className="opacity-75 font-normal truncate max-w-[170px] hidden sm:inline">
            · {provenance.source}
          </span>
        )}
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#202820]/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated rounded-[24px] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#174C36]/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <h3 className="text-sm font-bold text-[#202820] font-display">
                  Data Source & Integrity Audit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#858D86] hover:text-[#202820] p-1.5 rounded-xl hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                  Integrity State
                </div>
                <div className={`mt-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold inline-block ${style.bg}`}>
                  {style.label}
                </div>
              </div>

              {provenance?.source && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Data Source
                  </div>
                  <div className="text-[#202820] font-semibold mt-0.5">{provenance.source}</div>
                </div>
              )}

              {provenance?.locationLabel && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Selected Location
                  </div>
                  <div className="text-[#202820] font-medium mt-0.5">{provenance.locationLabel}</div>
                </div>
              )}

              {provenance?.observationDate && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Observation / Acquisition Date
                  </div>
                  <div className="text-[#202820] font-mono mt-0.5">{provenance.observationDate}</div>
                </div>
              )}

              {provenance?.timestamp && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Last Retrieval Attempt
                  </div>
                  <div className="text-[#202820] mt-0.5 font-mono">
                    {new Date(provenance.timestamp).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                    {provenance.isModelEstimate && (
                      <span className="ml-2 text-[#4D966B] font-bold font-sans">
                        (Model-Based Estimate)
                      </span>
                    )}
                    {!provenance.isRealTime && provenance.observationDate && (
                      <span className="ml-2 text-[#5D665E] font-semibold font-sans">
                        (Periodic Overpass)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {provenance?.methodology && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Methodology
                  </div>
                  <div className="mt-1.5 p-3 bg-white/75 rounded-xl border border-[#174C36]/10 font-mono text-[#202820] text-[11px] leading-relaxed">
                    {provenance.methodology}
                  </div>
                </div>
              )}

              {provenance?.notes && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Scope & Limitations
                  </div>
                  <p className="text-[#5D665E] mt-1 leading-relaxed">{provenance.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#174C36]/10 flex justify-end bg-white/40">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#174C36] text-white rounded-xl hover:bg-[#113A29] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
