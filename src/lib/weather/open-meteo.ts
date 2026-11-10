/**
 * Daily forecast from Open-Meteo (free, no API key; non-commercial use only on
 * the free tier, so revisit before a public launch). Fetched by the Worker.
 */

export type Weather = {
  date: string; // YYYY-MM-DD, local to the location
  code: number; // WMO weather code
  high: number; // °C
  low: number;
  feelsHigh: number;
  feelsLow: number;
  precipChance: number; // %
  precipMm: number;
  windKmh: number;
  uv: number | null;
};

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "wind_speed_10m_max",
  "uv_index_max",
] as const;

type Daily = Record<(typeof DAILY_FIELDS)[number], (number | null)[]> & { time: string[] };

function baseUrl() {
  return process.env.OPEN_METEO_URL ?? "https://api.open-meteo.com";
}

/** The forecast for one local date, or null if it can't be fetched. */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Weather | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: DAILY_FIELDS.join(","),
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  try {
    const res = await fetchImpl(`${baseUrl()}/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { daily?: Daily };
    return parseDaily(body.daily, date);
  } catch {
    return null;
  }
}

export function parseDaily(daily: Daily | undefined, date: string): Weather | null {
  const i = daily?.time?.indexOf(date) ?? -1;
  if (!daily || i < 0) return null;
  const n = (key: (typeof DAILY_FIELDS)[number]) => {
    const v = daily[key]?.[i];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const high = n("temperature_2m_max");
  const low = n("temperature_2m_min");
  if (high === null || low === null) return null;
  return {
    date,
    code: n("weather_code") ?? 0,
    high: Math.round(high),
    low: Math.round(low),
    feelsHigh: Math.round(n("apparent_temperature_max") ?? high),
    feelsLow: Math.round(n("apparent_temperature_min") ?? low),
    precipChance: Math.round(n("precipitation_probability_max") ?? 0),
    precipMm: Math.round((n("precipitation_sum") ?? 0) * 10) / 10,
    windKmh: Math.round(n("wind_speed_10m_max") ?? 0),
    uv: n("uv_index_max"),
  };
}

/** Short label for a WMO weather code. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed";
}

function isSnow(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

/** The forecast as one or two plain sentences, for the AI stylist. */
export function describeWeather(w: Weather): string {
  const parts = [
    `${weatherLabel(w.code)}, high ${w.high}°C, low ${w.low}°C (feels like ${w.feelsLow} to ${w.feelsHigh}°C).`,
  ];
  if (w.precipChance >= 30 || w.precipMm >= 1) {
    const kind = isSnow(w.code) ? "snow" : "rain";
    parts.push(`${w.precipChance}% chance of ${kind}${w.precipMm ? ` (${w.precipMm} mm)` : ""}.`);
  }
  if (w.windKmh >= 30) parts.push(`Windy, up to ${w.windKmh} km/h.`);
  if (w.uv !== null && w.uv >= 6) parts.push(`High UV (${Math.round(w.uv)}).`);
  return parts.join(" ");
}

const FAHRENHEIT_REGIONS = new Set(["US", "LR", "MM", "BS", "BZ", "KY", "PW", "FM", "MH"]);

/** True when the browser's preferred locale uses Fahrenheit (e.g. en-US). */
export function prefersFahrenheit(acceptLanguage: string | null | undefined): boolean {
  const first = acceptLanguage?.split(",")[0]?.trim() ?? "";
  const region = first.split(/[-_]/)[1]?.toUpperCase();
  return region ? FAHRENHEIT_REGIONS.has(region) : false;
}

export function formatTemp(celsius: number, fahrenheit: boolean): string {
  return fahrenheit ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}
