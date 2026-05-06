# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Open-Meteo free/open-access usage may not be appropriate for commercial production. | Production launch could violate provider policy or lack reliability guarantees. | Production is out of scope for this epic; keep provider behind local route handlers so a later production provider decision remains possible. | deferred |
| Weather calls could hit provider rate limits if search or refresh is too aggressive. | Search suggestions and hero refresh could degrade or fail. | Debounce search, cache route responses, refresh current weather on a conservative freshness interval, and preserve last successful state on failure. | open |
| Browser geolocation can create privacy and permission friction. | Users may distrust the feature or see browser prompts before intent is clear. | Add geolocation only in Phase 4 as explicit opt-in, visually secondary helper, with confirmation before applying it. | open |
| Weather colors could reduce hero contrast or clash with dark mode. | Hero readability and accessibility could regress across pages. | Define palettes centrally, scope them to hero wrappers only, and verify contrast in both light and dark modes. | open |
| Hero client persistence can cause hydration or visual jumps. | Weather artwork may appear after hydration and shift the hero layout. | Reserve stable hero artwork dimensions and render a generic hero state when no weather is selected. | open |
| Provider weather codes may not map cleanly to the desired condition set. | Hero icon/color could feel wrong for edge weather states. | Centralize WMO code mapping, include an unknown fallback, and cover mappings with fixtures. | open |
| Attribution requirements may be missed. | Legal/product polish issue before release. | Add provider attribution to the weather page and capture final attribution placement during implementation. | open |
