import { spawnSync } from "node:child_process";

const pnpmCli=process.env.npm_execpath;
const command=pnpmCli?process.execPath:process.platform==="win32"?"pnpm.cmd":"pnpm";
const prefix=pnpmCli?[pnpmCli]:[];
const environment={...process.env,CI:"true",WORK_ITEM_10_ALLOW_LIVE_NETWORK:"false",TIKDD_CANARY_AUTHORIZED:"false",HTTP_PROXY:"",HTTPS_PROXY:"",ALL_PROXY:"",http_proxy:"",https_proxy:"",all_proxy:""};
const stages=[["provider-capability-distribution-contracts",["test:work-item-13"]],["capability-canary-pinning",["test:work-item-13-canary"]],["repository-typecheck",["typecheck"]],["repository-lint",["lint"]]];
for(const [stage,args] of stages){process.stdout.write(`${JSON.stringify({event:"work_item_13_stage_start",stage,liveNetwork:false})}\n`);const result=spawnSync(command,[...prefix,"--pm-on-fail=ignore","--config.confirm-modules-purge=false",...args],{cwd:process.cwd(),env:environment,stdio:"inherit",windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);process.stdout.write(`${JSON.stringify({event:"work_item_13_stage_complete",stage,passed:true})}\n`);}
process.stdout.write(`${JSON.stringify({event:"work_item_13_verification_complete",passed:true,liveNetwork:false,providerCanariesAuthorized:false})}\n`);
