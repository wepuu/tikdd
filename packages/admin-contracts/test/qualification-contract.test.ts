import { describe,expect,it } from "vitest";
import { AdminQualificationLockCommandSchema,AdminQualificationReviewCommandSchema,AdminMutationReceiptSchema } from "../src";

describe("qualification Admin contracts",()=>{
  it("binds review and lock commands to one exact tuple",()=>{
    const base={providerId:"ssstwitter",platform:"x",region:"nl",expectedRevision:2,reason:"Owner reviewed the exact evidence window.",confirmation:"ssstwitter/x/nl",idempotencyKey:"abcdefghijklmnop"};
    expect(AdminQualificationReviewCommandSchema.parse({...base,decision:"approve",targetStage:"limited",approvalReference:"owner-review-7"})).toMatchObject({decision:"approve"});
    expect(()=>AdminQualificationReviewCommandSchema.parse({...base,confirmation:"x/nl",decision:"hold",targetStage:"internal",approvalReference:null})).toThrow();
    expect(AdminQualificationLockCommandSchema.parse({...base,proposalId:"11111111-1111-4111-8111-111111111111",expectedProposalRevision:1})).toMatchObject({expectedProposalRevision:1});
  });
  it("accepts qualification as an authoritative receipt aggregate",()=>{expect(AdminMutationReceiptSchema.parse({schemaVersion:"1",commandId:`cmd_${"a".repeat(32)}`,aggregate:"qualification",
    targetId:"ssstwitter/x/nl",expectedRevision:2,acceptedRevision:3,currentRevision:3,propagatedRevision:3,state:"propagated",acceptedAt:"2026-08-14T00:00:00.000Z",completedAt:"2026-08-14T00:00:00.000Z"}).aggregate).toBe("qualification");});
});
