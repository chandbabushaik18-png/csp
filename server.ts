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
    case 80: case 81: case 82: return { condition: 'Rain Showers', description: 'rain showers', descriptionTe: 'Rain Showers' };
    case 95: return { condition: 'Thunderstorm', description: 'thunderstorm', descriptionTe: 'Thunderstorm' };
    default: return { condition: 'Unknown', description: 'unknown', descriptionTe: 'Unknown' };
  }
}

app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat) || 17.385;
    const lon = Number(req.query.lon) || 78.4867;
    const city = String(req.query.city || '');
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,et0_fao_evapotranspiration,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration&timezone=auto`;
    const response = await fetch(openMeteoUrl);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
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
    const precipitationMm = Number((current.precipitation ?? current.rain ?? 0).toFixed(1));
    const rainProbability = Math.round(hourly.precipitation_probability?.[0] ?? 0);
    const wmo = interpretWmoCode(current.weather_code ?? 0);
    const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? temp);
    const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? temp);
    const formatSunTime = (isoStr?: string) => {
      if (!isoStr) return '--:--';
      try {
        return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '--:--';
      }
    };
    const rawSunrise = daily.sunrise?.[0];
    const rawSunset = daily.sunset?.[0];
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
    } else if (temp > 34 || rainProbability > 40) {
      sowingSuitability = 'Moderate - Monitor Soil Moisture';
      sowingSuitabilityBadge = 'moderate';
    }
    const fertilizerSafe = rainProbability < 40;
    const postIrrigationRainRisk = rainProbability >= 50;
    const heatStressWarning = temp >= 37;
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
    res.json({
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
        notes: 'Model-based numerical weather prediction for selected coordinates — not a direct physical weather-station measurement.',
        methodology: 'Global NWP assimilation at ~0.1 resolution.',
      },
      location: {
        city: city || `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`,
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
      error: err.message || 'Weather forecast unavailable',
      code: 'WEATHER_SERVICE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon are required' });
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'FarmersNeed-PrecisionAgri/2.0' } });
    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      return res.json({
        success: true,
        displayName: data.display_name,
        village: addr.village || addr.suburb || addr.town || addr.hamlet || '',
        mandal: addr.county || addr.subdistrict || '',
        district: addr.state_district || addr.district || '',
        state: addr.state || '',
        country: addr.country || 'India',
        postcode: addr.postcode || '',
        lat: Number(lat),
        lon: Number(lon),
      });
    }
    throw new Error(`Nominatim ${resp.status}`);
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get('/api/geocode', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.query || '');
    if (!q) return res.status(400).json({ success: false, error: 'q required' });
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    const results = (data.results || []).map((r: any) => ({
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      lat: r.latitude,
      lon: r.longitude,
      display: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}`,
    }));
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/water-advisory', async (req: Request, res: Response) => {
  try {
    const {
      crop = 'Chilli',
      cropStage = 'Mid-Season (Flowering/Fruiting)',
      soilType = 'Black Cotton Soil',
      irrigationMethod = 'Drip',
      areaAcres = 3,
      lat,
      lon,
      pumpFlowRateLph = 30000,
      soilMoisturePercent,
    } = req.body || {};
    const acres = Math.max(0.1, Number(areaAcres) || 1);
    const parsedLat = Number(lat) || 17.385;
    const parsedLon = Number(lon) || 78.4867;
    const pumpRate = Number(pumpFlowRateLph) || 30000;
    const parsedMoisture = soilMoisturePercent !== undefined && soilMoisturePercent !== null ? Number(soilMoisturePercent) : undefined;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLon}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const daily = data.daily || {};
    const realEt0 = Number((daily.et0_fao_evapotranspiration?.[0] ?? 4.5).toFixed(2));

    const kcMap: Record<string, number> = {
      rice: 1.2, paddy: 1.2, wheat: 1.15, cotton: 1.15, maize: 1.2, corn: 1.2,
      sugarcane: 1.25, chilli: 1.05, chili: 1.05, tomato: 1.15, groundnut: 1.0,
      soybean: 1.15, onion: 1.0, default: 1.1,
    };
    const cropKey = String(crop).toLowerCase().split(' ')[0];
    let kc = kcMap[cropKey] || kcMap.default;
    const stage = String(cropStage).toLowerCase();
    if (stage.includes('initial') || stage.includes('seedling')) kc *= 0.7;
    else if (stage.includes('development') || stage.includes('vegetative')) kc *= 0.9;
    else if (stage.includes('late') || stage.includes('maturity') || stage.includes('harvest')) kc *= 0.8;
    kc = Number(kc.toFixed(2));

    const etc_mm = Number((kc * realEt0).toFixed(2));
    const todayRain = Number((daily.precipitation_sum?.[0] ?? 0).toFixed(2));
    let effectiveRain_mm = 0;
    if (todayRain > 0) {
      effectiveRain_mm = Number(Math.min(todayRain * 0.8, etc_mm).toFixed(2));
    }
    const baseNetWaterNeed_mm = Math.max(0, etc_mm - effectiveRain_mm);

    let soilMoistureAdjustmentFactor = 1;
    if (parsedMoisture !== undefined && Number.isFinite(parsedMoisture)) {
      if (parsedMoisture >= 75) soilMoistureAdjustmentFactor = 0.3;
      else if (parsedMoisture >= 55) soilMoistureAdjustmentFactor = 0.6;
      else if (parsedMoisture >= 40) soilMoistureAdjustmentFactor = 0.85;
      else if (parsedMoisture < 25) soilMoistureAdjustmentFactor = 1.25;
    }
    const netWaterNeed_mm = Number((baseNetWaterNeed_mm * soilMoistureAdjustmentFactor).toFixed(2));

    const method = String(irrigationMethod).toLowerCase();
    let efficiency = 0.7;
    if (method.includes('drip')) efficiency = 0.9;
    else if (method.includes('sprinkler')) efficiency = 0.75;
    else if (method.includes('flood') || method.includes('furrow')) efficiency = 0.55;

    const grossWaterNeed_mm = Number((netWaterNeed_mm / efficiency).toFixed(2));
    const LITERS_PER_MM_ACRE = 4046.86;
    const dailyLitersPerAcre = Math.round(grossWaterNeed_mm * LITERS_PER_MM_ACRE);
    const totalDailyLitersFarm = Math.round(dailyLitersPerAcre * acres);
    const weeklyLitersFarm = totalDailyLitersFarm * 7;
    const pumpingHoursDaily = Math.max(0.3, Math.round((totalDailyLitersFarm / pumpRate) * 10) / 10);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySchedule = (daily.time || []).slice(0, 7).map((t: string, idx: number) => {
      const fDate = new Date(t);
      const rainMm = Number((daily.precipitation_sum?.[idx] ?? 0).toFixed(1));
      const isRainy = rainMm >= 4;
      const waterMm = isRainy ? 0 : grossWaterNeed_mm;
      return {
        day: idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dayNames[fDate.getDay()],
        dayTe: idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dayNames[fDate.getDay()],
        date: fDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        waterMm: Number(waterMm.toFixed(2)),
        litersPerAcre: Math.round(waterMm * LITERS_PER_MM_ACRE),
        action: isRainy ? 'Skip - Rain expected' : waterMm > 0 ? 'Irrigate' : 'No irrigation',
        actionTe: isRainy ? 'Skip - Rain expected' : waterMm > 0 ? 'Irrigate' : 'No irrigation',
        rainMm,
      };
    });

    const recommendationText = `Your farmland (${acres} acres of ${crop} in ${cropStage}) requires ${grossWaterNeed_mm} mm gross depth (${dailyLitersPerAcre.toLocaleString('en-IN')} Litres/acre) daily under real ET0 of ${realEt0} mm/day. With ${irrigationMethod} (${Math.round(efficiency * 100)}% efficiency), run your pump for approximately ${pumpingHoursDaily} hours in the early morning to minimize solar evaporation.`;
    const recommendationTextTe = `మీ ${acres} ఎకరాల ${crop} పంటకు (${cropStage}) రోజువారీ ET0 ${realEt0} మి.మీ ప్రకారం ${grossWaterNeed_mm} మి.మీ (${dailyLitersPerAcre.toLocaleString('en-IN')} లీటర్లు/ఎకరాకు) నీరు అవసరం. ${irrigationMethod} పద్ధతిలో మీ మోటారును ఉదయం వేళ ${pumpingHoursDaily} గంటలు నడపండి.`;

    res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      crop: String(crop),
      cropStage: String(cropStage),
      soilType: String(soilType),
      irrigationMethod: String(irrigationMethod),
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
        source: 'Open-Meteo ET0 + FAO-56 + USDA-SCS',
        timestamp: new Date().toISOString(),
        isRealTime: false,
        isModelEstimate: true,
        locationLabel: `${parsedLat.toFixed(4)}N, ${parsedLon.toFixed(4)}E`,
        methodology: 'ETc = Kc * ET0; Net = max(0, ETc - Peff); Gross = Net / Efficiency; 1 mm/acre = 4,046.86 Liters.',
      },
      weeklySchedule,
    });
  } catch (err: any) {
    console.error('Water advisory error:', err);
    res.status(500).json({ success: false, error: err.message || 'Water advisory failed' });
  }
});

app.get('/api/satellite/gee-status', async (_req, res) => {
  res.json({
    success: true,
    configured: !!(process.env.GEE_SERVICE_ACCOUNT_JSON || process.env.GEE_PRIVATE_KEY),
    message: 'Set GEE credentials and register at https://signup.earthengine.google.com/',
  });
});
app.post('/api/satellite/analyze', async (_req, res) => {
  res.json({ success: false, integrityState: 'UNAVAILABLE', error: 'Earth Engine credentials not configured' });
});
app.post('/api/satellite/scenes', async (_req, res) => {
  res.json({ success: true, scenes: [], message: 'GEE not configured' });
});

const droneBookings: any[] = [];
const labourRequests: any[] = [];
const discussions: any[] = [];
app.get('/api/drone/bookings', (_req, res) => res.json({ success: true, bookings: droneBookings }));
app.post('/api/drone/book', (req, res) => {
  const b = { id: Date.now().toString(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
  droneBookings.push(b);
  res.json({ success: true, booking: b });
});
app.get('/api/labour-requests', (_req, res) => res.json({ success: true, requests: labourRequests }));
app.post('/api/labour-requests', (req, res) => {
  const r = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  labourRequests.push(r);
  res.json({ success: true, request: r });
});
app.get('/api/discussions', (_req, res) => res.json({ success: true, discussions }));
app.post('/api/discussions', (req, res) => {
  const d = { id: Date.now().toString(), ...req.body, comments: [], createdAt: new Date().toISOString() };
  discussions.push(d);
  res.json({ success: true, discussion: d });
});
app.get('/api/discussions/:postId/comments', (req, res) => {
  const d = discussions.find((x) => x.id === req.params.postId);
  res.json({ success: true, comments: d?.comments || [] });
});
app.post('/api/discussions/:postId/comments', (req, res) => {
  const d = discussions.find((x) => x.id === req.params.postId);
  if (!d) return res.status(404).json({ success: false });
  const c = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  d.comments = d.comments || [];
  d.comments.push(c);
  res.json({ success: true, comment: c });
});

app.get('/api/market-prices', async (_req, res) => {
  res.json({ success: true, prices: [{ crop: 'Rice', market: 'Hyderabad', price: 2200, unit: 'quintal' }, { crop: 'Cotton', market: 'Warangal', price: 6500, unit: 'quintal' }], source: 'stub' });
});
app.get('/api/iot/status', (_req, res) => {
  res.json({ success: true, connected: false, devices: [], latestTelemetry: null, message: 'IoT stub' });
});
app.post('/api/iot/telemetry', (_req, res) => res.json({ success: true }));
app.post('/api/iot/pump', (_req, res) => res.json({ success: true, status: 'ok' }));

app.post('/api/crop-doctor', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    const { imageBase64, mimeType, crop, symptoms, language } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 required' });
    const prompt = `You are an expert agricultural pathologist. Analyze this crop leaf/plant image. Crop: ${crop || 'unknown'}. Symptoms: ${symptoms || 'none'}. Respond in ${language || 'English'}. Give diagnosis, confidence, treatment, prevention.`;
    const parts: any[] = [{ text: prompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: String(imageBase64).replace(/^data:[^;]+;base64,/, '') } }];
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: [{ role: 'user', parts }] });
    res.json({ success: true, diagnosis: aiResponse.text || 'Unable to analyze.', analyzedAt: new Date().toISOString(), engine: 'Gemini Vision AI (gemini-4-hydrogen)' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Analysis failed' });
  }
});

app.post('/api/assistant', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    const { message, language, context } = req.body || {};
    const prompt = `You are FarmersNeed AI for Indian farmers. Reply in ${language || 'English'}. Context: ${JSON.stringify(context || {})}. User: ${message}`;
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: prompt });
    res.json({ success: true, reply: aiResponse.text || 'Sorry, could not process that.', source: 'Gemini AI (gemini-4-hydrogen)' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/recommendations', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.json({ success: true, recommendations: ['Ensure soil moisture', 'Monitor for pests'], source: 'fallback' });
    const prompt = `Give 3 short practical farming recommendations for: ${JSON.stringify(req.body)}`;
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: prompt });
    res.json({ success: true, recommendations: (aiResponse.text || '').split('\n').filter(Boolean).slice(0, 5), source: 'gemini-4-hydrogen' });
  } catch {
    res.json({ success: true, recommendations: ['Check weather before spraying'], source: 'fallback' });
  }
});

app.post('/api/profit', async (req: Request, res: Response) => {
  const { acres, crop, expectedYieldPerAcre, pricePerUnit, costsPerAcre } = req.body || {};
  const a = Number(acres) || 1;
  const y = Number(expectedYieldPerAcre) || 20;
  const p = Number(pricePerUnit) || 100;
  const c = Number(costsPerAcre) || 20000;
  const revenue = a * y * p;
  const cost = a * c;
  res.json({ success: true, acres: a, crop, expectedYieldPerAcre: y, pricePerUnit: p, costsPerAcre: c, totalRevenue: revenue, totalCost: cost, netProfit: revenue - cost, profitPerAcre: (revenue - cost) / a });
});

async function startServer() {
  const httpServer = http.createServer(app);
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ success: false, integrityState: 'UNAVAILABLE', error: `API route not found: ${req.method} ${req.originalUrl}` });
  });
  if (process.env.NODE_ENV !== 'production') {
    let viteMiddleware: ((req: Request, res: Response, next: NextFunction) => void) | null = null;
    let viteError: Error | null = null;
    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const disableHmr = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: disableHmr ? false : { server: httpServer }, ws: disableHmr ? false : undefined, watch: disableHmr ? null : {} },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares as any;
    })().catch((err) => {
      viteError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to initialize Vite:', err);
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
