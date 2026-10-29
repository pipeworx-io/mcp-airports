# @pipeworx/airports

Airport lookup, two sources side by side:

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

- **AirportGap** (live, free, keyless) — the original tools. A static
  OpenFlights-derived snapshot, IATA-code and top-~150-city coverage only.
- **OurAirports** (fleet #2977, D1 copy) — every airfield OurAirports
  tracks: ~86,000 rows including ICAO-only idents, heliports, seaplane
  bases, balloonports and closed fields, plus their runways, radio
  frequencies and navaids.

## Tools

### AirportGap-backed (live upstream fetch)

- `search_airports(query)` — city name or IATA code, via a bundled
  city->IATA map (top ~150 hubs).
- `get_airport(iata_code)` — single airport by IATA code.
- `calculate_distance(from, to)` — great-circle distance between two IATA
  codes.

An IATA code AirportGap's snapshot doesn't have (e.g. `BER`, opened 2020)
returns `found: false` with a hint rather than erroring — it's a known
dataset-age boundary, not an outage.

### OurAirports-backed (D1, public domain)

- `ourairports_lookup(code)` — look up ANY airfield by ICAO code, IATA
  code, GPS code, or OurAirports' own local/national ident (e.g. a US local
  code like `"00A"`, or a non-US ident like `"AT-0001"`). Returns name,
  type (`large_airport`/`medium_airport`/`small_airport`/`heliport`/
  `seaplane_base`/`balloonport`/`closed`), coordinates, elevation,
  country/region, and scheduled-service flag.
- `airport_runways(code)` — per-runway length/width/surface/lighting/
  closed flag, plus both ends' ident, coordinates, elevation, heading and
  displaced threshold.
- `airport_frequencies(code)` — radio frequencies (ATIS/TWR/GND/CLD/DIR/
  APP/DEP/CTAF/UNICOM/...), description and MHz.
- `airport_navaids(code)` — navaids (NDB/VOR/DME/VOR-DME/VORTAC/TACAN/...)
  associated with the airfield: ident, name, type, frequency in kHz,
  coordinates, elevation, DME channel, power.
- `ourairports_search(query?, country?, type?, limit?, offset?)` — text
  match against name/municipality/ident, optionally narrowed by ISO country
  code or airfield type. Needs at least one of `query`/`country`/`type` —
  an unscoped call would otherwise mean a full-table scan of ~86k rows.
  `limit` defaults to 20 (max 100); a response with more matching rows than
  returned carries `truncated: true` and `total_matching`.

Every OurAirports-backed tool accepts any of ICAO/IATA/GPS/local code for
`code` and resolves deterministically: OurAirports' own canonical `ident`
wins over `icao_code`, which wins over `gps_code`, which wins over
`iata_code`, so a code that happens to collide across columns never
silently resolves to the wrong airfield. **An unrecognized code is refused
with a clear error, never an empty success** — use `ourairports_search` to
find the right code by name/city first if you don't already have it. A
known airfield with zero matching child rows (e.g. a heliport with no
fixed-wing runway) returns an empty array with `found: true` and an
explanatory `note` — that is real data, not a failure.

## Auth

Keyless. The OurAirports-backed tools answer only through the Pipeworx
gateway, which holds the D1 copy; a standalone `npm install` has no data to
read there and every tool throws a clear "not bound in this runtime" error
instead of returning an empty list.

## Data sources

- **AirportGap** (airportgap.com) — free public API, no auth.
- **OurAirports** — bulk CSV export
  (davidmegginson.github.io/ourairports-data, a public mirror of
  ourairports.com's own data). Per ourairports.com/data/: *"All data is
  released to the Public Domain, and comes with no guarantee of accuracy or
  fitness for use."* The site publishes bulk files only (no live query
  API), so this pack builds a copy (`scripts/ourairports/load-data.mjs`)
  rather than proxying. All six
  files (airports, runways, airport-frequencies, navaids, countries,
  regions) load whole — nothing here needs aggregation or a row cap at
  OurAirports' scale (the largest table is ~86k rows).

### Refresh

OurAirports updates its CSVs on a rolling basis (new/changed airfields,
runway edits, frequency changes). To refresh:

```bash
CLOUDFLARE_ACCOUNT_ID=ecc092eba5c5bacef3ccff9f9d7a4d8d \
  node scripts/ourairports/load-data.mjs \
  --db pipeworx-ourairports --config workers/gateway/wrangler.toml
```

Needs `wrangler` logged in to the Pipeworx Cloudflare account. The loader
downloads all six CSVs fresh, rebuilds every table (`DROP TABLE IF EXISTS`
+ reload — OurAirports revises existing rows rather than only appending),
verifies the loaded row count against the parsed row count per table, and
aborts loudly (non-zero exit, no partial "loaded" claim) on a mismatch
rather than leaving the database silently incomplete. Not yet on a cron —
run it by hand when the data looks stale (`ourairports_lookup`'s
`data_as_of` field carries the last load time).

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "airports": {
      "url": "https://gateway.pipeworx.io/airports/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/airports/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_airports \
  -H 'Content-Type: application/json' \
  -d '{"query":"New York"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_airports`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-airports` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/airports/mcp` endpoint shown above. It needs network access;
there is no offline mode.

```json
{
  "mcpServers": {
    "airports": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-airports"]
    }
  }
}
```

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Airports data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
