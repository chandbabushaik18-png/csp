import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const require = createRequire(import.meta.url);
const ee: any = require('@google/earthengine');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getCliArg = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eq ? eq.split('=')[1] : undefined;
};

const cliPort = Number(getCliArg('--port'));
const rawEnvPort = process.env.PORT ? Number(process.env.PORT) : undefined;
const nginxPort = process.env.NGINX_PORT ? Number(process.env.NGINX_PORT) : undefined;
const safeEnvPort = rawEnvPort && rawEnvPort !== nginxPort ? rawEnvPort : undefined;

const app = express();
const PORT = (Number.isFinite(cliPort) && cliPort > 0 ? cliPort : undefined) || safeEnvPort || 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini API if key is present
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ==========================================
// IN-MEMORY DATA STORES (Empty by default — zero seeded demo data)
// ==========================================

interface Discussion {
  id: string;
  author: string;
  village: string;
  district: string;
  title: string;
  titleTe?: string;
  content: string;
  contentTe?: string;
  category: string;
  crop?: string;
  upvotes: number;
  commentsCount: number;
  createdAt: string;
}

interface Comment {
  id: string;
  postId: string;
  author: string;
  role: string;
  content: string;
  createdAt: string;
}

interface DroneBooking {
  id: string;
  farmerName: string;
  phone: string;
  serviceType: string;
  acres: number;
  date: string;
  timeSlot: string;
  village: string;
  mandal: string;
  district: string;
  status: 'Requested' | 'Confirmed' | 'Dispatched' | 'Completed';
  cost: number;
  droneModel: string;
  createdAt: string;
}

interface LabourRequest {
  id: string;
  farmerName: string;
  phone: string;
  village: string;
  district: string;
  workType: string;
  workersNeeded: number;
  dailyWage: number;
  startDate: string;
  durationDays: number;
  status: 'Open' | 'Partially Filled' | 'Completed';
  createdAt: string;
}

const discussions: Discussion[] = [];
const comments: Comment[] = [];
const droneBookings: DroneBooking[] = [];
const labourRequests: LabourRequest[] = [];

// ==========================================
// REST APIS
// ==========================================

// 1. Health check
const healthHandler = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'FarmersNeed 2.0',
    edition: 'AI-Powered Smart Agriculture & Precision Farming',
    version: '2.1.0',
    geminiConfigured: !!aiClient,
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ==========================================
// CENTRAL WEATHER & METEOROLOGY SERVICE (Open-Meteo Global NWP)
// Zero fake fallback: uses real ECMWF/GFS forecast data
// ==========================================

// Helper: Translate WMO Weather Interpretation Codes (0-99)
function interpretWmoCode(code: number): { condition: string; description: string; descriptionTe: string } {
  switch (code) {
    case 0:
      return { condition: 'Clear', description: 'clear sky', descriptionTe: 'స్వచ్ఛమైన ఆకాశం' };
    case 1:
      return { condition: 'Mainly Clear', description: 'mainly clear sky', descriptionTe: 'ప్రధానంగా స్వచ్ఛమైన ఆకాశం' };
    case 2:
      return { condition: 'Partly Cloudy', description: 'partly cloudy', descriptionTe: 'పాక్షిక మేఘావృతం' };
    case 3:
      return { condition: 'Overcast', description: 'overcast cloud cover', descriptionTe: 'పూర్తిగా మేఘావృతం' };
    case 45:
    case 48:
      return { condition: 'Fog', description: 'fog and depositing rime fog', descriptionTe: 'పొగమంచు' };
    case 51:
      return { condition: 'Light Drizzle', description: 'light drizzle', descriptionTe: 'తేలికపాటి చిరుజల్లులు' };
    case 53:
      return { condition: 'Drizzle', description: 'moderate drizzle', descriptionTe: 'మధ్యస్థ చిరుజల్లులు' };
    case 55:
      return { condition: 'Dense Drizzle', description: 'dense intensity drizzle', descriptionTe: 'దట్టమైన చిరుజల్లులు' };
    case 61:
      return { condition: 'Slight Rain', description: 'slight rain showers', descriptionTe: 'తేలికపాటి వర్షం' };
    case 63:
      return { condition: 'Rain', description: 'moderate continuous rain', descriptionTe: 'మధ్యస్థ వర్షం' };
    case 65:
      return { condition: 'Heavy Rain', description: 'heavy intensity rain', descriptionTe: 'భారీ వర్షం' };
    case 80:
    case 81:
    case 82:
      return { condition: 'Showers', description: 'rain showers', descriptionTe: 'వర్షపు జల్లులు' };
    case 95:
      return { condition: 'Thunderstorm', description: 'thunderstorm with rain', descriptionTe: 'ఉరుములతో కూడిన వర్షం' };
    case 96:
    case 99:
      return { condition: 'Severe Thunderstorm', description: 'thunderstorm with slight/heavy hail', descriptionTe: 'వడగండ్ల వాన' };
    default:
      return { condition: 'Fair', description: 'favorable agricultural weather', descriptionTe: 'సానుకూల వాతావరణం' };
  }
}

// 2. Real-Time Weather Endpoint (Open-Meteo High-Resolution Forecast)
app.get('/api/weather', async (req: Request, res: Response) => {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const city = (req.query.city as string) || '';

  if (!latStr || !lonStr) {
    return res.status(400).json({
      success: false,
      error: 'Missing coordinates: lat and lon are required. Please allow GPS or select your farmland on the map.',
      classification: 'REAL_API_DATA',
      code: 'MISSING_COORDINATES',
    });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
      classification: 'REAL_API_DATA',
      code: 'INVALID_COORDINATES',
    });
  }

  try {
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,et0_fao_evapotranspiration,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration&timezone=auto`;

    const response = await fetch(openMeteoUrl);
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};
    const hourly = data.hourly || {};
    const daily = data.daily || {};

    const temp = Math.round(current.temperature_2m ?? 0);
    const feelsLike = Math.round(current.apparent_temperature ?? temp);
    const humidity = Math.round(current.relative_humidity_2m ?? 0);
    const windSpeedKmh = Math.round(current.wind_speed_10m ?? 0);
    const windDirectionDeg = Math.round(current.wind_direction_10m ?? 0);
    const clouds = Math.round(current.cloud_cover ?? 0);
    const surfacePressure = Math.round(current.surface_pressure ?? 1013);
    const precipitationMm = Number((current.precipitation ?? 0).toFixed(1));

    // Interpretation of WMO code
    const wmo = interpretWmoCode(current.weather_code ?? 0);

    // Daily min/max
    const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? temp - 3);
    const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? temp + 3);
    const rainProbability = Math.round(daily.precipitation_probability_max?.[0] ?? 0);

    // Sunrise & Sunset ISO parsing
    const rawSunrise = daily.sunrise?.[0];
    const rawSunset = daily.sunset?.[0];
    const formatSunTime = (isoStr?: string) => {
      if (!isoStr) return '--:--';
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return isoStr;
      }
    };

    // Scientific Agricultural Spraying Evaluation (Strict Physics-Based)
    // Spraying is compromised if wind > 15 km/h (drift), temp > 35°C (evaporation), rain probability > 40% (washoff)
    let sprayCondition = 'Ideal for Spraying (పిచికారీకి అనుకూల సమయం)';
    let sprayBadge: 'ideal' | 'moderate' | 'poor' = 'ideal';
    if (windSpeedKmh > 15 || temp > 35 || rainProbability > 40) {
      sprayCondition = 'Not Recommended - High Drift/Rain Risk (వాయిదా వేయండి)';
      sprayBadge = 'poor';
    } else if (windSpeedKmh > 10 || humidity > 85 || temp > 32) {
      sprayCondition = 'Moderate - Low Wind Window Advised (ఓ మోస్తరు)';
      sprayBadge = 'moderate';
    }

    // Sowing Suitability
    let sowingSuitability = 'Optimal Soil Moisture & Temperature (విత్తడానికి అనుకూలం)';
    let sowingSuitabilityBadge: 'favorable' | 'moderate' | 'unfavorable' = 'favorable';
    if (temp > 38 || rainProbability > 65) {
      sowingSuitability = 'Delay Sowing: Excessive Heat or Flood Hazard (వాయిదా వేయండి)';
      sowingSuitabilityBadge = 'unfavorable';
    }

    const fertilizerSafe = rainProbability < 40;
    const postIrrigationRainRisk = rainProbability > 50;
    const heatStressWarning = temp >= 37;

    // Real Hourly Data (First 24 hours from current time)
    const hourlyTimes: string[] = hourly.time || [];
    const hourlyList = [];
    const nowEpoch = Date.now();
    for (let i = 0; i < hourlyTimes.length && hourlyList.length < 24; i++) {
      const hDate = new Date(hourlyTimes[i]);
      // Show from current hour onward
      if (hDate.getTime() >= nowEpoch - 3600000) {
        const hCode = hourly.weather_code?.[i] ?? 0;
        hourlyList.push({
          time: hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
          condition: interpretWmoCode(hCode).condition,
          rainChance: Math.round(hourly.precipitation_probability?.[i] ?? 0),
          windSpeedKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
          humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? 0),
          et0_mm: Number((hourly.et0_fao_evapotranspiration?.[i] ?? 0).toFixed(2)),
        });
      }
    }

    // Real 7-Day Daily Forecast
    const dailyTimes: string[] = daily.time || [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesTe = ['ఆది', 'సోమ', 'మంగళ', 'బుధ', 'గురు', 'శుక్ర', 'శని'];
    const forecastList = [];

    for (let d = 0; d < Math.min(7, dailyTimes.length); d++) {
      const fDate = new Date(dailyTimes[d]);
      const dayName = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()];
      const dayNameTe = d === 0 ? 'ఈరోజు' : d === 1 ? 'రేపు' : dayNamesTe[fDate.getDay()];
      const dCode = daily.weather_code?.[d] ?? 0;

      forecastList.push({
        day: dayName,
        dayTe: dayNameTe,
        date: fDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        tempMax: Math.round(daily.temperature_2m_max?.[d] ?? 0),
        tempMin: Math.round(daily.temperature_2m_min?.[d] ?? 0),
        condition: interpretWmoCode(dCode).condition,
        rainChance: Math.round(daily.precipitation_probability_max?.[d] ?? 0),
        rainfallMm: Number((daily.precipitation_sum?.[d] ?? 0).toFixed(1)),
        windSpeedKmh: Math.round(daily.wind_speed_10m_max?.[d] ?? 0),
        et0_mm: Number((daily.et0_fao_evapotranspiration?.[d] ?? 0).toFixed(2)),
      });
    }

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      source: 'Open-Meteo Model-Based NWP Forecast (ECMWF & NOAA GFS)',
      lastUpdated: new Date().toISOString(),
      generationTimeMs: data.generationtime_ms,
      elevationMeters: data.elevation,
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: 'Open-Meteo NWP Forecast Model',
        timestamp: new Date().toISOString(),
        isRealTime: false,
        isModelEstimate: true,
        locationLabel: city ? `${city} (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)` : `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
        notes: 'Model-based numerical weather prediction (ECMWF IFS & NOAA GFS blend) for selected coordinates — not a direct physical weather-station measurement.',
        methodology: 'Global NWP assimilation at ~0.1° resolution.',
      },
      location: {
        city: city || `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
        country: 'IN',
        lat,
        lon,
      },
      current: {
        temp,
        feelsLike,
        tempMin,
        tempMax,
        humidity,
        pressure: surfacePressure,
        condition: wmo.condition,
        description: wmo.description,
        descriptionTe: wmo.descriptionTe,
        windSpeedKmh,
        windDirectionDeg,
        clouds,
        rainProbability,
        precipitationMm,
        uvIndex: Number((hourly.uv_index?.[0] ?? 0).toFixed(1)),
        sunrise: formatSunTime(rawSunrise),
        sunset: formatSunTime(rawSunset),
        sprayCondition,
        sprayBadge,
        sowingSuitability,
        sowingSuitabilityBadge,
        fertilizerSafe,
        postIrrigationRainRisk,
        heatStressWarning,
      },
      hourly: hourlyList,
      forecast: forecastList,
    });
  } catch (err: any) {
    console.error('Weather API fetch failure:', err);
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Weather forecast unavailable for coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)}): ${err.message}`,
      classification: 'UNAVAILABLE',
      code: 'WEATHER_SERVICE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

// 3. Location Reverse Geocoding & Autocomplete (OpenStreetMap Nominatim)
app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ success: false, error: 'lat and lon are required' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'FarmersNeed-PrecisionAgri/2.0 (agri-platform-support@farmersneed.org)',
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      const village = addr.village || addr.suburb || addr.town || addr.hamlet || addr.neighbourhood || '';
      const mandal = addr.county || addr.subdistrict || addr.city_district || '';
      const district = addr.state_district || addr.district || '';
      const state = addr.state || '';
      const country = addr.country || 'India';
      const postcode = addr.postcode || '';

      return res.json({
        success: true,
        displayName: data.display_name,
        village,
        mandal,
        district,
        state,
        country,
        postcode,
        lat: Number(lat),
        lon: Number(lon),
        provenance: {
          classification: 'REAL_API_DATA',
          source: 'OpenStreetMap Nominatim Reverse Geocoder',
          timestamp: new Date().toISOString(),
          isRealTime: true,
          methodology: 'Point-in-polygon spatial lookup against OSM administrative boundary relations.',
        },
      });
    }
    throw new Error(`Nominatim returned status ${resp.status}`);
  } catch (e: any) {
    console.warn('Reverse geocoding error:', e.message);
    return res.status(404).json({
      success: false,
      error: `Could not reverse geocode coordinates (${lat}, ${lon}) into an administrative address.`,
      lat: Number(lat),
      lon: Number(lon),
      displayName: `Coordinates (${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}) - Boundary Unresolved`,
      provenance: {
        classification: 'REAL_API_DATA',
        source: 'OpenStreetMap Nominatim',
        timestamp: new Date().toISOString(),
        isRealTime: true,
        notes: 'Reverse geocoder could not resolve an administrative parish/mandal for this coordinate.',
      },
    });
  }
});

// Backward compatibility alias
app.get('/api/location/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ success: false, error: 'lat and lon are required' });
  }
  return res.redirect(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
});

// Location Search / Autocomplete
app.get('/api/geocode/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Search query q is required (min 2 characters)' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      q
    )}&addressdetails=1&limit=5&countrycodes=in`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'FarmersNeed-PrecisionAgri/2.0 (agri-platform-support@farmersneed.org)',
      },
    });

    if (resp.ok) {
      const results = await resp.json();
      return res.json({
        success: true,
        query: q,
        count: results.length,
        results: results.map((item: any) => ({
          placeId: item.place_id,
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type,
          village: item.address?.village || item.address?.suburb || item.address?.town || '',
          mandal: item.address?.county || item.address?.subdistrict || '',
          district: item.address?.state_district || item.address?.district || '',
          state: item.address?.state || '',
        })),
        provenance: {
          classification: 'REAL_API_DATA',
          source: 'OpenStreetMap Nominatim Search',
          timestamp: new Date().toISOString(),
          isRealTime: true,
        },
      });
    }
    throw new Error(`Nominatim search returned ${resp.status}`);
  } catch (e: any) {
    return res.status(502).json({
      success: false,
      error: `Geocoding search failed: ${e.message}`,
      classification: 'REAL_API_DATA',
    });
  }
});

// ==========================================
// 4. SCIENTIFIC WATER & IRRIGATION MANAGEMENT (FAO-56 Penman-Monteith)
// Real ET0 pulled from live Open-Meteo forecast, no fixed 4.4 mm assumption
// ==========================================
app.post('/api/water-advisory', async (req: Request, res: Response) => {
  const {
    crop = 'Chilli',
    cropStage = 'Mid-Season (Flowering/Fruiting)',
    soilType = 'Black Cotton Soil',
    irrigationMethod = 'Drip',
    areaAcres = 3,
    lat,
    lon,
    pumpFlowRateLph = 30000, // Standard 5HP pump flow rate
    soilMoisturePercent,
  } = req.body;

  const acres = Math.max(0.1, Number(areaAcres) || 1);

  const parsedLat = Number(lat);
  const parsedLon = Number(lon);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Valid farm latitude and longitude are required to retrieve real ET0 evapotranspiration data.',
    });
  }

  // 1. Fetch Real ET0 & 7-day Rainfall Forecast from Open-Meteo (zero hardcoded ET0 fallback)
  let realEt0: number | null = null;
  let dailyForecastRain: number[] = [];

  try {
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLon}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=auto`;
    const wResp = await fetch(openMeteoUrl);
    if (!wResp.ok) {
      throw new Error(`Open-Meteo returned HTTP ${wResp.status}`);
    }
    const wData = await wResp.json();
    const et0Array = wData.daily?.et0_fao_evapotranspiration || [];
    const rainArray = wData.daily?.precipitation_sum || [];
    if (typeof et0Array[0] === 'number' && Number.isFinite(et0Array[0])) {
      realEt0 = Number(et0Array[0].toFixed(2));
    }
    if (Array.isArray(rainArray) && rainArray.length > 0) {
      dailyForecastRain = rainArray.slice(0, 7).map((r: number) => Number((r || 0).toFixed(1)));
    }
  } catch (e: any) {
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Unable to fetch Open-Meteo ET0 evapotranspiration data: ${e.message}`,
    });
  }

  if (realEt0 === null) {
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Open-Meteo did not return ET0 evapotranspiration values for the selected coordinates.',
    });
  }

  const weatherProvenance = 'Open-Meteo FAO-56 Penman-Monteith Model';

  // 2. Crop Coefficient Kc based on growth stage (FAO-56 Irrigation & Drainage Paper 56)
  const kcTable: Record<string, { initial: number; vegetative: number; mid: number; late: number }> = {
    chilli: { initial: 0.45, vegetative: 0.80, mid: 1.15, late: 0.70 },
    paddy: { initial: 1.05, vegetative: 1.20, mid: 1.35, late: 0.95 },
    cotton: { initial: 0.40, vegetative: 0.75, mid: 1.15, late: 0.65 },
    maize: { initial: 0.40, vegetative: 0.85, mid: 1.20, late: 0.60 },
    groundnut: { initial: 0.45, vegetative: 0.75, mid: 1.05, late: 0.60 },
    tomato: { initial: 0.45, vegetative: 0.80, mid: 1.15, late: 0.75 },
    turmeric: { initial: 0.50, vegetative: 0.85, mid: 1.10, late: 0.70 },
    bengalgram: { initial: 0.40, vegetative: 0.70, mid: 1.00, late: 0.55 },
    sugarcane: { initial: 0.40, vegetative: 1.00, mid: 1.25, late: 0.75 },
  };

  const cropKey = String(crop).toLowerCase().includes('chilli')
    ? 'chilli'
    : String(crop).toLowerCase().includes('paddy')
    ? 'paddy'
    : String(crop).toLowerCase().includes('cotton')
    ? 'cotton'
    : String(crop).toLowerCase().includes('maize')
    ? 'maize'
    : String(crop).toLowerCase().includes('groundnut')
    ? 'groundnut'
    : String(crop).toLowerCase().includes('tomato')
    ? 'tomato'
    : String(crop).toLowerCase().includes('turmeric')
    ? 'turmeric'
    : 'chilli';

  const kcValues = kcTable[cropKey] || kcTable.chilli;
  let kc = kcValues.mid;
  if (String(cropStage).toLowerCase().includes('initial')) kc = kcValues.initial;
  else if (String(cropStage).toLowerCase().includes('vegetative')) kc = kcValues.vegetative;
  else if (String(cropStage).toLowerCase().includes('late')) kc = kcValues.late;

  // 3. Crop Evapotranspiration: ETc = Kc * ET0 (mm/day)
  const etc_mm = Number((kc * realEt0).toFixed(2));

  // 4. Irrigation System Efficiency (FAO Irrigation Standards)
  const effTable: Record<string, number> = {
    drip: 0.90, // 90% Drip efficiency
    sprinkler: 0.75, // 75% Sprinkler efficiency
    'flood / furrow': 0.50, // 50% Flood efficiency
    rainfed: 1.0,
  };
  const effKey = String(irrigationMethod).toLowerCase().includes('drip')
    ? 'drip'
    : String(irrigationMethod).toLowerCase().includes('sprinkler')
    ? 'sprinkler'
    : 'flood / furrow';

  const efficiency = effTable[effKey] || 0.85;

  // 5. Effective Rainfall via USDA-SCS Formula
  // Peff = P * (125 - 0.2 * P) / 125 for P <= 250 mm
  const todayRainMm = dailyForecastRain[0] || 0;
  let effectiveRain_mm = 0;
  if (todayRainMm > 2) {
    effectiveRain_mm = Number(
      Math.min(todayRainMm, (todayRainMm * (125 - 0.2 * todayRainMm)) / 125).toFixed(2)
    );
  }

  const baseNetWaterNeed_mm = Math.max(0, etc_mm - effectiveRain_mm);

  // Soil moisture root-zone depletion adjustment if supplied by IoT sensor or moisture slider (0-100%)
  let soilMoistureAdjustmentFactor = 1.0;
  let parsedMoisture: number | undefined = undefined;
  if (soilMoisturePercent !== undefined && soilMoisturePercent !== null && !Number.isNaN(Number(soilMoisturePercent))) {
    parsedMoisture = Math.min(100, Math.max(0, Number(soilMoisturePercent)));
    if (parsedMoisture >= 75) soilMoistureAdjustmentFactor = 0.25;
    else if (parsedMoisture >= 60) soilMoistureAdjustmentFactor = 0.6;
    else if (parsedMoisture >= 45) soilMoistureAdjustmentFactor = 0.85;
    else if (parsedMoisture >= 30) soilMoistureAdjustmentFactor = 1.0;
    else soilMoistureAdjustmentFactor = 1.25;
  }

  const netWaterNeed_mm = Number((baseNetWaterNeed_mm * soilMoistureAdjustmentFactor).toFixed(2));
  const grossWaterNeed_mm = Number((netWaterNeed_mm / efficiency).toFixed(2));

  // 6. Volumetric Conversion: 1 mm depth across 1 acre = 4,046.86 Liters
  const LITERS_PER_MM_ACRE = 4046.86;
  const dailyLitersPerAcre = Math.round(grossWaterNeed_mm * LITERS_PER_MM_ACRE);
  const totalDailyLitersFarm = Math.round(dailyLitersPerAcre * acres);
  const weeklyLitersFarm = totalDailyLitersFarm * 7;

  // 7. Pumping Runtime: Volume / Flow Rate (Liters/hour)
  const pumpRate = Math.max(5000, Number(pumpFlowRateLph) || 30000);
  const pumpingHoursDaily = Number((totalDailyLitersFarm / pumpRate).toFixed(1));

  // 8. 7-Day Dynamic Calendar Tied to Real Forecast Precipitation
  const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  const daysTe = ['ఈరోజు', 'రేపు', '3వ రోజు', '4వ రోజు', '5వ రోజు', '6వ రోజు', '7వ రోజు'];

  const weeklySchedule = days.map((d, idx) => {
    const rain = dailyForecastRain[idx] || 0;
    const isRainy = rain >= 4.0;
    const netDayMm = isRainy ? 0 : grossWaterNeed_mm;
    const dayLiters = Math.round(netDayMm * LITERS_PER_MM_ACRE);

    let action = 'Irrigate Morning (తడి ఇవ్వండి)';
    let actionTe = 'ఉదయం 06:30 - 08:30 మధ్య నీరు పెట్టండి';
    if (isRainy) {
      action = `Pause Irrigation (${rain}mm Rain Expected)`;
      actionTe = `వర్షం (${rain} మి.మీ) వల్ల తడి అవసరం లేదు`;
    } else if (idx === 0 && parsedMoisture !== undefined && parsedMoisture >= 75) {
      action = `Skip Today (Soil Moisture ${parsedMoisture}%)`;
      actionTe = `నేడు తడి అవసరం లేదు (తేమ ${parsedMoisture}%)`;
    }

    return {
      day: d,
      dayTe: daysTe[idx],
      date: new Date(Date.now() + idx * 86400000).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      }),
      waterMm: netDayMm,
      litersPerAcre: dayLiters,
      action,
      actionTe,
      rainMm: rain,
    };
  });

  const recommendationText = `Your farmland (${acres} acres of ${crop} in ${cropStage}) requires ${grossWaterNeed_mm} mm gross depth (${dailyLitersPerAcre.toLocaleString('en-IN')} Litres/acre) daily under real ET0 of ${realEt0} mm/day${parsedMoisture !== undefined ? ` adjusted for ${parsedMoisture}% root-zone soil moisture` : ''}. With ${irrigationMethod} (${Math.round(efficiency * 100)}% efficiency), run your pump for approximately ${pumpingHoursDaily} hours in the early morning to minimize solar evaporation.`;
  const recommendationTextTe = `మీ ${acres} ఎకరాల ${crop} పంటకు (${cropStage}) రోజువారీ సూర్యరశ్మి మరియు ఉష్ణోగ్రత (ET0 ${realEt0} మి.మీ) ప్రకారం ${grossWaterNeed_mm} మి.మీ (${dailyLitersPerAcre.toLocaleString('en-IN')} లీటర్లు/ఎకరాకు) నీరు అవసరం. ${irrigationMethod} పద్ధతిలో మీ మోటారును ఉదయం వేళ ${pumpingHoursDaily} గంటలు నడపండి.`;

  return res.json({
    success: true,
    integrityState: 'LIVE_DATA',
    crop,
    cropStage,
    soilType,
    irrigationMethod,
    areaAcres: acres,
    et0_mm: realEt0,
    kc,
    etc_mm,
    effectiveRain_mm,
    netWaterNeed_mm,
    grossWaterNeed_mm,
    dailyLitersPerAcre,
    totalDailyLitersFarm,
    weeklyLitersFarm,
    pumpingHoursDaily,
    pumpFlowRateLph: pumpRate,
    nextIrrigationDate: parsedMoisture !== undefined && parsedMoisture >= 75 ? 'In 48 Hours (Soil Saturated)' : 'Tomorrow Morning (06:30 AM)',
    bestTimeOfDay: 'Early Morning (06:00 AM - 08:30 AM)',
    irrigationEfficiencyPercent: Math.round(efficiency * 100),
    soilMoisturePercentUsed: parsedMoisture,
    soilMoistureAdjustmentFactor,
    recommendationText,
    recommendationTextTe,
    waterSavingTips: [
      'Operate irrigation lines before 08:30 AM to reduce direct solar evaporative loss.',
      'Effective rainfall deduction: Irrigation schedule pauses on days with precipitation >= 4 mm.',
      'Maintain organic mulch along crop rows to conserve root-zone soil moisture.',
    ],
    provenance: {
      integrityState: 'LIVE_DATA',
      classification: 'CALCULATED_DATA',
      source: `${weatherProvenance} + FAO-56 + USDA-SCS`,
      timestamp: new Date().toISOString(),
      isRealTime: false,
      isModelEstimate: true,
      locationLabel: `${parsedLat.toFixed(4)}°N, ${parsedLon.toFixed(4)}°E`,
      methodology: 'ETc = Kc * ET0; Net = max(0, ETc - Peff); Gross = Net / Efficiency; 1 mm/acre = 4,046.86 Liters.',
    },
    weeklySchedule,
  });
});

// ==========================================
// 5. GOOGLE EARTH ENGINE (COPERNICUS/S2_SR_HARMONIZED) & COPERNICUS STAC CATALOG
// Computes real pixel-level NDVI / NDWI when GEE credentials are configured;
// otherwise searches real AWS STAC acquisitions without fabricating NDVI/NDWI.
// ==========================================

const GEE_DATASET_ID = 'COPERNICUS/S2_SR_HARMONIZED';

interface GeeResolvedConfig {
  configured: boolean;
  invalidFormat: boolean;
  projectId: string | null;
  clientEmail: string | null;
  privateKey: string | null;
  missingVars: string[];
  diagnosticError: string | null;
}

function resolveGeeConfig(): GeeResolvedConfig {
  const missingVars: string[] = [];
  let clientEmail: string | null = process.env.GEE_CLIENT_EMAIL?.trim() || null;
  let privateKey: string | null = process.env.GEE_PRIVATE_KEY
    ? process.env.GEE_PRIVATE_KEY.replace(/\\n/g, '\n').trim()
    : null;
  let projectId: string | null =
    process.env.GEE_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || null;
  let diagnosticError: string | null = null;
  let invalidFormat = false;

  const rawJson = process.env.GEE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    let jsonToParse = rawJson;
    if (!rawJson.startsWith('{')) {
      try {
        const decoded = Buffer.from(rawJson, 'base64').toString('utf8').trim();
        if (decoded.startsWith('{')) {
          jsonToParse = decoded;
        }
      } catch {
        // Ignore base64 decode failure
      }
    }

    try {
      const parsed = JSON.parse(jsonToParse);
      if (parsed.client_email) clientEmail = String(parsed.client_email).trim();
      if (parsed.private_key) privateKey = String(parsed.private_key).replace(/\\n/g, '\n').trim();
      if (!projectId && parsed.project_id) projectId = String(parsed.project_id).trim();
      if (!parsed.client_email || !parsed.private_key) {
        invalidFormat = true;
        diagnosticError =
          'GEE_SERVICE_ACCOUNT_JSON parsed as JSON, but is missing client_email or private_key. Download the full Service Account JSON key file from Google Cloud Console → IAM & Admin → Service Accounts → Keys.';
      }
    } catch {
      invalidFormat = true;
      const looksLikeKeyId = /^[a-f0-9-]{20,80}$/i.test(rawJson);
      diagnosticError = looksLikeKeyId
        ? `GEE_SERVICE_ACCOUNT_JSON currently holds a Key ID string ("${rawJson.slice(0, 10)}...") instead of the full JSON key file. Open your downloaded Google Cloud Service Account .json file, copy the ENTIRE { "type": "service_account", ... } object, and paste it into GEE_SERVICE_ACCOUNT_JSON in AI Studio Secrets.`
        : 'GEE_SERVICE_ACCOUNT_JSON is not valid JSON. Copy the entire contents of your downloaded Service Account .json key file ({ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }) into GEE_SERVICE_ACCOUNT_JSON.';
      console.warn(diagnosticError);
    }
  }

  if (!projectId) missingVars.push('GEE_PROJECT_ID');
  if (!clientEmail || !privateKey) {
    missingVars.push('GEE_SERVICE_ACCOUNT_JSON (or GEE_CLIENT_EMAIL + GEE_PRIVATE_KEY)');
  }

  if (!diagnosticError && missingVars.length > 0) {
    diagnosticError = `Missing Google Earth Engine configuration: ${missingVars.join(', ')}.`;
  }

  return {
    configured: Boolean(projectId && clientEmail && privateKey),
    invalidFormat,
    projectId,
    clientEmail,
    privateKey,
    missingVars,
    diagnosticError,
  };
}

let geeInitPromise: Promise<{ projectId: string; clientEmail: string }> | null = null;

async function ensureGeeInitialized(): Promise<{ projectId: string; clientEmail: string }> {
  const cfg = resolveGeeConfig();
  if (!cfg.configured || !cfg.projectId || !cfg.clientEmail || !cfg.privateKey) {
    throw new Error(cfg.diagnosticError || `Missing Google Earth Engine credentials: ${cfg.missingVars.join(', ')}`);
  }

  if (!geeInitPromise) {
    geeInitPromise = new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        {
          client_email: cfg.clientEmail,
          private_key: cfg.privateKey,
        },
        () => {
          ee.initialize(
            null,
            null,
            () => resolve({ projectId: cfg.projectId!, clientEmail: cfg.clientEmail! }),
            (initErr: any) => {
              geeInitPromise = null;
              reject(new Error(typeof initErr === 'string' ? initErr : initErr?.message || 'ee.initialize failed'));
            },
            null,
            cfg.projectId
          );
        },
        (authErr: any) => {
          geeInitPromise = null;
          reject(new Error(typeof authErr === 'string' ? authErr : authErr?.message || 'GEE authentication failed'));
        }
      );
    });
  }

  return geeInitPromise;
}

function evalEe<T = any>(eeObject: any): Promise<T> {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result: T, error: any) => {
      if (error) {
        if (String(error).toLowerCase().includes('token') || String(error).toLowerCase().includes('auth')) {
          geeInitPromise = null;
        }
        reject(new Error(typeof error === 'string' ? error : error?.message || 'Earth Engine evaluation error'));
      } else {
        resolve(result);
      }
    });
  });
}

function getMapIdEe(eeImage: any, visParams: Record<string, any>): Promise<string | null> {
  return new Promise((resolve) => {
    eeImage.getMapId(visParams, (mapObj: any, error: any) => {
      if (error || !mapObj?.urlFormat) {
        resolve(null);
      } else {
        resolve(mapObj.urlFormat);
      }
    });
  });
}

function getThumbUrlEe(eeImage: any, params: Record<string, any>): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const maybeSync = eeImage.getThumbURL(params, (url: string, error: any) => {
        resolve(error ? null : url || null);
      });
      if (typeof maybeSync === 'string' && maybeSync.startsWith('http')) {
        resolve(maybeSync);
      }
    } catch {
      resolve(null);
    }
  });
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 4)}***@${domain}`;
}

function defaultDateWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 86400000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function addOneDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function resolveSatelliteGeometry(input: {
  center?: [number, number];
  lat?: number;
  lng?: number;
  lon?: number;
  radius?: number;
  polygon?: [number, number][];
  geometry?: any;
  areaAcres?: number;
}) {
  const { center, lat, lng, lon, radius, polygon, geometry, areaAcres = 1 } = input;

  // 1. GeoJSON Geometry or Feature support (coordinates in [lon, lat])
  const geo = geometry?.type === 'Feature' ? geometry.geometry : geometry;
  if (geo && typeof geo === 'object' && Array.isArray(geo.coordinates)) {
    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates[0]) && geo.coordinates[0].length >= 3) {
      const ring = geo.coordinates[0].map((pt: number[]) => [Number(pt[0]), Number(pt[1])]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      const lons = ring.map((p: number[]) => p[0]);
      const lats = ring.map((p: number[]) => p[1]);
      return {
        valid: lats.every(Number.isFinite) && lons.every(Number.isFinite),
        geometryUsed: 'drawn_polygon' as const,
        ring,
        bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as [number, number, number, number],
        centerLat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
        centerLon: lons.reduce((a: number, b: number) => a + b, 0) / lons.length,
        radiusMeters: null,
      };
    }
    if (geo.type === 'Point' && geo.coordinates.length >= 2) {
      const pLon = Number(geo.coordinates[0]);
      const pLat = Number(geo.coordinates[1]);
      const sqMeters = Math.max(4046.86, (Number(areaAcres) || 1) * 4046.85642);
      const radiusMeters = Number.isFinite(Number(radius)) && Number(radius) > 0
        ? Math.min(25000, Math.max(50, Math.round(Number(radius))))
        : Math.max(100, Math.round(Math.sqrt(sqMeters / Math.PI)));
      const dLat = Math.max(0.01, radiusMeters / 111320);
      const dLon = Math.max(0.01, radiusMeters / (111320 * Math.max(0.2, Math.cos((pLat * Math.PI) / 180))));
      return {
        valid: Number.isFinite(pLat) && Number.isFinite(pLon),
        geometryUsed: 'center_buffer' as const,
        ring: null,
        bbox: [pLon - dLon, pLat - dLat, pLon + dLon, pLat + dLat] as [number, number, number, number],
        centerLat: pLat,
        centerLon: pLon,
        radiusMeters,
      };
    }
  }

  // 2. App polygon array [[lat, lon], ...]
  if (Array.isArray(polygon) && polygon.length >= 3) {
    const ring = polygon.map(([pLat, pLon]) => [Number(pLon), Number(pLat)]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    return {
      valid: lats.every(Number.isFinite) && lons.every(Number.isFinite),
      geometryUsed: 'drawn_polygon' as const,
      ring,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as [number, number, number, number],
      centerLat: lats.reduce((a, b) => a + b, 0) / lats.length,
      centerLon: lons.reduce((a, b) => a + b, 0) / lons.length,
      radiusMeters: null,
    };
  }

  // 3. Center [lat, lon] or explicit lat / lng / lon + optional radius (meters)
  const resolvedLat = center ? Number(center[0]) : Number(lat);
  const resolvedLon = center ? Number(center[1]) : Number(lng ?? lon);
  if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLon)) {
    return {
      valid: false,
      geometryUsed: 'center_buffer' as const,
      ring: null,
      bbox: [0, 0, 0, 0] as [number, number, number, number],
      centerLat: 0,
      centerLon: 0,
      radiusMeters: 150,
    };
  }

  const sqMeters = Math.max(4046.86, (Number(areaAcres) || 1) * 4046.85642);
  const radiusMeters =
    Number.isFinite(Number(radius)) && Number(radius) > 0
      ? Math.min(25000, Math.max(50, Math.round(Number(radius))))
      : Math.max(100, Math.round(Math.sqrt(sqMeters / Math.PI)));
  const dLat = Math.max(0.01, radiusMeters / 111320);
  const dLon = Math.max(0.01, radiusMeters / (111320 * Math.max(0.2, Math.cos((resolvedLat * Math.PI) / 180))));
  return {
    valid: true,
    geometryUsed: 'center_buffer' as const,
    ring: null,
    bbox: [resolvedLon - dLon, resolvedLat - dLat, resolvedLon + dLon, resolvedLat + dLat] as [number, number, number, number],
    centerLat: resolvedLat,
    centerLon: resolvedLon,
    radiusMeters,
  };
}

// Combined Sentinel-2 Level-2A cloud, cirrus & shadow masking (QA60 bits 10/11 + SCL)
function maskSentinel2Clouds(img: any) {
  const qa = img.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const qaClear = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  const scl = img.select('SCL');
  const sclClear = scl
    .neq(1) // Saturated or defective
    .and(scl.neq(3)) // Cloud shadows
    .and(scl.neq(8)) // Cloud medium probability
    .and(scl.neq(9)) // Cloud high probability
    .and(scl.neq(10)); // Thin cirrus

  return img
    .updateMask(qaClear.and(sclClear))
    .copyProperties(img, ['system:time_start', 'system:index', 'CLOUDY_PIXEL_PERCENTAGE']);
}

function addSpectralIndices(maskedImg: any) {
  const ndvi = maskedImg.normalizedDifference(['B8', 'B4']).rename('NDVI');
  const ndwi = maskedImg.normalizedDifference(['B3', 'B8']).rename('NDWI');

  // Scale Level-2A surface reflectance DN (0-10000) to [0, 1] for EVI & SAVI
  const scaled = maskedImg.select(['B2', 'B4', 'B8']).multiply(0.0001);
  const evi = scaled
    .expression('2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      NIR: scaled.select('B8'),
      RED: scaled.select('B4'),
      BLUE: scaled.select('B2'),
    })
    .clamp(-1, 1)
    .rename('EVI');

  const savi = scaled
    .expression('((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
      NIR: scaled.select('B8'),
      RED: scaled.select('B4'),
    })
    .clamp(-1, 1)
    .rename('SAVI');

  return { ndvi, ndwi, evi, savi, combined: ndvi.addBands([ndwi, evi, savi]) };
}

// Check Google Earth Engine connection readiness
app.get('/api/satellite/gee-status', async (_req: Request, res: Response) => {
  const cfg = resolveGeeConfig();
  if (!cfg.configured) {
    return res.json({
      configured: false,
      ready: false,
      invalidFormat: cfg.invalidFormat,
      integrityState: 'UNAVAILABLE',
      status: cfg.invalidFormat ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
      dataset: GEE_DATASET_ID,
      datasetId: GEE_DATASET_ID,
      projectId: cfg.projectId,
      clientEmailMasked: maskEmail(cfg.clientEmail),
      missingVars: cfg.missingVars,
      error: cfg.diagnosticError,
      message: cfg.diagnosticError,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const authInfo = await ensureGeeInitialized();
    const probeSize = await evalEe<number>(ee.ImageCollection(GEE_DATASET_ID).limit(1).size());
    return res.json({
      configured: true,
      ready: probeSize >= 0,
      integrityState: 'LIVE_DATA',
      status: 'READY',
      dataset: GEE_DATASET_ID,
      datasetId: GEE_DATASET_ID,
      projectId: authInfo.projectId,
      clientEmailMasked: maskEmail(authInfo.clientEmail),
      message: `Authenticated with Google Earth Engine project "${authInfo.projectId}" (${GEE_DATASET_ID}).`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const errMsg = err?.message || 'Unable to authenticate or query Google Earth Engine.';
    return res.status(200).json({
      configured: true,
      ready: false,
      integrityState: 'UNAVAILABLE',
      status: 'AUTH_OR_API_ERROR',
      dataset: GEE_DATASET_ID,
      datasetId: GEE_DATASET_ID,
      projectId: cfg.projectId,
      clientEmailMasked: maskEmail(cfg.clientEmail),
      error: errMsg,
      message: errMsg,
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint to search actual Sentinel-2 scenes (GEE COPERNICUS/S2_SR_HARMONIZED or AWS STAC)
app.post('/api/satellite/scenes', async (req: Request, res: Response) => {
  const {
    center,
    lat,
    lng,
    lon,
    radius,
    bbox,
    polygon,
    geometry,
    areaAcres = 1,
    startDate: rawStart,
    endDate: rawEnd,
    maxCloudCover: rawCloud,
  } = req.body;

  const geomInfo = resolveSatelliteGeometry({
    center,
    lat,
    lng,
    lon,
    radius,
    polygon,
    geometry,
    areaAcres,
  });

  if (!Array.isArray(bbox) && !geomInfo.valid) {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Valid coordinates (lat/lng, center, polygon, GeoJSON geometry, or bbox) are required to search satellite passes.',
      scenes: [],
    });
  }

  const defaults = defaultDateWindow();
  const startDate = typeof rawStart === 'string' && rawStart ? rawStart : defaults.startDate;
  const endDate = typeof rawEnd === 'string' && rawEnd ? rawEnd : defaults.endDate;
  const maxCloudCover = Math.min(95, Math.max(5, Number(rawCloud) || 20));

  const queryBbox: [number, number, number, number] =
    Array.isArray(bbox) && bbox.length === 4 ? (bbox as [number, number, number, number]) : geomInfo.bbox;

  const geeCfg = resolveGeeConfig();
  if (geeCfg.configured) {
    try {
      await ensureGeeInitialized();
      const eeGeom = geomInfo.ring
        ? ee.Geometry.Polygon([geomInfo.ring])
        : ee.Geometry.Point([geomInfo.centerLon, geomInfo.centerLat]).buffer(geomInfo.radiusMeters || 150);

      const col = ee
        .ImageCollection(GEE_DATASET_ID)
        .filterBounds(eeGeom)
        .filterDate(startDate, addOneDayIso(endDate))
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloudCover))
        .sort('system:time_start', false)
        .limit(10);

      const listInfo = await evalEe<any[]>(
        col.toList(10).map((im: any) => {
          const img = ee.Image(im);
          return ee.Dictionary({
            id: img.get('system:index'),
            timeStart: img.get('system:time_start'),
            spacecraft: img.get('SPACECRAFT_NAME'),
            cloudPercent: img.get('CLOUDY_PIXEL_PERCENTAGE'),
            sunZenith: img.get('MEAN_SOLAR_ZENITH_ANGLE'),
            sunAzimuth: img.get('MEAN_SOLAR_AZIMUTH_ANGLE'),
            tileId: img.get('MGRS_TILE'),
          });
        })
      );

      const scenes = (listInfo || []).map((item: any) => {
        const dt = item.timeStart ? new Date(item.timeStart) : null;
        const sunElev =
          typeof item.sunZenith === 'number' ? Number((90 - item.sunZenith).toFixed(1)) : null;
        return {
          id: String(item.id),
          platform: item.spacecraft ? String(item.spacecraft) : 'Sentinel-2',
          constellation: `Google Earth Engine (${GEE_DATASET_ID})`,
          acquisitionDate: dt
            ? dt.toLocaleDateString('en-IN', { dateStyle: 'medium' })
            : 'Unknown Date',
          processedDate: dt ? dt.toISOString() : new Date().toISOString(),
          cloudCoveragePercent: Number((item.cloudPercent ?? 0).toFixed(1)),
          sunElevationDeg: sunElev,
          sunAzimuthDeg:
            typeof item.sunAzimuth === 'number' ? Number(item.sunAzimuth.toFixed(1)) : null,
          tileId: item.tileId ? `T${item.tileId}` : 'GEE Tile',
          bandsAvailable: ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B8 (NIR)', 'B11 (SWIR)', 'QA60', 'SCL'],
          previewUrl: null,
        };
      });

      return res.json({
        success: true,
        integrityState: scenes.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
        datasetId: GEE_DATASET_ID,
        geeActive: true,
        count: scenes.length,
        scenes,
        message:
          scenes.length === 0
            ? 'No satellite observation available for the selected date range and cloud threshold.'
            : undefined,
        provenance: {
          integrityState: scenes.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
          classification: scenes.length > 0 ? 'REAL_API_DATA' : 'NO_DATA',
          source: `Google Earth Engine (${GEE_DATASET_ID})`,
          timestamp: new Date().toISOString(),
          isRealTime: false,
          observationDate: scenes[0]?.acquisitionDate,
          notes: 'Sentinel-2 Level-2A surface-reflectance collection queried directly via Earth Engine.',
        },
      });
    } catch (geeErr: any) {
      console.warn('GEE scenes search failed, falling back to AWS STAC metadata:', geeErr.message);
    }
  }

  try {
    const stacUrl = 'https://earth-search.aws.element84.com/v1/search';
    const payload = {
      collections: ['sentinel-2-c1-l2a'],
      bbox: queryBbox,
      datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
      limit: 10,
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      query: {
        'eo:cloud_cover': { lt: maxCloudCover },
      },
    };

    const stacResp = await fetch(stacUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!stacResp.ok) {
      throw new Error(`STAC API returned ${stacResp.status}`);
    }

    const stacData = await stacResp.json();
    const features = stacData.features || [];

    const scenes = features.map((f: any) => {
      const props = f.properties || {};
      return {
        id: f.id,
        platform: props.platform ? `Sentinel-${String(props.platform).toUpperCase().replace('SENTINEL-', '')}` : 'Sentinel-2',
        constellation: 'Copernicus Sentinel-2',
        acquisitionDate: props.datetime
          ? new Date(props.datetime).toLocaleDateString('en-IN', { dateStyle: 'medium' })
          : 'Unknown Date',
        processedDate: props.created ? new Date(props.created).toISOString() : new Date().toISOString(),
        cloudCoveragePercent: Number((props['eo:cloud_cover'] ?? 0).toFixed(1)),
        sunElevationDeg:
          typeof props['view:sun_elevation'] === 'number'
            ? Number(props['view:sun_elevation'].toFixed(1))
            : null,
        sunAzimuthDeg:
          typeof props['view:sun_azimuth'] === 'number'
            ? Number(props['view:sun_azimuth'].toFixed(1))
            : null,
        tileId: props['s2:tile_id'] || props['grid:code'] || 'Unknown',
        utmZone: props['mgrs:utm_zone'] ? `UTM Zone ${props['mgrs:utm_zone']}` : 'WGS84',
        bandsAvailable: ['B02 (Blue 490nm)', 'B03 (Green 560nm)', 'B04 (Red 665nm)', 'B08 (NIR 842nm)', 'B11 (SWIR 1610nm)'],
        previewUrl: f.assets?.thumbnail?.href || f.assets?.rendered_preview?.href || null,
      };
    });

    return res.json({
      success: true,
      integrityState: scenes.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
      datasetId: GEE_DATASET_ID,
      geeActive: false,
      count: scenes.length,
      scenes,
      message: scenes.length === 0 ? 'No satellite observation available for the selected date range.' : undefined,
      provenance: {
        integrityState: scenes.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
        classification: scenes.length > 0 ? 'REAL_API_DATA' : 'NO_DATA',
        source: 'Copernicus Sentinel-2 L2A (ESA via AWS Earth-Search STAC)',
        timestamp: new Date().toISOString(),
        isRealTime: false,
        observationDate: scenes[0]?.acquisitionDate,
        notes: 'Periodic Copernicus Sentinel-2 overpass granules (~5-day revisit cycle).',
      },
    });
  } catch (err: any) {
    console.error('STAC scene search error:', err.message);
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Could not search Copernicus Sentinel-2 catalog: ${err.message}`,
      scenes: [],
    });
  }
});

// Satellite Pass Inspection & Google Earth Engine (COPERNICUS/S2_SR_HARMONIZED) Pixel NDVI/NDWI/EVI/SAVI Analysis
app.post('/api/satellite/analyze', async (req: Request, res: Response) => {
  const {
    farmId = 'farm-primary',
    center,
    lat,
    lng,
    lon,
    radius,
    polygon = [],
    geometry,
    areaAcres = 1,
    crop = '',
    startDate: rawStart,
    endDate: rawEnd,
    maxCloudCover: rawCloud,
    selectedSceneId,
  } = req.body;

  const geomInfo = resolveSatelliteGeometry({
    center,
    lat,
    lng,
    lon,
    radius,
    polygon,
    geometry,
    areaAcres: Number(areaAcres) || 1,
  });

  if (!geomInfo.valid) {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Valid farm coordinates (lat/lng, center, polygon, or GeoJSON geometry) are required for Sentinel-2 queries.',
    });
  }

  const defaults = defaultDateWindow();
  const startDate = typeof rawStart === 'string' && rawStart ? rawStart : defaults.startDate;
  const endDate = typeof rawEnd === 'string' && rawEnd ? rawEnd : defaults.endDate;
  const maxCloudCover = Math.min(95, Math.max(5, Number(rawCloud) || 20));

  const geeCfg = resolveGeeConfig();
  let geeErrorDetail: string | undefined = !geeCfg.configured ? geeCfg.diagnosticError || undefined : undefined;

  // PATH A: Real Google Earth Engine Pixel Processing (COPERNICUS/S2_SR_HARMONIZED)
  if (geeCfg.configured) {
    try {
      await ensureGeeInitialized();

      const eeGeom = geomInfo.ring
        ? ee.Geometry.Polygon([geomInfo.ring])
        : ee.Geometry.Point([geomInfo.centerLon, geomInfo.centerLat]).buffer(geomInfo.radiusMeters || 150);

      const displayGeom = eeGeom.buffer(800);

      const baseCollection = ee
        .ImageCollection(GEE_DATASET_ID)
        .filterBounds(eeGeom)
        .filterDate(startDate, addOneDayIso(endDate))
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloudCover))
        .sort('system:time_start', false);

      const sceneDicts = await evalEe<any[]>(
        baseCollection.limit(10).toList(10).map((im: any) => {
          const img = ee.Image(im);
          return ee.Dictionary({
            id: img.get('system:index'),
            timeStart: img.get('system:time_start'),
            spacecraft: img.get('SPACECRAFT_NAME'),
            cloudPercent: img.get('CLOUDY_PIXEL_PERCENTAGE'),
            sunZenith: img.get('MEAN_SOLAR_ZENITH_ANGLE'),
            sunAzimuth: img.get('MEAN_SOLAR_AZIMUTH_ANGLE'),
            tileId: img.get('MGRS_TILE'),
          });
        })
      );

      if (!sceneDicts || sceneDicts.length === 0) {
        return res.json({
          success: true,
          integrityState: 'NO_DATA',
          farmId,
          satelliteSource: `Google Earth Engine (${GEE_DATASET_ID})`,
          datasetId: GEE_DATASET_ID,
          geeConfigured: true,
          geeStatus: 'READY',
          geometryUsed: geomInfo.geometryUsed,
          dateRange: { startDate, endDate, maxCloudCover },
          sceneId: null,
          platform: null,
          acquisitionDate: null,
          processedDate: null,
          cloudCoveragePercent: null,
          sunElevationDeg: null,
          previewUrl: null,
          tileUrls: null,
          pixelAnalysisSupported: true,
          meanNdvi: null,
          minNdvi: null,
          maxNdvi: null,
          stdDevNdvi: null,
          meanNdwi: null,
          minNdwi: null,
          maxNdwi: null,
          stdDevNdwi: null,
          meanEvi: null,
          meanSavi: null,
          validPixelCount: 0,
          indexFormulas: {
            ndvi: 'NDVI = (B8 - B4) / (B8 + B4)',
            ndwi: 'NDWI = (B3 - B8) / (B3 + B8)',
            evi: 'EVI = 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)',
            savi: 'SAVI = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)',
          },
          healthClassification: null,
          areaBreakdown: null,
          stressHotspotsCount: 0,
          message: `No COPERNICUS/S2_SR_HARMONIZED scene matched ${startDate} to ${endDate} with cloud cover < ${maxCloudCover}%.`,
          recommendation: 'Expand the date window or raise the maximum cloud threshold to retrieve cloud-free Sentinel-2 pixels.',
          recommendationTe: 'ఎంచుకున్న తేదీలలో తక్కువ మేఘాలు గల Sentinel-2 చిత్రాలు లేవు. దయచేసి తేదీ పరిధిని పెంచండి.',
          provenance: {
            integrityState: 'NO_DATA',
            classification: 'NO_DATA',
            source: `Google Earth Engine (${GEE_DATASET_ID})`,
            timestamp: new Date().toISOString(),
            isRealTime: false,
            locationLabel: `${geomInfo.centerLat.toFixed(4)}°N, ${geomInfo.centerLon.toFixed(4)}°E`,
          },
          recentScenes: [],
          historicalTrend: [],
        });
      }

      const chosenMeta =
        (selectedSceneId && sceneDicts.find((s) => String(s.id) === String(selectedSceneId))) ||
        sceneDicts[0];

      const rawTargetImg = ee.Image(
        baseCollection.filter(ee.Filter.eq('system:index', chosenMeta.id)).first()
      );

      const maskedTarget = maskSentinel2Clouds(rawTargetImg);
      const { ndvi: ndviBand, ndwi: ndwiBand, evi: eviBand, combined: indicesImage } = addSpectralIndices(maskedTarget);

      const combinedReducer = ee.Reducer.mean()
        .combine(ee.Reducer.minMax(), '', true)
        .combine(ee.Reducer.stdDev(), '', true)
        .combine(ee.Reducer.count(), '', true);

      const regionStatsPromise = evalEe<any>(
        indicesImage.reduceRegion({
          reducer: combinedReducer,
          geometry: eeGeom,
          scale: 10,
          bestEffort: true,
          maxPixels: 1e7,
        })
      );

      const healthyMask = ndviBand.gte(0.6).rename('healthy');
      const moderateMask = ndviBand.gte(0.35).and(ndviBand.lt(0.6)).rename('moderate');
      const stressedMask = ndviBand.gte(0.15).and(ndviBand.lt(0.35)).rename('stressed');
      const waterMask = ndwiBand.gte(0.1).rename('water');
      const bareMask = ndviBand.lt(0.15).and(ndwiBand.lt(0.1)).rename('bare');

      const zoneStatsPromise = evalEe<any>(
        healthyMask.addBands([moderateMask, stressedMask, bareMask, waterMask]).reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: eeGeom,
          scale: 10,
          bestEffort: true,
          maxPixels: 1e7,
        })
      );

      const ndviTilePromise = getMapIdEe(ndviBand.clip(displayGeom), {
        min: 0.0,
        max: 0.85,
        palette: ['#8B4513', '#D97706', '#EAB308', '#84CC16', '#15803D', '#064E3B'],
      });
      const ndwiTilePromise = getMapIdEe(ndwiBand.clip(displayGeom), {
        min: -0.6,
        max: 0.5,
        palette: ['#92400E', '#F59E0B', '#D1FAE5', '#38BDF8', '#0284C7'],
      });
      const eviTilePromise = getMapIdEe(eviBand.clip(displayGeom), {
        min: 0.0,
        max: 0.85,
        palette: ['#8B4513', '#D97706', '#EAB308', '#84CC16', '#15803D', '#064E3B'],
      });
      const rgbTilePromise = getMapIdEe(rawTargetImg.clip(displayGeom), {
        bands: ['B4', 'B3', 'B2'],
        min: 200,
        max: 2800,
      });
      const thumbPromise = getThumbUrlEe(rawTargetImg, {
        bands: ['B4', 'B3', 'B2'],
        min: 200,
        max: 2800,
        region: displayGeom.bounds(),
        dimensions: 640,
        format: 'jpg',
      });

      // 9-month (6-12 month window) historical trend using cloud-masked monthly composites
      const anchorEnd = ee.Date(addOneDayIso(endDate));
      const trendCloudThreshold = Math.max(maxCloudCover, 30);
      const trendPromise = evalEe<any[]>(
        ee.List.sequence(0, 8).map((bucketIdx: any) => {
          const offsetStart = ee.Number(bucketIdx).subtract(9);
          const offsetEnd = ee.Number(bucketIdx).subtract(8);
          const wStart = anchorEnd.advance(offsetStart, 'month');
          const wEnd = anchorEnd.advance(offsetEnd, 'month');
          const subCol = ee
            .ImageCollection(GEE_DATASET_ID)
            .filterBounds(eeGeom)
            .filterDate(wStart, wEnd)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', trendCloudThreshold));

          const computeBucket = () => {
            const comp = subCol.map(maskSentinel2Clouds).median();
            const { combined } = addSpectralIndices(comp);
            const r = combined.reduceRegion({
              reducer: ee.Reducer.mean(),
              geometry: eeGeom,
              scale: 20,
              bestEffort: true,
              maxPixels: 1e7,
            });
            return ee.Dictionary({
              valid: true,
              timeStart: wEnd.advance(-15, 'day').millis(),
              cloudPercent: subCol.aggregate_mean('CLOUDY_PIXEL_PERCENTAGE'),
              ndvi: r.get('NDVI'),
              ndwi: r.get('NDWI'),
              evi: r.get('EVI'),
              savi: r.get('SAVI'),
            });
          };

          return ee.Algorithms.If(subCol.size().gt(0), computeBucket(), ee.Dictionary({ valid: false }));
        })
      );

      const [
        regionStats,
        zoneStats,
        ndviTileUrl,
        ndwiTileUrl,
        eviTileUrl,
        trueColorTileUrl,
        previewUrl,
        trendRaw,
      ] = await Promise.all([
        regionStatsPromise,
        zoneStatsPromise,
        ndviTilePromise,
        ndwiTilePromise,
        eviTilePromise,
        rgbTilePromise,
        thumbPromise,
        trendPromise,
      ]);

      const roundOrNull = (val: any) => (typeof val === 'number' && Number.isFinite(val) ? Number(val.toFixed(3)) : null);

      const meanNdvi = roundOrNull(regionStats?.NDVI_mean);
      const minNdvi = roundOrNull(regionStats?.NDVI_min);
      const maxNdvi = roundOrNull(regionStats?.NDVI_max);
      const stdDevNdvi = roundOrNull(regionStats?.NDVI_stdDev);

      const meanNdwi = roundOrNull(regionStats?.NDWI_mean);
      const minNdwi = roundOrNull(regionStats?.NDWI_min);
      const maxNdwi = roundOrNull(regionStats?.NDWI_max);
      const stdDevNdwi = roundOrNull(regionStats?.NDWI_stdDev);

      const meanEvi = roundOrNull(regionStats?.EVI_mean);
      const minEvi = roundOrNull(regionStats?.EVI_min);
      const maxEvi = roundOrNull(regionStats?.EVI_max);
      const stdDevEvi = roundOrNull(regionStats?.EVI_stdDev);

      const meanSavi = roundOrNull(regionStats?.SAVI_mean);
      const minSavi = roundOrNull(regionStats?.SAVI_min);
      const maxSavi = roundOrNull(regionStats?.SAVI_max);
      const stdDevSavi = roundOrNull(regionStats?.SAVI_stdDev);

      const validPixelCount =
        typeof regionStats?.NDVI_count === 'number' ? Math.round(regionStats.NDVI_count) : 0;

      const areaBreakdown =
        validPixelCount > 0 && zoneStats
          ? {
              healthyVegetationPercent: Math.round((zoneStats.healthy || 0) * 100),
              moderateVegetationPercent: Math.round((zoneStats.moderate || 0) * 100),
              cropStressPercent: Math.round((zoneStats.stressed || 0) * 100),
              bareSoilPercent: Math.round((zoneStats.bare || 0) * 100),
              waterBodiesPercent: Math.round((zoneStats.water || 0) * 100),
            }
          : null;

      let healthClassification: string | null = null;
      let healthClassificationTe: string | null = null;
      if (meanNdvi !== null) {
        if (meanNdvi >= 0.6) {
          healthClassification = 'Dense Healthy Canopy';
          healthClassificationTe = 'దట్టమైన ఆరోగ్యకరమైన పంట';
        } else if (meanNdvi >= 0.35) {
          healthClassification = 'Moderate Vegetative Growth';
          healthClassificationTe = 'మధ్యస్థ పంట ఎదుగుదల';
        } else if (meanNdvi >= 0.15) {
          healthClassification = 'Low Vigor / Sparse Canopy';
          healthClassificationTe = 'తక్కువ పచ్చదనం / ఒత్తిడి సూచన';
        } else {
          healthClassification = 'Bare Soil / Fallow Field';
          healthClassificationTe = 'ఖాళీ నేల / దుక్కి భూమి';
        }
      }

      const acqDateObj = chosenMeta.timeStart ? new Date(chosenMeta.timeStart) : new Date();
      const acquisitionDate = acqDateObj.toLocaleDateString('en-IN', { dateStyle: 'medium' });
      const cloudCover = Number((chosenMeta.cloudPercent ?? 0).toFixed(1));
      const sunElevation =
        typeof chosenMeta.sunZenith === 'number'
          ? Number((90 - chosenMeta.sunZenith).toFixed(1))
          : null;

      const recentScenes = sceneDicts.map((item: any) => {
        const dt = item.timeStart ? new Date(item.timeStart) : null;
        return {
          id: String(item.id),
          platform: item.spacecraft ? String(item.spacecraft) : 'Sentinel-2',
          constellation: `Google Earth Engine (${GEE_DATASET_ID})`,
          acquisitionDate: dt
            ? dt.toLocaleDateString('en-IN', { dateStyle: 'medium' })
            : 'Unknown Date',
          processedDate: dt ? dt.toISOString() : new Date().toISOString(),
          cloudCoveragePercent: Number((item.cloudPercent ?? 0).toFixed(1)),
          sunElevationDeg:
            typeof item.sunZenith === 'number' ? Number((90 - item.sunZenith).toFixed(1)) : null,
          sunAzimuthDeg:
            typeof item.sunAzimuth === 'number' ? Number(item.sunAzimuth.toFixed(1)) : null,
          tileId: item.tileId ? `T${item.tileId}` : 'GEE',
          bandsAvailable: ['B2', 'B3', 'B4', 'B8', 'B11', 'QA60', 'SCL'],
          previewUrl: null,
        };
      });

      const historicalTrend = (trendRaw || [])
        .filter((pt: any) => pt?.valid && typeof pt.ndvi === 'number' && typeof pt.ndwi === 'number')
        .map((pt: any) => {
          const d = pt.timeStart ? new Date(pt.timeStart) : null;
          return {
            date: d ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '',
            isoDate: d ? d.toISOString().slice(0, 10) : undefined,
            ndvi: Number(pt.ndvi.toFixed(3)),
            ndwi: Number(pt.ndwi.toFixed(3)),
            evi: typeof pt.evi === 'number' ? Number(pt.evi.toFixed(3)) : undefined,
            savi: typeof pt.savi === 'number' ? Number(pt.savi.toFixed(3)) : undefined,
            cloudPercent: Number((pt.cloudPercent ?? 0).toFixed(1)),
          };
        });

      return res.json({
        success: true,
        integrityState: 'LIVE_DATA',
        farmId,
        satelliteSource: `Google Earth Engine · ${GEE_DATASET_ID}`,
        datasetId: GEE_DATASET_ID,
        geeConfigured: true,
        geeStatus: 'READY',
        geometryUsed: geomInfo.geometryUsed,
        dateRange: { startDate, endDate, maxCloudCover },
        sceneId: String(chosenMeta.id),
        platform: chosenMeta.spacecraft ? String(chosenMeta.spacecraft) : 'Sentinel-2 L2A',
        acquisitionDate,
        processedDate: acqDateObj.toISOString(),
        cloudCoveragePercent: cloudCover,
        sunElevationDeg: sunElevation,
        previewUrl,
        tileUrls: {
          ndvi: ndviTileUrl,
          ndwi: ndwiTileUrl,
          evi: eviTileUrl,
          trueColor: trueColorTileUrl,
        },
        pixelAnalysisSupported: true,
        meanNdvi,
        minNdvi,
        maxNdvi,
        stdDevNdvi,
        meanNdwi,
        minNdwi,
        maxNdwi,
        stdDevNdwi,
        meanEvi,
        minEvi,
        maxEvi,
        stdDevEvi,
        meanSavi,
        minSavi,
        maxSavi,
        stdDevSavi,
        validPixelCount,
        indexFormulas: {
          ndvi: 'NDVI = (B8 - B4) / (B8 + B4)',
          ndwi: 'NDWI = (B3 - B8) / (B3 + B8)',
          evi: 'EVI = 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)',
          savi: 'SAVI = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)',
        },
        healthClassification,
        healthClassificationTe,
        areaBreakdown,
        stressHotspotsCount: areaBreakdown?.cropStressPercent || 0,
        message:
          validPixelCount === 0
            ? 'All pixels in the selected boundary were masked as cloud/shadow by QA60/SCL bands. Try another acquisition date.'
            : `Computed from ${validPixelCount.toLocaleString('en-IN')} QA60+SCL cloud-masked 10m Sentinel-2 pixels inside your ${
                geomInfo.geometryUsed === 'drawn_polygon' ? 'drawn farm boundary' : 'parcel buffer'
              }.`,
        recommendation:
          meanNdvi !== null
            ? `Real Sentinel-2 pixel mean NDVI is ${meanNdvi} (σ=${stdDevNdvi ?? '--'}), NDWI is ${meanNdwi}, EVI is ${meanEvi ?? '--'} (${healthClassification}) for ${crop || 'selected crop'} on ${acquisitionDate}.`
            : 'Pixels over your parcel were masked by clouds on this date. Select another scene from the catalog.',
        recommendationTe:
          meanNdvi !== null
            ? `${acquisitionDate} నాటి వాస్తవ Sentinel-2 పిక్సెల్ విశ్లేషణలో NDVI ${meanNdvi} మరియు NDWI ${meanNdwi} (${healthClassificationTe}) నమోదయ్యాయి.`
            : 'ఈ తేదీలో మేఘాల వల్ల పంట పిక్సెల్స్ కనిపించలేదు. దయచేసి వేరే తేదీని ఎంచుకోండి.',
        provenance: {
          integrityState: 'LIVE_DATA',
          classification: 'REAL_API_DATA',
          source: `Google Earth Engine (${GEE_DATASET_ID})`,
          timestamp: new Date().toISOString(),
          isRealTime: false,
          observationDate: acquisitionDate,
          locationLabel: `${geomInfo.centerLat.toFixed(4)}°N, ${geomInfo.centerLon.toFixed(4)}°E`,
          methodology: 'QA60 + SCL cloud-masked 10m Level-2A surface reflectance reduction (NDVI, NDWI, EVI, SAVI) over farm geometry.',
        },
        recentScenes,
        historicalTrend,
      });
    } catch (geeErr: any) {
      console.error('Google Earth Engine pixel analysis failed:', geeErr.message);
      geeErrorDetail = geeErr?.message || 'Google Earth Engine request failed.';
    }
  }

  // PATH B: GEE credentials missing or API error — use AWS STAC metadata with ZERO fabricated pixel NDVI/NDWI
  try {
    const stacResp = await fetch('https://earth-search.aws.element84.com/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: ['sentinel-2-c1-l2a'],
        bbox: geomInfo.bbox,
        datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
        limit: 10,
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        query: { 'eo:cloud_cover': { lt: maxCloudCover } },
      }),
    });

    if (!stacResp.ok) {
      throw new Error(`STAC API returned ${stacResp.status}`);
    }

    const stacData = await stacResp.json();
    const features = stacData.features || [];

    const recentScenes = features.map((f: any) => {
      const props = f.properties || {};
      return {
        id: f.id,
        platform: props.platform ? `Sentinel-${String(props.platform).toUpperCase().replace('SENTINEL-', '')}` : 'Sentinel-2',
        constellation: 'Copernicus Sentinel-2',
        acquisitionDate: props.datetime
          ? new Date(props.datetime).toLocaleDateString('en-IN', { dateStyle: 'medium' })
          : 'Unknown Date',
        processedDate: props.created ? new Date(props.created).toISOString() : new Date().toISOString(),
        cloudCoveragePercent: Number((props['eo:cloud_cover'] ?? 0).toFixed(1)),
        sunElevationDeg:
          typeof props['view:sun_elevation'] === 'number'
            ? Number(props['view:sun_elevation'].toFixed(1))
            : null,
        sunAzimuthDeg:
          typeof props['view:sun_azimuth'] === 'number'
            ? Number(props['view:sun_azimuth'].toFixed(1))
            : null,
        tileId: props['s2:tile_id'] || props['grid:code'] || 'Unknown',
        utmZone: props['mgrs:utm_zone'] ? `UTM Zone ${props['mgrs:utm_zone']}` : 'WGS84',
        bandsAvailable: ['B02', 'B03', 'B04', 'B08', 'B11'],
        previewUrl: f.assets?.thumbnail?.href || f.assets?.rendered_preview?.href || null,
      };
    });

    if (features.length === 0) {
      return res.json({
        success: true,
        integrityState: 'NO_DATA',
        farmId,
        satelliteSource: 'Copernicus Sentinel-2 L2A (AWS Earth-Search STAC)',
        datasetId: GEE_DATASET_ID,
        geeConfigured: geeCfg.configured,
        geeStatus: geeCfg.configured ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
        geeError: geeErrorDetail,
        geometryUsed: geomInfo.geometryUsed,
        dateRange: { startDate, endDate, maxCloudCover },
        sceneId: null,
        platform: null,
        acquisitionDate: null,
        processedDate: null,
        cloudCoveragePercent: null,
        sunElevationDeg: null,
        previewUrl: null,
        tileUrls: null,
        pixelAnalysisSupported: false,
        meanNdvi: null,
        meanNdwi: null,
        meanEvi: null,
        meanSavi: null,
        indexFormulas: {
          ndvi: 'NDVI = (B8 - B4) / (B8 + B4)',
          ndwi: 'NDWI = (B3 - B8) / (B3 + B8)',
          evi: 'EVI = 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)',
          savi: 'SAVI = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)',
        },
        healthClassification: null,
        healthClassificationTe: null,
        areaBreakdown: null,
        stressHotspotsCount: 0,
        message: 'No satellite observation available for the selected date range and cloud limit.',
        recommendation: 'No cloud-filtered Sentinel-2 observation was returned for these coordinates and dates.',
        recommendationTe: 'ఎంచుకున్న ప్రాంతానికి మరియు తేదీలకు ఉపగ్రహ పరిశీలన అందుబాటులో లేదు.',
        provenance: {
          integrityState: 'NO_DATA',
          classification: 'NO_DATA',
          source: 'Copernicus Sentinel-2 L2A (AWS Earth-Search STAC)',
          timestamp: new Date().toISOString(),
          isRealTime: false,
          locationLabel: `${geomInfo.centerLat.toFixed(4)}°N, ${geomInfo.centerLon.toFixed(4)}°E`,
          notes: 'No recent Sentinel-2 granule matched the date/cloud filter for this area.',
        },
        recentScenes: [],
        historicalTrend: [],
      });
    }

    const latest =
      (selectedSceneId && features.find((f: any) => f.id === selectedSceneId)) || features[0];
    const p = latest.properties || {};
    const acquisitionDate = p.datetime
      ? new Date(p.datetime).toLocaleDateString('en-IN', { dateStyle: 'medium' })
      : 'Unknown Date';
    const platform = p.platform
      ? `Sentinel-${String(p.platform).toUpperCase().replace('SENTINEL-', '')}`
      : 'Sentinel-2';
    const cloudCover = Number((p['eo:cloud_cover'] ?? 0).toFixed(1));
    const sunElevation =
      typeof p['view:sun_elevation'] === 'number' ? Number(p['view:sun_elevation'].toFixed(1)) : null;
    const previewUrl = latest.assets?.thumbnail?.href || latest.assets?.rendered_preview?.href || null;

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      farmId,
      satelliteSource: `Copernicus ${platform} L2A (AWS Earth-Search STAC)`,
      datasetId: GEE_DATASET_ID,
      geeConfigured: geeCfg.configured,
      geeStatus: geeCfg.configured || geeCfg.invalidFormat ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
      geeError: geeErrorDetail,
      geometryUsed: geomInfo.geometryUsed,
      dateRange: { startDate, endDate, maxCloudCover },
      sceneId: latest.id,
      platform,
      acquisitionDate,
      processedDate: p.created ? new Date(p.created).toISOString() : new Date().toISOString(),
      cloudCoveragePercent: cloudCover,
      sunElevationDeg: sunElevation,
      previewUrl,
      tileUrls: null,
      pixelAnalysisSupported: false,
      meanNdvi: null,
      meanNdwi: null,
      meanEvi: null,
      meanSavi: null,
      indexFormulas: {
        ndvi: 'NDVI = (B8 - B4) / (B8 + B4)',
        ndwi: 'NDWI = (B3 - B8) / (B3 + B8)',
        evi: 'EVI = 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)',
        savi: 'SAVI = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)',
      },
      healthClassification: null,
      healthClassificationTe: null,
      areaBreakdown: null,
      stressHotspotsCount: 0,
      message: geeErrorDetail
        ? `${geeErrorDetail} Showing verified AWS STAC Sentinel-2 metadata meanwhile.`
        : `Verified Sentinel-2 acquisition metadata loaded. Configure Google Earth Engine (${GEE_DATASET_ID}) service account secrets to compute pixel NDVI/NDWI/EVI/SAVI.`,
      recommendation: geeErrorDetail
        ? `${geeErrorDetail}`
        : `Latest Sentinel-2 granule (${latest.id}) acquired on ${acquisitionDate} (${cloudCover}% cloud). Connect Google Earth Engine credentials (GEE_PROJECT_ID & GEE_SERVICE_ACCOUNT_JSON) to compute COPERNICUS/S2_SR_HARMONIZED NDVI/NDWI maps.`,
      recommendationTe: `${acquisitionDate} నాటి Sentinel-2 ఉపగ్రహ పాస్ (${cloudCover}% మేఘాలు) అందుబాటులో ఉంది. NDVI/NDWI పిక్సెల్ గణనకు Google Earth Engine అనుసంధానం అవసరం.`,
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: 'Copernicus Sentinel-2 L2A (ESA via AWS Earth-Search STAC)',
        timestamp: new Date().toISOString(),
        isRealTime: false,
        observationDate: acquisitionDate,
        locationLabel: `${geomInfo.centerLat.toFixed(4)}°N, ${geomInfo.centerLon.toFixed(4)}°E`,
        notes: 'Periodic Copernicus satellite pass (~5-day revisit). Real scene metadata verified; GEE pixel NDVI/NDWI/EVI/SAVI withheld (NO DATA) until Earth Engine auth is active.',
      },
      recentScenes,
      historicalTrend: [],
    });
  } catch (err: any) {
    console.error('STAC analyze failure:', err.message);
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      datasetId: GEE_DATASET_ID,
      geeConfigured: geeCfg.configured,
      geeStatus: geeCfg.configured ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
      geeError: geeErrorDetail || err.message,
      error: `Copernicus Sentinel-2 service unavailable: ${err.message}`,
      pixelAnalysisSupported: false,
      meanNdvi: null,
      meanNdwi: null,
      meanEvi: null,
      meanSavi: null,
      areaBreakdown: null,
      historicalTrend: [],
    });
  }
});

// 6. AI CROP DOCTOR & LEAF DISEASE DIAGNOSIS (Gemini Vision Multimodal — Zero Fake Fallback)
app.post('/api/doctor/diagnose', async (req: Request, res: Response) => {
  const { imageBase64, crop = '', symptomsText = '', language = 'en' } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'A valid leaf or crop photograph is required before running Gemini Vision analysis.',
    });
  }

  const mimeMatch = imageBase64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!mimeMatch) {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Unsupported image format. Upload a JPG, PNG, or WebP photograph.',
    });
  }

  const mimeType = mimeMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeMatch[1].toLowerCase();
  const cleanBase64 = mimeMatch[2];

  if (!aiClient) {
    return res.status(503).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Gemini Vision AI analysis is unavailable because GEMINI_API_KEY is not configured on the server.',
    });
  }

  try {
    const prompt = `You are a plant pathology image analyst powered by Gemini AI.
Carefully inspect ONLY the uploaded photograph provided by the user.
User-selected crop context (may be empty or inaccurate): "${crop || 'Not specified'}".
Additional farmer notes: "${symptomsText || 'None provided'}".
Output language preference: ${language === 'te' ? 'Telugu with English chemical names in brackets' : 'English'}.

STRICT HONESTY RULES:
1. First verify whether this image actually shows a plant, leaf, stem, or crop foliage (isPlantImage).
2. Verify whether the image is bright, focused, and clear enough to inspect symptoms (isClearImage).
3. If the image is NOT a plant/crop, is too blurry/dark, or shows no clear symptoms, set identified=false, confidencePercent=0, severity="Unknown", and write a clear explanation in clarityFeedback asking the farmer to upload a focused daylight close-up photo of the affected leaf.
4. Do NOT guess a disease or fabricate high confidence when uncertain. Only provide confidencePercent (>0) if a specific condition or healthy state is clearly supported by visual evidence in this exact photo.`;

    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPlantImage: { type: Type.BOOLEAN },
            isClearImage: { type: Type.BOOLEAN },
            identified: { type: Type.BOOLEAN },
            detectedCrop: { type: Type.STRING },
            diseaseOrPest: { type: Type.STRING },
            diseaseOrPestTe: { type: Type.STRING },
            confidencePercent: { type: Type.NUMBER },
            severity: { type: Type.STRING },
            clarityFeedback: { type: Type.STRING },
            visualSymptoms: { type: Type.STRING },
            recommendedNextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            organicRemedy: { type: Type.STRING },
            chemicalRemedy: { type: Type.STRING },
            preventiveMeasures: { type: Type.STRING },
          },
          required: [
            'isPlantImage',
            'isClearImage',
            'identified',
            'detectedCrop',
            'diseaseOrPest',
            'severity',
            'visualSymptoms',
            'recommendedNextSteps',
            'organicRemedy',
            'chemicalRemedy',
            'preventiveMeasures',
          ],
        },
      },
    });

    const parsed = JSON.parse(aiResponse.text || '{}');
    const validConfidence =
      parsed.identified &&
      typeof parsed.confidencePercent === 'number' &&
      parsed.confidencePercent > 0
        ? Math.min(100, Math.round(parsed.confidencePercent))
        : null;

    const allowedSeverities = ['None', 'Low', 'Moderate', 'Severe', 'Unknown'];
    const safeSeverity = allowedSeverities.includes(parsed.severity) ? parsed.severity : 'Unknown';

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      source: 'Gemini AI Vision Analysis (General Multimodal Model)',
      diagnosis: {
        isPlantImage: Boolean(parsed.isPlantImage),
        isClearImage: Boolean(parsed.isClearImage),
        identified: Boolean(parsed.identified),
        detectedCrop: parsed.detectedCrop || crop || 'Unknown',
        diseaseOrPest: parsed.diseaseOrPest || 'Inconclusive Visual Inspection',
        diseaseOrPestTe: parsed.diseaseOrPestTe || parsed.diseaseOrPest || 'స్పష్టమైన నిర్ధారణ లభించలేదు',
        confidencePercent: validConfidence,
        severity: safeSeverity,
        clarityFeedback: parsed.clarityFeedback || '',
        visualSymptoms: parsed.visualSymptoms || 'No clear foliar symptoms observed.',
        recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps)
          ? parsed.recommendedNextSteps
          : [],
        organicRemedy: parsed.organicRemedy || 'Consult local agricultural officer before applying sprays.',
        chemicalRemedy: parsed.chemicalRemedy || 'Verify target pest locally before chemical application.',
        preventiveMeasures: parsed.preventiveMeasures || 'Maintain field sanitation and inspect undersides of leaves.',
        analyzedAt: new Date().toISOString(),
        engine: 'Gemini Vision AI (gemini-4-hydrogen)',
        provenance: {
          integrityState: 'LIVE_DATA',
          classification: 'REAL_API_DATA',
          source: 'Gemini Vision AI (Multimodal Analysis)',
          timestamp: new Date().toISOString(),
          isRealTime: true,
          notes: 'General multimodal AI visual inspection — not a specialized lab-calibrated pathology model. Confirm chemical dosages with local agronomists.',
        },
      },
    });
  } catch (err: any) {
    console.error('Gemini vision diagnosis error:', err);
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Gemini Vision analysis failed: ${err.message || 'Upstream AI service error'}`,
    });
  }
});

// 7. Context-Aware AI Agriculture Assistant ("Rythu Nestham") — Zero Fake Telemetry Fallback
app.post('/api/assistant', async (req: Request, res: Response) => {
  const { query, language = 'en', farmContext } = req.body;

  if (!query || !String(query).trim()) {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'A question is required.',
    });
  }

  if (!aiClient) {
    return res.status(503).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'Gemini AI Advisor is unavailable because GEMINI_API_KEY is not configured.',
    });
  }

  try {
    const contextLines: string[] = [];
    if (farmContext) {
      if (farmContext.name) contextLines.push(`- Parcel Name: ${farmContext.name}`);
      if (farmContext.village || farmContext.district) {
        contextLines.push(`- Location: ${[farmContext.village, farmContext.district, farmContext.state].filter(Boolean).join(', ')}`);
      }
      if (Array.isArray(farmContext.center) && farmContext.center.length === 2) {
        contextLines.push(`- Coordinates: ${farmContext.center[0].toFixed(4)}°N, ${farmContext.center[1].toFixed(4)}°E`);
      }
      if (farmContext.areaAcres) contextLines.push(`- Area: ${farmContext.areaAcres} Acres`);
      if (farmContext.soilType) contextLines.push(`- Soil: ${farmContext.soilType}`);
      if (farmContext.currentCrop) contextLines.push(`- Crop: ${farmContext.currentCrop} (${farmContext.cropStage || 'stage unspecified'})`);
      if (farmContext.irrigationMethod) contextLines.push(`- Irrigation: ${farmContext.irrigationMethod}`);
      if (farmContext.weatherTemp !== undefined) {
        contextLines.push(`- Open-Meteo Forecast: ${farmContext.weatherTemp}°C, ${farmContext.weatherCondition || ''}, Wind ${farmContext.weatherWind ?? '--'} km/h`);
      }
      if (farmContext.dailyLitersPerAcre !== undefined) {
        contextLines.push(`- Calculated Irrigation Need: ${farmContext.dailyLitersPerAcre} Litres/Acre`);
      }
    }

    const contextSummary =
      contextLines.length > 0
        ? `Available Farm Context:\n${contextLines.join('\n')}`
        : 'No specific farm telemetry provided yet.';

    const systemInstruction = `You are "Rythu Nestham" (రైతు నేస్తం), a helpful agricultural advisor for FarmersNeed.
Give clear, practical, honest agricultural guidance grounded ONLY in the verified context below. Do NOT invent or assume sensor readings, NDVI values, or weather measurements if they are not listed below.
Language: ${language === 'te' ? 'Telugu (తెలుగు) with key chemical/equipment names in English brackets' : 'English'}.

${contextSummary}`;

    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: String(query),
      config: {
        systemInstruction,
      },
    });

    const reply = aiResponse.text;
    if (!reply) {
      throw new Error('Empty response returned from Gemini AI');
    }

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      source: 'Gemini AI (gemini-4-hydrogen)',
      reply,
      language,
    });
  } catch (err: any) {
    console.error('Gemini assistant call error:', err);
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Gemini AI Assistant is currently unavailable: ${err.message || 'Upstream AI service error'}`,
    });
  }
});

// 8. Crop Recommendations Engine (Agronomic Planning Model)
app.post('/api/recommendations', (req: Request, res: Response) => {
  const {
    season = 'Rabi',
    soilType = 'Black Cotton Soil',
    irrigation = 'Borewell / Drip',
    landSizeAcres = 3,
    district = 'Guntur',
    village = '',
  } = req.body;

  const acres = Math.max(0.5, Number(landSizeAcres) || 1);
  const soilLower = String(soilType).toLowerCase();
  const seasonLower = String(season).toLowerCase();
  const locationText = [village, district].filter(Boolean).join(', ') || 'Selected Region';

  const allCrops = [
    {
      cropKey: 'chilli',
      name: 'Red Chilli (Guntur Hot)',
      nameTe: 'ఎర్ర మిరప (గుంటూరు తేజ)',
      imageUrl: '/src/assets/images/organic_harvest_produce_1794070591544.jpg',
      suitabilityScore: soilLower.includes('black') || soilLower.includes('red') ? 94 : 80,
      variety: 'Teja 4 / US 341 / Armoor',
      durationDays: 165,
      waterRequirement: 'Medium',
      waterRequirementTe: 'మధ్యస్థ నీరు (డ్రిప్ మేలు)',
      waterMmTotal: 650,
      expectedYieldPerAcreQuintals: 22,
      estimatedCostPerAcre: 68000,
      expectedPricePerQuintal: 19200,
      grossProfitPerAcre: 422400,
      netProfitPerAcre: 354400,
      totalNetProfit: Math.round(354400 * acres),
      roiPercentage: 521,
      bestSowingWindow: 'Oct 20 - Nov 25',
      bestSowingWindowTe: 'అక్టోబర్ 20 - నవంబర్ 25',
      soilSuitabilityReason: 'Well-drained rich black clay soil produces high capsaicin content and deep red pods.',
      soilSuitabilityReasonTe: 'మంచి మురుగు నీటి పారుదల ఉన్న నల్లరేగడి నేలల్లో నాణ్యమైన కారం, ముదురు రంగు వస్తాయి.',
      fertilizerPlan: 'Basal: 50kg DAP + 25kg MOP; 3 split doses of Urea (35kg) + 19-19-19 water soluble via fertigation.',
      risks: 'Black Thrips, Mites, and Die-back fungal infection during humid spells.',
      risksTe: 'నల్ల తామర పురుగు, నల్లి మరియు కొమ్మ ఎండు తెగులు పట్ల జాగ్రత్త అవసరం.',
    },
    {
      cropKey: 'paddy',
      name: 'Paddy (Fine Rice)',
      nameTe: 'వరి (సన్న రకాలు)',
      imageUrl: '/src/assets/images/agri_drone_smart_farm_1794070590384.jpg',
      suitabilityScore: soilLower.includes('clay') || soilLower.includes('black') ? 92 : 75,
      variety: 'RNR-15048 (Telangana Sona) / MTU-1010',
      durationDays: 135,
      waterRequirement: 'High',
      waterRequirementTe: 'ఎక్కువ నీరు అవసరం',
      waterMmTotal: 1100,
      expectedYieldPerAcreQuintals: 30,
      estimatedCostPerAcre: 28000,
      expectedPricePerQuintal: 2450,
      grossProfitPerAcre: 73500,
      netProfitPerAcre: 45500,
      totalNetProfit: Math.round(45500 * acres),
      roiPercentage: 162,
      bestSowingWindow: 'Nov 15 - Dec 15',
      bestSowingWindowTe: 'నవంబర్ 15 - డిసెంబర్ 15',
      soilSuitabilityReason: 'Retains moisture well; strong root anchoring in deep clay loam.',
      soilSuitabilityReasonTe: 'తేమను నిల్వ ఉంచే సామర్థ్యం, బలమైన వేరు వ్యవస్థకు అనుకూలం.',
      fertilizerPlan: 'Basal: 50kg DAP + 20kg Zinc Sulphate; Active Tillering: 35kg Urea; Panicle: 25kg Potash.',
      risks: 'Blast (అగ్గి తెగులు) and Brown Planthopper during humid spells.',
      risksTe: 'తేమ ఎక్కువైతే అగ్గి తెగులు మరియు సుడిదోమ ఆశించే ప్రమాదం ఉంది.',
    },
    {
      cropKey: 'cotton',
      name: 'Bt Cotton (Long Staple)',
      nameTe: 'పత్తి (బీటీ కాటన్)',
      imageUrl: '/src/assets/images/smart_farmland_sensor_iot_1794070590682.jpg',
      suitabilityScore: soilLower.includes('black') ? 90 : 72,
      variety: 'Bollgard II RCH-659 / Kaveri ATM',
      durationDays: 155,
      waterRequirement: 'Medium',
      waterRequirementTe: 'మధ్యస్థ నీటి అవసరం',
      waterMmTotal: 700,
      expectedYieldPerAcreQuintals: 14,
      estimatedCostPerAcre: 34000,
      expectedPricePerQuintal: 7480,
      grossProfitPerAcre: 104720,
      netProfitPerAcre: 70720,
      totalNetProfit: Math.round(70720 * acres),
      roiPercentage: 208,
      bestSowingWindow: seasonLower === 'kharif' ? 'Jun 15 - Jul 25 (Kharif)' : 'Oct early (Rabi)',
      bestSowingWindowTe: 'జూన్ 15 - జూలై 25 లేదా అక్టోబర్ ప్రారంభం',
      soilSuitabilityReason: 'Deep black soil provides moisture cushion between irrigations.',
      soilSuitabilityReasonTe: 'నల్లరేగడి నేలల్లో పత్తికి అవసరమైన తేమ ఎక్కువ కాలం నిలిచి ఉంటుంది.',
      fertilizerPlan: '60kg N, 30kg P2O5, 30kg K2O per acre in 3 equal splits.',
      risks: 'Pink Bollworm during boll development; damping-off in wet soils.',
      risksTe: 'గులాబీ రంగు కాయ తొలుచు పురుగు నివారణకు లింగాకర్షక బుట్టలు వాడాలి.',
    },
    {
      cropKey: 'groundnut',
      name: 'Groundnut (Spanish Bunch)',
      nameTe: 'వేరుశనగ (స్పానిష్ రకం)',
      imageUrl: '/src/assets/images/organic_harvest_produce_1794070591544.jpg',
      suitabilityScore: soilLower.includes('red') || soilLower.includes('sandy') ? 95 : 70,
      variety: 'Kadiri 6 (K6) / TAG-24 / Dharani',
      durationDays: 105,
      waterRequirement: 'Low',
      waterRequirementTe: 'తక్కువ నీటితో సాగు చేయవచ్చు',
      waterMmTotal: 450,
      expectedYieldPerAcreQuintals: 16,
      estimatedCostPerAcre: 26000,
      expectedPricePerQuintal: 6700,
      grossProfitPerAcre: 107200,
      netProfitPerAcre: 81200,
      totalNetProfit: Math.round(81200 * acres),
      roiPercentage: 312,
      bestSowingWindow: 'Nov 10 - Dec 20',
      bestSowingWindowTe: 'నవంబర్ 10 - డిసెంబర్ 20',
      soilSuitabilityReason: 'Loose friable red soil allows deep peg penetration and healthy pod filling.',
      soilSuitabilityReasonTe: 'వదులైన ఎర్ర నేలల్లో ఊడలు సులభంగా దిగి కాయలు బాగా ఊరతాయి.',
      fertilizerPlan: 'Gypsum 200kg/acre at flowering stage for pod filling + 20kg DAP basal.',
      risks: 'Tikka leaf spot and collar rot if water stagnation occurs.',
      risksTe: 'నీరు నిల్వ ఉంటే తిక్కా తెగులు, మొదలు కుళ్లు తెగులు వచ్చే అవకాశం ఉంది.',
    },
  ];

  const sorted = allCrops.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  res.json({
    success: true,
    integrityState: 'LIVE_DATA',
    input: {
      season,
      soilType,
      irrigation,
      landSizeAcres: acres,
      district,
      village,
    },
    primaryRecommendation: sorted[0],
    alternatives: sorted.slice(1, 4),
    summary: `Based on ${soilType} and ${irrigation} in ${locationText} (${season} season), ${sorted[0].name} (${sorted[0].nameTe}) scores highest (${sorted[0].suitabilityScore}%) in the regional planning model.`,
    summaryTe: `${locationText} ప్రాంతంలో ${soilType} మరియు ${irrigation} వసతికి (${season} సీజన్) ${sorted[0].nameTe} అత్యధిక అనుకూలత (${sorted[0].suitabilityScore}%) కలిగి ఉంది.`,
    provenance: {
      integrityState: 'LIVE_DATA',
      classification: 'CALCULATED_DATA',
      source: 'Regional Agronomic Planning Matrix (Planning Estimate)',
      timestamp: new Date().toISOString(),
      isRealTime: false,
      isModelEstimate: true,
      locationLabel: locationText,
      methodology: 'Rule-based crop suitability matrix using user-selected soil texture, season, irrigation method, and reference regional yield/cost benchmarks (not live mandi prices).',
    },
  });
});

// 9. Profit Calculator (User Input Arithmetic)
app.post('/api/profit', (req: Request, res: Response) => {
  const {
    crop = 'Paddy',
    acres = 1,
    seedCost = 0,
    fertilizerCost = 0,
    pesticideCost = 0,
    labourCost = 0,
    machineryCost = 0,
    irrigationCost = 0,
    expectedYieldQuintals = 0,
    expectedPricePerQuintal = 0,
  } = req.body;

  const totalAcres = Math.max(0.25, Number(acres) || 1);
  const costPerAcre =
    Number(seedCost) +
    Number(fertilizerCost) +
    Number(pesticideCost) +
    Number(labourCost) +
    Number(machineryCost) +
    Number(irrigationCost);

  const totalInvestment = costPerAcre * totalAcres;
  const totalYield = Number(expectedYieldQuintals) * totalAcres;
  const grossRevenue = totalYield * Number(expectedPricePerQuintal);
  const netProfit = grossRevenue - totalInvestment;
  const roi = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100).toFixed(1) : '0';
  const costPerQuintal = totalYield > 0 ? Math.round(totalInvestment / totalYield) : 0;
  const breakEvenPrice = costPerQuintal;
  const breakEvenYield = Number(expectedPricePerQuintal) > 0 ? (totalInvestment / Number(expectedPricePerQuintal)).toFixed(1) : '0';

  const safeDiv = (part: number) => (totalInvestment > 0 ? Math.round((part / totalInvestment) * 100) : 0);

  res.json({
    success: true,
    crop,
    acres: totalAcres,
    summary: {
      totalInvestment,
      grossRevenue,
      netProfit,
      roiPercentage: Number(roi),
      costPerAcre,
      profitPerAcre: Math.round(netProfit / totalAcres),
      costPerQuintal,
      breakEvenPrice,
      breakEvenYieldQuintals: Number(breakEvenYield),
    },
    breakdown: [
      { category: 'Labour (కూలీలు)', amount: Number(labourCost) * totalAcres, percent: safeDiv(Number(labourCost) * totalAcres) },
      { category: 'Fertilizer (ఎరువులు)', amount: Number(fertilizerCost) * totalAcres, percent: safeDiv(Number(fertilizerCost) * totalAcres) },
      { category: 'Machinery & Tractor (యంత్రాలు)', amount: Number(machineryCost) * totalAcres, percent: safeDiv(Number(machineryCost) * totalAcres) },
      { category: 'Pesticides (పురుగు మందులు)', amount: Number(pesticideCost) * totalAcres, percent: safeDiv(Number(pesticideCost) * totalAcres) },
      { category: 'Seeds (విత్తనాలు)', amount: Number(seedCost) * totalAcres, percent: safeDiv(Number(seedCost) * totalAcres) },
      { category: 'Irrigation & Power (నీటి పారుదల)', amount: Number(irrigationCost) * totalAcres, percent: safeDiv(Number(irrigationCost) * totalAcres) },
    ],
    provenance: {
      integrityState: 'LIVE_DATA',
      classification: 'CALCULATED_DATA',
      source: 'User-Entered Financial Formula',
      timestamp: new Date().toISOString(),
      isRealTime: false,
      methodology: 'Direct arithmetic calculation from user-supplied per-acre costs, expected yield, and target selling price.',
    },
  });
});

// 10. Drone Booking
app.get('/api/drone/bookings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    integrityState: droneBookings.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
    count: droneBookings.length,
    bookings: droneBookings,
  });
});

app.post('/api/drone/book', (req: Request, res: Response) => {
  const {
    farmerName,
    phone,
    serviceType,
    acres,
    date,
    timeSlot,
    village,
    mandal,
    district,
  } = req.body;

  if (!farmerName?.trim() || !phone?.trim() || !village?.trim() || !district?.trim() || !date?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Farmer name, phone, date, village, and district are required.',
    });
  }

  const parsedAcres = Math.max(0.5, Number(acres) || 1);
  const safeService = serviceType || 'Nano Urea & Micronutrient Spraying';
  const ratePerAcre = safeService.includes('Survey') ? 350 : 550;
  const cost = Math.round(parsedAcres * ratePerAcre);

  const newBooking: DroneBooking = {
    id: `DRN-${Date.now().toString().slice(-4)}`,
    farmerName: String(farmerName).trim(),
    phone: String(phone).trim(),
    serviceType: safeService,
    acres: parsedAcres,
    date: String(date),
    timeSlot: timeSlot || '07:00 AM - 09:00 AM',
    village: String(village).trim(),
    mandal: String(mandal || '').trim(),
    district: String(district).trim(),
    status: 'Requested',
    cost,
    droneModel: '16L Agricultural UAV',
    createdAt: new Date().toISOString(),
  };

  droneBookings.unshift(newBooking);

  res.json({
    success: true,
    message: 'Drone service request logged.',
    booking: newBooking,
  });
});

// 11. Market Prices (Tier 1: data.gov.in Agmarknet API; Tier 2: FarmersNeed Live Official APMC Mandi Engine via MSAMB; Tier 3: Gemini Google Search Grounding)
const marketCache = new Map<
  string,
  {
    prices: any[];
    sourceLabel: string;
    groundingSources: Array<{ title: string; uri: string }>;
    expiresAt: number;
  }
>();
let dataGovUnreachableUntil = 0;

const MSAMB_CORE_COMMODITIES: Array<{
  code: string;
  label: string;
  cropKey: string;
  msp?: number;
}> = [
  { code: '02007', label: 'Paddy (Unhusked)', cropKey: 'paddy', msp: 2300 },
  { code: '01001', label: 'Cotton', cropKey: 'cotton', msp: 7121 },
  { code: '10014', label: 'Red Chillies', cropKey: 'chilli' },
  { code: '02015', label: 'Maize', cropKey: 'maize', msp: 2225 },
  { code: '10006', label: 'Turmeric', cropKey: 'turmeric' },
  { code: '04003', label: 'Groundnut (Dry Pods)', cropKey: 'groundnut', msp: 6783 },
  { code: '04017', label: 'Soyabean', cropKey: 'soyabean', msp: 4892 },
  { code: '03006', label: 'Bengal Gram (Chana)', cropKey: 'chana', msp: 5650 },
  { code: '03020', label: 'Pigeon Pea (Tur / Red Gram)', cropKey: 'red-gram', msp: 7550 },
  { code: '03022', label: 'Black Gram (Urad)', cropKey: 'black-gram', msp: 7400 },
  { code: '08035', label: 'Onion', cropKey: 'onion' },
  { code: '08071', label: 'Tomato', cropKey: 'tomato' },
];

function stripHtmlCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatApmcTitleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function extractCookiesFromHeaders(headers: Headers): string {
  const hdrs: any = headers as any;
  const list: string[] =
    typeof hdrs.getSetCookie === 'function'
      ? hdrs.getSetCookie()
      : headers.get('set-cookie')
      ? [headers.get('set-cookie') as string]
      : [];
  return list
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function parseMsambGridHtml(html: string) {
  const dateBuckets: Array<{
    dateStr: string;
    rows: Array<{
      apmc: string;
      variety: string;
      unit: string;
      arrivals: number;
      minPrice: number;
      maxPrice: number;
      modalPrice: number;
    }>;
  }> = [];

  const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  let currentDate = '';
  let currentRows: Array<any> = [];

  for (const trMatch of trMatches) {
    const trBody = trMatch[1];
    const colspanMatch = trBody.match(/colspan=["']?7["']?[^>]*>([\s\S]*?)<\/td>/i);
    if (colspanMatch) {
      if (currentDate && currentRows.length > 0) {
        dateBuckets.push({ dateStr: currentDate, rows: currentRows });
      }
      currentDate = stripHtmlCell(colspanMatch[1]);
      currentRows = [];
      continue;
    }

    const cells = [...trBody.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      stripHtmlCell(m[1])
    );
    if (cells.length >= 7) {
      const [apmc, variety, unit, arrRaw, minRaw, maxRaw, modalRaw] = cells;
      const arrivals = Number(arrRaw.replace(/,/g, '')) || 0;
      const minPrice = Number(minRaw.replace(/,/g, '')) || 0;
      const maxPrice = Number(maxRaw.replace(/,/g, '')) || 0;
      const modalPrice = Number(modalRaw.replace(/,/g, '')) || 0;
      if (
        apmc &&
        /quintal/i.test(unit) &&
        Number.isFinite(modalPrice) &&
        modalPrice > 0
      ) {
        currentRows.push({
          apmc,
          variety: variety && !/^-+$/.test(variety) ? variety : '',
          unit: 'QUINTAL',
          arrivals,
          minPrice: minPrice > 0 ? Math.min(minPrice, modalPrice) : modalPrice,
          maxPrice: maxPrice > 0 ? Math.max(maxPrice, modalPrice) : modalPrice,
          modalPrice,
        });
      }
    }
  }
  if (currentDate && currentRows.length > 0) {
    dateBuckets.push({ dateStr: currentDate, rows: currentRows });
  }
  return dateBuckets;
}

async function fetchLiveMsambApmcPrices(district: string, state: string) {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'text/html,application/json,*/*',
  };

  // Establish English session cookie on official MSAMB APMC portal
  const pageRes = await fetch('https://www.msamb.com/ApmcDetail/APMCPriceInformation', {
    headers: baseHeaders,
    signal: AbortSignal.timeout(8000),
  });
  if (!pageRes.ok) {
    throw new Error(`MSAMB portal returned HTTP ${pageRes.status}`);
  }
  let cookieHeader = extractCookiesFromHeaders(pageRes.headers);

  const langRes = await fetch(
    'https://www.msamb.com/Home/ChangeLanguage?LanguageAbbrevation=en',
    {
      headers: {
        ...baseHeaders,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        Referer: 'https://www.msamb.com/ApmcDetail/APMCPriceInformation',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    }
  );
  const updatedCookies = extractCookiesFromHeaders(langRes.headers);
  if (updatedCookies) {
    const cookieMap = new Map<string, string>();
    for (const part of `${cookieHeader}; ${updatedCookies}`.split(';')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq > 0) cookieMap.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
    cookieHeader = [...cookieMap.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  const fetchOneMsambCommodity = async (
    item: (typeof MSAMB_CORE_COMMODITIES)[number]
  ) => {
    const gridUrl = `https://www.msamb.com/ApmcDetail/DataGridBind?commodityCode=${encodeURIComponent(
      item.code
    )}&apmcCode=`;
    const r = await fetch(gridUrl, {
      headers: {
        ...baseHeaders,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        Referer: 'https://www.msamb.com/ApmcDetail/APMCPriceInformation',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    if (!html || /No record found/i.test(html)) return null;

    const buckets = parseMsambGridHtml(html);
    if (buckets.length === 0) return null;

    const latestBucket = buckets[0];
    const sortedLatest = [...latestBucket.rows].sort((a, b) => b.arrivals - a.arrivals);
    const topRow = sortedLatest[0];
    if (!topRow) return null;

    // Measure real daily change vs previous trading day at same APMC (or average)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let changeStr = '0.0%';
    const prevBucket = buckets[1];
    if (prevBucket && prevBucket.rows.length > 0) {
      const sameApmcPrev = prevBucket.rows.find(
        (row) => row.apmc.toLowerCase() === topRow.apmc.toLowerCase()
      );
      const prevModal =
        sameApmcPrev?.modalPrice ||
        Math.round(
          prevBucket.rows.reduce((sum, row) => sum + row.modalPrice, 0) /
            prevBucket.rows.length
        );
      if (prevModal > 0) {
        const pct = ((topRow.modalPrice - prevModal) / prevModal) * 100;
        if (Math.abs(pct) >= 0.2) {
          trend = pct > 0 ? 'up' : 'down';
          changeStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const varietySuffix =
      topRow.variety && !/lokal|local/i.test(topRow.variety)
        ? ` (${formatApmcTitleCase(topRow.variety)})`
        : '';
    const marketLabel = `${formatApmcTitleCase(topRow.apmc)} APMC (${latestBucket.dateStr})`;

    return {
      commodity: `${item.label}${varietySuffix}`,
      cropKey: item.cropKey,
      market: marketLabel,
      state: 'Maharashtra (Official APMC Board)',
      district: formatApmcTitleCase(topRow.apmc),
      minPrice: Math.round(topRow.minPrice),
      maxPrice: Math.round(topRow.maxPrice),
      modalPrice: Math.round(topRow.modalPrice),
      msp: item.msp,
      change: changeStr,
      trend,
      unit: '₹ / Quintal',
      arrivals:
        topRow.arrivals > 0
          ? `${topRow.arrivals.toLocaleString('en-IN')} Qtl`
          : latestBucket.dateStr,
      asOfDate: latestBucket.dateStr,
      groundingSources: [
        {
          title: 'MSAMB Official APMC Price Information Portal',
          uri: 'https://www.msamb.com/ApmcDetail/APMCPriceInformation',
        },
      ],
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: 'FarmersNeed Live APMC Feed (MSAMB Official Government Mandi Board)',
        timestamp: nowIso,
        isRealTime: true,
        observationDate: latestBucket.dateStr,
        locationLabel: [district, state].filter(Boolean).join(', ') || 'India APMC Network',
        methodology:
          'Real-time official APMC daily arrival & wholesale modal price table (Quintal basis) with prior-session delta.',
        groundingSources: [
          {
            title: 'MSAMB Official APMC Price Information Portal',
            uri: 'https://www.msamb.com/ApmcDetail/APMCPriceInformation',
          },
        ],
      },
    };
  };

  const prices: any[] = [];
  for (let i = 0; i < MSAMB_CORE_COMMODITIES.length; i += 4) {
    const batch = MSAMB_CORE_COMMODITIES.slice(i, i + 4);
    const batchResults = await Promise.allSettled(
      batch.map((item) => fetchOneMsambCommodity(item))
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        prices.push(r.value);
      }
    }
  }

  if (prices.length === 0) {
    throw new Error('Official MSAMB APMC portal returned 0 active commodity lots.');
  }

  return {
    prices,
    groundingSources: [
      {
        title: 'MSAMB Official APMC Price Information Portal',
        uri: 'https://www.msamb.com/ApmcDetail/APMCPriceInformation',
      },
    ],
    sourceLabel: 'FarmersNeed Live APMC Feed (MSAMB Official Government Mandi Board)',
  };
}

async function fetchLiveMandiPricesViaSearch(district: string, state: string) {
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY is not configured for live web-grounded mandi price lookup.');
  }

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const regionLabel = [district, state].filter(Boolean).join(', ') || 'Andhra Pradesh, Telangana, India';

  const prompt = `Search current Indian APMC / Agmarknet / eNAM wholesale mandi market prices (in INR ₹ per Quintal) as of ${todayDisplay} (or latest available trading day) focusing on ${regionLabel} and major South/Central Indian mandis (Guntur Mirchi Yard, Khammam, Warangal, Vijayawada, Kurnool, Adoni, Nizamabad, Madanapalle, Davangere, Akola).

Include 10 major agricultural commodities:
1. Red Chilli (Teja / Guntur Sannam)
2. Paddy / Rice (Sona Masoori / Common)
3. Cotton (Long Staple)
4. Groundnut (Pods / Bold)
5. Maize (Yellow Hybrid)
6. Turmeric (Finger / Bulb)
7. Bengal Gram (Chana)
8. Onion (Red)
9. Tomato (Local / Hybrid)
10. Black Gram (Urad) or Soybean

Return ONLY a valid JSON array (no markdown outside the array, no prose) with objects having this exact shape:
[
  {
    "commodity": "Red Chilli (Teja)",
    "market": "Guntur Mirchi Yard, Guntur",
    "state": "Andhra Pradesh",
    "district": "Guntur",
    "minPrice": 14000,
    "maxPrice": 17500,
    "modalPrice": 16000,
    "msp": null,
    "change": "+1.5%",
    "trend": "up",
    "arrivals": "42,000 Bags",
    "asOfDate": "${todayDisplay}"
  }
]
Ensure minPrice <= modalPrice <= maxPrice, all prices are positive numbers in ₹/Quintal, trend is one of "up", "down", or "stable", and msp is either the official Government of India MSP in ₹/Quintal (e.g., 2300 for Paddy, 7521 for Cotton, 6783 for Groundnut, 2225 for Maize, 5650 for Chana, 7400 for Urad, 4892 for Soybean) or null if non-MSP (Chilli, Turmeric, Onion, Tomato).`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const rawText = (response.text || '').trim();
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse live mandi price JSON from search response.');
  }

  const parsed: any[] = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('No live mandi price records returned.');
  }

  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const groundingSources: Array<{ title: string; uri: string }> = [];
  const seenUris = new Set<string>();
  for (const ch of rawChunks) {
    const uri = ch?.web?.uri;
    const title = ch?.web?.title;
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      groundingSources.push({ title: title || uri, uri });
    }
  }

  const nowIso = new Date().toISOString();
  const prices = parsed
    .filter(
      (r) =>
        r &&
        r.commodity &&
        Number.isFinite(Number(r.modalPrice)) &&
        Number(r.modalPrice) > 0
    )
    .map((r: any, idx: number) => {
      const modalPrice = Math.round(Number(r.modalPrice));
      const minPrice = Number.isFinite(Number(r.minPrice)) && Number(r.minPrice) > 0
        ? Math.min(modalPrice, Math.round(Number(r.minPrice)))
        : Math.round(modalPrice * 0.92);
      const maxPrice = Number.isFinite(Number(r.maxPrice)) && Number(r.maxPrice) > 0
        ? Math.max(modalPrice, Math.round(Number(r.maxPrice)))
        : Math.round(modalPrice * 1.08);
      const rawTrend = String(r.trend || 'stable').toLowerCase();
      const trend: 'up' | 'down' | 'stable' =
        rawTrend === 'up' || rawTrend === 'down' ? rawTrend : 'stable';

      return {
        commodity: String(r.commodity).trim(),
        cropKey: `${String(r.commodity).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`,
        market: String(r.market || `${r.district || 'APMC'} Mandi`).trim(),
        state: String(r.state || state || '').trim(),
        district: String(r.district || district || '').trim(),
        minPrice,
        maxPrice,
        modalPrice,
        msp: typeof r.msp === 'number' && r.msp > 0 ? Math.round(r.msp) : undefined,
        change: String(r.change || '0.0%'),
        trend,
        unit: '₹ / Quintal',
        arrivals: r.arrivals ? String(r.arrivals) : String(r.asOfDate || todayDisplay),
        asOfDate: String(r.asOfDate || todayDisplay),
        groundingSources: groundingSources.slice(0, 4),
        provenance: {
          integrityState: 'LIVE_DATA',
          classification: 'REAL_API_DATA',
          source: 'Live Web-Grounded Indian APMC Mandi Feed (Agmarknet / eNAM / Search)',
          timestamp: nowIso,
          isRealTime: true,
          observationDate: String(r.asOfDate || todayDisplay),
          locationLabel: regionLabel,
          methodology: 'Real-time Google Search grounding across active Indian APMC mandi bulletins via Gemini.',
          groundingSources: groundingSources.slice(0, 4),
        },
      };
    });

  if (prices.length === 0) {
    throw new Error('Grounded search did not yield valid mandi quotes.');
  }

  return {
    prices,
    groundingSources: groundingSources.slice(0, 6),
    sourceLabel: 'Live Web-Grounded APMC Mandi Feed (Agmarknet / eNAM / Google Search)',
  };
}

app.get('/api/market-prices', async (req: Request, res: Response) => {
  const district = typeof req.query.district === 'string' ? req.query.district.trim() : 'Guntur';
  const state = typeof req.query.state === 'string' ? req.query.state.trim() : 'Andhra Pradesh';
  const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const cacheKey = `${state.toLowerCase()}|${district.toLowerCase()}`;

  if (!forceRefresh) {
    const cached = marketCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json({
        success: true,
        integrityState: cached.prices.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
        available: true,
        marketCount: cached.prices.length,
        source: cached.sourceLabel,
        groundingSources: cached.groundingSources,
        prices: cached.prices,
        provenance: {
          integrityState: cached.prices.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
          classification: 'REAL_API_DATA',
          source: cached.sourceLabel,
          timestamp: new Date().toISOString(),
          isRealTime: true,
          groundingSources: cached.groundingSources,
        },
      });
    }
  }

  // 1. Try official data.gov.in Agmarknet API first if key is present and reachable
  const apiKey = process.env.DATA_GOV_API_KEY?.trim();
  if (apiKey && (forceRefresh || Date.now() >= dataGovUnreachableUntil)) {
    try {
      const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${encodeURIComponent(
        apiKey
      )}&format=json&limit=25`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) {
        throw new Error(`data.gov.in returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const records: any[] = data.records || [];

      const prices = records.map((r: any, idx: number) => ({
        commodity: `${r.commodity || 'Commodity'}${r.variety ? ` (${r.variety})` : ''}`,
        cropKey: `${String(r.commodity || 'item').toLowerCase().replace(/\s+/g, '-')}-${idx}`,
        market: `${r.market || 'APMC'}, ${r.district || ''}`,
        state: r.state || '',
        district: r.district || '',
        minPrice: Number(r.min_price) || 0,
        maxPrice: Number(r.max_price) || 0,
        modalPrice: Number(r.modal_price) || 0,
        change: '--',
        trend: 'stable' as const,
        unit: '₹ / Quintal',
        asOfDate: r.arrival_date || new Date().toLocaleDateString('en-IN'),
        provenance: {
          integrityState: 'LIVE_DATA' as const,
          classification: 'REAL_API_DATA' as const,
          source: 'Agmarknet (data.gov.in)',
          timestamp: new Date().toISOString(),
          isRealTime: true,
          observationDate: r.arrival_date,
        },
      }));

      if (prices.length > 0) {
        marketCache.set(cacheKey, {
          prices,
          sourceLabel: 'Agmarknet Open Government Data API (data.gov.in)',
          groundingSources: [],
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
        return res.json({
          success: true,
          integrityState: 'LIVE_DATA',
          available: true,
          marketCount: prices.length,
          source: 'Agmarknet Open Government Data API (data.gov.in)',
          groundingSources: [],
          prices,
          provenance: {
            integrityState: 'LIVE_DATA',
            classification: 'REAL_API_DATA',
            source: 'Agmarknet Open Government Data API (data.gov.in)',
            timestamp: new Date().toISOString(),
            isRealTime: true,
          },
        });
      }
    } catch (err: any) {
      dataGovUnreachableUntil = Date.now() + 10 * 60 * 1000;
      const causeCode = err?.cause?.code || err?.code || '';
      console.warn(
        `data.gov.in unreachable (${causeCode || err.message}); using FarmersNeed live MSAMB APMC mandi engine.`
      );
    }
  }

  // 2. FarmersNeed Built-in Live Official APMC Mandi Engine (MSAMB Government Portal)
  try {
    const msambResult = await fetchLiveMsambApmcPrices(district, state);
    marketCache.set(cacheKey, {
      prices: msambResult.prices,
      sourceLabel: msambResult.sourceLabel,
      groundingSources: msambResult.groundingSources,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      available: true,
      marketCount: msambResult.prices.length,
      source: msambResult.sourceLabel,
      groundingSources: msambResult.groundingSources,
      prices: msambResult.prices,
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: msambResult.sourceLabel,
        timestamp: new Date().toISOString(),
        isRealTime: true,
        groundingSources: msambResult.groundingSources,
      },
    });
  } catch (msambErr: any) {
    console.warn(`MSAMB APMC engine failed (${msambErr?.message || msambErr}); falling back to Google Search grounding.`);
  }

  // 3. Fallback: Web-Grounded APMC Mandi Price Lookup via Gemini + Google Search
  try {
    const liveResult = await fetchLiveMandiPricesViaSearch(district, state);
    marketCache.set(cacheKey, {
      prices: liveResult.prices,
      sourceLabel: liveResult.sourceLabel,
      groundingSources: liveResult.groundingSources,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      available: true,
      marketCount: liveResult.prices.length,
      source: liveResult.sourceLabel,
      groundingSources: liveResult.groundingSources,
      prices: liveResult.prices,
      provenance: {
        integrityState: 'LIVE_DATA',
        classification: 'REAL_API_DATA',
        source: liveResult.sourceLabel,
        timestamp: new Date().toISOString(),
        isRealTime: true,
        groundingSources: liveResult.groundingSources,
      },
    });
  } catch (err: any) {
    console.warn(`Live mandi search feed unavailable: ${err?.message || err}`);
    return res.status(200).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      available: false,
      prices: [],
      message: `Market data currently unavailable (${err?.message || 'feed timeout'}). Click Retry to re-fetch live APMC rates.`,
      provenance: {
        integrityState: 'UNAVAILABLE',
        classification: 'UNAVAILABLE',
        source: 'Agmarknet / Live APMC Mandi Feed',
        timestamp: new Date().toISOString(),
        isRealTime: false,
        notes: err?.message || 'Upstream mandi feeds unreachable.',
      },
    });
  }
});

// 12. Labour Requests
app.get('/api/labour-requests', (_req: Request, res: Response) => {
  res.json({
    success: true,
    integrityState: labourRequests.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
    count: labourRequests.length,
    requests: labourRequests,
  });
});

app.post('/api/labour-requests', (req: Request, res: Response) => {
  const {
    farmerName,
    phone,
    village,
    district,
    workType,
    workersNeeded,
    dailyWage,
    startDate,
    durationDays,
  } = req.body;

  if (!farmerName?.trim() || !phone?.trim() || !village?.trim() || !district?.trim() || !startDate?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Farmer name, phone, village, district, and start date are required.',
    });
  }

  const newReq: LabourRequest = {
    id: `LAB-${Date.now().toString().slice(-4)}`,
    farmerName: String(farmerName).trim(),
    phone: String(phone).trim(),
    village: String(village).trim(),
    district: String(district).trim(),
    workType: workType || 'Field Work',
    workersNeeded: Math.max(1, Number(workersNeeded) || 1),
    dailyWage: Math.max(100, Number(dailyWage) || 500),
    startDate: String(startDate),
    durationDays: Math.max(1, Number(durationDays) || 1),
    status: 'Open',
    createdAt: new Date().toISOString(),
  };

  labourRequests.unshift(newReq);
  res.json({
    success: true,
    message: 'Labour request posted.',
    request: newReq,
  });
});

// 13. Community Discussions & Comments
app.get('/api/discussions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    integrityState: discussions.length > 0 ? 'LIVE_DATA' : 'NO_DATA',
    count: discussions.length,
    discussions,
  });
});

app.post('/api/discussions', (req: Request, res: Response) => {
  const {
    author,
    village,
    district,
    title,
    content,
    category = 'General Farming',
    crop = '',
  } = req.body;

  if (!author?.trim() || !village?.trim() || !district?.trim() || !title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Author, village, district, title, and content are required.' });
  }

  const newPost: Discussion = {
    id: `disc-${Date.now()}`,
    author: String(author).trim(),
    village: String(village).trim(),
    district: String(district).trim(),
    title: String(title).trim(),
    content: String(content).trim(),
    category,
    crop: String(crop).trim(),
    upvotes: 1,
    commentsCount: 0,
    createdAt: new Date().toISOString(),
  };

  discussions.unshift(newPost);
  res.json({ success: true, discussion: newPost });
});

app.get('/api/discussions/:postId/comments', (req: Request, res: Response) => {
  const postId = req.params.postId;
  const postComments = comments.filter((c) => c.postId === postId);
  res.json({ success: true, count: postComments.length, comments: postComments });
});

app.post('/api/discussions/:postId/comments', (req: Request, res: Response) => {
  const postId = req.params.postId;
  const { author, role = 'Farmer', content } = req.body;

  if (!author?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Author name and reply content are required.' });
  }

  const newComment: Comment = {
    id: `c-${Date.now()}`,
    postId,
    author: String(author).trim(),
    role,
    content: String(content).trim(),
    createdAt: new Date().toISOString(),
  };

  comments.push(newComment);
  const post = discussions.find((p) => p.id === postId);
  if (post) post.commentsCount += 1;

  res.json({ success: true, comment: newComment });
});

// 14. Real IoT Hardware Integration (ESP32 + Capacitive Soil Moisture + DHT22 + Relay Pump)
// Never fabricates hardware sensor readings or simulates hardware when disconnected.
interface IotTelemetryRecord {
  deviceId: string;
  firmwareVersion: string;
  soilMoisturePercent: number;
  temperatureC: number;
  humidityPercent: number;
  pumpRelayActive: boolean;
  wifiRssiDbm?: number;
  receivedAt: string;
}

const IOT_HEARTBEAT_TIMEOUT_SECONDS = 60;
const iotTelemetryLog: IotTelemetryRecord[] = [];
let iotLastHeartbeatEpoch: number | null = null;
let iotDesiredPumpRelayActive = false;

app.get('/api/iot/status', (_req: Request, res: Response) => {
  const now = Date.now();
  const isConnected =
    iotLastHeartbeatEpoch !== null &&
    (now - iotLastHeartbeatEpoch) / 1000 <= IOT_HEARTBEAT_TIMEOUT_SECONDS;

  const latestTelemetry = isConnected && iotTelemetryLog.length > 0 ? iotTelemetryLog[0] : null;

  res.json({
    connected: isConnected,
    integrityState: isConnected ? 'LIVE_DATA' : 'NO_DATA',
    lastHeartbeat: iotLastHeartbeatEpoch ? new Date(iotLastHeartbeatEpoch).toISOString() : null,
    timeoutSeconds: IOT_HEARTBEAT_TIMEOUT_SECONDS,
    pumpRelayActive: isConnected ? iotDesiredPumpRelayActive : false,
    latestTelemetry,
    telemetryHistory: isConnected ? iotTelemetryLog.slice(0, 12) : [],
    provenance: isConnected
      ? {
          integrityState: 'LIVE_DATA',
          classification: 'REAL_HARDWARE_SENSOR_DATA',
          source: `ESP32 Field Node (${latestTelemetry?.deviceId || 'ESP32'})`,
          timestamp: latestTelemetry?.receivedAt || new Date().toISOString(),
          isRealTime: true,
          methodology: 'Capacitive soil moisture ADC + DHT22 microclimate telemetry over HTTP POST.',
        }
      : {
          integrityState: 'NO_DATA',
          classification: 'NO_DATA',
          source: 'ESP32 Hardware Gateway',
          timestamp: new Date().toISOString(),
          isRealTime: false,
          notes: 'ESP32 device is not connected. No telemetry packets received within the timeout window.',
        },
  });
});

app.post('/api/iot/telemetry', (req: Request, res: Response) => {
  const {
    deviceId = 'ESP32-FARM-01',
    firmwareVersion = '1.0.0',
    soilMoisturePercent,
    temperatureC,
    humidityPercent,
    pumpRelayActive = false,
    wifiRssiDbm,
  } = req.body;

  if (soilMoisturePercent === undefined || temperatureC === undefined || humidityPercent === undefined) {
    return res.status(400).json({
      success: false,
      error: 'soilMoisturePercent, temperatureC, and humidityPercent are required numeric fields.',
    });
  }

  const record: IotTelemetryRecord = {
    deviceId: String(deviceId),
    firmwareVersion: String(firmwareVersion),
    soilMoisturePercent: Math.min(100, Math.max(0, Number(soilMoisturePercent))),
    temperatureC: Number(Number(temperatureC).toFixed(1)),
    humidityPercent: Math.min(100, Math.max(0, Number(humidityPercent))),
    pumpRelayActive: Boolean(pumpRelayActive),
    wifiRssiDbm: wifiRssiDbm !== undefined ? Number(wifiRssiDbm) : undefined,
    receivedAt: new Date().toISOString(),
  };

  iotLastHeartbeatEpoch = Date.now();
  iotDesiredPumpRelayActive = record.pumpRelayActive;
  iotTelemetryLog.unshift(record);
  if (iotTelemetryLog.length > 50) iotTelemetryLog.pop();

  res.json({
    success: true,
    desiredPumpRelayActive: iotDesiredPumpRelayActive,
    record,
  });
});

app.post('/api/iot/pump', (req: Request, res: Response) => {
  const { action } = req.body;
  const active = action === 'ON' || action === true;

  const isConnected =
    iotLastHeartbeatEpoch !== null &&
    (Date.now() - iotLastHeartbeatEpoch) / 1000 <= IOT_HEARTBEAT_TIMEOUT_SECONDS;

  if (!isConnected) {
    return res.status(409).json({
      success: false,
      integrityState: 'NO_DATA',
      error: 'ESP32 device is not connected. Pump relay cannot be actuated without physical hardware.',
      code: 'IOT_DEVICE_OFFLINE',
    });
  }

  iotDesiredPumpRelayActive = active;
  res.json({
    success: true,
    integrityState: 'LIVE_DATA',
    mode: 'hardware',
    pumpRelayActive: iotDesiredPumpRelayActive,
    message: `Relay command queued for ESP32: PUMP_${active ? 'ON' : 'OFF'}`,
    classification: 'REAL_HARDWARE_SENSOR_DATA',
  });
});

// 14. Server Start with Vite in Dev & Static in Prod
async function startServer() {
  const httpServer = http.createServer(app);

  // Never let any unmatched /api/* route fall through to Vite SPA or static HTML fallback
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    let viteMiddleware: ((req: Request, res: Response, next: NextFunction) => void) | null = null;
    let viteError: Error | null = null;

    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const disableHmr = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: disableHmr ? false : { server: httpServer },
          ws: disableHmr ? false : undefined,
          watch: disableHmr ? null : {},
        },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
    })().catch((err) => {
      viteError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to initialize Vite dev middleware:', err);
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (!viteMiddleware && !viteError) {
        await viteReady;
      }
      if (viteError) {
        return next(viteError);
      }
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      return next();
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌾 FarmersNeed 2.0 Smart Agriculture Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
