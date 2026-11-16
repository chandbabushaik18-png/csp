export type Language = 'en' | 'te';

/**
 * Central Data Integrity & Provenance Classification
 * Strict rule: Never represent estimated or demo information as real measurements.
 */
export type DataClassification =
  | 'REAL_API_DATA'
  | 'REAL_GPS_DATA'
  | 'REAL_HARDWARE_SENSOR_DATA'
  | 'CALCULATED_DATA'
  | 'ESTIMATED_DATA'
  | 'DEMO_DATA';

export interface DataProvenance {
  classification: DataClassification;
  source: string;
  timestamp: string;
  isRealTime: boolean;
  notes?: string;
  methodology?: string;
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
  cropStage: 'Initial (Germination)' | 'Vegetative (Tillering/Branching)' | 'Mid-Season (Flowering/Fruiting)' | 'Late-Season (Ripening/Harvest)';
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
  crop: string;
  cropStage: string;
  soilType: string;
  irrigationMethod: string;
  areaAcres: number;
  et0_mm: number; // Reference Evapotranspiration from real weather
  kc: number; // FAO-56 Crop coefficient
  etc_mm: number; // Crop Evapotranspiration
  effectiveRain_mm: number; // Infiltrating precipitation via USDA-SCS
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
  platform: string; // e.g., 'Sentinel-2B'
  constellation: string;
  acquisitionDate: string;
  processedDate: string;
  cloudCoveragePercent: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  tileId: string;
  utmZone?: string;
  bandsAvailable: string[];
  previewUrl?: string;
}

export interface SatelliteAnalysis {
  success?: boolean;
  farmId: string;
  satelliteSource: string;
  sceneId: string;
  platform: string;
  acquisitionDate: string;
  processedDate: string;
  cloudCoveragePercent: number;
  sunElevationDeg?: number;
  meanNdvi: number;
  meanNdwi: number;
  indexFormulas: {
    ndvi: string; // '(B8 - B4) / (B8 + B4)'
    ndwi: string; // '(B3 - B8) / (B3 + B8)'
  };
  healthClassification: 'Vigorous / Healthy' | 'Moderate Growth' | 'Crop Stress' | 'Fallow / Bare Soil';
  healthClassificationTe: string;
  areaBreakdown: {
    healthyVegetationPercent: number;
    moderateVegetationPercent: number;
    cropStressPercent: number;
    bareSoilPercent: number;
    waterBodiesPercent: number;
  };
  thresholdsUsed: {
    healthyMin: number;
    moderateMin: number;
    lowMin: number;
    waterNdwiMin: number;
  };
  stressHotspotsCount: number;
  recommendation: string;
  recommendationTe: string;
  provenance: DataProvenance;
  recentScenes?: SentinelScene[];
  historicalTrend: Array<{
    date: string;
    ndvi: number;
    ndwi: number;
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
  diseaseName: string;
  diseaseNameTe: string;
  confidencePercent: number;
  severity: 'Low' | 'Moderate' | 'Severe';
  symptoms: string;
  organicRemedy: string;
  chemicalRemedy: string;
  preventiveMeasures: string;
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
  status: 'Confirmed' | 'Dispatched' | 'Completed';
  cost: number;
  droneModel: string;
  operatorName: string;
  operatorPhone: string;
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
  msp: number; // Minimum Support Price benchmark
  arrivals: string;
  asOfDate: string;
  provenance: DataProvenance;
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
  lastHeartbeat: string | null;
  timeoutSeconds: number;
  pumpRelayActive: boolean;
  simulationModeRecommended: boolean;
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

