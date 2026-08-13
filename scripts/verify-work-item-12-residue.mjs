import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import pg from "pg";
import Redis from "ioredis";

const databaseUrl=process.env.DATABASE_URL??"postgresql://tikdd:tikdd@localhost:5432/tikdd";
const redisUrl=process.env.REDIS_URL??"redis://localhost:16379";
const pool=new pg.Pool({connectionString:databaseUrl});
const redis=new Redis(redisUrl,{maxRetriesPerRequest:1,lazyConnect:true});

async function scanRedis(pattern){let cursor="0";const keys=[];do{const page=await redis.scan(cursor,"MATCH",pattern,"COUNT",100);cursor=page[0];keys.push(...page[1]);}while(cursor!=="0");return keys;}

async function browserArtifacts(root){const matches=[];const ignored=new Set([".git","node_modules",".pnpm-store",".next",".next-admin-dev",".next-web-dev",".next-web-build",".next-web-production",".tikdd-admin-runtime","dist","coverage"]);async function walk(directory){for(const item of await readdir(directory,{withFileTypes:true})){if(item.isDirectory()&&ignored.has(item.name))continue;const path=join(directory,item.name);if(item.isDirectory()){await walk(path);continue;}const normalized=item.name.toLowerCase();if(extname(normalized)===".har"||/(?:storage[-_.]?state|browser[-_.]?session|auth[-_.]?state|cookies?)\.json$/.test(normalized))matches.push(relative(root,path));}}await walk(root);return matches;}

try{
  const result=await pool.query(`SELECT
    (SELECT count(*) FROM resolve_tasks WHERE canonical_url LIKE 'https://fixture.invalid/%' OR canonical_url LIKE '%/admission-verification/%')::int AS submitted_urls,
    (SELECT count(*) FROM provider_attempts WHERE provider_id LIKE 'verification-%')::int AS provider_attempts,
    (SELECT count(*) FROM provider_rollout_rules WHERE provider_id LIKE 'verification-%')::int AS rollout_rules,
    (SELECT count(*) FROM provider_pilot_policies WHERE provider_id LIKE 'verification-%' OR provider_id LIKE 'evidence-%')::int AS pilot_policies,
    (SELECT count(*) FROM provider_pilot_guards WHERE provider_id LIKE 'verification-%' OR provider_id LIKE 'evidence-%')::int AS pilot_guards,
    (SELECT count(*) FROM provider_pilot_guard_audit WHERE provider_id LIKE 'verification-%' OR provider_id LIKE 'evidence-%')::int AS pilot_audits,
    (SELECT count(*) FROM provider_canary_measurements WHERE provider_id='verification-provider')::int AS canary_measurements,
    (SELECT count(*) FROM provider_delivery_outcomes WHERE provider_id LIKE 'evidence-%' OR provider_id='cleanup-verifier')::int AS delivery_outcomes,
    (SELECT count(*) FROM provider_daily_evidence WHERE provider_id LIKE 'evidence-%')::int AS daily_evidence,
    (SELECT count(*) FROM provider_evidence_evaluator_runs WHERE deployment LIKE 'verification-%')::int AS evaluator_runs,
    (SELECT count(*) FROM admin_command_receipts WHERE actor_subject LIKE 'verification-%' OR actor_subject='work_item_12_verification')::int AS admin_receipts`);
  const counts=result.rows[0];assert.ok(counts);
  for(const [scope,count] of Object.entries(counts))assert.equal(Number(count),0,`${scope} retained work-item verification residue.`);
  await redis.connect();
  const redisKeys=[...await scanRedis("tikdd:*verification*"),...await scanRedis("tikdd:*verify-*"),...await scanRedis("tikdd:*work-item-12*")];
  assert.deepEqual([...new Set(redisKeys)].sort(),[],"Redis retained work-item verification keys.");
  const artifacts=await browserArtifacts(process.cwd());assert.deepEqual(artifacts,[],"Repository retained browser authentication or traffic artifacts.");
  process.stdout.write(`${JSON.stringify({event:"work_item_12_residue_complete",passed:true,databaseRows:0,redisKeys:0,browserArtifacts:0,accountRowsInspected:false,secretValuesRead:false})}\n`);
}finally{redis.disconnect();await pool.end();}
