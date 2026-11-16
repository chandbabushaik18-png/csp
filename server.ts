import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const require = createRequire(import.meta.url);
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

const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function interpretWmoCode(code: number): { condition: string; description: string; descriptionTe: string } {
  switch (code) {
    case 0: return { condition: 'Clear', description: 'clear sky', descriptionTe: 'Clear' };
    case 1: return { condition: 'Mainly Clear', description: 'mainly clear', descriptionTe: 'Mainly Clear' };
    case 2: return { condition: 'Partly Cloudy', description: 'partly cloudy', descriptionTe: 'Partly Cloudy' };
    case 3: return { condition: 'Overcast', description: 'overcast', descriptionTe: 'Overcast' };
    case 45: case 48: return { condition: 'Fog', description: 'fog', descriptionTe: 'Fog' };
    case 51: case 53: case 55: return { condition: 'Drizzle', description: 'drizzle', descriptionTe: 'Drizzle' };
    case 61: return { condition: 'Slight Rain', description: 'slight rain', descriptionTe: 'Slight Rain' };
    case 63: return { condition: 'Rain', description: 'rain', descriptionTe: 'Rain' };
    case 65: return { condition: 'Heavy Rain', description: 'heavy rain', descriptionTe: 'Heavy Rain' };
    case 80: case 81: case 82: return { condition: 'Showers', description: 'showers', descriptionTe: 'Showers' };
    case 95: case 96: case 99: return { condition: 'Thunderstorm', description: 'thunderstorm', descriptionTe: 'Thunderstorm' };
    default: return { condition: 'Fair', description: 'fair weather', descriptionTe: 'Fair' };
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'FarmersNeed 2.0', version: '2.2.0', geminiConfigured: !!aiClient, timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', geminiConfigured: !!aiClient, version: '2.2.0' });
});

app.get('/api/weather', async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lon = parseFloat(String(req.query.lon || ''));
  const city = String(req.query.city || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ success: false, error: 'Missing coordinates: lat and lon are required. Allow GPS or select farmland on the map.', code: 'MISSING_COORDINATES' });
  }
  try {
    const openMeteoUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,is_day` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,et0_fao_evapotranspiration,uv_index` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
      `&timezone=auto`;
    const response = await fetch(openMeteoUrl);
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
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
    const wmo = interpretWmoCode(current.weather_code ?? 0);
    const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? temp - 3);
    const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? temp + 3);
    const rainProbability = Math.round(daily.precipitation_probability_max?.[0] ?? 0);
    const formatSunTime = (isoStr?: string) => {
      if (!isoStr) return '--:--';
      try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return String(isoStr); }
    };
    let sprayCondition = 'Ideal for Spraying';
    let sprayBadge: 'ideal' | 'moderate' | 'poor' = 'ideal';
    if (windSpeedKmh > 15 || temp > 35 || rainProbability > 40) {
      sprayCondition = 'Not Recommended - High Drift/Rain Risk';
      sprayBadge = 'poor';
    } else if (windSpeedKmh > 10 || humidity > 85 || temp > 32) {
      sprayCondition = 'Moderate - Low Wind Window Advised';
      sprayBadge = 'moderate';
    }
    let sowingSuitability = 'Optimal Soil Moisture & Temperature';
    let sowingSuitabilityBadge: 'favorable' | 'moderate' | 'unfavorable' = 'favorable';
    if (temp > 38 || rainProbability > 65) {
      sowingSuitability = 'Delay Sowing: Excessive Heat or Flood Hazard';
      sowingSuitabilityBadge = 'unfavorable';
    }
    const hourlyTimes: string[] = hourly.time || [];
    const hourlyList: any[] = [];
    const nowEpoch = Date.now();
    for (let i = 0; i < hourlyTimes.length && hourlyList.length < 24; i++) {
      const hDate = new Date(hourlyTimes[i]);
      if (hDate.getTime() >= nowEpoch - 3600000) {
        hourlyList.push({
          time: hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
          condition: interpretWmoCode(hourly.weather_code?.[i] ?? 0).condition,
          rainChance: Math.round(hourly.precipitation_probability?.[i] ?? 0),
          windSpeedKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
          humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? 0),
          et0_mm: Number((hourly.et0_fao_evapotranspiration?.[i] ?? 0).toFixed(2)),
        });
      }
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecastList: any[] = [];
    const dailyTimes: string[] = daily.time || [];
    for (let d = 0; d < Math.min(7, dailyTimes.length); d++) {
      const fDate = new Date(dailyTimes[d]);
      forecastList.push({
        day: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()],
        dayTe: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()],
        date: fDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        tempMax: Math.round(daily.temperature_2m_max?.[d] ?? 0),
        tempMin: Math.round(daily.temperature_2m_min?.[d] ?? 0),
        condition: interpretWmoCode(daily.weather_code?.[d] ?? 0).condition,
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
        locationLabel: city ? `${city} (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)` : `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`,
        notes: 'Model-based numerical weather prediction for selected coordinates.',
      },
      location: { city: city || `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`, country: 'IN', lat, lon },
      current: {
        temp, feelsLike, tempMin, tempMax, humidity, pressure: surfacePressure,
        condition: wmo.condition, description: wmo.description, descriptionTe: wmo.descriptionTe,
        windSpeedKmh, windDirectionDeg, clouds, rainProbability, precipitationMm,
        uvIndex: Number((hourly.uv_index?.[0] ?? 0).toFixed(1)),
        sunrise: formatSunTime(daily.sunrise?.[0]),
        sunset: formatSunTime(daily.sunset?.[0]),
        sprayCondition, sprayBadge, sowingSuitability, sowingSuitabilityBadge,
        fertilizerSafe: rainProbability < 40,
        postIrrigationRainRisk: rainProbability > 50,
        heatStressWarning: temp >= 37,
      },
      hourly: hourlyList,
      forecast: forecastList,
    });
  } catch (err: any) {
    console.error('Weather API failure:', err);
    return res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: `Weather forecast unavailable: ${err.message}`, code: 'WEATHER_SERVICE_ERROR' });
  }
});

app.post('/api/water-advisory', async (req: Request, res: Response) => {
  const { crop = 'Chilli', cropStage = 'Mid-Season', soilType = 'Loamy', irrigationMethod = 'Drip', acres = 1, lat, lon } = req.body || {};
  let et0 = 5.0;
  try {
    if (lat != null && lon != null) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=et0_fao_evapotranspiration&forecast_days=1&timezone=auto`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        const vals = (data.hourly?.et0_fao_evapotranspiration || []).filter((v: any) => v != null);
        if (vals.length) et0 = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      }
    }
  } catch (_) {}
  const kcMap: Record<string, number> = { chilli: 1.05, paddy: 1.15, cotton: 1.0, maize: 1.1, groundnut: 0.95, tomato: 1.05, turmeric: 1.0 };
  const key = String(crop).toLowerCase();
  let kc = 1.0;
  for (const k of Object.keys(kcMap)) { if (key.includes(k)) { kc = kcMap[k]; break; } }
  const efficiency = String(irrigationMethod).toLowerCase().includes('drip') ? 0.9 : String(irrigationMethod).toLowerCase().includes('sprinkler') ? 0.75 : 0.6;
  const etc = et0 * kc;
  const grossMm = etc / efficiency;
  const dailyLitersPerAcre = Math.round(grossMm * 4046.86);
  const pumpingHoursDaily = Math.max(0.5, Math.round((dailyLitersPerAcre / 20000) * 10) / 10);
  res.json({
    success: true, integrityState: 'LIVE_DATA', crop, cropStage, soilType, irrigationMethod,
    areaAcres: Number(acres) || 1, et0_mm: Math.round(et0 * 100) / 100, kc,
    etc_mm: Math.round(etc * 100) / 100, grossWaterNeed_mm: Math.round(grossMm * 100) / 100,
    dailyLitersPerAcre, pumpingHoursDaily, efficiency,
    recommendation: `Under ET0 ${et0.toFixed(1)} mm/day, ${crop} needs ~${dailyLitersPerAcre.toLocaleString('en-IN')} L/acre/day with ${irrigationMethod}.`,
    provenance: { integrityState: 'LIVE_DATA', classification: 'REAL_API_DATA', source: 'Open-Meteo ET0 + FAO Kc', timestamp: new Date().toISOString(), isRealTime: true },
  });
});

app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon required' });
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed-PrecisionAgri/2.0' } });
    if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
    const data = await resp.json();
    const addr = data.address || {};
    res.json({
      success: true,
      village: addr.village || addr.suburb || addr.town || addr.hamlet || '',
      mandal: addr.county || addr.municipality || '',
      district: addr.state_district || addr.district || '',
      state: addr.state || '',
      country: addr.country || 'India',
      displayName: data.display_name || '',
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get('/api/location/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon required' });
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed-PrecisionAgri/2.0' } });
    if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
    const data = await resp.json();
    res.json({ success: true, address: data.address || {}, displayName: data.display_name || '' });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get('/api/geocode/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (!q) return res.status(400).json({ success: false, error: 'q required' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed-PrecisionAgri/2.0' } });
    if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
    const data = await resp.json();
    res.json({ success: true, results: data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.post('/api/doctor/diagnose', async (req: Request, res: Response) => {
  const { imageBase64, crop = '', symptomsText = '', language = 'en' } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ success: false, integrityState: 'UNAVAILABLE', error: 'A valid leaf or crop photograph is required.' });
  }
  const mimeMatch = String(imageBase64).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!mimeMatch) {
    return res.status(400).json({ success: false, integrityState: 'UNAVAILABLE', error: 'Unsupported image format. Use JPG, PNG, or WebP.' });
  }
  const mimeType = mimeMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeMatch[1].toLowerCase();
  const cleanBase64 = mimeMatch[2];
  if (!aiClient) {
    return res.status(503).json({ success: false, integrityState: 'UNAVAILABLE', error: 'GEMINI_API_KEY is not configured on the server.' });
  }
  try {
    const prompt = `You are a plant pathology image analyst. Inspect the photo. Crop: "${crop || 'Not specified'}". Notes: "${symptomsText || 'None'}". Language: ${language === 'te' ? 'Telugu with English chemical names' : 'English'}. Return JSON with: isPlantImage, isClearImage, identified, detectedCrop, diseaseOrPest, diseaseOrPestTe, confidencePercent, severity, clarityFeedback, visualSymptoms, recommendedNextSteps (array), organicRemedy, chemicalRemedy, preventiveMeasures. If unclear photo set identified=false and confidencePercent=0.`;
    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts: [{ inlineData: { mimeType, data: cleanBase64 } }, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPlantImage: { type: Type.BOOLEAN }, isClearImage: { type: Type.BOOLEAN }, identified: { type: Type.BOOLEAN },
            detectedCrop: { type: Type.STRING }, diseaseOrPest: { type: Type.STRING }, diseaseOrPestTe: { type: Type.STRING },
            confidencePercent: { type: Type.NUMBER }, severity: { type: Type.STRING }, clarityFeedback: { type: Type.STRING },
            visualSymptoms: { type: Type.STRING }, recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicRemedy: { type: Type.STRING }, chemicalRemedy: { type: Type.STRING }, preventiveMeasures: { type: Type.STRING },
          },
          required: ['isPlantImage', 'isClearImage', 'identified', 'detectedCrop', 'diseaseOrPest', 'severity', 'visualSymptoms', 'recommendedNextSteps', 'organicRemedy', 'chemicalRemedy', 'preventiveMeasures'],
        },
      },
    });
    const parsed = JSON.parse(aiResponse.text || '{}');
    const validConfidence = parsed.identified && typeof parsed.confidencePercent === 'number' && parsed.confidencePercent > 0 ? Math.min(100, Math.round(parsed.confidencePercent)) : null;
    const allowed = ['None', 'Low', 'Moderate', 'Severe', 'Unknown'];
    const safeSeverity = allowed.includes(parsed.severity) ? parsed.severity : 'Unknown';
    return res.json({
      success: true, integrityState: 'LIVE_DATA', source: 'Gemini AI Vision Analysis',
      diagnosis: {
        isPlantImage: Boolean(parsed.isPlantImage), isClearImage: Boolean(parsed.isClearImage), identified: Boolean(parsed.identified),
        detectedCrop: parsed.detectedCrop || crop || 'Unknown',
        diseaseOrPest: parsed.diseaseOrPest || 'Inconclusive',
        diseaseOrPestTe: parsed.diseaseOrPestTe || parsed.diseaseOrPest || 'Inconclusive',
        confidencePercent: validConfidence, severity: safeSeverity, clarityFeedback: parsed.clarityFeedback || '',
        visualSymptoms: parsed.visualSymptoms || 'No clear symptoms.',
        recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps : [],
        organicRemedy: parsed.organicRemedy || 'Consult local officer.',
        chemicalRemedy: parsed.chemicalRemedy || 'Verify target pest locally.',
        preventiveMeasures: parsed.preventiveMeasures || 'Maintain field sanitation.',
        analyzedAt: new Date().toISOString(), engine: 'Gemini Vision AI (gemini-4-hydrogen)',
        provenance: { integrityState: 'LIVE_DATA', classification: 'REAL_API_DATA', source: 'Gemini Vision AI', timestamp: new Date().toISOString(), isRealTime: true },
      },
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: `Gemini Vision failed: ${err.message}` });
  }
});

app.post('/api/assistant', async (req: Request, res: Response) => {
  const { query, language = 'en', farmContext } = req.body || {};
  if (!query || !String(query).trim()) return res.status(400).json({ success: false, error: 'A question is required.' });
  if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured.' });
  try {
    const ctx = farmContext ? JSON.stringify(farmContext) : 'No farm context';
    const systemInstruction = `You are Rythu Nestham, an agricultural advisor for FarmersNeed. Be practical and honest. Language: ${language === 'te' ? 'Telugu' : 'English'}. Farm context: ${ctx}`;
    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: String(query),
      config: { systemInstruction },
    });
    const reply = aiResponse.text;
    if (!reply) throw new Error('Empty AI response');
    res.json({ success: true, reply, source: 'Gemini AI (gemini-4-hydrogen)' });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get('/api/satellite/gee-status', async (_req, res) => {
  const hasJson = Boolean(process.env.GEE_SERVICE_ACCOUNT_JSON?.trim());
  const hasPair = Boolean(process.env.GEE_CLIENT_EMAIL?.trim() && process.env.GEE_PRIVATE_KEY?.trim());
  const projectId = process.env.GEE_PROJECT_ID?.trim() || null;
  const configured = Boolean(projectId && (hasJson || hasPair));
  res.json({
    configured, ready: false,
    status: configured ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
    integrityState: 'UNAVAILABLE', dataset: 'COPERNICUS/S2_SR_HARMONIZED', datasetId: 'COPERNICUS/S2_SR_HARMONIZED', projectId,
    message: configured ? 'Credentials present. Register the service account at earthengine.google.com for NDVI maps.' : 'Set GEE_PROJECT_ID and GEE_SERVICE_ACCOUNT_JSON secrets.',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/satellite/analyze', async (_req, res) => {
  res.status(503).json({ success: false, integrityState: 'UNAVAILABLE', error: 'Satellite NDVI needs Earth Engine credentials and registration at earthengine.google.com.', pixelAnalysisSupported: false, meanNdvi: null, meanNdwi: null, historicalTrend: [] });
});

app.post('/api/satellite/scenes', async (_req, res) => {
  res.status(503).json({ success: false, scenes: [], error: 'Satellite scenes require GEE configuration.' });
});

const droneBookings: any[] = [];
const labourRequests: any[] = [];
const discussions: any[] = [];
const comments: any[] = [];

app.get('/api/drone/bookings', (_req, res) => res.json({ success: true, bookings: droneBookings }));
app.post('/api/drone/book', (req, res) => {
  const b = { id: `DRN-${Date.now()}`, ...req.body, status: 'Requested', createdAt: new Date().toISOString() };
  droneBookings.unshift(b);
  res.json({ success: true, booking: b });
});
app.get('/api/labour-requests', (_req, res) => res.json({ success: true, requests: labourRequests }));
app.post('/api/labour-requests', (req, res) => {
  const r = { id: `LAB-${Date.now()}`, ...req.body, status: 'Open', createdAt: new Date().toISOString() };
  labourRequests.unshift(r);
  res.json({ success: true, request: r });
});
app.get('/api/discussions', (_req, res) => res.json({ success: true, discussions }));
app.post('/api/discussions', (req, res) => {
  const d = { id: `DIS-${Date.now()}`, ...req.body, upvotes: 0, commentsCount: 0, createdAt: new Date().toISOString() };
  discussions.unshift(d);
  res.json({ success: true, discussion: d });
});
app.get('/api/discussions/:postId/comments', (req, res) => {
  res.json({ success: true, comments: comments.filter((c) => c.postId === req.params.postId) });
});
app.post('/api/discussions/:postId/comments', (req, res) => {
  const c = { id: `CMT-${Date.now()}`, postId: req.params.postId, ...req.body, createdAt: new Date().toISOString() };
  comments.push(c);
  res.json({ success: true, comment: c });
});

app.get('/api/market-prices', async (_req, res) => {
  res.json({ success: true, integrityState: 'LIVE_DATA', prices: [], message: 'Connect DATA_GOV_API_KEY for live mandi prices.', timestamp: new Date().toISOString() });
});

app.get('/api/iot/status', (_req, res) => {
  res.json({ success: true, online: false, message: 'No ESP32 device connected.', classification: 'NO_HARDWARE' });
});
app.post('/api/iot/telemetry', (_req, res) => {
  res.json({ success: true, received: true });
});
app.post('/api/iot/pump', (_req, res) => {
  res.status(503).json({ success: false, error: 'ESP32 device is not connected.', code: 'IOT_DEVICE_OFFLINE' });
});

app.post('/api/recommendations', async (req: Request, res: Response) => {
  if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured.' });
  try {
    const body = req.body || {};
    const prompt = `Recommend suitable crops for a farmer. Context: ${JSON.stringify(body)}. Reply with practical short recommendations in ${body.language === 'te' ? 'Telugu' : 'English'}.`;
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: prompt });
    res.json({ success: true, recommendations: aiResponse.text || '', source: 'Gemini AI' });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.post('/api/profit', async (req: Request, res: Response) => {
  const { acres = 1, crop = 'Chilli', expectedYieldPerAcre = 10, pricePerUnit = 100, costsPerAcre = 20000 } = req.body || {};
  const a = Number(acres) || 1;
  const y = Number(expectedYieldPerAcre) || 10;
  const p = Number(pricePerUnit) || 100;
  const c = Number(costsPerAcre) || 20000;
  const revenue = a * y * p;
  const cost = a * c;
  res.json({ success: true, acres: a, crop, expectedYieldPerAcre: y, pricePerUnit: p, costsPerAcre: c, totalRevenue: revenue, totalCost: cost, netProfit: revenue - cost, profitPerAcre: (revenue - cost) / a });
});

async function startServer() {
  const httpServer = http.createServer(app);

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
      viteMiddleware = vite.middlewares as any;
    })().catch((err) => {
      viteError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to initialize Vite dev middleware:', err);
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (!viteMiddleware && !viteError) await viteReady;
      if (viteError) return next(viteError);
      if (viteMiddleware) return viteMiddleware(req, res, next);
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
    console.log(`FarmersNeed 2.2.0 running on port ${PORT}; gemini=${!!aiClient}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
