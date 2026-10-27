import { getApp, getApps, initializeApp } from "firebase/app";
// Public Firebase web configuration. Security is enforced by Authentication and Firestore rules.
export const firebaseApp = getApps().length ? getApp() : initializeApp({
 projectId:"stouras-oasa-live",appId:"1:449869894186:web:09a2007e16ad7b33e1e953",
 apiKey:"AIzaSyBsAqhkIbJqCEBwHFuSu8Fuy311VCkWBAM",authDomain:"stouras-oasa-live.firebaseapp.com"
});
