import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { AppState } from "../src/lib/state.svelte";
const mock=vi.hoisted(()=>({
 auth:{currentUser:null as User|null}, callback:undefined as undefined|((user:User|null)=>void),
 snapshot:undefined as undefined|((snapshot:unknown)=>void),
 write:vi.fn(async(..._args:unknown[])=>{}),logout:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),
 locale:{language:"el" as "el"|"en"},
}));
vi.mock("../src/lib/firebase",()=>({firebaseApp:{}}));
vi.mock("../src/lib/i18n.svelte",()=>({locale:mock.locale,setLanguage:(language:"el"|"en")=>{mock.locale.language=language}}));
vi.mock("firebase/auth",()=>({
 getAuth:()=>mock.auth,onAuthStateChanged:(_auth:unknown,callback:(user:User|null)=>void)=>{mock.callback=callback;return ()=>{}},
 GoogleAuthProvider:class {},signInWithPopup:vi.fn(),createUserWithEmailAndPassword:vi.fn(),signInWithEmailAndPassword:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),updateProfile:vi.fn(),signOut:mock.logout,reload:mock.reload,getIdToken:async()=>"token",
}));
vi.mock("firebase/firestore",()=>({
 getFirestore:()=>({}),doc:(_db:unknown,collection:string,uid:string)=>collection+"/"+uid,
 onSnapshot:(_ref:unknown,callback:(snapshot:unknown)=>void)=>{mock.snapshot=callback;return ()=>{}},
 setDoc:mock.write,serverTimestamp:()=>"server-time",
}));
import { Account } from "../src/lib/account.svelte";
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}}}
const snapshot=(data:unknown)=>({exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
function setup(verified:boolean){const app={favorites:["040"]} as AppState;const account=new Account(app);const user={uid:"owner",emailVerified:verified,email:"test@example.invalid"} as User;mock.auth.currentUser=user;account.start();mock.callback!(user);return {account,app,user}}
beforeEach(()=>{vi.clearAllMocks();mock.snapshot=undefined;mock.locale.language="el";mock.reload.mockResolvedValue();vi.stubGlobal("localStorage",storage());vi.stubGlobal("sessionStorage",storage());vi.stubGlobal("window",{addEventListener:()=>{},removeEventListener:()=>{}})});
describe("verified account lifecycle",()=>{
 it("blocks an unverified account and unlocks after refreshing verification",async()=>{
  const {account,user}=setup(false);expect(account.allowed).toBe(false);expect(mock.snapshot).toBeUndefined();
  mock.reload.mockImplementation(async()=>{Object.assign(user,{emailVerified:true})});
  await account.checkVerification();expect(account.verified).toBe(true);expect(account.allowed).toBe(true);expect(mock.snapshot).toBeDefined();
 });
 it("restores saved empty favourites instead of uploading the previous device list",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
  mock.snapshot!(snapshot({language:"en",favorites:[]}));
  expect(app.favorites).toEqual([]);expect(mock.locale.language).toBe("en");
  account.sync("en",[]);expect(mock.write).not.toHaveBeenCalled();
 });
 it("flushes a pending change on sign-out without saving the cleared local favourites",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
  mock.snapshot!(snapshot({language:"el",favorites:["040"]}));
  app.favorites=["040","550"];account.sync("el",app.favorites);await account.logout();
  expect(mock.write).toHaveBeenCalledTimes(1);expect(mock.write.mock.calls[0][1]).toMatchObject({favorites:["040","550"]});
  expect(app.favorites).toEqual([]);expect(mock.logout).toHaveBeenCalledTimes(1);
 });
});
