# Optional real-time arrival feed

The stop finder can display predicted arrivals from a separately supplied live feed. No feed is configured by default; without one, the existing stop counts remain unchanged. This is infrastructure, not a claim that real-time arrival predictions currently exist.

The stop finder also links to OASA's official stop-arrival board when the physical stop can be matched safely. This is an external link, not an activated feed. See [the OASA investigation](oasa-arrivals-investigation.md) for verified endpoint behavior, the outstanding reuse permission and the backend work needed before in-app predictions can be enabled.

Set `VITE_ARRIVALS_URL` to an HTTPS endpoint at build time. For GitHub Pages deployments, set the repository Actions variable `VITE_ARRIVALS_URL` and run the deploy workflow. This URL is public in the built website; do not put credentials in it. The browser sends GET requests with `stop_index` and `gtfs_version` query parameters every 30 seconds while a stop is open and the page is visible. The endpoint must allow the website's origin through CORS. Avoid logging or retaining stop queries unnecessarily.

The stop index is the zero-based index in `public/trips.json`'s `s` array. It is only valid for the exact `v` in that file. A provider must map its own stable stop identifiers to this index for each published version; never reuse mappings after an index rebuild. Line and variant identifiers must match the corresponding keys in `trips.json`.

The response is JSON, for example:

```json
{
  "source": "realtime",
  "gtfs_version": "EXACT_TRIPS_VERSION",
  "stop_index": 7,
  "generated_at": 1800000000,
  "predictions": [
    { "line": "1", "variant": "1234", "arrival": 1800000180 }
  ]
}
```

Times are UTC Unix seconds. Only predictions based on a real-time source belong in this response; scheduled times must not be labelled as real-time. The client rejects a response with a different stop or version, a missing real-time marker, or a generation time older than 120 seconds or more than 30 seconds in the future. Individual malformed, expired or more-than-two-hour predictions are discarded. Only matching line and direction variants are shown, up to three arrivals per direction. Predictions are hidden when the feed gets stale, and network or validation failures show an unavailable message.

Before enabling a provider, establish its provenance, permitted use, identifier mapping, update frequency, accuracy, and behavior during outages. Test with actual devices and representative stop/direction cases, including stale data, before claiming the original arrival-time request is resolved.
