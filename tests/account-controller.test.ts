import { beforeEach, describe, expect, it, vi } from "vitest";
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
 onSnapshot:(_ref:unknown,callback:(snapshot:unknown)=>void)=>{mock.snapshot=callback;return ()=>{}},
 deleteDoc:mock.removeDoc,getDoc:mock.getDoc,setDoc:mock.write,serverTimestamp:()=>"server-time",
}));
import { Account } from "../src/lib/account.svelte";
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
const snapshot=(data:unknown)=>({exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
function setup(verified:boolean){const app={favorites:["040"]} as AppState;const account=new Account(app);const user={uid:"owner",emailVerified:verified,email:"test@example.invalid",providerData:[{providerId:"password"}]} as User;mock.auth.currentUser=user;account.start();mock.callback!(user);return {account,app,user}}
beforeEach(()=>{vi.clearAllMocks();mock.reauth.mockResolvedValue();mock.getDoc.mockResolvedValue({exists:()=>false});mock.snapshot=undefined;mock.locale.language="el";mock.reload.mockResolvedValue();vi.stubGlobal("localStorage",storage());vi.stubGlobal("sessionStorage",storage());vi.stubGlobal("window",{addEventListener:()=>{},removeEventListener:()=>{}})});
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
