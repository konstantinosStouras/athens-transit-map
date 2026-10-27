<script lang="ts">
  import { AppState } from "./lib/state.svelte";
  import MapView from "./lib/map/MapView.svelte";
  import Panel from "./lib/ui/Panel.svelte";
  import InfoCard from "./lib/ui/InfoCard.svelte";
  import StationCard from "./lib/ui/StationCard.svelte";
  import { locale, t } from "./lib/i18n.svelte";
  import { applyTheme } from "./lib/theme";

  $effect(() => {
    document.documentElement.lang = locale.language;
    try { localStorage.setItem("oasa-language", locale.language); } catch { /* private browsing */ }
    document.title = t("Λεωφορεία ΟΑΣΑ") + " · Live";
  });
  const app = new AppState();
  app.init();
  $effect(() => applyTheme(app.theme));
  if (import.meta.env.DEV) Object.assign(window, { __app: app });
</script>

<MapView {app} />
<Panel {app} />
<InfoCard {app} />
<StationCard {app} />
