import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const pkg=JSON.parse(read("package.json")); const core=read("scripts/calibration-operations-core.mjs"); const cli=read("scripts/calibration-operations.mjs"); const compose=read("compose.production.yml");
for(const command of ["preflight","start","submit","status","stop"]) if(pkg.scripts?.[`calibration:${command}`]!==`node scripts/calibration-operations.mjs ${command}`) throw new Error(`Missing calibration:${command}`);
for(const invariant of ["ssstwitter","canary-global","qualificationRevision","publicRuntime","operationalServices","conflictingGrantCount","publicWaiting","emergencyDeny","taskLimit","cadenceMs","maximumConcurrency"]) if(!core.includes(invariant)) throw new Error(`X-GATE-03 invariant missing: ${invariant}`);
if(!cli.includes('TIKDD_CALIBRATION_EXECUTE')||!cli.includes('exec","-T","calibration-api')||!cli.includes("cannot be restarted")||cli.includes("console.log(source)")) throw new Error("X-GATE-03 execution or source secrecy boundary is missing.");
if(!compose.includes("TIKDD_INTERNAL_AUTHORIZATION_ID")||!compose.includes("TIKDD_INTERNAL_WINDOW_ENDS_AT")) throw new Error("Runtime authorization window binding is missing.");
process.stdout.write(`${JSON.stringify({event:"x_gate_03_verification_complete",passed:true,providerTraffic:false,productionChanged:false})}\n`);
