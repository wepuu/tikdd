import { NextRequest,NextResponse } from "next/server";import { getAdminSession,tokenFromRequest } from "../../../../../lib/admin-auth-client";
export async function GET(request:NextRequest){const session=await getAdminSession(tokenFromRequest(request));return session?NextResponse.json(session):NextResponse.json({error:"UNAUTHORIZED"},{status:401});}
