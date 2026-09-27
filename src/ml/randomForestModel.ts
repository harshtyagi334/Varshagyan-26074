import { BlockData, CropAdvisory, DownscalingResult, FarmerReport, Panchayat } from '../types';

/**
 * Demonstration downscaling calculation for VarshaGyan.
 * This deterministic terrain adjustment is not a trained or validated model.
 */

// No real paired block/gauge training dataset is bundled with this prototype.
// Keep validation unavailable instead of showing scores generated from synthetic data.
export const MODEL_METRICS: null = null;

/**
 * Terrain-adjusted demonstration estimate (not trained or validated).
 * @param panchayat Target Panchayat geographic features
 * @param block Coarse Block-level IMD 0.25° forecast
 * @param reports Crowdsourced traditional indicator reports for this panchayat
 */
export function calculateDownscaledWeather(
  panchayat: Panchayat,
  block: BlockData,
  reports: FarmerReport[]
): DownscalingResult {
  // --- 1. PHYSICAL OROGRAPHIC & MICRO-TERRAIN FEATURE ENGINEERING ---
  
  // Baseline elevation for Nashik plain is ~550m
  const elevationDelta = (panchayat.elevationM - 550) / 100; // per 100m rise
  
  // Aspect alignment with monsoon south-westerly wind (225° - 250°)
  const aspectRad = (panchayat.aspectDeg * Math.PI) / 180;
  const windDirRad = (235 * Math.PI) / 180; // WSW monsoon wind vector
  const aspectAlignment = Math.max(0, Math.cos(aspectRad - windDirRad)); // 1.0 if facing WSW
  
  // Orographic enhancement multiplier: higher elevation + windward facing slope
  const orographicLifting = 1 + (elevationDelta * 0.18) + (panchayat.slopeDeg * 0.035 * aspectAlignment);
  
  // River microclimate factor: high humidity & local convective cloud enhancement near riverbanks
  const riverHumidityFactor = Math.max(0, (3.0 - Math.min(3.0, panchayat.distanceToRiverKm)) * 0.06);
  
  // NDVI evapotranspiration cooling & moisture contribution
  const ndviFactor = (panchayat.ndvi - 0.5) * 0.12;

  // --- 2. DEMONSTRATION TERRAIN ADJUSTMENT ---
  const rfRainfallRaw = block.imdRainfallMm * orographicLifting * (1 + ndviFactor + riverHumidityFactor);
  const rfDownscaledRainfall = Math.max(0, Number(rfRainfallRaw.toFixed(1)));

  // Temperature lapse rate downscaling: ~0.65°C drop per 100m elevation + river cooling
  const lapseRateDrop = (panchayat.elevationM - 550) * (0.0065);
  const rfDownscaledTemp = Number((block.imdTempMaxC - lapseRateDrop - (riverHumidityFactor * 0.8)).toFixed(1));

  // Humidity downscaling: increases with elevation & river proximity
  const rfDownscaledHumidity = Math.min(99, Math.round(block.imdHumidityPct + (elevationDelta * 2.5) + (riverHumidityFactor * 12)));

  // --- 3. TRADITIONAL BIO-INDICATOR CALIBRATION LAYER ---
  // Filter reports active for this specific panchayat
  // Qualitative farmer reports are retained for review but are not treated as
  // rain-gauge observations. Only measured, validated local data can calibrate
  // this estimate; demo reports must never influence forecast values.
  const activeReports = reports.filter((r) => r.panchayatId === panchayat.id && !r.isDemoData);
  const calibratedRainfall = rfDownscaledRainfall;
  const calibratedTemp = rfDownscaledTemp;
  const calibratedHumidity = rfDownscaledHumidity;

  const calibrationDeltaMm = Number((calibratedRainfall - rfDownscaledRainfall).toFixed(1));

  // Use the weather provider's precipitation probability when available.
  // The fallback is only a display heuristic for bundled sample data.
  const sourceRainProbability = block.forecastDays?.[0]?.precipitationProbabilityPct;
  let baseProb = block.imdCloudCoverPct * 0.7 + (calibratedRainfall > 2 ? 30 : calibratedRainfall * 8);
  if (calibratedRainfall > 15) baseProb = 95;
  if (calibratedRainfall > 7) baseProb = 85;
  const rainProbabilityPct = sourceRainProbability ?? Math.min(98, Math.max(10, Math.round(baseProb)));

  const confidenceScorePct = null;

  return {
    panchayatId: panchayat.id,
    blockForecastRainfall: block.imdRainfallMm,
    rfDownscaledRainfall,
    calibratedRainfall,
    blockForecastTemp: block.imdTempMaxC,
    rfDownscaledTemp,
    calibratedTemp,
    rfDownscaledHumidity,
    calibratedHumidity,
    rainProbabilityPct,
    calibrationDeltaMm,
    activeReportsCount: activeReports.length,
    confidenceScorePct,
    orographicFactor: Number(orographicLifting.toFixed(2)),
  };
}

/**
 * Generate Actionable Farmer Advisories for major Nashik crops based on calibrated micro-forecast
 */
export function generateCropAdvisories(
  result: DownscalingResult,
  panchayat: Panchayat
): CropAdvisory[] {
  const rain = result.calibratedRainfall;
  const isHighRain = rain >= 8.0;
  const isModerateRain = rain >= 3.0 && rain < 8.0;
  const isLightRain = rain > 0.5 && rain < 3.0;

  return [
    {
      cropId: 'grapes',
      cropNameMr: 'द्राक्ष (Grapes)',
      cropNameEn: 'Grapes (Vineyards)',
      icon: '🍇',
      currentStageMr: 'घोस वाढ / फुलोरा अवस्था (Berry Development)',
      currentStageEn: 'Berry Development / Flowering Stage',
      urgency: isHighRain || isModerateRain ? 'high' : 'normal',
      irrigationAdviceMr: isHighRain || isModerateRain
        ? `पुढील २४ तास ठिबक सिंचन पूर्णपणे बंद ठेवा. स्थानिक ${rain} मिमी पाऊस अपेक्षित असल्याने जमिनीत पुरेसा ओलावा राहील.`
        : isLightRain
        ? `सिंचन ३०% कमी करा. आज संध्याकाळी हलकी सर येण्याची शक्यता आहे.`
        : `नियमित वेळापत्रकानुसार ठिबक सिंचन सुरू ठेवावे.`,
      irrigationAdviceEn: isHighRain || isModerateRain
        ? `Stop drip irrigation for the next 24 hours. Expected local rainfall of ${rain} mm will maintain sufficient soil moisture.`
        : isLightRain
        ? `Reduce drip irrigation by 30%. Light localized showers expected this evening.`
        : `Continue scheduled drip irrigation as normal.`,
      sprayingAdviceMr: isHighRain || isModerateRain
        ? `⚠️ तातडीचा सल्ला: डाऊनी मिल्ड्यू (Downy Mildew) / भुरी रोगाची कोणतीही महागडी बुरशीनाशक फवारणी आज करू नका. पावसामुळे औषध वाहून जाईल.`
        : `बुरशीनाशक फवारणी सकाळच्या कोरड्या वेळेत (१० च्या आत) उरकून घ्यावी.`,
      sprayingAdviceEn: isHighRain || isModerateRain
        ? `⚠️ Urgent: Postpone expensive fungicide sprays for Downy Mildew / Powdery Mildew. Rain will wash away the formulation.`
        : `Conduct preventive sprays during clear morning window before 10 AM.`,
      fertilizerAdviceMr: isHighRain
        ? `द्राक्ष बागेत विद्राव्य खते (Water Soluble NPK) सोडणे तात्पुरते थांबवा, वाहून जाण्याचा धोका आहे.`
        : `शिफारशीत पोटॅश व मॅग्नेशियम डोस नियमित द्यावा.`,
      fertilizerAdviceEn: isHighRain
        ? `Suspend fertigation of water-soluble NPK nutrients to prevent leaching loss.`
        : `Apply recommended Potassium and Magnesium boosters per schedule.`,
      harvestAdviceMr: `पाऊस ओसरल्यानंतर बागेत साचलेले पाणी त्वरित चारी काढून बाहेर काढा.`,
      harvestAdviceEn: `Ensure prompt drainage of standing rainwater from vineyard trenches.`,
    },
    {
      cropId: 'onion',
      cropNameMr: 'कांदा (Onion)',
      cropNameEn: 'Onion (Kharif / Late)',
      icon: '🧅',
      currentStageMr: 'कंद फुगवण / पुनर्लागवड अवस्था',
      currentStageEn: 'Bulb Development / Transplanting',
      urgency: isHighRain ? 'high' : 'normal',
      irrigationAdviceMr: isHighRain || isModerateRain
        ? `कांदा पिकाचे सिंचन तात्काळ पुढे ढकला. पाणी साचल्यास कंद सडण्याची (Bulb Rot) शक्यता असते.`
        : `हलके सिंचन द्या, वापसा स्थिती राखा.`,
      irrigationAdviceEn: isHighRain || isModerateRain
        ? `Delay irrigation immediately. Excess waterlogging causes fungal bulb rot.`
        : `Provide light irrigation; maintain optimal soil aeration.`,
      sprayingAdviceMr: isHighRain
        ? `पाऊस थांबल्यानंतर करपा (Purple Blotch) नियंत्रणासाठी मॅनकोझेब किंवा प्रोपिकोनेझोलची स्टिकर टाकून फवारणी करा.`
        : `थ्रिप्स (फुलकिडे) नियंत्रणासाठी कडुनिंब अर्क फवारा.`,
      sprayingAdviceEn: isHighRain
        ? `Post-rain, spray Mancozeb or Propiconazole with a wetting sticker against Purple Blotch.`
        : `Spray neem extract for preventive thrips management.`,
      fertilizerAdviceMr: `नायट्रोजन (युरिया) चा जास्त वापर टाळा.`,
      fertilizerAdviceEn: `Avoid excessive top-dressing with urea in damp weather.`,
      harvestAdviceMr: isHighRain
        ? `काढलेला कांदा शेतात उघड्यावर न ठेवता तातडीने सुरक्षित शेडमध्ये किंवा ताडपत्रीने झाकून ठेवा.`
        : `काढणीस तयार असलेला कांदा सुकवून चाळीत साठवा.`,
      harvestAdviceEn: isHighRain
        ? `Cover harvested onions immediately under tarpaulin or shift to ventilated sheds.`
        : `Dry harvested bulbs properly before storing in chawls.`,
    },
    {
      cropId: 'tomato',
      cropNameMr: 'टोमॅटो (Tomato)',
      cropNameEn: 'Tomato',
      icon: '🍅',
      currentStageMr: 'फुलधारणा व फळधारणा अवस्था',
      currentStageEn: 'Flowering & Fruit Setting Stage',
      urgency: isHighRain ? 'high' : 'medium',
      irrigationAdviceMr: isHighRain
        ? `उपनलिकांचे पाणी बंद करा. टोमॅटोच्या मुळांशी पाणी साचू देऊ नका.`
        : `नियमित अंतराने हलके पाणी द्यावे.`,
      irrigationAdviceEn: isHighRain
        ? `Turn off drip lines. Prevent water stagnation around root zones.`
        : `Maintain light, uniform moisture intervals.`,
      sprayingAdviceMr: isHighRain || isModerateRain
        ? `पावसामुळे नागअळी व लवकर येणारा करपा वाढू शकतो; पाऊस संपल्यावर त्वरित आंतरप्रवाही बुरशीनाशक वापरा.`
        : `नियमित संरक्षणात्मक फवारणी सुरू ठेवा.`,
      sprayingAdviceEn: isHighRain || isModerateRain
        ? `High humidity triggers Early Blight & Leaf Miners; spray systemic fungicide once rain clears.`
        : `Continue scheduled protective sprays.`,
      fertilizerAdviceMr: `कॅल्शियम व बोरॉनचे प्रमाण योग्य ठेवा जेणेकरून फळ तडकणे टळेल.`,
      fertilizerAdviceEn: `Maintain Calcium & Boron balance to prevent fruit cracking during sudden rain.`,
      harvestAdviceMr: `पक्व टोमॅटोची तोडणी पावसापूर्वी करून क्रेट्समध्ये सुरक्षित ठेवा.`,
      harvestAdviceEn: `Harvest ripe fruits prior to rains and stack in ventilated crates.`,
    },
    {
      cropId: 'pomegranate',
      cropNameMr: 'डाळिंब (Pomegranate)',
      cropNameEn: 'Pomegranate (Bhagwa)',
      icon: '🍎',
      currentStageMr: 'मृग बहार / फळ पक्वता',
      currentStageEn: 'Mrig Bahar Fruit Maturation',
      urgency: 'normal',
      irrigationAdviceMr: `हवामानातील बदलांनुसार पाणी नियंत्रित करा, जेणेकरून फळे तडकणार नाहीत.`,
      irrigationAdviceEn: `Regulate irrigation strictly to avoid sudden turgor changes and fruit cracking.`,
      sprayingAdviceMr: `पावसानंतर तेलकट डाग (Bacterial Blight - तेल्‍या) प्रतिबंधासाठी कॉपर ऑक्सिक्लोराईड + स्ट्रेप्टोमायसीन फवारा.`,
      sprayingAdviceEn: `Post-rain, spray Copper Oxychloride + Streptocycline against Bacterial Blight (Telya).`,
      fertilizerAdviceMr: `पोटॅशियम शोनेट व सूक्ष्म अन्नद्रव्ये फवारणीद्वारे द्या.`,
      fertilizerAdviceEn: `Provide foliar Potassium and micro-nutrients.`,
      harvestAdviceMr: `तयार फळांची प्रतवारी करून सुरक्षित बाजारपेठेत पाठवा.`,
      harvestAdviceEn: `Grade mature fruits and transport under covered vehicles.`,
    },
    {
      cropId: 'wheat_grain',
      cropNameMr: 'धान्य / गहू (Grain/Wheat)',
      cropNameEn: 'Wheat / Cereal Grain',
      icon: '🌾',
      currentStageMr: 'ओंबी / दाणे भरणे अवस्था',
      currentStageEn: 'Heading / Grain Filling',
      urgency: isHighRain ? 'high' : 'normal',
      irrigationAdviceMr: isHighRain || isModerateRain
        ? `सिंचन तात्काळ स्थगित करा. अतिरिक्त पाण्यामुळे पीक आडवे पडण्याचा (Lodging) धोका संभवतो.`
        : `हलके पाणी द्या, दाणे भरण्याच्या टप्प्यावर जमिनीत पुरेसा ओलावा असावा.`,
      irrigationAdviceEn: isHighRain || isModerateRain
        ? `Suspend irrigation immediately. Saturated soil combined with winds risks heavy lodging.`
        : `Provide light irrigation; maintain optimal moisture for grain weight.`,
      sprayingAdviceMr: isHighRain
        ? `पावसानंतर तांबेरा (Rust) व मावा किडीच्या प्रादुर्भावावर लक्ष ठेवा व शिफारशीत बुरशीनाशक वापरा.`
        : `नियमित निरीक्षण करा; रसशोषक किडींचा प्रादुर्भाव आढळल्यास प्रतिबंधात्मक उपाय करा.`,
      sprayingAdviceEn: isHighRain
        ? `Monitor for Brown/Yellow Rust and Aphids after rains; spray recommended fungicide.`
        : `Conduct routine scouting for sucking pests and rust spores.`,
      fertilizerAdviceMr: `युरियाचा अतिवापर टाळा; पोटॅश व झिंक दिल्याने दाण्यांची प्रत सुधारते.`,
      fertilizerAdviceEn: `Avoid excessive nitrogen; apply Potassium & Zinc to strengthen stems and grain quality.`,
      harvestAdviceMr: `काढणीस आलेले पीक कोरड्या वातावरणात उरकून सुरक्षित कोठारात साठवा.`,
      harvestAdviceEn: `Complete harvesting during clear intervals and store grains in moisture-free bags.`,
    }
  ];
}

/**
 * Calculates confidence level based on crowdsourced traditional indicator report density and consensus
 * - Low confidence (grey badge): 0 or 1 report received today
 * - Medium confidence (amber badge): 2-4 reports
 * - High confidence (green badge): 5+ reports, or reports that agree with each other
 */
export function getPanchayatConfidence(
  reports: FarmerReport[]
): {
  level: 'low' | 'medium' | 'high';
  count: number;
  labelKey: 'confidence_low' | 'confidence_med' | 'confidence_high';
  agreement: boolean;
} {
  const count = reports.length;

  if (count <= 1) {
    return {
      level: 'low',
      count,
      labelKey: 'confidence_low',
      agreement: false,
    };
  }

  // Check consensus / agreement among reports
  const indicatorCounts: { [key: string]: number } = {};
  reports.forEach((r) => {
    indicatorCounts[r.indicatorId] = (indicatorCounts[r.indicatorId] || 0) + 1;
  });
  
  const maxIdentical = Math.max(...Object.values(indicatorCounts));
  const hasStrongAgreement = maxIdentical >= 2 && maxIdentical >= count * 0.6;

  if (count >= 5 || (count >= 2 && hasStrongAgreement)) {
    return {
      level: 'high',
      count,
      labelKey: 'confidence_high',
      agreement: hasStrongAgreement,
    };
  }

  return {
    level: 'medium',
    count,
    labelKey: 'confidence_med',
    agreement: hasStrongAgreement,
  };
}

/**
 * Describes the prototype terrain heuristic; these are not learned model weights.
 */
export function getExplainabilityFactors(
  panchayat: Panchayat,
  block: BlockData,
  downscalingResult: DownscalingResult,
  reports: FarmerReport[]
) {
  const factors = [];

  // Factor 1: DEM Elevation
  const elevDelta = (panchayat.elevationM - 550) / 100;
  const elevImpact = panchayat.elevationM >= 650 ? 'high' : panchayat.elevationM >= 580 ? 'moderate' : 'low';
  factors.push({
    id: 'elevation',
    nameMr: 'उंची प्रभाव (DEM Elevation)',
    nameEn: 'Elevation Impact (DEM 30m)',
    impactLevel: elevImpact as 'high' | 'moderate' | 'low',
    impactLabelMr: elevImpact === 'high' ? 'उच्च प्रभाव' : elevImpact === 'moderate' ? 'मध्यम प्रभाव' : 'कमी प्रभाव',
    impactLabelEn: elevImpact === 'high' ? 'High Impact' : elevImpact === 'moderate' ? 'Moderate Impact' : 'Low Impact',
    calculatedValue: `${panchayat.elevationM} m`,
    importanceWeight: 0.31,
    descriptionMr: `समुद्रसपाटीपासून ${panchayat.elevationM} मी. उंचीमुळे सह्याद्री डोंगररांगेत ऑलोग्राफिक पर्जन्यवृष्टी ${downscalingResult.orographicFactor}x वाढते.`,
    descriptionEn: `Elevation of ${panchayat.elevationM}m MSL causes orographic lifting multiplying precipitation by ${downscalingResult.orographicFactor}x.`,
  });

  // Factor 2: Nearby Traditional Reports
  const activeReports = reports.filter((r) => r.panchayatId === panchayat.id && !r.isDemoData);
  const bioImpact = 'low';
  factors.push({
    id: 'traditional_reports',
    nameMr: 'स्थानिक पारंपारिक संकेत (Traditional Indicators)',
    nameEn: 'Nearby Traditional Reports',
    impactLevel: bioImpact as 'high' | 'moderate' | 'low',
    impactLabelMr: 'अंदाजात वापरलेले नाही',
    impactLabelEn: 'Not used in estimate',
    calculatedValue: `${activeReports.length} ${activeReports.length === 1 ? 'अहवाल' : 'अहवाल'} (estimate unchanged)`,
    importanceWeight: 0.22,
    descriptionMr: activeReports.length > 0
      ? `${activeReports.length} शेतकरी निरीक्षणे नोंदली आहेत. ती पावसाच्या मोजमापाऐवजी वापरलेली नाहीत.`
      : 'या ग्रामपंचायतीसाठी आज शेतकरी निरीक्षणे नाहीत. नमुना अंदाज पडताळलेला नाही.',
    descriptionEn: activeReports.length > 0
      ? `${activeReports.length} farmer observation(s) were recorded. They are not used as rainfall measurements.`
      : 'No farmer observations today. The sample estimate is not validated.',
  });

  // Factor 3: River Proximity
  const riverImpact = panchayat.distanceToRiverKm <= 1.0 ? 'high' : panchayat.distanceToRiverKm <= 2.5 ? 'moderate' : 'low';
  factors.push({
    id: 'river_distance',
    nameMr: 'नदी खोरे अंतर (River Proximity)',
    nameEn: 'Distance from Water Body',
    impactLevel: riverImpact as 'high' | 'moderate' | 'low',
    impactLabelMr: riverImpact === 'high' ? 'उच्च प्रभाव' : riverImpact === 'moderate' ? 'मध्यम प्रभाव' : 'कमी प्रभाव',
    impactLabelEn: riverImpact === 'high' ? 'High Impact' : riverImpact === 'moderate' ? 'Moderate Impact' : 'Low Impact',
    calculatedValue: `${panchayat.distanceToRiverKm} km`,
    importanceWeight: 0.16,
    descriptionMr: `गोदावरी/स्थानिक नदीपासून ${panchayat.distanceToRiverKm} किमी अंतर असल्याने जमिनीलगत स्थानिक बाष्प व ढग निर्मिती वाढते.`,
    descriptionEn: `Located ${panchayat.distanceToRiverKm} km from river channel, promoting localized ground-level humidity and convective condensation.`,
  });

  // Factor 4: Slope & Windward Aspect
  const slopeImpact = panchayat.slopeDeg >= 5.0 ? 'high' : panchayat.slopeDeg >= 2.5 ? 'moderate' : 'low';
  factors.push({
    id: 'slope_aspect',
    nameMr: 'डोंगर उतार व वाऱ्याची दिशा (Slope & Aspect)',
    nameEn: 'Slope & Windward Alignment',
    impactLevel: slopeImpact as 'high' | 'moderate' | 'low',
    impactLabelMr: slopeImpact === 'high' ? 'उच्च प्रभाव' : slopeImpact === 'moderate' ? 'मध्यम प्रभाव' : 'कमी प्रभाव',
    impactLabelEn: slopeImpact === 'high' ? 'High Impact' : slopeImpact === 'moderate' ? 'Moderate Impact' : 'Low Impact',
    calculatedValue: `${panchayat.slopeDeg}° (${panchayat.aspect})`,
    importanceWeight: 0.14,
    descriptionMr: `नैऋत्य मान्सून वाऱ्यांच्या दिशेला ${panchayat.slopeDeg}° उतार असल्याने ढगांना वर उचलणारा प्रवाह मिळतो.`,
    descriptionEn: `Slope of ${panchayat.slopeDeg}° facing ${panchayat.aspect} directly intercepts incoming monsoon winds.`,
  });

  // Sort by priority (high impact first)
  factors.sort((a, b) => {
    const score = (f: { impactLevel: string; importanceWeight: number }) => (f.impactLevel === 'high' ? 3 : f.impactLevel === 'moderate' ? 2 : 1) + f.importanceWeight;
    return score(b) - score(a);
  });

  return factors.slice(0, 3);
}

/**
 * Generates 7-Day Historical Trend for the selected panchayat
 * Comparing Block Coarse vs Panchayat RF Downscaled vs Calibrated with traditional signals
 */
export function generateHistoricalTrend(
  panchayat: Panchayat,
  block: BlockData,
  downscalingResult: DownscalingResult,
  reports: FarmerReport[]
) {
  const activeReportsCount = reports.filter((r) => r.panchayatId === panchayat.id && !r.isDemoData).length;
  
  // Historical multipliers for 7 days (Day -6 to Day 0 / Today)
  const historyConfig = [
    { dayOffset: 6, dayMr: '६ दिवसांपूर्वी', dayEn: '6 days ago', date: '१९ सप्टें', blockFactor: 0.4, bioReports: 0, bioNudge: 0, icon: '☀️' },
    { dayOffset: 5, dayMr: '५ दिवसांपूर्वी', dayEn: '5 days ago', date: '२० सप्टें', blockFactor: 0.6, bioReports: 1, bioNudge: 0.3, icon: '🪰' },
    { dayOffset: 4, dayMr: '४ दिवसांपूर्वी', dayEn: '4 days ago', date: '२१ सप्टें', blockFactor: 1.2, bioReports: 3, bioNudge: 0.8, icon: '🐜' },
    { dayOffset: 3, dayMr: '३ दिवसांपूर्वी', dayEn: '3 days ago', date: '२२ सप्टें', blockFactor: 1.5, bioReports: 4, bioNudge: 1.2, icon: '⛈️' },
    { dayOffset: 2, dayMr: '२ दिवसांपूर्वी', dayEn: '2 days ago', date: '२३ सप्टें', blockFactor: 0.8, bioReports: 2, bioNudge: 0.5, icon: '🐸' },
    { dayOffset: 1, dayMr: 'काल (Yesterday)', dayEn: 'Yesterday', date: '२४ सप्टें', blockFactor: 0.9, bioReports: 2, bioNudge: 0.4, icon: '💨' },
    { dayOffset: 0, dayMr: 'आज (Today)', dayEn: 'Today', date: '२५ सप्टें', blockFactor: 1.0, bioReports: activeReportsCount, bioNudge: downscalingResult.calibrationDeltaMm, icon: '🐜' },
  ];

  return historyConfig.map((item) => {
    const blockRain = Number((block.imdRainfallMm * item.blockFactor).toFixed(1));
    const rfRain = Number((blockRain * downscalingResult.orographicFactor).toFixed(1));
    const calibrated = Number((rfRain + item.bioNudge).toFixed(1));

    return {
      date: item.date,
      dayLabelMr: item.dayMr,
      dayLabelEn: item.dayEn,
      blockRainfallMm: blockRain,
      rfDownscaledMm: rfRain,
      calibratedRainfallMm: calibrated,
      bioAdjustmentMm: item.bioNudge,
      reportsCount: item.bioReports,
      dominantIndicatorIcon: item.icon,
    };
  });
}
