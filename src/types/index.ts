export type Language = 'mr' | 'en';

export interface PanchayatAlert {
  id: string;
  panchayatId: string;
  message: string;
  sourceLanguage: Language;
  severity: 'info' | 'urgent';
  sentAt: string;
}

export interface Panchayat {
  id: string;
  nameMr: string;
  nameEn: string;
  blockId: string;
  blockNameMr: string;
  blockNameEn: string;
  lat: number;
  lng: number;
  elevationM: number; // DEM Elevation in meters
  slopeDeg: number;
  aspect: string; // e.g., 'SW', 'W', 'NW', 'NE', 'E'
  aspectDeg: number;
  distanceToRiverKm: number;
  ndvi: number; // 0.1 to 0.8
  soilTypeMr: string;
  soilTypeEn: string;
  primaryCropsMr: string[];
  primaryCropsEn: string[];
  population: number;
  farmerCount: number;
  polygon?: [number, number][]; // coordinates for map boundary
}

export interface BlockData {
  id: string;
  nameMr: string;
  nameEn: string;
  centerLat: number;
  centerLng: number;
  imdGridCell: string; // e.g. "IMD_GRID_73.75E_20.00N"
  imdRainfallMm: number; // Coarse block-wide forecast from IMD 0.25°
  imdTempMaxC: number;
  imdTempMinC: number;
  imdHumidityPct: number;
  imdWindSpeedKmh: number;
  imdWindDirection: string;
  imdCloudCoverPct: number;
  imdForecastDate: string;
  isDemoForecast: boolean;
  forecastDays?: BlockForecastDay[];
}

export interface BlockForecastDay {
  date: string;
  rainfallMm: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbabilityPct: number;
}

export interface TraditionalIndicator {
  id: string;
  category: 'fauna' | 'flora' | 'atmosphere' | 'celestial';
  icon: string;
  titleMr: string;
  titleEn: string;
  descriptionMr: string;
  descriptionEn: string;
  folkloreMeaningMr: string;
  folkloreMeaningEn: string;
  scientificHypothesisMr: string;
  scientificHypothesisEn: string;
  rainAdjustmentWeight: number; // e.g., +0.15 to +0.30
  tempAdjustmentDelta: number; // e.g., -0.5
  confidenceImpact: number; // e.g. +10%
  timeHorizonHours: number;
}

export interface FarmerReport {
  id: string;
  panchayatId: string;
  indicatorId: string;
  reportedAt: string;
  timeAgoMr: string;
  timeAgoEn: string;
  farmerNameMr: string;
  farmerNameEn: string;
  notesMr?: string;
  notesEn?: string;
  reliabilityScore: number; // 0 means unvalidated; 1 to 5 may represent a future validated score
  isDemoData: boolean;
  hasAudio?: boolean;
  audioDurationSec?: number;
  audioUrl?: string;
}

export interface DownscalingResult {
  panchayatId: string;
  blockForecastRainfall: number;
  rfDownscaledRainfall: number;
  calibratedRainfall: number;
  blockForecastTemp: number;
  rfDownscaledTemp: number;
  calibratedTemp: number;
  rfDownscaledHumidity: number;
  calibratedHumidity: number;
  rainProbabilityPct: number;
  calibrationDeltaMm: number;
  activeReportsCount: number;
  confidenceScorePct: number | null;
  orographicFactor: number;
}

export interface CropAdvisory {
  cropId: string;
  cropNameMr: string;
  cropNameEn: string;
  icon: string;
  currentStageMr: string;
  currentStageEn: string;
  irrigationAdviceMr: string;
  irrigationAdviceEn: string;
  sprayingAdviceMr: string;
  sprayingAdviceEn: string;
  fertilizerAdviceMr: string;
  fertilizerAdviceEn: string;
  harvestAdviceMr: string;
  harvestAdviceEn: string;
  urgency: 'high' | 'medium' | 'normal';
}

export interface ModelMetrics {
  r2Score: number;
  rmse: number;
  mae: number;
  trainSamples: number;
  testSamples: number;
  crossValMean: number;
  featureImportances: {
    featureMr: string;
    featureEn: string;
    importance: number;
  }[];
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ExplainabilityFactor {
  id: string;
  nameMr: string;
  nameEn: string;
  impactLevel: 'high' | 'moderate' | 'low';
  impactLabelMr: string;
  impactLabelEn: string;
  descriptionMr: string;
  descriptionEn: string;
  calculatedValue: string;
  importanceWeight: number; // 0 to 1
}

export interface HistoricalTrendPoint {
  date: string;
  dayLabelMr: string;
  dayLabelEn: string;
  blockRainfallMm: number;
  rfDownscaledMm: number;
  calibratedRainfallMm: number;
  bioAdjustmentMm: number;
  reportsCount: number;
  dominantIndicatorIcon?: string;
}
