# mcp-airports

Airports MCP — wraps AirportGap API (free, no auth required)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_airports` | Look up an airport by city name (e.g. "Tokyo", "New York", "London") OR by 3-letter IATA code (e.g. "JFK", "LHR"). City lookup uses a bundled map of the top ~150 international hubs; cities with multiple airports return all primary ones. For airports not in the bundle, pass an IATA code or use the aviationstack pack for full-text name/country search. |
| `get_airport` | Get airport details by IATA code (e.g., "JFK", "LHR"). Returns name, city, country, coordinates, altitude, timezone. |
| `calculate_distance` | Calculate straight-line distance between two airports by IATA code (e.g., "JFK" to "LHR"). Returns kilometers and miles. |

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Airports data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
