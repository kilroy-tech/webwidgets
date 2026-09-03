# Gold Price Webwidget

A Kilroy webwidget that displays real-time gold and silver prices from livepriceofgold.com.

## Features

- Fetches gold price per gram and per ounce
- Displays silver price per ounce
- Shows EUR/USD conversion rate
- Updates every 5 minutes
- Status indicator dot: green (operational) or yellow with throbber (updating)

## How It Works

1. The widget calls Kilroy's `get_url` webhook endpoint to fetch the livepriceofgold.com HTML page
2. Kilroy's backend handles the cross-origin fetch (no CORS issues) and returns raw HTML
3. Browser JavaScript uses **regex parsing** (not DOMParser) to extract price data from the HTML string
4. Extracts values by matching patterns like `id="gramvalue">142.39` and `data-price="EURUSD">1.1601`
5. Displays prices in a compact UI with timestamp

## Slash Commands

### `/ww.gold.prices`
Sends the current price data to a different swarm via `/wa /ww.gold.response {JSON}`.

Response format:
```json
{
  "gold_gram": "142.39",
  "gold_ounce": "4428.35",
  "silver_ounce": "66.41",
  "eur_usd": "1.1601",
  "last_update": "2026-09-03T14:30:00Z"
}
```

### `/ww.gold.prices local`
Same as above but omits the `/wa` prefix, keeping the response in the local swarm for other widgets to consume.

### `/ww.gold.response`
Ignored by this widget (designed for downstream consumers).

## Technical Details

- **Data source**: livepriceofgold.com/usa-gold-price-per-gram.html
- **Update interval**: 5 minutes (300,000ms)
- **Token**: "goldprice" (arbitrary value for webhook routing)
- **Bootstrap args**: Uses `?{{bootstrap_args}}` per Kilroy conventions
- **Parsing method**: Regex (no DOMParser, no blocking on main thread)
