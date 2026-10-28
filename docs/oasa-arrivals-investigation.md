# OASA arrival investigation — 28 October 2026

## Confirmed on the public service

- Official website: https://telematics.oasa.gr/en/
- `GET https://telematics.oasa.gr/api/?act=webGetLines` returns line codes and displayed line numbers; the sampled response included `Access-Control-Allow-Origin: *`.
- `webGetRoutes&p1=938` returns directions for line 040, including RouteCode 3923 (Syntagma–Piraeus). This is not our GTFS variant 5513.
- `webGetStops&p1=3923` identifies Syggrou-Fix as StopCode 60806, printed StopID 060806. Existing backend static line 040 uses key 60806 at the same coordinates. Our trip-index array index is a third, different identifier.
- `getStopArrivals&p1=60806` returned a live sample with `route_code`, `veh_code`, and `btime2` (minutes). At 07:01 UTC it included route 2951, vehicle 44602, 27 minutes. The official page subsequently displayed the 550 toward Palaio Faliro at 26 minutes and trolley 10 toward Tzitzifies at 30 minutes. These are observations of the provider's predictions, not measurements of actual arrival accuracy.
- The arrival response did **not** include `Access-Control-Allow-Origin`, despite sending `Origin: https://www.stouras.com`. Success from a command-line client therefore does not establish browser compatibility. It had an HTTP Date but no timestamp in the JSON body.
- The official UI creates links of the form `#stationInfo_60806_ST.%20SYGGROY-FIX_37.964467,23.7264443`.

## Why direct display remains disabled

OASA's published terms (https://telematics.oasa.gr/en/terms.php) require prior written permission for reuse beyond personal use. The site owner confirmed no permission yet. No separate license authorizing this arrival-feed reuse was established. Do not activate automated public reuse merely because an endpoint is reachable. No permission request has been sent on the owner's behalf.

The deployed improvement links to OASA's own stop board in a new tab. It does not poll, embed or republish OASA predictions. It resolves stop codes from the existing backend static data only when version, direction, name and coordinates agree and the match is unique. Failed or ambiguous matches fall back to OASA's search page with instructions. Stop queries do not contain the user's GPS location; the external link contains the selected public stop's coordinates.

## Backend work after permission

1. Obtain permitted-use terms and an agreed request budget. A cached backend endpoint is needed unless OASA enables browser access for arrivals. Do not use a third-party public CORS proxy.
2. Preserve StopCode separately from printed StopID and compact trip indexes. Map each requested index against the exact published index version. Validate physical stop coordinates and serving direction.
3. Map OASA `route_code` to the existing line and GTFS variant using verified direction/stop sequences. Never equate a route code with a GTFS variant or infer the direction from the line number alone. Reject unknown mappings.
4. Convert finite, nonnegative minute values into arrival timestamps. Record upstream fetch time, HTTP Date/cache age and any upstream freshness information; do not give an old cached result a new generation time. A provider timestamp is preferable; receipt time alone does not prove GPS freshness.
5. Serve the contract in `docs/arrival-feed.md` with a permitted website origin, short shared cache, request timeout, bounded retries/backoff and visibility-aware polling. Empty predictions mean no estimate available, not no service. Retain vehicle identity if later extending the contract to a selected-bus prediction.
6. Test multiple stops, both directions, buses/trolleys, terminal/loop cases, disappearing and revised predictions, outages, mismatched indexes and stale responses. Compare to observed arrivals over representative journeys before claiming accuracy. Configure `VITE_ARRIVALS_URL` only after these checks.

This does not yet provide end-to-end journey duration. That additionally needs walking routes, ride-time estimates and catchable transfer calculations.
