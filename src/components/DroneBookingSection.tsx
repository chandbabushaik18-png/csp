import React, { useState, useEffect } from 'react';
import { Plane, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { Language, DroneBooking } from '../types';
import { translations } from '../translations';

interface DroneBookingSectionProps {
  currentLang: Language;
  onBookingSuccess?: (booking: DroneBooking) => void;
}

export const DroneBookingSection: React.FC<DroneBookingSectionProps> = ({
  currentLang,
  onBookingSuccess,
}) => {
  const t = translations[currentLang];

  const [farmerName, setFarmerName] = useState('Venkateswara Rao');
  const [phone, setPhone] = useState('9848022134');
  const [serviceType, setServiceType] = useState('Nano Urea & Micronutrient Spraying');
  const [acres, setAcres] = useState(3.5);
  const [date, setDate] = useState('2026-11-10');
  const [timeSlot, setTimeSlot] = useState('07:00 AM - 09:00 AM');
  const [village, setVillage] = useState('Pedavadlapudi');
  const [mandal, setMandal] = useState('Mangalagiri');
  const [district, setDistrict] = useState('Guntur');

  const [loading, setLoading] = useState(false);
  const [successBooking, setSuccessBooking] = useState<DroneBooking | null>(null);
  const [pastBookings, setPastBookings] = useState<DroneBooking[]>([]);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/drone/bookings');
      if (res.ok) {
        const data = await res.json();
        setPastBookings(data.bookings || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const ratePerAcre = serviceType.includes('Survey') ? 350 : 550;
  const estimatedCost = Math.round(acres * ratePerAcre);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/drone/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerName,
          phone,
          serviceType,
          acres,
          date,
          timeSlot,
          village,
          mandal,
          district,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessBooking(data.booking);
        if (onBookingSuccess && data.booking) onBookingSuccess(data.booking);
        fetchBookings();
      }
    } catch (e) {
      console.error('Booking failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Real Drone Imagery Showcase Card */}
      <div className="glass-panel rounded-[26px] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#4D966B] tracking-wider uppercase font-mono">
                Precision Aerial Agriculture
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
                {t.droneTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[#858D86] mt-2 leading-relaxed">
                {t.droneSub}
              </p>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-[#174C36]/10 text-xs">
                <div>
                  <div className="text-[#858D86]">Water Saved</div>
                  <div className="text-lg font-extrabold text-[#174C36] font-display mt-0.5">90% Less</div>
                  <div className="text-[#5D665E] mt-0.5">10 L/Ac ultra-low volume</div>
                </div>
                <div>
                  <div className="text-[#858D86]">Coverage Speed</div>
                  <div className="text-lg font-extrabold text-[#174C36] font-display mt-0.5">8 Mins / Ac</div>
                  <div className="text-[#5D665E] mt-0.5">Uniform mist canopy</div>
                </div>
                <div>
                  <div className="text-[#858D86]">Input Savings</div>
                  <div className="text-lg font-extrabold text-[#174C36] font-display mt-0.5">40% Lower</div>
                  <div className="text-[#5D665E] mt-0.5">Zero drift nozzles</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-[#5D665E]">
              <ShieldCheck className="w-4 h-4 text-[#4D966B]" />
              <span>DGCA Certified Pilots · Rythu Seva Drone Fleet</span>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[260px] bg-[#174C36]">
            <img
              src="/src/assets/images/agri_drone_smart_farm_1794070590384.jpg"
              alt="Agricultural Drone Spraying Crop Canopy"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Booking Form & Dispatch Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel rounded-[24px] p-6 sm:p-8">
          <h3 className="text-lg font-bold text-[#202820] font-display mb-1">
            Schedule Drone Spraying Flight
          </h3>
          <p className="text-xs text-[#858D86] mb-6">
            Dispatch a certified UAV operator directly to your farmland coordinates.
          </p>

          {successBooking && (
            <div className="mb-6 p-4 rounded-2xl bg-[#DDEDE2]/80 border border-[#4D966B]/30 text-xs text-[#174C36] flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#174C36] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Flight Confirmed · Ref {successBooking.id}
                </div>
                <div className="text-[#202820] mt-0.5">
                  Pilot: {successBooking.operatorName} ({successBooking.operatorPhone}) · Total: ₹{successBooking.cost.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleBook} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Farmer Name</label>
                <input
                  type="text"
                  required
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-medium font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-medium"
                >
                  <option value="Nano Urea & Micronutrient Spraying">Nano Urea & Micronutrients (₹550/Ac)</option>
                  <option value="Fungicide & Insecticide Protective Spray">Fungicide & Pest Spray (₹550/Ac)</option>
                  <option value="Multispectral Crop Health Survey">Multispectral NDVI Survey (₹350/Ac)</option>
                  <option value="Weedicide Ground Cover Spray">Selective Weedicide Spray (₹550/Ac)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Total Acres</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={acres}
                  onChange={(e) => setAcres(Number(e.target.value))}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-mono font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Preferred Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Flight Window</label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3.5 py-2.5 text-[#202820] focus:outline-none font-medium"
                >
                  <option value="06:30 AM - 08:30 AM">06:30 AM - 08:30 AM (Ideal Morning)</option>
                  <option value="08:30 AM - 10:30 AM">08:30 AM - 10:30 AM</option>
                  <option value="03:30 PM - 05:30 PM">03:30 PM - 05:30 PM (Evening)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Village</label>
                <input
                  type="text"
                  required
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2 font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">Mandal</label>
                <input
                  type="text"
                  required
                  value={mandal}
                  onChange={(e) => setMandal(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2 font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5D665E] mb-1">District</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-white/85 border border-[#174C36]/15 rounded-xl px-3 py-2 font-medium"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#174C36]/10 flex items-center justify-between">
              <div>
                <div className="text-[#858D86]">Estimated Cost ({acres} Acres)</div>
                <div className="text-2xl font-extrabold text-[#174C36] font-display tabular-nums">
                  ₹{estimatedCost.toLocaleString('en-IN')}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-[#174C36] hover:bg-[#113A29] text-white font-semibold rounded-[12px] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plane className="w-4 h-4" />
                <span>{loading ? 'Confirming...' : 'Confirm Booking'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Scheduled Flights Queue */}
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-6">
          <h3 className="text-base font-bold text-[#202820] font-display">
            Scheduled Drone Flights
          </h3>
          <p className="text-xs text-[#858D86] mt-0.5">
            Live dispatch queue across regional Agri Drone Hubs.
          </p>

          <div className="mt-4 space-y-3">
            {pastBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-[18px] bg-white/80 border border-white text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#202820]">{b.id}</span>
                  <span className="text-[#174C36] font-semibold bg-[#DDEDE2] px-2.5 py-0.5 rounded-lg text-[11px]">
                    {b.status}
                  </span>
                </div>
                <div className="font-semibold text-[#202820]">{b.serviceType}</div>
                <div className="text-[#5D665E] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#4D966B]" />
                  <span>{b.village}, {b.district} · {b.acres} Ac</span>
                </div>
                <div className="pt-2 border-t border-[#174C36]/10 flex items-center justify-between text-[#858D86]">
                  <span>Pilot: {b.operatorName}</span>
                  <span className="font-bold text-[#174C36] font-mono tabular-nums">₹{b.cost.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
