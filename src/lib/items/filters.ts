import {
  CATEGORIES,
  COLOR_NAMES,
  SEASONS,
  type Category,
  type Color,
  type Season,
} from "./vocabulary";

/** "all" shows active + laundry; archived items only appear when asked for. */
export const STATUS_FILTERS = ["all", "laundry", "archived", "review"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type ClosetFilters = {
  category: Category | null;
  color: Color | null;
  season: Season | null;
  status: StatusFilter;
  q: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads closet filters from the URL, ignoring anything not in the vocabulary. */
export function parseClosetFilters(params: SearchParams): ClosetFilters {
  return {
    category: pick(params.category, CATEGORIES),
    color: pick(params.color, COLOR_NAMES),
    season: pick(params.season, SEASONS),
    status: pick(params.status, STATUS_FILTERS) ?? "all",
    q: first(params.q)?.trim().slice(0, 60) ?? "",
  };
}

export function hasActiveFilters(filters: ClosetFilters): boolean {
  return Boolean(
    filters.category || filters.color || filters.season || filters.q || filters.status !== "all",
  );
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | null {
  const v = first(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
