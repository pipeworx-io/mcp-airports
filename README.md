# @pipeworx/mcp-airports

MCP server for airport data — search airports, get details by IATA code, and calculate distances. Powered by the [AirportGap API](https://airportgap.com/) (free, no auth required).

## Tools

| Tool | Description |
|------|-------------|
| `search_airports` | Search airports by name, city, or country (up to 30 per page) |
| `get_airport` | Get details for an airport by IATA code |
| `calculate_distance` | Calculate great-circle distance between two airports |

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "airports": {
      "url": "https://gateway.pipeworx.io/airports/mcp"
    }
  }
}
```

Or run via CLI:

```bash
npx pipeworx use airports
```

## License

MIT
