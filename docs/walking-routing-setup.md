# Street walking routes: activation checklist

Prepared 28 October 2026. Google billing and routing are NOT activated by this code.

## What a request means

One Compute Routes call calculates one walking leg. A direct transit journey normally
needs two (walk to the bus, walk after the bus); a transfer can add a third.
No calls occur while typing, moving the map, refreshing GPS or receiving bus updates.
The user explicitly clicks Calculate street walking route. Identical endpoints and
already calculated legs in the current selection do not cause another call.
Failures count against our guard, whether or not Google bills them. No automatic retries.

## Map choice

Keep MapLibre/OpenFreeMap. It renders the map; Google Routes calculates pedestrian paths.
For an eligible EEA billing account, request only route distance, duration and geometry.
Do not request or display Google's route description or steps alongside the map.
Show Google Maps attribution and the required walking beta warning. Check the actual
billing-account address, not merely the Google account's country setting.

Before activation, clarify walking mode's beta status with Google Maps support or the
applicable agreement: the EEA Pre-GA terms section 6.5(b) restrict Pre-GA offerings
with non-Google maps. The general EEA Routes integration guide alone does not settle
whether that restriction applies to WALK mode. Keep the integration disabled until
eligibility is confirmed; do not assume the core Routes allowance overrides it.

## No-charge constraints

Google Maps requires a billing account and is pay-as-you-go, NOT a contractual hard-€0
plan. A budget alert is not a cap. Free allowance is shared across projects attached
to the billing account. This gateway bounds THIS application's calls; it cannot cap
other projects, leaked credentials, unrelated Firebase spending or future price changes.
Do not activate if those conditions cannot be checked to meet the user's €0 requirement.

Use a dedicated routing-only Cloud project. Do not link billing to the existing
`stouras-oasa-live` Firebase project: that could also change its billing exposure.
Select an existing Greek billing account; do not create accounts to multiply allowances.
Review all Compute Routes Essentials usage on that account first. Allocate at most
9,000 of the currently published 10,000 free monthly requests, LESS other-project use
and reserved expected use. If the remainder is unknown, keep routing disabled.

The gateway enforces at most 300/day and the lower allocated monthly limit, in Google's
Pacific billing timezone. Counters are durable, atomic SQL reservations before every
Google call; D1 failure/exhaustion stops calls. No counter refunds, no retries. CORS is
only a browser restriction, not authentication; even forged-origin callers share the
same global cap. A lost/deleted/reset database invalidates the accounting: disable
routing and reconcile upstream use before restoring. Do not deploy multiple independent
gateways or counters against the same allocation.

`ALLOWANCE_MONTH` must match the current Pacific YYYY-MM. At month rollover routing
stops until an operator checks pricing and the shared allowance and renews the allocation.
This deliberate monthly review prevents silently spending against an unverified allowance.
Reduce the Google-side Compute Routes daily quota to 300 if that quota is available;
set a low per-minute quota as a second layer. Do not claim a minute quota alone is a
monthly spending cap. Disable unused services/credentials in the routing-only project.

## Google setup (human decisions / approvals)

1. Choose the existing Greek billing account to use for the isolated routing project.
   Linking it creates pay-as-you-go billing eligibility. Confirm this after reviewing
   the shared allowance; do not link the existing Firebase app instead.
2. Open APIs & Services → Library → Routes API → Enable. Review and accept the Google
   Maps Platform terms when prompted. Do not enable Maps JavaScript, Places, Geocoding,
   Route Matrix or paid hosting for this implementation.
3. Create a dedicated key restricted to Routes API ONLY. Store it as the Worker's
   secret `GOOGLE_ROUTES_KEY`; never in VITE variables, GitHub source, chat, screenshots
   or the public Firebase config. Audit all other keys in the routing project.
4. Record the actual EEA billing address and current shared allowance. Set the available
   daily/minute quotas. Keep the Worker disabled until verification finishes.

## Free gateway hosting

Use Cloudflare Workers **Free**, with D1 **Free**. Their free limits stop service;
do not upgrade to Workers Paid. Cloud Run/Firebase Functions are not selected because
their billing exposure would need separate controls.

After the user signs into or creates a Free Cloudflare account and approves using it:

1. Create D1 database `oasa-walking-budget`. Run `walking-gateway/schema.sql` once.
2. Replace `database_id` in `walking-gateway/wrangler.jsonc` with its real ID. Preserve
   the DB across deployments; never reset a current month's row.
3. Deploy the TypeScript Worker with Wrangler from `walking-gateway/`, initially disabled.
   Add `GOOGLE_ROUTES_KEY` as a secret through Cloudflare's secure input or secret CLI.
   Keep request logging disabled and never log coordinates or upstream credentials.
4. Verify Free plan, database binding and persistent counter. Set `MONTHLY_LIMIT` to
   the checked allocation (1–9000), `ALLOWANCE_MONTH` to the verified month and enable
   only after all conditions above are checked.
5. Test one known public-stop pair (no user location), confirm Google's response and
   counter increment, force the app limit to confirm denial without an upstream call,
   then restore the approved limit. Test calls count against the same allowance.
6. Set repository Actions variable `VITE_WALKING_URL` to the worker's HTTPS `/walk`
   endpoint. Run deploy.yml and test English/Greek, mobile, cancellation, quota errors.
7. Update feedback/What's new to say ACTIVATED only after the live test succeeds.

Only endpoints needed for the requested calculation go to Cloudflare and Google after
the user clicks the calculation button. The gateway stores counts, not coordinates or
routes. The browser holds route results only in current in-memory app state. Publish
and review routing privacy/terms information before activation.

## Validation

`npm test` and `npm run check`; `node scripts/check-walking-budget.mjs` (Node 22+).
The SQL check exercises the real reservation statement with thousands of requests.
Unit tests assert no upstream calls for exhausted/failed counting, wrong month, disabled
configuration or bad coordinates, and no automatic retry after failures.
These tests do not substitute for a deployment test of D1 and the real Google service.

## References

- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/billing-and-pricing/overview
- https://developers.google.com/maps/comms/eea/routes
- https://cloud.google.com/terms/maps-platform/eea/maps-service-terms
- https://developers.google.com/maps/documentation/routes/route-opt
- https://developers.google.com/maps/documentation/routes/usage-and-billing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/reference/faq/
