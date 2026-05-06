# Weather Provider Evaluation

## Decision

Use Open-Meteo for the weather prototype.

## Evaluation Date

2026-05-06

## Evaluation Criteria

- Responds without an API key.
- Supports the required testing flow with low setup cost.
- Supports location search or works cleanly with a separate no-key geocoding surface.
- Returns current weather data suitable for temperature, condition icon, and header palette mapping.
- Has a predictable JSON contract that is easy to normalize behind local route handlers.

## Live No-Key Test Results

| Provider | Result | Notes |
| --- | --- | --- |
| Open-Meteo Geocoding API | Pass | `https://geocoding-api.open-meteo.com/v1/search?name=London&count=3&language=en&format=json` returned location suggestions with name, country, admin area, coordinates, and timezone. |
| Open-Meteo Forecast API | Pass | `https://api.open-meteo.com/v1/forecast?...&current=temperature_2m,apparent_temperature,is_day,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m&timezone=auto` returned current weather with units and WMO weather code. |
| wttr.in | Pass, not selected | `https://wttr.in/London?format=j1` returned current weather and forecast without a key. It is convenient, but the payload is large, location matching is less structured for a selectable UI, and provider semantics are less clean for a production-grade component shape. |
| MET Norway Locationforecast | Pass, not selected | `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=51.5072&lon=-0.1276` returned weather without a key when a User-Agent was provided. It needs coordinates first and does not provide the complete typed-location flow by itself. |
| api.weather.gov | Pass, not selected | `https://api.weather.gov/points/38.8894,-77.0352` returned data without a key when a User-Agent was provided. It is US-only and multi-step, so it is a weaker fit for global city search testing. |
| OpenWeatherMap | Fail | `https://api.openweathermap.org/data/2.5/weather?q=London&units=metric` returned HTTP 401 without an API key. |
| WeatherAPI.com | Fail | `https://api.weatherapi.com/v1/current.json?q=London` returned HTTP 401 without an API key. |

## Selected Contract

- Location search: Open-Meteo Geocoding API.
- Current weather: Open-Meteo Forecast API with `current` variables.
- Provider boundary: local `/api/weather/geocode` and `/api/weather/current` route handlers.
- UI contract: normalize provider data into project-owned weather types before rendering.

## Rationale

Open-Meteo is the easiest complete fit for this prototype because it gives us both structured geocoding and current weather without credentials. It also returns compact enough JSON, includes stable units metadata, and uses WMO weather codes that are straightforward to map to local labels, lucide icons, and header color palettes.
