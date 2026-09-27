import { BlockData } from '../types';

// A fixed, illustrative scenario for recording and rehearsing the prototype.
// These values are deliberately separate from the Open-Meteo live feed.
const RAINFALL_BY_BLOCK_MM: Record<string, number> = {
  niphad: 24,
  dindori: 29,
  igatpuri: 38,
  trimbak: 33,
  sinnar: 15,
  satana: 18,
};

export const DEMO_ALERT_EN = 'Rain expected today. Avoid low-lying areas, protect harvested crops, and follow local advisories.';
export const DEMO_ALERT_MR = 'आज पावसाची शक्यता आहे. सखल भागात जाणे टाळा, काढलेली पिके सुरक्षित ठेवा आणि स्थानिक सूचनांचे पालन करा.';

function isoDateAfterDays(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDemoWeatherByBlock(blocks: BlockData[]): Record<string, BlockData> {
  return Object.fromEntries(blocks.map((block) => {
    const rainToday = RAINFALL_BY_BLOCK_MM[block.id] ?? 20;
    const rainfall = [rainToday, Number((rainToday * 0.55).toFixed(1)), Number((rainToday * 0.25).toFixed(1))];
    const probabilities = [82, 58, 32];
    const dates = [isoDateAfterDays(0), isoDateAfterDays(1), isoDateAfterDays(2)];
    const forecastDays = dates.map((date, index) => ({
      date,
      rainfallMm: rainfall[index],
      tempMaxC: Number((block.imdTempMaxC - 1 + index * 0.5).toFixed(1)),
      tempMinC: Number((block.imdTempMinC + index * 0.3).toFixed(1)),
      precipitationProbabilityPct: probabilities[index],
    }));

    return [block.id, {
      ...block,
      imdRainfallMm: rainToday,
      imdTempMaxC: forecastDays[0].tempMaxC,
      imdTempMinC: forecastDays[0].tempMinC,
      imdHumidityPct: 86,
      imdWindSpeedKmh: 18,
      imdWindDirection: 'SW',
      imdCloudCoverPct: 88,
      imdForecastDate: 'Illustrative demo scenario',
      isDemoForecast: true,
      forecastDays,
    } satisfies BlockData];
  }));
}
