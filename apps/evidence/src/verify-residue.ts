import assert from "node:assert/strict";
import {createDatabasePool} from "@tikdd/persistence";
const pool=createDatabasePool();
try{const result=await pool.query<{count:string}>(`SELECT (
  (SELECT count(*) FROM provider_daily_evidence WHERE provider_id LIKE 'evidence-%')+
  (SELECT count(*) FROM provider_delivery_outcomes WHERE provider_id LIKE 'evidence-%')+
  (SELECT count(*) FROM provider_delivery_outcomes WHERE provider_id='cleanup-verifier')+
  (SELECT count(*) FROM provider_pilot_policies WHERE provider_id LIKE 'evidence-%')+
  (SELECT count(*) FROM provider_pilot_guards WHERE provider_id LIKE 'evidence-%')+
  (SELECT count(*) FROM provider_rollout_rules WHERE rule_id LIKE 'evidence-grant-%')+
  (SELECT count(*) FROM resolve_tasks WHERE canonical_url LIKE 'https://fixture.invalid/%')+
  (SELECT count(*) FROM provider_evidence_evaluator_runs WHERE deployment LIKE 'verification-%')
)::text AS count`);assert.equal(result.rows[0]?.count,"0");process.stdout.write("Work item 11 verification residue is empty.\n");}finally{await pool.end();}
