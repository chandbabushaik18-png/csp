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

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'FarmersNeed 2.0',
    version: '2.1.2',
    geminiConfigured: !!aiClient,
    note: 'Working server restored for AI Studio build. Crop doctor active. Full satellite routes pending complete server restore.',
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', geminiConfigured: !!aiClient, version: '2.1.2' });
});

// Crop doctor — works if GEMINI_API_KEY is set (uses gemini-4-hydrogen for AI Studio)
app.post('/api/doctor/diagnose', async (req: Request, res: Response) => {
  const { imageBase64, crop = '', symptomsText = '', language = 'en' } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: 'A valid leaf or crop photograph is required before running Gemini Vision analysis.',
    });
  }
  const mimeMatch = String(imageBase64).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
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
    const prompt = `You are a plant pathology image analyst. Inspect the uploaded photo.
Crop context: "${crop || 'Not specified'}". Farmer notes: "${symptomsText || 'None'}".
Language: ${language === 'te' ? 'Telugu with English chemical names' : 'English'}.
Return JSON with: isPlantImage, isClearImage, identified, detectedCrop, diseaseOrPest, diseaseOrPestTe, confidencePercent, severity, clarityFeedback, visualSymptoms, recommendedNextSteps (array), organicRemedy, chemicalRemedy, preventiveMeasures.
If not a clear plant photo, set identified=false and confidencePercent=0.`;

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
            recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicRemedy: { type: Type.STRING },
            chemicalRemedy: { type: Type.STRING },
            preventiveMeasures: { type: Type.STRING },
          },
          required: [
            'isPlantImage', 'isClearImage', 'identified', 'detectedCrop', 'diseaseOrPest',
            'severity', 'visualSymptoms', 'recommendedNextSteps', 'organicRemedy',
            'chemicalRemedy', 'preventiveMeasures',
          ],
        },
      },
    });

    const parsed = JSON.parse(aiResponse.text || '{}');
    const validConfidence =
      parsed.identified && typeof parsed.confidencePercent === 'number' && parsed.confidencePercent > 0
        ? Math.min(100, Math.round(parsed.confidencePercent))
        : null;
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
    return res.status(502).json({
      success: false,
      integrityState: 'UNAVAILABLE',
      error: `Gemini Vision analysis failed: ${err.message || 'Upstream AI service error'}`,
    });
  }
});

// GEE status
app.get('/api/satellite/gee-status', async (_req: Request, res: Response) => {
  const hasJson = Boolean(process.env.GEE_SERVICE_ACCOUNT_JSON?.trim());
  const hasPair = Boolean(process.env.GEE_CLIENT_EMAIL?.trim() && process.env.GEE_PRIVATE_KEY?.trim());
  const projectId = process.env.GEE_PROJECT_ID?.trim() || null;
  const configured = Boolean(projectId && (hasJson || hasPair));
  if (!configured) {
    return res.json({
      configured: false,
      ready: false,
      status: 'CREDENTIALS_MISSING',
      integrityState: 'UNAVAILABLE',
      dataset: 'COPERNICUS/S2_SR_HARMONIZED',
      projectId,
      message: 'Set GEE_PROJECT_ID and GEE_SERVICE_ACCOUNT_JSON (or GEE_CLIENT_EMAIL + GEE_PRIVATE_KEY). Register the service account with Earth Engine.',
      timestamp: new Date().toISOString(),
    });
  }
  return res.json({
    configured: true,
    ready: false,
    status: 'AUTH_OR_API_ERROR',
    integrityState: 'UNAVAILABLE',
    dataset: 'COPERNICUS/S2_SR_HARMONIZED',
    projectId,
    message: 'Credentials present. Full NDVI pixel routes need complete server.ts. Register SA at earthengine.google.com.',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/satellite/analyze', async (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    integrityState: 'UNAVAILABLE',
    error: 'Full satellite analyze route requires complete server.ts. Crop doctor is available.',
    pixelAnalysisSupported: false,
  });
});

app.post('/api/satellite/scenes', async (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    error: 'Full scenes route requires complete server.ts restore.',
  });
});

// Weather (Open-Meteo)
app.get('/api/weather', async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lon = parseFloat(String(req.query.lon || ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ success: false, error: 'lat and lon required' });
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
    const data = await r.json();
    const c = data.current || {};
    return res.json({
      success: true,
      integrityState: 'LIVE_DATA',
      source: 'Open-Meteo',
      current: {
        temp: Math.round(c.temperature_2m ?? 0),
        humidity: Math.round(c.relative_humidity_2m ?? 0),
        windSpeedKmh: Math.round(c.wind_speed_10m ?? 0),
        condition: 'Live',
      },
      raw: data,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// Static / Vite
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built yet');
  });
});

async function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FarmersNeed server listening on ${PORT}`);
    console.log(`Gemini configured: ${!!aiClient}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
