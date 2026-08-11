import {describe,expect,it} from "vitest";
import {loadEvidenceConfiguration} from "../src/configuration";
describe("evidence configuration",()=>{
  it("defaults to the five-minute restrictive schedule",()=>expect(loadEvidenceConfiguration({})).toMatchObject({intervalMs:300000,rebuildDays:4,snapshotTtlMs:30000}));
  it("requires deployment ownership in production",()=>expect(()=>loadEvidenceConfiguration({NODE_ENV:"production"})).toThrow(/required/));
});
