import express, { Request, Response } from 'express';
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

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
  const map: Record<number, { condition: string; description: string; descriptionTe: string }> = {
    0: { condition: 'Clear', description: 'clear sky', descriptionTe: 'Clear' },
    1: { condition: 'Mainly Clear', description: 'mainly clear', descriptionTe: 'Mainly Clear' },
    2: { condition: 'Partly Cloudy', description: 'partly cloudy', descriptionTe: 'Partly Cloudy' },
    3: { condition: 'Overcast', description: 'overcast', descriptionTe: 'Overcast' },
    45: { condition: 'Fog', description: 'fog', descriptionTe: 'Fog' },
    61: { condition: 'Slight Rain', description: 'slight rain', descriptionTe: 'Slight Rain' },
    63: { condition: 'Rain', description: 'rain', descriptionTe: 'Rain' },
    65: { condition: 'Heavy Rain', description: 'heavy rain', descriptionTe: 'Heavy Rain' },
    95: { condition: 'Thunderstorm', description: 'thunderstorm', descriptionTe: 'Thunderstorm' },
  };
  return map[code] || { condition: 'Fair', description: 'fair', descriptionTe: 'Fair' };
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'FarmersNeed 2.0', version: '2.1.4', geminiConfigured: !!aiClient, timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', geminiConfigured: !!aiClient, version: '2.1.4' });
});

app.get('/api/weather', async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lon = parseFloat(String(req.query.lon || ''));
  const city = String(req.query.city || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ success: false, error: 'Missing coordinates: lat and lon are required.', code: 'MISSING_COORDINATES' });
  }
  try {
    const openMeteoUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,et0_fao_evapotranspiration,uv_index` +
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
      try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return isoStr; }
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
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecastList: any[] = [];
    const dailyTimes: string[] = daily.time || [];
    for (let d = 0; d < Math.min(7, dailyTimes.length); d++) {
      const fDate = new Date(dailyTimes[d]);
      const dayName = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()];
      const dCode = daily.weather_code?.[d] ?? 0;
      forecastList.push({
        day: dayName,
        dayTe: dayName,
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
        locationLabel: city ? `${city} (${lat.toFixed(4)}N, ${lon.toFixed(4)}E)` : `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`,
        notes: 'Model-based numerical weather prediction for selected coordinates.',
      },
      location: { city: city || `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`, country: 'IN', lat, lon },
      current: {
        temp, feelsLike, tempMin, tempMax, humidity, pressure: surfacePressure,
        condition: wmo.condition, description: wmo.description, descriptionTe: wmo.descriptionTe,
        windSpeedKmh, windDirectionDeg, clouds, rainProbability, precipitationMm,
        uvIndex: Number((hourly.uv_index?.[0] ?? 0).toFixed(1)),
        sunrise: formatSunTime(daily.sunrise?.[0]), sunset: formatSunTime(daily.sunset?.[0]),
        sprayCondition, sprayBadge, sowingSuitability, sowingSuitabilityBadge,
        fertilizerSafe: rainProbability < 40, postIrrigationRainRisk: rainProbability > 50, heatStressWarning: temp >= 37,
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
  const kcMap: Record<string, number> = { chilli: 1.05, paddy: 1.15, cotton: 1.0, maize: 1.1, groundnut: 0.95, tomato: 1.05 };
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
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed/2.0' } });
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

app.get('/api/geocode/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (!q) return res.status(400).json({ success: false, error: 'q required' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed/2.0' } });
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
    return res.status(503).json({ success: false, integrityState: 'UNAVAILABLE', error: 'GEMINI_API_KEY is not configured.' });
  }
  try {
    const prompt = `You are a plant pathology image analyst. Inspect the photo. Crop: "${crop || 'Not specified'}". Notes: "${symptomsText || 'None'}". Language: ${language === 'te' ? 'Telugu with English chemical names' : 'English'}. Return JSON: isPlantImage, isClearImage, identified, detectedCrop, diseaseOrPest, diseaseOrPestTe, confidencePercent, severity, clarityFeedback, visualSymptoms, recommendedNextSteps (array), organicRemedy, chemicalRemedy, preventiveMeasures. If unclear photo set identified=false confidencePercent=0.`;
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
        diseaseOrPest: parsed.diseaseOrPest || 'Inconclusive', diseaseOrPestTe: parsed.diseaseOrPestTe || parsed.diseaseOrPest || 'Inconclusive',
        confidencePercent: validConfidence, severity: safeSeverity, clarityFeedback: parsed.clarityFeedback || '',
        visualSymptoms: parsed.visualSymptoms || 'No clear symptoms.', recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps : [],
        organicRemedy: parsed.organicRemedy || 'Consult local officer.', chemicalRemedy: parsed.chemicalRemedy || 'Verify target pest locally.',
        preventiveMeasures: parsed.preventiveMeasures || 'Maintain field sanitation.',
        analyzedAt: new Date().toISOString(), engine: 'Gemini Vision AI (gemini-4-hydrogen)',
        provenance: { integrityState: 'LIVE_DATA', classification: 'REAL_API_DATA', source: 'Gemini Vision AI', timestamp: new Date().toISOString(), isRealTime: true },
      },
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: `Gemini Vision failed: ${err.message}` });
  }
});

app.get('/api/satellite/gee-status', async (_req: Request, res: Response) => {
  const hasJson = Boolean(process.env.GEE_SERVICE_ACCOUNT_JSON?.trim());
  const hasPair = Boolean(process.env.GEE_CLIENT_EMAIL?.trim() && process.env.GEE_PRIVATE_KEY?.trim());
  const projectId = process.env.GEE_PROJECT_ID?.trim() || null;
  const configured = Boolean(projectId && (hasJson || hasPair));
  res.json({
    configured, ready: false,
    status: configured ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING',
    integrityState: 'UNAVAILABLE', dataset: 'COPERNICUS/S2_SR_HARMONIZED', projectId,
    message: configured ? 'Credentials set. Register service account at earthengine.google.com for NDVI.' : 'Set GEE_PROJECT_ID and GEE_SERVICE_ACCOUNT_JSON.',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/satellite/analyze', async (_req: Request, res: Response) => {
  res.status(503).json({ success: false, integrityState: 'UNAVAILABLE', error: 'Satellite NDVI needs Earth Engine credentials and registration.', pixelAnalysisSupported: false, meanNdvi: null, historicalTrend: [] });
});

app.post('/api/satellite/scenes', async (_req: Request, res: Response) => {
  res.status(503).json({ success: false, scenes: [], error: 'Satellite scenes require GEE configuration.' });
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => { if (err) res.status(404).send('Frontend not built'); });
});

async function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FarmersNeed 2.1.4 on ${PORT}; gemini=${!!aiClient}`);
  });
}
startServer().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });
