# Optional metro, ISAP and tram live positions

The map currently has static tracks and station locations. No rail real-time source is configured, and this interface does not make schedules or arrival predictions available. The backend owner can add an endpoint and adapt its data to this proposed contract; the contract must be agreed and validated against the actual provider before deployment.

Set the GitHub Actions repository variable `VITE_RAIL_REALTIME_URL` to an HTTPS GET endpoint and deploy. It must allow cross-origin requests from the site and must not require a secret in the public URL. The browser fetches while at least one rail line is displayed, refreshes every 30 seconds while visible and cancels the request after 10 seconds. Without the variable, no request or live marker is made.

Return JSON with Unix timestamps in seconds and WGS84 latitude/longitude:

```json
{
  "source": "realtime",
  "generated_at": 1800000000,
  "vehicles": [
    { "id": "vehicle-123", "line": "M1", "lat": 37.98, "lon": 23.72, "position_at": 1800000000 }
  ]
}
```

Use the route IDs from `public/metro.json` (currently M1, M2, M3, T6 and T7), mapping the provider's IDs explicitly. IDs identify vehicles within a line and must not contain personal information. The endpoint should return the complete current snapshot, including an empty `vehicles` array when none are available. Supply real measurement times, not fetch or timetable times. Only locations on enabled lines are shown; the map uses blue numbered circles to distinguish reported vehicles from static station markers.

Responses marked as scheduled, older than two minutes, more than 30 seconds in the future, or malformed are discarded. Unknown line IDs, implausible coordinates, duplicate identifiers and positions older than two minutes are omitted. Data ages out even without another successful response. An endpoint failure is not evidence that no service is running. CORS, rate limits, identity mapping, source provenance and the accuracy of any new feed must be checked with its provider. Arrival times, delays, service frequency and timetable data require a separate contract and are not inferred from positions.
