import React, { useState } from 'react';
import { ShieldCheck, Info, AlertTriangle, Calculator, Radio, Cpu, X } from 'lucide-react';
import { DataProvenance, DataClassification } from '../types';

interface DataProvenanceBadgeProps {
  provenance?: DataProvenance;
  size?: 'xs' | 'sm' | 'md';
  showModalOnClick?: boolean;
  className?: string;
}

export const DataProvenanceBadge: React.FC<DataProvenanceBadgeProps> = ({
  provenance,
  size = 'xs',
  showModalOnClick = true,
  className = '',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!provenance) return null;

  const getBadgeStyle = (classification: DataClassification) => {
    switch (classification) {
      case 'REAL_API_DATA':
        return {
          bg: 'bg-[#DDEDE2]/80 text-[#174C36] border-[#4D966B]/25',
          dot: 'bg-[#4D966B]',
          icon: Radio,
          label: 'REAL API DATA',
        };
      case 'REAL_GPS_DATA':
        return {
          bg: 'bg-teal-50/85 text-teal-900 border-teal-300/60',
          dot: 'bg-teal-600',
          icon: ShieldCheck,
          label: 'REAL GPS DATA',
        };
      case 'REAL_HARDWARE_SENSOR_DATA':
        return {
          bg: 'bg-indigo-50/85 text-indigo-900 border-indigo-300/60',
          dot: 'bg-indigo-600',
          icon: Cpu,
          label: 'REAL HARDWARE SENSOR',
        };
      case 'CALCULATED_DATA':
        return {
          bg: 'bg-sky-50/85 text-sky-900 border-sky-300/60',
          dot: 'bg-sky-600',
          icon: Calculator,
          label: 'CALCULATED DATA',
        };
      case 'ESTIMATED_DATA':
        return {
          bg: 'bg-amber-50/85 text-amber-900 border-amber-300/60',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'ESTIMATED DATA',
        };
      case 'DEMO_DATA':
      default:
        return {
          bg: 'bg-white/75 text-[#5D665E] border-[#858D86]/25',
          dot: 'bg-[#858D86]',
          icon: Info,
          label: 'DEMO / OFFLINE',
        };
    }
  };

  const style = getBadgeStyle(provenance.classification);
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
        title={`Data Provenance: ${style.label} — Click to inspect audit trail`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="font-mono uppercase">{style.label}</span>
        {provenance.source && (
          <span className="opacity-75 font-normal truncate max-w-[150px] hidden sm:inline">
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
                  Data Integrity & Provenance Audit
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
                  Data Classification
                </div>
                <div className={`mt-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold inline-block ${style.bg}`}>
                  {provenance.classification}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                  Authoritative Source
                </div>
                <div className="text-[#202820] font-semibold mt-0.5">{provenance.source}</div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                  Timestamp & Freshness
                </div>
                <div className="text-[#202820] mt-0.5 font-mono">
                  {new Date(provenance.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                  {provenance.isRealTime && (
                    <span className="ml-2 text-[#174C36] font-bold font-sans">
                      (Live Measurement)
                    </span>
                  )}
                </div>
              </div>

              {provenance.methodology && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Scientific Equation / Algorithm
                  </div>
                  <div className="mt-1.5 p-3 bg-white/75 rounded-xl border border-[#174C36]/10 font-mono text-[#202820] text-[11px] leading-relaxed">
                    {provenance.methodology}
                  </div>
                </div>
              )}

              {provenance.notes && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858D86]">
                    Quality & Limitations
                  </div>
                  <p className="text-[#5D665E] mt-1 leading-relaxed">{provenance.notes}</p>
                </div>
              )}

              <div className="pt-3 border-t border-[#174C36]/10 flex items-center justify-between text-[11px] text-[#858D86]">
                <span>FarmersNeed Integrity Standard</span>
                <span className="font-semibold text-[#174C36]">Zero Synthetic Fallbacks</span>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#174C36]/10 flex justify-end bg-white/40">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#174C36] text-white rounded-xl hover:bg-[#113A29] transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
