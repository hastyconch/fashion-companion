/**
 * City search for the weather location, called from the browser (Open-Meteo
 * allows that, and it keeps the request off our Worker). Free, no API key;
 * non-commercial use only on the free tier, so revisit before a public launch.
 */
export type Place = {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

type ApiResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${GEOCODING_URL}?${new URLSearchParams({ name: q, count: "6", language: "en", format: "json" })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const body = (await res.json()) as { results?: ApiResult[] };
  return (body.results ?? []).map(toPlace);
}

export function toPlace(r: ApiResult): Place {
  const parts = [r.name, r.admin1, r.country].filter(
    (p, i, all): p is string => Boolean(p) && all.indexOf(p) === i,
  );
  return {
    id: r.id,
    label: parts.join(", ").slice(0, 120),
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
  };
}
