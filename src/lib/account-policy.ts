import { decodeChoices, encodeChoices } from "./choices";
export interface Preference { language: "el" | "en"; favorites: string[]; choices?: string }
export function preferences(value: unknown): Preference | null {
 const v=value as Partial<Preference> | null;
 if(!v || !["el","en"].includes(v.language??"") || !Array.isArray(v.favorites) || v.favorites.length>200 || !v.favorites.every(x=>typeof x==="string" && x.length>0 && x.length<=80)) return null;
 const choices = v.choices === undefined ? undefined : decodeChoices(v.choices);
 if (choices === null) return null;
 return {language:v.language!, favorites:[...new Set(v.favorites)], ...(choices ? { choices: encodeChoices(choices) } : {})};
}
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }
// A browser-tab session survives refresh/navigation. A new session uses one of two previews.
export function guestSession(local:StorageLike, session:StorageLike): {allowed:boolean; used:number} {
 try {
  const stored=Number(local.getItem("oasa-preview-count")??0);
  const used=Number.isFinite(stored)?Math.max(0,Math.min(2,Math.floor(stored))):0;
  if(session.getItem("oasa-preview-active")==="yes")return {allowed:true,used};
  if(used>=2)return {allowed:false,used:2};
  local.setItem("oasa-preview-count",String(used+1));session.setItem("oasa-preview-active","yes");
  return {allowed:true,used:used+1};
 } catch { return {allowed:false,used:2}; }
}
export function authMessage(code:string, en:boolean):string {
 const messages:Record<string,[string,string]>={
  "auth/user-mismatch":["Επίλεξε τον ίδιο λογαριασμό Google με αυτόν που έχεις συνδέσει.","Choose the same Google account you are signed in with."],
  "auth/wrong-password":["Ο κωδικός δεν είναι σωστός.","The password is incorrect."],
  "auth/invalid-credential":["Το email ή ο κωδικός δεν είναι σωστός.","The email or password is incorrect."],
  "auth/email-already-in-use":["Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκίμασε σύνδεση ή επαναφορά κωδικού.","An account already uses this email. Try signing in or resetting your password."],
  "auth/weak-password":["Χρησιμοποίησε κωδικό με τουλάχιστον 10 χαρακτήρες.","Use a password with at least 10 characters."],
  "auth/invalid-email":["Έλεγξε τη διεύθυνση email.","Check your email address."],
  "auth/popup-blocked":["Ο browser μπλόκαρε το παράθυρο Google. Επίτρεψε τα αναδυόμενα για αυτή τη σελίδα και ξαναδοκίμασε.","Your browser blocked the Google window. Allow pop-ups for this site and try again."],
  "auth/popup-closed-by-user":["Η σύνδεση ακυρώθηκε. Μπορείς να ξαναδοκιμάσεις.","Sign-in was cancelled. You can try again."],
  "auth/cancelled-popup-request":["Η σύνδεση ακυρώθηκε. Δοκίμασε ξανά.","Sign-in was cancelled. Try again."],
  "auth/too-many-requests":["Πάρα πολλές προσπάθειες. Περίμενε λίγο πριν ξαναδοκιμάσεις.","Too many attempts. Wait a little before trying again."],
  "auth/network-request-failed":["Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.","Check your connection and try again."],
  "auth/account-exists-with-different-credential":["Συνδέσου πρώτα με την αρχική μέθοδο του λογαριασμού σου.","Sign in using your account’s original sign-in method."],
  "auth/operation-not-allowed":["Η μέθοδος σύνδεσης δεν είναι διαθέσιμη αυτή τη στιγμή.","This sign-in method is currently unavailable."],
  "auth/unauthorized-domain":["Η σύνδεση δεν είναι διαθέσιμη σε αυτή τη διεύθυνση.","Sign-in is not available on this website address."]
 };
 return (messages[code]??["Κάτι δεν λειτούργησε. Δοκίμασε ξανά.","Something went wrong. Please try again."])[en?1:0];
}
