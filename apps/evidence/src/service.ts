import { loadEvidenceConfiguration } from "./configuration";
import { executeEvidenceCycle } from "./runtime";
const configuration=loadEvidenceConfiguration();let stopping=false;
const stop=()=>{stopping=true;};process.once("SIGINT",stop);process.once("SIGTERM",stop);
while(!stopping){const execution=await executeEvidenceCycle();try{process.stdout.write(`${JSON.stringify(execution.result)}\n`);}finally{await execution.close();}
  if(!stopping)await new Promise((resolve)=>setTimeout(resolve,configuration.intervalMs));}
