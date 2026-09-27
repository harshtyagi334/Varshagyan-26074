"""
VarshaGyan - Agro-Meteorological Advisory Database & ML Validation Engine (SIH26074)
Ministry of Earth Sciences / India Meteorological Department
"""


# 1. Rule-based crop-and-stage specific agro-meteorological advisory function
def generate_crop_advisory(crop_type: str, growth_stage: str, rain_mm: float) -> dict | None:
    """
    Returns a crop-specific advisory dict {mr, en} if a known risk rule matches,
    otherwise None (caller falls back to the existing generic advisory — do not
    change that fallback behavior).
    """
    # Onion near-harvest risk
    if crop_type == "onion" and growth_stage == "near_harvest" and rain_mm > 5.0:
        return {
            "mr": "काढणी २ दिवस पुढे ढकला — या टप्प्यावर पावसामुळे कांदा सडण्याचा धोका आहे.",
            "en": "Delay harvest by 2 days if possible — rain risks bulb rot at this stage."
        }
    
    # Grapes berry-formation risk
    if crop_type == "grapes" and growth_stage == "berry_formation" and rain_mm > 5.0:
        return {
            "mr": "मोठा धोका — मणी तयार होताना पावसामुळे द्राक्ष तडकण्याची शक्यता. संरक्षणात्मक आवरण वापरा.",
            "en": "High risk — rain during berry formation can cause splitting. Consider protective cover."
        }
    
    # Tomato flowering risk
    if crop_type == "tomato" and growth_stage == "flowering" and rain_mm > 4.0:
        return {
            "mr": "फुलगळ रोखण्यासाठी तातडीने सूक्ष्म अन्नद्रव्ये फवारणीचे नियोजन करा आणि अतिरिक्त पाणी साचू देऊ नका.",
            "en": "High risk of flower drop due to rain. Ensure active root-zone drainage and schedule post-rain sprays."
        }

    # Pomegranate fruit maturation risk
    if crop_type == "pomegranate" and growth_stage == "fruit_maturation" and rain_mm > 5.0:
        return {
            "mr": "अति ओलाव्यामुळे फळे तडकण्याची शक्यता — सिंचन त्वरित थांबवा व चर खोदून निचरा करा.",
            "en": "Excess moisture risks fruit cracking at this maturity stage. Stop all irrigation and ensure drain trenches."
        }

    return None


# Validation is intentionally not computed here. The prototype does not contain
# timestamp-aligned IMD block forecasts and local rain-gauge observations. Any
# metrics calculated from generated/simulated values would not validate the
# Panchayat downscaling method.
