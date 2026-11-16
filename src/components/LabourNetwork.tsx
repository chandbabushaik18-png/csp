import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { Language, LabourRequest } from '../types';
import { translations } from '../translations';
import { safeFetchJson } from '../utils/safeFetchJson';

interface LabourNetworkProps {
  currentLang: Language;
}

export const LabourNetwork: React.FC<LabourNetworkProps> = ({ currentLang }) => {
  const t = translations[currentLang];

  const [requests, setRequests] = useState<LabourRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [farmerName, setFarmerName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [workType, setWorkType] = useState('Chilli Picking & Bagging');
  const [workersNeeded, setWorkersNeeded] = useState(4);
  const [dailyWage, setDailyWage] = useState(500);
  const [startDate, setStartDate] = useState('');
  const [durationDays, setDurationDays] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson<{ requests?: LabourRequest[] }>('/api/labour-requests');
      if (res.ok && res.data) {
        setRequests(res.data.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await safeFetchJson<any>('/api/labour-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerName,
          phone,
          village,
          district,
          workType,
          workersNeeded,
          dailyWage,
          startDate,
          durationDays,
        }),
      });
      const data = res.data;
      if (res.ok && data?.success) {
        setShowModal(false);
        setFarmerName('');
        setPhone('');
        setVillage('');
        setDistrict('');
        setStartDate('');
        fetchRequests();
      } else {
        setErrorMsg(data?.error || 'Could not publish labour request.');
      }
    } catch {
      setErrorMsg('Network error while publishing labour request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#4D966B] tracking-wide">
              Community Agricultural Workforce
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.labourTitle}
            </h2>
            <p className="text-sm text-[#5D665E] mt-1 max-w-2xl">{t.labourSub}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setShowModal(true);
            }}
            className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Post Labour Requirement</span>
          </button>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-7 pt-6 border-t border-[#174C36]/10">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-44 rounded-[20px] skeleton-glass" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-7 pt-10 pb-8 border-t border-[#174C36]/10 text-center space-y-2">
            <div className="text-sm font-semibold text-[#202820]">No labour requests yet.</div>
            <p className="text-xs text-[#858D86]">
              Post your harvesting, weeding, or transplantation requirements to list them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-7 pt-6 border-t border-[#174C36]/10">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white/60 hover:bg-white/85 border border-white/80 rounded-[20px] p-5 transition-all text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#202820] text-sm">{req.workType}</span>
                    <span className="text-[#174C36] bg-[#DDEDE2] px-2 py-0.5 rounded-lg font-semibold shrink-0">
                      {req.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-[#5D665E]">
                    <div className="flex items-center gap-1.5 text-[#202820] font-medium">
                      <span>{req.farmerName}</span>
                      <span className="text-[#858D86]" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-[#174C36] font-mono tabular-nums">{req.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5D665E]">
                      <MapPin className="w-3.5 h-3.5 text-[#4D966B] shrink-0" />
                      <span>
                        {req.village}, {req.district}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5D665E]">
                      <Calendar className="w-3.5 h-3.5 text-[#858D86] shrink-0" />
                      <span className="font-mono tabular-nums">
                        {req.startDate} ({req.durationDays} Days)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#174C36]/10 flex items-center justify-between">
                  <div>
                    <span className="text-[#858D86] block text-[11px]">Workers Needed</span>
                    <span className="font-bold text-[#202820] font-mono tabular-nums text-sm">
                      {req.workersNeeded} Workers
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#858D86] block text-[11px]">Offered Wage</span>
                    <span className="font-extrabold text-[#174C36] font-mono tabular-nums text-sm">
                      ₹{req.dailyWage} / day
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Posting Labour Request */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated rounded-[26px] max-w-lg w-full p-6 sm:p-8 text-xs">
            <h3 className="text-lg font-bold text-[#202820] font-display">
              Post Farm Labour Request
            </h3>
            <p className="text-xs text-[#5D665E] mt-0.5 mb-6">
              Enter your workforce requirement details.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Farmer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-mono tabular-nums font-medium text-[#202820]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Village</label>
                  <input
                    type="text"
                    required
                    placeholder="Village"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">District</label>
                  <input
                    type="text"
                    required
                    placeholder="District"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Type of Work</label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  >
                    <option value="Chilli Picking & Bagging">
                      Chilli Picking & Sorting (మిరప కోత)
                    </option>
                    <option value="Paddy Transplantation">Paddy Transplantation (వరి నాట్లు)</option>
                    <option value="Cotton 2nd/3rd Picking">Cotton Picking (పత్తి తీత)</option>
                    <option value="Weeding & Intercultivation">
                      Weeding & Intercultivation (కలుపు తీత)
                    </option>
                    <option value="Groundnut Harvesting">
                      Groundnut Harvesting (వేరుశనగ కోత)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-mono text-[#202820]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Workers Needed</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={workersNeeded}
                    onChange={(e) => setWorkersNeeded(Number(e.target.value))}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-mono tabular-nums font-medium text-[#202820]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Daily Wage (₹)</label>
                  <input
                    type="number"
                    min="200"
                    step="50"
                    required
                    value={dailyWage}
                    onChange={(e) => setDailyWage(Number(e.target.value))}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-mono tabular-nums font-medium text-[#202820]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Days</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-mono tabular-nums font-medium text-[#202820]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#174C36]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[#5D665E] hover:text-[#202820] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white font-semibold rounded-[12px] cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
