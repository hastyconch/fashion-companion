import { describe, expect, it, vi } from "vitest";

import {
  describeWeather,
  fetchWeather,
  formatTemp,
  parseDaily,
  prefersFahrenheit,
  weatherLabel,
  type Weather,
} from "./open-meteo";

const DAILY = {
  time: ["2026-11-13"],
  weather_code: [61],
  temperature_2m_max: [14.4],
  temperature_2m_min: [7.6],
  apparent_temperature_max: [12.2],
  apparent_temperature_min: [4.9],
  precipitation_probability_max: [72],
  precipitation_sum: [4.26],
  wind_speed_10m_max: [34.8],
  uv_index_max: [1.2],
};

const RAINY: Weather = {
  date: "2026-11-13",
  code: 61,
  high: 14,
  low: 8,
  feelsHigh: 12,
  feelsLow: 5,
  precipChance: 72,
  precipMm: 4.3,
  windKmh: 35,
  uv: 1.2,
};

describe("parseDaily", () => {
  it("reads one day's forecast, rounded", () => {
    expect(parseDaily(DAILY, "2026-11-13")).toEqual(RAINY);
  });

  it("returns null for a missing date or temperatures", () => {
    expect(parseDaily(DAILY, "2026-11-14")).toBeNull();
    expect(parseDaily({ ...DAILY, temperature_2m_max: [null] }, "2026-11-13")).toBeNull();
    expect(parseDaily(undefined, "2026-11-13")).toBeNull();
  });
});

describe("describeWeather", () => {
  it("mentions rain, wind and feels-like temperatures", () => {
    expect(describeWeather(RAINY)).toBe(
      "Rain, high 14°C, low 8°C (feels like 5 to 12°C). 72% chance of rain (4.3 mm). Windy, up to 35 km/h.",
    );
  });

  it("stays short on a calm, dry day and flags strong sun", () => {
    expect(
      describeWeather({ ...RAINY, code: 0, high: 30, low: 20, feelsHigh: 32, feelsLow: 20, precipChance: 0, precipMm: 0, windKmh: 10, uv: 8.4 }),
    ).toBe("Clear, high 30°C, low 20°C (feels like 20 to 32°C). High UV (8).");
  });

  it("calls snow snow", () => {
    expect(describeWeather({ ...RAINY, code: 73 })).toContain("chance of snow");
  });
});

describe("weatherLabel", () => {
  it("groups WMO codes", () => {
    expect([0, 2, 3, 45, 53, 63, 75, 81, 95].map(weatherLabel)).toEqual([
      "Clear", "Partly cloudy", "Cloudy", "Fog", "Drizzle", "Rain", "Snow", "Showers", "Thunderstorms",
    ]);
  });
});

describe("fetchWeather", () => {
  it("requests the right day and parses it", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ daily: DAILY })));
    const weather = await fetchWeather(38.72, -9.13, "2026-11-13", fetchImpl as unknown as typeof fetch);
    expect(weather).toEqual(RAINY);
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("start_date")).toBe("2026-11-13");
    expect(url.searchParams.get("latitude")).toBe("38.72");
  });

  it("returns null instead of failing when the service is down", async () => {
    const down = vi.fn(async () => new Response("nope", { status: 503 }));
    const broken = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await fetchWeather(0, 0, "2026-11-13", down as unknown as typeof fetch)).toBeNull();
    expect(await fetchWeather(0, 0, "2026-11-13", broken as unknown as typeof fetch)).toBeNull();
  });
});

describe("units", () => {
  it("uses Fahrenheit for US-style locales only", () => {
    expect(prefersFahrenheit("en-US,en;q=0.9")).toBe(true);
    expect(prefersFahrenheit("en-GB,en;q=0.9")).toBe(false);
    expect(prefersFahrenheit("pt")).toBe(false);
    expect(prefersFahrenheit(null)).toBe(false);
    expect(formatTemp(14, true)).toBe("57°F");
    expect(formatTemp(14, false)).toBe("14°C");
  });
});
