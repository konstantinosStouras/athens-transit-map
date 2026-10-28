<script lang="ts">
  import { t as tr, locale } from "../i18n.svelte";
  import { bannerMessages } from "../banner";
  import { DEMO_VIDEO_URL } from "../config";
  import { STALE_S, type AppState } from "../state.svelte";

  let { app }: { app: AppState } = $props();

  const banner = $derived(bannerMessages(app.statusFailed, app.status,
    app.selected.filter(l => app.live[l] && app.serverNow / 1000 - app.live[l].updated_at > STALE_S)));
  const offline = $derived(banner.offline);
  const messages = $derived(banner.messages);
  const failingLines = $derived(app.detailLines.filter(id => app.pollState[id] === "backoff"));
  const warmingLines = $derived(app.detailLines.filter(id => app.pollState[id] === "warming"));
  const missingRoutes = $derived(app.detailLines.filter(id => app.staticFailed[id]));
</script>

{#if messages.length || app.notice || failingLines.length || warmingLines.length || missingRoutes.length}
  <div class="warn" role="status">
    {#if app.notice}<p>{tr(app.notice)}</p>{/if}
    {#each messages as m (m)}<p>{tr(m)}</p>{/each}
    {#if failingLines.length}<p>{locale.language === "en" ? `Live updates unavailable for ${failingLines.join(", ")}. Retrying automatically.` : `Δεν ενημερώνονται οι γραμμές ${failingLines.join(", ")}. Γίνεται αυτόματη επανάληψη.`}</p>{/if}
    {#if warmingLines.length}<p>{locale.language === "en" ? `Waiting for the first live positions: ${warmingLines.join(", ")}.` : `Αναμονή για τις πρώτες ζωντανές θέσεις: ${warmingLines.join(", ")}.`}</p>{/if}
    {#if missingRoutes.length}<p>{locale.language === "en" ? `Routes and stops could not load for ${missingRoutes.join(", ")}. Retrying automatically; vehicle positions load separately.` : `Δεν φόρτωσαν οι διαδρομές και στάσεις για ${missingRoutes.join(", ")}. Γίνεται αυτόματη επανάληψη· οι θέσεις οχημάτων φορτώνονται ξεχωριστά.`}</p>{/if}
    {#if offline || failingLines.length || missingRoutes.length}
      <p>{locale.language === "en" ? "Last received vehicles may remain visible. Their GPS age shows how old they are; this does not confirm the service has recovered." : "Μπορεί να παραμένουν ορατά τα τελευταία οχήματα. Η ηλικία GPS δείχνει την παλαιότητά τους· δεν επιβεβαιώνει αποκατάσταση της υπηρεσίας."}</p>
      <button type="button" disabled={app.statusChecking} onclick={() => void app.checkConnection()}>{app.statusChecking ? (locale.language === "en" ? "Checking…" : "Έλεγχος…") : (locale.language === "en" ? "Check connection" : "Έλεγχος σύνδεσης")}</button>
    {/if}
    {#if offline && DEMO_VIDEO_URL}<p><a href={DEMO_VIDEO_URL} target="_blank" rel="noopener">{tr("Δες πώς δουλεύει")}</a></p>{/if}
  </div>
{/if}

<style>
  .warn { margin-top: 10px; padding: 6px 10px; border-radius: 8px; background: var(--warn-bg); font-size: 12px; }
  p { margin: 2px 0; }
  a { color: inherit; font-weight: 600; }
  button { min-height: 44px; margin: 6px 0; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--fg); cursor: pointer; }
</style>
