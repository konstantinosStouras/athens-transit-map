import { decodeChoices, encodeChoices, emptyChoices, readChoices, resolveChoices, type Choices } from "./choices";
import { deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut, reload, getIdToken, type User } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { firebaseApp } from "./firebase";
import { guestSession, preferences, authMessage, type Preference } from "./account-policy";
import { locale } from "./i18n.svelte";
import type { AppState } from "./state.svelte";
export class Account {
 user = $state.raw<User|null>(null);
 ready=$state(false); busy=$state(false); open=$state(false); error=$state(""); message=$state("");
 deletionPending=$state(false);
 guestAllowed=$state(false); used=$state(0); syncStatus=$state<"loading"|"saved"|"saving"|"offline">("loading");
 private emailVerified=$state(false);
 verified=$derived(!!this.user&&this.emailVerified);
 allowed=$derived(this.ready && (this.user ? this.verified&&!this.deletionPending : this.guestAllowed));
 private stopAuth?:Unsubscribe; private stopPrefs?:Unsubscribe; private revision=0;
 private last:Preference|null=null; private prefReady=$state(false); private timer?:ReturnType<typeof setTimeout>;
 private writeChain=Promise.resolve(); private resendAfter=0; private pending:Preference|null=null; private pendingInitial=false;
 private database?:typeof import("firebase/firestore");
 private initialChoices=""; private sharedSearch:string|null=null; private deferred:Preference|null=null; private writing=0; private loadingEdited=false;
 constructor(private app:AppState) {
  const local=readChoices(), search=typeof location==="undefined"?"":location.search;
  if(resolveChoices(local,search)!==local)this.sharedSearch=search;
 }
 private pendingKey(uid:string){return "oasa-choices-pending:"+uid}
 private storedPending(uid:string):string|null{
  try{const value=localStorage.getItem(this.pendingKey(uid));return decodeChoices(value)?value:null}catch{return null}
 }
 private rememberPending(uid:string,choices:string){try{localStorage.setItem(this.pendingKey(uid),choices)}catch{}}
 private clearPending(uid:string,choices:string){try{if(localStorage.getItem(this.pendingKey(uid))===choices)localStorage.removeItem(this.pendingKey(uid))}catch{}}
 private apply(payload:string){
  const value=decodeChoices(payload);
  if(value&&encodeChoices(this.app.snapshotChoices())!==payload)this.app.applyChoices(value);
 }
 start(){
  const auth=getAuth(firebaseApp);this.stopAuth=onAuthStateChanged(auth,user=>{void this.changed(user)},()=>{this.ready=true;this.syncStatus="offline";this.error=this.words("Η υπηρεσία λογαριασμών δεν είναι διαθέσιμη. Δοκίμασε ξανά.","Account services are unavailable. Please try again.");});
  window.addEventListener("focus",this.onFocus);
  window.addEventListener("online",this.onOnline);
  window.addEventListener("pagehide",this.onPageHide);
  document.addEventListener("visibilitychange",this.onVisibility);
  return ()=>{this.stopAuth?.();this.stopPrefs?.();clearTimeout(this.timer);window.removeEventListener("focus",this.onFocus);window.removeEventListener("online",this.onOnline);window.removeEventListener("pagehide",this.onPageHide);document.removeEventListener("visibilitychange",this.onVisibility)};
 }
 private words(el:string,en:string){return locale.language==="en"?en:el}
 private onFocus=()=>{if(this.user&&!this.user.emailVerified&&!this.busy)void this.checkVerification();else if(this.verified&&this.syncStatus==="offline")this.retry()};
 private onOnline=()=>{if(this.verified)this.retry()};
 private onPageHide=()=>this.flush();
 private onVisibility=()=>{if(document.hidden)this.flush()};
 private async changed(user:User|null){
  const revision=++this.revision;this.stopPrefs?.();clearTimeout(this.timer);this.pending=null;this.pendingInitial=false;this.deferred=null;this.writing=0;this.last=null;this.prefReady=false;this.user=user;this.deletionPending=false;this.emailVerified=!!user?.emailVerified;
  this.error="";this.message="";this.syncStatus="loading";this.ready=true;
  let owner:string|null=null;try{owner=localStorage.getItem("oasa-choices-owner")}catch{}
  if(owner&&owner!==user?.uid){
   this.app.applyChoices(resolveChoices(emptyChoices(),this.sharedSearch??""));
   this.app.favorites=[];
   try{localStorage.removeItem("oasa-choices-owner");localStorage.setItem("favorites","[]")}catch{}
  }
  this.initialChoices=encodeChoices(this.app.snapshotChoices());
  this.loadingEdited=false;
  if(!user){let trial={allowed:false,used:2};try{trial=guestSession(localStorage,sessionStorage)}catch{}this.guestAllowed=trial.allowed;this.used=trial.used;return;}
  if(!user.emailVerified){this.open=true;return;}
  this.open=false;
  try{localStorage.setItem("oasa-choices-owner",user.uid)}catch{}
  try { this.database=await import("firebase/firestore"); } catch { this.syncStatus="offline";return; }
  if(revision!==this.revision)return;
  const {doc,getFirestore,onSnapshot}=this.database;
  const reference=doc(getFirestore(firebaseApp),"users",user.uid);
  this.stopPrefs=onSnapshot(reference,{includeMetadataChanges:true},snapshot=>{
   if(revision!==this.revision || snapshot.metadata.hasPendingWrites)return;
   if(snapshot.metadata.fromCache){this.syncStatus="offline";return;}
   const remote=preferences(snapshot.data());
   if(remote){
    this.receive(remote,user.uid);
   }else if(!snapshot.exists()){
    const {getDoc,doc,getFirestore}=this.database!;
    void getDoc(doc(getFirestore(firebaseApp),"accountDeletions",user.uid)).then(marker=>{
     if(revision!==this.revision)return;
     if(marker.exists()){
      this.prefReady=false;this.stopPrefs?.();clearTimeout(this.timer);this.revision++;this.app.favorites=[];this.app.clearChoices();try{localStorage.removeItem(this.pendingKey(user.uid));localStorage.removeItem("oasa-choices-owner")}catch{}
      try{localStorage.removeItem("favorites")}catch{}
      void reload(user).then(()=>{if(revision+1===this.revision){this.deletionPending=true;this.open=true;this.syncStatus="offline";}}).catch(()=>{if(revision+1===this.revision)void signOut(getAuth(firebaseApp))});return;
     }
     const pending=this.storedPending(user.uid);if(pending)this.apply(pending);
     this.last=this.current();this.prefReady=true;this.schedule(this.last,true);
    }).catch(()=>{if(revision===this.revision)this.syncStatus="offline"});
   }else {this.syncStatus="offline";}
  },()=>{if(revision===this.revision)this.syncStatus="offline"});
 }
 private receive(remote:Preference,uid:string){
  const current=this.current();
  if(this.prefReady&&this.last&&JSON.stringify(current)!==JSON.stringify(this.last)){this.deferred=remote;return;}
  const first=!this.prefReady;
  if(remote.choices)this.clearPending(uid,remote.choices);
  let desired=remote.choices;
  if(first){
   const pending=this.storedPending(uid);
   if(pending)desired=pending;
   else if(current.choices!==this.initialChoices)desired=current.choices;
   else if(desired&&this.sharedSearch)desired=encodeChoices(resolveChoices(decodeChoices(desired)!,this.sharedSearch));
   this.sharedSearch=null;
  }
  this.last={...remote,language:locale.language};
  this.app.favorites=remote.favorites;
  if(desired)this.apply(desired);
  try{localStorage.setItem("favorites",JSON.stringify(remote.favorites))}catch{}
  this.prefReady=true;
  this.syncStatus="saved";
  const next=this.current();
  if(JSON.stringify(next)!==JSON.stringify(this.last))this.schedule(next);
 }
 private current():Preference{return {language:locale.language,favorites:[...this.app.favorites].slice(0,200),choices:encodeChoices(this.app.snapshotChoices())}}
 sync(language:Preference["language"],favorites:string[],choices:Choices=this.app.snapshotChoices()){
  if(!this.verified)return;
  let next:Preference;
  try{next={language,favorites:[...favorites].slice(0,200),choices:encodeChoices(choices)}}catch{this.syncStatus="offline";return;}
  if(!this.prefReady){
   if(next.choices!==this.initialChoices)this.loadingEdited=true;
   if(this.loadingEdited&&this.user&&next.choices)this.rememberPending(this.user.uid,next.choices);
   return;
  }
  if(JSON.stringify(next)===JSON.stringify(this.last)&&!this.pending&&!this.writing)return;
  this.schedule(next);
 }
 private schedule(next:Preference,initial=false){
  clearTimeout(this.timer);this.syncStatus="saving";this.pending=next;this.pendingInitial=initial||this.pendingInitial;
  if(this.user&&next.choices)this.rememberPending(this.user.uid,next.choices);
  this.timer=setTimeout(()=>this.flush(),350);
 }
 private flush(){
   clearTimeout(this.timer);if(!this.pending||!this.user||!this.prefReady)return;
   const next=this.pending,initial=this.pendingInitial,uid=this.user.uid,revision=this.revision;
   const {doc,getFirestore,setDoc,serverTimestamp}=this.database!;
   this.pending=null;this.pendingInitial=false;
   this.writing++;
   this.writeChain=this.writeChain.catch(()=>{}).then(async()=>{
    if(revision!==this.revision)return;
    const previous=this.last;const patch:Record<string,unknown>={updatedAt:serverTimestamp()};
    if(initial||previous?.language!==next.language)patch.language=next.language;
    if(initial||JSON.stringify(previous?.favorites)!==JSON.stringify(next.favorites))patch.favorites=next.favorites;
    if(next.choices)patch.choices=next.choices;
    try{
     await setDoc(doc(getFirestore(firebaseApp),"users",uid),patch,{merge:true});
     if(revision===this.revision){
      this.last=next;
      if(next.choices)this.clearPending(uid,next.choices);
      const clean=!this.pending&&JSON.stringify(this.current())===JSON.stringify(next);
      this.syncStatus=clean?"saved":"saving";
      const deferred=this.deferred;this.deferred=null;
      if(clean&&deferred&&deferred.choices===next.choices)this.receive(deferred,uid);
     }
    }catch{if(revision===this.revision)this.syncStatus="offline";}
    finally{if(revision===this.revision)this.writing--;}
   });
 }
 async run(action:()=>Promise<unknown>){if(this.busy)return;this.busy=true;this.error="";this.message="";try{await action()}catch(error){this.error=authMessage((error as {code?:string}).code??"",locale.language==="en")}finally{this.busy=false}}
 async google(){await this.run(async()=>{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});const result=await signInWithPopup(getAuth(firebaseApp),provider);if(!result.user.emailVerified)await this.sendVerification();})}
 async email(email:string,password:string,name:string,register:boolean){await this.run(async()=>{
  const auth=getAuth(firebaseApp);const result=register?await createUserWithEmailAndPassword(auth,email,password):await signInWithEmailAndPassword(auth,email,password);
  if(register&&name.trim())await updateProfile(result.user,{displayName:name.trim().slice(0,100)});
  if(!result.user.emailVerified)await this.sendVerification();
 })}
 async sendVerification(){const user=getAuth(firebaseApp).currentUser;if(!user)return;
  if(Date.now()<this.resendAfter){this.message=this.words("Περίμενε ένα λεπτό πριν ζητήσεις νέο email.","Wait a minute before requesting another email.");return;}
  const auth=getAuth(firebaseApp);auth.languageCode=locale.language;
  await sendEmailVerification(user,{url:new URL(import.meta.env.BASE_URL,location.origin).href});this.resendAfter=Date.now()+60000;
  this.message=this.words("Στείλαμε σύνδεσμο επιβεβαίωσης. Έλεγξε και την ανεπιθύμητη αλληλογραφία.","Verification link sent. Check your inbox and spam folder.");
 }
 async resend(){await this.run(()=>this.sendVerification())}
 async checkVerification(){await this.run(async()=>{const user=getAuth(firebaseApp).currentUser;if(!user)return;await reload(user);await getIdToken(user,true);if(user.emailVerified)await this.changed(user);else this.message=this.words("Το email δεν έχει επιβεβαιωθεί ακόμη. Άνοιξε τον σύνδεσμο στο email και δοκίμασε ξανά.","Your email is not verified yet. Open the email link, then check again.");})}
 async reset(email:string){await this.run(async()=>{getAuth(firebaseApp).languageCode=locale.language;await sendPasswordResetEmail(getAuth(firebaseApp),email,{url:new URL(import.meta.env.BASE_URL,location.origin).href});this.message=this.words("Αν υπάρχει λογαριασμός, θα λάβεις οδηγίες επαναφοράς κωδικού.","If an account exists, you’ll receive password reset instructions.");})}
 async logout(){await this.run(async()=>{this.flush();await this.writeChain.catch(()=>{});this.prefReady=false;this.stopPrefs?.();this.revision++;await signOut(getAuth(firebaseApp));this.app.favorites=[];this.app.clearChoices();try{localStorage.removeItem("oasa-choices-owner");localStorage.setItem("favorites","[]")}catch{} })}
 async deleteAccount(password:string){
  let removed=false;
  await this.run(async()=>{
   const user=getAuth(firebaseApp).currentUser;if(!user)return;
   if(user.providerData.some(provider=>provider.providerId==="password")){
    if(!user.email||!password)throw {code:"auth/invalid-credential"};
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
   }else{
    const provider=new GoogleAuthProvider();provider.setCustomParameters({login_hint:user.email??"",prompt:"select_account"});
    await reauthenticateWithPopup(user,provider);
   }
   await getIdToken(user,true);
   // Stop preference listeners/writers before deleting data so they cannot recreate it.
   clearTimeout(this.timer);this.pending=null;this.pendingInitial=false;this.prefReady=false;this.syncStatus="offline";this.stopPrefs?.();this.revision++;
   let timeout:ReturnType<typeof setTimeout>|undefined;
   try {
    await Promise.race([this.writeChain,new Promise((_,reject)=>{timeout=setTimeout(()=>reject({code:"auth/network-request-failed"}),12000)})]);
   } finally { clearTimeout(timeout); }
   const database=await import("firebase/firestore");
   const reference=database.doc(database.getFirestore(firebaseApp),"users",user.uid);
   const marker=database.doc(database.getFirestore(firebaseApp),"accountDeletions",user.uid);
   const backup=this.current();
   if(user.emailVerified){
    if(!(await database.getDoc(marker)).exists())await database.setDoc(marker,{deletedAt:database.serverTimestamp()});
    await database.deleteDoc(reference);
   }
   try { await deleteUser(user); } catch(error){
    // Restore the account preferences if Auth deletion failed after the data step.
    const code=(error as {code?:string}).code;
    if(user.emailVerified && code!=="auth/network-request-failed" && code!=="auth/internal-error"){try{await database.deleteDoc(marker);await database.setDoc(reference,{...backup,updatedAt:database.serverTimestamp()});await this.changed(user)}catch{this.syncStatus="offline";}}
    else this.deletionPending=true;
    throw error;
   }
   this.app.favorites=[];this.app.clearChoices();try{localStorage.removeItem(this.pendingKey(user.uid));localStorage.removeItem("oasa-choices-owner");localStorage.removeItem("favorites");localStorage.removeItem("oasa-language")}catch{}
   removed=true;this.message=this.words("Ο λογαριασμός και οι αποθηκευμένες προτιμήσεις σου διαγράφηκαν.","Your account and saved preferences have been deleted.");this.open=true;
  });
  return removed;
 }
 retry(){if(this.prefReady&&this.user&&this.database){this.schedule(this.current(),!this.last);return;}void this.changed(getAuth(firebaseApp).currentUser)}
}
