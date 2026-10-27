# Accounts and cross-device preferences

OASA Live uses only Firebase project `stouras-oasa-live`. Google and email/password providers are enabled. Authorized domains include `www.stouras.com`, `stouras.com`, `konstantinosstouras.github.io` and `localhost`. Firebase uses its standard hosted OAuth handler. Provider configuration is in `firebase.json`; deploy it with `firebase deploy --only auth --project stouras-oasa-live`.

Email accounts need verification before accessing the map or saving cloud preferences. Google accounts accepted as verified by Firebase do not need a redundant email. The form supports email verification resend, refreshing verification status, password reset, password managers and password visibility. Firebase enforces a minimum 10-character password and email enumeration protection. These two settings were configured through the Identity Toolkit admin API, separately from provider deployment.

Each verified user owns `users/{uid}` with only `language`, `favorites` and a server `updatedAt`. Firestore rules check UID and the email_verified token claim. New accounts import the device's language/favourites; existing accounts restore their saved preferences (including an explicitly empty list). Subsequent changes sync live and are coalesced before writing. Signing out clears locally cached favourites. Static pages use `account-preferences.js` to share the same account and language preference.

Two guest previews are counted per browser/device using localStorage; the active tab preview is retained in sessionStorage. Refresh and page navigation do not consume another preview. A new tab/session without the marker consumes the next preview. Browsers can restore sessionStorage with restored tabs. Clearing site data or using a different browser starts a new allowance: this is a frontend product gate, not an anti-abuse boundary. The upstream transit server remains public. Visitors with blocked storage must sign in. Public feedback/help/release notes stay accessible.

Authentication persistence uses the Firebase SDK defaults. Sensitive credentials are handled by Firebase, never stored in preference documents. Preferences do not include location or journey history. The feedback collection keeps its separate private, create-only policy.

Verification: unit tests cover preview counting and malformed preference data. A production smoke test used disposable accounts to confirm that unverified writes, cross-account access, unauthenticated reads, excessive favourites and unexpected fields are denied. Test accounts and preference documents were removed afterwards. Google personal-account consent and actual delivery to a real email inbox require a user's own sign-in; no personal credentials were used for tests.

Rollback: revert the account UI release and redeploy Pages if sign-in or map loading fails. Preserve user preference documents. Do not replace the existing private feedback rules when changing account rules.
