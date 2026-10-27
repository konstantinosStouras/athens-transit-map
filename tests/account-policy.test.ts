import { describe, expect, it } from "vitest";
import { guestSession, preferences, authMessage } from "../src/lib/account-policy";
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}}}
describe("visitor preview policy",()=>{
 it("allows exactly two new sessions while refresh and navigation keep the current session",()=>{
  const local=storage(),first=storage();
  expect(guestSession(local,first)).toEqual({allowed:true,used:1});
  expect(guestSession(local,first)).toEqual({allowed:true,used:1});
  const second=storage();expect(guestSession(local,second)).toEqual({allowed:true,used:2});
  expect(guestSession(local,second)).toEqual({allowed:true,used:2});
  expect(guestSession(local,storage())).toEqual({allowed:false,used:2});
 });
 it("requires sign in when browser storage is unavailable",()=>{
  const blocked={getItem:()=>{throw Error("blocked")},setItem:()=>{throw Error("blocked")}};
  expect(guestSession(blocked,storage()).allowed).toBe(false);
 });
 it("handles invalid stored counters",()=>{
  const local=storage();local.setItem("oasa-preview-count","bad");
  expect(guestSession(local,storage())).toEqual({allowed:true,used:1});
  local.setItem("oasa-preview-count","999");expect(guestSession(local,storage()).allowed).toBe(false);
 });
});
describe("account preferences",()=>{
 it("keeps empty favourites meaningful and removes duplicate IDs",()=>{
  expect(preferences({language:"en",favorites:[]})).toEqual({language:"en",favorites:[]});
  expect(preferences({language:"el",favorites:["040","040","550"]})?.favorites).toEqual(["040","550"]);
 });
 it("rejects malformed or oversized cloud data",()=>{
  for(const data of [null,{}, {language:"de",favorites:[]},{language:"el",favorites:[1]},{language:"el",favorites:[""]},{language:"el",favorites:Array(201).fill("040")}])expect(preferences(data)).toBeNull();
 });
 it("never displays raw provider or credential errors",()=>{
  expect(authMessage("auth/invalid-credential",true)).toBe("The email or password is incorrect.");
  expect(authMessage("secret-token",true)).not.toContain("secret");
  expect(authMessage("auth/network-request-failed",false)).toContain("σύνδεσή");
 });
});
