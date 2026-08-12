import { AdminActorSubjectSchema, AdminUsernameSchema } from "@tikdd/admin-contracts";
import type { Pool, QueryResultRow } from "pg";

interface AccountRow extends QueryResultRow { account_id:string;username:string;password_hash:string;enabled:boolean;credential_version:string;password_changed_at:Date; }
export interface AdminAccountRecord { accountId:string;username:string;passwordHash:string;enabled:boolean;credentialVersion:number;passwordChangedAt:string; }
function map(row:AccountRow):AdminAccountRecord{return{accountId:AdminActorSubjectSchema.parse(row.account_id),username:AdminUsernameSchema.parse(row.username),passwordHash:row.password_hash,enabled:row.enabled,credentialVersion:Number(row.credential_version),passwordChangedAt:row.password_changed_at.toISOString()};}

export class AdminAccountRepository {
  constructor(private readonly pool:Pool){}
  async findByUsername(input:string){const username=AdminUsernameSchema.parse(input);const result=await this.pool.query<AccountRow>("SELECT account_id,username,password_hash,enabled,credential_version,password_changed_at FROM admin_accounts WHERE username=$1",[username]);return result.rows[0]?map(result.rows[0]):null;}
  async findById(input:string){const id=AdminActorSubjectSchema.parse(input);const result=await this.pool.query<AccountRow>("SELECT account_id,username,password_hash,enabled,credential_version,password_changed_at FROM admin_accounts WHERE account_id=$1",[id]);return result.rows[0]?map(result.rows[0]):null;}
  async create(input:{accountId:string;username:string;passwordHash:string}){const id=AdminActorSubjectSchema.parse(input.accountId);const username=AdminUsernameSchema.parse(input.username);const result=await this.pool.query<AccountRow>("INSERT INTO admin_accounts(account_id,username,password_hash) VALUES($1,$2,$3) RETURNING account_id,username,password_hash,enabled,credential_version,password_changed_at",[id,username,input.passwordHash]);return map(result.rows[0] as AccountRow);}
  async updatePassword(accountId:string,passwordHash:string){const id=AdminActorSubjectSchema.parse(accountId);const result=await this.pool.query<AccountRow>("UPDATE admin_accounts SET password_hash=$2,credential_version=credential_version+1,password_changed_at=NOW(),updated_at=NOW() WHERE account_id=$1 RETURNING account_id,username,password_hash,enabled,credential_version,password_changed_at",[id,passwordHash]);return result.rows[0]?map(result.rows[0]):null;}
  async setEnabled(accountId:string,enabled:boolean){const id=AdminActorSubjectSchema.parse(accountId);const result=await this.pool.query<AccountRow>("UPDATE admin_accounts SET enabled=$2,credential_version=credential_version+1,updated_at=NOW() WHERE account_id=$1 RETURNING account_id,username,password_hash,enabled,credential_version,password_changed_at",[id,enabled]);return result.rows[0]?map(result.rows[0]):null;}
  async enabledCount(){const result=await this.pool.query<{count:string}>("SELECT COUNT(*)::text AS count FROM admin_accounts WHERE enabled=TRUE");return Number(result.rows[0]?.count??0);}
}
