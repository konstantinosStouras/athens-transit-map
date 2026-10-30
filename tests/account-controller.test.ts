import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { AppState } from "../src/lib/state.svelte";
const mock=vi.hoisted(()=>({
 auth:{currentUser:null as User|null}, callback:undefined as undefined|((user:User|null)=>void),
 snapshot:undefined as undefined|((snapshot:unknown)=>void),
 write:vi.fn(async(..._args:unknown[])=>{}),logout:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),
 reauth:vi.fn(async()=>{}),removeUser:vi.fn(async()=>{}),removeDoc:vi.fn(async(..._args:unknown[])=>{}),getDoc:vi.fn(async()=>({exists:():boolean=>false})),
 locale:{language:"el" as "el"|"en"},
}));
vi.mock("../src/lib/firebase",()=>({firebaseApp:{}}));
vi.mock("../src/lib/i18n.svelte",()=>({locale:mock.locale,setLanguage:(language:"el"|"en")=>{mock.locale.language=language}}));
vi.mock("firebase/auth",()=>({
 getAuth:()=>mock.auth,onAuthStateChanged:(_auth:unknown,callback:(user:User|null)=>void)=>{mock.callback=callback;return ()=>{}},
 EmailAuthProvider:{credential:(email:string,password:string)=>({email,password})},reauthenticateWithCredential:mock.reauth,reauthenticateWithPopup:mock.reauth,deleteUser:mock.removeUser,GoogleAuthProvider:class {setCustomParameters(){}},signInWithPopup:vi.fn(),createUserWithEmailAndPassword:vi.fn(),signInWithEmailAndPassword:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),updateProfile:vi.fn(),signOut:mock.logout,reload:mock.reload,getIdToken:async()=>"token",
}));
vi.mock("firebase/firestore",()=>({
 getFirestore:()=>({}),doc:(_db:unknown,collection:string,uid:string)=>collection+"/"+uid,
 onSnapshot:(_ref:unknown,_options:unknown,callback:(snapshot:unknown)=>void)=>{mock.snapshot=callback;return ()=>{}},
 deleteDoc:mock.removeDoc,getDoc:mock.getDoc,setDoc:mock.write,serverTimestamp:()=>"server-time",
}));
import { emptyChoices, encodeChoices, type Choices } from "../src/lib/choices";
import { Account } from "../src/lib/account.svelte";
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
const snapshot=(data:unknown)=>({exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
function setup(verified:boolean){let choices=emptyChoices();const app={favorites:["040"],snapshotChoices:()=>choices,applyChoices:(value:Choices)=>{choices=value},clearChoices:()=>{choices=emptyChoices()}} as unknown as AppState;const account=new Account(app);const user={uid:"owner",emailVerified:verified,email:"test@example.invalid",providerData:[{providerId:"password"}]} as User;mock.auth.currentUser=user;account.start();mock.callback!(user);return {account,app,user}}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();mock.write.mockResolvedValue();mock.reauth.mockResolvedValue();mock.getDoc.mockResolvedValue({exists:()=>false});mock.snapshot=undefined;mock.locale.language="el";mock.reload.mockResolvedValue();vi.stubGlobal("localStorage",storage());vi.stubGlobal("sessionStorage",storage());vi.stubGlobal("document",{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}});vi.stubGlobal("location",{search:""});vi.stubGlobal("window",{addEventListener:()=>{},removeEventListener:()=>{}})});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals()});
describe("verified account lifecycle",()=>{
 it("blocks an unverified account and unlocks after refreshing verification",async()=>{
  const {account,user}=setup(false);expect(account.allowed).toBe(false);expect(mock.snapshot).toBeUndefined();
  mock.reload.mockImplementation(async()=>{Object.assign(user,{emailVerified:true})});
  await account.checkVerification();expect(account.verified).toBe(true);expect(account.allowed).toBe(true);expect(mock.snapshot).toBeDefined();
 });
 it("restores saved favourites while keeping the URL language",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
  mock.snapshot!(snapshot({language:"en",favorites:[]}));
  expect(app.favorites).toEqual([]);expect(mock.locale.language).toBe("el");
  account.sync("el",[]);expect(mock.write).not.toHaveBeenCalled();
 });
 it("flushes a pending change on sign-out without saving the cleared local favourites",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
  mock.snapshot!(snapshot({language:"el",favorites:["040"]}));
  app.favorites=["040","550"];account.sync("el",app.favorites);await account.logout();
  expect(mock.write).toHaveBeenCalledTimes(1);expect(mock.write.mock.calls[0][1]).toMatchObject({favorites:["040","550"]});
  expect(app.favorites).toEqual([]);expect(mock.logout).toHaveBeenCalledTimes(1);
 });
});


describe("account self-deletion",()=>{
 it("reauthenticates before deleting data and blocks subsequent preference writes",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
  mock.snapshot!(snapshot({language:"en",favorites:["040"]}));
  expect(await account.deleteAccount("test-password")).toBe(true);
  expect(mock.reauth).toHaveBeenCalledTimes(1);
  expect(mock.write.mock.calls[0][0]).toBe("accountDeletions/owner");
  expect(mock.removeDoc).toHaveBeenCalledWith("users/owner");expect(mock.removeUser).toHaveBeenCalledTimes(1);
  expect(mock.reauth.mock.invocationCallOrder[0]).toBeLessThan(mock.removeDoc.mock.invocationCallOrder[0]);
  expect(mock.removeDoc.mock.invocationCallOrder[0]).toBeLessThan(mock.removeUser.mock.invocationCallOrder[0]);
  expect(app.favorites).toEqual([]);const count=mock.write.mock.calls.length;account.sync("el",["550"]);expect(mock.write).toHaveBeenCalledTimes(count);
 });
 it("does not erase anything when reauthentication fails",async()=>{
  const {account}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());mock.reauth.mockRejectedValueOnce({code:"auth/invalid-credential"});
  expect(await account.deleteAccount("wrong-password")).toBe(false);expect(mock.removeDoc).not.toHaveBeenCalled();expect(mock.removeUser).not.toHaveBeenCalled();
 });
 it("deletes unverified accounts without attempting a forbidden profile deletion",async()=>{
  const {account}=setup(false);expect(await account.deleteAccount("test-password")).toBe(true);expect(mock.removeDoc).not.toHaveBeenCalled();expect(mock.removeUser).toHaveBeenCalledTimes(1);
 });
 it("signs a stale session out instead of recreating preferences marked deleted",async()=>{
  const {account,app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());mock.getDoc.mockResolvedValueOnce({exists:()=>true});mock.reload.mockRejectedValueOnce({code:"auth/user-not-found"});mock.snapshot!(snapshot(null));
  await vi.waitFor(()=>expect(mock.logout).toHaveBeenCalledTimes(1));expect(mock.write).not.toHaveBeenCalled();expect(app.favorites).toEqual([]);
 });
});

describe("saved choices across devices",()=>{
 const profile=(choices:Choices)=>({language:"el",favorites:["040"],choices:encodeChoices(choices)});
 async function ready(){const state=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());return state;}
 it("restores cloud choices and accepts later updates without echo writes",async()=>{
  const {app,account}=await ready();const c=emptyChoices();c.selected=["550"];c.metroLines=["M3"];c.panelHidden=true;c.panelView="trip";
  c.journey.from={text:"Home",place:{label:"Home",pts:[[37.98,23.73]],lines:[],kind:"area"}};
  mock.snapshot!(snapshot(profile(c)));expect(app.snapshotChoices()).toEqual(c);
  account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);expect(mock.write).not.toHaveBeenCalled();
  mock.snapshot!(snapshot(profile(emptyChoices())));expect(app.snapshotChoices()).toEqual(emptyChoices());
  account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);expect(mock.write).not.toHaveBeenCalled();
 });
 it("uploads choices and clearing them, without replacing other preference fields",async()=>{
  const {app,account}=await ready();mock.snapshot!(snapshot(profile(emptyChoices())));
  const c=emptyChoices();c.selected=["040"];c.panelHidden=true;app.applyChoices(c);account.sync("el",app.favorites);
  expect(localStorage.getItem("oasa-choices-pending:owner")).toBe(encodeChoices(c));
  await vi.advanceTimersByTimeAsync(400);
  expect(mock.write.mock.calls[0][1]).toEqual({choices:encodeChoices(c),updatedAt:"server-time"});
  expect(localStorage.getItem("oasa-choices-pending:owner")).toBeNull();expect(account.syncStatus).toBe("saved");
  app.clearChoices();account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);
  expect(mock.write.mock.calls[1][1]).toMatchObject({choices:encodeChoices(emptyChoices())});
 });
 it("preserves edits made while the initial cloud snapshot is loading",async()=>{
  const {app,account}=await ready();const local=emptyChoices();local.selected=["550"];app.applyChoices(local);
  mock.snapshot!(snapshot(profile(emptyChoices())));expect(app.snapshotChoices()).toEqual(local);
  await vi.advanceTimersByTimeAsync(400);expect(mock.write.mock.calls[0][1]).toMatchObject({choices:encodeChoices(local)});expect(account.syncStatus).toBe("saved");
 });
 it("recovers unsent choices after reopening and retries a failed write",async()=>{
  const c=emptyChoices();c.metroLines=["M1"];localStorage.setItem("oasa-choices-pending:owner",encodeChoices(c));
  const {app,account}=await ready();mock.write.mockRejectedValueOnce(Error("offline"));mock.snapshot!(snapshot(profile(emptyChoices())));
  await vi.advanceTimersByTimeAsync(400);expect(account.syncStatus).toBe("offline");expect(app.snapshotChoices()).toEqual(c);
  expect(localStorage.getItem("oasa-choices-pending:owner")).toBe(encodeChoices(c));
  account.retry();await vi.advanceTimersByTimeAsync(400);expect(account.syncStatus).toBe("saved");expect(localStorage.getItem("oasa-choices-pending:owner")).toBeNull();
 });
 it("keeps a newer local edit when a previous save is acknowledged",async()=>{
  const {app,account}=await ready();mock.snapshot!(snapshot(profile(emptyChoices())));
  let finish!:()=>void;mock.write.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}));
  const first=emptyChoices();first.selected=["040"];app.applyChoices(first);account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);
  const second=emptyChoices();second.selected=["550"];app.applyChoices(second);account.sync("el",app.favorites);
  mock.snapshot!(snapshot(profile(first)));finish();await vi.advanceTimersByTimeAsync(400);
  expect(app.snapshotChoices()).toEqual(second);expect(mock.write.mock.calls[1][1]).toMatchObject({choices:encodeChoices(second)});expect(account.syncStatus).toBe("saved");
 });
 it("waits for the server instead of uploading over an offline cached profile",async()=>{
  const {app,account}=await ready();const c=emptyChoices();c.selected=["550"];
  mock.snapshot!({...snapshot(profile(c)),metadata:{fromCache:true,hasPendingWrites:false}});
  account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);expect(mock.write).not.toHaveBeenCalled();expect(account.syncStatus).toBe("offline");
  mock.snapshot!(snapshot(profile(c)));expect(app.snapshotChoices()).toEqual(c);
 });
 it("migrates a legacy profile without dropping current local choices",async()=>{
  const {app}=await ready();const c=emptyChoices();c.metroLines=["T6"];app.applyChoices(c);
  mock.snapshot!(snapshot({language:"el",favorites:[]}));await vi.advanceTimersByTimeAsync(400);
  expect(mock.write.mock.calls[0][1]).toMatchObject({choices:encodeChoices(c)});expect(app.favorites).toEqual([]);
 });
 it("does not import a different account's local choices or outbox",async()=>{
  localStorage.setItem("oasa-choices-owner","another");const c=emptyChoices();c.selected=["550"];
  localStorage.setItem("oasa-choices-pending:another",encodeChoices(c));
  const {app}=await ready();mock.snapshot!(snapshot(profile(emptyChoices())));expect(app.snapshotChoices()).toEqual(emptyChoices());
  await vi.advanceTimersByTimeAsync(400);expect(mock.write).not.toHaveBeenCalled();
 });
 it("honours an explicit shared route only on initial restore",async()=>{
  vi.stubGlobal("location",{search:"?l=550"});const {app}=await ready();mock.snapshot!(snapshot(profile(emptyChoices())));
  expect(app.snapshotChoices().selected).toEqual(["550"]);await vi.advanceTimersByTimeAsync(400);
  mock.snapshot!(snapshot(profile(emptyChoices())));expect(app.snapshotChoices().selected).toEqual([]);
 });
});

it("saves a return to the original choices while another write is in flight",async()=>{
 const {app,account}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
 const original=emptyChoices();mock.snapshot!(snapshot({language:"el",favorites:["040"],choices:encodeChoices(original)}));
 let finish!:()=>void;mock.write.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}));
 const c=emptyChoices();c.selected=["550"];app.applyChoices(c);account.sync("el",app.favorites);await vi.advanceTimersByTimeAsync(400);
 app.clearChoices();account.sync("el",app.favorites);finish();await vi.advanceTimersByTimeAsync(400);
 expect(mock.write.mock.calls[1][1]).toMatchObject({choices:encodeChoices(original)});expect(account.syncStatus).toBe("saved");
});
it("removes an already acknowledged outbox so it cannot resurrect stale choices",async()=>{
 const c=emptyChoices();c.selected=["550"];localStorage.setItem("oasa-choices-pending:owner",encodeChoices(c));
 const {app}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
 mock.snapshot!(snapshot({language:"el",favorites:["040"],choices:encodeChoices(c)}));
 expect(localStorage.getItem("oasa-choices-pending:owner")).toBeNull();
 mock.snapshot!(snapshot({language:"el",favorites:["040"],choices:encodeChoices(emptyChoices())}));expect(app.snapshotChoices()).toEqual(emptyChoices());
});
it("keeps an undo made before initial account loading finishes",async()=>{
 const {app,account}=setup(true);await vi.waitFor(()=>expect(mock.snapshot).toBeDefined());
 const c=emptyChoices();c.selected=["550"];app.applyChoices(c);account.sync("el",app.favorites);
 app.clearChoices();account.sync("el",app.favorites);
 mock.snapshot!(snapshot({language:"el",favorites:["040"],choices:encodeChoices(c)}));
 expect(app.snapshotChoices()).toEqual(emptyChoices());await vi.advanceTimersByTimeAsync(400);
 expect(mock.write.mock.calls[0][1]).toMatchObject({choices:encodeChoices(emptyChoices())});
});
