  export interface CropOption {
  id: string;
  nameMr: string;
  nameEn: string;
  icon: string;
  growthStages: {
    id: string;
    nameMr: string;
    nameEn: string;
    descriptionMr?: string;
    descriptionEn?: string;
  }[];
}

export const CROPS_WITH_STAGES: CropOption[] = [
  {
    id: 'onion',
    nameMr: 'कांदा (Onion)',
    nameEn: 'Onion',
    icon: '🧅',
    growthStages: [
      { id: 'nursery', nameMr: 'रोपवाटिका (Nursery/Seedling)', nameEn: 'Nursery Stage' },
      { id: 'transplanting', nameMr: 'पुनर्लागवड (Transplanting)', nameEn: 'Transplanting' },
      { id: 'bulb_development', nameMr: 'कंद फुगवण (Bulb Development)', nameEn: 'Bulb Development' },
      { id: 'near_harvest', nameMr: 'काढणी पूर्व अवस्था (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'grapes',
    nameMr: 'द्राक्ष (Grapes)',
    nameEn: 'Grapes',
    icon: '🍇',
    growthStages: [
      { id: 'pruning', nameMr: 'छाटणी अवस्था (Pruning)', nameEn: 'Pruning Stage' },
      { id: 'flowering', nameMr: 'फुलोरा अवस्था (Flowering)', nameEn: 'Flowering Stage' },
      { id: 'berry_formation', nameMr: 'मणी तयार होणे (Berry Formation)', nameEn: 'Berry Formation' },
      { id: 'veraison', nameMr: 'वेरायझन / साखर भरणे (Veraison)', nameEn: 'Veraison Stage' },
      { id: 'near_harvest', nameMr: 'काढणी पूर्व अवस्था (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'tomato',
    nameMr: 'टोमॅटो (Tomato)',
    nameEn: 'Tomato',
    icon: '🍅',
    growthStages: [
      { id: 'vegetative', nameMr: 'शाकीय वाढ (Vegetative)', nameEn: 'Vegetative Growth' },
      { id: 'flowering', nameMr: 'फुलधारणा अवस्था (Flowering)', nameEn: 'Flowering Stage' },
      { id: 'fruit_development', nameMr: 'फळ विकास (Fruit Setting)', nameEn: 'Fruit Development' },
      { id: 'near_harvest', nameMr: 'तोडणी पूर्व (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'wheat_grain',
    nameMr: 'धान्य / गहू (Wheat/Grain)',
    nameEn: 'Grain / Wheat',
    icon: '🌾',
    growthStages: [
      { id: 'vegetative', nameMr: 'फुटवे फुटणे (Tillering)', nameEn: 'Tillering Stage' },
      { id: 'flowering', nameMr: 'ओंबी / फुलोरा (Heading/Flowering)', nameEn: 'Heading / Flowering' },
      { id: 'grain_filling', nameMr: 'दाणे भरणे (Grain Filling)', nameEn: 'Grain Filling' },
      { id: 'near_harvest', nameMr: 'काढणी पूर्व (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'pomegranate',
    nameMr: 'डाळिंब (Pomegranate)',
    nameEn: 'Pomegranate',
    icon: '🍎',
    growthStages: [
      { id: 'flowering', nameMr: 'बहार / फुलधारणा (Flowering/Bahar)', nameEn: 'Flowering Stage' },
      { id: 'fruit_maturation', nameMr: 'फळ पक्वता (Fruit Maturation)', nameEn: 'Fruit Maturation' },
      { id: 'near_harvest', nameMr: 'काढणी पूर्व (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'soybean',
    nameMr: 'सोयाबीन (Soybean)',
    nameEn: 'Soybean',
    icon: '🌱',
    growthStages: [
      { id: 'vegetative', nameMr: 'वाढ अवस्था (Vegetative)', nameEn: 'Vegetative Stage' },
      { id: 'flowering', nameMr: 'फुलोरा (Flowering)', nameEn: 'Flowering' },
      { id: 'pod_development', nameMr: 'शेंगा भरणे (Pod Filling)', nameEn: 'Pod Filling' },
      { id: 'near_harvest', nameMr: 'काढणी पूर्व (Near Harvest)', nameEn: 'Near Harvest' },
    ],
  },
  {
    id: 'leafy_greens',
    nameMr: 'पालेभाज्या (Leafy Greens)',
    nameEn: 'Leafy Greens',
    icon: '🥬',
    growthStages: [
      { id: 'nursery', nameMr: 'रोपवाटिका (Nursery)', nameEn: 'Nursery' },
      { id: 'vegetative', nameMr: 'पाने वाढण्याची अवस्था (Leaf Growth)', nameEn: 'Leaf Growth' },
      { id: 'near_harvest', nameMr: 'काढणीची अवस्था (Harvest)', nameEn: 'Harvest' },
    ],
  },
];

export interface CropSpecificAdvisoryResult {
  mr: string;
  en: string;
}

/**
 * Rule-based crop-and-stage specific agro-meteorological advisory function.
 * Matches exact Python specification:
 * Returns { mr, en } if a known risk rule matches, otherwise null (falls back to generic).
 */
export function generateCropAdvisory(
  cropType: string,
  growthStage: string,
  rainMm: number
): CropSpecificAdvisoryResult | null {
  if (cropType === 'onion' && growthStage === 'near_harvest' && rainMm > 5.0) {
    return {
      mr: 'काढणी २ दिवस पुढे ढकला — या टप्प्यावर पावसामुळे कांदा सडण्याचा धोका आहे.',
      en: 'Delay harvest by 2 days if possible — rain risks bulb rot at this stage.',
    };
  }

  if (cropType === 'grapes' && growthStage === 'berry_formation' && rainMm > 5.0) {
    return {
      mr: 'मोठा धोका — मणी तयार होताना पावसामुळे द्राक्ष तडकण्याची शक्यता. संरक्षणात्मक आवरण वापरा.',
      en: 'High risk — rain during berry formation can cause splitting. Consider protective cover.',
    };
  }

  if (cropType === 'tomato' && growthStage === 'flowering' && rainMm > 4.0) {
    return {
      mr: 'फुलगळ रोखण्यासाठी तातडीने सूक्ष्म अन्नद्रव्ये फवारणीचे नियोजन करा आणि अतिरिक्त पाणी साचू देऊ नका.',
      en: 'High risk of flower drop due to rain. Ensure active root-zone drainage and schedule post-rain sprays.',
    };
  }

  if (cropType === 'pomegranate' && growthStage === 'fruit_maturation' && rainMm > 5.0) {
    return {
      mr: 'अति ओलाव्यामुळे फळे तडकण्याची शक्यता — सिंचन त्वरित थांबवा व चर खोदून निचरा करा.',
      en: 'Excess moisture risks fruit cracking at this maturity stage. Stop all irrigation and ensure drain trenches.',
    };
  }

  if (cropType === 'wheat_grain' && growthStage === 'near_harvest' && rainMm > 4.0) {
    return {
      mr: 'पावसामुळे पीक लोळण्याची (lodging) व दाणे भिजून काळे पडण्याची शक्यता — काढणी झालेला माल तात्काळ सुरक्षित ठिकाणी हलवा.',
      en: 'Rain at harvest stage risks crop lodging and grain damage. Move harvested grain to dry storage immediately.',
    };
  }

  return null;
}

export interface FarmerProfileSettings {
  cropType: string | null;
  growthStage: string | null;
  isConfigured: boolean;
}

const STORAGE_KEY = 'varshagyan_farmer_profile';

export function loadFarmerProfile(): FarmerProfileSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          cropType: parsed.cropType || 'grapes',
          growthStage: parsed.growthStage || 'berry_formation',
          isConfigured: parsed.isConfigured !== false,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    cropType: 'grapes',
    growthStage: 'berry_formation',
    isConfigured: false,
  };
}

export function saveFarmerProfile(profile: FarmerProfileSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}
