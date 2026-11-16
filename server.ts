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
  aiClient = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
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

app.get('/api/health', (_req, res) => {
  res.json({ success: true, ok: true, service: 'FarmersNeed', version: '2.2.0', gemini: !!aiClient, time: new Date().toISOString() });
});

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
    const formatSunTime = (isoStr?: string) => { if (!isoStr) return '--:--'; try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return '--:--'; } };
    let sprayCondition = 'Ideal for Spraying';
    let sprayBadge: 'ideal' | 'moderate' | 'poor' = 'ideal';
    if (windSpeedKmh > 15 || temp > 35 || rainProbability > 40) { sprayCondition = 'Not Recommended - High Drift/Rain Risk'; sprayBadge = 'poor'; }
    else if (windSpeedKmh > 10 || humidity > 85 || temp > 32) { sprayCondition = 'Moderate - Low Wind Window Advised'; sprayBadge = 'moderate'; }
    let sowingSuitability = 'Optimal Soil Moisture & Temperature';
    let sowingSuitabilityBadge: 'favorable' | 'moderate' | 'unfavorable' = 'favorable';
    if (temp > 38 || rainProbability > 65) { sowingSuitability = 'Delay Sowing: Excessive Heat or Flood Hazard'; sowingSuitabilityBadge = 'unfavorable'; }
    else if (temp > 34 || rainProbability > 40) { sowingSuitability = 'Moderate - Monitor Soil Moisture'; sowingSuitabilityBadge = 'moderate'; }
    const hourlyTimes: string[] = hourly.time || [];
    const hourlyList: any[] = [];
    const nowEpoch = Date.now();
    for (let i = 0; i < hourlyTimes.length && hourlyList.length < 24; i++) {
      const hDate = new Date(hourlyTimes[i]);
      if (hDate.getTime() >= nowEpoch - 3600000) {
        hourlyList.push({ time: hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), temp: Math.round(hourly.temperature_2m?.[i] ?? 0), condition: interpretWmoCode(hourly.weather_code?.[i] ?? 0).condition, rainChance: Math.round(hourly.precipitation_probability?.[i] ?? 0), windSpeedKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 0), humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? 0), et0_mm: Number((hourly.et0_fao_evapotranspiration?.[i] ?? 0).toFixed(2)) });
      }
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecastList: any[] = [];
    const dailyTimes: string[] = daily.time || [];
    for (let d = 0; d < Math.min(7, dailyTimes.length); d++) {
      const fDate = new Date(dailyTimes[d]);
      forecastList.push({ day: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()], dayTe: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayNames[fDate.getDay()], date: fDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), tempMax: Math.round(daily.temperature_2m_max?.[d] ?? 0), tempMin: Math.round(daily.temperature_2m_min?.[d] ?? 0), condition: interpretWmoCode(daily.weather_code?.[d] ?? 0).condition, rainChance: Math.round(daily.precipitation_probability_max?.[d] ?? 0), rainfallMm: Number((daily.precipitation_sum?.[d] ?? 0).toFixed(1)), windSpeedKmh: Math.round(daily.wind_speed_10m_max?.[d] ?? 0), et0_mm: Number((daily.et0_fao_evapotranspiration?.[d] ?? 0).toFixed(2)) });
    }
    res.json({ success: true, integrityState: 'LIVE_DATA', source: 'Open-Meteo Model-Based NWP Forecast (ECMWF & NOAA GFS)', lastUpdated: new Date().toISOString(), generationTimeMs: data.generationtime_ms, elevationMeters: data.elevation, provenance: { integrityState: 'LIVE_DATA', classification: 'REAL_API_DATA', source: 'Open-Meteo NWP Forecast Model', timestamp: new Date().toISOString(), isRealTime: false, isModelEstimate: true, locationLabel: `${lat.toFixed(4)}N, ${lon.toFixed(4)}E` }, location: { city: city || `${lat.toFixed(4)}N, ${lon.toFixed(4)}E`, country: 'IN', lat, lon }, current: { temp, feelsLike, tempMin, tempMax, humidity, pressure: surfacePressure, condition: wmo.condition, description: wmo.description, descriptionTe: wmo.descriptionTe, windSpeedKmh, windDirectionDeg, clouds, rainProbability, precipitationMm, uvIndex: Number((hourly.uv_index?.[0] ?? 0).toFixed(1)), sunrise: formatSunTime(daily.sunrise?.[0]), sunset: formatSunTime(daily.sunset?.[0]), sprayCondition, sprayBadge, sowingSuitability, sowingSuitabilityBadge, fertilizerSafe: rainProbability < 40, postIrrigationRainRisk: rainProbability >= 50, heatStressWarning: temp >= 37 }, hourly: hourlyList, forecast: forecastList });
  } catch (err: any) {
    return res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: err.message || 'Weather unavailable' });
  }
});

app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon required' });
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`, { headers: { 'User-Agent': 'FarmersNeed/2.0' } });
    if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
    const data = await resp.json();
    const addr = data.address || {};
    res.json({ success: true, displayName: data.display_name, village: addr.village || addr.suburb || addr.town || '', mandal: addr.county || '', district: addr.state_district || addr.district || '', state: addr.state || '', country: addr.country || 'India', lat: Number(lat), lon: Number(lon) });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get('/api/geocode', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.query || '');
    if (!q) return res.status(400).json({ success: false, error: 'q required' });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
    const data = await response.json();
    res.json({ success: true, results: (data.results || []).map((r: any) => ({ name: r.name, country: r.country, admin1: r.admin1, lat: r.latitude, lon: r.longitude, display: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}` })) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/water-advisory', async (req: Request, res: Response) => {
  try {
    const { crop = 'Chilli', cropStage = 'Mid-Season', soilType = 'Black Cotton Soil', irrigationMethod = 'Drip', areaAcres = 3, lat, lon, pumpFlowRateLph = 30000, soilMoisturePercent } = req.body || {};
    const acres = Math.max(0.1, Number(areaAcres) || 1);
    const parsedLat = Number(lat) || 17.385;
    const parsedLon = Number(lon) || 78.4867;
    const pumpRate = Number(pumpFlowRateLph) || 30000;
    const parsedMoisture = soilMoisturePercent != null ? Number(soilMoisturePercent) : undefined;
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLon}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=auto&forecast_days=7`);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const daily = data.daily || {};
    const realEt0 = Number((daily.et0_fao_evapotranspiration?.[0] ?? 4.5).toFixed(2));
    const kcMap: Record<string, number> = { rice: 1.2, wheat: 1.15, cotton: 1.15, maize: 1.2, chilli: 1.05, chili: 1.05, tomato: 1.15, default: 1.1 };
    let kc = kcMap[String(crop).toLowerCase().split(' ')[0]] || kcMap.default;
    const stage = String(cropStage).toLowerCase();
    if (stage.includes('initial') || stage.includes('seedling')) kc *= 0.7;
    else if (stage.includes('late') || stage.includes('maturity')) kc *= 0.8;
    kc = Number(kc.toFixed(2));
    const etc_mm = Number((kc * realEt0).toFixed(2));
    const todayRain = Number((daily.precipitation_sum?.[0] ?? 0).toFixed(2));
    const effectiveRain_mm = todayRain > 0 ? Number(Math.min(todayRain * 0.8, etc_mm).toFixed(2)) : 0;
    let soilMoistureAdjustmentFactor = 1;
    if (parsedMoisture != null && Number.isFinite(parsedMoisture)) {
      if (parsedMoisture >= 75) soilMoistureAdjustmentFactor = 0.3;
      else if (parsedMoisture >= 55) soilMoistureAdjustmentFactor = 0.6;
      else if (parsedMoisture < 25) soilMoistureAdjustmentFactor = 1.25;
    }
    const netWaterNeed_mm = Number((Math.max(0, etc_mm - effectiveRain_mm) * soilMoistureAdjustmentFactor).toFixed(2));
    const method = String(irrigationMethod).toLowerCase();
    let efficiency = 0.7;
    if (method.includes('drip')) efficiency = 0.9;
    else if (method.includes('sprinkler')) efficiency = 0.75;
    else if (method.includes('flood')) efficiency = 0.55;
    const grossWaterNeed_mm = Number((netWaterNeed_mm / efficiency).toFixed(2));
    const LITERS = 4046.86;
    const dailyLitersPerAcre = Math.round(grossWaterNeed_mm * LITERS);
    const totalDailyLitersFarm = Math.round(dailyLitersPerAcre * acres);
    const weeklyLitersFarm = totalDailyLitersFarm * 7;
    const pumpingHoursDaily = Math.max(0.3, Math.round((totalDailyLitersFarm / pumpRate) * 10) / 10);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySchedule = (daily.time || []).slice(0, 7).map((t: string, idx: number) => {
      const fDate = new Date(t);
      const rainMm = Number((daily.precipitation_sum?.[idx] ?? 0).toFixed(1));
      const isRainy = rainMm >= 4;
      const waterMm = isRainy ? 0 : grossWaterNeed_mm;
      return { day: idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dayNames[fDate.getDay()], dayTe: idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dayNames[fDate.getDay()], date: fDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), waterMm: Number(waterMm.toFixed(2)), litersPerAcre: Math.round(waterMm * LITERS), action: isRainy ? 'Skip - Rain expected' : waterMm > 0 ? 'Irrigate' : 'No irrigation', actionTe: isRainy ? 'Skip - Rain expected' : waterMm > 0 ? 'Irrigate' : 'No irrigation', rainMm };
    });
    res.json({ success: true, integrityState: 'LIVE_DATA', crop: String(crop), cropStage: String(cropStage), soilType: String(soilType), irrigationMethod: String(irrigationMethod), areaAcres: acres, et0_mm: realEt0, kc, etc_mm, effectiveRain_mm, netWaterNeed_mm, grossWaterNeed_mm, dailyLitersPerAcre, totalDailyLitersFarm, weeklyLitersFarm, pumpingHoursDaily, pumpFlowRateLph: pumpRate, nextIrrigationDate: parsedMoisture != null && parsedMoisture >= 75 ? 'In 48 Hours (Soil Saturated)' : 'Tomorrow Morning (06:30 AM)', bestTimeOfDay: 'Early Morning (06:00 AM - 08:30 AM)', irrigationEfficiencyPercent: Math.round(efficiency * 100), soilMoisturePercentUsed: parsedMoisture, soilMoistureAdjustmentFactor, recommendationText: `Your farmland (${acres} acres of ${crop}) needs ${grossWaterNeed_mm} mm (${dailyLitersPerAcre.toLocaleString('en-IN')} L/acre) daily. Run pump ~${pumpingHoursDaily}h in early morning.`, recommendationTextTe: `మీ ${acres} ఎకరాల ${crop} పంటకు రోజుకు ${grossWaterNeed_mm} మి.మీ నీరు అవసరం.`, waterSavingTips: ['Irrigate before 08:30 AM', 'Skip irrigation if rain >= 4 mm', 'Use mulch to conserve moisture'], provenance: { integrityState: 'LIVE_DATA', classification: 'CALCULATED_DATA', source: 'Open-Meteo ET0 + FAO-56', timestamp: new Date().toISOString(), isRealTime: false, isModelEstimate: true, locationLabel: `${parsedLat.toFixed(4)}N, ${parsedLon.toFixed(4)}E` }, weeklySchedule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Water advisory failed' });
  }
});

app.get('/api/satellite/gee-status', async (_req, res) => {
  const configured = !!(process.env.GEE_SERVICE_ACCOUNT_JSON || (process.env.GEE_CLIENT_EMAIL && process.env.GEE_PRIVATE_KEY));
  res.json({ success: true, configured, status: configured ? 'READY' : 'CREDENTIALS_MISSING', message: configured ? 'GEE credentials present.' : 'Set GEE_SERVICE_ACCOUNT_JSON and register at signup.earthengine.google.com for NDVI.', projectId: process.env.GEE_PROJECT_ID || null });
});

app.post('/api/satellite/scenes', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const center = body.center || [Number(body.lat) || 16.3067, Number(body.lon || body.lng) || 80.4365];
    const lat = Number(center[0]), lon = Number(center[1]);
    const d = 0.05;
    const bbox = [lon - d, lat - d, lon + d, lat + d];
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 60);
    const startDate = (body.startDate || start.toISOString().slice(0, 10));
    const endDate = (body.endDate || end.toISOString().slice(0, 10));
    const maxCloudCover = Math.min(100, Number(body.maxCloudCover) || 80);
    const stacResp = await fetch('https://earth-search.aws.element84.com/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['sentinel-2-c1-l2a'], bbox, datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`, limit: 12, sortby: [{ field: 'properties.datetime', direction: 'desc' }], query: { 'eo:cloud_cover': { lt: maxCloudCover } } }) });
    if (!stacResp.ok) throw new Error(`STAC ${stacResp.status}`);
    const stacData = await stacResp.json();
    const scenes = (stacData.features || []).map((f: any) => {
      const p = f.properties || {};
      return { id: f.id, platform: 'Sentinel-2', constellation: 'Copernicus Sentinel-2', acquisitionDate: p.datetime ? new Date(p.datetime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Unknown', processedDate: p.created || new Date().toISOString(), cloudCoveragePercent: Number((p['eo:cloud_cover'] ?? 0).toFixed(1)), sunElevationDeg: p['view:sun_elevation'] ?? null, sunAzimuthDeg: p['view:sun_azimuth'] ?? null, tileId: p['s2:tile_id'] || p['grid:code'] || 'Unknown', utmZone: 'WGS84', bandsAvailable: ['B02', 'B03', 'B04', 'B08'], previewUrl: f.assets?.thumbnail?.href || f.assets?.rendered_preview?.href || null };
    });
    res.json({ success: true, scenes, count: scenes.length, source: 'Copernicus Sentinel-2 L2A (AWS Earth-Search STAC)' });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message, scenes: [] });
  }
});

app.post('/api/satellite/analyze', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const farmId = String(body.farmId || 'farm');
    const center = body.center || [16.3067, 80.4365];
    const lat = Number(center[0]), lon = Number(center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, integrityState: 'UNAVAILABLE', error: 'Valid farm coordinates required', pixelAnalysisSupported: false, meanNdvi: null, meanNdwi: null });
    }
    const d = 0.05;
    const bbox = [lon - d, lat - d, lon + d, lat + d];
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 60);
    const startDate = String(body.startDate || start.toISOString().slice(0, 10));
    const endDate = String(body.endDate || end.toISOString().slice(0, 10));
    const maxCloudCover = Math.min(100, Number(body.maxCloudCover) || 80);
    const geeConfigured = !!(process.env.GEE_SERVICE_ACCOUNT_JSON || (process.env.GEE_CLIENT_EMAIL && process.env.GEE_PRIVATE_KEY));
    const stacResp = await fetch('https://earth-search.aws.element84.com/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['sentinel-2-c1-l2a'], bbox, datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`, limit: 10, sortby: [{ field: 'properties.datetime', direction: 'desc' }], query: { 'eo:cloud_cover': { lt: maxCloudCover } } }) });
    if (!stacResp.ok) throw new Error(`STAC ${stacResp.status}`);
    const stacData = await stacResp.json();
    const features = stacData.features || [];
    const formulas = { ndvi: 'NDVI = (B8 - B4) / (B8 + B4)', ndwi: 'NDWI = (B3 - B8) / (B3 + B8)', evi: 'EVI = 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1)', savi: 'SAVI = 1.5 * (B8 - B4) / (B8 + B4 + 0.5)' };
    const recentScenes = features.map((f: any) => {
      const p = f.properties || {};
      return { id: f.id, platform: 'Sentinel-2', constellation: 'Copernicus Sentinel-2', acquisitionDate: p.datetime ? new Date(p.datetime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Unknown', processedDate: p.created || new Date().toISOString(), cloudCoveragePercent: Number((p['eo:cloud_cover'] ?? 0).toFixed(1)), sunElevationDeg: p['view:sun_elevation'] ?? null, sunAzimuthDeg: p['view:sun_azimuth'] ?? null, tileId: p['s2:tile_id'] || p['grid:code'] || 'Unknown', utmZone: 'WGS84', bandsAvailable: ['B02', 'B03', 'B04', 'B08'], previewUrl: f.assets?.thumbnail?.href || f.assets?.rendered_preview?.href || null };
    });
    if (!features.length) {
      return res.json({ success: true, integrityState: 'NO_DATA', farmId, satelliteSource: 'Copernicus Sentinel-2 L2A (AWS Earth-Search STAC)', datasetId: 'COPERNICUS/S2_SR_HARMONIZED', geeConfigured, geeStatus: geeConfigured ? 'AUTH_OR_API_ERROR' : 'CREDENTIALS_MISSING', geometryUsed: 'center_buffer', dateRange: { startDate, endDate, maxCloudCover }, sceneId: null, platform: null, acquisitionDate: null, processedDate: null, cloudCoveragePercent: null, previewUrl: null, tileUrls: null, pixelAnalysisSupported: false, meanNdvi: null, meanNdwi: null, meanEvi: null, meanSavi: null, indexFormulas: formulas, message: `No Sentinel-2 scenes under ${maxCloudCover}% cloud.`, recommendation: 'Widen date range or increase max cloud cover.', recommendationTe: 'తేదీ పరిధిని పెంచండి.', provenance: { integrityState: 'NO_DATA', classification: 'REAL_API_DATA', source: 'AWS Earth-Search STAC', timestamp: new Date().toISOString(), isRealTime: false, locationLabel: `${lat.toFixed(4)}N, ${lon.toFixed(4)}E` }, recentScenes: [], historicalTrend: [] });
    }
    let selected = features[0];
    if (body.selectedSceneId) { const m = features.find((f: any) => f.id === body.selectedSceneId); if (m) selected = m; }
    const latest = recentScenes.find((s: any) => s.id === selected.id) || recentScenes[0];
    res.json({ success: true, integrityState: 'LIVE_DATA', farmId, satelliteSource: `Copernicus ${latest.platform} L2A (AWS Earth-Search STAC)`, datasetId: 'COPERNICUS/S2_SR_HARMONIZED', geeConfigured, geeStatus: geeConfigured ? 'READY' : 'CREDENTIALS_MISSING', geometryUsed: Array.isArray(body.polygon) && body.polygon.length >= 3 ? 'drawn_polygon' : 'center_buffer', dateRange: { startDate, endDate, maxCloudCover }, sceneId: latest.id, platform: latest.platform, acquisitionDate: latest.acquisitionDate, processedDate: latest.processedDate, cloudCoveragePercent: latest.cloudCoveragePercent, sunElevationDeg: latest.sunElevationDeg, previewUrl: latest.previewUrl, tileUrls: null, pixelAnalysisSupported: false, meanNdvi: null, meanNdwi: null, meanEvi: null, meanSavi: null, indexFormulas: formulas, healthClassification: null, healthClassificationTe: null, areaBreakdown: null, stressHotspotsCount: 0, message: `Verified Sentinel-2 scene ${latest.id} (${latest.cloudCoveragePercent}% cloud). For NDVI set GEE credentials.`, recommendation: `Latest granule on ${latest.acquisitionDate}.`, recommendationTe: `${latest.acquisitionDate} నాటి Sentinel-2 పాస్.`, provenance: { integrityState: 'LIVE_DATA', classification: 'REAL_API_DATA', source: 'Copernicus Sentinel-2 L2A (AWS Earth-Search STAC)', timestamp: new Date().toISOString(), isRealTime: false, observationDate: latest.acquisitionDate, locationLabel: `${lat.toFixed(4)}N, ${lon.toFixed(4)}E` }, recentScenes, historicalTrend: [] });
  } catch (err: any) {
    res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: err.message || 'Satellite unavailable', pixelAnalysisSupported: false, meanNdvi: null, meanNdwi: null });
  }
});

app.post('/api/doctor/diagnose', async (req: Request, res: Response) => {
  const { imageBase64, crop = '', symptomsText = '', language = 'en' } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ success: false, integrityState: 'UNAVAILABLE', error: 'A valid leaf or crop photograph is required.' });
  }
  const mimeMatch = imageBase64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!mimeMatch) {
    return res.status(400).json({ success: false, integrityState: 'UNAVAILABLE', error: 'Unsupported image format. Upload JPG, PNG, or WebP.' });
  }
  const mimeType = mimeMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeMatch[1].toLowerCase();
  const cleanBase64 = mimeMatch[2];
  if (!aiClient) {
    return res.status(503).json({ success: false, integrityState: 'UNAVAILABLE', error: 'GEMINI_API_KEY is not configured on the server.' });
  }
  try {
    const prompt = `You are a plant pathology image analyst. Inspect ONLY the uploaded photograph.
Crop context: "${crop || 'Not specified'}". Notes: "${symptomsText || 'None'}". Language: ${language === 'te' ? 'Telugu with English chemical names' : 'English'}.
Rules: (1) Set isPlantImage if image shows plant/leaf/crop. (2) Set isClearImage if bright and focused. (3) If not plant or unclear, identified=false, confidencePercent=0, severity="Unknown", explain in clarityFeedback. (4) Do not invent high confidence.`;
    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts: [{ inlineData: { mimeType, data: cleanBase64 } }, { text: prompt }] },
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
            recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicRemedy: { type: Type.STRING },
            chemicalRemedy: { type: Type.STRING },
            preventiveMeasures: { type: Type.STRING },
          },
          required: ['isPlantImage','isClearImage','identified','detectedCrop','diseaseOrPest','severity','visualSymptoms','recommendedNextSteps','organicRemedy','chemicalRemedy','preventiveMeasures'],
        },
      },
    });
    const parsed = JSON.parse(aiResponse.text || '{}');
    const validConfidence = parsed.identified && typeof parsed.confidencePercent === 'number' && parsed.confidencePercent > 0 ? Math.min(100, Math.round(parsed.confidencePercent)) : null;
    const allowedSeverities = ['None', 'Low', 'Moderate', 'Severe', 'Unknown'];
    const safeSeverity = allowedSeverities.includes(parsed.severity) ? parsed.severity : 'Unknown';
    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      source: 'Gemini AI Vision Analysis',
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
        recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps : [],
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
          notes: 'General multimodal AI visual inspection — confirm chemical dosages with local agronomists.',
        },
      },
    });
  } catch (err: any) {
    console.error('Gemini vision diagnosis error:', err);
    return res.status(502).json({ success: false, integrityState: 'UNAVAILABLE', error: `Gemini Vision analysis failed: ${err.message || 'Upstream AI service error'}` });
  }
});

const droneBookings: any[] = [];
const labourRequests: any[] = [];
const discussions: any[] = [];
app.get('/api/drone/bookings', (_req, res) => res.json({ success: true, bookings: droneBookings }));
app.post('/api/drone/book', (req, res) => { const b = { id: Date.now().toString(), ...req.body, status: 'pending', createdAt: new Date().toISOString() }; droneBookings.push(b); res.json({ success: true, booking: b }); });
app.get('/api/labour-requests', (_req, res) => res.json({ success: true, requests: labourRequests }));
app.post('/api/labour-requests', (req, res) => { const r = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() }; labourRequests.push(r); res.json({ success: true, request: r }); });
app.get('/api/discussions', (_req, res) => res.json({ success: true, discussions }));
app.post('/api/discussions', (req, res) => { const d = { id: Date.now().toString(), ...req.body, comments: [], createdAt: new Date().toISOString() }; discussions.push(d); res.json({ success: true, discussion: d }); });
app.get('/api/discussions/:postId/comments', (req, res) => { const d = discussions.find((x) => x.id === req.params.postId); res.json({ success: true, comments: d?.comments || [] }); });
app.post('/api/discussions/:postId/comments', (req, res) => { const d = discussions.find((x) => x.id === req.params.postId); if (!d) return res.status(404).json({ success: false }); const c = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() }; d.comments = d.comments || []; d.comments.push(c); res.json({ success: true, comment: c }); });
app.get('/api/market-prices', async (_req, res) => { res.json({ success: true, prices: [{ crop: 'Rice', market: 'Hyderabad', price: 2200, unit: 'quintal' }], source: 'stub' }); });
app.get('/api/iot/status', (_req, res) => res.json({ success: true, connected: false, devices: [], latestTelemetry: null }));
app.post('/api/iot/telemetry', (_req, res) => res.json({ success: true }));
app.post('/api/iot/pump', (_req, res) => res.json({ success: true, status: 'ok' }));
app.post('/api/assistant', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    const { message, language, context } = req.body || {};
    const prompt = `FarmersNeed AI for Indian farmers. Reply in ${language || 'English'}. Context: ${JSON.stringify(context || {})}. User: ${message}`;
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: prompt });
    res.json({ success: true, reply: aiResponse.text || 'Sorry, could not process that.', source: 'Gemini AI (gemini-4-hydrogen)' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/recommendations', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.json({ success: true, recommendations: ['Ensure soil moisture'], source: 'fallback' });
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: `Give 3 short farming tips for: ${JSON.stringify(req.body)}` });
    res.json({ success: true, recommendations: (aiResponse.text || '').split('\n').filter(Boolean).slice(0, 5), source: 'gemini-4-hydrogen' });
  } catch {
    res.json({ success: true, recommendations: ['Check weather before spraying'], source: 'fallback' });
  }
});
app.post('/api/profit', async (req: Request, res: Response) => {
  const { acres, crop, expectedYieldPerAcre, pricePerUnit, costsPerAcre } = req.body || {};
  const a = Number(acres) || 1, y = Number(expectedYieldPerAcre) || 20, p = Number(pricePerUnit) || 100, c = Number(costsPerAcre) || 20000;
  const revenue = a * y * p, cost = a * c;
  res.json({ success: true, acres: a, crop, expectedYieldPerAcre: y, pricePerUnit: p, costsPerAcre: c, totalRevenue: revenue, totalCost: cost, netProfit: revenue - cost, profitPerAcre: (revenue - cost) / a });
});

async function startServer() {
  const httpServer = http.createServer(app);
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ success: false, integrityState: 'UNAVAILABLE', error: `API route not found: ${req.method} ${req.originalUrl}` });
  });
  const distPath = path.resolve(__dirname, 'dist');
  let hasDist = false;
  try { const fs = await import('fs'); hasDist = fs.existsSync(path.join(distPath, 'index.html')); } catch { hasDist = false; }
  const useVite = process.env.NODE_ENV !== 'production' || !hasDist;
  if (useVite) {
    let viteMiddleware: any = null;
    let viteError: Error | null = null;
    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const disableHmr = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({ server: { middlewareMode: true, hmr: disableHmr ? false : { server: httpServer }, ws: disableHmr ? false : undefined, watch: disableHmr ? null : {} }, appType: 'spa' });
      viteMiddleware = vite.middlewares;
      console.log('Vite middleware ready');
    })().catch((err) => { viteError = err instanceof Error ? err : new Error(String(err)); console.error('Vite init failed:', err); });
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (!viteMiddleware && !viteError) await viteReady;
      if (viteError) return next(viteError);
      if (viteMiddleware) return viteMiddleware(req, res, next);
      return next();
    });
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FarmersNeed 2.2.0 on :${PORT}; gemini=${!!aiClient}; vite=${useVite}`);
  });
}

startServer().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });
