interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Airports MCP — wraps AirportGap API (free, no auth required)
 *
 * Tools:
 * - search_airports: search airports by name, city, or country
 * - get_airport: look up a single airport by IATA code
 * - calculate_distance: calculate distance between two airports
 */


const BASE_URL = 'https://airportgap.com/api/airports';

interface AirportAttributes {
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: string;
  longitude: string;
  altitude: number;
  timezone: string;
}

interface AirportResource {
  id: string;
  type: string;
  attributes: AirportAttributes;
}

interface AirportResponse {
  data: AirportResource;
}

interface AirportListResponse {
  data: AirportResource[];
}

interface DistanceAttributes {
  from_airport: AirportAttributes;
  to_airport: AirportAttributes;
  kilometers: number;
  miles: number;
  unit: string;
}

interface DistanceResponse {
  data: {
    id: string;
    type: string;
    attributes: DistanceAttributes;
  };
}

function shapeAirport(attrs: AirportAttributes) {
  return {
    name: attrs.name,
    city: attrs.city,
    country: attrs.country,
    iata: attrs.iata,
    icao: attrs.icao,
    latitude: parseFloat(attrs.latitude),
    longitude: parseFloat(attrs.longitude),
    altitude_ft: attrs.altitude,
    timezone: attrs.timezone,
  };
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_airports',
    description:
      'Search for airports by name, city, or country. Returns up to 30 results per page.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Airport name, city, or country to search for',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_airport',
    description:
      'Get detailed information about an airport by its IATA code (e.g. "JFK", "LHR", "NRT"). Returns name, city, country, coordinates, altitude, and timezone.',
    inputSchema: {
      type: 'object',
      properties: {
        iata_code: {
          type: 'string',
          description: 'Three-letter IATA airport code (e.g. "JFK")',
        },
      },
      required: ['iata_code'],
    },
  },
  {
    name: 'calculate_distance',
    description:
      'Calculate the great-circle distance between two airports by their IATA codes. Returns distance in both kilometers and miles.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'IATA code of the origin airport (e.g. "JFK")',
        },
        to: {
          type: 'string',
          description: 'IATA code of the destination airport (e.g. "LHR")',
        },
      },
      required: ['from', 'to'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_airports':
      return searchAirports(args.query as string, (args.page as number) ?? 1);
    case 'get_airport':
      return getAirport(args.iata_code as string);
    case 'calculate_distance':
      return calculateDistance(args.from as string, args.to as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function searchAirports(query: string, page: number) {
  const params = new URLSearchParams({
    q: query,
    'page[number]': String(page),
    'page[size]': '30',
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`AirportGap error: ${res.status}`);

  const data = (await res.json()) as AirportListResponse;
  return {
    results: data.data.map((r) => shapeAirport(r.attributes)),
    count: data.data.length,
    page,
  };
}

async function getAirport(iataCode: string) {
  const code = iataCode.trim().toUpperCase();
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(code)}`);
  if (res.status === 404) throw new Error(`Airport not found: ${code}`);
  if (!res.ok) throw new Error(`AirportGap error: ${res.status}`);

  const data = (await res.json()) as AirportResponse;
  return shapeAirport(data.data.attributes);
}

async function calculateDistance(from: string, to: string) {
  const fromCode = from.trim().toUpperCase();
  const toCode = to.trim().toUpperCase();

  const body = new URLSearchParams({ from: fromCode, to: toCode });

  const res = await fetch(`${BASE_URL}/distance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`AirportGap error: ${res.status}`);

  const data = (await res.json()) as DistanceResponse;
  const attrs = data.data.attributes;
  return {
    from: shapeAirport(attrs.from_airport),
    to: shapeAirport(attrs.to_airport),
    distance_km: attrs.kilometers,
    distance_miles: attrs.miles,
  };
}

export default { tools, callTool } satisfies McpToolExport;
