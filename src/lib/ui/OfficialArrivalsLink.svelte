<script lang="ts">
  import { fetchLines, fetchLineStatic } from "../api";
  import { locale } from "../i18n.svelte";
  import { officialArrivalsUrl, officialStopCode } from "../official-arrivals";
  import type { StopPoint } from "../stops";

  let { stop, version }: { stop: StopPoint; version: string } = $props();
  const en = $derived(locale.language === "en");
  let code = $state<string | null>(null);
  let loading = $state(true);
  let retry = $state(0);
  $effect(() => {
    const target = stop, expectedVersion = version;
    void retry;
    let disposed = false;
    code = null; loading = true;
    void (async () => {
      try {
        const ix = await fetchLines();
        if (disposed || ix.gtfs_version !== expectedVersion) return;
        const service = target.services.find(s => ix.lines.some(l => l.id === s.line));
        if (!service) return;
        const line = await fetchLineStatic(service.line);
        if (!disposed) code = officialStopCode(target, line);
      } catch { /* Offer the official search when this stop cannot be identified safely. */ }
      finally { if (!disposed) loading = false; }
    })();
    return () => { disposed = true; };
  });
  const url = $derived(officialArrivalsUrl(stop, code, locale.language));
</script>

<aside aria-label={en ? "Official arrival predictions" : "Επίσημες προβλέψεις άφιξης"}>
  <strong>{en ? "When does my bus arrive?" : "Πότε έρχεται το λεωφορείο μου;"}</strong>
  {#if loading}<p role="status">{en ? "Finding this stop’s official arrival page…" : "Εύρεση της επίσημης σελίδας αφίξεων της στάσης…"}</p>
  {:else}
    <a href={url} target="_blank" rel="noopener noreferrer">{code ? (en ? "View this stop’s arrivals on OASA ↗" : "Αφίξεις αυτής της στάσης στον ΟΑΣΑ ↗") : (en ? "Find arrivals on OASA ↗" : "Αναζήτηση αφίξεων στον ΟΑΣΑ ↗")}</a>
    <p>{code ? (en ? "Opens OASA’s live arrival board in a new tab. Check the line and direction there. Predictions can change; no prediction does not mean no service." : "Ανοίγει τον πίνακα ζωντανών αφίξεων του ΟΑΣΑ σε νέα καρτέλα. Έλεγξε τη γραμμή και την κατεύθυνση εκεί. Οι προβλέψεις αλλάζουν· η απουσία πρόβλεψης δεν σημαίνει απουσία δρομολογίου.") : (en ? "We could not safely match this stop. On OASA, choose Stop Information, then your line, direction and stop." : "Δεν επιβεβαιώθηκε με ασφάλεια η στάση. Στον ΟΑΣΑ διάλεξε Πληροφορίες Στάσης και μετά γραμμή, κατεύθυνση και στάση.")}</p>
    {#if !code}<button type="button" onclick={() => retry++}>{en ? "Retry stop matching" : "Νέα προσπάθεια αντιστοίχισης"}</button>{/if}
  {/if}
</aside>

<style>
  aside { margin: 12px 0; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--control); }
  strong { display: block; font-size: 14px; }
  a { display: flex; align-items: center; min-height: 44px; padding: 8px 0; color: var(--accent); overflow-wrap: anywhere; }
  p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  button { min-height: 44px; margin-top: 8px; padding: 8px; color: var(--fg); background: var(--control); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
