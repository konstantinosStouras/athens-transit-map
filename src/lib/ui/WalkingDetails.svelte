<script lang="ts">
  import { locale } from '../i18n.svelte';
  import type { AppState } from '../state.svelte';
  import { routeWalking, WalkingRouteError } from '../walking-router';
  import { walkingLabel } from '../walking';
  import { languageQuery } from '../../../public/language-url.js';
  let { app }: { app: AppState } = $props();
  const endpoint = import.meta.env.VITE_WALKING_URL?.trim();
  const en = $derived(locale.language === 'en');
  let busy = $state(false), error = $state('');
  let controller: AbortController | null = null;
  const required = $derived(app.walking.filter(l => l.from[0] !== l.to[0] || l.from[1] !== l.to[1]));
  const complete = $derived(required.length > 0 && required.every(l => l.route));
  $effect(() => { const legs = app.walking; void legs; error = ''; busy = false; return () => controller?.abort(); });
  async function calculate() {
    if (!endpoint || busy) return;
    const legs = app.walking, request = new AbortController();
    controller?.abort(); controller = request; busy = true; error = '';
    try {
      const result = await routeWalking(legs, endpoint, request.signal);
      if (!request.signal.aborted && app.walking === legs) app.walking = result;
    } catch (e) {
      if (!request.signal.aborted && app.walking === legs) error = e instanceof WalkingRouteError ? e.message : 'unavailable';
    } finally { if (controller === request) busy = false; }
  }
</script>
<div class="walking-details">
  <a href={`${import.meta.env.BASE_URL}walking-privacy.html${languageQuery(locale.language)}`} target="_blank" rel="noopener noreferrer">{en ? 'Walking privacy and terms' : 'Απόρρητο και όροι πεζής διαδρομής'}</a>
  {#if complete}
    {#each required as leg}<p>{walkingLabel(leg, locale.language)} → {leg.name}</p>{/each}
    <p class="attribution" translate="no">Google Maps</p>
    <p>{en ? 'Walking routes are in beta and may be missing sidewalks or pedestrian paths. Check the route and crossings on the ground.' : 'Οι διαδρομές πεζών είναι δοκιμαστικές και μπορεί να λείπουν πεζοδρόμια ή πεζόδρομοι. Έλεγξε τη διαδρομή και τις διαβάσεις επί τόπου.'}</p>
  {:else if endpoint && required.length}
    <button type="button" disabled={busy || error === 'limit'} onclick={calculate}>{busy ? (en ? 'Calculating walk…' : 'Υπολογισμός πεζής διαδρομής…') : (en ? 'Calculate street walking route' : 'Υπολόγισε πεζή διαδρομή στους δρόμους')}</button>
    <p>{en ? 'Sends the selected walking endpoints to Google Maps to calculate paths, distance and time.' : 'Στέλνει τα επιλεγμένα σημεία πεζής μετακίνησης στο Google Maps για υπολογισμό πορείας, απόστασης και χρόνου.'}</p>
  {:else if required.length}
    <p>{en ? 'Street walking routes are not enabled yet. Open Google Maps below for walking distance and directions.' : 'Οι πεζές διαδρομές στους δρόμους δεν έχουν ενεργοποιηθεί ακόμη. Άνοιξε το Google Maps παρακάτω για απόσταση και οδηγίες.'}</p>
  {:else}<p>{en ? 'The selected endpoints are at the boarding or alighting stops.' : 'Τα επιλεγμένα σημεία βρίσκονται στις στάσεις επιβίβασης ή αποβίβασης.'}</p>{/if}
  {#if error}<p role="status">{error === 'limit' ? (en ? 'The free walking-route allowance has been reached. Routing has stopped; the bus map remains available.' : 'Εξαντλήθηκε το δωρεάν όριο πεζών διαδρομών. Ο υπολογισμός σταμάτησε· ο χάρτης λεωφορείων παραμένει διαθέσιμος.') : (en ? 'Walking route unavailable. Use the Google Maps link below.' : 'Η πεζή διαδρομή δεν είναι διαθέσιμη. Χρησιμοποίησε τον σύνδεσμο Google Maps παρακάτω.')}</p>{/if}
</div>
<style>
  .walking-details { font-size: 12px; } p { margin: 6px 0; } .attribution { font: 400 12px sans-serif; color: var(--fg); }
  button { min-height: 44px; padding: 8px; color: #fff; background: var(--accent); border: 0; border-radius: 8px; cursor: pointer; }
  button:disabled { opacity: .65; cursor: default; }
</style>
