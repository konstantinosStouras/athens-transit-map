<script lang="ts">
  import { locale } from "../i18n.svelte";
  let { kind }: { kind?: "bus" | "trolley" } = $props();
  const label = $derived(kind === "trolley" ? (locale.language === "en" ? "Trolleybus" : "Τρόλεϊ") : (locale.language === "en" ? "Bus" : "Λεωφορείο"));
</script>

{#if kind === "bus" || kind === "trolley"}
  <span class="type" title={label}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {#if kind === "trolley"}<path d="M8 4 5 1m11 3 3-3"/>{/if}
      <rect x="4" y="4" width="16" height="15" rx="3"/><path d="M4 13h16M7 19v2m10-2v2M7 8h10"/><circle cx="8" cy="16" r=".7"/><circle cx="16" cy="16" r=".7"/>
    </svg><span>{label}</span>
  </span>
{/if}

<style>
  .type { display: inline-flex; align-items: center; gap: 3px; color: var(--muted); font-size: 11px; font-weight: 600; white-space: nowrap; }
  svg { flex: none; }
</style>
