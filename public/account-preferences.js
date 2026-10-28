import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,setDoc,getDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {feedbackConfig} from './feedback-config.js';
const app=getApps().length?getApp():initializeApp(feedbackConfig),auth=getAuth(app),db=getFirestore(app);
let user=null,stop,remoteLanguage=null,applying=false,loaded=false;
const link=document.getElementById('account-link');
function render(){if(!link)return;const en=document.documentElement.lang==='en';link.textContent=user?.emailVerified?(en?'My account':'Ο λογαριασμός μου'):(en?'Sign in / Register':'Σύνδεση / Εγγραφή');link.href='./?account=1&lang='+document.documentElement.lang;}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{render();if(!applying&&loaded&&user?.emailVerified&&button.dataset.lang!==remoteLanguage){void setDoc(doc(db,'users',user.uid),{language:button.dataset.lang,updatedAt:serverTimestamp()},{merge:true}).catch(()=>{const status=document.getElementById('account-sync-status');if(status)status.textContent=document.documentElement.lang==='en'?'Language saved on this device; sync unavailable.':'Η γλώσσα αποθηκεύτηκε στη συσκευή· ο συγχρονισμός δεν είναι διαθέσιμος.';});}}));
onAuthStateChanged(auth,current=>{user=current;stop?.();loaded=false;render();if(!user?.emailVerified)return;stop=onSnapshot(doc(db,'users',user.uid),snapshot=>{if(snapshot.metadata.hasPendingWrites)return;if(!snapshot.exists()){void getDoc(doc(db,'accountDeletions',current.uid)).then(marker=>{if(user?.uid===current.uid&&marker.exists()){stop?.();try{localStorage.removeItem('favorites')}catch{}void signOut(auth)}}).catch(()=>{});return;}const language=snapshot.data().language;if(language!=='el'&&language!=='en')return;loaded=true;remoteLanguage=language;if(document.documentElement.lang!==language){applying=true;document.querySelector('[data-lang="'+language+'"]').click();applying=false;}},()=>{});});
render();
