# Epic Problem Framing

## Problem

The website needs a weather-aware experience. A user should be able to open a dedicated page, type or select a location, fetch the current weather for that location from an open/free weather provider, and then see that weather reflected in hero blocks across the site.

## Desired Outcome

- A new website page lets users search for and select a location.
- The app fetches current weather for the selected location.
- Hero blocks display the current condition icon and temperature after a location is selected.
- Hero blocks use a large weather icon as the hero image/artwork, scaled to feel intentional within the section.
- Hero color treatment reflects the current weather condition while preserving existing page structure, dark mode, and readability.
- The UI feels elegant, restrained, and production-grade rather than a demo widget.
- Browser geolocation is available as a gentle optional helper for selecting a location, not as an automatic decision-maker.

## Primary User Flow

1. User opens `/weather`.
2. User types a city, region, or postal code.
3. The app shows location suggestions.
4. User selects one suggestion.
5. The app fetches current weather for that location.
6. The weather page shows the selected location and current conditions.
7. Hero blocks across website pages show the condition icon, temperature, and weather-reflective visual treatment.
8. In Phase 4, the weather page may gently suggest using browser geolocation to help select a location, but only after explicit user intent.

## Scope

- Add a dedicated weather page under the website route group.
- Add provider-facing API route handlers for geocoding and current weather.
- Add typed weather domain models and provider response normalization.
- Add a client weather state provider, persistence, refresh policy, and UI hooks.
- Add a weather condition mapping from provider weather codes to condition names, icons, and hero palettes.
- Update existing hero components to reflect the selected weather state.
- Add optional browser geolocation as a Phase 4 helper that suggests a location and requires explicit confirmation.
- Add focused tests and browser verification for data contracts, UI states, persistence, and cross-page behavior.

## Non-Scope

- Forecast pages, hourly charts, severe weather alerts, air quality, maps, radar, or historical weather.
- Account-level saved locations or server-side user profiles.
- Automatic IP-based location detection.
- Automatic browser geolocation on page load.
- Weather-aware global header indicator, header recoloring, or body-wide weather theming.
- Paid/commercial weather provider integration in the first implementation pass.
- Rebranding the whole site theme around weather.

## Constraints And Assumptions

- The project is a Next.js App Router site using React 19, Tailwind CSS v4, local UI primitives, and `lucide-react`.
- Existing website shell lives in `src/app/(website)/layout.tsx`.
- Existing hero surfaces include `src/components/pages/home/hero--column.tsx`, `src/components/pages/blog/hero--blog.tsx`, and `src/components/pages/pricing/hero--pricing.tsx`.
- Provider calls should be wrapped behind project route handlers so the UI depends on a local stable contract.
- Weather state should be client-owned and persisted locally so it follows the user across pages.
- Weather styling should use scoped hero classes or CSS variables, not a broad rewrite of global theme tokens or page body styling.
- Default unit: Celsius.
- Header display: no weather indicator in the header; only normal navigation may link to `/weather`.
- Attribution: show Open-Meteo attribution on the weather page, not in the hero or header.
- Browser geolocation behavior: opt-in only, gentle suggestion/helper only, no automatic selection.
- Use Open-Meteo as the selected provider for prototype/testing. This feature is not intended for production release or high-volume data consumption.
- Open-Meteo was selected after live no-key testing against several candidate providers.
- Official docs checked on 2026-05-06:
  - Forecast API: https://open-meteo.com/en/docs
  - Geocoding API: https://open-meteo.com/en/docs/geocoding-api
  - Pricing and limits: https://open-meteo.com/en/pricing

## Provider Notes

- Forecast endpoint: `https://api.open-meteo.com/v1/forecast`.
- Geocoding endpoint: `https://geocoding-api.open-meteo.com/v1/search`.
- Current weather variables should start with `temperature_2m`, `apparent_temperature`, `is_day`, `precipitation`, `rain`, `snowfall`, `weather_code`, `cloud_cover`, and `wind_speed_10m`.
- Use `timezone=auto`.
- Use the provider's WMO `weather_code` to derive a normalized condition, icon, and palette.
- Free/open-access use is accepted for this epic because the scope is prototype/testing only.
- Keep conservative debounce, caching, and refresh behavior anyway so the implementation stays polite and stable.
- Provider evaluation details: `docs/provider-evaluation.md`.

## Open Questions

- None blocking.
