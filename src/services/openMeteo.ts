import { BlockData } from '../types';

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    precipitation_sum?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
  current?: {
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    cloud_cover?: number;
  };
  error?: boolean;
  reason?: string;
}

const compassDirection = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % directions.length];
};

export async function fetchBlockForecast(block: BlockData, signal?: AbortSignal): Promise<BlockData> {
  const params = new URLSearchParams({
    latitude: String(block.centerLat),
    longitude: String(block.centerLng),
    daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    current: 'relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover',
    timezone: 'Asia/Kolkata',
    forecast_days: '3',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Forecast provider returned ${response.status}`);
  const data = await response.json() as OpenMeteoResponse;
  if (data.error || !data.daily?.time?.[0]) throw new Error(data.reason || 'Forecast data was unavailable');

  const rainfall = data.daily.precipitation_sum?.[0];
  const tempMax = data.daily.temperature_2m_max?.[0];
  const tempMin = data.daily.temperature_2m_min?.[0];
  if (![rainfall, tempMax, tempMin].every((value) => Number.isFinite(value))) {
    throw new Error('Forecast response was incomplete');
  }

  const direction = data.current?.wind_direction_10m;
  const forecastDays = data.daily.time.map((date, index) => ({
    date,
    rainfallMm: data.daily?.precipitation_sum?.[index] ?? 0,
    tempMaxC: data.daily?.temperature_2m_max?.[index] ?? (tempMax as number),
    tempMinC: data.daily?.temperature_2m_min?.[index] ?? (tempMin as number),
    precipitationProbabilityPct: data.daily?.precipitation_probability_max?.[index] ?? 0,
  }));
  return {
    ...block,
    imdRainfallMm: rainfall as number,
    imdTempMaxC: tempMax as number,
    imdTempMinC: tempMin as number,
    imdHumidityPct: data.current?.relative_humidity_2m ?? block.imdHumidityPct,
    imdWindSpeedKmh: data.current?.wind_speed_10m ?? block.imdWindSpeedKmh,
    imdWindDirection: Number.isFinite(direction) ? compassDirection(direction as number) : block.imdWindDirection,
    imdCloudCoverPct: data.current?.cloud_cover ?? block.imdCloudCoverPct,
    imdForecastDate: data.daily.time[0],
    isDemoForecast: false,
    forecastDays,
  };
}
