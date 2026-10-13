/**
 * Reads for the OurAirports side of mcps/airports (fleet #2977).
 *
 * Data: OurAirports bulk CSV export (davidmegginson.github.io/ourairports-data,
 * a public mirror of ourairports.com's own data). Per ourairports.com/data/:
 * "All data is released to the Public Domain, and comes with no guarantee of
 * accuracy or fitness for use." Loaded into a D1 database the gateway hands
 * this pack as `_d1` (pack-manifest "d1Binding": "OURAIRPORTS_DB") by
 * scripts/ourairports/load-data.mjs -- never by a deploy.
 *
 * Six tables, loaded whole (all small at OurAirports' scale -- nothing here
 * needs aggregation): oa_airport (every airfield, ~86k rows, incl.
 * ICAO-only idents, heliports, seaplane bases, closed fields), oa_runway,
 * oa_frequency, oa_navaid (joined to an airport via associated_airport ->
 * oa_airport.ident), oa_country, oa_region.
 */

export interface D1Like {
  prepare(sql: string): D1StmtLike;
}
export interface D1StmtLike {
  bind(...values: unknown[]): D1StmtLike;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export class StoreUnavailableError extends Error {
  constructor() {
    super(
      'airports: the OurAirports store is not bound in this runtime (no _d1). These tools only answer through the Pipeworx gateway; a standalone install has no data to read.',
    );
    this.name = 'StoreUnavailableError';
  }
}
export function requireDb(d1: unknown): D1Like {
  if (!d1 || typeof (d1 as D1Like).prepare !== 'function') throw new StoreUnavailableError();
  return d1 as D1Like;
}

export const SOURCE = {
  source: 'OurAirports bulk data export',
  source_url: 'https://ourairports.com/data/',
  license: 'Public Domain (ourairports.com/data/: "All data is released to the Public Domain, and comes with no guarantee of accuracy or fitness for use.")',
};

export interface Meta {
  loaded_at: string;
  airport_count: number;
  runway_count: number;
  frequency_count: number;
  navaid_count: number;
}
let cachedMeta: Meta | null = null;
export async function getMeta(db: D1Like): Promise<Meta> {
  if (cachedMeta) return cachedMeta;
  const r = await db.prepare('SELECT key, value FROM oa_meta').all<{ key: string; value: string }>();
  const m = Object.fromEntries(r.results.map((row) => [row.key, row.value]));
  cachedMeta = {
    loaded_at: m.loaded_at ?? '',
    airport_count: Number(m.airport_count ?? 0),
    runway_count: Number(m.runway_count ?? 0),
    frequency_count: Number(m.frequency_count ?? 0),
    navaid_count: Number(m.navaid_count ?? 0),
  };
  return cachedMeta;
}

/** Any non-empty string, trimmed and upper-cased -- OurAirports idents/ICAO/
 *  IATA/GPS codes are all stored upper-case. Returns null for empty input,
 *  never throws, so callers can decide how to report "no code given". */
export function normCode(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim().toUpperCase();
  return s.length > 0 ? s : null;
}

export interface AirportRow {
  id: number;
  ident: string;
  type: string;
  name: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  continent: string | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  scheduled_service: string | null;
  icao_code: string | null;
  iata_code: string | null;
  gps_code: string | null;
  local_code: string | null;
  home_link: string | null;
  wikipedia_link: string | null;
  keywords: string | null;
}

function shapeAirport(r: AirportRow) {
  return {
    ident: r.ident,
    type: r.type,
    name: r.name,
    latitude_deg: r.latitude_deg,
    longitude_deg: r.longitude_deg,
    elevation_ft: r.elevation_ft,
    continent: r.continent,
    iso_country: r.iso_country,
    iso_region: r.iso_region,
    municipality: r.municipality,
    scheduled_service: r.scheduled_service === 'yes',
    icao_code: r.icao_code || null,
    iata_code: r.iata_code || null,
    gps_code: r.gps_code || null,
    local_code: r.local_code || null,
    home_link: r.home_link || null,
    wikipedia_link: r.wikipedia_link || null,
  };
}

const AIRPORT_COLS =
  'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords';

/**
 * Resolve any caller-supplied code to one airport row. Tried in priority
 * order against separate single-column queries (not one OR'd query) so a
 * code that happens to collide across columns (e.g. an IATA code matching a
 * different airport's local ident) resolves deterministically: OurAirports'
 * own canonical `ident` wins, then `icao_code`, then `gps_code` (ICAO-only
 * fields set by some non-US authorities), then `iata_code`.
 */
export async function lookupAirport(db: D1Like, code: string): Promise<AirportRow | null> {
  for (const col of ['ident', 'icao_code', 'gps_code', 'iata_code']) {
    const r = await db.prepare(`SELECT ${AIRPORT_COLS} FROM oa_airport WHERE ${col} = ? LIMIT 1`).bind(code).first<AirportRow>();
    if (r) return r;
  }
  return null;
}

export { shapeAirport };

export interface RunwayRow {
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: number;
  closed: number;
  le_ident: string | null;
  le_latitude_deg: number | null;
  le_longitude_deg: number | null;
  le_elevation_ft: number | null;
  le_heading_degt: number | null;
  le_displaced_threshold_ft: number | null;
  he_ident: string | null;
  he_latitude_deg: number | null;
  he_longitude_deg: number | null;
  he_elevation_ft: number | null;
  he_heading_degt: number | null;
  he_displaced_threshold_ft: number | null;
}

function shapeRunway(r: RunwayRow) {
  return {
    length_ft: r.length_ft,
    width_ft: r.width_ft,
    surface: r.surface,
    lighted: !!r.lighted,
    closed: !!r.closed,
    low_end: {
      ident: r.le_ident,
      latitude_deg: r.le_latitude_deg,
      longitude_deg: r.le_longitude_deg,
      elevation_ft: r.le_elevation_ft,
      heading_degT: r.le_heading_degt,
      displaced_threshold_ft: r.le_displaced_threshold_ft,
    },
    high_end: {
      ident: r.he_ident,
      latitude_deg: r.he_latitude_deg,
      longitude_deg: r.he_longitude_deg,
      elevation_ft: r.he_elevation_ft,
      heading_degT: r.he_heading_degt,
      displaced_threshold_ft: r.he_displaced_threshold_ft,
    },
  };
}

export async function runwaysForIdent(db: D1Like, ident: string): Promise<ReturnType<typeof shapeRunway>[]> {
  const r = await db
    .prepare(
      'SELECT length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degt,le_displaced_threshold_ft,he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degt,he_displaced_threshold_ft FROM oa_runway WHERE airport_ident = ? ORDER BY length_ft DESC',
    )
    .bind(ident)
    .all<RunwayRow>();
  return r.results.map(shapeRunway);
}

export interface FrequencyRow {
  type: string | null;
  description: string | null;
  frequency_mhz: number | null;
}

export async function frequenciesForIdent(db: D1Like, ident: string): Promise<FrequencyRow[]> {
  const r = await db
    .prepare('SELECT type,description,frequency_mhz FROM oa_frequency WHERE airport_ident = ? ORDER BY type, frequency_mhz')
    .bind(ident)
    .all<FrequencyRow>();
  return r.results;
}

export interface NavaidRow {
  ident: string | null;
  name: string | null;
  type: string | null;
  frequency_khz: number | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  dme_channel: string | null;
  usage_type: string | null;
  power: string | null;
}

export async function navaidsForIdent(db: D1Like, ident: string): Promise<NavaidRow[]> {
  const r = await db
    .prepare(
      'SELECT ident,name,type,frequency_khz,latitude_deg,longitude_deg,elevation_ft,dme_channel,usage_type,power FROM oa_navaid WHERE associated_airport = ? ORDER BY ident',
    )
    .bind(ident)
    .all<NavaidRow>();
  return r.results;
}

export interface PagedResult<T> {
  rows: T[];
  total_matching: number;
  truncated: boolean;
}

/** Row-count limit for list/search tools: default 20, max 100, so a default
 *  call stays well under the ~40KB response-size guidance even for airports'
 *  widest shape. */
export function clampLimit(requested: unknown, dflt = 20, max = 100): number {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(n, max);
}

export async function searchAirports(
  db: D1Like,
  opts: { query: string | null; country: string | null; type: string | null; limit: number; offset: number },
): Promise<PagedResult<ReturnType<typeof shapeAirport>>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.query) {
    where.push('(name LIKE ? OR municipality LIKE ? OR ident LIKE ?)');
    const like = `%${opts.query}%`;
    params.push(like, like, like);
  }
  if (opts.country) {
    where.push('iso_country = ?');
    params.push(opts.country);
  }
  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT ${AIRPORT_COLS} FROM oa_airport ${whereSql} ORDER BY (scheduled_service = 'yes') DESC, name LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS n FROM oa_airport ${whereSql}`;
  const [r, c] = await Promise.all([
    db.prepare(sql).bind(...params, opts.limit, opts.offset).all<AirportRow>(),
    db.prepare(countSql).bind(...params).first<{ n: number }>(),
  ]);
  const total = c?.n ?? r.results.length;
  return { rows: r.results.map(shapeAirport), total_matching: total, truncated: opts.offset + r.results.length < total };
}
