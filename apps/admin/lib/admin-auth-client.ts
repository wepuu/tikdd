import { AdminLoginResultSchema,AdminSessionSchema,type AdminSession } from "@tikdd/admin-contracts";
import type { NextRequest } from "next/server";
import { loadAdminApiConnection } from "./admin-api-client";

export const productionCookie="__Host-tikdd_admin_session";export const developmentCookie="tikdd_admin_session_dev";
export function cookieName(){return process.env.NODE_ENV==="production"?productionCookie:developmentCookie;}
export function sessionTokenFromCookie(raw:string|null|undefined){if(!raw)return null;for(const part of raw.split(";")){const [name,...value]=part.trim().split("=");if(name===cookieName())return decodeURIComponent(value.join("="));}return null;}
export function loadAdminAuthConnection(environment:NodeJS.ProcessEnv=process.env){const configuration=loadAdminApiConnection(environment);return{origin:configuration.internalOrigin,admin:configuration.adminOrigin,proof:configuration.originProof};}
function connection(){return loadAdminAuthConnection();}
async function call(path:string,input:{method?:"GET"|"POST";body?:unknown;token?:string|null}={}){const config=connection();const headers:Record<string,string>={accept:"application/json",host:new URL(config.admin).host,origin:config.admin,"sec-fetch-site":"same-origin"};if(input.body!==undefined)headers["content-type"]="application/json";if(input.token)headers["x-tikdd-admin-session"]=input.token;if(config.proof)headers["x-tikdd-origin-proof"]=config.proof;return fetch(new URL(path,config.origin),{method:input.method??"GET",headers,...(input.body===undefined?{}:{body:JSON.stringify(input.body)}),cache:"no-store",signal:AbortSignal.timeout(5000)});}
export async function loginAdmin(body:unknown){const response=await call("/auth/v1/login",{method:"POST",body});const payload=await response.json().catch(()=>null);return{ok:response.ok,status:response.status,retryAfter:response.headers.get("retry-after"),data:response.ok?AdminLoginResultSchema.parse(payload):null,error:response.ok?null:payload};}
export async function getAdminSession(token:string|null):Promise<AdminSession|null>{if(!token)return null;try{const response=await call("/auth/v1/session",{token});return response.ok?AdminSessionSchema.parse(await response.json()):null;}catch{return null;}}
export async function logoutAdmin(token:string|null,allDevices:boolean){return call("/auth/v1/logout",{method:"POST",token,body:{allDevices}});}
export async function changeAdminPassword(token:string|null,body:unknown){return call("/auth/v1/password",{method:"POST",token,body});}
export function tokenFromRequest(request:NextRequest){return request.cookies.get(cookieName())?.value??null;}
