# Matchday AI — FIFA World Cup 2026 Stadium Operations Hub

A GenAI-enabled stadium operations prototype for FIFA World Cup 2026, built with pure HTML,
CSS, and vanilla JavaScript (no frameworks or build tools required).

See **[ALIGNMENT.md](./ALIGNMENT.md)** for a line-by-line mapping of every one of the 8
problem-statement categories (navigation, crowd management, accessibility, transportation,
sustainability, multilingual assistance, operational intelligence, real-time decision support)
to the specific feature and GenAI capability that addresses it.

## How the "AI" actually works

Every feature below makes a **real, live network call to an LLM** — there is no keyword
matching, regex, or canned-response table left in the app. There are two supported connection
modes:

### Recommended: built-in server proxy (key stays server-side)

```bash
npm install
cp .env.example .env     # then set OPENAI_API_KEY=sk-...
npm start
# open http://localhost:3000
```

The browser calls `POST /api/llm` on the bundled Express server (`server.js`), which injects
`OPENAI_API_KEY` from `.env` and forwards the request to the configured LLM endpoint. The key
never reaches the browser or gets committed to the repo (`.env` is git-ignored). This is the
default mode whenever the page is served over `http(s)://`.

### Fallback: direct browser call (bring your own key)

If you just open `index.html` directly (`file://…`, no server running), the app auto-switches to
**Direct Browser mode**: click the ⚙ **Settings** icon, select "Direct browser call", paste an
OpenAI-compatible API key, and Save. The key is stored only in this browser's `localStorage` and
sent only to the API endpoint you configure — never committed to this repo.

In both modes, the status dot next to the settings icon turns green once the active mode is
ready, and every tab explicitly tells you when no key is configured instead of faking a response.

Because there is no live sensor/transit/weather API available in this static prototype, the
*input data* for Crowd & Ops and Sustainability panels (gate occupancy, transit status, weather,
carbon stats) is simulated — but it is clearly labeled **"Simulated data · Real GenAI reasoning"**,
and the reasoning performed over that data is a genuine, uncached LLM completion every time.

## Features (see ALIGNMENT.md for the full table)

- **Assistant** (`tab-assistant`) — open-ended chat covering navigation, accessibility guidance,
  and transport/parking advice, multilingual (responses generated natively in the selected
  language, including RTL Arabic)
- **Crowd & Ops** (`tab-ops`) — Gate Congestion Forecaster (crowd management) and Ops Brief
  Generator (operational intelligence), both real LLM reasoning over simulated feeds
- **Volunteer** (`tab-volunteer`) — free-text incident report classified by the LLM into
  category/severity plus a generated real-time response recommendation (real-time decision
  support)
- **Sustainability** (`tab-sustainability`) — free-text waste item classified into the correct
  bin with a reasoned explanation
- **Fan Info** (`tab-fan`) — match schedule / host cities / ticket tiers, explicitly labeled
  static reference content with no AI involved, kept secondary so it doesn't dilute alignment

## Tech Stack

| Layer | Details |
|---|---|
| Markup | HTML5 (`index.html`) |
| Styling | CSS3 custom properties, grid, flexbox (`matchday-ai.css`) |
| Logic | Vanilla JavaScript ES6+ (`matchday-ai.js`) |
| Server | Node.js + Express proxy (`server.js`), keeps the LLM key server-side |
| GenAI | `fetch` to an OpenAI-compatible Chat Completions endpoint — via the server proxy (default) or directly from the browser (BYOK fallback) |
| Fonts | Google Fonts — Inter |

## Getting Started

```bash
npm install
cp .env.example .env   # set OPENAI_API_KEY
npm start
# open http://localhost:3000
```

No server? You can still `open index.html` directly — the app falls back to Direct Browser
mode automatically; add your key via the ⚙ Settings modal.

## Project Structure

```
FIFA-1/
├── index.html         # Markup for the Matchday AI hub
├── matchday-ai.css     # Design tokens + component styles
├── matchday-ai.js       # LLM client (proxy + direct modes), mock feeds, tab/feature logic
├── server.js            # Express proxy — keeps the LLM API key server-side
├── package.json
├── .env.example         # Copy to .env and fill in OPENAI_API_KEY
├── ALIGNMENT.md         # Problem-statement traceability table
└── README.md
```

## Disclaimer

This is a prototype/concept only. Not an official FIFA product.
