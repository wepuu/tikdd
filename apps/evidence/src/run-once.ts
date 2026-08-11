import { executeEvidenceCycle } from "./runtime";
const execution=await executeEvidenceCycle();
try { process.stdout.write(`${JSON.stringify(execution.result)}\n`); if(execution.result.status==="failed")process.exitCode=1; }
finally { await execution.close(); }
