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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,et0_fao_evapotranspiration&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const current = data.current || {};
    const hourly = data.hourly || {};
    const daily = data.daily || {};
    const temp = current.temperature_2m ?? 0;
    const humidity = current.relative_humidity_2m ?? 0;
    const windSpeedKmh = current.wind_speed_10m ?? 0;
    const rainProbability = hourly.precipitation_probability?.[0] ?? 0;
    const wmo = interpretWmoCode(current.weather_code ?? 0);
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
        precipitation: Number((daily.precipitation_sum?.[d] ?? 0).toFixed(1)),
        et0_mm: Number((daily.et0_fao_evapotranspiration?.[d] ?? 0).toFixed(2)),
      });
    }
    res.json({
      success: true,
      location: { lat, lon },
      current: {
        temp: Math.round(temp),
        feelsLike: Math.round(current.apparent_temperature ?? temp),
        humidity: Math.round(humidity),
        windSpeedKmh: Math.round(windSpeedKmh),
        windDirection: current.wind_direction_10m ?? 0,
        condition: wmo.condition,
        description: wmo.description,
        descriptionTe: wmo.descriptionTe,
        uvIndex: current.uv_index ?? 0,
        precipitation: current.precipitation ?? 0,
        rainProbability: Math.round(rainProbability),
      },
      spray: { condition: sprayCondition, badge: sprayBadge },
      sowing: { suitability: sowingSuitability, badge: sowingSuitabilityBadge },
      hourly: hourlyList,
      forecast: forecastList,
      source: 'Open-Meteo',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Weather error:', err);
    res.status(500).json({ success: false, error: err.message || 'Weather fetch failed' });
  }
});

app.get('/api/water-advisory', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat) || 17.385;
    const lon = Number(req.query.lon) || 78.4867;
    const crop = String(req.query.crop || 'rice');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    const data = await response.json();
    const daily = data.daily || {};
    const kcMap: Record<string, number> = { rice: 1.2, wheat: 1.15, cotton: 1.15, maize: 1.2, sugarcane: 1.25, default: 1.0 };
    const kc = kcMap[crop.toLowerCase()] || kcMap.default;
    const et0 = daily.et0_fao_evapotranspiration?.[0] ?? 4;
    const rain = daily.precipitation_sum?.[0] ?? 0;
    const cropEt = et0 * kc;
    const netIrrigation = Math.max(0, cropEt - rain);
    res.json({
      success: true,
      crop,
      et0_mm: Number(et0.toFixed(2)),
      cropEt_mm: Number(cropEt.toFixed(2)),
      rainfall_mm: Number(rain.toFixed(2)),
      netIrrigationNeed_mm: Number(netIrrigation.toFixed(2)),
      advice: netIrrigation > 5 ? 'Irrigate today' : netIrrigation > 2 ? 'Light irrigation optional' : 'No irrigation needed',
      source: 'Open-Meteo ET0 + FAO crop coefficients',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

app.get('/api/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ success: false, error: 'lat/lon required' });
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    const r = data.results?.[0];
    res.json({
      success: true,
      name: r?.name || 'Unknown',
      display: r ? `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}` : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat, lon,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crop-doctor', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    const { imageBase64, mimeType, crop, symptoms, language } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 required' });
    const prompt = `You are an expert agricultural pathologist. Analyze this crop leaf/plant image for diseases, pests, nutrient deficiencies. Crop: ${crop || 'unknown'}. Symptoms noted: ${symptoms || 'none'}. Respond in ${language || 'English'}. Give: 1) Diagnosis 2) Confidence 3) Treatment 4) Prevention. Be practical for smallholder farmers.`;
    const parts: any[] = [{ text: prompt }];
    parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64.replace(/^data:[^;]+;base64,/, '') } });
    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [{ role: 'user', parts }],
    });
    const text = aiResponse.text || 'Unable to analyze image.';
    res.json({
      success: true,
      diagnosis: text,
      analyzedAt: new Date().toISOString(),
      engine: 'Gemini Vision AI (gemini-4-hydrogen)',
    });
  } catch (err: any) {
    console.error('Crop doctor error:', err);
    res.status(500).json({ success: false, error: err.message || 'Analysis failed' });
  }
});

app.post('/api/assistant', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    const { message, language, context } = req.body || {};
    const prompt = `You are FarmersNeed AI assistant for Indian farmers. Reply helpfully in ${language || 'English'}. Context: ${JSON.stringify(context || {})}. User: ${message}`;
    const aiResponse = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });
    const reply = aiResponse.text || 'Sorry, I could not process that.';
    res.json({ success: true, reply, source: 'Gemini AI (gemini-4-hydrogen)' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/satellite/gee-status', async (_req, res) => {
  res.json({
    success: true,
    configured: !!process.env.GEE_PRIVATE_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    message: 'Register service account at https://signup.earthengine.google.com/ and set GEE credentials. See FIX_AI_CROP_DETECTION.md',
  });
});

app.post('/api/satellite/analyze', async (_req, res) => {
  res.json({ success: false, error: 'Earth Engine credentials not registered. Register at signup.earthengine.google.com', integrityState: 'STUB' });
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
  res.json({ success: true, devices: [], message: 'IoT stub' });
});
app.post('/api/iot/telemetry', (_req, res) => {
  res.json({ success: true });
});
app.post('/api/iot/pump', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.post('/api/recommendations', async (req: Request, res: Response) => {
  try {
    if (!aiClient) return res.json({ success: true, recommendations: ['Ensure soil moisture', 'Monitor for pests'], source: 'fallback' });
    const prompt = `Give 3 short practical farming recommendations for: ${JSON.stringify(req.body)}`;
    const aiResponse = await aiClient.models.generateContent({ model: 'gemini-4-hydrogen', contents: prompt });
    res.json({ success: true, recommendations: (aiResponse.text || '').split('\n').filter(Boolean).slice(0, 5), source: 'gemini-4-hydrogen' });
  } catch (err: any) {
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
