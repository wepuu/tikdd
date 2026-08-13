import { spawnSync } from "node:child_process";

const pnpmCli=process.env.npm_execpath;
const command=pnpmCli?process.execPath:process.platform==="win32"?"pnpm.cmd":"pnpm";
const prefix=pnpmCli?[pnpmCli]:[];
const environment={
  ...process.env,
  CI:"true",
  DATABASE_URL:process.env.DATABASE_URL??"postgresql://tikdd:tikdd@localhost:5432/tikdd",
  REDIS_URL:process.env.REDIS_URL??"redis://localhost:16379",
  TIKDD_CANARY_AUTHORIZED:"false",
  WORK_ITEM_10_ALLOW_LIVE_NETWORK:"false",
  ENABLE_TWITTERSAVER_PROVIDER:"false",
  ENABLE_SSSTWITTER_PROVIDER:"false",
  ENABLE_DLPANDA_PROVIDER:"false",
  ENABLE_MOCK_PROVIDER:"false",
  HTTP_PROXY:"",HTTPS_PROXY:"",ALL_PROXY:"",http_proxy:"",https_proxy:"",all_proxy:"",
  NO_PROXY:"localhost,127.0.0.1,::1"
};

const stages=[
  ["local-postgres-and-redis",["infra:up"]],
  ["local-infrastructure-health",["infra:status"]],
  ["schema-migrations",["db:migrate"]],
  ["admin-security-routing-content-seo-and-ui",["test:work-item-12"]],
  ["postgres-task-admission-and-cleanup",["db:verify-task-admission"]],
  ["redis-admission-and-concurrency",["verify:admission-control"]],
  ["circuit-health-and-half-open-recovery",["verify:routing-health"]],
  ["deny-rollout-conflict-propagation-and-rollback",["verify:rollout-control"]],
  ["probe-lease-and-resume-never-grants",["verify:pilot-control"]],
  ["bounded-retention-cleanup",["verify:cleanup"]],
  ["privacy-and-verification-residue",["verify:work-item-12:residue"]],
  ["repository-quality-and-production-builds",["check"]],
  ["post-build-verification-residue",["verify:work-item-12:residue"]]
];

const startedAt=Date.now();const results=[];
for(const [stage,args] of stages){const started=Date.now();process.stdout.write(`${JSON.stringify({event:"work_item_12_stage_start",stage,liveProviderNetwork:false})}\n`);const result=spawnSync(command,[...prefix,"--pm-on-fail=ignore","--config.confirm-modules-purge=false",...args],{cwd:process.cwd(),env:environment,stdio:"inherit",windowsHide:true});if(result.error)throw result.error;const passed=result.status===0;const durationMs=Date.now()-started;results.push({stage,passed,durationMs});process.stdout.write(`${JSON.stringify({event:"work_item_12_stage_complete",stage,passed,durationMs})}\n`);if(!passed)process.exit(result.status??1);}
process.stdout.write(`${JSON.stringify({event:"work_item_12_verification_complete",passed:true,liveProviderNetwork:false,cloudflareRequired:false,publicOpenApiChanged:false,stageCount:results.length,durationMs:Date.now()-startedAt,stages:results})}\n`);
