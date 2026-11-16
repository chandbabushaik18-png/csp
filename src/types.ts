export type Language = 'en' | 'te';

/**
 * Standardized 3-State Data Integrity Classification
 * - LIVE_DATA: Retrieved from an active external API, GPS hardware, or connected IoT sensor
 * - UNAVAILABLE: Service failed, timed out, or required API credentials are not configured
 * - NO_DATA: No observation, booking, or connected hardware telemetry exists yet
 */
export type DataIntegrityState = 'LIVE_DATA' | 'UNAVAILABLE' | 'NO_DATA';

export type DataClassification =
  | 'LIVE_DATA'
  | 'UNAVAILABLE'
  | 'NO_DATA'
  | 'REAL_API_DATA'
  | 'REAL_GPS_DATA'
  | 'REAL_HARDWARE_SENSOR_DATA'
  | 'CALCULATED_DATA';

export interface DataProvenance {
  integrityState?: DataIntegrityState;
  classification: DataClassification;
  source: string;
  timestamp: string;
  isRealTime: boolean;
  isModelEstimate?: boolean;
  observationDate?: string;
  locationLabel?: string;
  notes?: string;
  methodology?: string;
  groundingSources?: Array<{ title: string; uri: string }>;
}

export interface FarmProfile {
  id: string;
  name: string;
  center: [number, number]; // [lat, lng]
  boundary: [number, number][]; // Polygon coordinates [[lat, lng], ...]
  areaAcres: number;
  areaHectares: number;
  gpsAccuracyMeters?: number;
  village: string;
  mandal: string;
  district: string;
  state: string;
  fullAddress?: string;
  soilType: string;
  soilPh: number;
  currentCrop: string;
  cropStage:
    | 'Initial (Germination)'
    | 'Vegetative (Tillering/Branching)'
    | 'Mid-Season (Flowering/Fruiting)'
    | 'Late-Season (Ripening/Harvest)';
  irrigationMethod: 'Drip' | 'Sprinkler' | 'Flood / Furrow' | 'Rainfed';
  waterSource: 'Borewell' | 'Canal' | 'Farm Pond' | 'Rainfed';
  lastUpdated: string;
  provenance?: DataProvenance;
}

export interface GeocodingResult {
  displayName: string;
  village: string;
  mandal: string;
  district: string;
  state: string;
  country: string;
  postcode?: string;
  lat: number;
  lon: number;
  provenance: DataProvenance;
}

export interface WeatherData {
  success: boolean;
  integrityState?: DataIntegrityState;
  source: string;
  lastUpdated: string;
  generationTimeMs?: number;
  elevationMeters?: number;
  provenance: DataProvenance;
  location: {
    city: string;
    village?: string;
    mandal?: string;
    district?: string;
    state?: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp: number;
    feelsLike: number;
    tempMin: number;
    tempMax: number;
    humidity: number;
    pressure: number;
    condition: string;
    description: string;
    descriptionTe: string;
    windSpeedKmh: number;
    windDirectionDeg: number;
    clouds: number;
    rainProbability: number;
    precipitationMm: number;
    uvIndex: number;
    sunrise: string;
    sunset: string;
    sprayCondition: string;
    sprayBadge: 'ideal' | 'moderate' | 'poor';
    sowingSuitability: string;
    sowingSuitabilityBadge: 'favorable' | 'moderate' | 'unfavorable';
    fertilizerSafe: boolean;
    postIrrigationRainRisk: boolean;
    heatStressWarning: boolean;
  };
  hourly: Array<{
    time: string;
    temp: number;
    condition: string;
    rainChance: number;
    windSpeedKmh: number;
    humidity?: number;
    et0_mm?: number;
  }>;
  forecast: Array<{
    day: string;
    dayTe: string;
    date: string;
    tempMax: number;
    tempMin: number;
    condition: string;
    rainChance: number;
    rainfallMm: number;
    windSpeedKmh: number;
    et0_mm?: number;
  }>;
}

export interface WaterAdvisoryData {
  success?: boolean;
  integrityState?: DataIntegrityState;
  crop: string;
  cropStage: string;
  soilType: string;
  irrigationMethod: string;
  areaAcres: number;
  et0_mm: number;
  kc: number;
  etc_mm: number;
  effectiveRain_mm: number;
  netWaterNeed_mm: number;
  grossWaterNeed_mm: number;
  dailyLitersPerAcre: number;
  totalDailyLitersFarm: number;
  weeklyLitersFarm: number;
  pumpingHoursDaily: number;
  pumpFlowRateLph: number;
  nextIrrigationDate: string;
  bestTimeOfDay: string;
  irrigationEfficiencyPercent: number;
  soilMoisturePercentUsed?: number;
  soilMoistureAdjustmentFactor?: number;
  recommendationText: string;
  recommendationTextTe: string;
  waterSavingTips: string[];
  provenance: DataProvenance;
  weeklySchedule: Array<{
    day: string;
    dayTe: string;
    date: string;
    waterMm: number;
    litersPerAcre: number;
    action: string;
    actionTe: string;
    rainMm: number;
  }>;
}

export interface SentinelScene {
  id: string;
  platform: string;
  constellation: string;
  acquisitionDate: string;
  processedDate: string;
  cloudCoveragePercent: number;
  sunElevationDeg: number | null;
  sunAzimuthDeg: number | null;
  tileId: string;
  utmZone?: string;
  bandsAvailable: string[];
  previewUrl?: string | null;
}

export interface GeeStatusResponse {
  configured: boolean;
  ready: boolean;
  invalidFormat?: boolean;
  integrityState: DataIntegrityState;
  status: 'READY' | 'CREDENTIALS_MISSING' | 'AUTH_OR_API_ERROR';
  dataset?: string;
  datasetId: string;
  projectId: string | null;
  clientEmailMasked?: string | null;
  missingVars?: string[];
  error?: string;
  message?: string;
  timestamp: string;
}

export interface SatelliteAnalysis {
  success?: boolean;
  integrityState: DataIntegrityState;
  farmId: string;
  satelliteSource: string;
  datasetId?: string;
  geeConfigured?: boolean;
  geeStatus?: 'READY' | 'CREDENTIALS_MISSING' | 'AUTH_OR_API_ERROR';
  geeError?: string;
  geometryUsed?: 'drawn_polygon' | 'center_buffer';
  dateRange?: {
    startDate: string;
    endDate: string;
    maxCloudCover: number;
  };
  sceneId: string | null;
  platform: string | null;
  acquisitionDate: string | null;
  processedDate: string | null;
  cloudCoveragePercent: number | null;
  sunElevationDeg?: number | null;
  previewUrl?: string | null;
  tileUrls?: {
    ndvi?: string | null;
    ndwi?: string | null;
    evi?: string | null;
    trueColor?: string | null;
  } | null;
  pixelAnalysisSupported: boolean;
  meanNdvi: number | null;
  minNdvi?: number | null;
  maxNdvi?: number | null;
  stdDevNdvi?: number | null;
  meanNdwi: number | null;
  minNdwi?: number | null;
  maxNdwi?: number | null;
  stdDevNdwi?: number | null;
  meanEvi?: number | null;
  minEvi?: number | null;
  maxEvi?: number | null;
  stdDevEvi?: number | null;
  meanSavi?: number | null;
  minSavi?: number | null;
  maxSavi?: number | null;
  stdDevSavi?: number | null;
  validPixelCount?: number | null;
  indexFormulas: {
    ndvi: string;
    ndwi: string;
    evi?: string;
    savi?: string;
  };
  healthClassification: string | null;
  healthClassificationTe?: string | null;
  areaBreakdown: {
    healthyVegetationPercent: number;
    moderateVegetationPercent: number;
    cropStressPercent: number;
    bareSoilPercent: number;
    waterBodiesPercent: number;
  } | null;
  stressHotspotsCount: number;
  message?: string;
  recommendation: string;
  recommendationTe: string;
  provenance: DataProvenance;
  recentScenes?: SentinelScene[];
  historicalTrend: Array<{
    date: string;
    isoDate?: string;
    sceneId?: string;
    ndvi: number;
    ndwi: number;
    evi?: number;
    savi?: number;
    cloudPercent: number;
  }>;
}

export interface RecommendedCrop {
  cropKey: string;
  name: string;
  nameTe: string;
  imageUrl: string;
  suitabilityScore: number;
  variety: string;
  durationDays: number;
  waterRequirement: 'Low' | 'Medium' | 'High';
  waterRequirementTe: string;
  waterMmTotal: number;
  expectedYieldPerAcreQuintals: number;
  estimatedCostPerAcre: number;
  expectedPricePerQuintal: number;
  grossProfitPerAcre: number;
  netProfitPerAcre: number;
  totalNetProfit: number;
  roiPercentage: number;
  bestSowingWindow: string;
  bestSowingWindowTe: string;
  soilSuitabilityReason: string;
  soilSuitabilityReasonTe: string;
  fertilizerPlan: string;
  risks: string;
  risksTe: string;
  provenance?: DataProvenance;
}

export interface RecommendationResponse {
  success: boolean;
  input: {
    season: string;
    soilType: string;
    irrigation: string;
    landSizeAcres: number;
    district: string;
    village?: string;
  };
  primaryRecommendation: RecommendedCrop;
  alternatives: RecommendedCrop[];
  summary: string;
  summaryTe: string;
  provenance: DataProvenance;
}

export interface DailyActivity {
  timeSlot: 'Morning (06:00 - 09:00 AM)' | 'Afternoon (12:00 - 03:00 PM)' | 'Evening (04:30 - 07:00 PM)';
  title: string;
  titleTe: string;
  action: string;
  actionTe: string;
  priority: 'High' | 'Medium' | 'Routine';
  type: 'irrigation' | 'spraying' | 'scouting' | 'fertilizer' | 'harvest';
}

export interface LeafDiagnosisResult {
  isPlantImage: boolean;
  isClearImage: boolean;
  identified: boolean;
  detectedCrop: string;
  diseaseOrPest: string;
  diseaseOrPestTe: string;
  confidencePercent: number | null;
  severity: 'None' | 'Low' | 'Moderate' | 'Severe' | 'Unknown';
  clarityFeedback?: string;
  visualSymptoms: string;
  recommendedNextSteps: string[];
  organicRemedy: string;
  chemicalRemedy: string;
  preventiveMeasures: string;
  analyzedAt?: string;
  engine?: string;
  provenance?: DataProvenance;
}

export interface ProfitSummary {
  totalInvestment: number;
  grossRevenue: number;
  netProfit: number;
  roiPercentage: number;
  costPerAcre: number;
  profitPerAcre: number;
  costPerQuintal: number;
  breakEvenPrice: number;
  breakEvenYieldQuintals: number;
}

export interface ProfitResponse {
  success: boolean;
  crop: string;
  acres: number;
  summary: ProfitSummary;
  breakdown: Array<{
    category: string;
    amount: number;
    percent: number;
  }>;
  provenance: DataProvenance;
}

export interface DroneBooking {
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

export interface MarketPrice {
  commodity: string;
  cropKey: string;
  market: string;
  state?: string;
  district?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  change: string;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  msp?: number;
  arrivals?: string;
  asOfDate: string;
  provenance: DataProvenance;
  groundingSources?: Array<{ title: string; uri: string }>;
}

export interface LabourRequest {
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

export interface Discussion {
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

export interface Comment {
  id: string;
  postId: string;
  author: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface IotTelemetrySnapshot {
  deviceId: string;
  firmwareVersion: string;
  soilMoisturePercent: number;
  temperatureC: number;
  humidityPercent: number;
  pumpRelayActive: boolean;
  wifiRssiDbm?: number;
  receivedAt: string;
}

export interface IotDeviceStatus {
  connected: boolean;
  integrityState?: DataIntegrityState;
  lastHeartbeat: string | null;
  timeoutSeconds: number;
  pumpRelayActive: boolean;
  latestTelemetry: IotTelemetrySnapshot | null;
  telemetryHistory: IotTelemetrySnapshot[];
  provenance: DataProvenance;
}

export interface AppNotification {
  id: string;
  title: string;
  titleTe: string;
  message: string;
  messageTe: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  category: 'weather' | 'water' | 'satellite' | 'iot';
  timestamp: string;
  targetTab?: string;
  read?: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'info' | 'warning' | 'error';
}
