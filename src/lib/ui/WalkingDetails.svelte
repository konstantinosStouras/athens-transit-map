<script lang="ts">
  import { locale } from '../i18n.svelte';
  import type { AppState } from '../state.svelte';
  import { routeWalking, WalkingRouteError } from '../walking-router';
  import { walkingLabel } from '../walking';
  import { appleWalkUrl, walkUrl } from '../maps';
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
  <h4>{en ? 'Walking stages' : 'Τμήματα πεζής διαδρομής'}</h4>
  <p>{en ? 'Open a stage in your preferred maps app for street directions, walking distance and time.' : 'Άνοιξε κάθε τμήμα στην εφαρμογή χαρτών που προτιμάς για οδηγίες, απόσταση και χρόνο πεζή.'}</p>
  <ol class="walk-stages">
    {#each app.walking as leg}
      {@const fromCurrent = leg.kind === 'board' && app.journey.from.place?.kind === 'me'}
      {@const start = fromCurrent ? undefined : leg.from}
      {@const same = !fromCurrent && leg.from[0] === leg.to[0] && leg.from[1] === leg.to[1]}
      <li>
        <strong>{en ? (leg.kind === 'board' ? 'Walk to the first stop' : leg.kind === 'transfer' ? 'Walk to the next boarding stop' : 'Walk to your destination') : (leg.kind === 'board' ? 'Περπάτησε ως την πρώτη στάση' : leg.kind === 'transfer' ? 'Περπάτησε ως την επόμενη στάση επιβίβασης' : 'Περπάτησε ως τον προορισμό σου')}</strong>
        <p>{fromCurrent ? (en ? 'From your current location → ' : 'Από την τρέχουσα θέση σου → ') : ''}{leg.name}</p>
        {#if leg.route}<p>{walkingLabel(leg, locale.language)}</p>{/if}
        {#if same}<p>{en ? 'Already at this point — no walking needed.' : 'Βρίσκεσαι ήδη σε αυτό το σημείο — δεν χρειάζεται περπάτημα.'}</p>
        {:else}<div class="map-links">
          <a href={appleWalkUrl(leg.to, start)} target="_blank" rel="noopener noreferrer">Apple Maps ↗</a>
          <a href={walkUrl(leg.to, start)} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
        </div>{/if}
      </li>
    {/each}
  </ol>
  <a href={`${import.meta.env.BASE_URL}walking-privacy.html${languageQuery(locale.language)}`} target="_blank" rel="noopener noreferrer">{en ? 'Walking privacy and terms' : 'Απόρρητο και όροι πεζής διαδρομής'}</a>
  {#if complete}
    {#each required as leg}<p>{walkingLabel(leg, locale.language)} → {leg.name}</p>{/each}
    <p class="attribution" translate="no">Google Maps</p>
    <p>{en ? 'Walking routes are in beta and may be missing sidewalks or pedestrian paths. Check the route and crossings on the ground.' : 'Οι διαδρομές πεζών είναι δοκιμαστικές και μπορεί να λείπουν πεζοδρόμια ή πεζόδρομοι. Έλεγξε τη διαδρομή και τις διαβάσεις επί τόπου.'}</p>
  {:else if endpoint && required.length}
    <button type="button" disabled={busy || error === 'limit'} onclick={calculate}>{busy ? (en ? 'Calculating walk…' : 'Υπολογισμός πεζής διαδρομής…') : (en ? 'Calculate street walking route' : 'Υπολόγισε πεζή διαδρομή στους δρόμους')}</button>
    <p>{en ? 'Sends the selected walking endpoints to Google Maps to calculate paths, distance and time.' : 'Στέλνει τα επιλεγμένα σημεία πεζής μετακίνησης στο Google Maps για υπολογισμό πορείας, απόστασης και χρόνου.'}</p>
  {:else if required.length}
    <p>{en ? 'Walking paths and distances are shown in the maps app you open; they are not yet calculated inside this website.' : 'Οι πεζές πορείες και αποστάσεις εμφανίζονται στην εφαρμογή χαρτών που ανοίγεις· δεν υπολογίζονται ακόμη μέσα σε αυτόν τον ιστότοπο.'}</p>
  {:else}<p>{en ? 'The selected endpoints are at the boarding or alighting stops.' : 'Τα επιλεγμένα σημεία βρίσκονται στις στάσεις επιβίβασης ή αποβίβασης.'}</p>{/if}
  {#if error}<p role="status">{error === 'limit' ? (en ? 'The free walking-route allowance has been reached. Routing has stopped; the bus map remains available.' : 'Εξαντλήθηκε το δωρεάν όριο πεζών διαδρομών. Ο υπολογισμός σταμάτησε· ο χάρτης λεωφορείων παραμένει διαθέσιμος.') : (en ? 'Walking route unavailable. Use the Google Maps link below.' : 'Η πεζή διαδρομή δεν είναι διαθέσιμη. Χρησιμοποίησε τον σύνδεσμο Google Maps παρακάτω.')}</p>{/if}
</div>
<style>
  h4 { margin: 4px 0; font-size: 14px; }
  .walk-stages { list-style: none; padding: 0; margin: 10px 0; display: grid; gap: 10px; }
  .walk-stages li { padding: 10px; border: 1px solid var(--border); border-radius: 8px; }
  .map-links { display: flex; flex-wrap: wrap; gap: 8px; }
  .map-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; color: var(--accent); }
  .walking-details { font-size: 12px; } p { margin: 6px 0; } .attribution { font: 400 12px sans-serif; color: var(--fg); }
  button { min-height: 44px; padding: 8px; color: #fff; background: var(--accent); border: 0; border-radius: 8px; cursor: pointer; }
  button:disabled { opacity: .65; cursor: default; }
</style>
