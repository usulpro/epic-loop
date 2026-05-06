# Decision Log

## Active Decisions

### 2026-05-06 - Use Open-Meteo As The Selected Weather Provider

- Decision: Use Open-Meteo Forecast API and Geocoding API for the implementation.
- Motivation: Live no-key tests confirmed Open-Meteo geocoding and forecast endpoints both respond without credentials and cover the complete typed-location plus current-weather flow.
- Tradeoff: The free/open-access endpoint has rate limits, attribution/licensing considerations, and no service guarantees. This is acceptable for the current epic because production launch is out of scope.
- Rejected Alternatives: wttr.in works without a key but has a large and less structured payload; MET Norway works without a key but needs coordinates and does not include geocoding; api.weather.gov works without a key but is US-only and multi-step; OpenWeatherMap and WeatherAPI.com returned HTTP 401 without keys.
- Evidence: `docs/provider-evaluation.md`.
- Status: active.

### 2026-05-06 - Wrap Provider Calls Behind Local Route Handlers

- Decision: Client UI should call project-owned `/api/weather/*` routes instead of calling Open-Meteo directly.
- Motivation: This keeps provider response shapes, validation, cache policy, and error normalization out of UI components.
- Tradeoff: Adds a thin server route layer, but makes later provider replacement safer.
- Status: active.

### 2026-05-06 - Keep Weather State Client-Owned And Locally Persisted

- Decision: Store selected location and last weather snapshot in client state with local persistence.
- Motivation: Weather page and hero components need shared state that follows a user's navigation without requiring accounts or server sessions.
- Tradeoff: Server-rendered hero blocks remain generic until client hydration restores the selected weather state.
- Status: active.

### 2026-05-06 - Render Weather In Hero Blocks Only

- Decision: Weather condition icon, temperature, and weather-reflective colors should appear in hero blocks only, not in the global header or page body.
- Motivation: Oleg clarified that weather should be shown in hero blocks and the rest of the page should remain untouched.
- Tradeoff: The weather experience becomes more visual and page-contextual, but individual hero components need integration work.
- Status: active.

### 2026-05-06 - Make Browser Geolocation A Gentle Phase 4 Helper

- Decision: Add geolocation after the core typed-location flow as a separate Phase 4.
- Motivation: Oleg wants geolocation as a helpful suggestion for selecting a location, not as a strong opinionated actor.
- Tradeoff: This adds permission-state UX and verification work, but keeps the first complete weather experience simpler and user-controlled.
- Status: active.

## Historical Decisions

- None recorded yet.
