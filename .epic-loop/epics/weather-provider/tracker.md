# Tracker

Epic: Weather Provider Integration

## Task Statuses

- todo
- doing
- need-review
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

### Phase 0: Epic Shaping And Work Setup

- Phase status: done

- [x] T0.1 [Capture problem framing]
Kind: documentation-only | Status: done
  - Outcome: The epic has a clear product goal, scope, non-scope, assumptions, and open questions.
  - Surface: `docs/problem-framing.md`.
  - Acceptance: A future session can understand the requested user experience and implementation boundaries.
  - Docs: `docs/problem-framing.md`.

- [x] T0.2 [Record provider tradeoffs]
Kind: documentation-only | Status: done
  - Outcome: The epic has a provider direction that implementation can start against.
  - Surface: `decision-log.md`, `risk-register.md`, `docs/problem-framing.md`.
  - Acceptance: Provider choice, API surfaces, limitations, and production risks are recorded.
  - Docs: `decision-log.md`, `risk-register.md`, `docs/problem-framing.md`.

- [x] T0.3 [Shape the roadmap]
Kind: documentation-only | Status: done
  - Outcome: The epic has an executable roadmap with small tasks in each technical phase.
  - Surface: `tracker.md`, `state-of-epic.md`.
  - Acceptance: Each technical phase contains 5-8 tasks with outcome, surface, acceptance criteria, and docs.
  - Docs: `tracker.md`, `state-of-epic.md`.

### Phase 1: Weather Data Foundation

- Phase status: todo

- [ ] T1.1 [Define weather contract]
Kind: implementation | Status: todo
  - Outcome: The app has stable internal types for locations, current weather, conditions, units, provider errors, and freshness metadata.
  - Surface: `src/lib/weather/`, TypeScript types, normalization helpers.
  - Acceptance: UI code can depend on internal weather types without importing Open-Meteo response shapes.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [ ] T1.2 [Add geocoding adapter]
Kind: implementation | Status: todo
  - Outcome: The app can search city, region, or postal-code text and receive normalized location suggestions.
  - Surface: `src/lib/weather/open-meteo.ts`, fetch helpers, response validation.
  - Acceptance: Queries shorter than the provider's useful threshold return a controlled empty result; valid searches return normalized name, admin area, country, coordinates, and timezone.
  - Docs: `docs/problem-framing.md`.

- [ ] T1.3 [Add geocoding route]
Kind: implementation | Status: todo
  - Outcome: The client can call a project-owned endpoint for location search.
  - Surface: `src/app/api/weather/geocode/route.ts`, request validation, response contract, cache headers.
  - Acceptance: The route validates query input, returns normalized JSON, handles provider errors, and does not leak raw provider failures into UI state.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T1.4 [Add current-weather adapter]
Kind: implementation | Status: todo
  - Outcome: The app can fetch current weather by selected coordinates.
  - Surface: `src/lib/weather/open-meteo.ts`, provider URL construction, response validation.
  - Acceptance: The adapter returns temperature, apparent temperature, weather code, precipitation signals, cloud cover, wind speed, is-day flag, provider timestamp, and timezone.
  - Docs: `docs/problem-framing.md`.

- [ ] T1.5 [Add current-weather route]
Kind: implementation | Status: todo
  - Outcome: The client can call a project-owned endpoint for current weather by location coordinates.
  - Surface: `src/app/api/weather/current/route.ts`, validation, cache headers, error contract.
  - Acceptance: The route rejects invalid coordinates, returns normalized current weather, and uses a cache policy compatible with current-condition freshness.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T1.6 [Map weather conditions]
Kind: implementation | Status: todo
  - Outcome: The UI has a single source of truth for weather labels, lucide icons, hero artwork, and hero color treatments.
  - Surface: `src/lib/weather/conditions.ts`, `src/components/weather/`, CSS variables or class tokens.
  - Acceptance: Clear, cloudy, fog, drizzle, rain, snow, thunderstorm, and unknown conditions have defined labels, icon choices, and accessible palette metadata.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [ ] T1.7 [Verify data contracts]
Kind: verification | Status: todo
  - Outcome: Provider normalization and route contracts are covered before UI depends on them.
  - Surface: unit tests if the repo has a test harness, otherwise focused typecheck-safe fixtures and route-level verification notes.
  - Acceptance: Valid fixture responses normalize correctly; malformed provider responses and route validation failures produce controlled errors; `pnpm typecheck` passes.
  - Docs: `implementation-log.md`.

### Phase 2: Location Page And Weather Selection UI

- Phase status: todo

- [ ] T2.1 [Add weather page]
Kind: implementation | Status: todo
  - Outcome: Users can navigate to a first-class weather page in the website route group.
  - Surface: `src/app/(website)/weather/page.tsx`, optional route metadata, page-level components.
  - Acceptance: `/weather` renders inside the existing website shell and does not disturb docs, blog, pricing, or legal routes.
  - Docs: `docs/problem-framing.md`.

- [ ] T2.2 [Build location search]
Kind: implementation | Status: todo
  - Outcome: Users can type a location and receive suggestions without noisy API calls.
  - Surface: `src/components/weather/location-search.tsx`, existing `Input`, debounce hook, client fetch helper.
  - Acceptance: Search waits for a useful query length, debounces requests, cancels stale responses, and keeps keyboard focus stable.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T2.3 [Render suggestions]
Kind: implementation | Status: todo
  - Outcome: Users can choose the exact matching location from a clear, compact result list.
  - Surface: weather page components, result rows, empty state, selection handler.
  - Acceptance: Results show enough disambiguation using location name, admin area, country, and timezone; selection is accessible by pointer and keyboard.
  - Docs: `docs/problem-framing.md`.

- [ ] T2.4 [Build weather panel]
Kind: implementation | Status: todo
  - Outcome: The selected location displays current condition, temperature, apparent temperature, icon, and last update time.
  - Surface: weather page components, condition display, weather icon component.
  - Acceptance: The panel handles loaded, loading, stale, and unavailable states without layout jumps or overflowing text on mobile.
  - Docs: `docs/problem-framing.md`.

- [ ] T2.5 [Add error states]
Kind: implementation | Status: todo
  - Outcome: Provider/network failures feel controlled and recoverable.
  - Surface: weather page components, API error mapping, retry action.
  - Acceptance: Invalid input, no results, provider failures, and network failures each produce distinct UI states and preserve the last successful selection when appropriate.
  - Docs: `risk-register.md`.

- [ ] T2.6 [Persist selection]
Kind: implementation | Status: todo
  - Outcome: The user's selected weather context survives navigation and reloads.
  - Surface: weather client state, local storage or cookie-backed persistence, serialization guards.
  - Acceptance: Reloading the site restores the selected location and last weather snapshot, then refreshes weather according to the freshness policy.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [ ] T2.7 [Verify page experience]
Kind: verification | Status: todo
  - Outcome: The weather page works across desktop and mobile before hero blocks depend on the selected weather state.
  - Surface: Playwright/browser checks, `pnpm lint`, `pnpm typecheck`, responsive screenshots where useful.
  - Acceptance: Search, selection, weather display, persistence, empty states, and mobile layout are verified.
  - Docs: `implementation-log.md`.

### Phase 3: Weather-Aware Hero Blocks Across The Site

- Phase status: todo

- [ ] T3.1 [Add weather provider]
Kind: implementation | Status: todo
  - Outcome: Hero components on website pages can read the selected location and current weather state.
  - Surface: `src/contexts/`, `src/hooks/`, `src/app/(website)/layout.tsx`.
  - Acceptance: The provider wraps the existing website shell, preserves existing providers, and exposes stable state/actions for weather page and hero components.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [ ] T3.2 [Build hero artwork]
Kind: implementation | Status: todo
  - Outcome: Hero blocks can show a weather condition icon as a large hero image/artwork.
  - Surface: `src/components/weather/weather-hero-artwork.tsx`, lucide icons, responsive sizing.
  - Acceptance: The artwork scales to hero-section proportions, keeps stable dimensions across states, and has accessible labels for the represented weather condition.
  - Docs: `docs/problem-framing.md`.

- [ ] T3.3 [Define hero palettes]
Kind: implementation | Status: todo
  - Outcome: Hero blocks visually reflect weather without changing the rest of the page.
  - Surface: `src/lib/weather/conditions.ts`, `src/styles/globals.css`, hero component class contracts.
  - Acceptance: Clear, cloudy, fog, rain, snow, and thunderstorm palettes affect only hero wrappers/artwork and keep text contrast readable in light and dark modes.
  - Docs: `docs/problem-framing.md`.

- [ ] T3.4 [Integrate hero visuals]
Kind: implementation | Status: todo
  - Outcome: Home, blog, and pricing hero blocks can show selected weather state.
  - Surface: `src/components/pages/home/hero--column.tsx`, `src/components/pages/blog/hero--blog.tsx`, `src/components/pages/pricing/hero--pricing.tsx`, shared weather hero component.
  - Acceptance: Each existing hero keeps its content hierarchy and gains large weather artwork only when weather is selected; no selected weather keeps the current hero behavior clean.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T3.5 [Refresh hero weather]
Kind: implementation | Status: todo
  - Outcome: Hero weather remains reasonably current as the user navigates.
  - Surface: weather provider, visibility/focus listeners, refresh interval policy, current-weather API route.
  - Acceptance: Fresh state is reused, stale state refreshes on focus/navigation, and failed refreshes do not erase the last useful hero display.
  - Docs: `decision-log.md`, `risk-register.md`.

- [ ] T3.6 [Add weather nav]
Kind: implementation | Status: todo
  - Outcome: Users can discover the weather page from the site navigation.
  - Surface: `src/constants/menus.ts`, header/mobile menu behavior.
  - Acceptance: Header nav includes the weather page in a position that fits the existing IA; active route styling works for `/weather`.
  - Docs: `docs/problem-framing.md`.

- [ ] T3.7 [Verify hero behavior]
Kind: verification | Status: todo
  - Outcome: Weather-aware heroes work on representative pages and viewports.
  - Surface: Playwright/browser checks across home, docs, blog, pricing, and weather pages; lint/typecheck/build.
  - Acceptance: Weather state persists across routes, hero artwork and colors render correctly, page body content remains untouched, no hydration warnings appear, and `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass or have documented blockers.
  - Docs: `implementation-log.md`.

### Phase 4: Gentle Geolocation Helper

- Phase status: todo

- [ ] T4.1 [Add geolocation helper]
Kind: implementation | Status: todo
  - Outcome: The app can request coordinates only after explicit user action and report permission outcomes cleanly.
  - Surface: `src/lib/weather/geolocation.ts`, client hook, browser `navigator.geolocation` integration.
  - Acceptance: Geolocation is never requested on page load; success, denied, unavailable, timeout, and unsupported browser states are represented in a typed contract.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T4.2 [Add geolocation prompt]
Kind: implementation | Status: todo
  - Outcome: Users see geolocation as a helpful optional shortcut, not as the default or preferred path.
  - Surface: `/weather` page components, suggestion banner/card, existing button primitives.
  - Acceptance: The suggestion is visually secondary to typed search, uses calm copy, and can be ignored without blocking location search.
  - Docs: `docs/problem-framing.md`.

- [ ] T4.3 [Preview current location]
Kind: implementation | Status: todo
  - Outcome: Coordinates from browser geolocation produce a preview the user can accept or dismiss.
  - Surface: geolocation hook, current-weather API route, weather page preview state.
  - Acceptance: Successful geolocation fetches current weather for the coordinates, labels the suggestion as approximate/current location, and does not persist it until the user confirms.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [ ] T4.4 [Require confirmation]
Kind: implementation | Status: todo
  - Outcome: Geolocation helps selection but never silently overrides the user's typed or saved location.
  - Surface: weather page state actions, persistence layer, selected-location reducer.
  - Acceptance: Existing selection stays active while geolocation preview is pending; selecting current location requires a clear user action.
  - Docs: `docs/problem-framing.md`.

- [ ] T4.5 [Handle geolocation denial]
Kind: implementation | Status: todo
  - Outcome: Permission and browser failures do not feel like app errors.
  - Surface: weather page empty/error states, geolocation state mapping.
  - Acceptance: Denied/unavailable/timeout states show concise helper text and preserve typed search as the primary path.
  - Docs: `risk-register.md`.

- [ ] T4.6 [Preserve privacy]
Kind: implementation | Status: todo
  - Outcome: The app stores only the final confirmed weather selection, not raw permission history or unnecessary geolocation metadata.
  - Surface: persistence serialization, weather state model, local storage guards.
  - Acceptance: Raw geolocation permission state is not persisted; confirmed current-location selection stores only the normalized selected location and weather snapshot needed by the UI.
  - Docs: `docs/problem-framing.md`, `risk-register.md`.

- [ ] T4.7 [Verify geolocation helper]
Kind: verification | Status: todo
  - Outcome: Phase 4 behaves as an optional helper across permission states.
  - Surface: Playwright/browser geolocation permissions where feasible, manual verification notes, lint/typecheck/build.
  - Acceptance: Granted, denied, unavailable/unsupported, preview, confirm, dismiss, and existing-selection-preservation paths are verified.
  - Docs: `implementation-log.md`.

