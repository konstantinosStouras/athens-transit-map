// Run with Node 22+; exercise the actual SQL used by the Cloudflare D1 gateway.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../walking-gateway/schema.sql', import.meta.url), 'utf8'));
const worker = readFileSync(new URL('../walking-gateway/worker.ts', import.meta.url), 'utf8');
const sql = worker.match(/RESERVE_SQL = `([\s\S]*?)`;/)[1];
const reserve = db.prepare(sql);
let accepted = 0;
for (let i=0; i<400; i++) if (reserve.get('2026-10','2026-10-28',9000)) accepted++;
assert.equal(accepted, 300);
assert.equal(reserve.get('2026-10','2026-10-29',9000).used,301);
for (let day=1; day<=31; day++) for(let i=0; i<310; i++) reserve.get('2026-12',`2026-12-${String(day).padStart(2,'0')}`,9000);
assert.equal(db.prepare('SELECT used FROM walking_usage WHERE month=?').get('2026-12').used,9000);
assert.equal(reserve.get('2026-12','2026-12-31',9000),undefined);
// A smaller shared-account allocation also stops exactly at its limit.
for(let i=0; i<30; i++) reserve.get('2027-01','2027-01-01',17);
assert.equal(db.prepare('SELECT used FROM walking_usage WHERE month=?').get('2027-01').used,17);
assert.equal(reserve.get('2027-01','2027-01-02',17),undefined);
db.close();
console.log('Walking budget: daily cutoff, monthly cutoff, day reset and reduced allocation passed.');
