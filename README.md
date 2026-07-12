# United 2026 — FIFA World Cup Fan Site

A single-page, broadcast-styled fan website for the FIFA World Cup 2026, built with pure HTML, CSS, and vanilla JavaScript. No frameworks or build tools required.

## Features

- **Live Ticker** — Scrolling broadcast-style match score strip at the top
- **Countdown Timer** — Real-time countdown to the opening kickoff (June 11, 2026)
- **Match Schedule** — Group stage fixtures with team flags and venue info
- **Host Cities** — Cards for NY/NJ, Los Angeles, and Mexico City with stadium details
- **Ticket Tiers** — Three pricing categories ($250 / $450 / $850) with perks
- **FIFA Chatbot** — Floating chat widget that answers questions about matches, cities, tickets, and the countdown
- **Scroll Animations** — Sections fade in using IntersectionObserver
- **Active Nav Highlighting** — Navigation links update on scroll

## Tech Stack

| Layer | Details |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox, animations) |
| Logic | Vanilla JavaScript (ES6+) |
| Fonts | Google Fonts — Big Shoulders Display, Inter, IBM Plex Mono |
| Flags | [flagcdn.com](https://flagcdn.com) |
| Images | Unsplash / Pexels (external URLs) |

## Getting Started

No installation needed. Just open `index.html` in any modern browser.

```bash
# Clone or download the repo, then:
open index.html
```

## Project Structure

```
FIFA-1/
└── index.html   # Entire app — styles, markup, and scripts in one file
```

## Chatbot Capabilities

The built-in assistant responds to natural language queries about:
- Match schedule and team fixtures
- Host cities and stadiums
- Ticket prices and tiers
- Days remaining until kickoff

## Disclaimer

This is a prototype/concept only. Not an official FIFA product.
