<script lang="ts">
  import { onMount } from "svelte";
  import { Account } from "./lib/account.svelte";
  import AccountDialog from "./lib/ui/AccountDialog.svelte";
  import { AppState } from "./lib/state.svelte";
  import MapView from "./lib/map/MapView.svelte";
  import Panel from "./lib/ui/Panel.svelte";
  import InfoCard from "./lib/ui/InfoCard.svelte";
  import StationCard from "./lib/ui/StationCard.svelte";
  import { locale, t } from "./lib/i18n.svelte";
  import { applyTheme } from "./lib/theme";
  import { InstallState } from "./lib/install.svelte";
  import { withLanguage } from "../public/language-url.js";

  $effect(() => {
    document.documentElement.lang = locale.language;
    try { localStorage.setItem("oasa-language", locale.language); } catch { /* private browsing */ }
    document.title = t("Λεωφορεία ΟΑΣΑ") + " · Live";
    history.replaceState(history.state, "", withLanguage(location.href, locale.language));
  });
  const app = new AppState();
  const account = new Account(app);
  const install = new InstallState();
  onMount(() => install.start());
  onMount(() => account.start());
  let started = false;
  $effect(() => { if (account.allowed && !started) { started = true; app.init(); } });
  $effect(() => account.sync(locale.language, app.favorites));
  $effect(() => applyTheme(app.theme));
  if (import.meta.env.DEV) Object.assign(window, { __app: app });
</script>

{#if account.allowed}
<MapView {app} />
<Panel {app} {install} signedIn={account.verified} onaccount={() => account.open = true} />
<InfoCard {app} />
<StationCard {app} />
{/if}
<AccountDialog {account} />
