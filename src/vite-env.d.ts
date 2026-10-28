/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ARRIVALS_URL?: string;
  readonly VITE_RAIL_REALTIME_URL?: string;
  readonly VITE_TRAFFIC_TILES?: string;
  readonly VITE_TRAFFIC_CREDIT?: string;
  readonly VITE_STATIC_BASE?: string;
  readonly VITE_STATS_BASE?: string;
  readonly VITE_MOCK?: string;
  readonly VITE_GEOCODE_URL?: string;
  readonly VITE_DEMO_VIDEO_URL?: string;
}

declare module "virtual:maplibre-worker" {
  const url: string;
  export default url;
}
